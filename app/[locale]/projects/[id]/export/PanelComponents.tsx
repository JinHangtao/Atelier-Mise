'use client'
// ─────────────────────────────────────────────────────────────────────────────
// PanelComponents — 右侧面板里所有独立小组件
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/PanelComponents.tsx
//
// 在 page.tsx 里这样引入：
//   import { PanelButton, DraftBanner, ThemePickerPanel, PagesPanel, CoverEditor } from './PanelComponents'
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef } from 'react'
import { Block, ExportOptions, THEMES, FONTS } from '../../../../../lib/exportStyles'
import { Project } from '../../../../../types'
import { Aspect, Page } from './types'
import { aspectLabel, generateId, pageHeight } from './pageHelpers'

// ── PanelButton ───────────────────────────────────────────────────────────────

export function PanelButton({
  onClick, label, icon,
}: {
  onClick: () => void
  label: string
  icon?: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '10px 13px', marginBottom: '6px',
        border: '1px solid rgba(26,26,26,0.09)', borderRadius: '9px',
        background: 'transparent', cursor: 'pointer',
        fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem',
        color: '#3a3a3a', textAlign: 'left', letterSpacing: '0.02em',
        display: 'flex', alignItems: 'center', gap: '9px',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.03)'; e.currentTarget.style.borderColor = 'rgba(26,26,26,0.18)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(26,26,26,0.09)' }}
    >
      {icon && <span style={{ fontSize: '0.75rem', color: '#bbb', minWidth: '14px' }}>{icon}</span>}
      <span>+ {label}</span>
    </button>
  )
}

// ── DraftBanner ───────────────────────────────────────────────────────────────

