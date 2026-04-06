// DrawLayerManager.ts
// 纯 class，无 React 依赖。管理单页的多图层绘图系统。
//
// ── 架构说明 ────────────────────────────────────────────────────────────────
//
//  【坐标系 — 职责分离】
//
//  StrokeManager（画笔层）
//    canvas = 纯物理像素，永远没有 transform。
//    getImageData / putImageData / clearRect / drawImage 全部在同一物理坐标系。
//    外部传逻辑坐标（CSS px），内部 × dpr 后写入。undo 不可能出错。
//
//  DrawLayerManager（图形层 + composite 协调）
//    _displayCtx 有 scale(dpr,dpr)，矢量图形用逻辑坐标绘制。
//    composite() 先 setTransform identity，把 StrokeManager 的层
//    drawImage 进来（物理→物理，1:1），再 restore 回逻辑坐标画 shapes。
//
//  两套系统数据完全独立，composite 顺序固定（先画笔后图形）。
//
// ────────────────────────────────────────────────────────────────────────────

import { DrawState, ShapeType, sharedDrawState, renderShape } from './DrawPanel'
import { StrokeManager, StrokeLayer, LogicalPoint, StrokeManagerEvent } from './StrokeManager'

export type Layer = StrokeLayer
export type { LogicalPoint }

// ── DrawnShape ────────────────────────────────────────────────────────────────
export interface DrawnShape {
  id: string
  x0: number; y0: number
  x1: number; y1: number
  bezierPts?: { x: number; y: number }[]
  shapeType: ShapeType
  color: string
  alpha: number
  shapeFill: boolean
  shapeStroke: number
  shapeSides: number
}

type ShapeHistoryEntry =
  | { op: 'add';    shape: DrawnShape }
  | { op: 'remove'; shape: DrawnShape }
  | { op: 'move';   id: string; prev: { x0: number; y0: number; x1: number; y1: number }; next: { x0: number; y0: number; x1: number; y1: number } }

export type LayerManagerEvent =
  | { type: 'layers-changed' }
  | { type: 'undo-state-changed'; canUndo: boolean }
  | { type: 'shapes-changed'; shapes: DrawnShape[] }

type Listener = (e: LayerManagerEvent) => void

// ─────────────────────────────────────────────────────────────────────────────

export class DrawLayerManager {

  // 画笔系统：完全委托给 StrokeManager
  readonly stroke: StrokeManager

  private displayCanvas: HTMLCanvasElement | null = null
  private _displayCtx: CanvasRenderingContext2D | null = null
  private listeners: Listener[] = []
  private _pageId: string
  private _mounting = false
  private _mounted  = false   // 真正的"已初始化"标志，mount() 后永不重置

  // 公开访问 displayCanvas（供 exportToBlock 等使用）
  getDisplayCanvas(): HTMLCanvasElement | null { return this.displayCanvas }

  constructor(pageId: string) {
    this._pageId = pageId
    this.stroke  = new StrokeManager(pageId)

    this.stroke.on((e: StrokeManagerEvent) => {
      if (e.type === 'layers-changed') {
        this.composite()
        this.emit({ type: 'layers-changed' })
      }
      if (e.type === 'undo-state-changed') this.emit({ type: 'undo-state-changed', canUndo: e.canUndo })
    })
  }

  // ── 矢量图形状态 ──────────────────────────────────────────────────────────
  private _shapes: DrawnShape[]              = []
  private _shapeHistory: ShapeHistoryEntry[][] = []
  private _selectedShapeId: string | null    = null
  private _dragOffset: { dx: number; dy: number } | null = null
  private _resizePreview: { x0: number; y0: number; x1: number; y1: number } | null = null
  private _previewShape: DrawnShape | null   = null
  drawModeActive = false

  // ── 事件总线 ──────────────────────────────────────────────────────────────
  on(fn: Listener)  { if (!this.listeners.includes(fn)) this.listeners.push(fn) }
  off(fn: Listener) { this.listeners = this.listeners.filter(l => l !== fn) }
  private emit(e: LayerManagerEvent) { this.listeners.forEach(l => l(e)) }

  // ── mount / unmount ───────────────────────────────────────────────────────

