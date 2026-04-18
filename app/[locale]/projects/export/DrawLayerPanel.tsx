'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getDrawLayerManager, Layer, LayerManagerEvent } from './DrawLayerManager'

interface DrawLayerPanelProps {
  isZh: boolean
  activePageId: string
}

const t = (en: string, zh: string, isZh: boolean) => isZh ? zh : en

// ── Reuse the same tldraw-style cursor system from CanvasArea ────────────────
function _makeTLCursor(
  innerFn: (fill: string, stroke: string) => string,
  hx: number, hy: number, fallback: string,
  withShadow = true, fillColor = 'white', strokeColor = 'black'
): string {
  const enc = (c: string) => c.replace(/#/g, '%23')
  const fill = enc(fillColor), stroke = enc(strokeColor)
  const filter = withShadow
    ? `<defs><filter id='shadow' y='-40%25' x='-40%25' width='180px' height='180%25' color-interpolation-filters='sRGB'><feDropShadow dx='1' dy='1' stdDeviation='1.2' flood-opacity='.5'/></filter></defs>`
    : ''
  const gAttr = withShadow ? `filter='url(%23shadow)'` : ''
  return `url("data:image/svg+xml,<svg height='40' width='40' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg' style='color: black;'>${filter}<g fill='none' transform='rotate(0 16 16)' ${gAttr}>${innerFn(fill, stroke)}</g></svg>") ${Math.round(hx * 1.25)} ${Math.round(hy * 1.25)}, ${fallback}`
}
const _arrowInner = (fill: string, stroke: string) =>
  `<path d='m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z' fill='${fill}' stroke='${fill}' stroke-width='1.2' stroke-linejoin='round'/><path d='m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z' fill='none' stroke='${stroke}' stroke-width='0.8' stroke-linejoin='round'/><path d='m13 10.814v11.188l2.969-2.866.428-.139h4.768z' fill='${stroke}' stroke='${stroke}' stroke-width='0.4' stroke-linejoin='round'/>`

// 和编辑器主界面完全一样的箭头光标
const LAYER_SLIDER_CURSOR = _makeTLCursor(_arrowInner, 12, 8, 'default', true, 'white', 'black')
// ─────────────────────────────────────────────────────────────────────────────

// ── Professional opacity slider ──────────────────────────────────────────────
interface OpacitySliderProps {
  value: number           // 0–1
  onChange: (v: number) => void
  onClickCapture?: (e: React.MouseEvent) => void
}

function OpacitySlider({ value, onChange, onClickCapture }: OpacitySliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [showTip, setShowTip] = useState(false)

  const clamp = (n: number) => Math.min(1, Math.max(0, n))

  const posFromEvent = useCallback((clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return value
    return clamp((clientX - rect.left) / rect.width)
  }, [value])

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setShowTip(true)
    onChange(Math.round(posFromEvent(e.clientX) * 20) / 20) // snap to 5%
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    onChange(Math.round(posFromEvent(e.clientX) * 20) / 20)
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging(false)
    setTimeout(() => setShowTip(false), 600)
  }

  // Keyboard: left/right arrows, shift for ×10
  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    const step = e.shiftKey ? 0.1 : 0.05
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      onChange(clamp(Math.round((value - step) * 20) / 20))
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(clamp(Math.round((value + step) * 20) / 20))
    }
  }

  const pct = value * 100

  return (
    <div
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '5px' }}
      onClickCapture={onClickCapture}
    >
      {/* Track container */}
      <div
        ref={trackRef}
        tabIndex={0}
        role="slider"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseEnter={() => { setHovering(true); setShowTip(true) }}
        onMouseLeave={() => { setHovering(false); if (!dragging) setShowTip(false) }}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          width: '52px',
          height: '16px',
          cursor: LAYER_SLIDER_CURSOR,
          userSelect: 'none',
          touchAction: 'none',
          outline: 'none',
          flexShrink: 0,
        }}
      >
        {/* Track background — checkerboard to show transparency concept */}
        <div style={{
          position: 'absolute',
          inset: '6px 0',
          borderRadius: '3px',
          background: 'repeating-conic-gradient(#d0d0d0 0% 25%, #f0f0f0 0% 50%) 0 0 / 4px 4px',
          overflow: 'hidden',
        }}>
          {/* Fill — soft dark, not full black */}
          <div style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: 'rgba(26,26,26,0.72)',
            borderRadius: 'inherit',
            transition: dragging ? 'none' : 'width 0.08s ease',
          }} />
          {/* Track border */}
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            boxShadow: 'inset 0 0 0 1px rgba(26,26,26,0.1)',
          }} />
        </div>

        {/* Thumb */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: `calc(${pct}% - 6px)`,
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: `0 0 0 1.5px rgba(26,26,26,${hovering || dragging ? '0.35' : '0.2'}), 0 1px 3px rgba(0,0,0,0.18)`,
          transition: dragging ? 'none' : 'left 0.08s ease, box-shadow 0.12s',
          willChange: 'left',
        }} />

        {/* Tooltip */}
        {showTip && (
          <div style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: `calc(${pct}% - 14px)`,
            background: '#1a1a1a',
            color: '#fff',
            fontSize: '0.58rem',
            fontFamily: 'Space Mono, monospace',
            letterSpacing: '0.04em',
            padding: '2px 5px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            opacity: showTip ? 1 : 0,
            transition: 'opacity 0.12s',
            zIndex: 20,
          }}>
            {Math.round(pct)}%
          </div>
        )}
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DrawLayerPanel({ isZh, activePageId }: DrawLayerPanelProps) {
  const [layers, setLayers]       = useState<Layer[]>([])
  const [activeId, setActiveId]   = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)

  const mgr = getDrawLayerManager(activePageId)

  const sync = useCallback(() => {
    setLayers([...mgr.getLayers()])
    setActiveId(mgr.getActiveLayerId())
  }, [mgr])

  useEffect(() => {
    sync()
    const listener = (e: LayerManagerEvent) => {
      if (e.type === 'layers-changed') sync()
    }
    mgr.on(listener)
    return () => mgr.off(listener)
  }, [mgr, sync])

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editingId])

  const handleAdd = () => {
    mgr.addLayer(isZh ? `图层 ${layers.length + 1}` : `Layer ${layers.length + 1}`)
    sync()
  }

  const handleDelete = (id: string) => {
    if (layers.length <= 1) return
    mgr.deleteLayer(id)
    sync()
  }

  const handleToggleVisible = (id: string, visible: boolean) => {
    mgr.patchLayer(id, { visible: !visible })
    sync()
  }

  const handleToggleLock = (id: string, locked: boolean) => {
    mgr.patchLayer(id, { locked: !locked })
    sync()
  }

  const handleOpacity = (id: string, opacity: number) => {
    mgr.patchLayer(id, { opacity })
    sync()
  }

  const handleRename = (id: string, name: string) => {
    mgr.patchLayer(id, { name })
    setEditingId(null)
    sync()
  }

  const handleMove = (id: string, dir: 'up' | 'down') => {
    mgr.moveLayer(id, dir)
    sync()
  }

  // reversed for display: top layer = index 0 visually
  const displayed = [...layers].reverse()

  return (
    <div style={{
      padding: '12px 14px 6px',
      borderBottom: '1px solid rgba(26,26,26,0.07)',
      fontFamily: 'Inter, DM Sans, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#9a9a9a' }}>
          {t('Layers', '图层', isZh)}
        </span>
        <button
          onClick={handleAdd}
          title={t('Add layer', '添加图层', isZh)}
          style={iconBtn}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M6.5 2.5v8M2.5 6.5h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Layer list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '180px', overflowY: 'auto', scrollbarWidth: 'none' }}>
        {displayed.map((layer) => {
          const realIdx = layers.indexOf(layer)
          const isActive = layer.id === activeId
          const isTop    = realIdx === layers.length - 1
          const isBottom = realIdx === 0

          return (
            <div
              key={layer.id}
              onClick={() => { mgr.setActiveLayer(layer.id); sync() }}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '5px 7px', borderRadius: '7px', cursor: 'pointer',
                background: isActive ? 'rgba(26,26,26,0.07)' : 'transparent',
                border: isActive ? '1px solid rgba(26,26,26,0.1)' : '1px solid transparent',
                transition: 'background 0.12s',
              }}
            >
              {/* Visibility */}
              <button
                onClick={e => { e.stopPropagation(); handleToggleVisible(layer.id, layer.visible ?? true) }}
                title={t('Toggle visibility', '切换可见', isZh)}
                style={{ ...iconBtn, color: (layer.visible ?? true) ? '#1a1a1a' : '#ccc' }}
              >
                {(layer.visible ?? true)
                  ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><ellipse cx="6.5" cy="6.5" rx="2" ry="2" stroke="currentColor" strokeWidth="1.3"/><path d="M1 6.5C2.5 3.5 10.5 3.5 12 6.5C10.5 9.5 2.5 9.5 1 6.5Z" stroke="currentColor" strokeWidth="1.3"/></svg>
                  : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 2l9 9M1 6.5C2.5 3.5 10.5 3.5 12 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                }
              </button>

              {/* Lock */}
              <button
                onClick={e => { e.stopPropagation(); handleToggleLock(layer.id, layer.locked ?? false) }}
                title={t('Toggle lock', '切换锁定', isZh)}
                style={{ ...iconBtn, color: (layer.locked ?? false) ? '#e07b39' : '#ccc' }}
              >
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                  {(layer.locked ?? false)
                    ? <><rect x="1" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3.5 5.5V3.5a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.3"/></>
                    : <><rect x="1" y="5.5" width="9" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3.5 5.5V3.5a2 2 0 014 0" stroke="currentColor" strokeWidth="1.3"/></>
                  }
                </svg>
              </button>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === layer.id
                  ? <input
                      ref={editRef}
                      defaultValue={layer.name}
                      onBlur={e => handleRename(layer.id, e.target.value.trim() || layer.name)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleRename(layer.id, (e.target as HTMLInputElement).value.trim() || layer.name)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '100%', fontSize: '0.72rem', border: '1px solid rgba(26,26,26,0.2)', borderRadius: '4px', padding: '1px 4px', outline: 'none', fontFamily: 'inherit', background: '#fff' }}
                    />
                  : <span
                      onDoubleClick={e => { e.stopPropagation(); setEditingId(layer.id) }}
                      style={{ fontSize: '0.72rem', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
                    >
                      {layer.name}
                    </span>
                }
              </div>

              {/* ── Opacity slider (replaced native range) ── */}
              <OpacitySlider
                value={layer.opacity ?? 1}
                onChange={v => handleOpacity(layer.id, v)}
                onClickCapture={e => e.stopPropagation()}
              />

              {/* Move up/down */}
              <button
                onClick={e => { e.stopPropagation(); handleMove(layer.id, 'up') }}
                disabled={isTop}
                title={t('Move up', '上移', isZh)}
                style={{ ...iconBtn, color: isTop ? '#ddd' : '#888' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 8.5V2.5M2.5 5.5l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleMove(layer.id, 'down') }}
                disabled={isBottom}
                title={t('Move down', '下移', isZh)}
                style={{ ...iconBtn, color: isBottom ? '#ddd' : '#888' }}
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M5.5 2.5v6M2.5 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>

              {/* Delete */}
              <button
                onClick={e => { e.stopPropagation(); handleDelete(layer.id) }}
                disabled={layers.length <= 1}
                title={t('Delete layer', '删除图层', isZh)}
                style={{ ...iconBtn, color: layers.length <= 1 ? '#ddd' : '#c0392b' }}
              >
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none"><path d="M1 3h9M4 3V1.5h3V3M2 3l.7 8h5.6L9 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, flexShrink: 0,
  background: 'transparent', border: 'none', cursor: 'pointer',
  borderRadius: '5px', color: '#888', padding: 0,
  transition: 'color 0.12s, background 0.12s',
}