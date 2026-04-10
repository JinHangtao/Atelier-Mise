'use client'
// ─────────────────────────────────────────────────────────────────────────────
// GridLayerOverlay.tsx
//
// 接入方式 — 在 CanvasArea.tsx 里把原内联网格 SVG 块（约第2615-2672行）替换为：
//
//   import { GridLayerOverlay } from './GridLayerOverlay'
//
//   {gridState && (
//     <GridLayerOverlay
//       gridState={gridState as any}
//       pageId={page.id}
//       canvasWidth={contentWidth}
//       canvasHeight={pgHeight ?? 600}
//       canvasZoom={canvasZoom}
//       updateLayer={(layerId, patch) =>
//         (s as any).updateLayer(page.id, layerId, patch)
//       }
//     />
//   )}
//
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useCallback, useState } from 'react'

// ─── 工具 ─────────────────────────────────────────────────────────────────────

function normFracs(arr: number[]): number[] {
  const total = arr.reduce((s, v) => s + v, 0)
  if (total <= 0) return arr.map(() => 1 / arr.length)
  return arr.map(v => Math.max(v / total, 0.01))
}
function equalFracs(n: number): number[] {
  return Array.from({ length: n }, () => 1 / n)
}

/**
 * 把 clientX/Y（屏幕坐标）转换成 SVG 逻辑坐标。
 * 这是处理 viewBox + CSS transform/zoom 的唯一正确方式。
 */
function toSVG(svg: SVGSVGElement, cx: number, cy: number): { x: number; y: number } {
  const pt = svg.createSVGPoint()
  pt.x = cx; pt.y = cy
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: cx, y: cy }
  const t = pt.matrixTransform(ctm.inverse())
  return { x: t.x, y: t.y }
}

// ─── 类型（与 gridTypes.ts 同步） ────────────────────────────────────────────

interface ColumnLayer {
  id: string; type: 'column'; visible: boolean
  columns: number; gutter: number; margin: number
  color: string; strokeWidth: number
  offsetX: number; offsetY: number
  colWidths?: number[]
  /** 整体缩放（相对于画布宽高的比例，默认 1） */
  scaleX?: number; scaleY?: number
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
  colWidths?: number[]
  rowHeights?: number[]
  scaleX?: number; scaleY?: number
  /** 格子文字，key = "row_col"（0-indexed） */
  cellTexts?: Record<string, string>
}
type GridLayer = ColumnLayer | BaselineLayer | TableLayer

interface GridSystemState {
  pages: Record<string, GridLayer[]>
}

// hit zone 半宽（SVG 逻辑 px）
const HIT = 8
// 缩放 handle 尺寸（SVG 逻辑 px）
const RHANDLE = 12

// ─── 整体缩放 Handle（右下角）────────────────────────────────────────────────

function ScaleHandle({ W, H, sx, sy, svgEl, onScale }: {
  W: number; H: number; sx: number; sy: number
  svgEl: SVGSVGElement | null
  onScale: (newSx: number, newSy: number) => void
}) {
  const ref = useRef<{ startX: number; startY: number; origSx: number; origSy: number } | null>(null)

  const onDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    ref.current = { startX: p.x, startY: p.y, origSx: sx, origSy: sy }
    e.currentTarget.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }, [svgEl, sx, sy])

  const onMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!ref.current || !svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const dx = (p.x - ref.current.startX) / W
    const dy = (p.y - ref.current.startY) / H
    const newSx = Math.max(0.1, ref.current.origSx + dx)
    const newSy = Math.max(0.1, ref.current.origSy + dy)
    onScale(newSx, newSy)
  }, [W, H, svgEl, onScale])

  const onUp = useCallback(() => { ref.current = null }, [])

  // handle 渲染在缩放后的右下角
  const hx = W * sx - RHANDLE / 2
  const hy = H * sy - RHANDLE / 2

  return (
    <rect
      x={hx} y={hy} width={RHANDLE} height={RHANDLE} rx={3}
      fill="rgba(99,102,241,0.85)" stroke="white" strokeWidth={1.5}
      style={{ cursor: 'nwse-resize' }} pointerEvents="all"
      onPointerDown={onDown} onPointerMove={onMove}
      onPointerUp={onUp} onPointerCancel={onUp}
    />
  )
}

