// DrawLayerManager.ts
// 纯 class，无 React 依赖。管理单页的多图层绘图系统。

import { BRUSHES, catmullRom, DrawState, sharedDrawState, universalRenderStroke, BrushConfig } from './DrawPanel'

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  canvas: HTMLCanvasElement
}

export type LayerManagerEvent =
  | { type: 'layers-changed' }
  | { type: 'undo-state-changed'; canUndo: boolean }

type Listener = (e: LayerManagerEvent) => void

export class DrawLayerManager {
  private layers: Layer[] = []
  private activeLayerId: string | null = null
  private history: Map<string, ImageData[]> = new Map()
  private displayCanvas: HTMLCanvasElement | null = null
  private listeners: Listener[] = []

  mount(canvas: HTMLCanvasElement) {
    const isRemount = this.displayCanvas === canvas
    this.displayCanvas = canvas
    if (this.layers.length === 0) {
      this.addLayer()
    } else if (!isRemount) {
      this.composite()
    }
  }

  unmount() {
    this.displayCanvas = null
  }

  on(fn: Listener)  { this.listeners.push(fn) }
  off(fn: Listener) { this.listeners = this.listeners.filter(l => l !== fn) }
  private emit(e: LayerManagerEvent) { this.listeners.forEach(l => l(e)) }

  getLayers(): Readonly<Layer[]> { return this.layers }
  getActiveLayerId() { return this.activeLayerId }

addLayer(name?: string): Layer {
  // layer canvas 始终用物理像素（= displayCanvas 的实际 width/height）
  // universalRenderStroke 接收的坐标已经是逻辑像素，
  // 所以这里什么都不 scale —— 和改之前保持一致
  const w = this.displayCanvas?.width  ?? 800
  const h = this.displayCanvas?.height ?? 600
  const offscreen = document.createElement('canvas')
  offscreen.width  = w
  offscreen.height = h

  const layer: Layer = {
    id: crypto.randomUUID(),
    name: name ?? `Layer ${this.layers.length + 1}`,
    visible: true,
    locked: false,
    opacity: 1,
    canvas: offscreen,
  }
  this.layers.push(layer)
  this.activeLayerId = layer.id
  this.emit({ type: 'layers-changed' })
  return layer
}

  // 把当前图层合并到它下面那层（绘制顺序上的下方）
  mergeDown(id: string) {
    const idx = this.layers.findIndex(l => l.id === id)
    if (idx <= 0) return                          // 已经是最底层，无法合并
    const top    = this.layers[idx]
    const bottom = this.layers[idx - 1]
    this.saveHistory()
    const ctx = bottom.canvas.getContext('2d')!
    ctx.save()
    ctx.globalAlpha = top.opacity
    ctx.drawImage(top.canvas, 0, 0)
    ctx.restore()
    // 删掉上层
    this.layers.splice(idx, 1)
    this.history.delete(top.id)
    if (this.activeLayerId === top.id) this.activeLayerId = bottom.id
    this.composite()
    this.emit({ type: 'layers-changed' })
  }

  deleteLayer(id: string) {
    if (this.layers.length <= 1) return
    this.layers = this.layers.filter(l => l.id !== id)
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[this.layers.length - 1].id
    }
    this.history.delete(id)
    this.composite()
    this.emit({ type: 'layers-changed' })
  }

  setActiveLayer(id: string) {
    this.activeLayerId = id
    this.emit({ type: 'layers-changed' })
  }

  patchLayer(id: string, patch: Partial<Pick<Layer, 'name' | 'visible' | 'locked' | 'opacity'>>) {
    const l = this.layers.find(l => l.id === id)
    if (!l) return
    Object.assign(l, patch)
    this.composite()
    this.emit({ type: 'layers-changed' })
  }

  moveLayer(id: string, direction: 'up' | 'down') {
    const i = this.layers.findIndex(l => l.id === id)
    if (direction === 'up'   && i < this.layers.length - 1) [this.layers[i], this.layers[i+1]] = [this.layers[i+1], this.layers[i]]
    if (direction === 'down' && i > 0)                       [this.layers[i], this.layers[i-1]] = [this.layers[i-1], this.layers[i]]
    this.composite()
    this.emit({ type: 'layers-changed' })
  }

