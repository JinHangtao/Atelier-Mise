// ─────────────────────────────────────────────────────────────────────────────
// TextBlockContent.tsx — PPT-style inline text editing + floating toolbar
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/TextBlockContent.tsx
// ─────────────────────────────────────────────────────────────────────────────

'use client'
import React, { useRef, useEffect, useState } from 'react'
import { Block } from '../../../../lib/exportStyles'

// ── Config ───────────────────────────────────────────────────────────────────
const FONT_OPTIONS = [
  { label: 'Inter',      value: 'Inter, DM Sans, sans-serif' },
  { label: 'Serif',      value: 'Georgia, "Noto Serif SC", serif' },
  { label: 'Mono',       value: '"Space Mono", "Courier New", monospace' },
  { label: 'Elegant',    value: '"Cormorant Garamond", Georgia, serif' },
  { label: 'DM Serif',   value: '"DM Serif Display", Georgia, serif' },
  { label: '宋体',       value: '"Songti SC", "Noto Serif SC", serif' },
]

const COLOR_PRESETS = [
  '#1a1a1a', '#444444', '#888888', '#ffffff',
  '#c4a044', '#4aab6f', '#4a8abf', '#dc783c', '#e05c5c',
]

// ── Floating Toolbar ─────────────────────────────────────────────────────────
function FloatingToolbar({ block, onPatch }: {
  block: Block
  onPatch: (patch: Partial<Block>) => void
}) {
  const [fontOpen, setFontOpen] = useState(false)
  const [colorOpen, setColorOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)

  const fs = block.fontSize || 16
  const currentFontLabel = FONT_OPTIONS.find(f => f.value === block.fontFamily)?.label || 'Inter'

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setFontOpen(false)
        setColorOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const S: Record<string, React.CSSProperties> = {
    bar: {
      position: 'absolute', top: -44, left: 0, right: 0,
      display: 'flex', alignItems: 'center', gap: 3,
      background: 'rgba(22,22,22,0.9)', backdropFilter: 'blur(14px)',
      borderRadius: 10, padding: '4px 6px', zIndex: 30,
      boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      fontFamily: '"Space Mono", monospace', fontSize: '0.68rem',
      color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap',
    },
    btn: {
      background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.8)',
      cursor: 'pointer', padding: '4px 7px', borderRadius: 6,
      fontSize: '0.68rem', fontFamily: '"Space Mono", monospace',
      transition: 'background 0.1s', lineHeight: 1,
    },
    sep: {
      width: 1, height: 16, background: 'rgba(255,255,255,0.15)',
      margin: '0 2px', flexShrink: 0,
    },
    sizeVal: {
      color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem',
      minWidth: 26, textAlign: 'center' as const, userSelect: 'none' as const,
    },
    dropdown: {
      position: 'absolute' as const, top: '100%', marginTop: 4,
      background: 'rgba(22,22,22,0.95)', backdropFilter: 'blur(14px)',
      borderRadius: 10, padding: 5,
      boxShadow: '0 8px 28px rgba(0,0,0,0.35)', zIndex: 35,
      minWidth: 130,
    },
    dropItem: {
      width: '100%', textAlign: 'left' as const, padding: '6px 10px',
      borderRadius: 6, border: 'none', background: 'transparent',
      color: 'rgba(255,255,255,0.75)', cursor: 'pointer',
      fontSize: '0.72rem', fontFamily: '"Space Mono", monospace',
      transition: 'background 0.1s',
    },
    dropItemActive: {
      background: 'rgba(255,255,255,0.15)', color: '#fff',
    },
    colorDot: {
      width: 18, height: 18, borderRadius: '50%', border: '2px solid transparent',
      cursor: 'pointer', padding: 0, transition: 'border-color 0.1s, transform 0.1s',
    },
  }

  const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.background = 'transparent')

  return (
    <div ref={toolbarRef} style={S.bar} className="no-drag" onMouseDown={e => e.stopPropagation()}>

      {/* ── Font family dropdown ── */}
      <div style={{ position: 'relative' }}>
        <button style={{ ...S.btn, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { setFontOpen(p => !p); setColorOpen(false) }}>
          {currentFontLabel} ▾
        </button>
        {fontOpen && (
          <div style={{ ...S.dropdown, left: 0 }}>
            <button style={{ ...S.dropItem, ...(!block.fontFamily ? S.dropItemActive : {}) }}
              onClick={() => { onPatch({ fontFamily: undefined }); setFontOpen(false) }}>
              Default
            </button>
            {FONT_OPTIONS.map(f => (
              <button key={f.value}
                style={{ ...S.dropItem, fontFamily: f.value, ...(block.fontFamily === f.value ? S.dropItemActive : {}) }}
                onClick={() => { onPatch({ fontFamily: f.value }); setFontOpen(false) }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <span style={S.sep} />

      {/* ── Font size ── */}
      <button style={S.btn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        onClick={() => onPatch({ fontSize: Math.max(8, fs - 1) })}>−</button>
      <span style={S.sizeVal}>{fs}</span>
      <button style={S.btn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
        onClick={() => onPatch({ fontSize: Math.min(120, fs + 1) })}>+</button>

      <span style={S.sep} />

      {/* ── Color ── */}
      <div style={{ position: 'relative' }}>
        <button style={S.btn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onClick={() => { setColorOpen(p => !p); setFontOpen(false) }}>
          <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: '50%', background: block.color || '#1a1a1a', border: '1.5px solid rgba(255,255,255,0.4)', verticalAlign: 'middle' }} />
          <span style={{ marginLeft: 4, verticalAlign: 'middle' }}>▾</span>
        </button>
        {colorOpen && (
          <div style={{ ...S.dropdown, right: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: 4 }}>
              {COLOR_PRESETS.map(c => (
                <button key={c}
                  style={{
                    ...S.colorDot, background: c,
                    borderColor: (block.color || '#1a1a1a') === c ? 'rgba(255,255,255,0.8)' : 'transparent',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  onClick={() => { onPatch({ color: c }); setColorOpen(false) }} />
              ))}
            </div>
            <div style={{ padding: '5px 4px 2px', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="color" value={block.color || '#1a1a1a'}
                onChange={e => onPatch({ color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'none', padding: 0 }} />
              <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.4)' }}>{block.color || '#1a1a1a'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────
interface TextBlockContentProps {
  block: Block
  isEditing: boolean
  projectTitle?: string
  projectDescription?: string
  onSave: (blockId: string, patch: Partial<Block>) => void
  onStopEditing: () => void
}

export function TextBlockContent({
  block, isEditing, projectTitle, projectDescription,
  onSave, onStopEditing,
}: TextBlockContentProps) {
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (isEditing && ref.current) {
      ref.current.focus()
      const sel = window.getSelection()
      if (sel && ref.current.childNodes.length > 0) {
        sel.selectAllChildren(ref.current)
        sel.collapseToEnd()
      }
    }
  }, [isEditing])

  const handleBlur = () => {
    setTimeout(() => {
      if (!ref.current) return
      const active = document.activeElement
      // Don't exit if focus is still inside text or toolbar
      if (ref.current.contains(active) || ref.current === active) return
      if (active?.closest?.('.no-drag')) return
      const newText = ref.current.innerText || ''
      onSave(block.id, { content: newText })
      onStopEditing()
    }, 150)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      ref.current?.blur()
    }
  }

  const handlePatch = (patch: Partial<Block>) => {
    onSave(block.id, patch)
    setTimeout(() => ref.current?.focus(), 10)
  }

  const editStyle: React.CSSProperties = isEditing
    ? { outline: '1.5px dashed rgba(26,26,26,0.3)', outlineOffset: '3px', cursor: 'text', userSelect: 'text' }
    : { outline: 'none', cursor: 'grab', userSelect: 'none' }

  const sharedProps = {
    ref,
    contentEditable: isEditing,
    suppressContentEditableWarning: true as const,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    className: isEditing ? 'no-drag inline-editing' : '',
  }

  if (block.type === 'title') {
    return (
      <div style={{ position: 'relative' }}>
        {isEditing && <FloatingToolbar block={block} onPatch={handlePatch} />}
        <p {...sharedProps}
          style={{
            fontSize: block.fontSize ? `${block.fontSize}px` : '1.15rem',
            fontWeight: 600,
            color: block.color || '#1a1a1a',
            fontFamily: block.fontFamily || 'Inter, DM Sans, "PingFang SC", sans-serif',
            letterSpacing: '-0.01em',
            borderRadius: '4px', padding: '2px 4px', minHeight: '1em',
            ...editStyle,
          }}>
          {projectTitle || block.content}
        </p>
        {projectDescription && (
          <p style={{ fontSize: '0.88rem', color: '#999', marginTop: '5px', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.6 }}>
            {projectDescription.slice(0, 120)}…
          </p>
        )}
      </div>
    )
  }

  if (block.type === 'note') {
    return (
      <div style={{ position: 'relative' }}>
        {isEditing && <FloatingToolbar block={block} onPatch={handlePatch} />}
        <p {...sharedProps}
          style={{
            fontSize: block.fontSize ? `${block.fontSize}px` : '0.92rem',
            color: block.color || '#444',
            lineHeight: 1.72,
            fontFamily: block.fontFamily || 'Inter, DM Sans, "PingFang SC", sans-serif',
            borderRadius: '4px', padding: '2px 4px', minHeight: '1em',
            ...editStyle,
          }}>
          {block.content}
        </p>
        {block.caption && (
          <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '6px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {block.caption}
          </p>
        )}
      </div>
    )
  }

  if (block.type === 'custom') {
    return (
      <div style={{ position: 'relative' }}>
        {isEditing && <FloatingToolbar block={block} onPatch={handlePatch} />}
        <p {...sharedProps}
          style={{
            fontSize: block.fontSize ? `${block.fontSize}px` : '0.92rem',
            color: block.color || '#444',
            lineHeight: 1.72,
            whiteSpace: 'pre-wrap',
            fontFamily: block.fontFamily || 'Inter, DM Sans, "PingFang SC", sans-serif',
            borderRadius: '4px', padding: '2px 4px', minHeight: '1em',
            ...editStyle,
          }}>
          {block.content}
        </p>
      </div>
    )
  }

  return null
}