// StrokeManager.ts
//
// ── 架构原则 ──────────────────────────────────────────────────────────────────
//
//  【坐标系】
//    canvas 尺寸 = 物理像素（width = logicalW * dpr）
//    canvas 永远没有任何 transform / scale —— ctx 始终是物理坐标系
//    外部调用方传入的坐标必须是"逻辑像素"（CSS px），
//    StrokeManager 在内部统一乘以 dpr 再写入 canvas。
//
//  【为什么这样是对的】
//    getImageData / putImageData / clearRect 操作物理像素，无视任何 transform。
//    如果 canvas 有 scale(dpr,dpr)，这三个操作存/取的是"缩小了 dpr 倍"的区域，
//    和实际绘制内容对不上，undo 就会空白或错位。
//    保持 canvas 无 transform，三者永远在同一坐标系，问题根本不存在。
//
//  【与 ShapeManager / DrawLayerManager 的边界】
//    StrokeManager 只管像素笔刷，不知道 shapes 的存在。
//    composite 由外部（DrawLayerManager）调用，把 StrokeManager 的 canvas
//    drawImage 到 display canvas 上（identity transform，物理像素对物理像素）。
//
// ─────────────────────────────────────────────────────────────────────────────

import {
  BRUSHES, DrawState, sharedDrawState,
  universalRenderStroke, buildPenSvgPath,
} from './DrawPanel'

// ── 类型 ──────────────────────────────────────────────────────────────────────

export interface StrokeLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  canvas: HTMLCanvasElement   // 物理像素，无 transform
}

export type StrokeManagerEvent =
  | { type: 'layers-changed' }
  | { type: 'undo-state-changed'; canUndo: boolean }

type Listener = (e: StrokeManagerEvent) => void

// ── 输入点类型（逻辑坐标） ────────────────────────────────────────────────────
export interface LogicalPoint {
  x: number        // CSS px（逻辑像素）
  y: number        // CSS px（逻辑像素）
  t: number        // Date.now()
  pressure: number // 0–1
}

// ─────────────────────────────────────────────────────────────────────────────

export class StrokeManager {
  private layers: StrokeLayer[] = []
  private activeLayerId: string | null = null
  private history: Map<string, ImageData[]> = new Map()
  private listeners: Listener[] = []

  // 当前物理尺寸（由外部 resizeDisplay 写入）
  private physW = 800
  private physH = 600
  private dpr   = 1

  // ── 持久化 ──────────────────────────────────────────────────────────────────
  private pageId: string
  private persistTimer: ReturnType<typeof setTimeout> | null = null

  constructor(pageId: string) {
    this.pageId = pageId
  }

  private get storageKey() { return `sm-v1-${this.pageId}` }

  // ── 事件总线 ────────────────────────────────────────────────────────────────
  on(fn: Listener)  { if (!this.listeners.includes(fn)) this.listeners.push(fn) }
  off(fn: Listener) { this.listeners = this.listeners.filter(l => l !== fn) }
  private emit(e: StrokeManagerEvent) { this.listeners.forEach(l => l(e)) }

  // ── 初始化 / 销毁 ────────────────────────────────────────────────────────────

  /**
   * 外部在 canvas ref 回调里调用，传入物理尺寸。
   * 不需要传 ctx，StrokeManager 自己 getContext。
   */
  init(physW: number, physH: number, dpr: number) {
    this.physW = physW
    this.physH = physH
    this.dpr   = dpr

    if (this.layers.length === 0) {
      this._restore().then(ok => {
        if (!ok) this.addLayer()
        // 异步恢复完成后通知外部重新 composite，否则恢复内容不显示
        this.emit({ type: 'layers-changed' })
      })
    }
    // 如果已有 layers（页面重新渲染），只需确保尺寸对齐
    else {
      this._ensureLayerSizes()
    }
  }

  destroy() {
    this._flushPersist()
  }

  // ── Layer 管理 ───────────────────────────────────────────────────────────────

  addLayer(name?: string): StrokeLayer {
    const canvas = document.createElement('canvas')
    canvas.width  = this.physW
    canvas.height = this.physH
    // !! 不调用任何 scale / setTransform !! canvas 就是纯物理像素
    const layer: StrokeLayer = {
      id: crypto.randomUUID(),
      name: name ?? `Layer ${this.layers.length + 1}`,
      visible: true, locked: false, opacity: 1, canvas,
    }
    this.layers.push(layer)
    this.activeLayerId = layer.id
    this.emit({ type: 'layers-changed' })
    return layer
  }

