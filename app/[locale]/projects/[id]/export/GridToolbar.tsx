import React from 'react'
import { UseGridSystemReturn } from './useGridSystem'
import {
  GridLayer, GridLayerType,
  ColumnLayer, BaselineLayer, TableLayer,
} from './gridTypes'

interface GridToolbarProps {
  hook: UseGridSystemReturn
  pageId: string
}

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:       'var(--panel-bg, #1c1c1e)',
  border:   'var(--border, rgba(255,255,255,0.08))',
  text:     'var(--text, rgba(255,255,255,0.85))',
  muted:    'var(--text-muted, rgba(255,255,255,0.38))',
  accent:   'var(--accent, #818cf8)',
  accentBg: 'rgba(99,102,241,0.18)',
  inputBg:  'rgba(255,255,255,0.05)',
  danger:   'rgba(255,59,48,0.85)',
}

// ─── Micro inputs ─────────────────────────────────────────────────────────────

function NumInput({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 9.5, color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <input
        type="number" value={value} min={min} max={max} step={step}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          width: '100%', padding: '3px 5px', fontSize: 12, textAlign: 'center',
          border: `1px solid ${C.border}`, borderRadius: 5,
          background: C.inputBg, color: C.text, outline: 'none',
        }}
      />
    </label>
  )
}

function ColorInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const toHex = (rgba: string) => {
    const m = rgba.match(/[\d.]+/g)
    if (!m) return '#6366f1'
    return '#' + [m[0], m[1], m[2]].map(x => Math.round(Number(x)).toString(16).padStart(2, '0')).join('')
  }
  const fromHex = (hex: string) => {
    const m = value.match(/[\d.]+/g)
    const alpha = m?.[3] ? parseFloat(m[3]) : 0.15
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: 9.5, color: C.muted, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
      <input type="color" value={toHex(value)} onChange={e => onChange(fromHex(e.target.value))}
        style={{ width: 28, height: 24, border: 'none', cursor: 'pointer', background: 'none', padding: 0 }} />
    </label>
  )
}