// ─── Column Layer ─────────────────────────────────────────────────────────────

function ColumnLayerSVG({ layer, W, H, svgEl, onUpdate, onGlobalDrag }: {
  layer: ColumnLayer; W: number; H: number
  svgEl: SVGSVGElement | null
  onUpdate: (p: Partial<ColumnLayer>) => void
  onGlobalDrag: (v: boolean) => void
}) {
  const { columns, gutter, margin, color, strokeWidth } = layer
  const ox = layer.offsetX ?? 0
  const oy = layer.offsetY ?? 0
  const sx = (isFinite(layer.scaleX ?? 1) && (layer.scaleX ?? 1) > 0) ? (layer.scaleX ?? 1) : 1
  const sy = (isFinite(layer.scaleY ?? 1) && (layer.scaleY ?? 1) > 0) ? (layer.scaleY ?? 1) : 1
  const sW = isFinite(W * sx) ? W * sx : 0
  const sH = isFinite(H * sy) ? H * sy : 0
  if (!sW || !sH) return null

  const fracs = normFracs(layer.colWidths ?? equalFracs(columns))
  const available = sW - margin * 2 - gutter * (columns - 1)

  const cols: { x: number; w: number }[] = []
  let cur = margin
  for (let i = 0; i < columns; i++) {
    const w = fracs[i] * available; cols.push({ x: cur, w }); cur += w + gutter
  }
  const lineColor = color.replace(/[\d.]+\)$/, '0.6)')

  const mvRef = useRef<{ ax: number; ay: number } | null>(null)
  const [moving, setMoving] = useState(false)

  const bgDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    mvRef.current = { ax: p.x - ox, ay: p.y - oy }
    setMoving(true); onGlobalDrag(true)
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [ox, oy, svgEl, onGlobalDrag])

  const bgMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!mvRef.current || !svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    onUpdate({ offsetX: p.x - mvRef.current.ax, offsetY: p.y - mvRef.current.ay })
  }, [svgEl, onUpdate])

  const bgUp = useCallback(() => {
    mvRef.current = null; setMoving(false); onGlobalDrag(false)
  }, [onGlobalDrag])

  const dvRef = useRef<{ i: number; startX: number; orig: number[] } | null>(null)

  const dvDown = useCallback((e: React.PointerEvent<SVGRectElement>, i: number) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    dvRef.current = { i, startX: p.x, orig: fracs.slice() }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [fracs, svgEl])

  const dvMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!dvRef.current || !svgEl) return
    const { i, startX, orig } = dvRef.current
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const df = (p.x - startX) / available
    const nf = orig.slice()
    nf[i]   = Math.max(0.03, orig[i]   + df)
    nf[i+1] = Math.max(0.03, orig[i+1] - df)
    onUpdate({ colWidths: normFracs(nf) })
  }, [available, svgEl, onUpdate])

  const dvUp = useCallback(() => { dvRef.current = null }, [])
  const dividers = cols.slice(0, -1).map(c => c.x + c.w)

  return (
    <g transform={`translate(${ox},${oy})`}>
      {cols.map(({ x, w }, i) => <rect key={`f${i}`} x={x} y={0} width={w} height={sH} fill={color} pointerEvents="none" />)}
      {cols.map(({ x }, i) => <line key={`l${i}`} x1={x} y1={0} x2={x} y2={sH} stroke={lineColor} strokeWidth={strokeWidth} pointerEvents="none" />)}
      <line x1={cols[cols.length-1].x+cols[cols.length-1].w} y1={0} x2={cols[cols.length-1].x+cols[cols.length-1].w} y2={sH} stroke={lineColor} strokeWidth={strokeWidth} pointerEvents="none" />

      <rect x={0} y={0} width={sW} height={sH} fill="transparent" pointerEvents="all"
        style={{ cursor: moving ? 'grabbing' : 'grab' }}
        onPointerDown={bgDown} onPointerMove={bgMove} onPointerUp={bgUp} onPointerCancel={bgUp} />

      {dividers.map((dx, i) => (
        <rect key={`dh${i}`} x={dx-HIT} y={0} width={HIT*2} height={sH}
          fill="transparent" pointerEvents="all" style={{ cursor: 'ew-resize' }}
          onPointerDown={e => dvDown(e, i)} onPointerMove={dvMove} onPointerUp={dvUp} onPointerCancel={dvUp} />
      ))}

      <ScaleHandle W={W} H={H} sx={sx} sy={sy} svgEl={svgEl}
        onScale={(nsx, nsy) => onUpdate({ scaleX: nsx, scaleY: nsy })} />
    </g>
  )
}

