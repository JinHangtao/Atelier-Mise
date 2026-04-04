// ─────────────────────────────────────────────────────────────────────────────
// segmentationTypes.ts
// ─────────────────────────────────────────────────────────────────────────────

export type MarkPoint = {
  x: number
  y: number
  label: 1 | 0
}

export type BrushMode =
  | 'point_positive'
  | 'point_negative'
  | 'brush_add'
  | 'brush_erase'
  | 'quick_select'

export type ModelStatus =
  | 'idle'
  | 'loading'
  | 'encoding'
  | 'ready'
  | 'inferring'
  | 'error'

// ── Worker 消息协议 ───────────────────────────────────────────────────────────

/** 主线程 → Worker */
export type WorkerInMessage =
  | {
      type: 'ENCODE_IMAGE'
      bitmap: ImageBitmap
      width: number
      height: number
    }
  | {
      type: 'DECODE_MASK'
      points: MarkPoint[]
    }
  | {
      type: 'FLOOD_FILL'
      /** 原图像素坐标（已从 canvas 坐标转换好） */
      x: number
      y: number
      /** 感知容差，建议范围 8~80，对应 CIE ΔE */
      tolerance: number
      /**
       * 采样半径（像素）：在点击坐标周围采集多少范围内的颜色样本。
       * 值越大，采样颜色越多样，适合颜色渐变区域；默认 6。
       */
      sampleRadius: number
      /** 原图完整 RGBA 数据 */
      imageData: Uint8ClampedArray
      width: number
      height: number
      /** ADD = 加入选区，SUBTRACT = 从选区减去 */
      mode: 'ADD' | 'SUBTRACT'
      /** 当前已有的 mask，用于合并 */
      existingMask: Uint8ClampedArray | null
    }
  | {
      type: 'RESET'
    }

/** Worker → 主线程 */
export type WorkerOutMessage =
  | { type: 'STATUS'; status: ModelStatus }
  | {
      type: 'MASK_RESULT'
      maskData: Uint8ClampedArray
      width: number
      height: number
      score: number
    }
  | {
      type: 'FLOOD_RESULT'
      maskData: Uint8ClampedArray
      width: number
      height: number
    }
  | { type: 'ERROR'; message: string }

// ── 最终 mask 状态 ────────────────────────────────────────────────────────────

export type MaskState = {
  data: Uint8ClampedArray
  width: number
  height: number
  score: number
}

// ── useSegmentation hook 对外暴露的接口 ───────────────────────────────────────

export type SegmentationControls = {
  status: ModelStatus
  points: MarkPoint[]
  mask: MaskState | null
  brushMode: BrushMode
  setBrushMode: (mode: BrushMode) => void
  brushRadius: number
  setBrushRadius: (r: number) => void
  /** 快速选择感知容差 8~80（对应 CIE ΔE 距离） */
  tolerance: number
  setTolerance: (t: number) => void
  /** 快速选择采样半径 1~20 */
  sampleRadius: number
  setSampleRadius: (r: number) => void
  /** 应用时边缘羽化半径 0~6，0=关闭 */
  featherRadius: number
  setFeatherRadius: (r: number) => void
  onCanvasClick: (canvasX: number, canvasY: number, isNegative: boolean) => void
  onBrushStroke: (points: { x: number; y: number }[]) => void
  /** 快速选择点击：左键加入，右键/Alt 减去 */
  onQuickSelect: (canvasX: number, canvasY: number, isSubtract: boolean) => void
  undoLastPoint: () => void
  reset: () => void
  applyMaskToImage: (img: HTMLImageElement) => string | null
}