function AlphaInput({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  const getAlpha = (rgba: string) => {
    const m = rgba.match(/[\d.]+/g); return m?.[3] ? parseFloat(m[3]) : 0.15
  }
  const setAlpha = (rgba: string, a: number) => {
    const m = rgba.match(/[\d.]+/g)
    if (!m) return rgba
    return `rgba(${m[0]},${m[1]},${m[2]},${a})`
  }
  return (
    <NumInput label={label} value={Math.round(getAlpha(value) * 100)} min={0} max={100}
      onChange={v => onChange(setAlpha(value, v / 100))} />
  )
}

// ─── Layer type add buttons ───────────────────────────────────────────────────

const LAYER_TYPES: { type: GridLayerType; label: string; icon: string }[] = [
  { type: 'column',   label: '列网格',   icon: '⬜' },
  { type: 'baseline', label: '基线',     icon: '☰'  },
  { type: 'table',    label: '表格',     icon: '⊞'  },
]

// ─── Individual layer row ─────────────────────────────────────────────────────

function LayerRow({ layer, isEditing, pageId, hook }: {
  layer: GridLayer; isEditing: boolean; pageId: string; hook: UseGridSystemReturn
}) {
  const { toggleLayer, removeLayer, setEditingLayer, updateLayer } = hook

  const typeLabel = layer.type === 'column' ? '列' : layer.type === 'baseline' ? '基线' : '表格'
  const typeColor = layer.type === 'column' ? '#818cf8' : layer.type === 'baseline' ? '#34d399' : '#f59e0b'

  const patch = (p: Partial<GridLayer>) => updateLayer(pageId, layer.id, p)

  return (
    <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${isEditing ? 'rgba(99,102,241,0.5)' : C.border}` }}>
      {/* Row header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
        background: isEditing ? 'rgba(99,102,241,0.12)' : C.inputBg,
        cursor: 'pointer',
      }}
        onClick={() => setEditingLayer(isEditing ? null : layer.id)}
      >
        {/* visibility toggle */}
        <button
          onClick={e => { e.stopPropagation(); toggleLayer(pageId, layer.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 12,
            color: layer.visible ? typeColor : C.muted, lineHeight: 1 }}
          title={layer.visible ? '隐藏' : '显示'}
        >
          {layer.visible ? '◉' : '○'}
        </button>

        {/* type badge */}
        <span style={{ fontSize: 10, fontWeight: 600, color: typeColor, letterSpacing: '0.05em' }}>
          {typeLabel}
        </span>

        {/* color swatch */}
        <span style={{
          width: 10, height: 10, borderRadius: 2, flexShrink: 0,
          background: layer.color, border: `1px solid ${C.border}`,
        }} />

        <span style={{ flex: 1 }} />

        {/* expand chevron */}
        <span style={{ fontSize: 10, color: C.muted, transition: 'transform 0.15s',
          transform: isEditing ? 'rotate(180deg)' : 'none' }}>▾</span>

        {/* delete */}
        <button
          onClick={e => { e.stopPropagation(); removeLayer(pageId, layer.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            fontSize: 13, color: C.muted, lineHeight: 1 }}
          title="删除"
          onMouseEnter={e => (e.currentTarget.style.color = C.danger)}
          onMouseLeave={e => (e.currentTarget.style.color = C.muted)}
        >×</button>
      </div>

      {/* Expanded controls */}
      {isEditing && (
        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8,
          background: 'rgba(255,255,255,0.02)', borderTop: `1px solid ${C.border}` }}>

          {layer.type === 'column' && <ColumnControls layer={layer} patch={patch} />}
          {layer.type === 'baseline' && <BaselineControls layer={layer} patch={patch} />}
          {layer.type === 'table' && <TableControls layer={layer} patch={patch} />}

          {/* Common: color + alpha + strokeWidth */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            <ColorInput label="颜色" value={layer.color} onChange={v => patch({ color: v } as any)} />
            <AlphaInput label="透明度%" value={layer.color} onChange={v => patch({ color: v } as any)} />
            <NumInput label="线宽" value={layer.strokeWidth} min={0.25} max={4} step={0.25}
              onChange={v => patch({ strokeWidth: v } as any)} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Per-type controls ────────────────────────────────────────────────────────

function ColumnControls({ layer, patch }: { layer: ColumnLayer; patch: (p: Partial<GridLayer>) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <NumInput label="列数" value={layer.columns} min={1} max={24}
        onChange={v => patch({ columns: v } as any)} />
      <NumInput label="间距px" value={layer.gutter} min={0} max={200}
        onChange={v => patch({ gutter: v } as any)} />
      <NumInput label="边距px" value={layer.margin} min={0} max={200}
        onChange={v => patch({ margin: v } as any)} />
    </div>
  )
}

function BaselineControls({ layer, patch }: { layer: BaselineLayer; patch: (p: Partial<GridLayer>) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <NumInput label="间距px" value={layer.lineHeight} min={2} max={200}
        onChange={v => patch({ lineHeight: v } as any)} />
    </div>
  )
}

function TableControls({ layer, patch }: { layer: TableLayer; patch: (p: Partial<GridLayer>) => void }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6 }}>
        <NumInput label="行数" value={layer.rows} min={1} max={48}
          onChange={v => patch({ rows: v } as any)} />
        <NumInput label="列数" value={layer.columns} min={1} max={24}
          onChange={v => patch({ columns: v } as any)} />
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.muted, cursor: 'pointer' }}>
          <input type="checkbox" checked={layer.showHeader} onChange={e => patch({ showHeader: e.target.checked } as any)} />
          显示表头
        </label>
      </div>
    </>
  )
}

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export function GridToolbar({ hook, pageId }: GridToolbarProps) {
  const { gridState, addLayer, setDraftType, getPageLayers } = hook
  const layers = getPageLayers(pageId)
  const editingId = gridState.editingLayerId
  const draftType = gridState.draftType

  return (
    <div style={{ padding: '10px 10px 14px', userSelect: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* Header */}
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: C.muted }}>
        GRID LAYERS
      </div>

      {/* Layer list */}
      {layers.length === 0 ? (
        <div style={{ fontSize: 11, color: C.muted, fontStyle: 'italic', textAlign: 'center', padding: '8px 0' }}>
          暂无网格层，点击下方添加
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {layers.map(layer => (
            <LayerRow
              key={layer.id}
              layer={layer}
              isEditing={editingId === layer.id}
              pageId={pageId}
              hook={hook}
            />
          ))}
        </div>
      )}

      {/* Add layer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {LAYER_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => setDraftType(type)}
              style={{
                flex: 1, padding: '4px 2px', fontSize: 10, borderRadius: 5,
                border: `1px solid ${draftType === type ? C.accent : C.border}`,
                background: draftType === type ? C.accentBg : 'transparent',
                color: draftType === type ? C.accent : C.muted,
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                transition: 'all 0.12s',
              }}
            >
              <span style={{ fontSize: 13 }}>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => addLayer(pageId, draftType)}
          style={{
            width: '100%', padding: '6px 0', fontSize: 12, borderRadius: 6,
            border: `1px solid ${C.accent}`, background: C.accentBg,
            color: C.accent, cursor: 'pointer', fontWeight: 600,
            transition: 'background 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = C.accentBg)}
        >
          + 添加图层
        </button>
      </div>
    </div>
  )
}