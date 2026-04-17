'use client'
// ─────────────────────────────────────────────────────────────────────────────
// useSegmentation.ts
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react'
import type {
  BrushMode,
  MarkPoint,
  MaskState,
  ModelStatus,
  SegmentationControls,
  WorkerOutMessage,
} from './segmentationTypes'

export function useSegmentation(
  imageEl: HTMLImageElement | null,
): SegmentationControls & { _setCanvasSize: (w: number, h: number) => void } {

  const workerRef = useRef<Worker | null>(null)

  const [status, setStatus]               = useState<ModelStatus>('idle')
  const [points, setPoints]               = useState<MarkPoint[]>([])
  const [mask, setMask]                   = useState<MaskState | null>(null)
  const [brushMode, setBrushMode]         = useState<BrushMode>('quick_select')
  const [brushRadius, setBrushRadius]     = useState(18)
  // tolerance 现在对应 CIE ΔE，默认 28 ≈ PS 默认容差 32 的感知等效值
  const [tolerance, setTolerance]         = useState(16)
  // sampleRadius：采样半径（图像像素），默认 3
  const [sampleRadius, setSampleRadius]   = useState(3)
  // featherRadius：羽化半径（迭代次数），0=关闭，默认 1
  const [featherRadius, setFeatherRadius] = useState(1)

  const brushMaskRef     = useRef<Uint8ClampedArray | null>(null)
  const imgSizeRef       = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const canvasSizeRef    = useRef<{ w: number; h: number }>({ w: 0, h: 0 })
  const pendingEncodeRef = useRef<{
    bitmap: ImageBitmap; width: number; height: number
  } | null>(null)

  // undo 栈：存最近 20 个 mask 快照，不触发 re-render
  const undoStackRef = useRef<MaskState[]>([])
  const [canUndo, setCanUndo] = useState(false)
  // ref 桥接：让 worker message handler 闭包能拿到最新 pushUndo
  const pushUndoRef = useRef<(m: MaskState | null) => void>(() => {})

  // 原图 RGBA 缓存，快速选择时直接用
  const imageRGBARef = useRef<Uint8ClampedArray | null>(null)

  // ── Worker 初始化 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    const worker = new Worker(
      new URL('./segmentationWorker.ts', import.meta.url),
      { type: 'module' },
    )

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data
      switch (msg.type) {
        case 'STATUS':
          setStatus(msg.status)
          if (msg.status === 'idle' && pendingEncodeRef.current) {
            const pending = pendingEncodeRef.current
            pendingEncodeRef.current = null
            worker.postMessage(
              { type: 'ENCODE_IMAGE', bitmap: pending.bitmap, width: pending.width, height: pending.height },
              [pending.bitmap],
            )
          }
          break

        case 'MASK_RESULT':
          setMask(prev => {
            if (prev) pushUndoRef.current(prev)
            return { data: msg.maskData, width: msg.width, height: msg.height, score: msg.score }
          })
          break

        case 'FLOOD_RESULT':
          setMask(prev => {
            if (prev) pushUndoRef.current(prev)
            return { data: msg.maskData, width: msg.width, height: msg.height, score: 1 }
          })
          break

        case 'ERROR':
          console.error('[Segmentation]', msg.message)
          setStatus('error')
          break
      }
    }

    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
      pendingEncodeRef.current = null
    }
  }, [])

  // ── 图片切换时重新 encode + 缓存 RGBA ────────────────────────────────────────
  useEffect(() => {
    if (!imageEl) return
    if (!imageEl.complete || imageEl.naturalWidth === 0) return

    const w = imageEl.naturalWidth
    const h = imageEl.naturalHeight
    imgSizeRef.current = { w, h }

    brushMaskRef.current = new Uint8ClampedArray(w * h)

    setPoints([])
    setMask(null)
    undoStackRef.current = []
    setCanUndo(false)

    // 缓存原图 RGBA
    const offscreen = document.createElement('canvas')
    offscreen.width  = w
    offscreen.height = h
    const octx = offscreen.getContext('2d')!
    octx.drawImage(imageEl, 0, 0)
    imageRGBARef.current = octx.getImageData(0, 0, w, h).data as Uint8ClampedArray

    createImageBitmap(offscreen).then(bitmap => {
      const worker = workerRef.current
      if (!worker) { bitmap.close(); return }

      if (status === 'loading') {
        pendingEncodeRef.current?.bitmap.close()
        pendingEncodeRef.current = { bitmap, width: w, height: h }
      } else {
        worker.postMessage(
          { type: 'ENCODE_IMAGE', bitmap, width: w, height: h },
          [bitmap],
        )
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageEl])

  // ── undo 快照工具 ────────────────────────────────────────────────────────────
  const pushUndo = useCallback((current: MaskState | null) => {
    if (!current) return
    const stack = undoStackRef.current
    // 深拷贝 data，避免 Uint8ClampedArray 被后续操作污染
    stack.push({ ...current, data: new Uint8ClampedArray(current.data) })
    if (stack.length > 20) stack.shift()
    setCanUndo(true)
  }, [])
  pushUndoRef.current = pushUndo

  // ── 内部：触发 SAM decode ────────────────────────────────────────────────────
  const triggerDecode = useCallback((newPoints: MarkPoint[]) => {
    if (!workerRef.current || newPoints.length === 0) return
    workerRef.current.postMessage({ type: 'DECODE_MASK', points: newPoints })
  }, [])

  // ── canvas 尺寸同步 ──────────────────────────────────────────────────────────
  const setCanvasSize = useCallback((w: number, h: number) => {
    canvasSizeRef.current = { w, h }
  }, [])

  // ── 坐标转换：canvas → 归一化 ────────────────────────────────────────────────
  const toNormalized = useCallback((canvasX: number, canvasY: number) => {
    const { w: cw, h: ch } = canvasSizeRef.current
    const { w: iw, h: ih } = imgSizeRef.current
    if (!cw || !ch || !iw || !ih) return { nx: 0, ny: 0 }
    const scale     = Math.min(cw / iw, ch / ih)
    const renderedW = iw * scale
    const renderedH = ih * scale
    const offsetX   = (cw - renderedW) / 2
    const offsetY   = (ch - renderedH) / 2
    return {
      nx: Math.max(0, Math.min(1, (canvasX - offsetX) / renderedW)),
      ny: Math.max(0, Math.min(1, (canvasY - offsetY) / renderedH)),
    }
  }, [])

  // ── 坐标转换：canvas → 原图像素 ──────────────────────────────────────────────
  const toImagePixel = useCallback((canvasX: number, canvasY: number) => {
    const { w: cw, h: ch } = canvasSizeRef.current
    const { w: iw, h: ih } = imgSizeRef.current
    if (!cw || !ch || !iw || !ih) return { px: 0, py: 0 }
    const scale     = Math.min(cw / iw, ch / ih)
    const renderedW = iw * scale
    const renderedH = ih * scale
    const offsetX   = (cw - renderedW) / 2
    const offsetY   = (ch - renderedH) / 2
    const px = Math.round(((canvasX - offsetX) / renderedW) * iw)
    const py = Math.round(((canvasY - offsetY) / renderedH) * ih)
    return {
      px: Math.max(0, Math.min(iw - 1, px)),
      py: Math.max(0, Math.min(ih - 1, py)),
    }
  }, [])

  // ── SAM 点击 ─────────────────────────────────────────────────────────────────
  const onCanvasClick = useCallback(
    (canvasX: number, canvasY: number, isNegative: boolean) => {
      if (status !== 'ready') return
      const { nx, ny } = toNormalized(canvasX, canvasY)
      const newPoint: MarkPoint = { x: nx, y: ny, label: isNegative ? 0 : 1 }
      setPoints(prev => {
        const next = [...prev, newPoint]
        triggerDecode(next)
        return next
      })
      // SAM 结果异步回来，在 MASK_RESULT handler 里做 pushUndo
    },
    [status, toNormalized, triggerDecode],
  )

  // ── 快速选择点击 ──────────────────────────────────────────────────────────────
  const onQuickSelect = useCallback(
    (canvasX: number, canvasY: number, isSubtract: boolean) => {
      const worker = workerRef.current
      const rgba   = imageRGBARef.current
      if (!worker || !rgba) return

      const { px, py } = toImagePixel(canvasX, canvasY)
      const { w, h }   = imgSizeRef.current
      if (!w || !h) return

      // 零拷贝转移 RGBA buffer 所有权给 Worker
      const rgbaCopy = new Uint8ClampedArray(rgba)
      const existingMask = mask ? new Uint8ClampedArray(mask.data) : null

      worker.postMessage(
        {
          type: 'FLOOD_FILL',
          x: px,
          y: py,
          tolerance,
          sampleRadius,          // ← 新增：传入采样半径
          imageData: rgbaCopy,
          width: w,
          height: h,
          mode: isSubtract ? 'SUBTRACT' : 'ADD',
          existingMask,
        },
        [
          rgbaCopy.buffer,
          ...(existingMask ? [existingMask.buffer] : []),
        ],
      )
    },
    [mask, tolerance, sampleRadius, toImagePixel],
  )

  // ── 画笔笔画 ─────────────────────────────────────────────────────────────────
  const onBrushStroke = useCallback(
    (strokePoints: { x: number; y: number }[]) => {
      if (!brushMaskRef.current) return
      const { w: iw, h: ih } = imgSizeRef.current
      if (!iw || !ih) return

      const buf     = brushMaskRef.current
      const isErase = brushMode === 'brush_erase'
      const { w: cw, h: ch } = canvasSizeRef.current
      const scale         = Math.min(cw / iw, ch / ih)
      const radiusInImage = Math.max(1, Math.round(brushRadius / scale))
      const r2            = radiusInImage * radiusInImage

      for (const pt of strokePoints) {
        const { px: cx, py: cy } = toImagePixel(pt.x, pt.y)
        const x0 = Math.max(0, cx - radiusInImage)
        const x1 = Math.min(iw - 1, cx + radiusInImage)
        const y0 = Math.max(0, cy - radiusInImage)
        const y1 = Math.min(ih - 1, cy + radiusInImage)
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) {
              buf[y * iw + x] = isErase ? 0 : 255
            }
          }
        }
      }

      setMask(prev => {
        if (prev) pushUndo(prev)
        if (!prev) return { data: new Uint8ClampedArray(buf), width: iw, height: ih, score: 1 }
        const merged = new Uint8ClampedArray(prev.data.length)
        for (let i = 0; i < merged.length; i++) {
          merged[i] = isErase ? (prev.data[i] & buf[i]) : (prev.data[i] | buf[i])
        }
        return { ...prev, data: merged }
      })
    },
    [brushMode, brushRadius, toImagePixel],
  )

  // ── 撤销最后一个 SAM 点 ──────────────────────────────────────────────────────
  const undoLastPoint = useCallback(() => {
    setPoints(prev => {
      if (prev.length === 0) return prev
      const next = prev.slice(0, -1)
      if (next.length === 0) {
        setMask(null)
        workerRef.current?.postMessage({ type: 'RESET' })
        if (imageEl) {
          const { w, h } = imgSizeRef.current
          const offscreen = document.createElement('canvas')
          offscreen.width  = w
          offscreen.height = h
          offscreen.getContext('2d')!.drawImage(imageEl, 0, 0)
          createImageBitmap(offscreen).then(bitmap => {
            workerRef.current?.postMessage(
              { type: 'ENCODE_IMAGE', bitmap, width: w, height: h },
              [bitmap],
            )
          })
        }
      } else {
        triggerDecode(next)
      }
      return next
    })
  }, [imageEl, triggerDecode])

  // ── Undo mask ────────────────────────────────────────────────────────────────
  const undoMask = useCallback(() => {
    const stack = undoStackRef.current
    if (stack.length === 0) return
    const prev = stack.pop()!
    setMask(prev)
    setCanUndo(stack.length > 0)
  }, [])

  // ── 重置 ─────────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setPoints([])
    setMask(null)
    brushMaskRef.current?.fill(0)
    undoStackRef.current = []
    setCanUndo(false)
  }, [])

  // ── 边缘处理：先 erode 1px 去白边，再 N 次高斯模糊羽化 ─────────────────────
  // erode：把选区边缘向内收 1px，消除抠图产生的白边/杂色边缘
  // feather：对收紧后的边缘做渐变过渡，radius=0 只 erode 不羽化
  const featherMask = useCallback(
    (maskData: Uint8ClampedArray, w: number, h: number, radius = 1): Uint8ClampedArray => {
      // Step 1：erode 1px（4-邻域，任意邻居是背景则收紧）
      const eroded = new Uint8ClampedArray(maskData)
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x
          if (!maskData[idx]) continue
          if (
            !maskData[idx - 1] || !maskData[idx + 1] ||
            !maskData[idx - w] || !maskData[idx + w]
          ) {
            eroded[idx] = 0
          }
        }
      }

      if (radius === 0) return eroded

      // Step 2：N 次 3×3 高斯模糊，只处理边缘像素
      const kw   = [1, 2, 1, 2, 4, 2, 1, 2, 1]
      const kSum = 16
      let buf = eroded

      for (let pass = 0; pass < radius; pass++) {
        const out = new Uint8ClampedArray(buf)
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx  = y * w + x
            const self = buf[idx]
            const isEdge =
              buf[idx - 1] !== self || buf[idx + 1] !== self ||
              buf[idx - w]  !== self || buf[idx + w]  !== self
            if (!isEdge) continue
            let sum = 0, ki = 0
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++)
                sum += buf[(y + dy) * w + (x + dx)] * kw[ki++]
            out[idx] = Math.round(sum / kSum)
          }
        }
        buf = out
      }
      return buf
    },
    [],
  )

  // ── 应用 mask → 透明背景 PNG ─────────────────────────────────────────────────
  const applyMaskToImage = useCallback(
    (img: HTMLImageElement): string | null => {
      if (!mask) return null
      const { width: mw, height: mh, data: maskData } = mask
      const canvas = document.createElement('canvas')
      canvas.width  = mw
      canvas.height = mh
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, mw, mh)
      const imgData = ctx.getImageData(0, 0, mw, mh)
      const feathered = featherMask(maskData, mw, mh, featherRadius)
      for (let i = 0; i < feathered.length; i++) {
        imgData.data[i * 4 + 3] = feathered[i]
      }
      ctx.putImageData(imgData, 0, 0)
      return canvas.toDataURL('image/png')
    },
    [mask, featherRadius, featherMask],
  )

  // ── 钢笔工具 mask 合并 ────────────────────────────────────────────────────────
  const mergePenMask = useCallback((
    penData: Uint8ClampedArray, w: number, h: number,
  ) => {
    pushUndo(mask)
    const merged = new Uint8ClampedArray(penData.length)
    if (mask && mask.width === w && mask.height === h) {
      for (let i = 0; i < penData.length; i++) {
        merged[i] = Math.max(mask.data[i], penData[i])
      }
    } else {
      merged.set(penData)
    }
    setMask({ data: merged, width: w, height: h, score: 1 })
    setCanUndo(true)
  }, [mask, pushUndo])

  return {
    status,
    points,
    mask,
    brushMode,
    setBrushMode,
    brushRadius,
    setBrushRadius,
    tolerance,
    setTolerance,
    sampleRadius,
    setSampleRadius,
    featherRadius,
    setFeatherRadius,
    onCanvasClick,
    onBrushStroke,
    onQuickSelect,
    undoLastPoint,
    undoMask,
    canUndo,
    reset,
    applyMaskToImage,
    mergePenMask,
    _setCanvasSize: setCanvasSize,
  }
}