// ─── Baseline Layer ───────────────────────────────────────────────────────────

function BaselineLayerSVG({ layer, W, H, svgEl, onUpdate, onGlobalDrag }: {
  layer: BaselineLayer; W: number; H: number
  svgEl: SVGSVGElement | null
  onUpdate: (p: Partial<BaselineLayer>) => void
  onGlobalDrag: (v: boolean) => void
}) {
  const { lineHeight, color, strokeWidth } = layer
  const ox = layer.offsetX ?? 0
  const oy = layer.offsetY ?? 0
  const sx = (isFinite(layer.scaleX ?? 1) && (layer.scaleX ?? 1) > 0) ? (layer.scaleX ?? 1) : 1
  const sy = (isFinite(layer.scaleY ?? 1) && (layer.scaleY ?? 1) > 0) ? (layer.scaleY ?? 1) : 1
  const sW = isFinite(W * sx) ? W * sx : 0
  const sH = isFinite(H * sy) ? H * sy : 0
  if (!sW || !sH) return null

  const ys = Array.from({ length: Math.ceil(sH / lineHeight) }, (_, i) => i * lineHeight)

  const mvRef = useRef<{ ax: number; ay: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const bgDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    mvRef.current = { ax: p.x - ox, ay: p.y - oy }
    setMoving(true); onGlobalDrag(true)
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [ox, oy, svgEl, onGlobalDrag])
  const bgMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!mvRef.current || !svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    onUpdate({ offsetX: p.x - mvRef.current.ax, offsetY: p.y - mvRef.current.ay })
  }, [svgEl, onUpdate])
  const bgUp = useCallback(() => { mvRef.current = null; setMoving(false); onGlobalDrag(false) }, [onGlobalDrag])

  const lnRef = useRef<{ sy: number; origLH: number; lineIdx: number } | null>(null)
  const lnDown = useCallback((e: React.PointerEvent<SVGRectElement>, y: number) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const lineIdx = Math.round(y / lineHeight)
    lnRef.current = { sy: p.y, origLH: lineHeight, lineIdx }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [lineHeight, svgEl])
  const lnMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!lnRef.current || !svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const { lineIdx } = lnRef.current
    if (lineIdx <= 0) return
    const newLH = Math.max(4, p.y / lineIdx)
    onUpdate({ lineHeight: newLH })
  }, [svgEl, onUpdate])
  const lnUp = useCallback(() => { lnRef.current = null }, [])

  return (
    <g transform={`translate(${ox},${oy})`}>
      {ys.map(y => <line key={y} x1={0} y1={y} x2={sW} y2={y} stroke={color} strokeWidth={strokeWidth} pointerEvents="none" />)}
      <rect x={0} y={0} width={sW} height={sH} fill="transparent" pointerEvents="all"
        style={{ cursor: moving ? 'grabbing' : 'grab' }}
        onPointerDown={bgDown} onPointerMove={bgMove} onPointerUp={bgUp} onPointerCancel={bgUp} />
      {ys.slice(1).map(y => (
        <rect key={`lh${y}`} x={0} y={y-HIT} width={sW} height={HIT*2}
          fill="transparent" pointerEvents="all" style={{ cursor: 'ns-resize' }}
          onPointerDown={e => lnDown(e, y)} onPointerMove={lnMove} onPointerUp={lnUp} onPointerCancel={lnUp} />
      ))}

      <ScaleHandle W={W} H={H} sx={sx} sy={sy} svgEl={svgEl}
        onScale={(nsx, nsy) => onUpdate({ scaleX: nsx, scaleY: nsy })} />
    </g>
  )
}

