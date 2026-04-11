'use client'
// ─────────────────────────────────────────────────────────────────────────────
// GridLayerOverlay.tsx  —  Figma / tldraw 级 grid overlay
//
// ┌─ 核心架构决策 ─────────────────────────────────────────────────────────────┐
// │                                                                           │
// │  Table 交互：ONE bgRect 管所有事，自定义 tap 检测区分 move vs edit        │
// │                                                                           │
// │  传统方案（本项目之前）：                                                  │
// │    bgRect (move) + cells[r][c] rect (dblclick) 叠层 → z-order 互相遮挡   │
// │                                                                           │
// │  本方案：                                                                  │
// │    bgRect 唯一拦截所有 pointer 事件                                        │
// │    pointerdown 时：记录时间戳 + SVG 坐标                                  │
// │    pointermove 时：位移 > DRAG_THRESHOLD → 确认 drag，capture，更新 offset│
// │    pointerup 时：                                                          │
// │      • 未 drag（tap）→ 检查 tap 计数：count=2 且间隔 < DBLCLICK_MS → edit│
// │      • 已 drag → 结束移动                                                 │
// │                                                                           │
// │  这与 tldraw / Figma 内部处理 click vs drag vs dblclick 的方式完全一致    │
// │                                                                           │
// │  SVG 层级（z 序从低到高）：                                                │
// │    1. 视觉层（fill/lines）         pointerEvents: none                    │
// │    2. 格子文字层                   pointerEvents: none                    │
// │    3. bgRect                       pointerEvents: all ← 唯一热区          │
// │    4. 列/行线 resize zones         pointerEvents: all ← stopPropagation   │
// │    5. LayerTransformBox 四角handle  pointerEvents: all ← 最高优先级       │
// │                                                                           │
// └───────────────────────────────────────────────────────────────────────────┘

import React, { useRef, useCallback, useState } from 'react'

// ─── 常量 ─────────────────────────────────────────────────────────────────────

const HIT = 8           // 列/行线 resize hit 半宽（SVG 逻辑 px）
const HANDLE_PX = 8     // scale handle 屏幕尺寸（px）
const DRAG_THRESHOLD = 4  // 拖拽判定阈值（SVG px），小于此值视为 tap
const DBLCLICK_MS = 300   // 双击判定时间窗口（ms）

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function normFracs(arr: number[]): number[] {
  const s = arr.reduce((a, v) => a + v, 0)
  if (s <= 0) return arr.map(() => 1 / arr.length)
  return arr.map(v => Math.max(v / s, 0.01))
}
/**
 * 把存储的 fracs 数组对齐到目标长度 n。
 * 长度不足：追加等分默认值（1/n）再整体 normalize。
 * 长度过多：截断再 normalize。
 * 长度一致：直接 normalize。
 */
function alignFracs(stored: number[] | undefined, n: number): number[] {
  if (!stored || stored.length === 0) return equalFracs(n)
  if (stored.length === n) return normFracs(stored)
  if (stored.length > n) return normFracs(stored.slice(0, n))
  // 长度不足：追加等分槽位，权重取现有均值，保持视觉比例
  const avg = stored.reduce((a, v) => a + v, 0) / stored.length
  const padded = [...stored, ...Array(n - stored.length).fill(avg)]
  return normFracs(padded)
}
function equalFracs(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n)
}
function toSVG(svg: SVGSVGElement, cx: number, cy: number) {
  const pt = svg.createSVGPoint()
  pt.x = cx; pt.y = cy
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: cx, y: cy }
  const t = pt.matrixTransform(ctm.inverse())
  return { x: t.x, y: t.y }
}
function safeScale(v: number | undefined): number {
  return (isFinite(v ?? 1) && (v ?? 1) > 0) ? (v ?? 1) : 1
}
// 在累积坐标数组中找 p 落在哪个区间，返回区间起始索引
function findInterval(xs: number[], p: number): number {
  for (let i = 0; i < xs.length - 1; i++) {
    if (p >= xs[i] && p < xs[i + 1]) return i
  }
  return xs.length - 2
}

// ─── 类型 ─────────────────────────────────────────────────────────────────────

