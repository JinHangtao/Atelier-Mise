'use client'
import React from 'react'
import ReactDOM from 'react-dom'
import { Rnd } from 'react-rnd'
import { Block, School } from '../../../../../lib/exportStyles'
import { aspectLabel, pageHeight, generateId } from './pageHelpers'
import { DraftBanner } from './PanelComponents'
import { TextBlockContent } from './TextBlockContent'
import { TableBlock, DEFAULT_TABLE_DATA } from './TableBlock'
import { ExportPageState, TEXT_BLOCK_TYPES, FONT_OPTIONS, COLOR_PRESETS } from './useExportPage'
import { Aspect, EmojiBlock as EmojiBlockType, ArrowDirection } from './types'
import EmojiBlockComponent from './EmojiBlock'
import { sharedDrawState, BRUSHES, universalRenderStroke } from './DrawPanel'
import { getDrawLayerManager, destroyDrawLayerManager, DrawnShape } from './DrawLayerManager'

// ── Shape SVG helpers ──────────────────────────────────────────────────────
// Builds the SVG path/element for a DrawnShape using its absolute coordinates.
// `opacity` is layered on top of the shape's own alpha so previews can fade.
function buildShapeElement(shape: DrawnShape, x0: number, y0: number, x1: number, y1: number, opacity: number): React.ReactElement | null {
  const stroke = shape.color ?? '#333333'
  const fill   = shape.shapeFill ? stroke : 'none'
  const sw     = shape.shapeStroke ?? 2
  const alpha  = (shape.alpha ?? 1) * opacity
  const commonProps = { stroke, fill, strokeWidth: sw, opacity: alpha, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2

  switch (shape.shapeType) {
    case 'rect':
      return <rect x={Math.min(x0,x1)} y={Math.min(y0,y1)} width={Math.abs(x1-x0)} height={Math.abs(y1-y0)} {...commonProps} />
    case 'ellipse':
      return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...commonProps} />
    case 'line':
      return <line x1={x0} y1={y0} x2={x1} y2={y1} {...commonProps} fill="none" />
    case 'arrow': {
      const angle = Math.atan2(y1 - y0, x1 - x0)
      const hs = Math.max(sw * 3, 8)
      const ax1 = x1 - Math.cos(angle - Math.PI / 6) * hs
      const ay1 = y1 - Math.sin(angle - Math.PI / 6) * hs
      const ax2 = x1 - Math.cos(angle + Math.PI / 6) * hs
      const ay2 = y1 - Math.sin(angle + Math.PI / 6) * hs
      return (
        <g opacity={alpha}>
          <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
          <polyline points={`${ax1},${ay1} ${x1},${y1} ${ax2},${ay2}`} stroke={stroke} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )
    }
    case 'triangle': {
      const pts = `${cx},${Math.min(y0,y1)} ${Math.min(x0,x1)},${Math.max(y0,y1)} ${Math.max(x0,x1)},${Math.max(y0,y1)}`
      return <polygon points={pts} {...commonProps} />
    }
    case 'polygon': {
      const sides = Math.max(3, shape.shapeSides ?? 5)
      const pts = Array.from({ length: sides }, (_, i) => {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2
        return `${cx + Math.cos(a) * rx},${cy + Math.sin(a) * ry}`
      }).join(' ')
      return <polygon points={pts} {...commonProps} />
    }
    case 'star': {
      const pts2 = Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2
        const r = i % 2 === 0 ? Math.max(rx, ry) : Math.max(rx, ry) * 0.4
        return `${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`
      }).join(' ')
      return <polygon points={pts2} {...commonProps} />
    }
    case 'bezier': {
      if (!shape.bezierPts || shape.bezierPts.length < 2) return null
      const pts3 = shape.bezierPts
      let d = `M ${pts3[0].x} ${pts3[0].y}`
      for (let i = 1; i < pts3.length; i++) d += ` L ${pts3[i].x} ${pts3[i].y}`
      return <path d={d} {...commonProps} fill="none" />
    }
    default:
      return null
  }
}

// Used inside the draw-mode SVG overlay (absolute page coordinates).
function renderShapeSVG(shape: DrawnShape, opacity: number): React.ReactElement | null {
  const el = buildShapeElement(shape, shape.x0, shape.y0, shape.x1, shape.y1, opacity)
  if (!el) return null
  const rot = (shape as any).rotation
  if (!rot) return el
  const cx = (shape.x0 + shape.x1) / 2, cy = (shape.y0 + shape.y1) / 2
  return <g transform={`rotate(${rot},${cx},${cy})`}>{el}</g>
}

// Used inside the Rnd-wrapped per-shape SVG box (non-draw mode).
// Coordinates are translated to be relative to the box origin (minX-PAD, minY-PAD).
function renderShapeSVGInBox(shape: DrawnShape, PAD: number, w: number, h: number): React.ReactElement | null {
  const minX = Math.min(shape.x0, shape.x1)
  const minY = Math.min(shape.y0, shape.y1)
  // Local coords: offset by (minX - PAD) so the shape sits centred in the padded box
  const lx0 = shape.x0 - minX + PAD
  const ly0 = shape.y0 - minY + PAD
  const lx1 = shape.x1 - minX + PAD
  const ly1 = shape.y1 - minY + PAD
  // For bezier, remap each point
  if (shape.shapeType === 'bezier' && shape.bezierPts) {
    const remapped: DrawnShape = {
      ...shape,
      bezierPts: shape.bezierPts.map(p => ({ x: p.x - minX + PAD, y: p.y - minY + PAD })),
      x0: lx0, y0: ly0, x1: lx1, y1: ly1,
    }
    return buildShapeElement(remapped, lx0, ly0, lx1, ly1, 1)
  }
  return buildShapeElement(shape, lx0, ly0, lx1, ly1, 1)
}

// Selection handles rendered around a shape in draw mode.
// Unified with NonDrawShape style: indigo solid border + 8 Figma-style handles + delete button.
function renderSelectionHandles(shape: DrawnShape, onDelete: () => void): React.ReactElement {
  const minX = Math.min(shape.x0, shape.x1)
  const minY = Math.min(shape.y0, shape.y1)
  const maxX = Math.max(shape.x0, shape.x1)
  const maxY = Math.max(shape.y0, shape.y1)
  const PAD = 10
  const handles = handleDefs(minX, minY, maxX, maxY, PAD)
  return (
    <g>
      {/* 选中框 — indigo 实线，与非 draw 模式完全统一 */}
      <rect
        x={minX - PAD} y={minY - PAD}
        width={maxX - minX + PAD * 2} height={maxY - minY + PAD * 2}
        fill="rgba(99,102,241,0.04)" stroke="#6366f1" strokeWidth={1} rx={4}
        pointerEvents="none"
      />
      {/* 8个 resize handles — Figma style（draw 模式仅视觉展示，与非 draw 模式外观统一）*/}
      {handles.map(h => {
        const isCorner = h.id === 'tl' || h.id === 'tr' || h.id === 'bl' || h.id === 'br'
        return isCorner ? (
          <rect
            key={h.id}
            x={h.cx - 4.5} y={h.cy - 4.5} width={9} height={9} rx={2.5}
            fill="#fff" stroke="#6366f1" strokeWidth={1.5}
            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}
            pointerEvents="none"
          />
        ) : (
          <rect
            key={h.id}
            x={h.id === 'tc' || h.id === 'bc' ? h.cx - 5 : h.cx - 3}
            y={h.id === 'ml' || h.id === 'mr' ? h.cy - 5 : h.cy - 3}
            width={h.id === 'tc' || h.id === 'bc' ? 10 : 6}
            height={h.id === 'ml' || h.id === 'mr' ? 10 : 6}
            rx={2}
            fill="#6366f1" stroke="none"
            style={{ opacity: 0.85 }}
            pointerEvents="none"
          />
        )
      })}
      {/* 右上角删除按钮 */}
      <g style={{ cursor: 'pointer' }} onClick={e => { e.stopPropagation(); onDelete() }}>
        <circle cx={maxX + PAD} cy={minY - PAD} r={8} fill="rgba(220,60,50,0.9)" />
        <text x={maxX + PAD} y={minY - PAD + 1} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize={10} fontFamily="sans-serif">✕</text>
      </g>
    </g>
  )
}

// ── DrawModeShapeWrapper ──────────────────────────────────────────────────────
// draw 模式下的 shape 渲染 + 右键弹窗，与非 draw 模式的 ShapeContextMenu 完全统一
function DrawModeShapeWrapper({ shape, isSel, pageId, onDelete }: {
  shape: DrawnShape; isSel: boolean; pageId: string; onDelete: () => void
}) {
  const [ctxMenuPos, setCtxMenuPos] = React.useState<{ x: number; y: number } | null>(null)
  return (
    <>
      <g
        style={{ pointerEvents: 'all', cursor: 'default' }}
        onContextMenu={e => {
          e.preventDefault()
          e.stopPropagation()
          setCtxMenuPos({ x: e.clientX, y: e.clientY })
        }}
      >
        {renderShapeSVG(shape, 1)}
        {isSel && renderSelectionHandles(shape, onDelete)}
      </g>
      {ctxMenuPos && typeof document !== 'undefined' && ReactDOM.createPortal(
        <ShapeContextMenu
          shape={shape}
          screenX={ctxMenuPos.x}
          screenY={ctxMenuPos.y}
          pageId={pageId}
          onClose={() => setCtxMenuPos(null)}
          onDelete={onDelete}
        />,
        document.body
      )}
    </>
  )
}

// ── ShapeContextMenu ─────────────────────────────────────────────────────────
// Design ref: shadcn/ui ContextMenu + tldraw StylePanel
// White bg, razor-thin border, 28px row height, dot color swatches

const SHAPE_COLORS = [
  '#1a1a1a', '#e03131', '#f76707', '#f59f00',
  '#2f9e44', '#1971c2', '#7048e8', '#c2255c', '#ffffff',
]

interface ShapeContextMenuProps {
  shape: DrawnShape
  screenX: number
  screenY: number
  pageId: string
  onClose: () => void
  onDelete: () => void
}