// ─── Table Layer ──────────────────────────────────────────────────────────────

function TableLayerSVG({ layer, W, H, svgEl, onUpdate, onGlobalDrag, canvasZoom }: {
  layer: TableLayer; W: number; H: number
  svgEl: SVGSVGElement | null
  onUpdate: (p: Partial<TableLayer>) => void
  onGlobalDrag: (v: boolean) => void
  canvasZoom: number
}) {
  const { rows, columns, color, strokeWidth, showHeader } = layer
  const ox = layer.offsetX ?? 0
  const oy = layer.offsetY ?? 0
  const sx = (isFinite(layer.scaleX ?? 1) && (layer.scaleX ?? 1) > 0) ? (layer.scaleX ?? 1) : 1
  const sy = (isFinite(layer.scaleY ?? 1) && (layer.scaleY ?? 1) > 0) ? (layer.scaleY ?? 1) : 1
  const sW = isFinite(W * sx) ? W * sx : 0
  const sH = isFinite(H * sy) ? H * sy : 0
  if (!sW || !sH) return null
  const cellTexts = layer.cellTexts ?? {}

  const cFracs = normFracs(layer.colWidths  ?? equalFracs(columns))
  const rFracs = normFracs(layer.rowHeights ?? equalFracs(rows))

  const cXs: number[] = [0]
  for (let i = 0; i < columns; i++) cXs.push(cXs[i] + cFracs[i] * sW)

  const rYs: number[] = [0]
  for (let i = 0; i < rows; i++) rYs.push(rYs[i] + rFracs[i] * sH)

  // 正在编辑的格子
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null)

  // ── 整体移动 ──
  const mvRef = useRef<{ ax: number; ay: number } | null>(null)
  const [moving, setMoving] = useState(false)
  const bgDown = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    mvRef.current = { ax: p.x - ox, ay: p.y - oy }
    setMoving(true); onGlobalDrag(true)
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [ox, oy, svgEl, onGlobalDrag])
  const bgMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!mvRef.current || !svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    onUpdate({ offsetX: p.x - mvRef.current.ax, offsetY: p.y - mvRef.current.ay })
  }, [svgEl, onUpdate])
  const bgUp = useCallback(() => { mvRef.current = null; setMoving(false); onGlobalDrag(false) }, [onGlobalDrag])

  // ── 列线拖拽 ──
  const cRef = useRef<{ i: number; startX: number; orig: number[] } | null>(null)
  const cDown = useCallback((e: React.PointerEvent<SVGRectElement>, i: number) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    cRef.current = { i, startX: p.x, orig: cFracs.slice() }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [cFracs, svgEl])
  const cMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!cRef.current || !svgEl) return
    const { i, startX, orig } = cRef.current
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const df = (p.x - startX) / sW
    const nf = orig.slice(); nf[i] = Math.max(0.03, orig[i]+df); nf[i+1] = Math.max(0.03, orig[i+1]-df)
    onUpdate({ colWidths: normFracs(nf) })
  }, [sW, svgEl, onUpdate])
  const cUp = useCallback(() => { cRef.current = null }, [])

  // ── 行线拖拽 ──
  const rRef = useRef<{ i: number; startY: number; orig: number[] } | null>(null)
  const rDown = useCallback((e: React.PointerEvent<SVGRectElement>, i: number) => {
    if (!svgEl) return
    const p = toSVG(svgEl, e.clientX, e.clientY)
    rRef.current = { i, startY: p.y, orig: rFracs.slice() }
    e.currentTarget.setPointerCapture(e.pointerId); e.stopPropagation()
  }, [rFracs, svgEl])
  const rMove = useCallback((e: React.PointerEvent<SVGRectElement>) => {
    if (!rRef.current || !svgEl) return
    const { i, startY, orig } = rRef.current
    const p = toSVG(svgEl, e.clientX, e.clientY)
    const df = (p.y - startY) / sH
    const nf = orig.slice(); nf[i] = Math.max(0.03, orig[i]+df); nf[i+1] = Math.max(0.03, orig[i+1]-df)
    onUpdate({ rowHeights: normFracs(nf) })
  }, [sH, svgEl, onUpdate])
  const rUp = useCallback(() => { rRef.current = null }, [])

  // ── 格子文字保存 ──
  const saveCellText = useCallback((r: number, c: number, text: string) => {
    const key = `${r}_${c}`
    onUpdate({ cellTexts: { ...cellTexts, [key]: text } })
  }, [cellTexts, onUpdate])

  // foreignObject 里字体用 SVG 逻辑 px，需补偿 canvasZoom 让屏幕大小稳定
  const fontSize = 13 / canvasZoom
  const PAD = 5 / canvasZoom

  return (
    <g transform={`translate(${ox},${oy})`}>
      {showHeader && rYs.length > 1 && (
        <rect x={0} y={0} width={sW} height={rYs[1]} fill={color} opacity={0.45} pointerEvents="none" />
      )}
      {cXs.map((x, i) => <line key={`tc${i}`} x1={x} y1={0} x2={x} y2={sH} stroke={color} strokeWidth={strokeWidth} pointerEvents="none" />)}
      {rYs.map((y, i) => <line key={`tr${i}`} x1={0} y1={y} x2={sW} y2={y} stroke={color} strokeWidth={strokeWidth} pointerEvents="none" />)}

      {/* ── 格子文字 & 编辑热区 ── */}
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: columns }, (_, c) => {
          const key = `${r}_${c}`
          const cellX = cXs[c]
          const cellY = rYs[r]
          const cellW = cXs[c + 1] - cXs[c]
          const cellH = rYs[r + 1] - rYs[r]
          const isEditing = editingCell?.r === r && editingCell?.c === c
          const text = cellTexts[key] ?? ''

          return (
            <g key={key}>
              {/* 静态文字（非编辑态） */}
              {!isEditing && text && (
                <foreignObject
                  x={cellX + PAD} y={cellY + PAD}
                  width={Math.max(1, cellW - PAD * 2)}
                  height={Math.max(1, cellH - PAD * 2)}
                  style={{ pointerEvents: 'none', overflow: 'hidden' }}
                >
                  <div
                    // @ts-ignore — xmlns needed for SVG foreignObject
                    xmlns="http://www.w3.org/1999/xhtml"
                    style={{
                      fontSize,
                      lineHeight: 1.4,
                      color: '#18181b',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      overflow: 'hidden',
                      width: '100%',
                      height: '100%',
                      fontFamily: 'Inter, DM Sans, sans-serif',
                      boxSizing: 'border-box',
                    }}
                  >{text}</div>
                </foreignObject>
              )}

              {/* 编辑态 textarea */}
              {isEditing && (
                <foreignObject x={cellX} y={cellY} width={cellW} height={cellH}>
                  <textarea
                    // @ts-ignore
                    xmlns="http://www.w3.org/1999/xhtml"
                    autoFocus
                    defaultValue={text}
                    onMouseDown={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    onBlur={e => {
                      saveCellText(r, c, e.target.value)
                      setEditingCell(null)
                    }}
                    onKeyDown={e => {
                      // Escape 退出，其余按键正常
                      if (e.key === 'Escape') {
                        saveCellText(r, c, (e.target as HTMLTextAreaElement).value)
                        setEditingCell(null)
                      }
                      e.stopPropagation()
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      outline: `${2 / canvasZoom}px solid rgba(99,102,241,0.8)`,
                      background: 'rgba(255,255,255,0.93)',
                      resize: 'none',
                      padding: `${PAD}px`,
                      boxSizing: 'border-box',
                      fontSize,
                      fontFamily: 'Inter, DM Sans, sans-serif',
                      lineHeight: 1.4,
                      color: '#18181b',
                    }}
                  />
                </foreignObject>
              )}

              {/* 双击热区 — 覆盖格子，双击进入编辑 */}
              {!isEditing && (
                <rect
                  x={cellX} y={cellY} width={cellW} height={cellH}
                  fill="transparent" pointerEvents="all"
                  style={{ cursor: 'text' }}
                  onDoubleClick={e => { e.stopPropagation(); setEditingCell({ r, c }) }}
                />
              )}
            </g>
          )
        })
      )}

      {/* 移动区（z 顺序在格子热区之上，单击拖整体） */}
      <rect x={0} y={0} width={sW} height={sH} fill="transparent" pointerEvents="all"
        style={{ cursor: moving ? 'grabbing' : 'grab' }}
        onPointerDown={bgDown} onPointerMove={bgMove} onPointerUp={bgUp} onPointerCancel={bgUp} />

      {/* 列线 hit zones */}
      {cXs.slice(1, -1).map((x, i) => (
        <rect key={`cdh${i}`} x={x-HIT} y={0} width={HIT*2} height={sH}
          fill="transparent" pointerEvents="all" style={{ cursor: 'ew-resize' }}
          onPointerDown={e => cDown(e, i)} onPointerMove={cMove} onPointerUp={cUp} onPointerCancel={cUp} />
      ))}

      {/* 行线 hit zones */}
      {rYs.slice(1, -1).map((y, i) => (
        <rect key={`rdh${i}`} x={0} y={y-HIT} width={sW} height={HIT*2}
          fill="transparent" pointerEvents="all" style={{ cursor: 'ns-resize' }}
          onPointerDown={e => rDown(e, i)} onPointerMove={rMove} onPointerUp={rUp} onPointerCancel={rUp} />
      ))}

      {/* 缩放 handle（右下角，紫色小方块） */}
      <ScaleHandle W={W} H={H} sx={sx} sy={sy} svgEl={svgEl}
        onScale={(nsx, nsy) => onUpdate({ scaleX: nsx, scaleY: nsy })} />
    </g>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

