import React from 'react'
import { UseGridSystemReturn } from './useGridSystem'
import { GridType } from './gridTypes'

interface GridToolbarProps {
  hook: UseGridSystemReturn
}

// ─── Small reusable inputs ────────────────────────────────────────────────────

function NumInput({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted, #888)', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          padding: '3px 6px',
          fontSize: 12,
          border: '1px solid var(--border, #444)',
          borderRadius: 4,
          background: 'var(--input-bg, #2a2a2a)',
          color: 'var(--text, #eee)',
          textAlign: 'center',
        }}
      />
    </div>
  )
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  // rgba 字符串 → hex（简单取 rgb 部分）
  const toHex = (rgba: string) => {
    const m = rgba.match(/[\d.]+/g)
    if (!m) return '#6366f1'
    const [r, g, b] = m.map(Number)
    return (
      '#' +
      [r, g, b]
        .map((x) => Math.round(x).toString(16).padStart(2, '0'))
        .join('')
    )
  }
  const fromHex = (hex: string, alpha = 0.15) => {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted, #888)' }}>{label}</span>
      <input
        type="color"
        value={toHex(value)}
        onChange={(e) => {
          const m = value.match(/[\d.]+/g)
          const alpha = m ? parseFloat(m[3] ?? '0.15') : 0.15
          onChange(fromHex(e.target.value, alpha))
        }}
        style={{ width: 32, height: 24, border: 'none', cursor: 'pointer', background: 'none' }}
      />
    </div>
  )
}

// ─── Grid type button ─────────────────────────────────────────────────────────

const GRID_TYPES: { key: GridType; label: string; icon: string }[] = [
  { key: 'column',   label: '列网格',   icon: '⬜' },
  { key: 'baseline', label: '基线网格', icon: '☰' },
  { key: 'modular',  label: '模块网格', icon: '⊞' },
]

// ─── Main Toolbar ─────────────────────────────────────────────────────────────

export function GridToolbar({ hook }: GridToolbarProps) {
  const { gridState, setActiveGrid, updateColumn, updateBaseline, updateModular } = hook
  const { activeType, column, baseline, modular } = gridState

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '8px 0',
    borderTop: '1px solid var(--border, #333)',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 6,
    alignItems: 'flex-end',
  }

  return (
    <div style={{ padding: '8px 12px', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-muted, #888)', marginBottom: 8 }}>
        GRID SYSTEM
      </div>

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {GRID_TYPES.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveGrid(key)}
            title={label}
            style={{
              flex: 1,
              padding: '5px 4px',
              fontSize: 11,
              border: `1px solid ${activeType === key ? 'var(--accent, #6366f1)' : 'var(--border, #444)'}`,
              borderRadius: 5,
              background: activeType === key ? 'rgba(99,102,241,0.2)' : 'transparent',
              color: activeType === key ? 'var(--accent, #818cf8)' : 'var(--text-muted, #888)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.15s',
            }}
          >
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Column Grid Controls ── */}
      {activeType === 'column' && (
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <NumInput label="列数" value={column.columns} min={1} max={24} onChange={(v) => updateColumn({ columns: v })} />
            <NumInput label="间距px" value={column.gutter} min={0} onChange={(v) => updateColumn({ gutter: v })} />
            <NumInput label="边距px" value={column.margin} min={0} onChange={(v) => updateColumn({ margin: v })} />
          </div>
          <div style={rowStyle}>
            <ColorInput label="颜色" value={column.color} onChange={(v) => updateColumn({ color: v })} />
          </div>
        </div>
      )}

      {/* ── Baseline Grid Controls ── */}
      {activeType === 'baseline' && (
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <NumInput label="基线间距px" value={baseline.lineHeight} min={2} max={100} onChange={(v) => updateBaseline({ lineHeight: v })} />
            <ColorInput label="颜色" value={baseline.color} onChange={(v) => updateBaseline({ color: v })} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted, #888)', lineHeight: 1.4 }}>
            常用值：8px（UI）/ 12px（正文）/ 24px（标题）
          </div>
        </div>
      )}

      {/* ── Modular Grid Controls ── */}
      {activeType === 'modular' && (
        <div style={sectionStyle}>
          <div style={rowStyle}>
            <NumInput label="列数" value={modular.columns} min={1} max={24} onChange={(v) => updateModular({ columns: v })} />
            <NumInput label="行数" value={modular.rows} min={1} max={48} onChange={(v) => updateModular({ rows: v })} />
          </div>
          <div style={rowStyle}>
            <NumInput label="列间距" value={modular.columnGutter} min={0} onChange={(v) => updateModular({ columnGutter: v })} />
            <NumInput label="行间距" value={modular.rowGutter} min={0} onChange={(v) => updateModular({ rowGutter: v })} />
            <NumInput label="边距" value={modular.margin} min={0} onChange={(v) => updateModular({ margin: v })} />
          </div>
          <div style={rowStyle}>
            <ColorInput label="颜色" value={modular.color} onChange={(v) => updateModular({ color: v })} />
          </div>
        </div>
      )}

      {!activeType && (
        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', fontStyle: 'italic' }}>
          点击上方按钮启用网格
        </div>
      )}
    </div>
  )
}
