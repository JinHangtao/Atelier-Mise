// ─────────────────────────────────────────────────────────────────────────────
// segmentationWorker.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  SamModel,
  AutoProcessor,
  RawImage,
  Tensor,
  type PreTrainedModel,
  type Processor,
} from '@huggingface/transformers'
// q-floodfill 已移除，使用自实现 HYBRID 算法
import type { WorkerInMessage, WorkerOutMessage, MarkPoint } from './segmentationTypes'

const MODEL_ID = 'Xenova/slimsam-50-uniform'

let model: PreTrainedModel | null = null
let processor: Processor | null = null
let imageEmbeddings: Record<string, unknown> | null = null
let imageWidth  = 0
let imageHeight = 0
let savedInputs: any = null
let reshapedH = 0
let reshapedW = 0
let pendingEncode: { bitmap: ImageBitmap; width: number; height: number } | null = null

function post(msg: WorkerOutMessage) {
  self.postMessage(msg)
}

async function bitmapToRawImage(bitmap: ImageBitmap): Promise<RawImage> {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height)
  return new RawImage(imageData.data, bitmap.width, bitmap.height, 4)
}

function extractReshapedSize(inputs: any): [number, number] {
  const r = inputs.reshaped_input_sizes
  if (Array.isArray(r) && Array.isArray(r[0])) return [r[0][0], r[0][1]]
  if (r && r.data) return [r.data[0], r.data[1]]
  if (r && r.dims) {
    const data = r.data ?? r
    return [Number(data[0]), Number(data[1])]
  }
  if (inputs.pixel_values?.dims) return [inputs.pixel_values.dims[2], inputs.pixel_values.dims[3]]
  return [1024, 1024]
}

async function initModel() {
  post({ type: 'STATUS', status: 'loading' })
  try {
    model     = await SamModel.from_pretrained(MODEL_ID, { dtype: 'fp32', device: 'webgpu' })
    processor = await AutoProcessor.from_pretrained(MODEL_ID)
  } catch {
    try {
      model     = await SamModel.from_pretrained(MODEL_ID, { dtype: 'fp32', device: 'wasm' })
      processor = await AutoProcessor.from_pretrained(MODEL_ID)
    } catch (err) {
      post({ type: 'ERROR', message: `模型加载失败: ${String(err)}` })
      return
    }
  }
  post({ type: 'STATUS', status: 'idle' })
  if (pendingEncode) {
    const { bitmap, width, height } = pendingEncode
    pendingEncode = null
    await encodeImage(bitmap, width, height)
  }
}

async function encodeImage(bitmap: ImageBitmap, width: number, height: number) {
  if (!model || !processor) {
    pendingEncode?.bitmap.close()
    pendingEncode = { bitmap, width, height }
    return
  }
  post({ type: 'STATUS', status: 'encoding' })
  try {
    imageWidth  = width
    imageHeight = height
    const rawImage = await bitmapToRawImage(bitmap)
    bitmap.close()
    const inputs = await (processor as any)(rawImage)
    savedInputs = inputs
    ;[reshapedH, reshapedW] = extractReshapedSize(inputs)
    // @ts-ignore
    imageEmbeddings = await model.get_image_embeddings(inputs)
    post({ type: 'STATUS', status: 'ready' })
  } catch (err) {
    post({ type: 'ERROR', message: `图像编码失败: ${String(err)}` })
  }
}