  getLayers(): Readonly<StrokeLayer[]> { return this.layers.map(l => ({ ...l })) }
  getActiveLayerId() { return this.activeLayerId }

  setActiveLayer(id: string) {
    this.activeLayerId = id
    this.emit({ type: 'layers-changed' })
  }

  patchLayer(id: string, patch: Partial<Pick<StrokeLayer, 'name' | 'visible' | 'locked' | 'opacity'>>) {
    const l = this.layers.find(l => l.id === id)
    if (!l) return
    Object.assign(l, patch)
    this.emit({ type: 'layers-changed' })
  }

  moveLayer(id: string, dir: 'up' | 'down') {
    const i = this.layers.findIndex(l => l.id === id)
    if (dir === 'up'   && i < this.layers.length - 1) [this.layers[i], this.layers[i+1]] = [this.layers[i+1], this.layers[i]]
    if (dir === 'down' && i > 0)                       [this.layers[i], this.layers[i-1]] = [this.layers[i-1], this.layers[i]]
    this.emit({ type: 'layers-changed' })
  }

  deleteLayer(id: string) {
    if (this.layers.length <= 1) return
    this.layers = this.layers.filter(l => l.id !== id)
    if (this.activeLayerId === id) this.activeLayerId = this.layers[this.layers.length - 1].id
    this.history.delete(id)
    this.emit({ type: 'layers-changed' })
  }

  mergeDown(id: string) {
    const idx = this.layers.findIndex(l => l.id === id)
    if (idx <= 0) return
    const top = this.layers[idx], bot = this.layers[idx - 1]
    this.saveHistory()
    const ctx = bot.canvas.getContext('2d')!
    ctx.save(); ctx.globalAlpha = top.opacity
    ctx.drawImage(top.canvas, 0, 0); ctx.restore()
    this.layers.splice(idx, 1)
    this.history.delete(top.id)
    if (this.activeLayerId === top.id) this.activeLayerId = bot.id
    this.emit({ type: 'layers-changed' })
  }

  // ── resize ───────────────────────────────────────────────────────────────────

  resize(physW: number, physH: number, dpr: number) {
    this.physW = physW
    this.physH = physH
    this.dpr   = dpr
    this._ensureLayerSizes()
  }

  private _ensureLayerSizes() {
    for (const layer of this.layers) {
      if (layer.canvas.width === this.physW && layer.canvas.height === this.physH) continue
      const tmp = document.createElement('canvas')
      tmp.width = this.physW; tmp.height = this.physH
      // 物理像素对物理像素复制，不做任何 scale
      tmp.getContext('2d')!.drawImage(layer.canvas, 0, 0, this.physW, this.physH)
      layer.canvas.width  = this.physW
      layer.canvas.height = this.physH
      const ctx = layer.canvas.getContext('2d')!
      ctx.setTransform(1, 0, 0, 1, 0, 0)   // 确保没有遗留 transform
      ctx.drawImage(tmp, 0, 0, this.physW, this.physH)
    }
  }

  // ── composite 辅助：把所有可见 layer 画到目标 ctx ──────────────────────────
  // 调用方（DrawLayerManager）负责在 identity transform 下调用这个方法
  compositeInto(ctx: CanvasRenderingContext2D) {
    for (const layer of this.layers) {
      if (!layer.visible) continue
      ctx.globalAlpha = layer.opacity
      ctx.drawImage(layer.canvas, 0, 0)   // 物理像素对物理像素，1:1
    }
    ctx.globalAlpha = 1
  }

  // ── 历史 / Undo ──────────────────────────────────────────────────────────────

  saveHistory() {
    const layer = this._active()
    if (!layer) return
    // getImageData 操作物理像素，canvas 无 transform，完全对齐
    const snap = layer.canvas.getContext('2d')!
      .getImageData(0, 0, layer.canvas.width, layer.canvas.height)
    const stack = this.history.get(layer.id) ?? []
    this.history.set(layer.id, [...stack.slice(-19), snap])
    this.emit({ type: 'undo-state-changed', canUndo: true })
  }

  canUndo(): boolean {
    return Array.from(this.history.values()).some(s => s.length > 0)
  }