interface ColumnLayer {
  id: string; type: 'column'; visible: boolean
  columns: number; gutter: number; margin: number
  color: string; strokeWidth: number
  offsetX: number; offsetY: number
  colWidths?: number[]; scaleX?: number; scaleY?: number
}
interface BaselineLayer {
  id: string; type: 'baseline'; visible: boolean
  lineHeight: number; color: string; strokeWidth: number
  offsetX: number; offsetY: number
  scaleX?: number; scaleY?: number
}
interface TableLayer {
  id: string; type: 'table'; visible: boolean
  rows: number; columns: number
  color: string; strokeWidth: number; showHeader: boolean
  offsetX: number; offsetY: number
  colWidths?: number[]; rowHeights?: number[]
  scaleX?: number; scaleY?: number
  cellTexts?: Record<string, string>
}
type GridLayer = ColumnLayer | BaselineLayer | TableLayer

interface GridSystemState {
  pages: Record<string, GridLayer[]>
  editingLayerId: string | null
}

export interface CellEditTarget {
  layerId: string
  r: number; c: number
  /** SVG viewBox 绝对坐标（已含 offsetX/Y） */
  svgX: number; svgY: number; svgW: number; svgH: number
  currentText: string
}

// ─── Column Layer — 纯视觉 ────────────────────────────────────────────────────

function ColumnLayerSVG({ layer, W, H }: { layer: ColumnLayer; W: number; H: number }) {
  const ox = layer.offsetX ?? 0; const oy = layer.offsetY ?? 0
  const sW = W * safeScale(layer.scaleX); const sH = H * safeScale(layer.scaleY)
  if (!sW || !sH) return null
  const { columns, gutter, margin, color, strokeWidth } = layer
  const fracs = alignFracs(layer.colWidths, columns)
  const avail = sW - margin * 2 - gutter * (columns - 1)
  const cols: { x: number; w: number }[] = []
  let cur = margin
  for (let i = 0; i < columns; i++) {
    const w = fracs[i] * avail; cols.push({ x: cur, w }); cur += w + gutter
  }
  const lc = color.replace(/[\d.]+\)$/, '0.6)')
  return (
    <g transform={`translate(${ox},${oy})`} style={{ pointerEvents: 'none' }}>
      {cols.map(({ x, w }, i) => <rect key={`f${i}`} x={x} y={0} width={w} height={sH} fill={color} />)}
      {cols.map(({ x }, i) => <line key={`l${i}`} x1={x} y1={0} x2={x} y2={sH} stroke={lc} strokeWidth={strokeWidth} />)}
      <line x1={cols.at(-1)!.x + cols.at(-1)!.w} y1={0}
        x2={cols.at(-1)!.x + cols.at(-1)!.w} y2={sH} stroke={lc} strokeWidth={strokeWidth} />
    </g>
  )
}

// ─── Baseline Layer — 纯视觉 ──────────────────────────────────────────────────

function BaselineLayerSVG({ layer, W, H }: { layer: BaselineLayer; W: number; H: number }) {
  const ox = layer.offsetX ?? 0; const oy = layer.offsetY ?? 0
  const sW = W * safeScale(layer.scaleX); const sH = H * safeScale(layer.scaleY)
  if (!sW || !sH) return null
  const { lineHeight, color, strokeWidth } = layer
  const ys = Array.from({ length: Math.ceil(sH / lineHeight) + 1 }, (_, i) => i * lineHeight)
  return (
    <g transform={`translate(${ox},${oy})`} style={{ pointerEvents: 'none' }}>
      {ys.map(y => <line key={y} x1={0} y1={y} x2={sW} y2={y} stroke={color} strokeWidth={strokeWidth} />)}
    </g>
  )
}

// ─── Table Layer ──────────────────────────────────────────────────────────────
//
// 核心：ONE bgRect 通过自定义 tap 计数同时处理 move 和 dblclick-edit。
//
// tapRef 存 mutable 状态（不引发 re-render）：
//   count   — 连续 tap 次数（1 = 单击，2 = 双击）
//   lastUp  — 上次 pointerup 时间戳
//   lastX/Y — 上次 tap 落点（<g> 内部坐标），用于判断是否同一位置
//
// dragRef 存当次 pointer 会话状态：
//   active       — 是否已确认为 drag
//   pointerId    — 用于 setPointerCapture
//   downX/Y      — pointerdown 时的 viewBox 坐标（判断位移）
//   anchorX/Y    — offset 锚点（= pointerdown 时 p - offset）