async function decodeMask(points: MarkPoint[]) {
  if (!model || !imageEmbeddings || !savedInputs) {
    post({ type: 'ERROR', message: '请先编码图像' })
    return
  }
  if (points.length === 0) return

  post({ type: 'STATUS', status: 'inferring' })
  try {
    const n = points.length
    const pointData = new Float32Array(n * 2)
    for (let i = 0; i < n; i++) {
      pointData[i * 2]     = points[i].x * reshapedW
      pointData[i * 2 + 1] = points[i].y * reshapedH
    }
    const input_points = new Tensor('float32', pointData, [1, 1, n, 2])
    const labelData = new BigInt64Array(n)
    for (let i = 0; i < n; i++) labelData[i] = BigInt(points[i].label)
    const input_labels = new Tensor('int64', labelData, [1, 1, n])
    const image_size = new Tensor('int64',
      new BigInt64Array([BigInt(imageHeight), BigInt(imageWidth)]), [2])

    // @ts-ignore
    const { pred_masks, iou_scores } = await model({
      ...imageEmbeddings, input_points, input_labels, image_size,
    })

    const scores: number[] = Array.from(iou_scores.data as Float32Array)
    const bestIdx   = scores.indexOf(Math.max(...scores))
    const bestScore = scores[bestIdx]

    let maskData: Uint8ClampedArray
    try {
      const processed = await (processor as any).post_process_masks(
        pred_masks, savedInputs.original_sizes, savedInputs.reshaped_input_sizes,
      )
      const bestMaskTensor = processed[0][bestIdx]
      const raw = bestMaskTensor.data as Uint8Array | Uint8ClampedArray
      const rawArr = raw instanceof Uint8ClampedArray ? raw : new Uint8ClampedArray(raw)
      maskData = new Uint8ClampedArray(rawArr.length)
      for (let i = 0; i < rawArr.length; i++) maskData[i] = rawArr[i] ? 255 : 0
    } catch {
      const [, , mH, mW] = pred_masks.dims as number[]
      const totalPixels = mH * mW
      const bestLogits = (pred_masks.data as Float32Array).slice(
        bestIdx * totalPixels, (bestIdx + 1) * totalPixels,
      )
      maskData = bilinearUpsample(bestLogits, mW, mH, imageWidth, imageHeight)
    }

    post({ type: 'MASK_RESULT', maskData, width: imageWidth, height: imageHeight, score: bestScore })
    post({ type: 'STATUS', status: 'ready' })
  } catch (err) {
    post({ type: 'ERROR', message: `Mask 解码失败: ${String(err)}` })
    post({ type: 'STATUS', status: 'ready' })
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 快速选择核心：HYBRID 算法
// 流程：多点采样 → Lab色差连通BFS → morphology平滑 → 合并现有mask
// ═════════════════════════════════════════════════════════════════════════════

// ── 1. sRGB → 线性光 → XYZ(D65) → CIE L*a*b* ────────────────────────────────
// 全部内联，无外部依赖，Worker 内纯计算

function srgbToLinear(c: number): number {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

// 返回 [L, a, b]，L ∈ [0,100], a/b ∈ [-128,127]
function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB → linear
  const rl = srgbToLinear(r)
  const gl = srgbToLinear(g)
  const bl = srgbToLinear(b)

  // linear RGB → XYZ (D65 illuminant, sRGB matrix)
  const X = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  const Y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
  const Z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041

  // XYZ → Lab (normalize by D65 white point)
  const fx = labF(X / 0.95047)
  const fy = labF(Y / 1.00000)
  const fz = labF(Z / 1.08883)

  return [
    116 * fy - 16,          // L
    500 * (fx - fy),        // a
    200 * (fy - fz),        // b
  ]
}

function labF(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116
}

// CIE ΔE76（感知均匀欧氏距离）
function deltaE(
  L1: number, a1: number, b1: number,
  L2: number, a2: number, b2: number,
): number {
  const dL = L1 - L2
  const da = a1 - a2
  const db = b1 - b2
  return Math.sqrt(dL * dL + da * da + db * db)
}

// ── 2. 多点颜色采样 ───────────────────────────────────────────────────────────
// 在 (cx, cy) 周围 radius 像素内均匀采样，去重后得到色样集合。
// 用 Bresenham 螺旋采样：按环逐层向外，每环间隔 step 取点，
// 保证小半径时也能采到足够多的颜色变化。

interface LabSample {
  L: number; a: number; b: number
}

function collectSamples(
  cx: number,
  cy: number,
  radius: number,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): LabSample[] {
  const samples: LabSample[] = []
  const seen = new Set<number>() // 用 pixelIndex 去重

  // 始终包含中心点
  const addPixel = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const idx = y * width + x
    if (seen.has(idx)) return
    seen.add(idx)
    const base = idx * 4
    const [L, a, b] = rgbToLab(rgba[base], rgba[base + 1], rgba[base + 2])
    samples.push({ L, a, b })
  }

  addPixel(cx, cy)

  // radius=1 时只取中心点，精准单点采样
  if (radius <= 1) return samples

  // 螺旋采样：从 r=1 到 radius，每层按角度均匀取点
  for (let r = 1; r <= radius; r++) {
    // 每层取点数随半径线性增加，最少 4 个，最多 16 个（避免采样过多影响速度）
    const nPoints = Math.min(16, Math.max(4, Math.round(2 * Math.PI * r / 2)))
    for (let i = 0; i < nPoints; i++) {
      const angle = (2 * Math.PI * i) / nPoints
      const x = Math.round(cx + r * Math.cos(angle))
      const y = Math.round(cy + r * Math.sin(angle))
      addPixel(x, y)
    }
  }

  return samples
}

// ── 3. HYBRID 连通 BFS ────────────────────────────────────────────────────────
// 从种子点出发做 4-连通 BFS。
// 每步判断：当前像素与【色样集合中最近的那个】的 Lab ΔE < tolerance，则扩张。
// 这与纯单点 flood fill 的关键区别在于：
//   - 多色样 → 颜色渐变的区域（如阴影、纹理）也能跟随扩张
//   - Lab 距离 → 人眼感知准确，不会因为色相不同但亮度相近而误选

function hybridBFS(
  seedX: number,
  seedY: number,
  samples: LabSample[],
  tolerance: number,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const total   = width * height
  const visited = new Uint8Array(total)   // 0=未访问, 1=已选中
  // 使用 Int32Array 作为循环队列（比 JS Array 快 3~5x）
  const queue   = new Int32Array(total)
  let head = 0, tail = 0

  const seed = seedY * width + seedX
  visited[seed] = 1
  queue[tail++] = seed

  // 预计算：把 samples 转成平铺数组，避免对象访问开销
  const sL = new Float32Array(samples.length)
  const sA = new Float32Array(samples.length)
  const sB = new Float32Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    sL[i] = samples[i].L
    sA[i] = samples[i].a
    sB[i] = samples[i].b
  }
  const nSamples = samples.length

  const neighbors = [-1, 1, -width, width] // 4-连通偏移量

  while (head < tail) {
    const idx  = queue[head++]
    const base = idx * 4
    const [pL, pA, pB] = rgbToLab(rgba[base], rgba[base + 1], rgba[base + 2])

    // 与色样集合中最近颜色的 ΔE
    let minDE = Infinity
    for (let s = 0; s < nSamples; s++) {
      const de = deltaE(pL, pA, pB, sL[s], sA[s], sB[s])
      if (de < minDE) minDE = de
    }
    if (minDE > tolerance) continue // 超出容差，不扩张

    visited[idx] = 1

    const x = idx % width
    const y = (idx / width) | 0

    for (const off of neighbors) {
      const nIdx = idx + off
      if (nIdx < 0 || nIdx >= total) continue
      if (visited[nIdx]) continue
      // 检查水平方向是否跨行（防止左右越界绕行）
      if (off === -1 && x === 0)      continue
      if (off ===  1 && x === width - 1) continue

      visited[nIdx] = 1  // 提前标记，避免重复入队
      queue[tail++] = nIdx
    }
  }

  return visited
}