interface Props {
  gridState: GridSystemState
  pageId: string
  canvasWidth: number
  canvasHeight: number
  canvasZoom?: number
  updateLayer: (layerId: string, patch: Partial<GridLayer>) => void
}

export function GridLayerOverlay({ gridState, pageId, canvasWidth, canvasHeight, canvasZoom = 1, updateLayer }: Props) {
  const layers: GridLayer[] = (gridState?.pages ?? {})[pageId] ?? []
  const visible = layers.filter(l => l.visible)
  if (visible.length === 0) return null

  // 防御：canvasWidth/canvasHeight 可能传入 NaN（pgHeight 未就绪时）
  const W = (canvasWidth  > 0 && isFinite(canvasWidth))  ? canvasWidth  : 0
  const H = (canvasHeight > 0 && isFinite(canvasHeight)) ? canvasHeight : 0
  if (W === 0 || H === 0) return null

  const svgRef = useRef<SVGSVGElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <svg
      ref={svgRef}
      data-grid-overlay="true"
      onMouseDown={e => {
        // 阻止原生事件冒泡到 canvas wrapper，防止同时触发画布 pan
        e.nativeEvent.stopImmediatePropagation()
      }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        pointerEvents: 'all',
        cursor: dragging ? 'grabbing' : 'default',
        userSelect: 'none',
        touchAction: 'none',
      }}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {visible.map(layer => {
        const shared = {
          W, H,
          svgEl: svgRef.current,
          onGlobalDrag: setDragging,
        }
        if (layer.type === 'column') return (
          <ColumnLayerSVG key={layer.id} layer={layer} {...shared}
            onUpdate={p => updateLayer(layer.id, p as any)} />
        )
        if (layer.type === 'baseline') return (
          <BaselineLayerSVG key={layer.id} layer={layer} {...shared}
            onUpdate={p => updateLayer(layer.id, p as any)} />
        )
        if (layer.type === 'table') return (
          <TableLayerSVG key={layer.id} layer={layer} {...shared}
            canvasZoom={canvasZoom}
            onUpdate={p => updateLayer(layer.id, p as any)} />
        )
        return null
      })}
    </svg>
  )
}