function ShapeContextMenu({ shape, screenX, screenY, pageId, onClose, onDelete }: ShapeContextMenuProps) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [localRotation, setLocalRotation] = React.useState<number>((shape as any).rotation ?? 0)
  const [pos, setPos] = React.useState({ x: screenX + 4, y: screenY + 4 })

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler, true)
    return () => document.removeEventListener('mousedown', handler, true)
  }, [onClose])

  React.useEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      x: Math.min(screenX + 4, window.innerWidth - width - 8),
      y: Math.min(screenY + 4, window.innerHeight - height - 8),
    })
  }, [screenX, screenY])

  const patch = (fields: Partial<DrawnShape & { rotation: number }>) =>
    getDrawLayerManager(pageId).patchShape(shape.id, fields as any)

  const activeColor = shape.color ?? '#1a1a1a'
  const hasFill = !!shape.shapeFill

  // ── inline style atoms ──────────────────────────────────────────────────────
  const ff = 'Inter, DM Sans, -apple-system, sans-serif'
  const rowBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    height: 28, padding: '0 8px', borderRadius: 5,
    fontSize: 13, fontFamily: ff,
    background: 'none', border: 'none',
    width: '100%', textAlign: 'left',
    cursor: 'pointer', color: '#18181b',
    transition: 'background 0.08s',
    flexShrink: 0,
  }
  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontFamily: ff, fontWeight: 500,
    color: '#a1a1aa', letterSpacing: '0.04em',
    padding: '0 8px', height: 24,
    display: 'flex', alignItems: 'center',
  }
  const sep: React.CSSProperties = {
    height: 1, background: '#f4f4f5', margin: '3px 0',
  }

  return (
    <div
      ref={ref}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 9999,
        // White surface — clean, professional, contrasts well against canvas
        background: '#ffffff',
        border: '1px solid #e4e4e7',
        borderRadius: 8,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08), 0 10px 24px -4px rgba(0,0,0,0.12)',
        width: 208, fontFamily: ff,
        padding: '4px 0',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >

      {/* ── Color swatches (tldraw dot style) ── */}
      <div style={sectionLabel}>Color</div>
      <div style={{ display: 'flex', gap: 5, padding: '2px 8px 8px', flexWrap: 'wrap' }}>
        {SHAPE_COLORS.map(hex => {
          const isActive = activeColor === hex
          const isWhite = hex === '#ffffff'
          return (
            <button
              key={hex}
              onClick={() => patch({ color: hex })}
              style={{
                width: 18, height: 18, borderRadius: '50%',
                background: hex,
                border: isActive
                  ? `2.5px solid ${isWhite ? '#a1a1aa' : hex}`
                  : isWhite ? '1.5px solid #d4d4d8' : '2px solid transparent',
                outline: isActive ? `2px solid ${isWhite ? '#a1a1aa' : hex}` : 'none',
                outlineOffset: 1.5,
                cursor: 'pointer', padding: 0,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.1s',
                flexShrink: 0,
              }}
            />
          )
        })}
      </div>

      <div style={sep} />

      {/* ── Fill ── */}
      <button
        onClick={() => patch({ shapeFill: !hasFill })}
        style={{ ...rowBase, justifyContent: 'space-between' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#f4f4f5')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* preview swatch */}
          <span style={{
            width: 14, height: 14, borderRadius: 3, flexShrink: 0,
            background: hasFill ? activeColor : 'none',
            border: hasFill ? `1.5px solid ${activeColor}` : '1.5px solid #d4d4d8',
          }} />
          Fill
        </span>
        <span style={{
          fontSize: 11.5, color: hasFill ? '#18181b' : '#a1a1aa',
          fontWeight: hasFill ? 500 : 400,
        }}>{hasFill ? 'On' : 'Off'}</span>
      </button>

      <div style={sep} />

      {/* ── Rotation ── */}
      <div style={{ padding: '4px 8px 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 28 }}>
          <span style={{ fontSize: 13, color: '#18181b', fontFamily: ff, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width={13} height={13} viewBox="0 0 16 16" fill="none">
              <path d="M13.5 5A6 6 0 1 0 14 8" stroke="#71717a" strokeWidth={1.5} strokeLinecap="round"/>
              <path d="M14 2v3.5H10.5" stroke="#71717a" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Rotate
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 12, color: '#71717a', fontVariantNumeric: 'tabular-nums',
              minWidth: 32, textAlign: 'right', fontFamily: ff,
            }}>{localRotation}°</span>
            <button
              onClick={() => { setLocalRotation(0); patch({ rotation: 0 } as any) }}
              title="Reset rotation"
              style={{
                width: 22, height: 22, borderRadius: 5, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid #e4e4e7',
                color: '#71717a', cursor: 'pointer', fontSize: 13, outline: 'none',
                transition: 'border-color 0.1s, background 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.borderColor = '#d4d4d8' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#e4e4e7' }}
            >↺</button>
          </div>
        </div>
        <input
          type="range" min={-180} max={180} step={1}
          value={localRotation}
          onChange={e => {
            const v = Number(e.target.value)
            setLocalRotation(v)
            patch({ rotation: v } as any)
          }}
          style={{ width: '100%', accentColor: '#18181b', cursor: 'pointer', display: 'block', marginTop: 4 }}
        />
      </div>

      <div style={sep} />

      {/* ── Delete ── */}
      <button
        onClick={() => { onDelete(); onClose() }}
        style={{ ...rowBase, color: '#dc2626' }}
        onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5 4l.5 9h5l.5-9"
            stroke="#dc2626" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Delete
      </button>
    </div>
  )
}

// ── NonDrawShape ─────────────────────────────────────────────────────────────
// tldraw / Excalidraw スタイル。react-rnd 不使用。
// drag: gRef に直接 translate を書いて re-render ゼロ。
// resize: preview state で React に再描画させる（shape が軽いので問題なし）。
// 両者はイベント伝播で完全に分離されており互いを壊さない。

type HandleId = 'tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'

interface NonDrawShapeProps {
  shape: DrawnShape
  isSel: boolean
  PAD: number
  minX: number; minY: number; maxX: number; maxY: number
  canvasZoom: number
  pageId: string
  onSelect: () => void
  onDeselect: () => void
  onDelete: () => void
}

// handle の [cx, cy, cursor] を bbox から計算
function handleDefs(x0: number, y0: number, x1: number, y1: number, p: number): Array<{ id: HandleId; cx: number; cy: number; cursor: string }> {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
  return [
    { id: 'tl', cx: x0 - p, cy: y0 - p, cursor: 'nwse-resize' },
    { id: 'tc', cx: mx,     cy: y0 - p, cursor: 'ns-resize'   },
    { id: 'tr', cx: x1 + p, cy: y0 - p, cursor: 'nesw-resize' },
    { id: 'ml', cx: x0 - p, cy: my,     cursor: 'ew-resize'   },
    { id: 'mr', cx: x1 + p, cy: my,     cursor: 'ew-resize'   },
    { id: 'bl', cx: x0 - p, cy: y1 + p, cursor: 'nesw-resize' },
    { id: 'bc', cx: mx,     cy: y1 + p, cursor: 'ns-resize'   },
    { id: 'br', cx: x1 + p, cy: y1 + p, cursor: 'nwse-resize' },
  ]
}

function applyHandle(hid: HandleId, startCoords: { x0: number; y0: number; x1: number; y1: number }, dx: number, dy: number) {
  let { x0, y0, x1, y1 } = startCoords
  if (hid === 'tl' || hid === 'ml' || hid === 'bl') x0 += dx
  if (hid === 'tr' || hid === 'mr' || hid === 'br') x1 += dx
  if (hid === 'tl' || hid === 'tc' || hid === 'tr') y0 += dy
  if (hid === 'bl' || hid === 'bc' || hid === 'br') y1 += dy
  // 最小サイズ 8px を保つ
  if (Math.abs(x1 - x0) < 8) { if (x0 !== startCoords.x0) x0 = x1 - 8 * Math.sign(x1 - startCoords.x0 || 1); else x1 = x0 + 8 * Math.sign(x1 - x0 || 1) }
  if (Math.abs(y1 - y0) < 8) { if (y0 !== startCoords.y0) y0 = y1 - 8 * Math.sign(y1 - startCoords.y0 || 1); else y1 = y0 + 8 * Math.sign(y1 - y0 || 1) }
  return { x0, y0, x1, y1 }
}

function NonDrawShape({ shape, isSel, PAD, minX, minY, maxX, maxY, canvasZoom, pageId, onSelect, onDelete }: NonDrawShapeProps) {
  // ── drag state (zero re-render, direct DOM) ───────────────────────────────
  const dragRef  = React.useRef<{ startX: number; startY: number; dx: number; dy: number } | null>(null)
  const gRef     = React.useRef<SVGGElement>(null)
  const dragging = React.useRef(false)

  // ── resize state (React-driven, shape is light SVG) ──────────────────────
  const [resizePreview, setResizePreview] = React.useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const resizeRef = React.useRef<{ hid: HandleId; startX: number; startY: number; origCoords: { x0: number; y0: number; x1: number; y1: number } } | null>(null)

  // ── context menu ──────────────────────────────────────────────────────────
  const [ctxMenuPos, setCtxMenuPos] = React.useState<{ x: number; y: number } | null>(null)

  const applyTranslate = (dx: number, dy: number) => {
    if (gRef.current) gRef.current.style.transform = `translate(${dx}px,${dy}px)`
  }

  // ── 本体 drag ─────────────────────────────────────────────────────────────
  const onBodyPointerDown = (e: React.PointerEvent<SVGGElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    ;(e.nativeEvent as any).__shapeSelected = true
    onSelect()
    dragging.current = false
    dragRef.current = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0 }
    ;(e.currentTarget as SVGGElement).setPointerCapture(e.pointerId)
  }

  const onBodyPointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragRef.current) return
    e.stopPropagation()
    const rawDx = (e.clientX - dragRef.current.startX) / canvasZoom
    const rawDy = (e.clientY - dragRef.current.startY) / canvasZoom
    if (!dragging.current && Math.hypot(rawDx, rawDy) > 3) dragging.current = true
    if (!dragging.current) return
    dragRef.current.dx = rawDx
    dragRef.current.dy = rawDy
    applyTranslate(rawDx, rawDy)
  }

  const onBodyPointerUp = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragRef.current) return
    e.stopPropagation()
    const { dx, dy } = dragRef.current
    dragRef.current = null
    applyTranslate(0, 0)
    if (dragging.current && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
      getDrawLayerManager(pageId).patchShape(shape.id, {
        x0: shape.x0 + dx, y0: shape.y0 + dy,
        x1: shape.x1 + dx, y1: shape.y1 + dy,
      })
    }
    dragging.current = false
  }

  // ── right-click → context menu ────────────────────────────────────────────
  const onBodyContextMenu = (e: React.MouseEvent<SVGGElement>) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect()
    setCtxMenuPos({ x: e.clientX, y: e.clientY })
  }

  // ── resize handle ─────────────────────────────────────────────────────────
  const onHandlePointerDown = (e: React.PointerEvent<SVGRectElement>, hid: HandleId) => {
    e.stopPropagation()
    e.preventDefault()
    ;(e.currentTarget as SVGRectElement).setPointerCapture(e.pointerId)
    resizeRef.current = {
      hid,
      startX: e.clientX, startY: e.clientY,
      origCoords: { x0: shape.x0, y0: shape.y0, x1: shape.x1, y1: shape.y1 },
    }
  }

  const onHandlePointerMove = (e: React.PointerEvent<SVGRectElement>) => {
    if (!resizeRef.current) return
    e.stopPropagation()
    const dx = (e.clientX - resizeRef.current.startX) / canvasZoom
    const dy = (e.clientY - resizeRef.current.startY) / canvasZoom
    const next = applyHandle(resizeRef.current.hid, resizeRef.current.origCoords, dx, dy)
    setResizePreview(next)
  }

  const onHandlePointerUp = (e: React.PointerEvent<SVGRectElement>) => {
    if (!resizeRef.current) return
    e.stopPropagation()
    const dx = (e.clientX - resizeRef.current.startX) / canvasZoom
    const dy = (e.clientY - resizeRef.current.startY) / canvasZoom
    const next = applyHandle(resizeRef.current.hid, resizeRef.current.origCoords, dx, dy)
    resizeRef.current = null
    setResizePreview(null)
    getDrawLayerManager(pageId).patchShape(shape.id, next)
  }

  // resize preview があれば bbox をそちらから計算
  const coords = resizePreview ?? { x0: shape.x0, y0: shape.y0, x1: shape.x1, y1: shape.y1 }
  const rx0 = Math.min(coords.x0, coords.x1), ry0 = Math.min(coords.y0, coords.y1)
  const rx1 = Math.max(coords.x0, coords.x1), ry1 = Math.max(coords.y0, coords.y1)

  // resize 中は preview coords で shape を描き直す
  const displayShape = resizePreview ? { ...shape, ...resizePreview } : shape

  return (
    <>
      <g
        ref={gRef}
        data-shape-id={shape.id}
        style={{ cursor: 'move', pointerEvents: 'all' }}
        onPointerDown={onBodyPointerDown}
        onPointerMove={onBodyPointerMove}
        onPointerUp={onBodyPointerUp}
        onPointerCancel={onBodyPointerUp}
        onContextMenu={onBodyContextMenu}
      >
        {/* 透明 hit area */}
        <rect
          x={minX - PAD} y={minY - PAD}
          width={maxX - minX + PAD * 2} height={maxY - minY + PAD * 2}
          fill="transparent" stroke="none"
        />
        {/* shape 本体（resize 中は preview coords で描画）*/}
        {renderShapeSVG(displayShape, 1)}

        {/* 選択中 UI */}
        {isSel && (() => {
          return (
          <>
            {/* 選択枠 — subtle indigo, no dash */}
            <rect
              x={rx0 - PAD} y={ry0 - PAD}
              width={rx1 - rx0 + PAD * 2} height={ry1 - ry0 + PAD * 2}
              fill="rgba(99,102,241,0.04)" stroke="#6366f1" strokeWidth={1} rx={4}
              pointerEvents="none"
            />
            {/* resize handles（8点）— Figma style, no delete button */}
            {handleDefs(rx0, ry0, rx1, ry1, PAD).map(h => {
              const isCorner = h.id === 'tl' || h.id === 'tr' || h.id === 'bl' || h.id === 'br'
              return isCorner ? (
                <rect
                  key={h.id}
                  x={h.cx - 4.5} y={h.cy - 4.5} width={9} height={9} rx={2.5}
                  fill="#fff" stroke="#6366f1" strokeWidth={1.5}
                  style={{ cursor: h.cursor, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}
                  pointerEvents="all"
                  onPointerDown={e => onHandlePointerDown(e, h.id)}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                />
              ) : (
                <rect
                  key={h.id}
                  x={h.id === 'tc' || h.id === 'bc' ? h.cx - 5 : h.cx - 3}
                  y={h.id === 'ml' || h.id === 'mr' ? h.cy - 5 : h.cy - 3}
                  width={h.id === 'tc' || h.id === 'bc' ? 10 : 6}
                  height={h.id === 'ml' || h.id === 'mr' ? 10 : 6}
                  rx={2}
                  fill="#6366f1" stroke="none"
                  style={{ cursor: h.cursor, opacity: 0.85 }}
                  pointerEvents="all"
                  onPointerDown={e => onHandlePointerDown(e, h.id)}
                  onPointerMove={onHandlePointerMove}
                  onPointerUp={onHandlePointerUp}
                  onPointerCancel={onHandlePointerUp}
                />
              )
            })}
          </>
          )
        })()}
      </g>
      {/* Context menu portal — rendered outside SVG as HTML */}
      {ctxMenuPos && typeof document !== 'undefined' && ReactDOM.createPortal(
        <ShapeContextMenu
          shape={shape}
          screenX={ctxMenuPos.x}
          screenY={ctxMenuPos.y}
          pageId={pageId}
          onClose={() => setCtxMenuPos(null)}
          onDelete={onDelete}
        />,
        document.body
      )}
    </>
  )
}