// ── 4. Morphology：先 dilate 再 erode（闭运算），填充小孔洞、平滑锯齿 ──────────
// 半径固定为 1（3×3 kernel），运行两次足够，对性能影响极小。

function morphClose(mask: Uint8Array, width: number, height: number): Uint8Array {
  return morphErode(morphDilate(mask, width, height), width, height)
}

function morphDilate(src: Uint8Array, width: number, height: number): Uint8Array {
  const dst = new Uint8Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (src[idx]) { dst[idx] = 1; continue }
      // 检查 4 邻域是否有前景
      if (x > 0         && src[idx - 1])      { dst[idx] = 1; continue }
      if (x < width - 1 && src[idx + 1])      { dst[idx] = 1; continue }
      if (y > 0         && src[idx - width])   { dst[idx] = 1; continue }
      if (y < height - 1 && src[idx + width])  { dst[idx] = 1; continue }
    }
  }
  return dst
}

function morphErode(src: Uint8Array, width: number, height: number): Uint8Array {
  const dst = new Uint8Array(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!src[idx]) continue
      // 4 邻域全是前景才保留
      if (x > 0          && !src[idx - 1])     continue
      if (x < width - 1  && !src[idx + 1])     continue
      if (y > 0          && !src[idx - width])  continue
      if (y < height - 1 && !src[idx + width])  continue
      dst[idx] = 1
    }
  }
  return dst
}