  undo() {
    const layer = this._active()
    if (!layer) return
    const stack = this.history.get(layer.id) ?? []
    const ctx   = layer.canvas.getContext('2d')!
    if (stack.length > 1) {
      // putImageData 也是物理像素，和 getImageData 完全对齐，undo 永远正确
      ctx.putImageData(stack[stack.length - 2], 0, 0)
      this.history.set(layer.id, stack.slice(0, -1))
    } else {
      ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
      this.history.set(layer.id, [])
      this.emit({ type: 'undo-state-changed', canUndo: false })
    }
    this._emitUndoState()
  }

  clearActiveLayer() {
    const layer = this._active()
    if (!layer) return
    this.saveHistory()
    layer.canvas.getContext('2d')!.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    this._schedulePersist()
  }

  // ── 笔刷绘制 ─────────────────────────────────────────────────────────────────
  //
  // 外部传入 LogicalPoint（逻辑坐标），内部统一乘以 dpr 转为物理坐标。
  // universalRenderStroke / drawStamp 等全部工作在物理像素，和 canvas 一致。
  //

  private _points: LogicalPoint[] = []
  private _drawing = false
  private _lastVel = 0
  private _distAcc = 0
  private _smearCanvas: HTMLCanvasElement | null = null
  private _penSnapData: ImageData | null = null

  // ── Pen SVG overlay（矢量实时预览）────────────────────────────────────────
  // 绘制中：回调把 SVG path string + 样式传给外部（CanvasArea）渲染到 SVG overlay
  // 笔抬起：光栅化进 Canvas，回调 null 清空 overlay
  onPenSvgUpdate: ((pathStr: string | null, color: string, alpha: number, logicalSize: number) => void) | null = null

  // pen 绘制中积累的逻辑坐标点（用于最终光栅化）
  private _penLogicalPts: LogicalPoint[] = []
  private _emaReady = false
  private _emaPrevX = 0; private _emaPrevY = 0; private _emaPrevT = 0
  private _emaVel = 0

  private _emaReset() { this._emaReady = false; this._emaVel = 0 }

  private _emaFilter(raw: LogicalPoint): LogicalPoint {
    if (!this._emaReady) {
      this._emaPrevX = raw.x; this._emaPrevY = raw.y; this._emaPrevT = raw.t
      this._emaReady = true; return raw
    }
    const dt = Math.max(1, raw.t - this._emaPrevT)
    const vel = Math.sqrt((raw.x - this._emaPrevX) ** 2 + (raw.y - this._emaPrevY) ** 2) / dt
    this._emaVel = this._emaVel * 0.6 + vel * 0.4
    const alpha = 0.35 + (0.82 - 0.35) * Math.max(0, Math.min(1, this._emaVel / 2.5))
    const sx = this._emaPrevX + (raw.x - this._emaPrevX) * alpha
    const sy = this._emaPrevY + (raw.y - this._emaPrevY) * alpha
    this._emaPrevX = sx; this._emaPrevY = sy; this._emaPrevT = raw.t
    return { x: sx, y: sy, t: raw.t, pressure: raw.pressure }
  }

  // 逻辑坐标 → 物理坐标（只在写入 canvas 前做，其他地方不做）
  private _toPhys(p: LogicalPoint): LogicalPoint {
    return { ...p, x: p.x * this.dpr, y: p.y * this.dpr }
  }

  startStroke(pt: LogicalPoint) {
    // _restore() 是异步的，首次使用时 layers 可能还是空数组。
    // 此时同步创建兜底 layer，确保画笔不会静默丢失。
    if (this.layers.length === 0) {
      this.addLayer()
    }
    const layer = this._active()
    if (!layer || layer.locked) return
    this.saveHistory()

    const dpr = this.dpr
    const state = sharedDrawState

    // smear 笔刷需要快照（物理像素画布，直接 drawImage）
    if (state.brushType === 'smear') {
      const src = layer.canvas
      if (!this._smearCanvas ||
          this._smearCanvas.width !== src.width ||
          this._smearCanvas.height !== src.height) {
        this._smearCanvas = document.createElement('canvas')
        this._smearCanvas.width  = src.width
        this._smearCanvas.height = src.height
      }
      const sctx = this._smearCanvas.getContext('2d')!
      sctx.clearRect(0, 0, src.width, src.height)
      sctx.drawImage(src, 0, 0)
    } else {
      this._smearCanvas = null
    }

    this._emaReset()
    const smoothed = this._emaFilter(pt)
    this._points = [smoothed, smoothed]
    this._lastVel = 0; this._distAcc = 0; this._drawing = true

    // pen 笔刷：走 SVG overlay，不需要 canvas 快照
    if (state.brushType === 'pen') {
      this._penSnapData = null
      this._penLogicalPts = [smoothed]
      // 通知外部显示起始点
      this._emitPenSvg(false)
      return
    } else {
      this._penSnapData = null
      this._penLogicalPts = []
    }

    this._renderSegment(0, this._points.length)
  }