export function DraftBanner({
  pageCount, isZh, onClear,
}: {
  pageCount: number
  isZh: boolean
  onClear: () => void
}) {
  const [visible, setVisible] = useState(true)
  const [countdown, setCountdown] = useState(5)

  React.useEffect(() => {
    if (!visible) return
    if (countdown <= 0) { setVisible(false); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [countdown, visible])

  if (!visible) return null

  return (
    <div className="draft-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(74,171,111,0.08)', border: '1px solid rgba(74,171,111,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#4aab6f', fontSize: '0.8rem' }}>●</span>
        <span style={{ fontSize: '0.8rem', color: '#3a8a58', letterSpacing: '0.04em' }}>
          {isZh ? `已恢复上次草稿（${pageCount} 页）` : `Draft restored — ${pageCount} page${pageCount !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '0.68rem', color: '#7abf96', fontFamily: 'Space Mono, monospace', minWidth: '14px', textAlign: 'right' }}>{countdown}</span>
        <button
          onClick={() => setVisible(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7abf96', fontSize: '0.9rem', lineHeight: 1, padding: '2px 4px', borderRadius: '4px', transition: 'color 0.12s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#3a8a58')}
          onMouseLeave={e => (e.currentTarget.style.color = '#7abf96')}
        >✕</button>
      </div>
    </div>
  )
}

// ── ThemePickerPanel ──────────────────────────────────────────────────────────

const THEME_PREVIEWS: Record<string, { bg: string; card: string; line1: string; line2: string; accent: string }> = {
  sensei:    { bg: '#f4f2ee', card: '#fff',     line1: '#1a1a1a', line2: '#c0c0bc', accent: '#4aab6f' },
  editorial: { bg: '#fff',    card: '#fff',     line1: '#1a1a1a', line2: '#999',    accent: '#1a1a1a' },
  noir:      { bg: '#111',    card: '#1c1c1c',  line1: '#f0f0ee', line2: '#666',    accent: '#4aab6f' },
  cream:     { bg: '#fdf8f0', card: '#fffdf7',  line1: '#2c2416', line2: '#c8b89a', accent: '#c4943a' },
  minimal:   { bg: '#fff',    card: '#fff',     line1: '#1a1a1a', line2: '#ddd',    accent: '#1a1a1a' },
  blueprint: { bg: '#0d1b2a', card: '#102236',  line1: '#d4e8ff', line2: '#2a4a6a', accent: '#4db8ff' },
  ember:     { bg: '#1a0f0a', card: '#231510',  line1: '#f0e0d0', line2: '#4a2a1a', accent: '#dc783c' },
  gallery:   { bg: '#f8f8f6', card: '#fff',     line1: '#1a1a1a', line2: '#ddd',    accent: '#999'    },
}

export function ThemePickerPanel({
  opts, setOpts, isZh,
}: {
  opts: ExportOptions
  setOpts: (o: ExportOptions) => void
  isZh: boolean
}) {
  const set = (patch: Partial<ExportOptions>) => setOpts({ ...opts, ...patch })

  const sectionLabel: React.CSSProperties = {
    fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase',
    color: '#b0b0ac', marginBottom: '10px', display: 'block',
    fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600,
  }
  const chipBase: React.CSSProperties = {
    fontSize: '0.72rem', padding: '5px 11px', borderRadius: '20px', cursor: 'pointer',
    border: '1px solid rgba(26,26,26,0.12)', fontFamily: 'Inter, DM Sans, sans-serif',
    letterSpacing: '0.02em', transition: 'all 0.12s', whiteSpace: 'nowrap',
  }
  const chipActive: React.CSSProperties = { background: '#1a1a1a', color: '#f7f7f5', borderColor: '#1a1a1a' }
  const chipIdle: React.CSSProperties = { background: 'transparent', color: '#555' }

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ ...chipBase, ...(active ? chipActive : chipIdle) }}>{label}</button>
  )

  return (
    <div>
      <span style={sectionLabel}>{isZh ? '主题风格' : 'Theme'}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '20px' }}>
        {Object.entries(THEMES).map(([key, t]) => {
          const p = THEME_PREVIEWS[key]
          const active = opts.theme === key
          return (
            <button key={key} onClick={() => set({ theme: key })}
              style={{ padding: '0', border: active ? '2px solid #1a1a1a' : '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: 'transparent', transition: 'border-color 0.12s' }}>
              <div style={{ background: p.bg, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ background: p.card, borderRadius: '4px', padding: '5px 7px', border: `1px solid rgba(${p.card === '#fff' ? '0,0,0' : '255,255,255'},0.07)` }}>
                  <div style={{ width: '55%', height: '5px', background: p.line1, borderRadius: '2px', marginBottom: '3px', opacity: 0.85 }} />
                  <div style={{ width: '80%', height: '3px', background: p.line2, borderRadius: '2px' }} />
                </div>
                <div style={{ background: p.card, borderRadius: '4px', padding: '4px 7px', borderLeft: `2.5px solid ${p.accent}`, border: `1px solid rgba(${p.card === '#fff' ? '0,0,0' : '255,255,255'},0.07)`, borderLeftColor: p.accent }}>
                  <div style={{ width: '70%', height: '3px', background: p.line2, borderRadius: '2px' }} />
                </div>
              </div>
              <div style={{ background: p.card, borderTop: `1px solid rgba(0,0,0,0.06)`, padding: '5px 10px', textAlign: 'left' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: p.line1, fontFamily: 'Inter, DM Sans, sans-serif', display: 'block' }}>{t.label}</span>
                <span style={{ fontSize: '0.6rem', color: p.line2, fontFamily: 'Inter, DM Sans, sans-serif' }}>{t.labelZh}</span>
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '18px' }} />

      <span style={sectionLabel}>{isZh ? '字体' : 'Font'}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '18px' }}>
        {Object.entries(FONTS).map(([key, f]) =>
          chip(isZh ? f.labelZh : f.label, opts.font === key, () => set({ font: key }))
        )}
      </div>

      <span style={sectionLabel}>{isZh ? '版心宽度' : 'Page width'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([680, 800, 960, 1100] as const).map(w =>
          chip(`${w}px`, opts.width === w, () => set({ width: w }))
        )}
      </div>

      <span style={sectionLabel}>{isZh ? '卡片圆角' : 'Corner radius'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([0, 8, 16, 24] as const).map(r =>
          chip(
            r === 0 ? (isZh ? '直角' : 'Sharp') :
            r === 8 ? (isZh ? '小' : 'Small') :
            r === 16 ? (isZh ? '中' : 'Med') :
            (isZh ? '大' : 'Large'),
            opts.radius === r,
            () => set({ radius: r }),
          )
        )}
      </div>

      <span style={sectionLabel}>{isZh ? '块间距' : 'Block spacing'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {chip(isZh ? '紧凑' : 'Tight',   opts.gap === 8,  () => set({ gap: 8 }))}
        {chip(isZh ? '标准' : 'Normal',  opts.gap === 20, () => set({ gap: 20 }))}
        {chip(isZh ? '宽松' : 'Loose',   opts.gap === 36, () => set({ gap: 36 }))}
      </div>

      <span style={sectionLabel}>{isZh ? '图片显示' : 'Image display'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
        {chip(isZh ? '横幅 16:9' : 'Banner 16:9', opts.imageStyle === 'cover',   () => set({ imageStyle: 'cover' }))}
        {chip(isZh ? '正方形' : 'Square',          opts.imageStyle === 'square',  () => set({ imageStyle: 'square' }))}
        {chip(isZh ? '完整显示' : 'Full',           opts.imageStyle === 'contain', () => set({ imageStyle: 'contain' }))}
      </div>
    </div>
  )
}

// ── PagesPanel ────────────────────────────────────────────────────────────────

export function PagesPanel({
  pages, activePageId, setActivePageId,
  onAdd, onDelete, onDuplicate, onReorder, onRename, onAspectChange,
  isZh, contentWidth = 860,
}: {
  pages: Page[]
  activePageId: string
  setActivePageId: (id: string) => void
  onAdd: (aspect: Aspect) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onReorder: (fromIndex: number, toIndex: number) => void
  onRename: (id: string, label: string) => void
  onAspectChange: (id: string, aspect: Aspect) => void
  isZh: boolean
  contentWidth?: number
}) {
  const dragIdx = useRef<number | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [showAddMenu, setShowAddMenu] = useState(false)

  const ASPECTS: Aspect[] = ['free', '16:9', 'A4', '1:1', '4:3']

  return (
    <div style={{ padding: '20px 16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
        {pages.map((page, idx) => {
          const isActive = page.id === activePageId
          const isCover = page.isCover
          return (
            <div
              key={page.id}
              draggable={!isCover}
              onDragStart={() => { if (!isCover) dragIdx.current = idx }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragIdx.current !== null && dragIdx.current !== idx && !isCover) {
                  onReorder(dragIdx.current, idx)
                }
                dragIdx.current = null
              }}
              onClick={() => setActivePageId(page.id)}
              style={{
                border: isActive ? `2px solid ${isCover ? '#c4a044' : '#1a1a1a'}` : `1px solid rgba(26,26,26,${isCover ? '0.2' : '0.09'})`,
                borderRadius: '10px', padding: '10px 12px',
                background: isActive ? (isCover ? 'rgba(196,160,68,0.06)' : 'rgba(26,26,26,0.03)') : '#fff',
                cursor: 'pointer', transition: 'all 0.12s', position: 'relative',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: renamingId === page.id ? '8px' : '0' }}>
                {!isCover && <span style={{ color: '#ddd', fontSize: '0.75rem', cursor: 'grab', flexShrink: 0, userSelect: 'none' }}>⠿</span>}
                {isCover  && <span style={{ color: '#c4a044', fontSize: '0.72rem', flexShrink: 0 }}>★</span>}

                {renamingId === page.id ? (
                  <input autoFocus value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onBlur={() => { onRename(page.id, renameVal || page.label); setRenamingId(null) }}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  { onRename(page.id, renameVal || page.label); setRenamingId(null) }
                      if (e.key === 'Escape') setRenamingId(null)
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{ flex: 1, padding: '3px 8px', border: '1px solid rgba(26,26,26,0.25)', borderRadius: '5px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', outline: 'none', background: '#fff' }}
                  />
                ) : (
                  <span
                    onDoubleClick={e => { e.stopPropagation(); setRenamingId(page.id); setRenameVal(page.label) }}
                    style={{ flex: 1, fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#1a1a1a', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    title={isZh ? '双击重命名' : 'Double-click to rename'}
                  >
                    {page.label}
                  </span>
                )}

                <span style={{ fontSize: '0.58rem', letterSpacing: '0.06em', color: isCover ? '#c4a044' : '#aaa', background: isCover ? 'rgba(196,160,68,0.1)' : 'rgba(26,26,26,0.05)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'Space Mono, monospace', flexShrink: 0 }}>
                  {aspectLabel(page.aspect)}
                </span>
              </div>

              {renamingId !== page.id && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#c4c4c0', fontFamily: 'Space Mono, monospace' }}>
                    {page.blocks.length} {isZh ? '块' : 'block'}{page.blocks.length !== 1 && !isZh ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <select value={page.aspect}
                      onChange={e => { e.stopPropagation(); onAspectChange(page.id, e.target.value as Aspect) }}
                      onClick={e => e.stopPropagation()}
                      style={{ fontSize: '0.6rem', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '4px', background: 'transparent', color: '#888', fontFamily: 'Space Mono, monospace', padding: '2px 4px', cursor: 'pointer', outline: 'none' }}>
                      {ASPECTS.map(a => <option key={a} value={a}>{aspectLabel(a)}</option>)}
                    </select>
                    <button onClick={e => { e.stopPropagation(); onDuplicate(page.id) }} title={isZh ? '克隆此页' : 'Duplicate page'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: '0.78rem', padding: '2px 5px', borderRadius: '4px', transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#555')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>⧉</button>
                    {!isCover && pages.length > 1 && (
                      <button onClick={e => { e.stopPropagation(); if (window.confirm(isZh ? '删除此页？' : 'Delete this page?')) onDelete(page.id) }} title={isZh ? '删除此页' : 'Delete page'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(180,80,80,0.4)', fontSize: '0.78rem', padding: '2px 5px', borderRadius: '4px', transition: 'color 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}>✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* 展开：图片图层面板 */}

            </div>
          )
        })}
      </div>

      {/* Add page */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setShowAddMenu(m => !m)}
          style={{ width: '100%', padding: '10px', border: '1.5px dashed rgba(26,26,26,0.18)', borderRadius: '9px', background: 'transparent', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.78rem', color: '#aaa', letterSpacing: '0.06em', transition: 'all 0.12s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.4)'; e.currentTarget.style.color = '#555' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.18)'; e.currentTarget.style.color = '#aaa' }}>
          + {isZh ? '新增页面' : 'New page'}
        </button>

        {showAddMenu && (
          <div
            style={{ position: 'absolute', bottom: '110%', left: 0, right: 0, background: '#fff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', zIndex: 50, animation: 'fadeIn 0.12s ease' }}
            onMouseLeave={() => setShowAddMenu(false)}
          >
            <p style={{ fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c4c4c0', padding: '4px 8px 6px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
              {isZh ? '选择比例' : 'Choose ratio'}
            </p>
            {(['free', '16:9', 'A4', '1:1', '4:3'] as Aspect[]).map(a => (
              <button key={a} onClick={() => { onAdd(a); setShowAddMenu(false) }}
                style={{ width: '100%', padding: '8px 10px', border: 'none', background: 'transparent', borderRadius: '6px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.8rem', color: '#1a1a1a', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span>{aspectLabel(a)}</span>
                <span style={{ fontSize: '0.65rem', color: '#bbb', fontFamily: 'Space Mono, monospace' }}>
                  {a === 'free' ? (isZh ? '自由高度' : 'Scroll') : a === 'A4' ? '210×297' : a === '16:9' ? '1920×1080' : a === '1:1' ? '1:1' : '4:3'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CoverEditor ───────────────────────────────────────────────────────────────

const COVER_TEMPLATES = [
  {
    id: 'hero', label: 'Hero', labelZh: '大字流',
    preview: { bg: '#1a1a1a', text: '#f7f7f5' },
    blocks: (title: string, desc: string): Block[] => [
      { id: generateId(), type: 'title', content: title, caption: desc, pixelPos: { x: 0, y: 0, w: 860, h: 380 } },
    ],
  },
  {
    id: 'editorial', label: 'Editorial', labelZh: '编辑风',
    preview: { bg: '#fff', text: '#1a1a1a' },
    blocks: (title: string, desc: string): Block[] => [
      { id: generateId(), type: 'title', content: title, caption: desc, pixelPos: { x: 40, y: 60, w: 780, h: 280 } },
      { id: generateId(), type: 'custom', content: '— Portfolio', caption: '', pixelPos: { x: 40, y: 360, w: 280, h: 100 } },
    ],
  },
  {
    id: 'minimal', label: 'Minimal', labelZh: '极简线条',
    preview: { bg: '#f7f7f5', text: '#1a1a1a' },
    blocks: (title: string, desc: string): Block[] => [
      { id: generateId(), type: 'title', content: title, caption: '', pixelPos: { x: 0, y: 120, w: 860, h: 220 } },
      { id: generateId(), type: 'note', content: desc, caption: '', pixelPos: { x: 140, y: 360, w: 580, h: 100 } },
    ],
  },
  {
    id: 'split', label: 'Split', labelZh: '左右分栏',
    preview: { bg: '#fdf8f0', text: '#2c2416' },
    blocks: (title: string, desc: string): Block[] => [
      { id: generateId(), type: 'title', content: title, caption: '', pixelPos: { x: 430, y: 60, w: 400, h: 280 } },
      { id: generateId(), type: 'note', content: desc, caption: '', pixelPos: { x: 430, y: 360, w: 400, h: 160 } },
    ],
  },
]

export function CoverEditor({
  page, project, onBlocksChange, isZh,
}: {
  page: Page
  project: Project
  onBlocksChange: (blocks: Block[]) => void
  isZh: boolean
}) {
  const applyTemplate = (tpl: typeof COVER_TEMPLATES[0]) => {
    onBlocksChange(tpl.blocks(project.title, project.description || ''))
  }

  return (
    <div style={{ padding: '24px 20px' }}>
      <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '14px', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600 }}>
        {isZh ? '封面模版' : 'Cover templates'}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
        {COVER_TEMPLATES.map(tpl => (
          <button key={tpl.id} onClick={() => applyTemplate(tpl)}
            style={{ border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: 'transparent', padding: 0, transition: 'border-color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.35)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)')}>
            <div style={{ background: tpl.preview.bg, padding: '14px 12px', height: '52px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
              <div style={{ width: '65%', height: '6px', background: tpl.preview.text, borderRadius: '2px', opacity: 0.9 }} />
              <div style={{ width: '45%', height: '3px', background: tpl.preview.text, borderRadius: '2px', opacity: 0.35 }} />
            </div>
            <div style={{ padding: '6px 10px', borderTop: '1px solid rgba(26,26,26,0.07)', background: '#fafaf8', textAlign: 'left' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif', display: 'block' }}>
                {isZh ? tpl.labelZh : tpl.label}
              </span>
            </div>
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.72rem', color: '#c0c0bc', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.55 }}>
        {isZh ? '选一个模版开始，然后在画布上自由编辑 blocks。' : 'Pick a template to start, then freely edit blocks on the canvas.'}
      </p>
    </div>
  )
}