  mount(canvas: HTMLCanvasElement, ctx?: CanvasRenderingContext2D) {
    this.displayCanvas = canvas
    if (ctx !== undefined) this._displayCtx = ctx
    if (this._mounting) return
    this._mounting = true

    const dpr   = window.devicePixelRatio || 1
    const physW = canvas.width
    const physH = canvas.height

    this._restoreSnapshot()
    this.stroke.init(physW, physH, dpr)

    // _restoreShapes 只执行一次：_mounting 在 mount() 结束时被重置为 false，
    // 无法防止 React re-render 触发的重复 mount，必须用 _mounted 独立保护。
    if (!this._mounted) {
      this._restoreShapes()
      this._mounted = true
    }

    this._mounting = false
    this.composite()
    this.emit({ type: 'layers-changed' })
  }

  unmount() {
    this.stroke.destroy()
    this._persistShapes()
    this.displayCanvas = null
    this._displayCtx   = null
  }

  // ── resize ────────────────────────────────────────────────────────────────

  resizeDisplay(newW: number, newH: number, dpr: number) {
    this.stroke.resize(newW, newH, dpr)
    if (this._displayCtx) {
      this._displayCtx.setTransform(1, 0, 0, 1, 0, 0)
      this._displayCtx.scale(dpr, dpr)
    }
    this.composite()
  }

  // ── Layer 管理（委托）────────────────────────────────────────────────────

  getLayers()          { return this.stroke.getLayers() }
  getActiveLayerId()   { return this.stroke.getActiveLayerId() }
  getShapes()          { return this._shapes as Readonly<DrawnShape[]> }
  getSelectedShapeId() { return this._selectedShapeId }

  addLayer(name?: string)    { return this.stroke.addLayer(name) }
  setActiveLayer(id: string) { this.stroke.setActiveLayer(id) }

  patchLayer(id: string, patch: Partial<Pick<Layer, 'name' | 'visible' | 'locked' | 'opacity'>>) {
    this.stroke.patchLayer(id, patch); this.composite()
  }
  moveLayer(id: string, dir: 'up' | 'down') {
    this.stroke.moveLayer(id, dir); this.composite()
  }
  deleteLayer(id: string) { this.stroke.deleteLayer(id); this.composite() }
  mergeDown(id: string)   { this.stroke.mergeDown(id);   this.composite() }

  // ── 画笔 API（委托，外部传逻辑坐标）────────────────────────────────────

  saveHistory() { this.stroke.saveHistory() }

  undo() {
    if (this._shapeHistory.length > 0) { this.undoShape(); return }
    this.stroke.undo()
    this.composite()
  }

  clearActiveLayer() { this.stroke.clearActiveLayer(); this.composite() }

  startStroke(pt: LogicalPoint) {
    if (this._selectedShapeId) { this._selectedShapeId = null }
    this.stroke.startStroke(pt)
    this.composite()
  }

  continueStroke(pts: LogicalPoint[]) {
    this.stroke.continueStroke(pts)
    this.composite()
  }

  endStroke() {
    this.stroke.endStroke()
    this.composite()
  }

  exportLayersAsDataUrls() { return this.stroke.exportAsDataUrls() }

  // ── Composite ─────────────────────────────────────────────────────────────
  //
  //  1. identity transform → clearRect（物理像素清空）
  //  2. StrokeManager.compositeInto → drawImage 物理层（物理→物理，1:1）
  //  3. restore → scale(dpr,dpr) 逻辑坐标系
  //  4. 逻辑坐标画矢量 shapes
  //
  composite() {
    const dc  = this.displayCanvas
    const ctx = this._displayCtx
    if (!dc || !ctx) return

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, dc.width, dc.height)
    this.stroke.compositeInto(ctx)
    ctx.restore()