export function CanvasArea(s: ExportPageState) {
  const {
    canvasWrapRef, isPanningRef, panStart, canvasZoom, setCanvasZoom,
    canvasPan, setCanvasPan, panningCursor, setPanningCursor,
    toolbarRef, toolbarAnchor, setToolbarAnchor, toolbarDragging,
    setToolbarDragging, toolbarDragPos, setToolbarDragPos, toolbarDragStart,
    pages, activePageId, setActivePageId, activePage, blocks, contentWidth,
    editingBlockId, setEditingBlockId, selectedBlockId, setSelectedBlockId,
    setFontPickerOpen, setColorPickerOpen, dragOverPageId, setDragOverPageId,
    justRestored, clearAll, ctxMenu, setCtxMenu,
    updatePageBlocks, setBlocks, patchBlock, onBlockDragStop, startEdit, saveEdit, cancelEdit,
    addBlock, addBlockAt, addImageBlock, compressImage, addToMediaLibrary,
    removeBackground, removingBgBlockId,
    editingContent, setEditingContent, editingCaption, setEditingCaption,
    editingFontSize, setEditingFontSize, editingImageCaptions, setEditingImageCaptions,
    imageDragIndex, ctxImageInputRef,
    imageEditorUrl, setImageEditorUrl, imageEditorIdx, setImageEditorIdx,
    isZh, project, schools, setRightTab,
    gridState,
  } = s
  const gridEditMode: boolean = s.gridEditMode
  const setGridEditMode: (v: boolean) => void = s.setGridEditMode

  // ── Draw overlay refs (one canvas per page, keyed by page.id) ────────────
  // These canvases sit above all rnd-blocks and receive pointer events only
  // when rightTab === 'draw'. All drawing reads from sharedDrawState (set by
  // DrawPanel) so no prop-drilling or re-renders are needed.
  const drawCanvasRefs = React.useRef<Map<string, HTMLCanvasElement>>(new Map())
  // 初始化过的页面 — re-render 触发 ref 回调时跳过，防止 ctx/transform 被覆盖
  const mountedPages  = React.useRef<Set<string>>(new Set())
  const drawDrawing    = React.useRef(false)
  const drawPoints     = React.useRef<{ x: number; y: number; t: number; pressure: number }[]>([])
  const drawLastVel    = React.useRef(0)
  // Snapshot taken at pointerdown — used to overdraw the current stroke each frame
  // so we can redraw the full point array without accumulating gaps between slice(-6) calls.
  const drawStrokeBase = React.useRef<ImageData | null>(null)
  // Per-page undo history
  const drawHistory    = React.useRef<Map<string, ImageData[]>>(new Map())
  const [drawCanUndo, setDrawCanUndo] = React.useState(false)

  // ── 笔刷 rAF 节流（SVG overlay 统一处理，同一时刻只有一页在画）────────────
  const brushRafId      = React.useRef(0)
  const brushPendingPts = React.useRef<{ x: number; y: number; t: number; pressure: number }[]>([])

  // ── Shape gesture state（合并为单一 ref，避免 stale state）────────────────
  const shapeGesture = React.useRef<{
    mode: 'none' | 'drawing' | 'moving'
    origin: { x: number; y: number } | null
    dragStart: { x: number; y: number } | null
    movingId: string | null
    bezierPts: { x: number; y: number }[]
  }>({ mode: 'none', origin: null, dragStart: null, movingId: null, bezierPts: [] })

  // preview shape（draw 模式拖拽绘制中的实时预览）
  const [previewShape, setPreviewShape] = React.useState<DrawnShape | null>(null)

  // 每页的 shapes（单一来源，来自 manager emit）
  const [pageShapesState, setPageShapesState] = React.useState<Map<string, DrawnShape[]>>(new Map())
  const pageShapes = pageShapesState

  // 订阅当前活跃页 manager 的事件
  const activePageIdRef = React.useRef(activePageId)
  activePageIdRef.current = activePageId

  React.useEffect(() => {
    const mgr = getDrawLayerManager(activePageId)
    const handler = (e: import('./DrawLayerManager').LayerManagerEvent) => {
      if (e.type === 'undo-state-changed') setDrawCanUndo(e.canUndo)
      if (e.type === 'shapes-changed') {
        setPageShapesState(prev => new Map(prev).set(activePageId, e.shapes))
      }
    }
    mgr.on(handler)
    // mount() は shapes-changed を emit しないので初期値をここで読む
    setPageShapesState(prev => {
  const next = new Map(prev)
  pages.forEach(page => {
    const initial = getDrawLayerManager(page.id).getShapes()
    if (initial.length > 0) next.set(page.id, [...initial])
  })
  return next
})
    return () => mgr.off(handler)
  }, [activePageId])

  // rightTab tells us whether draw mode is active
  const { rightTab } = s
  const isDrawMode = rightTab === 'draw'

  // 非 draw モードで選択中の shape id（Delete キー用）
  const [selectedNonDrawShapeId, setSelectedNonDrawShapeId] = React.useState<string | null>(null)
  const selectedNonDrawShapeIdRef = React.useRef<string | null>(null)
  selectedNonDrawShapeIdRef.current = selectedNonDrawShapeId

  // Track whether a real drag (>5px movement) happened, to distinguish click from drag
  const didDragRef = React.useRef(false)
  // Stores block origin + mouse coords at dragStart so onDrag can derive absolute
  // position from raw mouse delta, independent of rnd's internal d.x which drifts
  // when snap shifts the controlled position.
  const dragOriginRef = React.useRef<{ bx: number; by: number; mx: number; my: number } | null>(null)

  // The snapped position for the block currently being dragged.
  // Passed directly into Rnd's `position` prop so React — not a hand-crafted
  // DOM transform — owns the visual update. This eliminates the conflict where
  // react-rnd's controlled re-render overwrites our imperative transform.
  // Only the dragging block's Rnd receives a different position; every other
  // block continues to render from its persisted pixelPos, so they never move.
  const [dragSnap, setDragSnap] = React.useState<{ id: string; x: number; y: number } | null>(null)

  // ── Smart Guides ──────────────────────────────────────────────────────────
  const [smartGuidesOn, setSmartGuidesOn] = React.useState<boolean>(() => {
    try { return localStorage.getItem('smartGuides') !== 'false' } catch { return true }
  })
  const toggleSmartGuides = () => setSmartGuidesOn(v => {
    const next = !v
    try { localStorage.setItem('smartGuides', String(next)) } catch {}
    return next
  })
  const [guidesMenuOpen, setGuidesMenuOpen] = React.useState(false)
  const guidesMenuRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!guidesMenuOpen) return
    const h = (e: MouseEvent) => {
      if (guidesMenuRef.current && !guidesMenuRef.current.contains(e.target as Node)) setGuidesMenuOpen(false)
    }
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [guidesMenuOpen])

  type SnapLine = { type: 'h' | 'v'; pos: number; from: number; to: number }
  type SizeHint = { x: number; y: number; w: number; h: number } | null

  // ── Zero-re-render guide lines & size hint ────────────────────────────────
  // We never put these in state — doing so fires a re-render on every onDrag
  // event, which causes react-rnd to re-apply the controlled `position` prop
  // and overwrite the hand-crafted DOM transform we set for snapping.
  // Instead we drive a dedicated SVG element directly via DOM APIs.
  // One SVG ref per page — keyed by page.id in a Map.
  const snapSvgRefs = React.useRef<Map<string, SVGSVGElement>>(new Map())
  const sizeHintRef = React.useRef<SizeHint>(null)
  // Which page is currently being dragged on (for SVG routing + frame z-index lift)
  const draggingPageId = React.useRef<string | null>(null)
  const [draggingPageIdState, setDraggingPageIdState] = React.useState<string | null>(null)

  // Imperatively paint guide lines into the SVG overlay of the active page.
  // Called from onDrag — zero React state updates.
  const paintSnapLines = React.useCallback((lines: SnapLine[], pageId: string) => {
    const svg = snapSvgRefs.current.get(pageId)
    if (!svg) return
    // Remove only guide-line children (leave sizeHint group if present)
    Array.from(svg.querySelectorAll('[data-snap-line]')).forEach(el => el.remove())
    const NS = 'http://www.w3.org/2000/svg'
    lines.forEach(line => {
      const g = document.createElementNS(NS, 'g')
      g.setAttribute('data-snap-line', '1')

      const [x1, y1, x2, y2] = line.type === 'v'
        ? [line.pos, line.from, line.pos, line.to]
        : [line.from, line.pos, line.to, line.pos]

      const ln = document.createElementNS(NS, 'line')
      ln.setAttribute('x1', String(x1)); ln.setAttribute('y1', String(y1))
      ln.setAttribute('x2', String(x2)); ln.setAttribute('y2', String(y2))
      ln.setAttribute('stroke', 'rgba(196,160,68,0.75)')
      ln.setAttribute('stroke-width', '0.75')
      ln.setAttribute('stroke-linecap', 'round')

      g.appendChild(ln)
      svg.appendChild(g)
    })
  }, [])

  const clearSnapLines = React.useCallback((pageId?: string) => {
    const targets = pageId
      ? [snapSvgRefs.current.get(pageId)]
      : Array.from(snapSvgRefs.current.values())
    targets.forEach(svg => {
      if (svg) Array.from(svg.querySelectorAll('[data-snap-line]')).forEach(el => el.remove())
    })
  }, [])

  const paintSizeHint = React.useCallback((hint: SizeHint, pageId: string) => {
    sizeHintRef.current = hint
    const svg = snapSvgRefs.current.get(pageId)
    if (!svg) return
    Array.from(svg.querySelectorAll('[data-size-hint]')).forEach(el => el.remove())
    if (!hint) return
  }, [])

  const clearSizeHint = React.useCallback((pageId?: string) => {
    sizeHintRef.current = null
    const targets = pageId
      ? [snapSvgRefs.current.get(pageId)]
      : Array.from(snapSvgRefs.current.values())
    targets.forEach(svg => {
      if (svg) Array.from(svg.querySelectorAll('[data-size-hint]')).forEach(el => el.remove())
    })
  }, [])

  // stores the snapped position during active drag so onDragStop can commit it
  const snapActiveRef = React.useRef<{ x: number; y: number } | null>(null)

  // SNAP_OUTER: distance at which guide lines appear (visual hint, no position change)
  // SNAP_INNER: distance at which the block actually locks to the target
  // Two-zone design mimics Figma/Sketch feel — guides appear early, snap happens late.
  const SNAP_OUTER = 8
  const SNAP_INNER = 3

  // ── Snap candidate type ──────────────────────────────────────────────────
  // Precomputed once at dragStart; each candidate knows which source block it
  // came from so the guide line can be drawn only between the relevant nodes.
  type SnapCandidate = {
    pos: number
    // bounding extent of the source (used to draw the guide segment)
    srcMin: number   // top for H-lines, left for V-lines
    srcMax: number   // bottom for H-lines, right for V-lines
    isPage: boolean
  }
  type SnapCandidates = { x: SnapCandidate[]; y: SnapCandidate[]; pageId: string }
  const snapCandidatesRef = React.useRef<SnapCandidates>({ x: [], y: [], pageId: '' })

  // Call this in onDragStart to build the candidate list once per drag gesture
  const buildSnapCandidates = React.useCallback((
    draggingId: string,
    pageBlocks: { id: string; pixelPos?: { x: number; y: number; w: number; h: number } | null }[],
    pgW: number, pgH: number | null,
    pageId: string,
  ) => {
    const pH = pgH ?? 800
    const others = pageBlocks.filter(b => b.id !== draggingId && b.pixelPos)

    const xCandidates: SnapCandidate[] = [
      { pos: 0,       srcMin: 0, srcMax: pH, isPage: true },
      { pos: pgW / 2, srcMin: 0, srcMax: pH, isPage: true },
      { pos: pgW,     srcMin: 0, srcMax: pH, isPage: true },
      ...others.flatMap(b => {
        const p = b.pixelPos!
        return [
          { pos: p.x,           srcMin: p.y, srcMax: p.y + p.h, isPage: false },
          { pos: p.x + p.w / 2, srcMin: p.y, srcMax: p.y + p.h, isPage: false },
          { pos: p.x + p.w,     srcMin: p.y, srcMax: p.y + p.h, isPage: false },
        ]
      }),
    ]
    const yCandidates: SnapCandidate[] = [
      { pos: 0,       srcMin: 0, srcMax: pgW, isPage: true },
      { pos: pH / 2,  srcMin: 0, srcMax: pgW, isPage: true },
      { pos: pH,      srcMin: 0, srcMax: pgW, isPage: true },
      ...others.flatMap(b => {
        const p = b.pixelPos!
        return [
          { pos: p.y,           srcMin: p.x, srcMax: p.x + p.w, isPage: false },
          { pos: p.y + p.h / 2, srcMin: p.x, srcMax: p.x + p.w, isPage: false },
          { pos: p.y + p.h,     srcMin: p.x, srcMax: p.x + p.w, isPage: false },
        ]
      }),
    ]
    snapCandidatesRef.current = { x: xCandidates, y: yCandidates, pageId }
  }, [])

  // ── Multi-axis independent snap solver ───────────────────────────────────
  // Each of the 3 dragging-block edges (start/center/end) is tested against
  // all candidates independently. The closest match on each axis wins.
  // Guide lines span only between the dragging block and its matched source.
  const computeSnap = React.useCallback((
    dx: number, dy: number, dw: number, dh: number,
    pageId: string,
  ): { sx: number; sy: number; lines: SnapLine[] } => {
    // Guard: if candidates are from a different page, skip snap entirely
    if (snapCandidatesRef.current.pageId !== pageId) {
      return { sx: dx, sy: dy, lines: [] }
    }
    const { x: xCandidates, y: yCandidates } = snapCandidatesRef.current

    // dragging block's three edges on each axis
    const dxEdges = [
      { v: dx,           adj: 0        },   // left edge
      { v: dx + dw / 2,  adj: -dw / 2  },   // center
      { v: dx + dw,      adj: -dw      },   // right edge
    ]
    const dyEdges = [
      { v: dy,           adj: 0        },
      { v: dy + dh / 2,  adj: -dh / 2  },
      { v: dy + dh,      adj: -dh      },
    ]

    let bestXDelta = SNAP_OUTER + 1
    let bestYDelta = SNAP_OUTER + 1
    let sx = dx, sy = dy
    let bestXCand: SnapCandidate | null = null
    let bestYCand: SnapCandidate | null = null

    for (const cand of xCandidates) {
      for (const { v, adj } of dxEdges) {
        const delta = Math.abs(v - cand.pos)
        if (delta < bestXDelta) {
          bestXDelta = delta
          // Only actually snap position if within inner zone
          sx = delta <= SNAP_INNER ? cand.pos + adj : dx
          bestXCand = cand
        }
      }
    }
    for (const cand of yCandidates) {
      for (const { v, adj } of dyEdges) {
        const delta = Math.abs(v - cand.pos)
        if (delta < bestYDelta) {
          bestYDelta = delta
          sy = delta <= SNAP_INNER ? cand.pos + adj : dy
          bestYCand = cand
        }
      }
    }

    // Guide lines appear in outer zone; snap position only commits in inner zone
    const snappedX = bestXDelta <= SNAP_INNER ? sx : dx
    const snappedY = bestYDelta <= SNAP_INNER ? sy : dy

    const lines: SnapLine[] = []
    if (bestXDelta <= SNAP_OUTER && bestXCand) {
      const dragMin = snappedY
      const dragMax = snappedY + dh
      lines.push({ type: 'v', pos: bestXCand.pos,
        from: Math.min(bestXCand.srcMin, dragMin),
        to:   Math.max(bestXCand.srcMax, dragMax),
      })
    }
    if (bestYDelta <= SNAP_OUTER && bestYCand) {
      const dragMin = snappedX
      const dragMax = snappedX + dw
      lines.push({ type: 'h', pos: bestYCand.pos,
        from: Math.min(bestYCand.srcMin, dragMin),
        to:   Math.max(bestYCand.srcMax, dragMax),
      })
    }

    return {
      sx: bestXDelta <= SNAP_INNER ? sx : dx,
      sy: bestYDelta <= SNAP_INNER ? sy : dy,
      lines,
    }
  }, [])

  type Anchor = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  const PAD = 16
  const anchorStyles: Record<Anchor, React.CSSProperties> = {
    'top-left':      { top: PAD, left: PAD, transform: 'none' },
    'top-center':    { top: PAD, left: '50%', transform: 'translateX(-50%)' },
    'top-right':     { top: PAD, right: PAD, transform: 'none' },
    'bottom-left':   { bottom: PAD, left: PAD, transform: 'none' },
    'bottom-center': { bottom: PAD, left: '50%', transform: 'translateX(-50%)' },
    'bottom-right':  { bottom: PAD, right: PAD, transform: 'none' },
  }
  const posStyle: React.CSSProperties = toolbarDragging && toolbarDragPos
    ? { top: toolbarDragPos.y, left: toolbarDragPos.x, transform: 'none', transition: 'none' }
    : { ...anchorStyles[toolbarAnchor as Anchor], transition: 'top 0.35s cubic-bezier(0.34,1.56,0.64,1), bottom 0.35s cubic-bezier(0.34,1.56,0.64,1), left 0.35s cubic-bezier(0.34,1.56,0.64,1), right 0.35s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }

  // ── Draw canvas: mount + 事件绑定 ──────────────────────────────────────────
  const isDrawModeRef = React.useRef(isDrawMode)
  React.useEffect(() => { isDrawModeRef.current = isDrawMode }, [isDrawMode])

  // canvasZoom ref — event callbacks 闭包里用，不触发 re-mount
  const canvasZoomRef = React.useRef(canvasZoom)
  React.useEffect(() => { canvasZoomRef.current = canvasZoom }, [canvasZoom])

  // ── 笔刷事件已迁移至 SVG overlay 的 onPointer 回调统一处理 ──────────────────
  // canvas 只负责渲染（pointerEvents: none），不再绑定任何事件。

  // ── Draw overlay keyboard shortcuts ──────────────────────────────────────
  React.useEffect(() => {
    if (!isDrawMode) return
    const onKey = (e: KeyboardEvent) => {
      const mgr = getDrawLayerManager(activePageId)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault(); mgr.undo(); return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && mgr.getSelectedShapeId()) {
        e.preventDefault(); mgr.deleteSelectedShape(); return
      }
      if (e.key === 'Escape') {
        mgr.selectShape(null)
        // 取消 bezier 绘制中
        shapeGesture.current = { mode: 'none', origin: null, dragStart: null, movingId: null, bezierPts: [] }
        setPreviewShape(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDrawMode, activePageId])

  // 非 draw モードでも選択 shape を Delete キーで消せる
  React.useEffect(() => {
    if (isDrawMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const id = selectedNonDrawShapeIdRef.current
      if (!id) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      e.preventDefault()
      getDrawLayerManager(activePageId).deleteShape(id)
      setSelectedNonDrawShapeId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isDrawMode, activePageId])


  return (
    <div
      ref={canvasWrapRef}
      style={{
        borderRight: '1px solid rgba(26,26,26,0.08)',
        background: (s as any).canvasBg || '#EBEBF0',
        overflow: 'hidden', position: 'relative',
        cursor: isDrawMode ? 'crosshair' : panningCursor ? 'grabbing' : 'default',
        height: '100%',
        ...((s as any).dotGrid ? {
          backgroundImage: `radial-gradient(circle, ${(s as any).dotColor || '#c8c8c4'} 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0',
          // 배경색과 도트 같이 쓰려면 배경색을 별도 설정
          backgroundColor: (s as any).canvasBg || '#EBEBF0',
        } : {}),
      }}
      onMouseDown={e => {
        if (isDrawMode) return  // draw mode: canvas overlay handles all pointer events
        const target = e.target as HTMLElement
        if (target.closest('.rnd-block') || target.closest('button') || target.closest('input') || target.closest('textarea')) return
        if (e.button !== 0) return
        // sticky 编辑中点空白：先保存内容再 preventDefault（preventDefault 会阻止 blur 触发）
        if (editingBlockId) {
          const ta = document.querySelector('textarea.no-drag') as HTMLTextAreaElement | null
          if (ta) patchBlock(editingBlockId, { content: ta.value })
          setEditingBlockId(null)
        }
        isPanningRef.current = true
        setPanningCursor(true)
        panStart.current = { mx: e.clientX, my: e.clientY, px: canvasPan.x, py: canvasPan.y }
        e.preventDefault()
      }}
      onMouseMove={e => {
        // draw 模式下 canvas overlay 捕获了所有 pointer 事件，panning 不应响应
        if (isDrawMode) return
        if (!isPanningRef.current) return
        const wrap = canvasWrapRef.current
        const W = wrap ? wrap.offsetWidth : 800
        const H = wrap ? wrap.offsetHeight : 600
        const MARGIN = 120
        const nx = panStart.current.px + e.clientX - panStart.current.mx
        const ny = panStart.current.py + e.clientY - panStart.current.my
        setCanvasPan({
          x: Math.min(W - MARGIN, Math.max(-(W * 2), nx)),
          y: Math.min(H - MARGIN, Math.max(-(H * 4), ny)),
        })
      }}
      onMouseUp={() => { isPanningRef.current = false; setPanningCursor(false) }}
      onMouseLeave={() => { isPanningRef.current = false; setPanningCursor(false) }}
    >
      {/* CSS for canvas/blocks */}
      <style>{`
        .rnd-canvas { background: transparent; }
        /* Rnd 内部 wrapper 强制 overflow visible，让删除按钮不被裁剪 */
        .rnd-block {
          border-radius: 4px; overflow: visible !important; will-change: transform;
          transition: filter 0.24s cubic-bezier(0.34,1.2,0.64,1);
        }
        .rnd-block:hover { filter: drop-shadow(0 3px 16px rgba(0,0,0,0.14)); }
        .rnd-block.dragging {
          filter: drop-shadow(0 12px 32px rgba(0,0,0,0.22)) !important;
          transition: filter 0s !important; cursor: grabbing !important; z-index: 999;
        }
        .rnd-block.sticky-shadow-on { /* shadow now via box-shadow on inner div */ }
        .rnd-block-placeholder {
          background: rgba(74,171,111,0.08) !important;
          border: 1.5px dashed rgba(74,171,111,0.4) !important;
          border-radius: 6px; filter: none !important; transition: none !important;
        }
        .rnd-block > div[class*="handle"] { opacity: 0; transition: opacity 0.18s; }
        .rnd-block:hover > div[class*="handle"] { opacity: 1; }
        .rnd-block > div[class*="handle"]::after {
          content: ''; position: absolute; inset: 2px; border-radius: 50%;
          background: #fff; box-shadow: 0 0 0 1.5px rgba(26,26,26,0.4), 0 1px 4px rgba(0,0,0,0.2);
        }
        .img-resize-corner, .img-resize-edge {
          display: block; position: absolute; top: 50%; left: 50%;
          transform: translate(-50%, -50%); opacity: 0;
          transition: opacity 0.15s, transform 0.15s cubic-bezier(0.34,1.5,0.64,1);
          pointer-events: none;
        }
        .rnd-block:hover .img-resize-corner, .rnd-block:hover .img-resize-edge { opacity: 1; }
        .img-resize-corner {
          width: 6px; height: 6px; background: #ffffff;
          border: 1.2px solid rgba(26,26,26,0.45); border-radius: 1px;
          box-shadow: 0 1px 3px rgba(26,26,26,0.12), 0 0 0 0.5px rgba(26,26,26,0.06);
        }
        .rnd-block:hover .img-resize-corner { transform: translate(-50%, -50%) scale(1.15); }
        .img-resize-edge {
          background: #ffffff; border: 1px solid rgba(26,26,26,0.3);
          border-radius: 99px; box-shadow: 0 1px 2px rgba(26,26,26,0.08);
        }
        .img-resize-edge.h { width: 16px; height: 4px; }
        .img-resize-edge.v { width: 4px; height: 16px; }
        .block-card { display: flex; flex-direction: column; background: transparent; overflow: visible; position: relative; height: 100%; cursor: grab; }
        .block-card:active { cursor: grabbing; }
        .block-body { flex: 1; overflow-y: auto; overflow-x: hidden; padding: 0; min-height: 0; height: 100%; }
        .rnd-block { position: absolute !important; }
        .rnd-block:hover > div[class*="handle"] { opacity: 1; }
        .rnd-block > div[class*="handle"] { opacity: 0; transition: opacity 0.15s; }
        .rnd-block.dragging { user-select: none; -webkit-user-select: none; cursor: grabbing !important; }
        .rnd-block.dragging * { user-select: none; -webkit-user-select: none; pointer-events: none; }
        .rnd-block input, .rnd-block textarea { user-select: text; -webkit-user-select: text; }
        .style-popup {
          position: fixed; z-index: 300; background: rgba(22,22,22,0.92);
          backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
          border-radius: 12px; padding: 14px 16px;
          box-shadow: 0 12px 40px rgba(0,0,0,0.35); min-width: 220px;
          color: #eee; font-family: 'Inter', 'DM Sans', sans-serif;
        }
        .style-popup .sp-label { font-size: 0.55rem; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.4); margin-bottom: 7px; font-weight: 600; }
        .style-popup .sp-section { margin-bottom: 12px; }
        .style-popup .sp-section:last-child { margin-bottom: 0; }
        .style-popup .sp-row { display: flex; align-items: center; gap: 8px; }
        .style-popup .sp-size-btn { background: rgba(255,255,255,0.1); border: none; color: #ddd; cursor: pointer; width: 28px; height: 28px; border-radius: 7px; font-size: 0.78rem; font-family: 'Space Mono', monospace; display: flex; align-items: center; justify-content: center; transition: background 0.1s; }
        .style-popup .sp-size-btn:hover { background: rgba(255,255,255,0.2); }
        .style-popup .sp-size-val { font-size: 0.68rem; color: rgba(255,255,255,0.6); font-family: 'Space Mono', monospace; min-width: 32px; text-align: center; }
        .style-popup .sp-font-btn { padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 0.72rem; transition: all 0.1s; white-space: nowrap; }
        .style-popup .sp-font-btn:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
        .style-popup .sp-font-btn.active { border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.12); color: #fff; }
        .style-popup .sp-colors { display: flex; flex-wrap: wrap; gap: 5px; }
        .style-popup .sp-color { width: 22px; height: 22px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; transition: border-color 0.1s, transform 0.1s; padding: 0; background: none; }
        .style-popup .sp-color:hover { transform: scale(1.15); }
        .style-popup .sp-color.active { border-color: rgba(255,255,255,0.8); }
        @keyframes bgRemoveSpin { to { transform: rotate(360deg) } }
      `}</style>

      {/* ── Floating toolbar ── */}
      <div
        ref={toolbarRef}
        style={{
          position: 'absolute', zIndex: 30,
          display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(255,255,255,0.6)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '14px', padding: '6px 14px',
          boxShadow: toolbarDragging
            ? '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.10)'
            : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)',
          border: '1px solid rgba(255,255,255,0.8)',
          cursor: toolbarDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          ...posStyle,
        }}
        onMouseDown={e => {
          e.stopPropagation()
          if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('span[data-zoom]') || (e.target as HTMLElement).closest('select')) return
          e.preventDefault()
          const rect     = toolbarRef.current!.getBoundingClientRect()
          const wrapRect = canvasWrapRef.current!.getBoundingClientRect()
          toolbarDragStart.current = { mx: e.clientX, my: e.clientY, ex: rect.left - wrapRect.left, ey: rect.top - wrapRect.top }
          setToolbarDragging(true)
          setToolbarDragPos({ x: rect.left - wrapRect.left, y: rect.top - wrapRect.top })
          const onMove = (me: MouseEvent) => {
            if (!toolbarDragStart.current) return
            setToolbarDragPos({ x: toolbarDragStart.current.ex + me.clientX - toolbarDragStart.current.mx, y: toolbarDragStart.current.ey + me.clientY - toolbarDragStart.current.my })
          }
          const onUp = (me: MouseEvent) => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
            setToolbarDragging(false)
            setToolbarDragPos(null)
            if (!toolbarDragStart.current || !canvasWrapRef.current || !toolbarRef.current) return
            const wRect = canvasWrapRef.current.getBoundingClientRect()
            const tRect = toolbarRef.current.getBoundingClientRect()
            const cx = (tRect.left - wRect.left) + tRect.width / 2
            const cy = (tRect.top  - wRect.top)  + tRect.height / 2
            const W = wRect.width, H = wRect.height
            const isBottom = cy > H / 2; const isLeft = cx < W / 3; const isRight = cx > W * 2 / 3
            const col = isLeft ? 'left' : isRight ? 'right' : 'center'
            const row = isBottom ? 'bottom' : 'top'
            setToolbarAnchor(`${row}-${col}` as Anchor)
            toolbarDragStart.current = null
          }
          window.addEventListener('mousemove', onMove)
          window.addEventListener('mouseup', onUp)
        }}
      >
        <span style={{ fontSize: '0.58rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#c8c8c4', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, pointerEvents: 'none' }}>Canvas</span>
        <div style={{ width: '1px', height: '12px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <button onClick={() => setCanvasZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>−</button>
          <span data-zoom onClick={() => { setCanvasZoom(1); setCanvasPan({ x: 0, y: 0 }) }}
            style={{ fontSize: '0.65rem', color: '#aaa', fontFamily: 'Space Mono, monospace', minWidth: '34px', textAlign: 'center', cursor: 'pointer', letterSpacing: '0.04em' }}>
            {Math.round(canvasZoom * 100)}%
          </span>
          <button onClick={() => setCanvasZoom(z => Math.min(3, +(z + 0.1).toFixed(1)))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '1rem', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', transition: 'background 0.12s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>+</button>
        </div>
        <div style={{ width: '1px', height: '12px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
        {/* Aspect quick-change */}
        <select
          value={activePage?.aspect ?? 'free'}
          onChange={e => activePage && s.changePageAspect(activePage.id, e.target.value as Aspect)}
          style={{ fontSize: '0.65rem', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '6px', background: 'rgba(255,255,255,0.7)', color: '#888', fontFamily: 'Space Mono, monospace', padding: '3px 6px', cursor: 'pointer', outline: 'none' }}
        >
          {(['free', '16:9', 'A4', '1:1', '4:3'] as Aspect[]).map(a => (
            <option key={a} value={a}>{aspectLabel(a)}</option>
          ))}
        </select>
        <div style={{ width: '1px', height: '12px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
        {/* ── Smart Guides toggle ── */}
        <div style={{ position: 'relative' }} ref={guidesMenuRef}>
          <button
            onClick={e => { e.stopPropagation(); setGuidesMenuOpen(v => !v) }}
            title={isZh ? '智能辅助线' : 'Smart Guides'}
            style={{ background: smartGuidesOn ? 'rgba(74,171,111,0.13)' : 'none', border: smartGuidesOn ? '1px solid rgba(74,171,111,0.4)' : '1px solid transparent', borderRadius: '6px', cursor: 'pointer', color: smartGuidesOn ? '#4aab6f' : '#bbb', width: '26px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', transition: 'all 0.15s' }}
            onMouseEnter={e => { if (!smartGuidesOn) (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => { if (!smartGuidesOn) (e.currentTarget as HTMLElement).style.background = 'none' }}
          >⊹</button>
          {guidesMenuOpen && (
            <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 999, background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 12px 40px rgba(0,0,0,0.32)', minWidth: '210px', fontFamily: 'Inter, DM Sans, sans-serif', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: '0.52rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: '10px', fontWeight: 600 }}>{isZh ? '辅助线' : 'Guides'}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px' }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#eee', fontWeight: 500 }}>{isZh ? '智能辅助线' : 'Smart Guides'}</div>
                  <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.32)', marginTop: '2px' }}>{isZh ? '拖拽磁吸对齐 · PS 级吸附' : 'Magnetic snap · PS-style'}</div>
                </div>
                <div onClick={toggleSmartGuides} style={{ width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0, background: smartGuidesOn ? '#4aab6f' : 'rgba(255,255,255,0.15)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: '3px', left: smartGuidesOn ? '19px' : '3px', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                </div>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '10px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: smartGuidesOn ? '#4aab6f' : 'rgba(255,255,255,0.18)', transition: 'background 0.2s' }} />
                <span style={{ fontSize: '0.6rem', color: smartGuidesOn ? 'rgba(74,171,111,0.85)' : 'rgba(255,255,255,0.28)', fontFamily: 'Space Mono, monospace', transition: 'color 0.2s' }}>
                  {smartGuidesOn ? (isZh ? '已开启 · 跨会话保留' : 'ON · persists across sessions') : (isZh ? '已关闭' : 'OFF')}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Draw mode banner ── */}
      {isDrawMode && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          zIndex: 40, display: 'flex', alignItems: 'center', gap: '10px',
          background: 'rgba(26,26,26,0.88)', backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)', borderRadius: '12px',
          padding: '7px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontFamily: 'Inter, DM Sans, sans-serif',
          pointerEvents: 'all',
        }}>
          <span style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(196,160,68,0.9)', fontWeight: 600 }}>
            ✏ {isZh ? '绘画模式' : 'Draw Mode'}
          </span>
          <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => {
              const mgr = getDrawLayerManager(activePageId)
              mgr.undo()
              setDrawCanUndo(mgr.getLayers().some(l => true)) // 简单重置，manager 会 emit 事件
            }}
            disabled={!drawCanUndo}
            style={{ background: 'none', border: 'none', cursor: drawCanUndo ? 'pointer' : 'default', color: drawCanUndo ? '#ccc' : 'rgba(255,255,255,0.2)', fontSize: '0.68rem', fontFamily: 'Space Mono, monospace', padding: '2px 6px', borderRadius: '5px', transition: 'all 0.1s' }}
          >↩ {isZh ? '撤销' : 'Undo'}</button>
          <button
            onClick={() => {
              getDrawLayerManager(activePageId).clearActiveLayer()
              setDrawCanUndo(true)
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: '0.68rem', fontFamily: 'Space Mono, monospace', padding: '2px 6px', borderRadius: '5px', transition: 'all 0.1s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e05c5c')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
          >{isZh ? '清空' : 'Clear'}</button>
          <div style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.12)' }} />
          <button
            onClick={() => {
              // 把所有可见图层合成后导出为 image block
              const canvas = drawCanvasRefs.current.get(activePageId)
              if (!canvas) return
              const mgr = getDrawLayerManager(activePageId)
              mgr.composite()
              const dataUrl = canvas.toDataURL('image/png')
              addImageBlock(dataUrl)
              // 清空所有图层
              mgr.getLayers().forEach(l => {
                l.canvas.getContext('2d')!.clearRect(0, 0, l.canvas.width, l.canvas.height)
              })
              mgr.composite()
              setDrawCanUndo(false)
            }}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer', color: '#eee', fontSize: '0.65rem', fontFamily: 'Inter, DM Sans, sans-serif', padding: '4px 10px', borderRadius: '7px', transition: 'all 0.1s', letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          >{isZh ? '转为图层 →' : 'Flatten to Block →'}</button>
        </div>
      )}

      {/* ── Multi-page canvas ── */}
      <div
        style={{ padding: '24px 20px', position: 'absolute', inset: 0, userSelect: 'none', WebkitUserSelect: 'none', overflowY: 'auto', overflowX: 'hidden' }}
        onContextMenu={e => {
          const target = e.target as HTMLElement
          if (target.closest('.rnd-block')) return
          e.preventDefault()
          const frameEl = (e.target as HTMLElement).closest('.page-canvas-frame') as HTMLElement | null
          if (!frameEl) return
          const rect = frameEl.getBoundingClientRect()
          const pxX  = Math.round((e.clientX - rect.left) / canvasZoom)
          const pxY  = Math.round((e.clientY - rect.top)  / canvasZoom)
          setCtxMenu({ x: e.clientX, y: e.clientY, gridX: pxX, gridY: pxY })
        }}
        onClick={() => setCtxMenu(null)}
      >
        {justRestored && <DraftBanner pageCount={pages.length} isZh={isZh} onClear={clearAll} />}

        {/* Right-click context menu */}
        {ctxMenu && (
          <div
            style={{ position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 999, background: '#fff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)', padding: '6px', minWidth: '180px', fontFamily: 'Inter, DM Sans, sans-serif', animation: 'fadeIn 0.12s ease' }}
            onClick={e => e.stopPropagation()}
            onContextMenu={e => e.preventDefault()}
          >
            {ctxMenu.blockId ? (
              (() => {
                const bid    = ctxMenu.blockId
                const bTarget = activePage?.blocks.find(b => b.id === bid)
                const menuBtn = (icon: string, label: string, sub: string, onClick: () => void, danger?: boolean) => (
                  <button
                    onClick={() => { onClick(); setCtxMenu(null) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: '7px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(220,80,80,0.07)' : 'rgba(26,26,26,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '0.88rem', width: '20px', textAlign: 'center', color: danger ? '#e05c5c' : '#888', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: danger ? '#c04040' : '#1a1a1a', fontWeight: 500 }}>{label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '1px' }}>{sub}</div>
                    </div>
                  </button>
                )
                return (
                  <>
                    <div style={{ padding: '4px 10px 8px', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4c4c0', fontWeight: 600 }}>
                      {bTarget ? bTarget.type : (isZh ? '块操作' : 'Block')}
                    </div>
                    {bTarget && bTarget.type === 'image' && (
                      <>
                        {menuBtn('🔄', isZh ? '替换图片' : 'Replace image', isZh ? '从本地选择' : 'Choose from device', () => {
                          const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
                          inp.onchange = () => {
                            const f = inp.files?.[0]; if (!f) return
                            const reader = new FileReader()
                            reader.onload = () => {
                              compressImage(reader.result as string).then(compressed => {
                                const imgEl = new window.Image()
                                imgEl.onload = () => {
                                  const ratio = imgEl.naturalHeight / imgEl.naturalWidth
                                  const curW  = bTarget.pixelPos?.w ?? contentWidth
                                  patchBlock(bid!, { content: compressed, pixelPos: bTarget.pixelPos ? { ...bTarget.pixelPos, h: Math.round(curW * ratio) } : bTarget.pixelPos })
                                }
                                imgEl.src = compressed
                              })
                            }
                            reader.readAsDataURL(f)
                          }
                          inp.click()
                        })}
                        {menuBtn('🖼', isZh ? '编辑图片' : 'Edit image', isZh ? '裁剪 / 滤镜' : 'Crop / filters', () => {
                          setImageEditorUrl(bTarget.content); setImageEditorIdx(-1);
                          (window as any).__editingBlockId = bid; (window as any).__editingImageIdx = null
                        })}
                        {menuBtn('⊡', isZh ? '适应原始比例' : 'Fit original ratio', '', () => {
                          const imgEl = new window.Image()
                          imgEl.onload = () => {
                            const ratio = imgEl.naturalHeight / imgEl.naturalWidth
                            const curW  = bTarget.pixelPos?.w ?? contentWidth
                            patchBlock(bid!, { pixelPos: bTarget.pixelPos ? { ...bTarget.pixelPos, h: Math.round(curW * ratio) } : bTarget.pixelPos })
                          }
                          imgEl.src = bTarget.content
                        })}
                        {menuBtn('✂', isZh ? '智能抠图' : 'Remove background', isZh ? 'AI 去除背景' : 'AI-powered', () => { removeBackground(bid!, bTarget.content) })}
                        <div style={{ height: '1px', background: 'rgba(26,26,26,0.07)', margin: '4px 0' }} />
                      </>
                    )}
                    {bTarget && TEXT_BLOCK_TYPES.includes(bTarget.type) && (
                      <>
                        {menuBtn('✎', isZh ? '编辑内容' : 'Edit content', isZh ? '双击也可以' : 'Or double-click', () => { startEdit(bTarget) })}
                        <div style={{ height: '1px', background: 'rgba(26,26,26,0.07)', margin: '4px 0' }} />
                      </>
                    )}
                    {menuBtn('⎘', isZh ? '复制块' : 'Duplicate', isZh ? '⌘D' : '⌘D', () => {
                      updatePageBlocks(activePageId, prev => {
                        const src = prev.find(b => b.id === bid)
                        if (!src) return prev
                        const clone = { ...src, id: generateId(), pixelPos: src.pixelPos ? { ...src.pixelPos, x: src.pixelPos.x + 20, y: src.pixelPos.y + 20 } : src.pixelPos }
                        setSelectedBlockId(clone.id)
                        return [...prev, clone]
                      })
                    })}
                    <div style={{ height: '1px', background: 'rgba(26,26,26,0.07)', margin: '4px 0' }} />
                    {menuBtn('↑', isZh ? '上移一层' : 'Bring forward', '⌘]', () => {
                      updatePageBlocks(activePageId, prev => {
                        const idx = prev.findIndex(b => b.id === bid)
                        if (idx === -1 || idx === prev.length - 1) return prev
                        const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr
                      })
                    })}
                    {menuBtn('⇑', isZh ? '置顶' : 'Bring to front', '', () => {
                      updatePageBlocks(activePageId, prev => {
                        const idx = prev.findIndex(b => b.id === bid)
                        if (idx === -1) return prev
                        const arr = [...prev]; const [item] = arr.splice(idx, 1); arr.push(item); return arr
                      })
                    })}
                    {menuBtn('↓', isZh ? '下移一层' : 'Send backward', '⌘[', () => {
                      updatePageBlocks(activePageId, prev => {
                        const idx = prev.findIndex(b => b.id === bid)
                        if (idx <= 0) return prev
                        const arr = [...prev]; [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; return arr
                      })
                    })}
                    {menuBtn('⇓', isZh ? '置底' : 'Send to back', '', () => {
                      updatePageBlocks(activePageId, prev => {
                        const idx = prev.findIndex(b => b.id === bid)
                        if (idx <= 0) return prev
                        const arr = [...prev]; const [item] = arr.splice(idx, 1); arr.unshift(item); return arr
                      })
                    })}
                    <div style={{ height: '1px', background: 'rgba(26,26,26,0.07)', margin: '4px 0' }} />
                    {menuBtn('✕', isZh ? '删除' : 'Delete', isZh ? 'Delete键' : 'Delete key', () => {
                      updatePageBlocks(activePageId, prev => prev.filter(b => b.id !== bid))
                      setSelectedBlockId(null)
                    }, true)}
                  </>
                )
              })()
            ) : (
              <>
                <div style={{ padding: '4px 10px 8px', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4c4c0', fontWeight: 600 }}>
                  {isZh ? '插入块' : 'Insert Block'}
                </div>
                {[
                  { type: 'title'     as const, icon: '✦', label: isZh ? '标题块' : 'Title',     sub: isZh ? '大标题' : 'Heading' },
                  { type: 'note'      as const, icon: '✎', label: isZh ? '文字块' : 'Text',      sub: isZh ? '段落文字' : 'Paragraph' },
                  { type: 'custom'    as const, icon: '⊞', label: isZh ? '自定义块' : 'Custom',  sub: isZh ? '自由编辑' : 'Free text' },
                  { type: 'milestone' as const, icon: '◎', label: isZh ? '进度块' : 'Milestone', sub: isZh ? '时间线' : 'Timeline' },
                ].map(item => (
                  <button key={item.type}
                    onClick={() => {
                      addBlockAt(item.type, item.type === 'title' ? (isZh ? '新标题' : 'New Title') : item.type === 'milestone' ? '' : (isZh ? '在此输入内容…' : 'Type something…'), ctxMenu.gridX, ctxMenu.gridY)
                      setCtxMenu(null)
                    }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: '7px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', color: '#888', flexShrink: 0 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 500 }}>{item.label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '1px' }}>{item.sub}</div>
                    </div>
                  </button>
                ))}
                <div style={{ height: '1px', background: 'rgba(26,26,26,0.07)', margin: '4px 0' }} />
                <button
                  onClick={() => ctxImageInputRef.current?.click()}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: '7px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', color: '#888', flexShrink: 0 }}>🖼</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 500 }}>{isZh ? '插入图片' : 'Image'}</div>
                    <div style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '1px' }}>{isZh ? '从本地上传' : 'Upload from device'}</div>
                  </div>
                </button>
              </>
            )}
          </div>
        )}

        <input ref={ctxImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file || !ctxMenu) return
            const reader = new FileReader()
            reader.onload = ev => {
              const dataUrl = ev.target?.result as string
              if (dataUrl) compressImage(dataUrl).then(compressed => {
                addImageBlock(compressed, ctxMenu.gridX, ctxMenu.gridY)
                addToMediaLibrary(compressed)
              })
            }
            reader.readAsDataURL(file)
            setCtxMenu(null)
            e.target.value = ''
          }}
        />

        {/* ── Zoom + pan layers ── */}
        {/* 画布固定 860px，用 scale 适配屏幕，坐标系与导出完全一致 */}
       <div style={{ transformOrigin: 'left top', transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`, willChange: 'transform', transition: isPanningRef.current ? 'none' : 'transform 0.65s cubic-bezier(0.16,1,0.3,1)', width: '860px' }}>
<div style={{ paddingTop: 24 }}>
          {/* ── Render every page ── */}
          {pages.map((page, pageIdx) => {
            const isActivePg = page.id === activePageId
            const pgHeight   = pageHeight(page.aspect, contentWidth)
            const pgBlocks   = page.blocks

            return (
              <div key={page.id} style={{ marginBottom: 48 }}>
                {/* Page label strip */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => { setActivePageId(page.id); setEditingBlockId(null); setSelectedBlockId(null); setFontPickerOpen(false); setColorPickerOpen(false) }}
                >
                  <span style={{ fontSize: '0.58rem', letterSpacing: '0.14em', fontFamily: 'Space Mono, monospace', color: page.isCover ? '#c4a044' : (isActivePg ? '#1a1a1a' : '#bbb'), background: page.isCover ? 'rgba(196,160,68,0.12)' : (isActivePg ? 'rgba(26,26,26,0.08)' : 'transparent'), padding: '2px 7px', borderRadius: '4px', transition: 'all 0.15s', fontWeight: isActivePg ? 600 : 400 }}>
                    {page.isCover ? (isZh ? '★ 封面' : '★ Cover') : `${pageIdx} · ${page.label}`}
                  </span>
                  <span style={{ fontSize: '0.56rem', letterSpacing: '0.1em', fontFamily: 'Space Mono, monospace', color: '#ccc' }}>
                    {aspectLabel(page.aspect)}{pgHeight ? ` · ${contentWidth}×${pgHeight}` : ' · scroll'}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: isActivePg ? 'rgba(26,26,26,0.15)' : 'rgba(26,26,26,0.07)' }} />
                  <span style={{ fontSize: '0.56rem', color: '#ccc', fontFamily: 'Space Mono, monospace' }}>{pgBlocks.length} blk</span>
                </div>

                {/* Page frame */}
                <div
                  className="page-canvas-frame"
                  data-page-id={page.id}
                  data-active={isActivePg ? 'true' : undefined}
                  onClick={(e) => {
                    const t = e.target as HTMLElement
                    if (t.closest?.('.rnd-block') || t.closest?.('[contenteditable="true"]') || t.closest?.('.inline-editing') || t.closest?.('.no-drag')) return
                    if ((e.nativeEvent as any).__shapeSelected) { delete (e.nativeEvent as any).__shapeSelected; return }
                    setActivePageId(page.id); setEditingBlockId(null); setSelectedBlockId(null); setFontPickerOpen(false); setColorPickerOpen(false)
                    ;(s as any).setSelectedEmojiId?.(null)
                    setSelectedNonDrawShapeId(null)
                  }}
                  onDragOver={e => {
                    const hasImage = Array.from(e.dataTransfer.items).some(item =>
                      item.kind === 'file' ? item.type.startsWith('image/') : item.type === 'text/plain'
                    )
                    if (!hasImage) return
                    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
                    setDragOverPageId(page.id); setActivePageId(page.id)
                  }}
                  onDragLeave={e => {
                    if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) setDragOverPageId(null)
                  }}
                  onDrop={e => {
                    e.preventDefault(); setDragOverPageId(null)
                    const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect()
                    const dropX = Math.round((e.clientX - rect.left) / canvasZoom)
                    const dropY = Math.round((e.clientY - rect.top)  / canvasZoom)
                    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
                    if (files.length > 0) {
                      files.forEach((file, fi) => {
                        const reader = new FileReader()
                        reader.onload = ev => {
                          const dataUrl = ev.target?.result as string
                          if (!dataUrl) return
                          compressImage(dataUrl).then(compressed => {
                            addImageBlock(compressed, dropX + fi * 20, dropY + fi * 20)
                            addToMediaLibrary(compressed)
                          })
                        }
                        reader.readAsDataURL(file)
                      })
                      return
                    }
                    const url = e.dataTransfer.getData('text/plain')
                    if (url && url.startsWith('data:image')) addImageBlock(url, dropX, dropY)
                  }}
                  style={{
                    position: 'relative', width: 860, margin: '0 auto',
                    // When a block on this page is being dragged, lift the entire frame above
                    // other pages so the block can visually cross page boundaries without being
                    // occluded by a sibling page's background (which is a later DOM node).
                    zIndex: draggingPageIdState === page.id ? 10 : 'auto',
                    ...(pgHeight ? { minHeight: pgHeight } : { minHeight: 400 }),
                    background: page.background || '#fff',
                    ...(page.backgroundImage ? { backgroundImage: `url(${page.backgroundImage})`, backgroundSize: page.bgSize || 'cover', backgroundPosition: page.bgPosition || 'center', backgroundRepeat: 'no-repeat' } : {}),
                    borderRadius: '6px',
                    boxShadow: dragOverPageId === page.id
                      ? '0 0 0 2.5px #4a8abf, 0 8px 32px rgba(74,138,191,0.18)'
                      : isActivePg
                        ? page.isCover ? '0 0 0 2.5px #c4a044, 0 8px 32px rgba(196,160,68,0.15)' : '0 0 0 2.5px #1a1a1a, 0 8px 32px rgba(0,0,0,0.12)'
                        : '0 2px 12px rgba(0,0,0,0.07)',
                    transition: 'box-shadow 0.18s',
                  }}
                >
                  {/* Drop overlay */}
                  {dragOverPageId === page.id && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 50, borderRadius: '6px', background: 'rgba(74,138,191,0.08)', border: '2px dashed rgba(74,138,191,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '0.72rem', color: '#4a8abf', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.1em', fontWeight: 500 }}>{isZh ? '松开以插入图片' : 'DROP TO INSERT'}</span>
                    </div>
                  )}
                  {/* Empty state */}
                  {pgBlocks.length === 0 && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none', zIndex: 1 }}>
                      <p style={{ color: '#d8d8d4', fontSize: '0.72rem', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.1em' }}>
                        {page.isCover ? (isZh ? '从右侧选择封面模版' : 'PICK A COVER TEMPLATE') : (isZh ? '右键插入内容块' : 'RIGHT-CLICK TO INSERT')}
                      </p>
                    </div>
                  )}

                  {/* ── Shapes SVG Layer（draw/非draw 模式统一渲染）────────────────────
                      shapes 始终用 SVG 渲染，永远不在 canvas composite 里画。
                      draw 模式下：此 SVG 接受 pointer 事件（绘制/移动/选中）
                      非 draw 模式下：shapes 通过 Rnd 包裹，可自由拖动/缩放
                  ── */}
                  {isDrawMode ? (
                    // ── Draw 模式：SVG overlay 统一接管笔刷 + 图形的全部 pointer 事件 ──
                    // canvas 永远 pointerEvents:none，事件入口唯一，无争抢问题。
                    <svg
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        zIndex: 960, overflow: 'visible',
                        cursor: sharedDrawState.shapeType ? 'crosshair'
                          : sharedDrawState.brushType === 'eraser' ? 'cell' : 'crosshair',
                        touchAction: 'none',
                      }}
                      onPointerDown={e => {
                        if (e.pointerType === 'mouse' && e.button !== 0) return
                        if (e.pointerType === 'touch' && !e.isPrimary) return
                        e.preventDefault(); e.stopPropagation()
                        ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)

                        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
                        const x = (e.clientX - rect.left) / canvasZoom
                        const y = (e.clientY - rect.top)  / canvasZoom

                        // ── 笔刷模式 ──────────────────────────────────────────
                        if (!sharedDrawState.shapeType) {
                          const mgr = getDrawLayerManager(page.id)
                          const pt = { x, y, pressure: e.pointerType === 'pen' ? Math.max(0.1, e.pressure) : 0.5, t: Date.now() }
                          drawDrawing.current = true
                          brushPendingPts.current = []
                          mgr.startStroke(pt)
                          setDrawCanUndo(true)
                          return
                        }

                        // ── 图形模式 ──────────────────────────────────────────
                        const mgr = getDrawLayerManager(page.id)
                        const g   = shapeGesture.current

                        const hit = mgr.hitTestShape(x, y)
                        if (hit) {
                          if (hit.id === mgr.getSelectedShapeId()) {
                            g.mode = 'moving'; g.dragStart = { x, y }; g.movingId = hit.id
                          } else {
                            mgr.selectShape(hit.id)
                          }
                          return
                        }
                        mgr.selectShape(null)

                        if (sharedDrawState.shapeType === 'bezier') {
                          if (e.detail === 2) {
                            if (g.bezierPts.length >= 2) {
                              const { color, alpha, shapeFill, shapeStroke, shapeSides } = sharedDrawState
                              mgr.addShape({ id: crypto.randomUUID(), shapeType: 'bezier', x0: 0, y0: 0, x1: 0, y1: 0, bezierPts: [...g.bezierPts], color, alpha, shapeFill, shapeStroke, shapeSides })
                            }
                            g.bezierPts = []; setPreviewShape(null); return
                          }
                          g.bezierPts.push({ x, y })
                          const { color, alpha, shapeFill, shapeStroke, shapeSides } = sharedDrawState
                          setPreviewShape({ id: '__preview__', shapeType: 'bezier', x0: 0, y0: 0, x1: 0, y1: 0, bezierPts: [...g.bezierPts], color, alpha, shapeFill, shapeStroke, shapeSides })
                          return
                        }
                        g.mode = 'drawing'; g.origin = { x, y }
                      }}
                      onPointerMove={e => {
                        if (e.pointerType === 'touch' && !e.isPrimary) return
                        e.preventDefault(); e.stopPropagation()

                        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
                        const x = (e.clientX - rect.left) / canvasZoom
                        const y = (e.clientY - rect.top)  / canvasZoom

                        // ── 笔刷模式 ──────────────────────────────────────────
                        if (!sharedDrawState.shapeType) {
                          if (!drawDrawing.current) return
                          const evts: PointerEvent[] = typeof (e.nativeEvent as any).getCoalescedEvents === 'function'
                            ? (e.nativeEvent as any).getCoalescedEvents() : [e.nativeEvent]
                          const newPts = evts.map((re: PointerEvent) => {
                            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
                            return {
                              x: (re.clientX - r.left) / canvasZoom,
                              y: (re.clientY - r.top)  / canvasZoom,
                              pressure: re.pointerType === 'pen' ? Math.max(0.1, re.pressure) : 0.5,
                              t: Date.now(),
                            }
                          })
                          brushPendingPts.current.push(...newPts)
                          if (!brushRafId.current) {
                            brushRafId.current = requestAnimationFrame(() => {
                              brushRafId.current = 0
                              const pts = brushPendingPts.current.splice(0)
                              if (pts.length) getDrawLayerManager(page.id).continueStroke(pts)
                            })
                          }
                          return
                        }

                        // ── 图形模式 ──────────────────────────────────────────
                        const g = shapeGesture.current
                        if (g.mode === 'moving' && g.dragStart && g.movingId) {
                          const dx = x - g.dragStart.x, dy = y - g.dragStart.y
                          const mgr = getDrawLayerManager(page.id)
                          const s = mgr.getShapes().find(sh => sh.id === g.movingId)
                          if (s) setPreviewShape({ ...s, x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy })
                          return
                        }
                        if (g.mode === 'drawing' && g.origin) {
                          let x0 = g.origin.x, y0 = g.origin.y, x1 = x, y1 = y
                          if (e.shiftKey) {
                            const dx = x1-x0, dy = y1-y0, st = sharedDrawState.shapeType
                            if (st === 'line' || st === 'arrow') {
                              const angle = Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4)
                              const len = Math.sqrt(dx*dx+dy*dy)
                              x1 = x0+Math.cos(angle)*len; y1 = y0+Math.sin(angle)*len
                            } else {
                              const side = Math.min(Math.abs(dx),Math.abs(dy))
                              x1 = x0+Math.sign(dx)*side; y1 = y0+Math.sign(dy)*side
                            }
                          }
                          const { color, alpha, shapeFill, shapeStroke, shapeSides, shapeType } = sharedDrawState
                          setPreviewShape({ id: '__preview__', shapeType: shapeType!, x0, y0, x1, y1, color, alpha, shapeFill, shapeStroke, shapeSides })
                        }
                      }}
                      onPointerUp={e => {
                        if (e.pointerType === 'touch' && !e.isPrimary) return
                        e.preventDefault()

                        const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
                        const x = (e.clientX - rect.left) / canvasZoom
                        const y = (e.clientY - rect.top)  / canvasZoom

                        // ── 笔刷模式 ──────────────────────────────────────────
                        if (!sharedDrawState.shapeType) {
                          if (!drawDrawing.current) return
                          cancelAnimationFrame(brushRafId.current); brushRafId.current = 0
                          const pts = brushPendingPts.current.splice(0)
                          const mgr = getDrawLayerManager(page.id)
                          if (pts.length) mgr.continueStroke(pts)
                          drawDrawing.current = false
                          mgr.endStroke()
                          return
                        }

                        // ── 图形模式 ──────────────────────────────────────────
                        const g   = shapeGesture.current
                        const mgr = getDrawLayerManager(page.id)

                        if (g.mode === 'moving' && g.dragStart && g.movingId) {
                          const dx = x - g.dragStart.x, dy = y - g.dragStart.y
                          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
                            const s = mgr.getShapes().find(sh => sh.id === g.movingId)
                            if (s) mgr.patchShape(g.movingId, { x0: s.x0 + dx, y0: s.y0 + dy, x1: s.x1 + dx, y1: s.y1 + dy })
                          }
                          g.mode = 'none'; g.dragStart = null; g.movingId = null
                          setPreviewShape(null); return
                        }

                        if (g.mode === 'drawing' && g.origin) {
                          let x0 = g.origin.x, y0 = g.origin.y, x1 = x, y1 = y
                          g.mode = 'none'; g.origin = null
                          if (e.shiftKey) {
                            const dx = x1-x0, dy = y1-y0, st = sharedDrawState.shapeType
                            if (st === 'line' || st === 'arrow') {
                              const angle = Math.round(Math.atan2(dy,dx)/(Math.PI/4))*(Math.PI/4)
                              const len = Math.sqrt(dx*dx+dy*dy)
                              x1 = x0+Math.cos(angle)*len; y1 = y0+Math.sin(angle)*len
                            } else {
                              const side = Math.min(Math.abs(dx),Math.abs(dy))
                              x1 = x0+Math.sign(dx)*side; y1 = y0+Math.sign(dy)*side
                            }
                          }
                          setPreviewShape(null)
                          if (Math.abs(x1-x0) > 4 || Math.abs(y1-y0) > 4) {
                            const { color, alpha, shapeFill, shapeStroke, shapeSides, shapeType } = sharedDrawState
                            mgr.addShape({ id: crypto.randomUUID(), shapeType: shapeType!, x0, y0, x1, y1, color, alpha, shapeFill, shapeStroke, shapeSides })
                          }
                        }
                      }}
                      onPointerCancel={() => {
                        cancelAnimationFrame(brushRafId.current); brushRafId.current = 0
                        brushPendingPts.current = []
                        if (drawDrawing.current) {
                          drawDrawing.current = false
                          getDrawLayerManager(page.id).endStroke()
                        }
                        shapeGesture.current = { mode: 'none', origin: null, dragStart: null, movingId: null, bezierPts: [] }
                        setPreviewShape(null)
                      }}
                    >
                      {/* 已保存的 shapes */}
                      {(pageShapes.get(page.id) ?? []).map(shape => {
                        const isSel = shape.id === getDrawLayerManager(page.id).getSelectedShapeId()
                        // moving 中：用 previewShape 替代显示
                        const displayShape = (isSel && previewShape && shapeGesture.current.mode === 'moving')
                          ? previewShape : shape
                        return (
                          <DrawModeShapeWrapper
                            key={shape.id}
                            shape={displayShape}
                            isSel={isSel}
                            pageId={page.id}
                            onDelete={() => getDrawLayerManager(page.id).deleteShape(shape.id)}
                          />
                        )
                      })}
                      {/* 绘制中预览（drawing mode）*/}
                      {previewShape && shapeGesture.current.mode === 'drawing' && renderShapeSVG(previewShape, 0.6)}
                      {/* bezier 预览 */}
                      {previewShape && shapeGesture.current.mode === 'none' && previewShape.shapeType === 'bezier' && renderShapeSVG(previewShape, 0.6)}
                    </svg>
                  ) : (
                    // ── 非 draw 模式：tldraw/Excalidraw 风格 SVG 原生 drag ──
                    // 完全不用 react-rnd，pointer 事件在 SVG 内部手写，零坐标系冲突。
                    // 架构：一个全页 SVG overlay，shapes 是其中的 <g> 元素。
                    // drag 中用 React state 驱动 translate，drop 时一次 patchShape 持久化。
                    (() => {
                      const shapes = pageShapes.get(page.id) ?? []
                      if (shapes.length === 0) return null
                      return (
                        <svg
                          key={`shape-overlay-${page.id}`}
                          style={{
                            position: 'absolute', inset: 0,
                            width: '100%', height: '100%',
                            zIndex: 920, overflow: 'visible',
                            pointerEvents: 'none',  // 子要素が個別に制御
                          }}
                          onPointerDown={e => {
                            // SVG 背景クリック → 選択解除
                            if ((e.target as SVGElement).dataset.shapeId === undefined &&
                                !(e.target as SVGElement).closest('[data-shape-id]')) {
                              setSelectedNonDrawShapeId(null)
                            }
                          }}
                        >
                          {shapes.map(shape => {
                            const isSel = selectedNonDrawShapeId === shape.id
                            const PAD   = 10
                            const minX  = Math.min(shape.x0, shape.x1)
                            const minY  = Math.min(shape.y0, shape.y1)
                            const maxX  = Math.max(shape.x0, shape.x1)
                            const maxY  = Math.max(shape.y0, shape.y1)

                            // ── drag state (per-shape ref, no re-render during drag) ──
                            // We use a single module-level ref map keyed by shape id so
                            // pointer callbacks always see current values without stale closure.
                            return (
                              <NonDrawShape
                                key={shape.id}
                                shape={shape}
                                isSel={isSel}
                                PAD={PAD}
                                minX={minX} minY={minY} maxX={maxX} maxY={maxY}
                                canvasZoom={canvasZoom}
                                pageId={page.id}
                                onSelect={() => { setSelectedNonDrawShapeId(shape.id); setSelectedBlockId(null) }}
                                onDeselect={() => setSelectedNonDrawShapeId(null)}
                                onDelete={() => { getDrawLayerManager(page.id).deleteShape(shape.id); setSelectedNonDrawShapeId(null) }}
                              />
                            )
                          })}
                        </svg>
                      )
                    })()
                  )}

                  {/* ── Draw overlay canvas ── */}
                  {/* Always in DOM so ref is stable; pointer-events toggled by draw mode */}
                  <canvas
  ref={el => {
    if (el) {
      drawCanvasRefs.current.set(page.id, el)
      const _dpr = window.devicePixelRatio || 1
      const _pgH = pageHeight(page.aspect, contentWidth)
      const _w   = Math.round(contentWidth * _dpr)
      const _h   = Math.round((_pgH ?? 600) * _dpr)
      const sizeChanged = el.width !== _w || el.height !== _h
      const firstMount  = !mountedPages.current.has(page.id)
      if (firstMount || sizeChanged) {
        // 真正初始化：设置尺寸 + transform + mount
        mountedPages.current.add(page.id)
        if (sizeChanged) { el.width = _w; el.height = _h }
        const _ctx = el.getContext('2d')!
        _ctx.setTransform(1, 0, 0, 1, 0, 0)
        _ctx.scale(_dpr, _dpr)
        getDrawLayerManager(page.id).mount(el, _ctx)
      }
      // re-render 触发（尺寸未变、已初始化）：什么都不做，保护已有 ctx/transform
    } else {
      drawCanvasRefs.current.delete(page.id)
      mountedPages.current.delete(page.id)
    }
  }}
  style={{
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: 950,
    pointerEvents: 'none',
    touchAction: 'none',
    cursor: isDrawMode
      ? (sharedDrawState.brushType === 'eraser' ? 'cell' : 'crosshair')
      : 'default',
    borderRadius: '6px',
  }}
/>

                  {/* ── Smart Guides SVG overlay ── */}
                  {/* Always rendered when smartGuides is on so the ref is always available.
                      Content is written imperatively via paintSnapLines / paintSizeHint —
                      zero React state, zero re-renders during drag. */}
                  {smartGuidesOn && (
                    <svg
                      ref={el => {
                        if (el) snapSvgRefs.current.set(page.id, el)
                        else snapSvgRefs.current.delete(page.id)
                      }}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 900, overflow: 'visible' }}
                    />
                  )}

                  {/* ── Grid System overlay — 仅当前活跃页 ── */}
                  {gridState?.activeType && isActivePg && (() => {
                    const gs = gridState
                    const W = contentWidth
                    const H = pgHeight ?? 600

                    if (gs.activeType === 'column') {
                      const { columns, gutter, margin, color, strokeWidth } = gs.column
                      const available = W - margin * 2 - gutter * (columns - 1)
                      const colW = available / columns
                      const cols = Array.from({ length: columns }, (_, i) => margin + i * (colW + gutter))
                      const lineColor = color.replace(/[\d.]+\)$/, '0.55)')
                      return (
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                          {cols.map((x, i) => (
                            <rect key={i} x={x} y={0} width={colW} height={H} fill={color} />
                          ))}
                          {cols.map((x, i) => (
                            <line key={`l${i}`} x1={x} y1={0} x2={x} y2={H} stroke={lineColor} strokeWidth={strokeWidth} />
                          ))}
                          <line x1={cols[cols.length-1]+colW} y1={0} x2={cols[cols.length-1]+colW} y2={H} stroke={lineColor} strokeWidth={strokeWidth} />
                        </svg>
                      )
                    }

                    if (gs.activeType === 'baseline') {
                      const { lineHeight, color, strokeWidth } = gs.baseline
                      const lines = Array.from({ length: Math.ceil(H / lineHeight) }, (_, i) => i * lineHeight)
                      return (
                        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                          {lines.map(y => (
                            <line key={y} x1={0} y1={y} x2={W} y2={y} stroke={color} strokeWidth={strokeWidth} />
                          ))}
                        </svg>
                      )
                    }

                    if (gs.activeType === 'modular') {
                      const { columns, rows, columnGutter, rowGutter, margin, color, strokeWidth, cellTexts, cellAligns, cellFontSize, cellColor } = gs.modular
                      const offsetX: number = (gs.modular as any).offsetX ?? 0
                      const offsetY: number = (gs.modular as any).offsetY ?? 0
                      const updateModular = (s as any).updateModular as ((p: any) => void) | undefined
                      const updateCell = (s as any).updateModularCell as ((i: number, t: string) => void) | undefined
                      const updateCellAlign = (s as any).updateModularCell as ((i: number, t: string, a: 'left'|'center'|'right') => void) | undefined

                      const cellW = (W - margin * 2 - columnGutter * (columns - 1)) / columns
                      const cellH = (H - margin * 2 - rowGutter * (rows - 1)) / rows
                      const cells = Array.from({ length: rows }, (_, r) =>
                        Array.from({ length: columns }, (_, c) => ({
                          x: offsetX + margin + c * (cellW + columnGutter),
                          y: offsetY + margin + r * (cellH + rowGutter),
                          index: r * columns + c,
                        }))
                      ).flat()
                      const borderColor = color.replace(/[\d.]+\)$/, '0.45)')

                      // 拖动整个网格
                      const gridDragRef = { startX: 0, startY: 0, startOX: 0, startOY: 0, active: false }
                      const onGridMouseDown = (e: React.MouseEvent) => {
                        if ((e.target as HTMLElement).isContentEditable) return
                        if ((e.target as HTMLElement).tagName === 'BUTTON') return
                        e.preventDefault()
                        e.stopPropagation()
                        gridDragRef.active = true
                        gridDragRef.startX = e.clientX
                        gridDragRef.startY = e.clientY
                        gridDragRef.startOX = offsetX
                        gridDragRef.startOY = offsetY
                        const onMove = (ev: MouseEvent) => {
                          if (!gridDragRef.active) return
                          updateModular?.({ offsetX: gridDragRef.startOX + ev.clientX - gridDragRef.startX, offsetY: gridDragRef.startOY + ev.clientY - gridDragRef.startY })
                        }
                        const onUp = () => { gridDragRef.active = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                        window.addEventListener('mousemove', onMove)
                        window.addEventListener('mouseup', onUp)
                      }

                      return (
                        <div
                          style={{ position: 'absolute', inset: 0, zIndex: 5, cursor: gridEditMode ? 'text' : 'grab', pointerEvents: 'auto' }}
                          onMouseDown={onGridMouseDown}
                        >
                          {/* SVG 背景层 */}
                          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            {cells.map(({ x, y }, i) => (
                              <rect key={i} x={x} y={y} width={cellW} height={cellH} fill={color} stroke={borderColor} strokeWidth={strokeWidth} />
                            ))}
                          </svg>
                          {/* HTML 文字层 */}
                          {cells.map(({ x, y, index }) => {
                            const text  = cellTexts?.[index] ?? ''
                            const align = (cellAligns?.[index] ?? 'left') as 'left' | 'center' | 'right'
                            return (
                              <div key={index} style={{ position: 'absolute', left: x, top: y, width: cellW, minHeight: cellH, boxSizing: 'border-box', zIndex: 6 }}>
                                {/* 对齐工具栏 */}
                                {gridEditMode && (
                                  <div className="grid-cell-toolbar" style={{ position: 'absolute', top: -26, left: 0, display: 'none', gap: 2, background: 'rgba(26,26,26,0.82)', borderRadius: 5, padding: '2px 4px', zIndex: 20, pointerEvents: 'auto' }}>
                                    {(['left', 'center', 'right'] as const).map(a => (
                                      <button key={a} onMouseDown={e => { e.preventDefault(); updateCellAlign?.(index, text, a) }}
                                        style={{ width: 20, height: 20, border: 'none', borderRadius: 3, cursor: 'pointer', background: align === a ? 'rgba(255,255,255,0.22)' : 'transparent', color: '#fff', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {a === 'left' ? '←' : a === 'center' ? '↔' : '→'}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div
                                  contentEditable="false"
                                  suppressContentEditableWarning
                                  onFocus={e => {
                                    const el = e.currentTarget as HTMLDivElement
                                    const tb = el.previousSibling as HTMLElement
                                    if (tb) tb.style.display = 'flex'
                                    // 点击格子外部时 blur 退出编辑
                                    const onOutsideClick = (ev: MouseEvent) => {
                                      if (!el.contains(ev.target as Node)) {
                                        el.blur()
                                        document.removeEventListener('mousedown', onOutsideClick, true)
                                      }
                                    }
                                    document.addEventListener('mousedown', onOutsideClick, true)
                                  }}
                                  onBlur={e => { const el = e.target as HTMLDivElement; el.contentEditable = 'false'; el.style.boxShadow = 'none'; el.style.cursor = 'default'; const tb = (e.currentTarget.previousSibling as HTMLElement); if (tb) tb.style.display = 'none'; updateCell?.(index, el.innerText) }}
                                  onDoubleClick={e => { e.stopPropagation(); const el = e.currentTarget as HTMLDivElement; el.contentEditable = 'true'; el.style.boxShadow = 'inset 0 0 0 1px rgba(196,160,68,0.5)'; el.style.cursor = 'text'; el.focus(); const range = document.createRange(); range.selectNodeContents(el); const sel = window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range) }}
                                  onMouseDown={e => { if ((e.currentTarget as HTMLDivElement).contentEditable === 'true') e.stopPropagation() }}
                                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation(); if (e.key === 'Escape') (e.target as HTMLDivElement).blur() }}
                                  ref={el => { if (el && document.activeElement !== el && el.innerText !== text) el.innerText = text }}
                                  style={{ display: 'block', width: '100%', minHeight: cellH, padding: '6px 8px', boxSizing: 'border-box', outline: 'none', fontSize: cellFontSize ?? 13, lineHeight: 1.6, color: cellColor ?? '#1a1a1a', textAlign: align, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'default', background: 'transparent', caretColor: cellColor ?? '#1a1a1a', pointerEvents: 'auto' }}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* ── Rnd blocks ── */}
                  <div className="rnd-canvas" style={{ position: 'relative', width: 860, ...(pgHeight ? { minHeight: pgHeight } : { minHeight: 600 }), pointerEvents: 'auto' }}>
                    {pgBlocks.map((block) => {
                      const pos = block.pixelPos ?? { x: 0, y: 0, w: contentWidth, h: 200 }
                      const stickyBoxShadow = block.type === 'sticky' ? (() => {
                        const sh = (block as any).stickyShadow ?? 12
                        const sp = (block as any).stickySpread ?? 0
                        if (sh === 0 && sp === 0) return null
                        const blur = sh * 2 + sp
                        const opacity = Math.min(0.6, 0.08 + sh * 0.012)
                        return `0px ${Math.round(sh * 0.4)}px ${blur}px rgba(0,0,0,${opacity.toFixed(2)})`
                      })() : null
                      const stickyDropShadow = stickyBoxShadow // keep for className compat
                      return (
                        <Rnd
                          key={block.id}
                          className={`rnd-block${stickyBoxShadow ? ' sticky-shadow-on' : ''}`}
                          style={undefined}
                          size={{ width: pos.w, height: pos.h }}
                          position={
                            dragSnap?.id === block.id
                              ? { x: dragSnap.x, y: dragSnap.y }
                              : { x: pos.x, y: pos.y }
                          }
                          onDragStart={(e, _d) => {
                            didDragRef.current = false
                            const _me = e as unknown as MouseEvent
                            dragOriginRef.current = { bx: pos.x, by: pos.y, mx: _me.clientX, my: _me.clientY }
                            snapActiveRef.current = null
                            draggingPageId.current = page.id
                            setDraggingPageIdState(page.id)
                            if (!isActivePg) { setActivePageId(page.id); setSelectedBlockId(block.id) }
                            if (smartGuidesOn) {
                              buildSnapCandidates(block.id, pgBlocks, contentWidth, pgHeight, page.id)
                            }
                          }}
                          onDrag={(e, _d) => {
                            didDragRef.current = true
                            const _me2 = e as unknown as MouseEvent
                            const origin = dragOriginRef.current
                            const rawX = origin ? origin.bx + (_me2.clientX - origin.mx) / canvasZoom : pos.x
                            const rawY = origin ? origin.by + (_me2.clientY - origin.my) / canvasZoom : pos.y
                            // X and Y are both unclamped — no boundary walls on any side.
                            // Blocks can be dragged freely outside the page frame.
                            // onBlockDragStop handles final position commit.
                            let nx = rawX
                            let ny = rawY
                            // Only snap when the block is clearly within this page's vertical bounds.
                            // If rawY is negative (dragging above page top) or well beyond page bottom,
                            // the user is doing a cross-page move — skip snap so page-edge candidates
                            // don't pull the block back into this page.
                            const pgH = pgHeight ?? 800
                            const isWithinPage = ny > -(pos.h) && ny < pgH + pos.h
                            if (smartGuidesOn && isWithinPage) {
                              const { sx, sy, lines } = computeSnap(nx, ny, pos.w, pos.h, page.id)
                              nx = sx; ny = sy
                              // Paint guide lines directly into SVG — no setState, no re-render
                              paintSnapLines(lines, page.id)
                            } else if (smartGuidesOn) {
                              clearSnapLines(page.id)
                            }
                            snapActiveRef.current = { x: nx, y: ny }
                            // Drive the snapped position through React-controlled Rnd position prop.
                            // This is the only setState in onDrag; it only re-renders this one block's
                            // Rnd (position prop changed) — other blocks' props are unchanged so React
                            // bails out of their subtrees via referential equality.
                            setDragSnap({ id: block.id, x: nx, y: ny })
                          }}
                          onDragStop={(_e, _d) => {
                            clearSnapLines(page.id)
                            clearSizeHint(page.id)
                            draggingPageId.current = null
                            setDraggingPageIdState(null)
                            setDragSnap(null)
                            const blockBelongsHere = page.blocks.some(b => b.id === block.id)
                            if (!blockBelongsHere) return
                            if (!didDragRef.current) {
                              setSelectedBlockId(block.id)
                              setRightTab('blocks')
                              snapActiveRef.current = null
                              return
                            }
                            const final = snapActiveRef.current
                            snapActiveRef.current = null
                            dragOriginRef.current = null
                            if (final) onBlockDragStop(block.id, page.id, final.x, final.y)
                          }}
                          onResize={block.type === 'image' ? (_e, dir, ref) => {
                            const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight']
                            if (corners.includes(dir)) {
                              const ratio = pos.h / pos.w
                              ref.style.height = Math.round(parseInt(ref.style.width) * ratio) + 'px'
                            }
                            if (smartGuidesOn) paintSizeHint({ x: pos.x, y: pos.y, w: parseInt(ref.style.width), h: parseInt(ref.style.height) }, page.id)
                          } : smartGuidesOn ? (_e, _dir, ref) => {
                            paintSizeHint({ x: pos.x, y: pos.y, w: parseInt(ref.style.width), h: parseInt(ref.style.height) }, page.id)
                          } : undefined}
                          onResizeStop={(_e, _dir, ref, _delta, position) => {
                            clearSnapLines(page.id); clearSizeHint(page.id)
                            const blockBelongsHere = page.blocks.some(b => b.id === block.id)
                            if (!blockBelongsHere) return
                            updatePageBlocks(page.id, prev => prev.map(b => b.id === block.id ? { ...b, pixelPos: { x: position.x, y: position.y, w: parseInt(ref.style.width), h: parseInt(ref.style.height) } } : b))
                          }}
                          dragHandleClassName="block-card"
                          cancel=".no-drag"
                          scale={canvasZoom}
                          minWidth={120} minHeight={60}
                          enableResizing={editingBlockId !== block.id}
                          disableDragging={editingBlockId === block.id}
                          lockAspectRatio={false}
                          resizeHandleComponent={block.type === 'image' ? {
                            bottomRight: <span className="img-resize-corner br" />, bottomLeft: <span className="img-resize-corner bl" />,
                            topRight: <span className="img-resize-corner tr" />, topLeft: <span className="img-resize-corner tl" />,
                            bottom: <span className="img-resize-edge h" />, top: <span className="img-resize-edge h" />,
                            right: <span className="img-resize-edge v" />, left: <span className="img-resize-edge v" />,
                          } : undefined}
                          resizeHandleStyles={block.type === 'image' ? {
                            bottomRight: { width: 20, height: 20, right: -10, bottom: -10, cursor: 'se-resize', zIndex: 10 },
                            bottomLeft:  { width: 20, height: 20, left: -10, bottom: -10, cursor: 'sw-resize', zIndex: 10 },
                            topRight:    { width: 20, height: 20, right: -10, top: -10, cursor: 'ne-resize', zIndex: 10 },
                            topLeft:     { width: 20, height: 20, left: -10, top: -10, cursor: 'nw-resize', zIndex: 10 },
                            bottom: { width: 32, height: 12, bottom: -6, left: '50%', marginLeft: -16, cursor: 's-resize', zIndex: 10 },
                            top:    { width: 32, height: 12, top: -6, left: '50%', marginLeft: -16, cursor: 'n-resize', zIndex: 10 },
                            right:  { width: 12, height: 32, right: -6, top: '50%', marginTop: -16, cursor: 'e-resize', zIndex: 10 },
                            left:   { width: 12, height: 32, left: -6, top: '50%', marginTop: -16, cursor: 'w-resize', zIndex: 10 },
                          } : {
                            bottomRight: { width: 16, height: 16, right: -4, bottom: -4, cursor: 'se-resize' },
                            bottomLeft:  { width: 16, height: 16, left: -4, bottom: -4, cursor: 'sw-resize' },
                            topRight:    { width: 16, height: 16, right: -4, top: -4, cursor: 'ne-resize' },
                            topLeft:     { width: 16, height: 16, left: -4, top: -4, cursor: 'nw-resize' },
                            bottom: { height: 10, bottom: -4, cursor: 's-resize' },
                            top:    { height: 10, top: -4, cursor: 'n-resize' },
                            right:  { width: 10, right: -4, cursor: 'e-resize' },
                            left:   { width: 10, left: -4, cursor: 'w-resize' },
                          }}
                        >
                          <div className="block-card" onDragStart={e => e.preventDefault()}
                            onContextMenu={e => {
                              e.preventDefault(); e.stopPropagation()
                              // 右键时顺带激活所在页
                              if (!isActivePg) { setActivePageId(page.id) }
                              setCtxMenu({ x: e.clientX, y: e.clientY, gridX: 0, gridY: 0, blockId: block.id })
                              setSelectedBlockId(block.id)
                              setRightTab('blocks')
                            }}
                            onPointerDown={e => {
                              if (e.button !== 0) return
                              // 点击时激活所在页
                              if (!isActivePg) { setActivePageId(page.id); setEditingBlockId(null); setSelectedBlockId(null) }
                              ;(e.currentTarget as any)._pStart = { x: e.clientX, y: e.clientY }
                            }}
                            onPointerUp={e => {
                              if (e.button !== 0) return
                              const s = (e.currentTarget as any)._pStart
                              if (!s) return
                              ;(e.currentTarget as any)._pStart = null
                              if (Math.abs(e.clientX - s.x) < 5 && Math.abs(e.clientY - s.y) < 5) {
                                setSelectedBlockId(block.id)
                                setRightTab('blocks')
                              }
                            }}
                            onDoubleClick={() => {
                              if (TEXT_BLOCK_TYPES.includes(block.type)) startEdit(block)
                              if (block.type === 'sticky') setEditingBlockId(block.id)
                            }}
                            style={{ width: '100%', height: '100%', opacity: 1, userSelect: editingBlockId === block.id ? 'text' : 'none', outline: 'none' } as React.CSSProperties}
                          >
                            <div className="block-body" style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                              {/* AI background removal overlay */}
                              {removingBgBlockId === block.id && (
                                <div style={{ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)', borderRadius: '8px' }}>
                                  <div style={{ width: '28px', height: '28px', border: '2.5px solid rgba(26,26,26,0.12)', borderTopColor: '#1a1a1a', borderRadius: '50%', animation: 'bgRemoveSpin 0.7s linear infinite' }} />
                                  <span style={{ fontSize: '0.72rem', color: '#888', letterSpacing: '0.08em', fontWeight: 500 }}>{isZh ? 'AI 抠图中…' : 'Removing background…'}</span>
                                </div>
                              )}

                              {/* ── Edit panel (image/image-row) ── */}
                              {editingBlockId === block.id && (block.type === 'image' || block.type === 'image-row') ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', height: '100%', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(16px)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.09)', padding: '12px 14px 14px', boxSizing: 'border-box', overflow: 'hidden' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid rgba(26,26,26,0.07)' }}>
                                    <span style={{ fontSize: '0.55rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 700 }}>
                                      {block.type === 'image' ? (isZh ? '图片设置' : 'Image Settings') : (isZh ? '图片组' : 'Image Row')}
                                    </span>
                                    <div style={{ flex: 1, height: '1px', background: 'rgba(26,26,26,0.06)' }} />
                                  </div>

                                  {/* Single image preview + label */}
                                  {block.type === 'image' && (
                                    <div style={{ marginBottom: '10px' }}>
                                      <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginBottom: '10px', background: '#f0f0ee' }}>
                                        <img src={block.content} alt="" draggable={false} onDragStart={e => e.preventDefault()} style={{ width: '100%', maxHeight: '160px', objectFit: 'cover', display: 'block', userSelect: 'none' } as React.CSSProperties} />
                                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)' }} />
                                        <span style={{ position: 'absolute', bottom: '8px', left: '10px', fontSize: '0.6rem', color: 'rgba(255,255,255,0.8)', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em' }}>{isZh ? '图片预览' : 'preview'}</span>
                                      </div>
                                      <input value={editingImageCaptions[0] || ''} onChange={e => { const updated = [...editingImageCaptions]; updated[0] = e.target.value; setEditingImageCaptions(updated) }}
                                        placeholder={isZh ? '图片名称（可选）…' : 'Image label (optional)…'}
                                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid rgba(26,26,26,0.1)', borderRadius: '7px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#555', outline: 'none', background: 'rgba(247,247,245,0.8)', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
                                        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.3)')}
                                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)')} />
                                      {/* Image style controls in edit panel */}
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                                        <div>
                                          <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '5px' }}>{isZh ? '填充模式' : 'Fit'}</span>
                                          <div style={{ display: 'flex', gap: '5px' }}>
                                            {(['cover', 'contain'] as const).map(fit => (
                                              <button key={fit} onClick={() => patchBlock(block.id, { imgFit: fit })}
                                                style={{ flex: 1, padding: '5px 0', border: `1px solid ${(block.imgFit ?? 'cover') === fit ? 'rgba(26,26,26,0.5)' : 'rgba(26,26,26,0.1)'}`, borderRadius: '6px', background: (block.imgFit ?? 'cover') === fit ? 'rgba(26,26,26,0.08)' : 'transparent', color: (block.imgFit ?? 'cover') === fit ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', transition: 'all 0.12s' }}>
                                                {fit === 'cover' ? (isZh ? '填充' : 'Fill') : (isZh ? '完整' : 'Fit')}
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                        {(block.imgFit ?? 'cover') === 'cover' && (
                                          <>
                                            {[{ label: isZh ? '焦点 X' : 'Focus X', key: 'imgOffsetX' as const }, { label: isZh ? '焦点 Y' : 'Focus Y', key: 'imgOffsetY' as const }].map(({ label, key }) => (
                                              <div key={key}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                  <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                                                  <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{(block as any)[key] ?? 0}</span>
                                                </div>
                                                <input type="range" min={-50} max={50} value={(block as any)[key] ?? 0}
                                                  onChange={e => patchBlock(block.id, { [key]: Number(e.target.value) })}
                                                  style={{ width: '100%', accentColor: '#1a1a1a' }} />
                                              </div>
                                            ))}
                                          </>
                                        )}
                                        {[
                                          { label: isZh ? '圆角' : 'Radius', key: 'imgRadius' as const, min: 0, max: 50, unit: 'px' },
                                          { label: isZh ? '阴影' : 'Shadow', key: 'imgShadow' as const, min: 0, max: 40, unit: '' },
                                          { label: isZh ? '虚化' : 'Blur',   key: 'imgBlur'   as const, min: 0, max: 20, unit: 'px' },
                                        ].map(({ label, key, min, max, unit }) => (
                                          <div key={key}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                              <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                                              <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{(block as any)[key] ?? 0}{unit}</span>
                                            </div>
                                            <input type="range" min={min} max={max} value={(block as any)[key] ?? 0}
                                              onChange={e => patchBlock(block.id, { [key]: Number(e.target.value) })}
                                              style={{ width: '100%', accentColor: '#1a1a1a' }} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Image row reorder grid */}
                                  {block.type === 'image-row' && (
                                    <div style={{ marginBottom: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 600 }}>{isZh ? '拖动调序' : 'Drag to reorder'}</span>
                                        <div style={{ flex: 1, height: '1px', background: 'rgba(26,26,26,0.06)' }} />
                                        <span style={{ fontSize: '0.58rem', color: '#c8c8c4', fontFamily: 'Space Mono, monospace' }}>{(block.images || []).length} {isZh ? '张' : 'imgs'}</span>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min((block.images || []).length, 4)}, 1fr)`, gap: '6px' }}>
                                        {(block.images || []).map((url, idx) => (
                                          <div key={idx} draggable
                                            onDragStart={() => { imageDragIndex.current = idx }}
                                            onDragOver={e => e.preventDefault()}
                                            onDrop={() => {
                                              if (imageDragIndex.current !== null && imageDragIndex.current !== idx) {
                                                const fromIdx = imageDragIndex.current
                                                updatePageBlocks(page.id, prev => prev.map(bl => {
                                                  if (bl.id !== block.id) return bl
                                                  const imgs = [...(bl.images || [])]
                                                  const caps = [...editingImageCaptions]
                                                  const [imgItem] = imgs.splice(fromIdx, 1); const [capItem] = caps.splice(fromIdx, 1)
                                                  imgs.splice(idx, 0, imgItem); caps.splice(idx, 0, capItem)
                                                  setEditingImageCaptions(caps)
                                                  return { ...bl, images: imgs }
                                                }))
                                              }
                                              imageDragIndex.current = null
                                            }}
                                            style={{ cursor: 'grab', position: 'relative', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(26,26,26,0.08)' }}>
                                            <img src={url} alt="" draggable={false} onDragStart={e => e.preventDefault()} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', transition: 'background 0.15s', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '3px', padding: '4px' }}
                                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.25)')}
                                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}>
                                              <button onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setImageEditorUrl(url); setImageEditorIdx(-1); (window as any).__editingBlockId = block.id; (window as any).__editingImageIdx = idx }}
                                                style={{ background: 'rgba(255,255,255,0.9)', color: '#333', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✎</button>
                                              <button onMouseDown={e => { e.stopPropagation(); e.preventDefault(); updatePageBlocks(page.id, prev => prev.map(bl => { if (bl.id !== block.id) return bl; const imgs = [...(bl.images || [])]; imgs.splice(idx, 1); const caps = [...editingImageCaptions]; caps.splice(idx, 1); setEditingImageCaptions(caps); return { ...bl, images: imgs } })) }}
                                                style={{ background: 'rgba(180,60,60,0.85)', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                            </div>
                                            <div style={{ position: 'absolute', bottom: '4px', left: '5px', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '0.5rem', padding: '1px 4px', borderRadius: '3px', fontFamily: 'Space Mono, monospace', pointerEvents: 'none' }}>{idx + 1}</div>
                                            <input value={editingImageCaptions[idx] || ''} onChange={e => { const updated = [...editingImageCaptions]; updated[idx] = e.target.value; setEditingImageCaptions(updated) }}
                                              placeholder={`#${idx + 1}`}
                                              style={{ width: '100%', marginTop: '4px', padding: '4px 7px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '5px', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem', color: '#555', outline: 'none', background: 'rgba(247,247,245,0.9)', boxSizing: 'border-box' }} />
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Caption field */}
                                  {(block.type === 'image' || block.type === 'image-row' || block.type === 'note') && (
                                    <div style={{ marginBottom: '10px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                                        <span style={{ fontSize: '0.55rem', color: '#c0c0bc', fontFamily: 'Inter, sans-serif', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600 }}>{isZh ? '说明文字' : 'Caption'}</span>
                                      </div>
                                      <input value={editingCaption} onChange={e => setEditingCaption(e.target.value)}
                                        placeholder={isZh ? '说明（可选）…' : 'Caption (optional)…'}
                                        className="no-drag"
                                        style={{ width: '100%', padding: '7px 10px', border: '1.5px solid rgba(26,26,26,0.08)', borderRadius: '7px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#888', outline: 'none', background: 'rgba(247,247,245,0.6)', boxSizing: 'border-box', transition: 'border-color 0.15s', fontStyle: 'italic' }}
                                        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.25)')}
                                        onBlur={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.08)')} />
                                    </div>
                                  )}

                                  {/* Action buttons */}
                                  <div className="no-drag" style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid rgba(26,26,26,0.06)' }}>
                                    <button className="no-drag" onMouseDown={e => e.stopPropagation()} onClick={saveEdit}
                                      style={{ flex: 1, padding: '8px 0', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '7px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.75rem', letterSpacing: '0.06em', cursor: 'pointer', fontWeight: 600, transition: 'background 0.12s' }}
                                      onMouseEnter={e => (e.currentTarget.style.background = '#333')}
                                      onMouseLeave={e => (e.currentTarget.style.background = '#1a1a1a')}
                                    >{isZh ? '保存' : 'Apply'}</button>
                                    <button className="no-drag" onMouseDown={e => e.stopPropagation()} onClick={cancelEdit}
                                      style={{ padding: '8px 14px', background: 'transparent', color: '#aaa', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '7px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.12s' }}
                                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.25)'; e.currentTarget.style.color = '#555' }}
                                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)'; e.currentTarget.style.color = '#aaa' }}
                                    >{isZh ? '取消' : 'Cancel'}</button>
                                  </div>
                                </div>
                              ) : (
                                /* ── Block display mode ── */
                                <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                                  {(block.type === 'title' || block.type === 'note' || block.type === 'custom') && (
                                    <TextBlockContent
                                      block={block}
                                      isEditing={editingBlockId === block.id}
                                      projectTitle={block.type === 'title' ? project?.title : undefined}
                                      projectDescription={block.type === 'title' ? project?.description : undefined}
                                      onSave={(id, patch) => patchBlock(id, patch)}
                                      onStopEditing={() => setEditingBlockId(null)}
                                    />
                                  )}
                                  {block.type === 'image' && (() => {
                                    const isImgPanning = editingBlockId === block.id
                                    const tx    = block.imgOffsetX ?? 0
                                    const ty    = block.imgOffsetY ?? 0
                                    const scale = block.imgScale ?? 1
                                    const clipRange = block.imgClipRange as [[number,number],[number,number]] | undefined
                                    const imgPos = (() => {
                                      if (!clipRange || !isImgPanning) return { top: '0', left: '0', width: '100%', height: '100%' }
                                      const [start, end] = clipRange
                                      const ws = (end[0] - start[0]) / 100; const hs = (end[1] - start[1]) / 100
                                      return { left: -(start[0] / ws) + '%', top: -(start[1] / hs) + '%', width: 100 / ws + '%', height: 100 / hs + '%' }
                                    })()
                                    return (
                                      <div data-blockid={block.id}
                                        style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative', cursor: isImgPanning ? 'grab' : 'default', borderRadius: `${block.imgRadius ?? 0}px` }}
                                        onMouseDown={!isImgPanning ? undefined : e => {
                                          e.stopPropagation()
                                          const startX = e.clientX - tx; const startY = e.clientY - ty
                                          const onMove = (ev: MouseEvent) => {
                                            const imgEl = document.querySelector(`.rnd-block [data-blockid="${block.id}"] img`) as HTMLImageElement | null
                                            const maxX  = imgEl ? Math.max(0, (imgEl.naturalWidth * scale - (imgEl.parentElement?.offsetWidth ?? 0)) / 2) : 999
                                            const maxY  = imgEl ? Math.max(0, (imgEl.naturalHeight * scale - (imgEl.parentElement?.offsetHeight ?? 0)) / 2) : 999
                                            patchBlock(block.id, { imgOffsetX: Math.min(maxX, Math.max(-maxX, ev.clientX - startX)), imgOffsetY: Math.min(maxY, Math.max(-maxY, ev.clientY - startY)) })
                                          }
                                          const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                                          window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                                        }}
                                        onWheel={!isImgPanning ? undefined : e => { patchBlock(block.id, { imgScale: Math.min(3, Math.max(0.5, scale - e.deltaY * 0.001)) } as any) }}
                                      >
                                        <img src={block.content} alt="" draggable={false} onDragStart={e => e.preventDefault()}
                                          style={{
                                            position: isImgPanning ? 'absolute' : 'relative',
                                            top: isImgPanning ? imgPos.top : '-0.5px',
                                            left: isImgPanning ? imgPos.left : '-0.5px',
                                            width: isImgPanning ? imgPos.width : 'calc(100% + 1px)',
                                            height: isImgPanning ? imgPos.height : 'calc(100% + 1px)',
                                            objectFit: isImgPanning ? undefined : 'fill',
                                            transform: isImgPanning ? `translate(${tx}px, ${ty}px) scale(${scale})` : undefined,
                                            transformOrigin: 'center center', display: 'block', userSelect: 'none',
                                            boxShadow: block.imgShadow ? `0 ${Math.round(block.imgShadow / 2)}px ${block.imgShadow}px rgba(0,0,0,0.22)` : 'none',
                                            filter: block.imgBlur ? `blur(${block.imgBlur}px)` : 'none',
                                          } as React.CSSProperties}
                                        />
                                        {isImgPanning && (
                                          <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.6rem', padding: '3px 8px', borderRadius: '4px', pointerEvents: 'none', fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap' }}>
                                            {isZh ? '拖动调整位置 · 滚轮缩放 · 单击外部退出' : 'Drag · Scroll zoom · Click outside to exit'}
                                          </div>
                                        )}
                                      </div>
                                    )
                                  })()}
                                  {block.type === 'image-row' && (
                                    <div>
                                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '6px' }}>
                                        {(block.images || []).map((url, idx) => (
                                          <div key={idx} style={{ position: 'relative' }} className="img-row-item">
                                            <img src={url} alt="" draggable={false} onDragStart={e => e.preventDefault()} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', display: 'block', userSelect: 'none' } as React.CSSProperties} />
                                            <button
                                              onClick={e => { e.stopPropagation(); updatePageBlocks(page.id, prev => prev.map(bl => { if (bl.id !== block.id) return bl; const imgs = [...(bl.images || [])]; imgs.splice(idx, 1); const caps = [...(bl.imageCaptions || [])]; caps.splice(idx, 1); return { ...bl, images: imgs, imageCaptions: caps } })) }}
                                              className="img-row-del"
                                              style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(180,60,60,0.8)', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>✕</button>
                                            {(block.imageCaptions || [])[idx] && <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.4, fontFamily: 'Inter, DM Sans, sans-serif' }}>{(block.imageCaptions || [])[idx]}</p>}
                                          </div>
                                        ))}
                                      </div>
                                      {block.caption && <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '7px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>{block.caption}</p>}
                                    </div>
                                  )}
                                  {block.type === 'milestone' && (
                                    <div>
                                      <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c0c0bc', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '进度节点' : 'Milestones'}</p>
                                      {project?.milestones.slice(0, 4).map(m => (
                                        <p key={m.id} style={{ fontSize: '0.88rem', color: m.status === 'done' ? '#c0c0bc' : '#2a2a2a', marginBottom: '5px', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif', display: 'flex', alignItems: 'center', gap: '7px' }}>
                                          <span style={{ color: m.status === 'done' ? '#4aab6f' : '#ccc', fontSize: '0.75rem' }}>{m.status === 'done' ? '✓' : '○'}</span>
                                          <span style={{ textDecoration: m.status === 'done' ? 'line-through' : 'none' }}>{m.title}</span>
                                        </p>
                                      ))}
                                      {(project?.milestones.length ?? 0) > 4 && <p style={{ fontSize: '0.75rem', color: '#c8c8c4', marginTop: '4px', fontFamily: 'Inter, DM Sans, sans-serif' }}>+{(project?.milestones.length ?? 0) - 4} {isZh ? '个节点' : 'more'}</p>}
                                    </div>
                                  )}
                                  {block.type === 'school-profile' && (() => {
                                    const school = schools.find(sc => sc.id === block.content)
                                    if (!school) return <p style={{ fontSize: '0.82rem', color: '#bbb', fontFamily: 'Inter, DM Sans, sans-serif' }}>School not found</p>
                                    const displayName = isZh ? (school.nameZh || school.name) : school.name
                                    const displayDept = isZh ? (school.departmentZh || school.department) : school.department
                                    return (
                                      <div>
                                        <p style={{ fontSize: '0.62rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: '#c4a044', marginBottom: '5px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{school.country}</p>
                                        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '3px', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif', letterSpacing: '-0.01em' }}>{displayName}</p>
                                        {displayDept && <p style={{ fontSize: '0.84rem', color: '#999', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.5 }}>{displayDept}</p>}
                                        {school.deadline && <p style={{ fontSize: '0.75rem', color: '#c0c0bc', marginTop: '5px', fontFamily: 'Inter, DM Sans, sans-serif' }}>⏱ {school.deadline}</p>}
                                        {school.aiStatement && <p style={{ fontSize: '0.75rem', color: '#4aab6f', marginTop: '5px', fontFamily: 'Inter, DM Sans, sans-serif' }}>✓ {isZh ? '含申请文书' : 'has statement'}</p>}
                                      </div>
                                    )
                                  })()}
                                  {block.type === 'table' && (
                                    <TableBlock
                                      tableData={block.tableData ?? DEFAULT_TABLE_DATA}
                                      isEditing={editingBlockId === block.id}
                                      isSelected={selectedBlockId === block.id}
                                      blockWidth={block.pixelPos?.w ?? 860}
                                      onChange={data => patchBlock(block.id, { tableData: data })}
                                      onHeightChange={h => {
                                        if (block.pixelPos) patchBlock(block.id, { pixelPos: { ...block.pixelPos, h } })
                                      }}
                                    />
                                  )}

                                  {/* ── Sticky Note ── */}
                                  {block.type === 'sticky' && (() => {
                                    const bg = (block as any).stickyColor || '#fef08a'
                                    const isEditing = editingBlockId === block.id
                                    const fs = block.fontSize || 15
                                    const tc = block.color || '#1a1a1a'
                                    const ff = block.fontFamily || 'Inter, DM Sans, sans-serif'
                                    return (
                                      <div
                                        style={{
                                          width: '100%', height: '100%',
                                          background: bg,
                                          borderRadius: '4px',
                                          padding: '14px 16px',
                                          boxSizing: 'border-box',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          position: 'relative',
                                          boxShadow: stickyBoxShadow || undefined,
                                        }}
                                      >
                                        {/* 顶部装饰条 */}
                                        <div style={{
                                          position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
                                          background: 'rgba(0,0,0,0.08)', borderRadius: '4px 4px 0 0',
                                        }} />
                                        {isEditing ? (
                                          <textarea
                                            className="no-drag"
                                            autoFocus
                                            defaultValue={block.content}
                                            onBlur={e => {
                                              patchBlock(block.id, { content: e.target.value })
                                              setEditingBlockId(null)
                                            }}
                                            onKeyDown={e => {
                                              if (e.key === 'Escape') {
                                                patchBlock(block.id, { content: (e.target as HTMLTextAreaElement).value })
                                                setEditingBlockId(null)
                                              }
                                            }}
                                            style={{
                                              flex: 1, width: '100%', background: 'transparent',
                                              border: 'none', outline: 'none', resize: 'none',
                                              fontFamily: ff, fontSize: fs, color: tc,
                                              lineHeight: 1.6, padding: 0, marginTop: '6px',
                                            }}
                                          />
                                        ) : (
                                          <p style={{
                                            flex: 1, margin: 0, marginTop: '6px',
                                            fontFamily: ff, fontSize: fs, color: tc,
                                            lineHeight: 1.6, whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                            opacity: block.content ? 1 : 0.35,
                                          }}>
                                            {block.content || (isZh ? '双击输入文字…' : 'Double-click to edit…')}
                                          </p>
                                        )}
                                      </div>
                                    )
                                  })()}
                                </div>
                              )}
                            </div>
                          </div>
                        </Rnd>
                      )
                    })}

                    {/* ── Emoji Blocks Layer ── */}
                    {((s as any).emojiBlocks as EmojiBlockType[] ?? [])
                      .filter((eb: EmojiBlockType) => eb && eb.pageId === page.id && eb.x !== undefined && eb.y !== undefined)
                      .map((eb: EmojiBlockType) => (
                        <EmojiBlockComponent
                          key={eb.id}
                          block={eb}
                          selected={(s as any).selectedEmojiId === eb.id}
                          canvasScale={canvasZoom}
                          onSelect={(id: string) => {
                            ;(s as any).setSelectedEmojiId(id)
                            setSelectedBlockId(null)
                            setEditingBlockId(null)
                          }}
                          onDeselect={() => (s as any).setSelectedEmojiId(null)}
                          onMove={(id: string, x: number, y: number) =>
                            (s as any).setEmojiBlocks((prev: EmojiBlockType[]) =>
                              prev.map((b: EmojiBlockType) => b.id === id ? { ...b, x, y } : b)
                            )
                          }
                          onArrowClick={(fromId: string, direction: ArrowDirection, anchorX: number, anchorY: number) => {
                            ;(s as any).openEmojiFromArrow(anchorX, anchorY, fromId, direction)
                          }}
                        />
                      ))
                    }
                  </div>
                </div>
              </div>
            )
          })}
          <div style={{ height: 60 }} />
        </div>
        </div>
      </div>

    </div>
  )
}