'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { getDrawLayerManager, Layer, LayerManagerEvent } from './DrawLayerManager'

interface DrawLayerPanelProps {
  isZh: boolean
  activePageId: string
}

const t = (en: string, zh: string, isZh: boolean) => isZh ? zh : en

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
        {displayed.map((layer, i) => {
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

              {/* Opacity */}
              <input
                type="range" min={0} max={1} step={0.05}
                value={layer.opacity ?? 1}
                onClick={e => e.stopPropagation()}
                onChange={e => handleOpacity(layer.id, Number(e.target.value))}
                title={t('Opacity', '不透明度', isZh)}
                style={{ width: '44px', accentColor: '#1a1a1a', cursor: 'pointer' }}
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