composite() {
  const dc = this.displayCanvas
  if (!dc) return
  const ctx = dc.getContext('2d')!
  ctx.clearRect(0, 0, dc.width, dc.height)
  for (const layer of this.layers) {
    if (!layer.visible) continue
    ctx.save()
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(layer.canvas, 0, 0, dc.width, dc.height)
    ctx.restore()
  }
}

  saveHistory() {
    const layer = this._activeLayer()
    if (!layer) return
    const ctx  = layer.canvas.getContext('2d')!
    const snap = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)
    const stack = this.history.get(layer.id) ?? []
    this.history.set(layer.id, [...stack.slice(-19), snap])
    this.emit({ type: 'undo-state-changed', canUndo: true })
  }

  undo() {
    const layer = this._activeLayer()
    if (!layer) return
    const stack = this.history.get(layer.id) ?? []
    const ctx   = layer.canvas.getContext('2d')!
    if (stack.length > 1) {
      ctx.putImageData(stack[stack.length - 2], 0, 0)
      this.history.set(layer.id, stack.slice(0, -1))
    } else {
      ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
      this.history.set(layer.id, [])
      this.emit({ type: 'undo-state-changed', canUndo: false })
    }
    this.composite()
  }

  clearActiveLayer() {
    const layer = this._activeLayer()
    if (!layer) return
    this.saveHistory()
    layer.canvas.getContext('2d')!.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    this.composite()
  }

  // ── Stroke state ────────────────────────────────────────────────────────────
  private _points: { x: number; y: number; t: number; pressure: number }[] = []
  private _renderedUpTo = 0
  private _lastVel = 0
  private _drawing = false

  // ── EMA 平滑器状态 ───────────────────────────────────────────────────────────
  // 速度自适应指数移动平均：
  //   慢速落笔 → alpha 小（0.22）→ 强平滑，线条圆润不抖
  //   快速划线 → alpha 大（0.75）→ 弱平滑，跟手不滞后
  // 每条笔画开始时通过 _emaReset() 重置，保证笔画间不互相影响。
  private _emaPrevX  = 0
  private _emaPrevY  = 0
  private _emaPrevT  = 0
  private _emaVel    = 0    // 平滑后的速度值（px/ms）
  private _emaReady  = false
  private _distAcc   = 0    // stamp 累计距离，跨帧保持，endStroke 时清零

  private _emaReset() {
    this._emaReady = false
    this._emaVel   = 0
  }

  private _emaFilter(raw: { x: number; y: number; t: number; pressure: number }) {
    // 第一个点直接透传，作为 EMA 起点
    if (!this._emaReady) {
      this._emaPrevX = raw.x
      this._emaPrevY = raw.y
      this._emaPrevT = raw.t
      this._emaReady = true
      return raw
    }

    const dt  = Math.max(1, raw.t - this._emaPrevT)
    const dx  = raw.x - this._emaPrevX
    const dy  = raw.y - this._emaPrevY
    const vel = Math.sqrt(dx * dx + dy * dy) / dt   // px/ms

    // 速度本身也做 EMA，避免 alpha 跳变
    this._emaVel = this._emaVel * 0.6 + vel * 0.4

    // 速度映射到 alpha：[0, 2.5 px/ms] → [0.22, 0.75]
    const t     = Math.max(0, Math.min(1, this._emaVel / 2.5))
    const alpha = 0.22 + (0.75 - 0.22) * t

    const sx = this._emaPrevX + (raw.x - this._emaPrevX) * alpha
    const sy = this._emaPrevY + (raw.y - this._emaPrevY) * alpha

    this._emaPrevX = sx
    this._emaPrevY = sy
    this._emaPrevT = raw.t

    return { x: sx, y: sy, t: raw.t, pressure: raw.pressure }
  }

  // 涂抹笔画期间的逐帧快照，供 applySmearStamp 使用
  private _smearCanvas: HTMLCanvasElement | null = null  // 涂抹工具用的离屏 canvas

  // pen 笔刷：笔画开始前的快照，每帧还原后整体重绘，消除增量叠加毛边
  private _penSnapData: ImageData | null = null

  startStroke(pt: { x: number; y: number; t: number; pressure: number }) {
    const layer = this._activeLayer()
    if (!layer || layer.locked) return
    this.saveHistory()
    if (sharedDrawState.brushType === 'softblur') {
      // 涂抹：创建离屏 canvas，把 active layer 当前内容拷过去作为初始像素来源
      const src = layer.canvas
      if (!this._smearCanvas || this._smearCanvas.width !== src.width || this._smearCanvas.height !== src.height) {
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
    const smoothed     = this._emaFilter(pt)
    this._points       = [smoothed, smoothed]
    this._renderedUpTo = 0
    this._lastVel      = 0
    this._distAcc      = 0
    this._drawing      = true

    // pen：保存笔画开始前的快照，后续每帧基于此还原再整体重绘，避免增量叠加毛边
    if (sharedDrawState.brushType === 'pen') {
      const ctx = layer.canvas.getContext('2d')!
      this._penSnapData = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height)
    } else {
      this._penSnapData = null
    }

    this._renderSegment(0, this._points.length)
    this.composite()
  }

  continueStroke(pts: { x: number; y: number; t: number; pressure: number }[]) {
    if (!this._drawing) return
    const prevLen  = this._points.length
    const smoothed = pts.map(p => this._emaFilter(p))
    this._points.push(...smoothed)
    const contextStart = Math.max(0, prevLen - 3)
    this._renderSegment(contextStart, this._points.length)
    // blur 直接写 display canvas，composite 会覆盖模糊结果，所以不调
    if (sharedDrawState.brushType !== 'softblur') this.composite()
  }

  endStroke() {
    // blur 已经在 startStroke/continueStroke 期间直接写入 active layer
    // 不需要任何额外的像素搬运，直接清理状态然后 composite 即可
    this._smearCanvas = null
    this._penSnapData  = null
    this._drawing      = false
    this._points       = []
    this._renderedUpTo = 0
    this._lastVel      = 0
    this._distAcc      = 0
    this._emaReset()
    this.composite()
  }

  // Called by CanvasArea after shape drawing completes — writes the display
  // canvas pixels back into the active layer and triggers composite().
  commitImageData(imageData: ImageData) {
    const layer = this._activeLayer()
    if (!layer || layer.locked) return
    layer.canvas.getContext('2d')!.putImageData(imageData, 0, 0)
    this.composite()
  }

  // Render pts[fromIdx..toIdx] onto the active layer canvas.
  // Uses the global _points array for Catmull-Rom context lookups, but only
  // iterates the segments in [fromIdx, toIdx-1] so we never double-paint.
  private _renderSegment(fromIdx: number, toIdx: number) {
    const layer = this._activeLayer()
    if (!layer) return
    const pts = this._points
    if (pts.length < 2 || toIdx - fromIdx < 1) return

    const state  = sharedDrawState
    const brush  = BRUSHES.find(b => b.type === state.brushType)
    if (!brush) return

    const canvas = layer.canvas
    const ctx    = canvas.getContext('2d')!

    // ── PEN 特殊路径：快照还原 + 整体重绘 ─────────────────────────────────────
    // pen 使用 pfGetStrokePath 生成闭合填充轮廓路径。
    // 增量 fill 会在已有像素上二次叠加，产生可见毛边/锯齿。
    // 解决方案：每帧先把笔画开始前的快照 putImageData 还原，再对完整点集整体 fill 一次。
    if (state.brushType === 'pen') {
      if (this._penSnapData) {
        ctx.putImageData(this._penSnapData, 0, 0)
      }
      if (pts.length >= 2) {
        const velRef  = { current: 0 }
        const distRef = { current: 0 }
        universalRenderStroke(ctx, pts, state, brush, velRef, distRef)
      }
      return
    }

    // ── 其他笔刷：保持原有增量渲染 ───────────────────────────────────────────
    const sliceStart = Math.max(0, fromIdx)
    const window = pts.slice(sliceStart, toIdx)
    if (window.length < 2) return

    const lastVelRef = { current: this._lastVel }
    const distAccRef = { current: this._distAcc }
    // smear: 传入离屏 canvas
    universalRenderStroke(ctx, window, state, brush, lastVelRef, distAccRef, this._smearCanvas ?? undefined)
    this._lastVel = lastVelRef.current
    this._distAcc = distAccRef.current

    // smear canvas 的同步在 universalRenderStroke 内部的 syncSmearCanvas 完成
    // 所以这里什么都不用做
  }

  exportLayersAsDataUrls(): { id: string; name: string; visible: boolean; opacity: number; dataUrl: string }[] {
    return this.layers.map(l => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity,
      dataUrl: l.canvas.toDataURL('image/png'),
    }))
  }

  async importLayers(saved: { id: string; name: string; visible: boolean; opacity: number; dataUrl: string }[]) {
    this.layers = []
    for (const s of saved) {
      const layer = this.addLayer(s.name)
      layer.visible = s.visible
      layer.opacity = s.opacity
      await drawImageToCanvas(layer.canvas, s.dataUrl)
    }
    this.composite()
  }

  private _activeLayer(): Layer | null {
    return this.layers.find(l => l.id === this.activeLayerId) ?? null
  }
}