// ── 5. 主入口：quickSelect ────────────────────────────────────────────────────

function quickSelect(
  x: number,
  y: number,
  tolerance: number,
  sampleRadius: number,
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  mode: 'ADD' | 'SUBTRACT',
  existingMask: Uint8ClampedArray | null,
): Uint8ClampedArray {

  // 1. 采集色样
  const samples = collectSamples(x, y, sampleRadius, rgba, width, height)
  if (samples.length === 0) {
    return existingMask ? new Uint8ClampedArray(existingMask) : new Uint8ClampedArray(width * height)
  }

  // 2. HYBRID BFS：从种子点开始，Lab色差连通扩张
  //    BFS 内部对每个像素先入队再判距离，确保种子点本身一定被选中，
  //    解决"点不到小区域"的问题（种子点必然在 mask 内）
  const rawMask = hybridBFS(x, y, samples, tolerance, rgba, width, height)

  // 3. Morphology 闭运算：填洞 + 平滑边缘
  //    对大图（>4MP）跳过，避免卡顿
  const totalPx = width * height
  const smoothed = totalPx <= 4_000_000
    ? morphClose(rawMask, width, height)
    : rawMask

  // 4. 转为 Uint8ClampedArray（255/0）并与现有 mask 合并
  const result = new Uint8ClampedArray(totalPx)

  if (!existingMask) {
    for (let i = 0; i < totalPx; i++) result[i] = smoothed[i] ? 255 : 0
    return result
  }

  for (let i = 0; i < totalPx; i++) {
    const newBit = smoothed[i] ? 255 : 0
    if (mode === 'ADD') {
      result[i] = existingMask[i] | newBit
    } else {
      // SUBTRACT：从现有选区中去除新选中的区域
      result[i] = existingMask[i] & (~newBit & 0xFF)
    }
  }
  return result
}

// ── bilinearUpsample（SAM fallback，不变）────────────────────────────────────

function bilinearUpsample(
  logits: Float32Array,
  mW: number, mH: number,
  outW: number, outH: number,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(outW * outH)
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const srcX = (x / outW) * mW
      const srcY = (y / outH) * mH
      const x0 = Math.floor(srcX), y0 = Math.floor(srcY)
      const x1 = Math.min(x0 + 1, mW - 1)
      const y1 = Math.min(y0 + 1, mH - 1)
      const tx = srcX - x0, ty = srcY - y0
      const v =
        logits[y0 * mW + x0] * (1 - tx) * (1 - ty) +
        logits[y0 * mW + x1] * tx       * (1 - ty) +
        logits[y1 * mW + x0] * (1 - tx) * ty       +
        logits[y1 * mW + x1] * tx       * ty
      result[y * outW + x] = v > 0 ? 255 : 0
    }
  }
  return result
}

// ── 消息路由 ──────────────────────────────────────────────────────────────────

self.addEventListener('message', async (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data
  switch (msg.type) {
    case 'ENCODE_IMAGE':
      await encodeImage(msg.bitmap, msg.width, msg.height)
      break

    case 'DECODE_MASK':
      await decodeMask(msg.points)
      break

    case 'FLOOD_FILL': {
      const maskData = quickSelect(
        msg.x,
        msg.y,
        msg.tolerance,
        msg.sampleRadius,
        msg.imageData,
        msg.width,
        msg.height,
        msg.mode,
        msg.existingMask,
      )
      post({ type: 'FLOOD_RESULT', maskData, width: msg.width, height: msg.height })
      break
    }

    case 'RESET':
      imageEmbeddings = null
      savedInputs     = null
      imageWidth = imageHeight = reshapedH = reshapedW = 0
      post({ type: 'STATUS', status: 'idle' })
      break
  }
})

initModel()