    // shapes 由 CanvasArea SVG 层渲染，canvas 不再重复绘制
  }

  // ── 矢量图形 CRUD ─────────────────────────────────────────────────────────

  private _shapeState(s: DrawnShape) {
    return {
      ...sharedDrawState,
      shapeType: s.shapeType, color: s.color, alpha: s.alpha,
      shapeFill: s.shapeFill, shapeStroke: s.shapeStroke, shapeSides: s.shapeSides,
    }
  }

  private _drawSelectionBox(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1)
    const PAD  = 6
    ctx.save()
    ctx.strokeStyle = 'rgba(74,144,217,0.9)'
    ctx.lineWidth   = 1.5
    ctx.setLineDash([5, 3])
    ctx.strokeRect(minX - PAD, minY - PAD, maxX - minX + PAD * 2, maxY - minY + PAD * 2)
    ctx.setLineDash([])
    ctx.fillStyle   = '#fff'
    ctx.strokeStyle = 'rgba(74,144,217,1)'
    ctx.lineWidth   = 1.5
    for (const [hx, hy] of this._handlePositions(minX, maxX, minY, maxY, PAD)) {
      ctx.beginPath(); ctx.arc(hx, hy, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    }
    ctx.restore()
  }

  private _handlePositions(minX: number, maxX: number, minY: number, maxY: number, PAD: number): [number, number][] {
    const mx = (minX + maxX) / 2, my = (minY + maxY) / 2
    return [
      [minX - PAD, minY - PAD], [mx, minY - PAD], [maxX + PAD, minY - PAD],
      [minX - PAD, my],                             [maxX + PAD, my],
      [minX - PAD, maxY + PAD], [mx, maxY + PAD], [maxX + PAD, maxY + PAD],
    ]
  }

  setPreviewShape(s: DrawnShape | null) { this._previewShape = s; this.composite() }

  addShape(shape: DrawnShape) {
    this._shapes.push(shape)
    this._selectedShapeId = shape.id
    this._pushShapeHistory([{ op: 'add', shape }])
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  selectShape(id: string | null) {
    this._selectedShapeId = id; this._dragOffset = null; this._resizePreview = null
    this.composite()
  }

  hitTestShape(x: number, y: number): DrawnShape | null {
    const PAD = 8
    for (let i = this._shapes.length - 1; i >= 0; i--) {
      const s = this._shapes[i]
      if (x >= Math.min(s.x0, s.x1) - PAD && x <= Math.max(s.x0, s.x1) + PAD &&
          y >= Math.min(s.y0, s.y1) - PAD && y <= Math.max(s.y0, s.y1) + PAD) return s
    }
    return null
  }

  hitTestHandle(x: number, y: number): number {
    const s = this._shapes.find(sh => sh.id === this._selectedShapeId)
    if (!s) return -1
    let { x0, y0, x1, y1 } = s
    if (this._dragOffset) { x0 += this._dragOffset.dx; y0 += this._dragOffset.dy; x1 += this._dragOffset.dx; y1 += this._dragOffset.dy }
    const PAD  = 6
    const minX = Math.min(x0, x1), maxX = Math.max(x0, x1)
    const minY = Math.min(y0, y1), maxY = Math.max(y0, y1)
    const handles = this._handlePositions(minX, maxX, minY, maxY, PAD)
    for (let i = 0; i < handles.length; i++) {
      if (Math.hypot(x - handles[i][0], y - handles[i][1]) <= 8) return i
    }
    return -1
  }

  startDrag(id: string) { this._selectedShapeId = id; this._dragOffset = { dx: 0, dy: 0 } }

  updateDrag(dx: number, dy: number) {
    if (!this._dragOffset) return
    this._dragOffset = { dx, dy }; this.composite()
  }

  commitDrag() {
    const s = this._shapes.find(sh => sh.id === this._selectedShapeId)
    if (!s || !this._dragOffset) return
    const { dx, dy } = this._dragOffset
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { this._dragOffset = null; return }
    const prev = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }
    s.x0 += dx; s.y0 += dy; s.x1 += dx; s.y1 += dy
    this._pushShapeHistory([{ op: 'move', id: s.id, prev, next: { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 } }])
    this._dragOffset = null
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  cancelDrag() { this._dragOffset = null; this.composite() }

  startResize(id: string) {
    this._selectedShapeId = id
    const s = this._shapes.find(sh => sh.id === id)
    if (s) this._resizePreview = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }
  }

  updateResize(handleIdx: number, x: number, y: number) {
    if (!this._resizePreview) return
    let { x0, y0, x1, y1 } = this._resizePreview
    if ([0, 3, 5].includes(handleIdx)) x0 = x
    if ([2, 4, 7].includes(handleIdx)) x1 = x
    if ([0, 1, 2].includes(handleIdx)) y0 = y
    if ([5, 6, 7].includes(handleIdx)) y1 = y
    this._resizePreview = { x0, y0, x1, y1 }
    this.composite()
  }

  commitResize() {
    const s = this._shapes.find(sh => sh.id === this._selectedShapeId)
    if (!s || !this._resizePreview) return
    const prev = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }
    const next  = { ...this._resizePreview }
    Object.assign(s, next)
    this._pushShapeHistory([{ op: 'move', id: s.id, prev, next }])
    this._resizePreview = null
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  cancelResize() { this._resizePreview = null; this.composite() }

  patchShape(id: string, patch: { x0: number; y0: number; x1: number; y1: number }) {
    const s = this._shapes.find(sh => sh.id === id)
    if (!s) return
    const prev = { x0: s.x0, y0: s.y0, x1: s.x1, y1: s.y1 }
    Object.assign(s, patch)
    this._pushShapeHistory([{ op: 'move', id, prev, next: patch }])
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  deleteShape(id: string) {
    const s = this._shapes.find(sh => sh.id === id)
    if (!s) return
    this._shapes = this._shapes.filter(sh => sh.id !== s.id)
    this._pushShapeHistory([{ op: 'remove', shape: s }])
    if (this._selectedShapeId === id) this._selectedShapeId = null
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  deleteSelectedShape() {
    const s = this._shapes.find(sh => sh.id === this._selectedShapeId)
    if (!s) return
    this._shapes = this._shapes.filter(sh => sh.id !== s.id)
    this._pushShapeHistory([{ op: 'remove', shape: s }])
    this._selectedShapeId = null
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    this._persistShapes()
  }

  undoShape(): boolean {
    const group = this._shapeHistory.pop()
    if (!group) return false
    for (let i = group.length - 1; i >= 0; i--) {
      const e = group[i]
      if (e.op === 'add') {
        this._shapes = this._shapes.filter(s => s.id !== e.shape.id)
        if (this._selectedShapeId === e.shape.id) this._selectedShapeId = null
      } else if (e.op === 'remove') {
        this._shapes.push(e.shape)
      } else if (e.op === 'move') {
        const s = this._shapes.find(sh => sh.id === e.id)
        if (s) Object.assign(s, e.prev)
      }
    }
    this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
    this._emitUndoState()
    return true
  }

  exportShapes(): DrawnShape[] { return JSON.parse(JSON.stringify(this._shapes)) }

  importShapes(shapes: DrawnShape[]) {
    this._shapes = shapes; this.composite()
    this.emit({ type: 'shapes-changed', shapes: [...this._shapes] })
  }

  // ── 私有工具 ──────────────────────────────────────────────────────────────

  private _pushShapeHistory(group: ShapeHistoryEntry[]) {
    this._shapeHistory.push(group)
    if (this._shapeHistory.length > 20) this._shapeHistory.shift()
  }

  private _emitUndoState() {
    const canUndo = this.stroke.canUndo() || this._shapeHistory.length > 0
    this.emit({ type: 'undo-state-changed', canUndo })
  }

  // ── 快照（防白屏）────────────────────────────────────────────────────────
  private get _snapshotKey() { return `dlm-snap-${this._pageId}` }

  private _restoreSnapshot() {
    try {
      const raw = localStorage.getItem(this._snapshotKey)
      if (!raw || !this._displayCtx || !this.displayCanvas) return
      const img = new Image()
      const dc = this.displayCanvas, ctx = this._displayCtx
      img.onload = () => { ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(img, 0, 0, dc.width, dc.height) }
      img.src = raw
    } catch {}
  }

  // ── shapes 持久化 ─────────────────────────────────────────────────────────
  private get _shapesKey() { return `dlm-shapes-${this._pageId}` }

  private _persistShapes() {
    try {
      localStorage.setItem(this._shapesKey, JSON.stringify(this._shapes))
      if (this.displayCanvas) {
        try { localStorage.setItem(this._snapshotKey, this.displayCanvas.toDataURL('image/png')) } catch {}
      }
    } catch {}
  }

  private _restoreShapes() {
    try {
      const raw = localStorage.getItem(this._shapesKey)
      if (raw) this._shapes = JSON.parse(raw) as DrawnShape[]
    } catch {}
  }
}

// ── 全局注册表 ────────────────────────────────────────────────────────────────
const _registry = new Map<string, DrawLayerManager>()

export function getDrawLayerManager(pageId: string): DrawLayerManager {
  if (!_registry.has(pageId)) _registry.set(pageId, new DrawLayerManager(pageId))
  return _registry.get(pageId)!
}

export function destroyDrawLayerManager(pageId: string) {
  _registry.get(pageId)?.unmount()
  _registry.delete(pageId)
}