  continueStroke(pts: LogicalPoint[]) {
    if (!this._drawing) return
    const filtered = pts.map(p => this._emaFilter(p))
    if (sharedDrawState.brushType === 'pen') {
      this._penLogicalPts.push(...filtered)
      this._emitPenSvg(false)
      return
    }
    const prevLen = this._points.length
    this._points.push(...filtered)
    this._renderSegment(Math.max(0, prevLen - 3), this._points.length)
  }

  endStroke() {
    const wasPen = sharedDrawState.brushType === 'pen'
    if (wasPen && this._penLogicalPts.length >= 2) {
      this._rasterizePenStroke()
    }
    if (wasPen && this.onPenSvgUpdate) {
      this.onPenSvgUpdate(null, '', 1, 0)  // clear overlay
    }
    this._smearCanvas = null
    this._penSnapData = null
    this._penLogicalPts = []
    this._drawing     = false
    this._points      = []
    this._lastVel     = 0
    this._distAcc     = 0
    this._emaReset()
    this._schedulePersist()
  }

  private _renderSegment(fromIdx: number, toIdx: number) {
    const layer = this._active()
    if (!layer) return
    const pts = this._points
    if (pts.length < 2 || toIdx - fromIdx < 1) return

    const state = sharedDrawState
    const brush = BRUSHES.find(b => b.type === state.brushType)
    if (!brush) return

    const ctx = layer.canvas.getContext('2d')!

    // ── 坐标换算 ──
    // 所有逻辑坐标在这里统一 × dpr，之后 universalRenderStroke 看到的全是物理像素
    // brushSize 也必须 × dpr，否则坐标放大了但笔刷半径没跟上，画出细点
    const dpr = this.dpr
    const toPhys = (p: LogicalPoint) => ({ ...p, x: p.x * dpr, y: p.y * dpr })
    const physState: DrawState = { ...state, size: state.size * dpr }

    if (state.brushType === 'pen') {
      // pen 走 SVG overlay，不在这里渲染
      return
    }

    const window = pts.slice(Math.max(0, fromIdx), toIdx).map(toPhys)
    if (window.length < 2) return

    const lastVelRef = { current: this._lastVel }
    const distAccRef = { current: this._distAcc }
    universalRenderStroke(
      ctx, window, physState, brush,
      lastVelRef, distAccRef,
      this._smearCanvas ?? undefined,
    )
    this._lastVel = lastVelRef.current
    this._distAcc = distAccRef.current
  }

  // ── 导出 ────────────────────────────────────────────────────────────────────

