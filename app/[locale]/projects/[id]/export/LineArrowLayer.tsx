'use client'
import React from 'react'
import { generateId } from './pageHelpers'

// ── 自定义 SVG 光标 ──────────────────────────────────────────────────────────
function svgCur(svg: string, hx: number, hy: number) {
  const enc = svg.replace(/"/g, "'").replace(/#/g, '%23').replace(/[\n]/g, ' ')
  return `url("data:image/svg+xml,${enc}") ${hx} ${hy}, crosshair`
}

// 控制点拖拽光标：实心菱形
const CURSOR_CTRL = svgCur(
  `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <polygon points="10,2 18,10 10,18 2,10"
      fill="white" stroke="%231a1a1a" stroke-width="1.5"/>
    <polygon points="10,5 15,10 10,15 5,10"
      fill="%231a1a1a"/>
  </svg>`, 10, 10
)

// 端点拖拽光标：实心方块
const CURSOR_ENDPT = svgCur(
  `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="14" height="14" fill="white" stroke="%231a1a1a" stroke-width="1.2"/>
    <rect x="4" y="4" width="8" height="8" fill="%231a1a1a"/>
  </svg>`, 8, 8
)

// 线体移动光标：四向箭头
const CURSOR_MOVE = svgCur(
  `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 2 L13 6 L11 6 L11 9 L14 9 L14 7 L18 10 L14 13 L14 11 L11 11 L11 14 L13 14 L10 18 L7 14 L9 14 L9 11 L6 11 L6 13 L2 10 L6 7 L6 9 L9 9 L9 6 L7 6 Z"
      fill="white" stroke="%231a1a1a" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M10 4 L12 7 L11 7 L11 9 L13 9 L13 8 L16 10 L13 12 L13 11 L11 11 L11 13 L12 13 L10 16 L8 13 L9 13 L9 11 L7 11 L7 12 L4 10 L7 8 L7 9 L9 9 L9 7 L8 7 Z"
      fill="%231a1a1a"/>
  </svg>`, 10, 10
)

// 插入控制点光标：加号
const CURSOR_ADD = svgCur(
  `<svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
    <circle cx="10" cy="10" r="8" fill="white" stroke="%231a1a1a" stroke-width="1.2"/>
    <line x1="6" y1="10" x2="14" y2="10" stroke="%231a1a1a" stroke-width="1.8" stroke-linecap="round"/>
    <line x1="10" y1="6" x2="10" y2="14" stroke="%231a1a1a" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`, 10, 10
)

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type LineCurve   = 'straight' | 'curve'
export type LineCap     = 'none' | 'arrow' | 'dot' | 'bar'

export interface CtrlPt { x: number; y: number }

export interface LineBlock {
  id: string; type: 'line-block'; pageId: string
  x1: number; y1: number; x2: number; y2: number
  strokeColor: string; strokeWidth: number
  strokeStyle: StrokeStyle; curve: LineCurve
  startCap: LineCap; endCap: LineCap
  ctrlPts?: CtrlPt[]   // curve 模式：可增加的控制点列表
}
export interface ArrowBlock {
  id: string; type: 'arrow-block'; pageId: string
  x1: number; y1: number; x2: number; y2: number
  strokeColor: string; strokeWidth: number
  strokeStyle: StrokeStyle; curve: LineCurve
  startCap: LineCap; endCap: LineCap
  ctrlPts?: CtrlPt[]
}
export type LineArrowBlock = LineBlock | ArrowBlock

// ─────────────────────────────────────────────────────────────────────────────
// Factories
// ─────────────────────────────────────────────────────────────────────────────

export function makeLineBlock(pageId: string, cx = 430, cy = 300): LineBlock {
  return { id: generateId(), type: 'line-block', pageId,
    x1: cx - 80, y1: cy, x2: cx + 80, y2: cy,
    strokeColor: '#1a1a1a', strokeWidth: 2, strokeStyle: 'solid',
    curve: 'straight', startCap: 'none', endCap: 'none', ctrlPts: [] }
}
export function makeArrowBlock(pageId: string, cx = 430, cy = 300): ArrowBlock {
  return { id: generateId(), type: 'arrow-block', pageId,
    x1: cx - 80, y1: cy, x2: cx + 80, y2: cy,
    strokeColor: '#1a1a1a', strokeWidth: 2, strokeStyle: 'solid',
    curve: 'straight', startCap: 'none', endCap: 'arrow', ctrlPts: [] }
}

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers
// ─────────────────────────────────────────────────────────────────────────────

// 把所有点（起点 + 控制点 + 终点）连成多段 quadratic bezier 路径
// 每段：上一个锚点 → 控制点 → 下一个锚点的中点（或终点）
// 这是标准的"平滑折线"技法，Illustrator/Figma 多点曲线原理
function buildPath(b: LineArrowBlock): string {
  const pts = b.ctrlPts ?? []
  const p0 = { x: b.x1, y: b.y1 }
  const pN = { x: b.x2, y: b.y2 }

  if (b.curve === 'straight' || pts.length === 0) {
    // 直线或无控制点：分段直线经过所有控制点
    const all = [p0, ...pts, pN]
    return all.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  }

  // 多控制点曲线：相邻控制点之间的中点作为经过点
  const all = [p0, ...pts, pN]
  let d = `M${all[0].x},${all[0].y}`
  for (let i = 1; i < all.length - 1; i++) {
    const cp = all[i]
    const next = all[i + 1]
    // 经过点 = 当前控制点与下一个点的中点
    const ax = (cp.x + next.x) / 2
    const ay = (cp.y + next.y) / 2
    d += ` Q${cp.x},${cp.y} ${ax},${ay}`
  }
  // 最后一段到终点
  const last = all[all.length - 2]
  d += ` Q${last.x},${last.y} ${all[all.length - 1].x},${all[all.length - 1].y}`
  return d
}

function dashArray(style: StrokeStyle, sw: number) {
  if (style === 'dashed') return `${sw * 4},${sw * 3}`
  if (style === 'dotted') return `${sw * 1.2},${sw * 2.5}`
  return undefined
}

// 起点/终点切线角（用于箭头方向）
function endTangentAngle(b: LineArrowBlock, atEnd: boolean): number {
  const pts = b.ctrlPts ?? []
  if (b.curve === 'straight' || pts.length === 0) {
    return Math.atan2(b.y2 - b.y1, b.x2 - b.x1)
  }
  if (atEnd) {
    const last = pts[pts.length - 1]
    return Math.atan2(b.y2 - last.y, b.x2 - last.x)
  } else {
    const first = pts[0]
    return Math.atan2(first.y - b.y1, first.x - b.x1)
  }
}

// 线段上最近点的 t 参数（用于点击插入控制点时找位置）
function nearestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return { t: 0, x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return { t, x: ax + t * dx, y: ay + t * dy, dist: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)) }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cap renderer
// ─────────────────────────────────────────────────────────────────────────────

