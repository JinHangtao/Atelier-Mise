'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getDrawLayerManager } from './DrawLayerManager'
import type { Layer } from './DrawLayerManager'

interface DrawLayerPanelProps {
  isZh: boolean
  activePageId: string
}

export default function DrawLayerPanel({ isZh, activePageId }: DrawLayerPanelProps) {
  const [layers, setLayers]   = useState<readonly Layer[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const mgr = getDrawLayerManager(activePageId)

  const sync = useCallback(() => {
    setLayers(mgr.getLayers())
    setActiveId(mgr.getActiveLayerId())
  }, [mgr])

  useEffect(() => {
    sync()
    mgr.on(sync)
    return () => mgr.off(sync)
  }, [mgr, sync])

  useEffect(() => {
    if (editingId && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [editingId])

  const commitName = () => {
    if (!editingId) return
    const name = editingName.trim()
    if (name) mgr.patchLayer(editingId, { name })
    setEditingId(null)
  }

  const startEdit = (layer: Layer, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(layer.id)
    setEditingName(layer.name)
  }

  // 展示顺序：顶层在上，所以 reverse
  const displayLayers = [...layers].reverse()

  const canMergeDown = (id: string) => {
    const idx = layers.findIndex(l => l.id === id)
    return idx > 0
  }

  return (
    <div
      onPointerDown={e => e.preventDefault()}
      style={{
      borderBottom: '1px solid rgba(26,26,26,0.08)',
      fontFamily: 'Inter, DM Sans, sans-serif',
      userSelect: 'none',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 12px 7px',
        borderBottom: '1px solid rgba(26,26,26,0.06)',
      }}>
        <span style={{
          fontSize: '0.6rem', letterSpacing: '0.14em', textTransform: 'uppercase',
          color: '#a0a09c', fontFamily: 'Space Mono, monospace', fontWeight: 600,
        }}>
          {isZh ? '图层' : 'Layers'}
        </span>
        <button
          onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
          onClick={() => mgr.addLayer()}
          title={isZh ? '新建图层' : 'New layer'}
          style={{
            width: 22, height: 22, borderRadius: 6,
            border: '1px solid rgba(26,26,26,0.14)',
            background: 'transparent', cursor: 'pointer',
            color: '#666', fontSize: '1rem', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.06)'; e.currentTarget.style.color = '#1a1a1a' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}
        >+</button>
      </div>

      {/* ── Layer list ── */}
      <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 6px' }}>
        {displayLayers.map(layer => {
          const isActive   = layer.id === activeId
          const isExpanded = layer.id === expandedId
          const isEditing  = layer.id === editingId

          return (
            <div key={layer.id}>
              {/* ── Main row ── */}
              <div
                onPointerDown={e => {
                  e.preventDefault() // 防止面板抢走 focus，保证画布 pointer 事件不中断
                  if ((e.target as HTMLElement).closest('button,input')) return
                  e.stopPropagation()
                  mgr.setActiveLayer(layer.id)
                  setExpandedId(isActive && isExpanded ? null : layer.id)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 6px', borderRadius: 7, cursor: 'pointer',
                  background: isActive
                    ? 'rgba(26,26,26,0.08)'
                    : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(26,26,26,0.14)' : 'transparent'}`,
                  transition: 'background 0.1s, border-color 0.1s',
                  opacity: layer.visible ? 1 : 0.45,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(26,26,26,0.04)' }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
              >
                {/* 可见性 */}
                <button
                  onClick={e => { e.stopPropagation(); mgr.patchLayer(layer.id, { visible: !layer.visible }) }}
                  onPointerDown={e => e.preventDefault()}
                  title={isZh ? '显示/隐藏' : 'Toggle visibility'}
                  style={{
                    width: 24, height: 24, flexShrink: 0,
                    border: layer.visible ? 'none' : '1px solid rgba(26,26,26,0.15)',
                    background: layer.visible ? 'transparent' : 'rgba(26,26,26,0.06)',
                    cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.78rem',
                    color: layer.visible ? '#1a1a1a' : '#bbb',
                    borderRadius: 5, transition: 'all 0.12s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = layer.visible ? 'rgba(26,26,26,0.07)' : 'rgba(26,26,26,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = layer.visible ? 'transparent' : 'rgba(26,26,26,0.06)')}
                >
                  {layer.visible ? '◉' : '◎'}
                  {/* 隐藏时加一条斜线 */}
                  {!layer.visible && (
                    <span style={{
                      position: 'absolute', inset: 0, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '1rem', color: '#aaa', pointerEvents: 'none',
                      lineHeight: 1,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" style={{ position: 'absolute' }}>
                        <line x1="2" y1="2" x2="12" y2="12" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </span>
                  )}
                </button>

                {/* 锁定 */}
                <button
                  onClick={e => { e.stopPropagation(); mgr.patchLayer(layer.id, { locked: !layer.locked }) }}
                  onPointerDown={e => e.preventDefault()}
                  title={isZh ? '锁定/解锁' : 'Toggle lock'}
                  style={{
                    width: 24, height: 24, flexShrink: 0,
                    border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.72rem', color: layer.locked ? '#c4a044' : '#ccc',
                    borderRadius: 4, transition: 'color 0.1s, background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.07)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {layer.locked ? '⚿' : '⚷'}
                </button>

                {/* 图层名 —— 双击改名 */}
                {isEditing ? (
                  <input
                    ref={nameInputRef}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingId(null) }}
                    onPointerDown={e => e.stopPropagation()}
                    style={{
                      flex: 1, fontSize: '0.72rem', fontFamily: 'Inter, DM Sans, sans-serif',
                      background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(26,26,26,0.2)',
                      borderRadius: 4, padding: '1px 5px', outline: 'none', color: '#1a1a1a',
                    }}
                  />
                ) : (
                  <span
                    onDoubleClick={e => startEdit(layer, e)}
                    title={isZh ? '双击改名' : 'Double-click to rename'}
                    style={{
                      flex: 1, fontSize: '0.72rem',
                      color: isActive ? '#1a1a1a' : '#555',
                      fontWeight: isActive ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {layer.name}
                  </span>
                )}

                {/* 不透明度数值 */}
                <span style={{
                  fontSize: '0.58rem', color: '#a0a09c',
                  fontFamily: 'Space Mono, monospace', flexShrink: 0, minWidth: 26, textAlign: 'right',
                }}>
                  {Math.round(layer.opacity * 100)}%
                </span>

                {/* 删除 */}
                <button
                  onClick={e => { e.stopPropagation(); if (layers.length > 1) mgr.deleteLayer(layer.id) }}
                  onPointerDown={e => e.preventDefault()}
                  title={isZh ? '删除图层' : 'Delete layer'}
                  disabled={layers.length <= 1}
                  style={{
                    width: 20, height: 20, flexShrink: 0,
                    border: 'none', background: 'transparent',
                    cursor: layers.length <= 1 ? 'not-allowed' : 'pointer', padding: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', color: '#ccc', borderRadius: 4,
                    transition: 'color 0.1s, background 0.1s',
                    opacity: layers.length <= 1 ? 0.3 : 1,
                  }}
                  onMouseEnter={e => { if (layers.length > 1) { e.currentTarget.style.color = '#e05c5c'; e.currentTarget.style.background = 'rgba(224,92,92,0.08)' } }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.background = 'transparent' }}
                >✕</button>
              </div>

              {/* ── Expanded controls（选中时展开）── */}
              {isActive && isExpanded && (
                <div style={{
                  margin: '2px 6px 4px',
                  padding: '8px 10px',
                  background: 'rgba(26,26,26,0.03)',
                  borderRadius: 7,
                  border: '1px solid rgba(26,26,26,0.07)',
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}>
                  {/* 不透明度滑块 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6rem', color: '#a0a09c', letterSpacing: '0.08em', minWidth: 44 }}>
                      {isZh ? '不透明' : 'Opacity'}
                    </span>
                    <input
                      type="range" min={0} max={100} step={1}
                      value={Math.round(layer.opacity * 100)}
                      onPointerDown={e => e.stopPropagation()}
                      onChange={e => mgr.patchLayer(layer.id, { opacity: Number(e.target.value) / 100 })}
                      style={{ flex: 1, height: 3, accentColor: '#1a1a1a', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '0.6rem', color: '#888', fontFamily: 'Space Mono, monospace', minWidth: 28, textAlign: 'right' }}>
                      {Math.round(layer.opacity * 100)}%
                    </span>
                  </div>

                  {/* 操作按钮行 */}
                  <div style={{ display: 'flex', gap: 5 }}>
                    <ActionBtn
                      label={isZh ? '↑ 上移' : '↑ Up'}
                      onClick={() => mgr.moveLayer(layer.id, 'up')}
                    />
                    <ActionBtn
                      label={isZh ? '↓ 下移' : '↓ Down'}
                      onClick={() => mgr.moveLayer(layer.id, 'down')}
                    />
                    <ActionBtn
                      label={isZh ? '⤓ 合并' : '⤓ Merge'}
                      onClick={() => mgr.mergeDown(layer.id)}
                      disabled={!canMergeDown(layer.id)}
                      title={isZh ? '向下合并图层' : 'Merge down'}
                    />
                    <ActionBtn
                      label={isZh ? '清空' : 'Clear'}
                      onClick={() => mgr.clearActiveLayer()}
                      danger
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 小操作按钮 ────────────────────────────────────────────────────────────────
function ActionBtn({ label, onClick, disabled, title, danger }: {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  danger?: boolean
}) {
  return (
    <button
      onPointerDown={e => { e.stopPropagation(); e.preventDefault() }}
      onClick={() => { if (!disabled) onClick() }}
      title={title}
      disabled={disabled}
      style={{
        flex: 1, padding: '4px 0', borderRadius: 6,
        border: `1px solid ${danger ? 'rgba(224,92,92,0.25)' : 'rgba(26,26,26,0.12)'}`,
        background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: '0.6rem', fontFamily: 'Inter, DM Sans, sans-serif',
        color: disabled ? '#ccc' : danger ? 'rgba(224,92,92,0.7)' : '#666',
        transition: 'all 0.1s', letterSpacing: '0.04em',
      }}
      onMouseEnter={e => {
        if (disabled) return
        e.currentTarget.style.background = danger ? 'rgba(224,92,92,0.07)' : 'rgba(26,26,26,0.05)'
        e.currentTarget.style.color = danger ? '#e05c5c' : '#1a1a1a'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = disabled ? '#ccc' : danger ? 'rgba(224,92,92,0.7)' : '#666'
      }}
    >
      {label}
    </button>
  )
}