  exportAsDataUrls() {
    return this.layers.map(l => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity,
      dataUrl: l.canvas.toDataURL('image/png'),
    }))
  }

  // ── 持久化 ──────────────────────────────────────────────────────────────────

  private _schedulePersist() {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => { this._persist(); this.persistTimer = null }, 500)
  }

  private _flushPersist() {
    if (this.persistTimer) { clearTimeout(this.persistTimer); this.persistTimer = null }
    this._persist()
  }

  private _persist() {
    try {
      const layers = this.layers.map(l => ({
        id: l.id, name: l.name, visible: l.visible, locked: l.locked,
        opacity: l.opacity,
        dataUrl: l.canvas.toDataURL('image/png'),
      }))
      localStorage.setItem(this.storageKey, JSON.stringify({ layers, activeLayerId: this.activeLayerId }))
    } catch (e) {
      console.warn('[StrokeManager] persist failed:', e)
    }
  }

  private async _restore(): Promise<boolean> {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return false
      const payload = JSON.parse(raw) as {
        layers: {
          id: string; name: string; visible: boolean; locked: boolean; opacity: number
          dataUrl?: string
        }[]
        activeLayerId: string | null
      }
      if (!payload.layers?.length) return false

      this.layers = []
      for (const s of payload.layers) {
        const canvas = document.createElement('canvas')
        canvas.width  = this.physW
        canvas.height = this.physH
        const ctx = canvas.getContext('2d')!
        ctx.setTransform(1, 0, 0, 1, 0, 0)

        if (s.dataUrl) {
          await new Promise<void>(resolve => {
            const img = new Image()
            img.onload = () => {
              // offscreen 解码，再 putImageData 精确写入，避免 drawImage 二次插值
              const off = document.createElement('canvas')
              off.width  = img.naturalWidth
              off.height = img.naturalHeight
              const offCtx = off.getContext('2d')!
              offCtx.drawImage(img, 0, 0)
              if (img.naturalWidth === this.physW && img.naturalHeight === this.physH) {
                // 尺寸一致：putImageData 零插值写入
                ctx.putImageData(offCtx.getImageData(0, 0, img.naturalWidth, img.naturalHeight), 0, 0)
              } else {
                // 尺寸不一致（换窗口大小）：只能降级 drawImage
                ctx.drawImage(off, 0, 0, this.physW, this.physH)
              }
              resolve()
            }
            img.onerror = () => resolve()
            img.src = s.dataUrl!
          })
        }

        this.layers.push({
          id: s.id, name: s.name, visible: s.visible, locked: s.locked,
          opacity: s.opacity, canvas,
        })
      }
      this.activeLayerId = payload.activeLayerId ?? (this.layers[0]?.id ?? null)
      this.emit({ type: 'layers-changed' })
      return true
    } catch (e) {
      console.warn('[StrokeManager] restore failed:', e)
      return false
    }
  }

  // ── Pen SVG helpers ───────────────────────────────────────────────────────

  private _emitPenSvg(isComplete: boolean) {
    if (!this.onPenSvgUpdate) return
    const state = sharedDrawState
    const pts = this._penLogicalPts
    if (pts.length < 2) return
    const pathStr = buildPenSvgPath(
      pts.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
      state.size,   // logical size — SVG 用逻辑坐标，不乘 dpr
      0.38, 0.45,
      isComplete,
    )
    this.onPenSvgUpdate(pathStr, state.color, state.alpha, state.size)
  }

  private _rasterizePenStroke() {
    const layer = this._active()
    if (!layer) return
    const state = sharedDrawState
    const pts = this._penLogicalPts
    if (pts.length < 2) return

    // 生成最终完整路径（isComplete=true，含末端收尖）
    const pathStr = buildPenSvgPath(
      pts.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
      state.size * this.dpr,  // 光栅化进物理像素 canvas，size 乘 dpr
      0.38, 0.45,
      true,
    )
    if (!pathStr) return

    const ctx = layer.canvas.getContext('2d')!
    const [r, g, b] = ((): [number, number, number] => {
      // inline hexToRgb to avoid import cycle risk
      const hex = state.color.replace('#', '')
      if (hex.length === 3) return [
        parseInt(hex[0]+hex[0], 16),
        parseInt(hex[1]+hex[1], 16),
        parseInt(hex[2]+hex[2], 16),
      ]
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)]
    })()

    // 物理坐标系：把逻辑坐标点 × dpr 体现在 path 里（size 已经乘了，但坐标也要乘）
    // 重新生成一次用物理坐标的 path
    const physPathStr = buildPenSvgPath(
      pts.map(p => ({ x: p.x * this.dpr, y: p.y * this.dpr, pressure: p.pressure })),
      state.size * this.dpr,
      0.38, 0.45,
      true,
    )
    if (!physPathStr) return

    ctx.save()
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = state.alpha
    ctx.fillStyle = `rgb(${r},${g},${b})`
    ctx.fill(new Path2D(physPathStr))
    ctx.restore()
  }

  // ── 私有工具 (累了) ─────────────────────────────────────────────────────────────────

  private _active(): StrokeLayer | null {
    return this.layers.find(l => l.id === this.activeLayerId) ?? null
  }

  private _emitUndoState() {
    const canUndo = Array.from(this.history.values()).some(s => s.length > 0)
    this.emit({ type: 'undo-state-changed', canUndo })
  }
}