function CapEl({ px, py, angle, cap, sw, color }: {
  px: number; py: number; angle: number; cap: LineCap; sw: number; color: string
}) {
  const hs = Math.max(sw * 3.5, 9), dotR = Math.max(sw * 1.8, 3.5)
  const barH = Math.max(sw * 2.5, 7), ha = Math.PI / 6
  if (cap === 'arrow') return (
    <polyline
      points={`${px - Math.cos(angle - ha) * hs},${py - Math.sin(angle - ha) * hs} ${px},${py} ${px - Math.cos(angle + ha) * hs},${py - Math.sin(angle + ha) * hs}`}
      stroke={color} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  )
  if (cap === 'dot') return <circle cx={px} cy={py} r={dotR} fill={color} />
  if (cap === 'bar') {
    const bx2 = Math.sin(angle) * barH, by2 = -Math.cos(angle) * barH
    return <line x1={px + bx2} y1={py + by2} x2={px - bx2} y2={py - by2}
      stroke={color} strokeWidth={sw} strokeLinecap="round" />
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// LineArrowLayer
// ─────────────────────────────────────────────────────────────────────────────

interface LineArrowLayerProps {
  blocks:       LineArrowBlock[]
  pageId:       string
  canvasZoom:   number
  pageW:        number
  pageH:        number
  selectedId:   string | null
  onSelect:     (id: string | null) => void
  onPatch:      (id: string, patch: Partial<LineArrowBlock>) => void
  onDelete:     (id: string) => void
  onSwitchTab?: () => void
}

export function LineArrowLayer({
  blocks, pageId, canvasZoom, pageW, pageH,
  selectedId, onSelect, onPatch, onDelete, onSwitchTab,
}: LineArrowLayerProps) {
  const pageBlocks = blocks.filter(b => b.pageId === pageId)

  // Delete / Backspace 删除选中线条
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedId) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      e.preventDefault(); onDelete(selectedId); onSelect(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedId, onDelete, onSelect])

  // ── 线体拖动（整体平移）or 点击（选中）──
  const startBodyInteraction = (e: React.PointerEvent, b: LineArrowBlock) => {
    e.stopPropagation(); e.preventDefault()
    ;(e.nativeEvent as any).__lineArrowSelected = true
    const startX = e.clientX, startY = e.clientY
    const origX1 = b.x1, origY1 = b.y1, origX2 = b.x2, origY2 = b.y2
    const origPts = (b.ctrlPts ?? []).map(p => ({ ...p }))
    let dragging = false
    const onMove = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      dragging = true
      const dx = (ev.clientX - startX) / canvasZoom
      const dy = (ev.clientY - startY) / canvasZoom
      onPatch(b.id, {
        x1: origX1 + dx, y1: origY1 + dy,
        x2: origX2 + dx, y2: origY2 + dy,
        ctrlPts: origPts.map(p => ({ x: p.x + dx, y: p.y + dy })),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (!dragging) { onSelect(b.id); onSwitchTab?.() }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // ── 端点拖动 ──
  const startEndpointDrag = (e: React.PointerEvent, b: LineArrowBlock, which: 'start' | 'end') => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const origX = which === 'start' ? b.x1 : b.x2
    const origY = which === 'start' ? b.y1 : b.y2
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / canvasZoom
      const dy = (ev.clientY - startY) / canvasZoom
      if (which === 'start') onPatch(b.id, { x1: origX + dx, y1: origY + dy })
      else                   onPatch(b.id, { x2: origX + dx, y2: origY + dy })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // ── 控制点拖动 ──
  const startCtrlDrag = (e: React.PointerEvent, b: LineArrowBlock, idx: number) => {
    e.stopPropagation(); e.preventDefault()
    const startX = e.clientX, startY = e.clientY
    const orig = { ...(b.ctrlPts ?? [])[idx] }
    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / canvasZoom
      const dy = (ev.clientY - startY) / canvasZoom
      const next = [...(b.ctrlPts ?? [])]
      next[idx] = { x: orig.x + dx, y: orig.y + dy }
      onPatch(b.id, { ctrlPts: next })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  // ── 点击线体插入控制点 ──
  const insertCtrlPt = (e: React.PointerEvent, b: LineArrowBlock) => {
    if (selectedId !== b.id) return  // 未选中时点击是 select，不是插入
    e.stopPropagation(); e.preventDefault()
    // 把点击位置转换为页面坐标
    const svgEl = (e.currentTarget as SVGPathElement).ownerSVGElement!
    const rect = svgEl.getBoundingClientRect()
    const px = (e.clientX - rect.left) / canvasZoom
    const py = (e.clientY - rect.top) / canvasZoom

    const pts = b.ctrlPts ?? []
    const allAnchors = [{ x: b.x1, y: b.y1 }, ...pts, { x: b.x2, y: b.y2 }]

    // 找距离点击最近的线段，在其中插入
    let bestDist = Infinity, bestSegIdx = 0, bestPt = { x: px, y: py }
    for (let i = 0; i < allAnchors.length - 1; i++) {
      const r = nearestPointOnSegment(px, py, allAnchors[i].x, allAnchors[i].y, allAnchors[i+1].x, allAnchors[i+1].y)
      if (r.dist < bestDist) { bestDist = r.dist; bestSegIdx = i; bestPt = { x: r.x, y: r.y } }
    }
    // bestSegIdx = 0 → 在起点和第一个控制点之间，插到 pts[0] 前
    // bestSegIdx = k → 插到 pts[k-1] 和 pts[k] 之间，即 pts.splice(k, 0, pt)
    const next = [...pts]
    next.splice(bestSegIdx, 0, bestPt)
    onPatch(b.id, { ctrlPts: next })
  }

  // ── 双击控制点删除 ──
  const deleteCtrlPt = (e: React.PointerEvent, b: LineArrowBlock, idx: number) => {
    e.stopPropagation(); e.preventDefault()
    const next = [...(b.ctrlPts ?? [])]
    next.splice(idx, 1)
    onPatch(b.id, { ctrlPts: next })
  }

  if (pageBlocks.length === 0) return null

  return (
    <svg
      data-no-canvas-pan=""
      style={{
        position: 'absolute', inset: 0,
        width: pageW, height: pageH,
        overflow: 'visible', pointerEvents: 'none', zIndex: 25,
      }}
    >
      {pageBlocks.map(b => {
        const d    = buildPath(b)
        const da   = dashArray(b.strokeStyle, b.strokeWidth)
        const s    = 1 / Math.max(0.1, canvasZoom)
        const hitR = 11 * s
        const isSel = selectedId === b.id
        const startAngle = endTangentAngle(b, false)
        const endAngle   = endTangentAngle(b, true)
        const effectiveEndCap: LineCap = b.type === 'arrow-block' ? (b.endCap ?? 'arrow') : b.endCap
        const hs = 3.5 * s   // 端点方块半边长
        const chs = 3 * s    // 控制点菱形半边长

        return (
          <g key={b.id}>
            {/* 宽透明 hit area：选中后点击插入控制点，未选中点击=选中 */}
            <path d={d} fill="none" stroke="transparent"
              strokeWidth={Math.max(14 * s, 14)}
              style={{ pointerEvents: 'stroke', cursor: isSel ? (b.curve === 'curve' ? CURSOR_ADD : CURSOR_MOVE) : 'default' }}
              onPointerDown={e => {
                if (isSel && b.curve === 'curve') {
                  insertCtrlPt(e, b)
                } else {
                  startBodyInteraction(e, b)
                }
              }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation() }}
            />

            {/* 可见描边 */}
            <path d={d} fill="none"
              stroke={b.strokeColor} strokeWidth={b.strokeWidth}
              strokeDasharray={da} strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />

            {/* caps */}
            <g style={{ pointerEvents: 'none' }}>
              <CapEl px={b.x1} py={b.y1} angle={startAngle + Math.PI} cap={b.startCap} sw={b.strokeWidth} color={b.strokeColor} />
              <CapEl px={b.x2} py={b.y2} angle={endAngle} cap={effectiveEndCap} sw={b.strokeWidth} color={b.strokeColor} />
            </g>

            {/* 选中态控制 */}
            {isSel && (
              <g>
                {/* 端点方块 */}
                {([['start', b.x1, b.y1], ['end', b.x2, b.y2]] as const).map(([which, cx, cy]) => (
                  <g key={which}>
                    <circle cx={cx} cy={cy} r={hitR} fill="transparent"
                      style={{ pointerEvents: 'all', cursor: CURSOR_ENDPT }}
                      onPointerDown={e => startEndpointDrag(e, b, which)}
                    />
                    <rect x={cx - hs - s} y={cy - hs - s} width={(hs + s) * 2} height={(hs + s) * 2}
                      fill="white" style={{ pointerEvents: 'none' }} />
                    <rect x={cx - hs} y={cy - hs} width={hs * 2} height={hs * 2}
                      fill="#1a1a1a" style={{ pointerEvents: 'none' }} />
                  </g>
                ))}

                {/* 控制点（curve 模式）*/}
                {b.curve === 'curve' && (b.ctrlPts ?? []).map((cp, idx) => {
                  const r = chs * 1.4
                  const pts = `${cp.x},${cp.y - r} ${cp.x + r},${cp.y} ${cp.x},${cp.y + r} ${cp.x - r},${cp.y}`
                  return (
                    <g key={idx}>
                      {/* 连接线：控制点到前后锚点的虚线 */}
                      {idx === 0 && (
                        <line x1={b.x1} y1={b.y1} x2={cp.x} y2={cp.y}
                          stroke="#1a1a1a" strokeWidth={0.5 * s} strokeDasharray={`${2*s},${2*s}`}
                          opacity={0.2} style={{ pointerEvents: 'none' }} />
                      )}
                      {idx > 0 && (b.ctrlPts ?? [])[idx - 1] && (
                        <line x1={(b.ctrlPts ?? [])[idx - 1].x} y1={(b.ctrlPts ?? [])[idx - 1].y} x2={cp.x} y2={cp.y}
                          stroke="#1a1a1a" strokeWidth={0.5 * s} strokeDasharray={`${2*s},${2*s}`}
                          opacity={0.2} style={{ pointerEvents: 'none' }} />
                      )}
                      {idx === (b.ctrlPts ?? []).length - 1 && (
                        <line x1={cp.x} y1={cp.y} x2={b.x2} y2={b.y2}
                          stroke="#1a1a1a" strokeWidth={0.5 * s} strokeDasharray={`${2*s},${2*s}`}
                          opacity={0.2} style={{ pointerEvents: 'none' }} />
                      )}
                      {/* hit area */}
                      <circle cx={cp.x} cy={cp.y} r={hitR} fill="transparent"
                        style={{ pointerEvents: 'all', cursor: CURSOR_CTRL }}
                        onPointerDown={e => startCtrlDrag(e, b, idx)}
                        onDoubleClick={e => deleteCtrlPt(e as any, b, idx)}
                      />
                      {/* 白衬底 */}
                      <polygon points={`${cp.x},${cp.y - r - s} ${cp.x + r + s},${cp.y} ${cp.x},${cp.y + r + s} ${cp.x - r - s},${cp.y}`}
                        fill="white" style={{ pointerEvents: 'none' }} />
                      {/* 空心菱形 */}
                      <polygon points={pts}
                        fill="white" stroke="#1a1a1a" strokeWidth={1 * s}
                        style={{ pointerEvents: 'none' }} />
                    </g>
                  )
                })}

                {/* curve 模式提示图标 */}
                {b.curve === 'curve' && (() => {
                  const ix = (b.x1 + b.x2) / 2
                  const iy = Math.min(b.y1, b.y2) - 18 * s
                  const ic = 10 * s   // 图标尺寸
                  const hasPts = (b.ctrlPts ?? []).length > 0

                  // "点击添加" 图标：小加号圆
                  const AddIcon = () => (
                    <g transform={`translate(${ix - (hasPts ? ic * 1.1 : 0)},${iy})`} style={{ pointerEvents: 'none' }}>
                      {/* 圆圈背景 */}
                      <circle r={ic * 0.72} fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.15)" strokeWidth={0.6 * s} />
                      {/* 加号 */}
                      <line x1={-ic * 0.35} y1={0} x2={ic * 0.35} y2={0} stroke="rgba(0,0,0,0.45)" strokeWidth={1 * s} strokeLinecap="round" />
                      <line x1={0} y1={-ic * 0.35} x2={0} y2={ic * 0.35} stroke="rgba(0,0,0,0.45)" strokeWidth={1 * s} strokeLinecap="round" />
                      {/* 光标点 */}
                      <circle cx={ic * 0.42} cy={ic * 0.42} r={ic * 0.18} fill="rgba(0,0,0,0.35)" />
                    </g>
                  )

                  // "双击删除" 图标：小减号圆（只有控制点时显示）
                  const RemoveIcon = () => !hasPts ? null : (
                    <g transform={`translate(${ix + ic * 1.1},${iy})`} style={{ pointerEvents: 'none' }}>
                      <circle r={ic * 0.72} fill="rgba(255,255,255,0.85)" stroke="rgba(0,0,0,0.15)" strokeWidth={0.6 * s} />
                      {/* 减号 */}
                      <line x1={-ic * 0.35} y1={0} x2={ic * 0.35} y2={0} stroke="rgba(0,0,0,0.45)" strokeWidth={1 * s} strokeLinecap="round" />
                      {/* 双击指示：两个小点 */}
                      <circle cx={-ic * 0.18} cy={ic * 0.5} r={ic * 0.10} fill="rgba(0,0,0,0.3)" />
                      <circle cx={ic * 0.18} cy={ic * 0.5} r={ic * 0.10} fill="rgba(0,0,0,0.3)" />
                    </g>
                  )

                  return <g><AddIcon /><RemoveIcon /></g>
                })()}
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}