function TableLayerSVG({
  layer, W, H, svgRef, onUpdate, onEditCell,
}: {
  layer: TableLayer; W: number; H: number
  svgRef: React.RefObject<SVGSVGElement | null>
  onUpdate: (p: Partial<TableLayer>) => void
  onEditCell: (target: CellEditTarget) => void
}) {
  const { rows, columns, color, strokeWidth, showHeader } = layer
  const ox = layer.offsetX ?? 0; const oy = layer.offsetY ?? 0
  const sx = safeScale(layer.scaleX); const sy = safeScale(layer.scaleY)
  const sW = W * sx; const sH = H * sy
  if (!sW || !sH) return null

  const cellTexts = layer.cellTexts ?? {}
  const cFracs = alignFracs(layer.colWidths,  columns)
  const rFracs = alignFracs(layer.rowHeights, rows)
  const cXs: number[] = [0]
  for (let i = 0; i < columns; i++) cXs.push(cXs[i] + cFracs[i] * sW)
  const rYs: number[] = [0]
  for (let i = 0; i < rows; i++) rYs.push(rYs[i] + rFracs[i] * sH)

  const [dragging, setDragging] = useState(false)

  // mutable tap 状态（不触发 re-render）
  const tapRef = useRef({ count: 0, lastUp: 0, lastX: 0, lastY: 0 })

  // mutable 当次 pointer 会话
  const dragRef = useRef<{
    active: boolean; pointerId: number
    downX: number; downY: number
    anchorX: number; anchorY: number
  } | null>(null)

  // 列/行线 resize
  const cRef = useRef<{ i: number; startX: number; orig: number[] } | null>(null)
  const rRef = useRef<{ i: number; startY: number; orig: number[] } | null>(null)

  // tableLayoutRef：每次 render 同步最新几何值，handler 从这里读
  const tableLayoutRef = useRef({ ox, oy, sW, sH, cXs, rYs, cFracs, rFracs, cellTexts })
  tableLayoutRef.current = { ox, oy, sW, sH, cXs, rYs, cFracs, rFracs, cellTexts }

  // ─── bgRect ───────────────────────────────────────────────────────

  const onBgDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!svg) return
    e.stopPropagation()
    const { ox, oy } = tableLayoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    // <g> 内部坐标
    const lx = p.x - ox; const ly = p.y - oy
    const now = Date.now()
    const tap = tapRef.current
    const timeDelta = now - tap.lastUp
    const spaceDelta = Math.hypot(lx - tap.lastX, ly - tap.lastY)
    // 时间窗口内 + 位置接近 → 连续 tap
    tap.count = (timeDelta < DBLCLICK_MS && spaceDelta < DRAG_THRESHOLD * 2)
      ? Math.min(tap.count + 1, 2)
      : 1
    tap.lastX = lx; tap.lastY = ly
    dragRef.current = {
      active: false, pointerId: e.pointerId,
      downX: p.x, downY: p.y,
      anchorX: p.x - ox, anchorY: p.y - oy,
    }
  }, [svgRef])

  const onBgMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg) return
    // 双击进行中（count=2 still down），不启动 drag
    if (tapRef.current.count >= 2) return
    const p = toSVG(svg, e.clientX, e.clientY)
    const dist = Math.hypot(p.x - drag.downX, p.y - drag.downY)
    if (!drag.active) {
      if (dist < DRAG_THRESHOLD) return
      // 超过阈值：确认为 drag
      drag.active = true
      e.currentTarget.setPointerCapture(drag.pointerId)
      setDragging(true)
    }
    onUpdate({ offsetX: p.x - drag.anchorX, offsetY: p.y - drag.anchorY })
  }, [svgRef, onUpdate])

  const onBgUp = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const drag = dragRef.current
    const svg = svgRef.current
    if (!drag || !svg) return
    const { ox, oy, cXs, rYs, cellTexts } = tableLayoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    const dist = Math.hypot(p.x - drag.downX, p.y - drag.downY)
    const tap = tapRef.current
    if (!drag.active && dist < DRAG_THRESHOLD) {
      // 是一次 tap
      if (tap.count >= 2) {
        // ── 双击：计算命中格子，触发 edit ──
        const lx = p.x - ox; const ly = p.y - oy
        const c = findInterval(cXs, lx)
        const r = findInterval(rYs, ly)
        const cellX = cXs[c]; const cellY = rYs[r]
        const cellW = cXs[c + 1] - cellX; const cellH = rYs[r + 1] - cellY
        onEditCell({
          layerId: layer.id, r, c,
          svgX: ox + cellX, svgY: oy + cellY,
          svgW: cellW, svgH: cellH,
          currentText: cellTexts[`${r}_${c}`] ?? '',
        })
        tap.count = 0  // 三连击 reset
      }
      // 单击：不额外处理
    }
    tap.lastUp = Date.now()
    dragRef.current = null
    setDragging(false)
  }, [svgRef, layer.id, onEditCell])

  // ─── 列/行线 resize ───────────────────────────────────────────────

  const cDown = useCallback((e: React.PointerEvent<SVGRectElement>, i: number) => {
    const svg = svgRef.current; if (!svg) return
    const { cFracs } = tableLayoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    cRef.current = { i, startX: p.x, orig: cFracs.slice() }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [svgRef])
  const cMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!cRef.current || !svg) return
    const { sW } = tableLayoutRef.current
    const { i, startX, orig } = cRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    const df = (p.x - startX) / sW
    const nf = orig.slice()
    nf[i] = Math.max(0.03, orig[i] + df); nf[i + 1] = Math.max(0.03, orig[i + 1] - df)
    onUpdate({ colWidths: normFracs(nf) })
  }, [svgRef, onUpdate])
  const cUp = useCallback(() => { cRef.current = null }, [])

  const rDown = useCallback((e: React.PointerEvent<SVGRectElement>, i: number) => {
    const svg = svgRef.current; if (!svg) return
    const { rFracs } = tableLayoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    rRef.current = { i, startY: p.y, orig: rFracs.slice() }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [svgRef])
  const rMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!rRef.current || !svg) return
    const { sH } = tableLayoutRef.current
    const { i, startY, orig } = rRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    const df = (p.y - startY) / sH
    const nf = orig.slice()
    nf[i] = Math.max(0.03, orig[i] + df); nf[i + 1] = Math.max(0.03, orig[i + 1] - df)
    onUpdate({ rowHeights: normFracs(nf) })
  }, [svgRef, onUpdate])
  const rUp = useCallback(() => { rRef.current = null }, [])

  return (
    <g transform={`translate(${ox},${oy})`}>

      {/* ── 1. 表头高亮（视觉）── */}
      {showHeader && rYs.length > 1 && (
        <rect x={0} y={0} width={sW} height={rYs[1]}
          fill={color} opacity={0.45} style={{ pointerEvents: 'none' }} />
      )}

      {/* ── 2. 网格线（视觉）── */}
      <g style={{ pointerEvents: 'none' }}>
        {cXs.map((x, i) => (
          <line key={`c${i}`} x1={x} y1={0} x2={x} y2={sH} stroke={color} strokeWidth={strokeWidth} />
        ))}
        {rYs.map((y, i) => (
          <line key={`r${i}`} x1={0} y1={y} x2={sW} y2={y} stroke={color} strokeWidth={strokeWidth} />
        ))}
      </g>

      {/* ── 3. 已保存格子文字（视觉）── */}
      <g style={{ pointerEvents: 'none' }}>
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: columns }, (_, c) => {
            const key = `${r}_${c}`
            const text = cellTexts[key]
            if (!text) return null
            const cx = cXs[c]; const cy = rYs[r]
            const ch = rYs[r + 1] - rYs[r]
            return (
              <text key={key}
                x={cx + 4} y={cy + ch / 2}
                dominantBaseline="middle"
                fontSize={11} fill="rgba(24,24,27,0.85)"
                fontFamily="Inter, DM Sans, sans-serif"
                style={{ userSelect: 'none' }}
              >
                {text.length > 30 ? text.slice(0, 28) + '…' : text}
              </text>
            )
          })
        )}
      </g>

      {/* ── 4. THE bgRect ─────────────────────────────────────────────
               唯一的 interactive 热区。
               • single tap  → 不做处理（可扩展为选中）
               • double tap  → 计算命中格子 → onEditCell
               • drag        → 移动整个 table
               cursor 根据 drag 状态切换，给用户即时反馈。
         ─────────────────────────────────────────────────────────── */}
      <rect
        x={0} y={0} width={sW} height={sH}
        fill="transparent"
        style={{ pointerEvents: 'all', cursor: dragging ? 'grabbing' : 'grab' }}
        onPointerDown={onBgDown}
        onPointerMove={onBgMove}
        onPointerUp={onBgUp}
        onPointerCancel={onBgUp}
      />

      {/* ── 5. 列线 resize zones（z 序高于 bgRect，stopPropagation）── */}
      {cXs.slice(1, -1).map((x, i) => (
        <rect key={`cr${i}`}
          x={x - HIT} y={0} width={HIT * 2} height={sH}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'ew-resize' }}
          onPointerDown={e => cDown(e, i)} onPointerMove={cMove}
          onPointerUp={cUp} onPointerCancel={cUp}
        />
      ))}

      {/* ── 6. 行线 resize zones ── */}
      {rYs.slice(1, -1).map((y, i) => (
        <rect key={`rr${i}`}
          x={0} y={y - HIT} width={sW} height={HIT * 2}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: 'ns-resize' }}
          onPointerDown={e => rDown(e, i)} onPointerMove={rMove}
          onPointerUp={rUp} onPointerCancel={rUp}
        />
      ))}

    </g>
  )
}

