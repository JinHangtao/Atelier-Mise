import React, { useMemo, useRef } from 'react'
import { GridSystemState } from './gridTypes'

interface GridOverlayProps {
  gridState: GridSystemState
  width: number
  height: number
  scale?: number
  /** 当 modular 格子文字变化时回调，传给 useGridSystem.updateModularCell */
  onModularCellChange?: (index: number, text: string) => void
  onModularCellAlignChange?: (index: number, align: 'left' | 'center' | 'right') => void
}

// ─── Column Grid ──────────────────────────────────────────────────────────────

function ColumnGrid({ width, height, columns, gutter, margin, color }: {
  width: number; height: number; columns: number; gutter: number; margin: number; color: string
}) {
  const rects = useMemo(() => {
    const available = width - margin * 2 - gutter * (columns - 1)
    const colWidth = available / columns
    return Array.from({ length: columns }, (_, i) => ({
      x: margin + i * (colWidth + gutter), w: colWidth,
    }))
  }, [width, columns, gutter, margin])

  return (
    <g className="grid-column-layer" style={{ pointerEvents: 'none' }}>
      {rects.map(({ x, w }, i) => (
        <rect key={i} x={x} y={0} width={w} height={height} fill={color} stroke="none" />
      ))}
      {rects.map(({ x }, i) => (
        <line key={`l${i}`} x1={x} y1={0} x2={x} y2={height}
          stroke={color.replace(/[\d.]+\)$/, '0.6)')} strokeWidth={0.5} />
      ))}
      <line
        x1={rects[rects.length - 1].x + rects[rects.length - 1].w} y1={0}
        x2={rects[rects.length - 1].x + rects[rects.length - 1].w} y2={height}
        stroke={color.replace(/[\d.]+\)$/, '0.6)')} strokeWidth={0.5}
      />
    </g>
  )
}

// ─── Baseline Grid ────────────────────────────────────────────────────────────

function BaselineGrid({ width, height, lineHeight, color }: {
  width: number; height: number; lineHeight: number; color: string
}) {
  const lines = useMemo(() => {
    return Array.from({ length: Math.ceil(height / lineHeight) }, (_, i) => i * lineHeight)
  }, [height, lineHeight])

  return (
    <g className="grid-baseline-layer" style={{ pointerEvents: 'none' }}>
      {lines.map((y) => (
        <line key={y} x1={0} y1={y} x2={width} y2={y} stroke={color} strokeWidth={0.75} />
      ))}
    </g>
  )
}

// ─── Modular Grid SVG 部分（只画背景色和边框线） ────────────────────────────

function ModularGridSVG({ width, height, columns, rows, columnGutter, rowGutter, margin, color }: {
  width: number; height: number; columns: number; rows: number
  columnGutter: number; rowGutter: number; margin: number; color: string
}) {
  const cells = useMemo(() => {
    const availW = width - margin * 2 - columnGutter * (columns - 1)
    const availH = height - margin * 2 - rowGutter * (rows - 1)
    const cellW = availW / columns
    const cellH = availH / rows
    const result: { x: number; y: number; w: number; h: number }[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++)
        result.push({
          x: margin + c * (cellW + columnGutter),
          y: margin + r * (cellH + rowGutter),
          w: cellW, h: cellH,
        })
    return result
  }, [width, height, columns, rows, columnGutter, rowGutter, margin])

  return (
    <g className="grid-modular-layer" style={{ pointerEvents: 'none' }}>
      {cells.map(({ x, y, w, h }, i) => (
        <rect key={i} x={x} y={y} width={w} height={h}
          fill={color} stroke={color.replace(/[\d.]+\)$/, '0.5)')} strokeWidth={0.5} />
      ))}
    </g>
  )
}

// ─── Modular Grid HTML 文字层 ─────────────────────────────────────────────────