// ── Legacy export kept for any callers that still use renderStrokeOnCtx ──────
// Wraps universalRenderStroke so existing call sites don't break.
export function renderStrokeOnCtx(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number; t: number; pressure: number }[],
  state: DrawState,
  brush: { type: string; pressureSim: boolean; scatter: boolean; smoothing: number; defaultAlpha: number },
  lastVelRef: { current: number } | number,
) {
  const fullBrush = BRUSHES.find(b => b.type === state.brushType)
  if (!fullBrush) return
  const velRef = typeof lastVelRef === 'number'
    ? { current: lastVelRef }
    : lastVelRef
  universalRenderStroke(ctx, pts, state, fullBrush, velRef)
}

function drawImageToCanvas(canvas: HTMLCanvasElement, dataUrl: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => { canvas.getContext('2d')!.drawImage(img, 0, 0); resolve() }
    img.src = dataUrl
  })
}

const _registry = new Map<string, DrawLayerManager>()

export function getDrawLayerManager(pageId: string): DrawLayerManager {
  if (!_registry.has(pageId)) _registry.set(pageId, new DrawLayerManager())
  return _registry.get(pageId)!
}

export function destroyDrawLayerManager(pageId: string) {
  _registry.get(pageId)?.unmount()
  _registry.delete(pageId)
}