// ─── LayerTransformBox ────────────────────────────────────────────────────────
//
// column / baseline：整面 move-rect + 四角 scale handle + 虚线边框
// table           ：只渲染四角 scale handle + 虚线边框（无整面 move-rect）
//                   table 的 move 完全由 TableLayerSVG.bgRect 负责
//
// 物理隔离，不靠 z-index 竞争。

type Corner = 'nw' | 'ne' | 'se' | 'sw'

function LayerTransformBox({
  layer, W, H, svgRef, canvasZoom, onUpdate,
}: {
  layer: GridLayer; W: number; H: number
  svgRef: React.RefObject<SVGSVGElement | null>; canvasZoom: number
  onUpdate: (p: Partial<GridLayer>) => void
}) {
  const ox = layer.offsetX ?? 0; const oy = layer.offsetY ?? 0
  const sx = safeScale((layer as any).scaleX)
  const sy = safeScale((layer as any).scaleY)
  const sW = W * sx; const sH = H * sy
  const hs = HANDLE_PX / canvasZoom
  const isTable = layer.type === 'table'

  // layoutRef：每次 render 同步最新几何值，handler 从这里读，不走闭包捕获
  const layoutRef = useRef({ ox, oy, sx, sy, sW, sH, W, H })
  layoutRef.current = { ox, oy, sx, sy, sW, sH, W, H }

  // ── move（column / baseline 专用）──
  const mvRef = useRef<{ ax: number; ay: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const onMoveDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!svg) return
    const { ox, oy } = layoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)
    mvRef.current = { ax: p.x - ox, ay: p.y - oy }
    setMoving(true)
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [svgRef])
  const onMoveMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!mvRef.current || !svg) return
    const p = toSVG(svg, e.clientX, e.clientY)
    onUpdate({ offsetX: p.x - mvRef.current.ax, offsetY: p.y - mvRef.current.ay } as any)
  }, [svgRef, onUpdate])
  const onMoveUp = useCallback(() => { mvRef.current = null; setMoving(false) }, [])

  // ── 固定对角点缩放（所有类型共用）──
  //
  // 方案：pointerdown 时记录「固定角」的 canvas 绝对坐标（anchorX/Y）。
  // pointermove 时根据鼠标位置算出新的逻辑宽高，再反推 scaleX/Y 和 offsetX/Y，
  // 确保固定角坐标在整个拖拽过程中始终不变。
  //
  // 替代旧方案（距离比）的原因：
  //   旧方案只更新 scale，不更新 offset，导致拖左侧 handle 时网格从右侧膨胀，
  //   视觉方向反向，且松手后位置跑掉。
  const rsRef = useRef<{
    corner: Corner
    anchorX: number; anchorY: number   // 固定角的 canvas 绝对坐标
    origSx: number; origSy: number
  } | null>(null)
  const onCornerDown = useCallback((e: React.PointerEvent<SVGRectElement>, corner: Corner) => {
    const svg = svgRef.current; if (!svg) return
    const { ox, oy, sx, sy, sW, sH } = layoutRef.current
    // 固定角 = 被拖角的对角
    const anchorX = ox + (corner === 'nw' || corner === 'sw' ? sW : 0)
    const anchorY = oy + (corner === 'nw' || corner === 'ne' ? sH : 0)
    rsRef.current = { corner, anchorX, anchorY, origSx: sx, origSy: sy }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [svgRef])
  const onCornerMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current; if (!rsRef.current || !svg) return
    const { corner, anchorX, anchorY } = rsRef.current
    const { W, H } = layoutRef.current
    const p = toSVG(svg, e.clientX, e.clientY)

    // 新逻辑尺寸，最小 5% 画布
    const newW = Math.max(W * 0.05, Math.abs(p.x - anchorX))
    const newH = Math.max(H * 0.05, Math.abs(p.y - anchorY))
    const newSx = newW / W
    const newSy = newH / H

    // 固定角不动 → 反推新 offset
    // 被拖角在左 → offsetX = anchorX - newW；在右 → offsetX = anchorX（固定角就是左边）
    const newOx = (corner === 'nw' || corner === 'sw') ? anchorX - newW : anchorX
    const newOy = (corner === 'nw' || corner === 'ne') ? anchorY - newH : anchorY

    onUpdate({ scaleX: newSx, scaleY: newSy, offsetX: newOx, offsetY: newOy } as any)
  }, [svgRef, onUpdate])
  const onCornerUp = useCallback(() => { rsRef.current = null }, [])

  const corners: Record<Corner, { cx: number; cy: number; cursor: string }> = {
    nw: { cx: ox,      cy: oy,      cursor: 'nwse-resize' },
    ne: { cx: ox + sW, cy: oy,      cursor: 'nesw-resize' },
    se: { cx: ox + sW, cy: oy + sH, cursor: 'nwse-resize' },
    sw: { cx: ox,      cy: oy + sH, cursor: 'nesw-resize' },
  }

  return (
    <g>
      {/* 虚线边框（纯视觉） */}
      <rect x={ox} y={oy} width={sW} height={sH}
        fill="none"
        stroke="rgba(99,102,241,0.35)"
        strokeWidth={1 / canvasZoom}
        strokeDasharray={`${4 / canvasZoom} ${3 / canvasZoom}`}
        style={{ pointerEvents: 'none' }}
      />

      {/* 整面 move-rect — 仅 column / baseline */}
      {!isTable && (
        <rect x={ox} y={oy} width={sW} height={sH}
          fill="transparent"
          style={{ pointerEvents: 'all', cursor: moving ? 'grabbing' : 'move' }}
          onPointerDown={onMoveDown} onPointerMove={onMoveMove}
          onPointerUp={onMoveUp} onPointerCancel={onMoveUp}
        />
      )}

      {/* 四角 scale handle — 所有类型 */}
      {(Object.entries(corners) as [Corner, { cx: number; cy: number; cursor: string }][]).map(
        ([corner, { cx, cy, cursor }]) => (
          <rect key={corner}
            x={cx - hs / 2} y={cy - hs / 2} width={hs} height={hs}
            rx={2 / canvasZoom}
            fill="white" stroke="rgba(99,102,241,0.9)" strokeWidth={1.5 / canvasZoom}
            style={{ pointerEvents: 'all', cursor }}
            onPointerDown={e => onCornerDown(e, corner)}
            onPointerMove={onCornerMove}
            onPointerUp={onCornerUp} onPointerCancel={onCornerUp}
          />
        )
      )}
    </g>
  )
}