function ModularGridTextLayer({
  width, height, columns, rows, columnGutter, rowGutter, margin,
  cellTexts, cellAligns, cellFontSize, cellColor,
  onCellChange, onCellAlignChange,
  scale,
}: {
  width: number; height: number; columns: number; rows: number
  columnGutter: number; rowGutter: number; margin: number
  cellTexts?: string[]; cellAligns?: ('left' | 'center' | 'right')[]
  cellFontSize?: number; cellColor?: string
  onCellChange?: (index: number, text: string) => void
  onCellAlignChange?: (index: number, align: 'left' | 'center' | 'right') => void
  scale: number
}) {
  const cells = useMemo(() => {
    const availW = width - margin * 2 - columnGutter * (columns - 1)
    const availH = height - margin * 2 - rowGutter * (rows - 1)
    const cellW = availW / columns
    const cellH = availH / rows
    const result: { x: number; y: number; w: number; h: number; index: number }[] = []
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        const index = r * columns + c
        result.push({
          x: margin + c * (cellW + columnGutter),
          y: margin + r * (cellH + rowGutter),
          w: cellW, h: cellH, index,
        })
      }
    return result
  }, [width, height, columns, rows, columnGutter, rowGutter, margin])

  // 当前选中格（用来显示对齐按钮）
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null)
  const fs   = cellFontSize ?? 13
  const clr  = cellColor ?? '#1a1a1a'

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {cells.map(({ x, y, w, h, index }) => {
        const text  = cellTexts?.[index] ?? ''
        const align = cellAligns?.[index] ?? 'left'
        const isActive = activeIdx === index

        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x, top: y, width: w, height: 'auto', minHeight: h,
              pointerEvents: 'auto',
              boxSizing: 'border-box',
            }}
          >
            {/* 对齐小工具栏（选中时显示） */}
            {isActive && onCellAlignChange && (
              <div
                style={{
                  position: 'absolute', top: -28, left: 0, zIndex: 100,
                  display: 'flex', gap: 2,
                  background: 'rgba(26,26,26,0.85)', borderRadius: 6,
                  padding: '3px 5px',
                  pointerEvents: 'auto',
                }}
                onMouseDown={e => e.preventDefault()} // 阻止格子失焦
              >
                {(['left', 'center', 'right'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => onCellAlignChange(index, a)}
                    style={{
                      width: 22, height: 22, border: 'none', borderRadius: 4, cursor: 'pointer',
                      background: align === a ? 'rgba(255,255,255,0.25)' : 'transparent',
                      color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    title={a}
                  >
                    {a === 'left' ? '⬛\u0020\u2261' : a === 'center' ? '≡' : '≡'}
                    {/* 简单文字图标 */}
                    {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                  </button>
                ))}
              </div>
            )}

            {/* 可编辑文字区域 */}
            <div
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveIdx(index)}
              onBlur={e => {
                setActiveIdx(null)
                onCellChange?.(index, (e.target as HTMLDivElement).innerText)
              }}
              onKeyDown={e => {
                // 阻止 undo 冒泡到画布
                if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation()
                // Escape 退出编辑
                if (e.key === 'Escape') (e.target as HTMLDivElement).blur()
              }}
              ref={el => {
                // 只在非激活时同步值，避免光标跳位
                if (el && document.activeElement !== el && el.innerText !== text) {
                  el.innerText = text
                }
              }}
              style={{
                display: 'block',
                width: '100%',
                minHeight: h,
                padding: '6px 8px',
                boxSizing: 'border-box',
                outline: 'none',
                fontSize: fs / scale,   // 抵消 scale 让字号在视觉上保持一致
                lineHeight: 1.6,
                color: clr,
                textAlign: align,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                cursor: 'text',
                background: 'transparent',
                caretColor: clr,
                // 聚焦时显示轻微高亮
                transition: 'box-shadow 0.1s',
                boxShadow: isActive ? `inset 0 0 0 1.5px rgba(196,160,68,0.6)` : 'none',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Overlay ─────────────────────────────────────────────────────────────

export function GridOverlay({
  gridState, width, height, scale = 1,
  onModularCellChange, onModularCellAlignChange,
}: GridOverlayProps) {
  const { activeType, column, baseline, modular } = gridState
  if (!activeType) return null

  const svgW = width / scale
  const svgH = height / scale

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
      {/* SVG 层：背景色 + 网格线 */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="none"
      >
        {activeType === 'column' && (
          <ColumnGrid width={svgW} height={svgH}
            columns={column.columns} gutter={column.gutter}
            margin={column.margin} color={column.color} />
        )}
        {activeType === 'baseline' && (
          <BaselineGrid width={svgW} height={svgH}
            lineHeight={baseline.lineHeight} color={baseline.color} />
        )}
        {activeType === 'modular' && (
          <ModularGridSVG width={svgW} height={svgH}
            columns={modular.columns} rows={modular.rows}
            columnGutter={modular.columnGutter} rowGutter={modular.rowGutter}
            margin={modular.margin} color={modular.color} />
        )}
      </svg>

      {/* HTML 文字层：只在 modular 模式下叠加 */}
      {activeType === 'modular' && (
        <ModularGridTextLayer
          width={svgW} height={svgH}
          columns={modular.columns} rows={modular.rows}
          columnGutter={modular.columnGutter} rowGutter={modular.rowGutter}
          margin={modular.margin}
          cellTexts={modular.cellTexts}
          cellAligns={modular.cellAligns}
          cellFontSize={modular.cellFontSize}
          cellColor={modular.cellColor}
          onCellChange={onModularCellChange}
          onCellAlignChange={onModularCellAlignChange}
          scale={scale}
        />
      )}
    </div>
  )
}