// ─── LOD opacity ──────────────────────────────────────────────────────────────

function columnLOD(layer: ColumnLayer, W: number, z: number): number {
  const sw = (W * safeScale(layer.scaleX) / Math.max(1, layer.columns)) * z
  return Math.max(0, Math.min(1, (sw - 8) / 16))
}
function baselineLOD(layer: BaselineLayer, z: number): number {
  return Math.max(0, Math.min(1, (layer.lineHeight * z - 4) / 6))
}
function tableLOD(layer: TableLayer, W: number, H: number, z: number): number {
  const cw = (W * safeScale(layer.scaleX) / Math.max(1, layer.columns)) * z
  const ch = (H * safeScale(layer.scaleY) / Math.max(1, layer.rows)) * z
  return Math.max(0, Math.min(1, (Math.min(cw, ch) - 10) / 14))
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

interface Props {
  gridState: GridSystemState
  pageId: string
  canvasWidth: number; canvasHeight: number; canvasZoom?: number
  updateLayer: (layerId: string, patch: Partial<GridLayer>) => void
  onEditCell?: (target: CellEditTarget) => void
}

export function GridLayerOverlay({
  gridState, pageId, canvasWidth, canvasHeight,
  canvasZoom = 1, updateLayer, onEditCell,
}: Props) {
  const layers: GridLayer[] = (gridState?.pages ?? {})[pageId] ?? []
  const visible = layers.filter(l => l.visible)
  if (visible.length === 0) return null

  const W = (canvasWidth  > 0 && isFinite(canvasWidth))  ? canvasWidth  : 0
  const H = (canvasHeight > 0 && isFinite(canvasHeight)) ? canvasHeight : 0
  if (!W || !H) return null

  const svgRef = useRef<SVGSVGElement>(null)
  const handleEditCell = useCallback((t: CellEditTarget) => onEditCell?.(t), [onEditCell])

  // 把正在编辑的 layer 移到渲染数组末尾（SVG z 序最高），
  // 避免多个 table layer 的 bgRect 互相遮挡导致低层 layer 不可点击。
  const editingId = gridState.editingLayerId
  const sorted = editingId
    ? [...visible.filter(l => l.id !== editingId), ...visible.filter(l => l.id === editingId)]
    : visible

  return (
    <svg
      ref={svgRef}
      data-grid-overlay="true"
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',   // 根节点 none，子元素局部 all
        zIndex: 5,
        userSelect: 'none', touchAction: 'none', overflow: 'visible',
      }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {sorted.map(layer => {
        const shared = {
          layer, W, H, svgRef, canvasZoom,
          onUpdate: (p: Partial<GridLayer>) => updateLayer(layer.id, p),
        }

        if (layer.type === 'column') {
          const op = columnLOD(layer, W, canvasZoom)
          if (op <= 0) return null
          return (
            <g key={layer.id}>
              <g opacity={op}><ColumnLayerSVG layer={layer} W={W} H={H} /></g>
              <LayerTransformBox {...shared} />
            </g>
          )
        }

        if (layer.type === 'baseline') {
          const op = baselineLOD(layer, canvasZoom)
          if (op <= 0) return null
          return (
            <g key={layer.id}>
              <g opacity={op}><BaselineLayerSVG layer={layer} W={W} H={H} /></g>
              <LayerTransformBox {...shared} />
            </g>
          )
        }

        if (layer.type === 'table') {
          const op = tableLOD(layer, W, H, canvasZoom)
          if (op <= 0) return null
          return (
            <g key={layer.id}>
              {/*
                渲染顺序 = z 序：
                  TableLayerSVG（bgRect + resize zones）先渲，z 序低
                  LayerTransformBox（四角 handle）后渲，z 序高
                  table 的 LayerTransformBox 无整面 move-rect，
                  四角 handle 只覆盖角落 8×8px，不遮挡格子区域。
              */}
              <g opacity={op}>
                <TableLayerSVG
                  layer={layer} W={W} H={H}
                  svgRef={svgRef}
                  onUpdate={p => updateLayer(layer.id, p as any)}
                  onEditCell={handleEditCell}
                />
              </g>
              <LayerTransformBox {...shared} />
            </g>
          )
        }

        return null
      })}
    </svg>
  )
}