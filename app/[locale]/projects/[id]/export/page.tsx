'use client'
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useLocalStorage } from '../../../../../hooks/useLocalStorage'
import { Project } from '../../../../../types'
import { exportPDF, exportDOCX } from '../../../../../lib/exportProject'
import { useParams, usePathname, useRouter } from 'next/navigation'

import {
  Block, School, ExportOptions, DEFAULT_EXPORT_OPTIONS,
  THEMES, FONTS, buildExportHTML,
} from '../../../../../lib/exportStyles'
import { Rnd } from 'react-rnd'
import GridLayout from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'

type BlockType = 'title' | 'image' | 'image-row' | 'note' | 'custom' | 'milestone' | 'school-profile'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'


// ── Helpers ───────────────────────────────────────────────────────────────────
function draftKey(projectId: string) { return `ps-export-draft-${projectId}` }
function optKey(projectId: string) { return `ps-export-opts-${projectId}` }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2) }

// ── Sub-components ────────────────────────────────────────────────────────────
function PanelButton({ onClick, label, icon }: { onClick: () => void; label: string; icon?: string }) {
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

function DraftBanner({ blocks, isZh, onClear }: { blocks: Block[]; isZh: boolean; onClear: () => void }) {
  const [visible, setVisible] = useState(true)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
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
          {isZh ? `已恢复上次草稿（${blocks.length} 个块）` : `Draft restored — ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`}
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

// ── Theme Picker panel ────────────────────────────────────────────────────────
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

function ThemePickerPanel({
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
      {/* ── 主题 ── */}
      <span style={sectionLabel}>{isZh ? '主题风格' : 'Theme'}</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '20px' }}>
        {Object.entries(THEMES).map(([key, t]) => {
          const p = THEME_PREVIEWS[key]
          const active = opts.theme === key
          return (
            <button
              key={key}
              onClick={() => set({ theme: key })}
              style={{
                padding: '0', border: active ? '2px solid #1a1a1a' : '1px solid rgba(26,26,26,0.1)',
                borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', background: 'transparent',
                transition: 'border-color 0.12s',
              }}
            >
              {/* mini preview */}
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

      {/* ── 字体 ── */}
      <span style={sectionLabel}>{isZh ? '字体' : 'Font'}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '18px' }}>
        {Object.entries(FONTS).map(([key, f]) =>
          chip(isZh ? f.labelZh : f.label, opts.font === key, () => set({ font: key }))
        )}
      </div>

      {/* ── 版心宽度 ── */}
      <span style={sectionLabel}>{isZh ? '版心宽度' : 'Page width'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([680, 800, 960, 1100] as const).map(w =>
          chip(`${w}px`, opts.width === w, () => set({ width: w }))
        )}
      </div>

      {/* ── 圆角 ── */}
      <span style={sectionLabel}>{isZh ? '卡片圆角' : 'Corner radius'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([0, 8, 16, 24] as const).map(r =>
          chip(r === 0 ? (isZh ? '直角' : 'Sharp') : r === 8 ? (isZh ? '小' : 'Small') : r === 16 ? (isZh ? '中' : 'Med') : (isZh ? '大' : 'Large'), opts.radius === r, () => set({ radius: r }))
        )}
      </div>

      {/* ── 块间距 ── */}
      <span style={sectionLabel}>{isZh ? '块间距' : 'Block spacing'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {chip(isZh ? '紧凑' : 'Tight', opts.gap === 8, () => set({ gap: 8 }))}
        {chip(isZh ? '标准' : 'Normal', opts.gap === 20, () => set({ gap: 20 }))}
        {chip(isZh ? '宽松' : 'Loose', opts.gap === 36, () => set({ gap: 36 }))}
      </div>

      {/* ── 图片裁切 ── */}
      <span style={sectionLabel}>{isZh ? '图片显示' : 'Image display'}</span>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '4px', flexWrap: 'wrap' }}>
        {chip(isZh ? '横幅 16:9' : 'Banner 16:9', opts.imageStyle === 'cover', () => set({ imageStyle: 'cover' }))}
        {chip(isZh ? '正方形' : 'Square', opts.imageStyle === 'square', () => set({ imageStyle: 'square' }))}
        {chip(isZh ? '完整显示' : 'Full', opts.imageStyle === 'contain', () => set({ imageStyle: 'contain' }))}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ExportPage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')
  const id = params.id as string

  const [projects, setProjects] = useLocalStorage<Project[]>('ps-projects', [])
  const [schools] = useLocalStorage<School[]>('ps-schools', [])
  const project = projects.find(p => p.id === id)

  // ── Export options: persisted per project ──
  const [exportOpts, setExportOptsRaw] = useState<ExportOptions>(() => {
    if (typeof window === 'undefined') return DEFAULT_EXPORT_OPTIONS
    try {
      const saved = localStorage.getItem(optKey(id))
      if (saved) return { ...DEFAULT_EXPORT_OPTIONS, ...JSON.parse(saved) }
    } catch {}
    return DEFAULT_EXPORT_OPTIONS
  })

  const setExportOpts = useCallback((opts: ExportOptions) => {
    setExportOptsRaw(opts)
    try { localStorage.setItem(optKey(id), JSON.stringify(opts)) } catch {}
  }, [id])

  // ── Blocks ──
  const [blocks, setBlocksRaw] = useState<Block[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(draftKey(id))
      if (saved) return JSON.parse(saved) as Block[]
    } catch {}
    return []
  })

  const [justRestored] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = localStorage.getItem(draftKey(id))
      return !!saved && JSON.parse(saved).length > 0
    } catch { return false }
  })

  // ── Undo ──
  const undoStack = useRef<Block[][]>([])
  const isUndoing = useRef(false)

  const setBlocks = useCallback((updater: Block[] | ((prev: Block[]) => Block[])) => {
    setBlocksRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (!isUndoing.current) undoStack.current = [...undoStack.current.slice(-49), prev]
      return next
    })
  }, [])

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    isUndoing.current = true
    setBlocksRaw(prev)
    isUndoing.current = false
  }, [])

  // ── Auto-save blocks ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return }
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(id), JSON.stringify(blocks))
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch { setSaveStatus('error') }
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [blocks, id])

  // ── Keyboard undo ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  // 原生 wheel 监听（non-passive），让 preventDefault 生效
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const MIN_ZOOM = 0.3, MAX_ZOOM = 3
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey) {
        // 触控板双指捏合缩放
        e.preventDefault()
        setCanvasZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z - e.deltaY * 0.008).toFixed(3))))
      } else if (e.altKey) {
        // Alt + 滚轮：只缩放，完全阻止任何滚动
        e.preventDefault()
        e.stopPropagation()
        setCanvasZoom(z => {
          const delta = e.deltaY > 0 ? -0.08 : 0.08
          return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2)))
        })
      } else {
        // 双指平移
        e.preventDefault()
        const wrap = canvasWrapRef.current
        const W = wrap ? wrap.offsetWidth : 800
        const H = wrap ? wrap.offsetHeight : 600
        const MARGIN = 120
        setCanvasPan(p => ({
          x: Math.min(W - MARGIN, Math.max(-(W * 2), p.x - e.deltaX)),
          y: Math.min(H - MARGIN, Math.max(-(H * 4), p.y - e.deltaY)),
        }))
      }
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey(id)) } catch {}
    setBlocksRaw([])
    undoStack.current = []
    setSaveStatus('idle')
  }, [id])

  // ── Local state ──
  const [customText, setCustomText] = useState('')
  const [schoolsExpanded, setSchoolsExpanded] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingCaption, setEditingCaption] = useState('')
  const [editingImageCaptions, setEditingImageCaptions] = useState<string[]>([])
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [rightTab, setRightTab] = useState<'blocks' | 'style'>('blocks')
  const [imageEditorUrl, setImageEditorUrl] = useState<string | null>(null)
  const [imageEditorIdx, setImageEditorIdx] = useState<number | null>(null)
  const [pagedExport, setPagedExport] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const dragIndex = useRef<number | null>(null)
  const imageDragIndex = useRef<number | null>(null)
  const localImageInputRef = useRef<HTMLInputElement | null>(null)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 })
  const isPanning = useRef(false)
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const canvasWrapRef = useRef<HTMLDivElement | null>(null)

  // 浮动工具卡片：6个锚点吸附
  type Anchor = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
  const [toolbarAnchor, setToolbarAnchor] = useState<Anchor>('top-center')
  const [toolbarDragging, setToolbarDragging] = useState(false)
  const [toolbarDragPos, setToolbarDragPos] = useState<{ x: number; y: number } | null>(null)
  const toolbarDragStart = useRef<{ mx: number; my: number; ex: number; ey: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; gridX: number; gridY: number } | null>(null)
  const ctxImageInputRef = useRef<HTMLInputElement | null>(null)

  const addBlockAt = (type: BlockType, content: string, gridX: number, gridY: number, caption?: string, images?: string[]) => {
    const defaultH = type === 'image' || type === 'image-row' ? 6 : type === 'title' ? 4 : 3
    const defaultW = type === 'title' ? 12 : 6
    setBlocks(b => [...b, {
      id: generateId(), type, content, caption, images,
      gridPos: { x: Math.min(gridX, 12 - defaultW), y: gridY, w: defaultW, h: defaultH }
    }])
  }

  if (!project) return (
    <div style={{ padding: '60px', fontFamily: 'Space Mono, monospace', color: '#888' }}>
      {isZh ? '找不到项目' : 'Project not found'}
    </div>
  )

  const compressImage = (dataUrl: string, maxW = 1200, quality = 0.82): Promise<string> =>
    new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        // 检测是否含透明像素，有则保留 PNG
        const pixels = ctx.getImageData(0, 0, w, h).data
        let hasAlpha = false
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 255) { hasAlpha = true; break }
        }
        resolve(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })

  const addToMediaLibrary = (dataUrl: string) => {
    compressImage(dataUrl).then(compressed => {
      setProjects(ps => ps.map(p => p.id === id ? { ...p, mediaUrls: [...(p.mediaUrls || []), compressed] } : p))
    })
  }

  const addBlock = (type: BlockType, content: string, caption?: string, images?: string[]) => {
    setBlocks(b => {
      // 计算新block的y坐标：放在所有现有block的下方
      const maxY = b.reduce((acc, bl) => {
        const pos = bl.gridPos
        return pos ? Math.max(acc, pos.y + pos.h) : acc
      }, 0)
      const defaultH = type === 'image' || type === 'image-row' ? 6 : type === 'title' ? 4 : 3
      const newBlock = {
        id: generateId(), type, content, caption, images,
        gridPos: { x: 0, y: maxY, w: 12, h: defaultH }
      }
      return [...b, newBlock]
    })
  }
  const removeBlock = (blockId: string) => setBlocks(b => b.filter(x => x.id !== blockId))
  const moveBlock = (from: number, to: number) => {
    setBlocks(b => { const arr = [...b]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); return arr })
  }
  const startEdit = (block: Block) => {
    setEditingBlockId(block.id)
    setEditingContent(block.content)
    setEditingCaption(block.caption || '')
    setEditingImageCaptions(block.imageCaptions || (block.type === 'image' ? [''] : (block.images || []).map(() => '')))
  }
  const saveEdit = () => {
    setBlocks(b => b.map(block =>
      block.id === editingBlockId
        ? { ...block, content: editingContent, caption: editingCaption, imageCaptions: editingImageCaptions }
        : block
    ))
    setEditingBlockId(null)
  }
  const cancelEdit = () => setEditingBlockId(null)
  const toggleImageSelection = (url: string) =>
    setSelectedImages(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])
  const addImageRow = () => {
    if (selectedImages.length === 0) return
    if (selectedImages.length === 1) addBlock('image', selectedImages[0])
    else addBlock('image-row', '', '', selectedImages)
    setSelectedImages([])
    setImagePickerOpen(false)
  }

  const doExportHTML = () => {
    if (!project) return
    const html = buildExportHTML(blocks, project, schools, exportOpts, isZh, pagedExport)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/\s+/g, '_')}_${exportOpts.theme}${pagedExport ? '_paged' : ''}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleSchools = schoolsExpanded ? schools : schools.slice(0, 3)
  const mediaUrls = project.mediaUrls || []

  // ── Tab pill style ──
  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', fontSize: '0.72rem', letterSpacing: '0.08em',
    fontFamily: 'Inter, DM Sans, sans-serif', border: 'none', cursor: 'pointer',
    borderRadius: '7px', transition: 'all 0.12s',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#f7f7f5' : '#aaa',
  })

  return (
    <main style={{ height: '100vh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {imageEditorUrl !== null && imageEditorIdx !== null && (
        <ImageEditor
          src={imageEditorUrl}
          isZh={isZh}
          onSave={dataUrl => {
            const blockId = (window as any).__editingBlockId
            const imgIdx = (window as any).__editingImageIdx ?? null
            if (blockId) {
              setBlocks(b => b.map(bl => {
                if (bl.id !== blockId) return bl
                if (bl.type === 'image') return { ...bl, content: dataUrl }
                if (bl.type === 'image-row' && imgIdx !== null) {
                  const imgs = [...(bl.images || [])]
                  imgs[imgIdx] = dataUrl
                  return { ...bl, images: imgs }
                }
                return bl
              }))
            }
            setImageEditorUrl(null)
            setImageEditorIdx(null)
          }}
          onClose={() => { setImageEditorUrl(null); setImageEditorIdx(null) }}
        />
      )}
      <style>{`
        .school-item:hover { background: rgba(26,26,26,0.03) !important; }
        .img-thumb { transition: transform 0.15s, box-shadow 0.15s; }
        .img-thumb:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        .img-thumb.selected { outline: 2.5px solid #1a1a1a; outline-offset: 2px; }
        .img-row-item:hover .img-row-del { opacity: 1 !important; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .draft-banner { animation: fadeIn 0.3s ease; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '0 32px', borderBottom: '1px solid rgba(26,26,26,0.1)', background: '#ffffff', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '52px', gap: '16px' }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '0.78rem', letterSpacing: '0.12em', fontFamily: 'Inter, DM Sans, sans-serif', flexShrink: 0, padding: '0', transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>
            ← {isZh ? '返回' : 'Back'}
          </button>
          <span style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.1)', flexShrink: 0 }} />
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.06em', color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>
            {project.title}
          </span>
          <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#ccc', fontFamily: 'Inter, DM Sans, sans-serif', flexShrink: 0 }}>
            {isZh ? '导出编辑器' : 'Export Editor'}
          </span>
        </div>

        {/* Center: save status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {saveStatus === 'saving' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e8c06a', display: 'inline-block', animation: 'pulse 0.8s ease-in-out infinite' }} /><span style={{ fontSize: '0.65rem', color: '#c8a84a', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? 'SAVING…' : 'SAVING…'}</span></>}
          {saveStatus === 'saved' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4aab6f', display: 'inline-block' }} /><span style={{ fontSize: '0.65rem', color: '#4aab6f', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? 'SAVED' : 'SAVED'}</span></>}
          {saveStatus === 'error' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e05c5c', display: 'inline-block' }} /><span style={{ fontSize: '0.65rem', color: '#e05c5c', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>ERROR</span></>}
          {saveStatus === 'idle' && blocks.length > 0 && <span style={{ fontSize: '0.65rem', color: '#d0d0cc', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>{blocks.length} {isZh ? 'BLOCKS' : 'BLOCKS'}</span>}
        </div>

        {/* Right: actions */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          <button onClick={undo} disabled={undoStack.current.length === 0} title={isZh ? '撤销 (⌘Z)' : 'Undo (⌘Z)'}
            style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.1)', padding: '7px 12px', borderRadius: '8px', fontSize: '0.82rem', cursor: undoStack.current.length === 0 ? 'not-allowed' : 'pointer', color: undoStack.current.length === 0 ? '#ddd' : '#888', transition: 'all 0.12s' }}>↩</button>
          {blocks.length > 0 && (
            <button onClick={() => { if (window.confirm(isZh ? '清空当前画布？此操作不可撤销。' : 'Clear the canvas? This cannot be undone.')) clearDraft() }}
              style={{ background: 'transparent', border: '1px solid rgba(180,80,80,0.18)', padding: '7px 12px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.06em', cursor: 'pointer', color: 'rgba(180,80,80,0.45)', fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.45)'; e.currentTarget.style.color = 'rgba(180,80,80,0.85)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.18)'; e.currentTarget.style.color = 'rgba(180,80,80,0.45)' }}>
              {isZh ? 'Clear' : 'Clear'}
            </button>
          )}
          <div style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.08)' }} />
          <button onClick={doExportHTML}
            style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600 }}>
            {isZh ? '导出' : 'Export'}
            <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>HTML</span>
          </button>
          <button onClick={() => exportPDF(project, blocks, schools, exportOpts, isZh)}
            style={{ background: 'transparent', color: '#666', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.08em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}>PDF</button>
          <button onClick={() => exportDOCX(project, blocks, schools, exportOpts, isZh)}
            style={{ background: 'transparent', color: '#666', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.08em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', transition: 'all 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}>Word</button>
        </div>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '0', flex: 1, minHeight: 0 }}>

        {/* ── 画布 ── */}
        <div
          ref={canvasWrapRef}
          style={{ borderRight: '1px solid rgba(26,26,26,0.08)', background: '#EBEBF0', overflow: 'hidden', position: 'relative', cursor: isPanning.current ? 'grabbing' : 'default', height: '100%' }}
          onMouseDown={e => {
            // 只有点在空白区域（非 block、非 header）才启动平移
            const target = e.target as HTMLElement
            if (target.closest('.react-grid-item') || target.closest('button') || target.closest('input') || target.closest('textarea')) return
            if (e.button !== 0) return
            isPanning.current = true
            panStart.current = { mx: e.clientX, my: e.clientY, px: canvasPan.x, py: canvasPan.y }
            e.preventDefault()
          }}
          onMouseMove={e => {
            if (!isPanning.current) return
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
          onMouseUp={() => { isPanning.current = false }}
          onMouseLeave={() => { isPanning.current = false }}
          onWheel={e => { /* handled by native listener */ }}
        >
          <style>{`
            .react-grid-layout {
              background-image: radial-gradient(circle, rgba(0,0,0,0.08) 1px, transparent 1px);
              background-size: 40px 40px;
              min-height: calc(100vh - 52px);
            }
            .react-grid-item {
              border-radius: 14px;
              border: none;
              box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06);
              overflow: visible !important;
              transition: box-shadow 0.2s;
              will-change: transform;
              -webkit-font-smoothing: antialiased;
              background: transparent !important;
              position: relative;
            }
            .react-grid-item:hover { box-shadow: 0 2px 6px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.10); }
            .react-resizable-handle { display: none !important; }
            .react-grid-item.react-draggable-dragging,
            .react-grid-item.resizing {
              box-shadow: 0 1px 4px rgba(0,0,0,0.04) !important;
              transition: none !important;
            }
            .react-grid-item.react-grid-placeholder {
              background: rgba(74,171,111,0.12) !important;
              border: 1.5px dashed rgba(74,171,111,0.4) !important;
              border-radius: 12px;
              box-shadow: none !important;
              transition: none !important;
            }
            .block-card {
              display: flex;
              flex-direction: column;
              background: rgba(255,255,255,0.82);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              border-radius: 14px;
              overflow: visible;
              position: relative;
              height: 100%;
            }
            .block-body {
              flex: 1;
              overflow-y: auto;
              overflow-x: hidden;
              padding: 14px 18px 16px;
              min-height: 0;
              border-radius: 0 0 14px 14px;
            }
            .block-header {
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 0 10px 0 14px;
              height: 34px;
              min-height: 34px;
              background: rgba(0,0,0,0.025);
              border-bottom: 1px solid rgba(0,0,0,0.05);
              cursor: grab;
              flex-shrink: 0;
              border-radius: 14px 14px 0 0;
            }
            .block-header:active { cursor: grabbing; }
            .block-header-label {
              font-size: 0.58rem;
              letter-spacing: 0.18em;
              text-transform: uppercase;
              color: #c4c4c0;
              font-family: Inter, DM Sans, sans-serif;
              font-weight: 600;
              flex: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .block-header-btn {
              background: none;
              border: none;
              cursor: pointer;
              width: 26px;
              height: 26px;
              border-radius: 6px;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              opacity: 0;
              transition: opacity 0.15s, background 0.12s;
            }
            .react-grid-item:hover .block-header-btn { opacity: 1; }
            .block-header-btn:hover { background: rgba(26,26,26,0.07); }
            .react-grid-item:hover .resize-icon-se,
            .react-grid-item:hover .resize-icon-sw,
            .react-grid-item:hover .custom-resize-handle-sw,
            .react-grid-item:hover .custom-resize-handle-se { opacity: 1 !important; }
            .custom-resize-handle {
              position: absolute;
              z-index: 10;
              width: 48px;
              height: 48px;
              opacity: 0;
              transition: opacity 0.15s;
              pointer-events: auto;
              display: flex;
            }
            .react-grid-item:hover .custom-resize-handle { opacity: 1; }
            .custom-resize-handle-se {
              bottom: 0;
              right: 0;
              cursor: se-resize;
              align-items: flex-end;
              justify-content: flex-end;
            }
            .custom-resize-handle-sw {
              bottom: 0;
              left: 0;
              cursor: sw-resize;
              align-items: flex-end;
              justify-content: flex-start;
            }
            .custom-resize-handle-icon {
              width: 16px;
              height: 16px;
              margin: 5px;
              flex-shrink: 0;
              display: block;
            }
            .react-grid-item.react-draggable-dragging {
              user-select: none;
              -webkit-user-select: none;
              cursor: grabbing !important;
            }
            .react-grid-item.react-draggable-dragging * {
              user-select: none;
              -webkit-user-select: none;
              pointer-events: none;
            }
            .react-grid-item input,
            .react-grid-item textarea {
              user-select: text;
              -webkit-user-select: text;
            }
          `}</style>

          {/* 浮动工具卡片 — 6锚点吸附 */}
          {(() => {
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
              : { ...anchorStyles[toolbarAnchor], transition: 'top 0.35s cubic-bezier(0.34,1.56,0.64,1), bottom 0.35s cubic-bezier(0.34,1.56,0.64,1), left 0.35s cubic-bezier(0.34,1.56,0.64,1), right 0.35s cubic-bezier(0.34,1.56,0.64,1), transform 0.35s cubic-bezier(0.34,1.56,0.64,1)' }

            return (
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
                  if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('span[data-zoom]')) return
                  e.preventDefault()
                  const rect = toolbarRef.current!.getBoundingClientRect()
                  const wrapRect = canvasWrapRef.current!.getBoundingClientRect()
                  toolbarDragStart.current = {
                    mx: e.clientX, my: e.clientY,
                    ex: rect.left - wrapRect.left,
                    ey: rect.top - wrapRect.top,
                  }
                  setToolbarDragging(true)
                  setToolbarDragPos({ x: rect.left - wrapRect.left, y: rect.top - wrapRect.top })

                  const onMove = (me: MouseEvent) => {
                    if (!toolbarDragStart.current) return
                    const nx = toolbarDragStart.current.ex + me.clientX - toolbarDragStart.current.mx
                    const ny = toolbarDragStart.current.ey + me.clientY - toolbarDragStart.current.my
                    setToolbarDragPos({ x: nx, y: ny })
                  }
                  const onUp = (me: MouseEvent) => {
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                    setToolbarDragging(false)
                    setToolbarDragPos(null)
                    // 计算最近锚点
                    if (!toolbarDragStart.current || !canvasWrapRef.current || !toolbarRef.current) return
                    const wRect = canvasWrapRef.current.getBoundingClientRect()
                    const tRect = toolbarRef.current.getBoundingClientRect()
                    const cx = (tRect.left - wRect.left) + tRect.width / 2  // 卡片中心x（相对wrap）
                    const cy = (tRect.top - wRect.top) + tRect.height / 2   // 卡片中心y
                    const W = wRect.width, H = wRect.height
                    const isBottom = cy > H / 2
                    const isLeft = cx < W / 3
                    const isRight = cx > W * 2 / 3
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
              </div>
            )
          })()}

          <div style={{ padding: '16px 20px', position: 'absolute', inset: 0, userSelect: 'none', WebkitUserSelect: 'none' }}
            onContextMenu={e => {
              // 只有点在空白区域才触发（不在 block 上）
              const target = e.target as HTMLElement
              if (target.closest('.react-grid-item')) return
              e.preventDefault()
              const gridEl = e.currentTarget.querySelector('.react-grid-layout') as HTMLElement
              const cols = 12, rowH = 60, margin = 12
              if (!gridEl) return
              const rect = gridEl.getBoundingClientRect()
              const colW = gridEl.offsetWidth / cols
              const gridX = Math.floor((e.clientX - rect.left) / colW / canvasZoom)
              const gridY = Math.floor((e.clientY - rect.top) / ((rowH + margin) * canvasZoom))
              setCtxMenu({ x: e.clientX, y: e.clientY, gridX: Math.max(0, gridX), gridY: Math.max(0, gridY) })
            }}
            onClick={() => setCtxMenu(null)}
          >
            {justRestored && <DraftBanner blocks={blocks} isZh={isZh} onClear={clearDraft} />}

            {/* ── 右键菜单 ── */}
            {ctxMenu && (
              <div
                style={{
                  position: 'fixed', top: ctxMenu.y, left: ctxMenu.x,
                  zIndex: 999, background: '#fff',
                  border: '1px solid rgba(26,26,26,0.1)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  padding: '6px',
                  minWidth: '180px',
                  fontFamily: 'Inter, DM Sans, sans-serif',
                  animation: 'fadeIn 0.12s ease',
                }}
                onClick={e => e.stopPropagation()}
                onContextMenu={e => e.preventDefault()}
              >
                {/* 小标题 */}
                <div style={{ padding: '4px 10px 8px', fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c4c4c0', fontWeight: 600 }}>
                  {isZh ? '插入块' : 'Insert Block'}
                </div>

                {[
                  { type: 'title' as BlockType,  icon: '✦', label: isZh ? '标题块' : 'Title',       sub: isZh ? '大标题' : 'Heading' },
                  { type: 'note' as BlockType,   icon: '✎', label: isZh ? '文字块' : 'Text',        sub: isZh ? '段落文字' : 'Paragraph' },
                  { type: 'custom' as BlockType, icon: '⊞', label: isZh ? '自定义块' : 'Custom',    sub: isZh ? '自由编辑' : 'Free text' },
                  { type: 'milestone' as BlockType, icon: '◎', label: isZh ? '进度块' : 'Milestone', sub: isZh ? '时间线' : 'Timeline' },
                ].map(item => (
                  <button key={item.type}
                    onClick={() => {
                      addBlockAt(item.type, item.type === 'title' ? (isZh ? '新标题' : 'New Title') : item.type === 'milestone' ? '' : (isZh ? '在此输入内容…' : 'Type something…'), ctxMenu.gridX, ctxMenu.gridY)
                      setCtxMenu(null)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 10px', border: 'none', background: 'transparent',
                      borderRadius: '7px', cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
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

                {/* 插入图片 */}
                <button
                  onClick={() => ctxImageInputRef.current?.click()}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', border: 'none', background: 'transparent',
                    borderRadius: '7px', cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: '0.9rem', width: '20px', textAlign: 'center', color: '#888', flexShrink: 0 }}>🖼</span>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 500 }}>{isZh ? '插入图片' : 'Image'}</div>
                    <div style={{ fontSize: '0.65rem', color: '#bbb', marginTop: '1px' }}>{isZh ? '从本地上传' : 'Upload from device'}</div>
                  </div>
                </button>

              </div>
            )}

            {/* 右键插入图片的隐藏 input */}
            <input ref={ctxImageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0]
                if (!file || !ctxMenu) return
                const reader = new FileReader()
                reader.onload = ev => {
                  const dataUrl = ev.target?.result as string
                  compressImage(dataUrl).then(compressed => {
                    addBlockAt('image', compressed, ctxMenu.gridX, ctxMenu.gridY)
                    addToMediaLibrary(compressed)
                  })
                }
                reader.readAsDataURL(file)
                setCtxMenu(null)
                e.target.value = ''
              }}
            />

            {blocks.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', color: '#c8c8c4', fontSize: '0.78rem', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.1em', pointerEvents: 'none' }}>
                {isZh ? '从右侧添加内容块' : 'ADD BLOCKS FROM THE RIGHT PANEL'}
              </div>
            )}

            <div style={{
              transformOrigin: 'top left',
              transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
              width: `${100 / canvasZoom}%`,
              transition: isPanning.current ? 'none' : 'transform 0.1s ease',
            }}>
            {/* @ts-ignore */}
            <GridLayout
              className="react-grid-layout"
              cols={12}
              rowHeight={60}
              width={window !== undefined ? (window.innerWidth - 300 - 40) : 900}
              layout={blocks.map(b => ({
                i: b.id,
                x: b.gridPos?.x ?? 0,
                y: b.gridPos?.y ?? 0,
                w: b.gridPos?.w ?? 12,
                h: b.gridPos?.h ?? 4,
                minW: 3,
                minH: 2,
              }))}
              onLayoutChange={layout => {
                setBlocks(prev => prev.map(b => {
                  const item = layout.find(l => l.i === b.id)
                  if (!item) return b
                  return { ...b, gridPos: { x: item.x, y: item.y, w: item.w, h: item.h } }
                }))
              }}
              draggableHandle=".block-header"
              draggableCancel=".no-drag"
              margin={[12, 12]}
              containerPadding={[0, 0]}
              isResizable={true}
              isDraggable={true}
              transformScale={canvasZoom}
              resizeHandles={['se', 'sw']}
              resizeHandle={(handleAxis: string, ref: React.Ref<HTMLDivElement>) => (
                <div ref={ref} style={{ display: 'none' }} />
              )}
            >
              {blocks.map((block) => (
                <div key={block.id} className="block-card">

                  {/* ── 左下角 SW handle ── */}
                  <div className="custom-resize-handle custom-resize-handle-sw"
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault()
                      const gridEl = e.currentTarget.closest('.react-grid-layout') as HTMLElement
                      if (!gridEl) return
                      const cols = 12, rowH = 60, margin = 12
                      const colW = gridEl.offsetWidth / cols
                      const gridRect = gridEl.getBoundingClientRect()
                      const startX = e.clientX
                      const startY = e.clientY
                      const startGridH = block.gridPos?.h ?? 4
                      const startGridX = block.gridPos?.x ?? 0
                      const startGridW = block.gridPos?.w ?? 12
                      const rightEdgeCol = startGridX + startGridW
                      const onMove = (me: MouseEvent) => {
                        const dCols = Math.round((me.clientX - startX) / (colW * canvasZoom))
                        const newX = Math.max(0, Math.min(startGridX + dCols, rightEdgeCol - 3))
                        const newW = rightEdgeCol - newX
                        const dRows = Math.round((me.clientY - startY) / ((rowH + margin) * canvasZoom))
                        const newH = Math.max(2, startGridH + dRows)
                        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, gridPos: { ...b.gridPos!, x: newX, w: newW, h: newH } } : b))
                      }
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                    }}
                  >
                  </div>

                  {/* ── 右下角 SE handle ── */}
                  <div className="custom-resize-handle custom-resize-handle-se"
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault()
                      const gridEl = e.currentTarget.closest('.react-grid-layout') as HTMLElement
                      if (!gridEl) return
                      const cols = 12, rowH = 60, margin = 12
                      const colW = gridEl.offsetWidth / cols
                      const startX = e.clientX
                      const startY = e.clientY
                      const startGridH = block.gridPos?.h ?? 4
                      const startGridW = block.gridPos?.w ?? 12
                      const startGridX = block.gridPos?.x ?? 0
                      const onMove = (me: MouseEvent) => {
                        const dCols = Math.round((me.clientX - startX) / (colW * canvasZoom))
                        const newW = Math.max(3, Math.min(cols - startGridX, startGridW + dCols))
                        const dRows = Math.round((me.clientY - startY) / ((rowH + margin) * canvasZoom))
                        const newH = Math.max(2, startGridH + dRows)
                        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, gridPos: { ...b.gridPos!, w: newW, h: newH } } : b))
                      }
                      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
                      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
                    }}
                  >
                  </div>
                  {/* ── 页眉 ── */}
                  <div className="block-header" onMouseDown={e => { /* header is the drag zone */ }}>
                    <span className="block-header-label">
                      {block.type === 'image-row' ? (isZh ? '图片行' : 'Image Row') :
                       block.type === 'school-profile' ? (isZh ? '院校' : 'School') :
                       block.type === 'milestone' ? (isZh ? '进度' : 'Milestone') :
                       block.type === 'custom' ? (isZh ? '自定义' : 'Custom') :
                       block.type === 'note' ? (isZh ? '笔记' : 'Note') :
                       block.type === 'title' ? (isZh ? '标题' : 'Title') :
                       block.type === 'image' ? (isZh ? '图片' : 'Image') : block.type}
                    </span>
                    {['custom', 'note', 'image-row', 'image'].includes(block.type) && editingBlockId !== block.id && (
                      <button className="block-header-btn no-drag" onMouseDown={e => e.stopPropagation()} onClick={() => startEdit(block)}
                        title={isZh ? '编辑' : 'Edit'} style={{ color: '#888', fontSize: '0.8rem' }}>✎</button>
                    )}
                    {block.type === 'image' && editingBlockId !== block.id && (
                      <button className="block-header-btn no-drag" onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setImageEditorUrl(block.content); setImageEditorIdx(-1); (window as any).__editingBlockId = block.id; (window as any).__editingImageIdx = null }}
                        title={isZh ? '编辑图片' : 'Edit image'} style={{ color: '#888', fontSize: '0.82rem' }}>🖼</button>
                    )}
                    {editingBlockId !== block.id && (
                      <button className="block-header-btn no-drag" onMouseDown={e => e.stopPropagation()} onClick={() => removeBlock(block.id)}
                        title={isZh ? '删除' : 'Delete'}
                        style={{ color: 'rgba(180,80,80,0.5)', fontSize: '0.82rem' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.5)')}>✕</button>
                    )}
                  </div>
                  {/* ── 内容区 ── */}
                  <div className="block-body no-drag">
              {editingBlockId === block.id ? (
                <div>
                  {(block.type === 'custom' || block.type === 'note') && (
                    <textarea autoFocus value={editingContent} onChange={e => setEditingContent(e.target.value)} rows={5}
                      className="no-drag"
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(26,26,26,0.15)', borderRadius: '10px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#1a1a1a', outline: 'none', resize: 'vertical', background: '#f7f7f5', marginBottom: '10px' }} />
                  )}
                  {block.type === 'image' && (
                    <div style={{ marginBottom: '10px' }}>
                      <img src={block.content} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '8px' }} />
                      <input value={editingImageCaptions[0] || ''} onChange={e => { const updated = [...editingImageCaptions]; updated[0] = e.target.value; setEditingImageCaptions(updated) }}
                        placeholder={isZh ? '图片名称…' : 'Image label…'}
                        style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#555', outline: 'none', background: '#f7f7f5' }} />
                    </div>
                  )}
                  {block.type === 'image-row' && (
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8c8c4', marginBottom: '8px' }}>
                        {isZh ? '拖拽图片调整顺序，每张图可填写名称' : 'Drag to reorder · add a label under each image'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '8px' }}>
                        {(block.images || []).map((url, idx) => (
                          <div key={idx} draggable
                            onDragStart={() => { imageDragIndex.current = idx }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => {
                              if (imageDragIndex.current !== null && imageDragIndex.current !== idx) {
                                const fromIdx = imageDragIndex.current
                                setBlocks(b => b.map(bl => {
                                  if (bl.id !== block.id) return bl
                                  const imgs = [...(bl.images || [])]
                                  const caps = [...(editingImageCaptions.length === imgs.length ? editingImageCaptions : imgs.map((_, ii) => editingImageCaptions[ii] || ''))]
                                  const [imgItem] = imgs.splice(fromIdx, 1)
                                  const [capItem] = caps.splice(fromIdx, 1)
                                  imgs.splice(idx, 0, imgItem)
                                  caps.splice(idx, 0, capItem)
                                  setEditingImageCaptions(caps)
                                  return { ...bl, images: imgs }
                                }))
                              }
                              imageDragIndex.current = null
                            }}
                            style={{ cursor: 'grab', position: 'relative' }}>
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', display: 'block', pointerEvents: 'none' }} />
                            <button
                              onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setImageEditorUrl(url); setImageEditorIdx(-1); (window as any).__editingBlockId = block.id; (window as any).__editingImageIdx = idx }}
                              style={{ position: 'absolute', top: '5px', right: '32px', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
                              title={isZh ? '编辑图片' : 'Edit image'}>✎</button>
                            <button
                              onMouseDown={e => { e.stopPropagation(); e.preventDefault(); setBlocks(b => b.map(bl => { if (bl.id !== block.id) return bl; const imgs = [...(bl.images || [])]; imgs.splice(idx, 1); const caps = [...editingImageCaptions]; caps.splice(idx, 1); setEditingImageCaptions(caps); return { ...bl, images: imgs } })) }}
                              style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(180,60,60,0.75)', color: '#fff', border: 'none', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' }}
                              title={isZh ? '删除此图' : 'Remove image'}>✕</button>
                            <input value={editingImageCaptions[idx] || ''} onChange={e => { const updated = [...editingImageCaptions]; updated[idx] = e.target.value; setEditingImageCaptions(updated) }}
                              placeholder={isZh ? `图片 ${idx + 1} 名称…` : `Image ${idx + 1} label…`}
                              style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#555', outline: 'none', background: '#f7f7f5' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(block.type === 'image' || block.type === 'image-row' || block.type === 'note') && (
                    <input value={editingCaption} onChange={e => setEditingCaption(e.target.value)}
                      placeholder={isZh ? '图片说明（可选）' : 'Caption (optional)'}
                      className="no-drag"
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#888', outline: 'none', background: '#f7f7f5' }} />
                  )}
                  <div className="no-drag" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button className="no-drag" onMouseDown={e => e.stopPropagation()} onClick={saveEdit} style={{ padding: '8px 18px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em', cursor: 'pointer' }}>{isZh ? '保存' : 'Save'}</button>
                    <button className="no-drag" onMouseDown={e => e.stopPropagation()} onClick={cancelEdit} style={{ padding: '8px 18px', background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', cursor: 'pointer' }}>{isZh ? '取消' : 'Cancel'}</button>
                  </div>
                </div>
              ) : (
                <div>
                  {block.type === 'title' && (
                    <div>
                      <p style={{ fontSize: '1.15rem', fontWeight: 600, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif', letterSpacing: '-0.01em' }}>{project.title}</p>
                      {project.description && <p style={{ fontSize: '0.88rem', color: '#999', marginTop: '5px', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.6 }}>{project.description.slice(0, 120)}…</p>}
                    </div>
                  )}
                  {block.type === 'image' && (
                    <div>
                      <img src={block.content} alt="" style={{ width: '100%', height: 'auto', objectFit: 'contain', borderRadius: '8px', display: 'block' }} />
                      {(block.imageCaptions || [])[0] && <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.4, fontFamily: 'Inter, DM Sans, sans-serif' }}>{(block.imageCaptions || [])[0]}</p>}
                      {block.caption && <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '7px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'image-row' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '6px' }}>
                        {(block.images || []).map((url, idx) => (
                          <div key={idx} style={{ position: 'relative' }} className="img-row-item">
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', display: 'block' }} />
                            <button
                              onClick={e => { e.stopPropagation(); setBlocks(b => b.map(bl => { if (bl.id !== block.id) return bl; const imgs = [...(bl.images || [])]; imgs.splice(idx, 1); const caps = [...(bl.imageCaptions || [])]; caps.splice(idx, 1); return { ...bl, images: imgs, imageCaptions: caps } })) }}
                              className="img-row-del"
                              style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(180,60,60,0.8)', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}
                              title={isZh ? '删除此图' : 'Remove'}>✕</button>
                            {(block.imageCaptions || [])[idx] && <p style={{ fontSize: '0.72rem', color: '#999', marginTop: '4px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.4, fontFamily: 'Inter, DM Sans, sans-serif' }}>{(block.imageCaptions || [])[idx]}</p>}
                          </div>
                        ))}
                      </div>
                      {block.caption && <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '7px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'note' && (
                    <div>
                      <p style={{ fontSize: '0.92rem', color: '#444', lineHeight: 1.72, fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif' }}>{block.content}</p>
                      {block.caption && <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '6px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'milestone' && (
                    <div>
                      <p style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c0c0bc', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '进度节点' : 'Milestones'}</p>
                      {project.milestones.slice(0, 4).map(m => (
                        <p key={m.id} style={{ fontSize: '0.88rem', color: m.status === 'done' ? '#c0c0bc' : '#2a2a2a', marginBottom: '5px', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ color: m.status === 'done' ? '#4aab6f' : '#ccc', fontSize: '0.75rem' }}>{m.status === 'done' ? '✓' : '○'}</span>
                          <span style={{ textDecoration: m.status === 'done' ? 'line-through' : 'none' }}>{m.title}</span>
                        </p>
                      ))}
                      {project.milestones.length > 4 && <p style={{ fontSize: '0.75rem', color: '#c8c8c4', marginTop: '4px', fontFamily: 'Inter, DM Sans, sans-serif' }}>+{project.milestones.length - 4} {isZh ? '个节点' : 'more'}</p>}
                    </div>
                  )}
                  {block.type === 'custom' && (
                    <p style={{ fontSize: '0.92rem', color: '#444', lineHeight: 1.72, whiteSpace: 'pre-wrap', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif' }}>{block.content}</p>
                  )}
                  {block.type === 'school-profile' && (() => {
                    const school = schools.find(s => s.id === block.content)
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
                </div>
              )}
                  </div>
                  {/* 시각적 resize 아이콘 — pointer-events:none */}
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 20, opacity: 0, transition: 'opacity 0.15s' }} className="resize-icon-se">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ margin: '4px' }}>
                      <path d="M1 13 L13 13 L13 1" stroke="rgba(26,26,26,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 13 L13 13 L13 5" stroke="rgba(26,26,26,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, width: '28px', height: '28px', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', pointerEvents: 'none', zIndex: 20, opacity: 0, transition: 'opacity 0.15s' }} className="resize-icon-sw">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ margin: '4px' }}>
                      <path d="M13 13 L1 13 L1 1" stroke="rgba(26,26,26,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M9 13 L1 13 L1 5" stroke="rgba(26,26,26,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </GridLayout>
            </div>
          </div>
        </div>

        {/* ── 右侧面板 ── */}
        <div style={{ background: '#fff', overflowY: 'auto', borderLeft: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column' }}
          onDragOver={e => e.stopPropagation()} onDrop={e => e.stopPropagation()}>

          {/* Tab switcher */}
          <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid rgba(26,26,26,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex' }}>
                <button onClick={() => setRightTab('blocks')} style={{ flex: 1, padding: '13px 0', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: rightTab === 'blocks' ? '2px solid #1a1a1a' : '2px solid transparent', background: 'transparent', color: rightTab === 'blocks' ? '#1a1a1a' : '#aaa', transition: 'all 0.12s' }}>
                  {isZh ? 'Blocks' : 'Blocks'}
                </button>
                <button onClick={() => setRightTab('style')} style={{ flex: 1, padding: '13px 0', fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, border: 'none', cursor: 'pointer', borderBottom: rightTab === 'style' ? '2px solid #1a1a1a' : '2px solid transparent', background: 'transparent', color: rightTab === 'style' ? '#1a1a1a' : '#aaa', transition: 'all 0.12s' }}>
                  {isZh ? 'Style' : 'Style'}
                </button>
              </div>
              <button
                onClick={() => setPreviewOpen(o => !o)}
                title={isZh ? '实时预览' : 'Live Preview'}
                style={{ padding: '8px 12px', border: 'none', borderLeft: '1px solid rgba(26,26,26,0.08)', background: previewOpen ? '#1a1a1a' : 'transparent', color: previewOpen ? '#f7f7f5' : '#aaa', fontSize: '0.78rem', cursor: 'pointer', flexShrink: 0, fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s', height: '100%' }}>
                ⊡
              </button>
            </div>
          </div>

          {/* BLOCKS tab */}
          {rightTab === 'blocks' && (
            <div style={{ padding: '24px 20px', flex: 1 }}>

              {/* 自定义文本 */}
              <div style={{ marginBottom: '28px' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                  {isZh ? '自定义文本' : 'Text'}
                </p>
                <textarea value={customText} onChange={e => setCustomText(e.target.value)}
                  onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); if (customText.trim()) { addBlock('custom', customText); setCustomText('') } }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation()
                  }}
                  rows={4} placeholder={isZh ? '输入任意文字… (⌘↵ 添加)' : 'Write anything… (⌘↵ to add)'}
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: '#fafaf8', fontFamily: 'Inter, DM Sans, "PingFang SC", sans-serif', fontSize: '0.9rem', lineHeight: '1.65', color: '#2a2a2a', outline: 'none', resize: 'vertical', marginBottom: '8px', boxSizing: 'border-box', WebkitUserSelect: 'text', userSelect: 'text' }} />
                <button onClick={() => { if (customText.trim()) { addBlock('custom', customText); setCustomText('') } }}
                  style={{ width: '100%', padding: '10px', background: customText.trim() ? '#1a1a1a' : 'rgba(26,26,26,0.12)', color: customText.trim() ? '#f7f7f5' : '#aaa', border: 'none', borderRadius: '8px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.8rem', letterSpacing: '0.06em', cursor: customText.trim() ? 'pointer' : 'default', transition: 'background 0.15s, color 0.15s' }}>
                  + {isZh ? '添加到画布' : 'Add to canvas'}
                </button>
              </div>

              <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />

              {/* 项目信息 */}
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                  {isZh ? '项目信息' : 'Project'}
                </p>
                <PanelButton onClick={() => addBlock('title', '')} label={isZh ? '标题 & 描述' : 'Title & Description'} icon="T" />
                <PanelButton onClick={() => addBlock('milestone', '')} label={isZh ? '进度节点' : 'Milestones'} icon="◎" />
              </div>

              <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />

              {/* 本地上传 hidden input */}
              <input
                ref={localImageInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={e => {
                  const files = Array.from(e.target.files || [])
                  files.forEach(file => {
                    const reader = new FileReader()
                    reader.onload = ev => {
                      const dataUrl = ev.target?.result as string
                      if (dataUrl) addToMediaLibrary(dataUrl)
                    }
                    reader.readAsDataURL(file)
                  })
                  e.target.value = ''
                }}
              />

              {/* 图片 */}
              <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                      {isZh ? '图片' : 'Images'} {mediaUrls.length > 0 && <span style={{ color: '#d0d0cc' }}>({mediaUrls.length})</span>}
                    </p>
                    {mediaUrls.length > 0 && (
                      <button onClick={() => { setImagePickerOpen(o => !o); setSelectedImages([]) }}
                        style={{ fontSize: '0.68rem', color: imagePickerOpen ? '#1a1a1a' : '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.06em' }}>
                        {imagePickerOpen ? (isZh ? '取消' : 'Cancel') : (isZh ? '多选并排' : 'Multi-pick')}
                      </button>
                    )}
                  </div>
                  {imagePickerOpen ? (
                    <div>
                      <p style={{ fontSize: '0.7rem', color: '#c0c0bc', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.5 }}>
                        {isZh ? `已选 ${selectedImages.length} 张 — 点击选择后添加` : `${selectedImages.length} selected — pick then add`}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '10px' }}>
                        {mediaUrls.map((url, i) => (
                          <img key={i} src={url} alt="" className={`img-thumb${selectedImages.includes(url) ? ' selected' : ''}`}
                            onClick={() => toggleImageSelection(url)}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)' }} />
                        ))}
                      </div>
                      <button onClick={addImageRow} disabled={selectedImages.length === 0}
                        style={{ width: '100%', padding: '10px', background: selectedImages.length > 0 ? '#1a1a1a' : 'rgba(26,26,26,0.1)', color: selectedImages.length > 0 ? '#f7f7f5' : '#bbb', border: 'none', borderRadius: '8px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.78rem', letterSpacing: '0.05em', cursor: selectedImages.length > 0 ? 'pointer' : 'default' }}>
                        {selectedImages.length <= 1 ? (isZh ? '+ 添加图片' : '+ Add image') : (isZh ? `+ 并排添加 ${selectedImages.length} 张` : `+ Add ${selectedImages.length} side by side`)}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      {/* 第一格：永远是本地上传 */}
                      <div
                        onClick={() => localImageInputRef.current?.click()}
                        style={{ aspectRatio: '1', border: '1.5px dashed rgba(26,26,26,0.18)', borderRadius: '7px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(26,26,26,0.015)', transition: 'all 0.12s', gap: '5px' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.4)'; e.currentTarget.style.background = 'rgba(26,26,26,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.18)'; e.currentTarget.style.background = 'rgba(26,26,26,0.015)' }}
                      >
                        <span style={{ fontSize: '1.1rem', color: '#ccc', lineHeight: 1 }}>+</span>
                        <span style={{ fontSize: '0.6rem', color: '#ccc', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1.3 }}>{isZh ? '本地上传' : 'Upload'}</span>
                      </div>
                      {/* 其余：项目图片 */}
                      {mediaUrls.map((url, i) => {
                        const imageRowBlocks = blocks.filter(b => b.type === 'image-row')
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ position: 'relative' }}>
                              <img src={url} alt="" className="img-thumb" onClick={() => addBlock('image', url)}
                                style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)', display: 'block' }} />
                              <span style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', width: '18px', height: '18px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>+</span>
                              <button
                                onClick={e => { e.stopPropagation(); setImageEditorUrl(url); setImageEditorIdx(i) }}
                                style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '4px', width: '22px', height: '22px', cursor: 'pointer', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title={isZh ? '编辑图片' : 'Edit image'}>✎</button>
                            </div>
                            {imageRowBlocks.length > 0 && (
                              <div style={{ display: 'flex', gap: '3px' }}>
                                {imageRowBlocks.map((rowBlock, ri) => (
                                  <button
                                    key={rowBlock.id}
                                    onClick={() => {
                                      setBlocks(b => b.map(bl =>
                                        bl.id === rowBlock.id
                                          ? { ...bl, images: [...(bl.images || []), url] }
                                          : bl
                                      ))
                                    }}
                                    title={isZh ? `添加到第 ${ri + 1} 行` : `Add to row ${ri + 1}`}
                                    style={{
                                      flex: 1, height: '20px', border: '1px dashed rgba(26,26,26,0.2)',
                                      borderRadius: '4px', background: 'rgba(26,26,26,0.02)',
                                      cursor: 'pointer', display: 'flex', alignItems: 'center',
                                      justifyContent: 'center', gap: '3px', transition: 'all 0.12s',
                                      padding: '0 4px',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.07)'; e.currentTarget.style.borderColor = 'rgba(26,26,26,0.4)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.02)'; e.currentTarget.style.borderColor = 'rgba(26,26,26,0.2)' }}
                                  >
                                    <span style={{ fontSize: '9px', color: '#aaa', letterSpacing: '0.04em', fontFamily: 'Inter, DM Sans, sans-serif', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {imageRowBlocks.length > 1 ? `+R${ri + 1}` : (isZh ? '+行' : '+row')}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              {/* 笔记 */}
              {(project.notes || []).length > 0 && (
                <>
                  <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                      {isZh ? '笔记' : 'Notes'}
                    </p>
                    {(project.notes || []).map(n => (
                      <div key={n.id} onClick={() => addBlock('note', n.content)}
                        style={{ padding: '9px 13px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#666', lineHeight: 1.55, transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        {n.content.slice(0, 60)}{n.content.length > 60 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* 目标院校 */}
              {schools.length > 0 && (
                <>
                  <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                        {isZh ? '目标院校' : 'Schools'} <span style={{ color: '#d0d0cc' }}>({schools.length})</span>
                      </p>
                      {schools.length > 3 && (
                        <button onClick={() => setSchoolsExpanded(e => !e)}
                          style={{ fontSize: '0.68rem', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.06em' }}>
                          {schoolsExpanded ? (isZh ? '收起 ↑' : 'Less ↑') : (isZh ? '展开全部 ↓' : 'Show all ↓')}
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {visibleSchools.map(s => (
                        <div key={s.id} className="school-item" onClick={() => addBlock('school-profile', s.id)}
                          style={{ padding: '10px 13px', border: '1px solid rgba(26,26,26,0.09)', borderLeft: '2.5px solid rgba(196,160,68,0.45)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', background: 'transparent' }}>
                          <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {isZh ? (s.nameZh || s.name) : s.name}
                          </p>
                          {(isZh ? (s.departmentZh || s.department) : s.department) && (
                            <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', color: '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isZh ? (s.departmentZh || s.department) : s.department}
                            </p>
                          )}
                          {s.aiStatement && <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.68rem', color: '#4aab6f', marginTop: '3px' }}>✓ {isZh ? '有文书' : 'has statement'}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* STYLE tab */}
          {rightTab === 'style' && (
            <div style={{ padding: '24px 20px', flex: 1 }}>
              <ThemePickerPanel opts={exportOpts} setOpts={setExportOpts} isZh={isZh} />

              {/* Paged export toggle */}
              <div style={{ marginTop: '4px', marginBottom: '4px' }}>
                <button
                  onClick={() => setPagedExport(p => !p)}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: '9px', cursor: 'pointer',
                    border: `1px solid ${pagedExport ? 'rgba(26,26,26,0.3)' : 'rgba(26,26,26,0.1)'}`,
                    background: pagedExport ? 'rgba(26,26,26,0.06)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s',
                  }}>
                  <span style={{ fontSize: '0.8rem', color: '#3a3a3a', letterSpacing: '0.02em' }}>
                    {isZh ? '翻页模式' : 'Paged mode'}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: pagedExport ? '#1a1a1a' : '#bbb', letterSpacing: '0.06em' }}>
                    {pagedExport ? (isZh ? '开 ●' : 'ON ●') : (isZh ? '关 ○' : 'OFF ○')}
                  </span>
                </button>
                {pagedExport && (
                  <p style={{ fontSize: '0.68rem', color: '#aaa', fontFamily: 'Inter, DM Sans, sans-serif', marginTop: '6px', lineHeight: 1.5, padding: '0 2px' }}>
                    {isZh ? '每个 block 单独一页，← → 键翻页' : 'Each block is a page · ← → to navigate'}
                  </p>
                )}
              </div>

              {/* Export summary + button */}
              <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(26,26,26,0.04)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '8px' }}>
                  {isZh ? '当前配置' : 'Current config'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#777', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.6 }}>
                  {THEMES[exportOpts.theme]?.label} · {FONTS[exportOpts.font]?.label} · {exportOpts.width}px · R{exportOpts.radius} {pagedExport ? '· paged' : ''}
                </p>
                <button onClick={doExportHTML}
                  style={{ width: '100%', marginTop: '12px', padding: '11px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '9px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', letterSpacing: '0.08em', cursor: 'pointer' }}>
                  {isZh ? '导出 HTML' : 'Export HTML'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* ── Floating Preview Window ── */}
      {previewOpen && (
        <Rnd
          default={{ x: window.innerWidth - 480, y: window.innerHeight - 520, width: 420, height: 460 }}
          minWidth={280}
          minHeight={220}
          bounds="window"
          dragHandleClassName="preview-drag-handle"
          style={{ zIndex: 200 }}
        >
          <div style={{
            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            background: '#1a1a1a', borderRadius: '12px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)', overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {/* title bar */}
            <div className="preview-drag-handle" style={{
              padding: '9px 14px', display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'grab', flexShrink: 0,
              borderBottom: '1px solid rgba(255,255,255,0.07)', userSelect: 'none',
            }}>
              <span style={{ fontSize: '0.68rem', color: '#888', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                {isZh ? '预览' : 'Preview'} · {THEMES[exportOpts.theme]?.label}
              </span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.9rem', padding: '0 2px', lineHeight: 1 }}>✕</button>
            </div>
            {/* iframe */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <iframe
                key={JSON.stringify(exportOpts) + blocks.length}
                srcDoc={buildExportHTML(blocks, project, schools, exportOpts, isZh)}
                style={{ position: 'absolute', top: 0, left: 0, border: 'none', transformOrigin: 'top left' }}
                sandbox="allow-same-origin"
                onLoad={(e) => {
                  const iframe = e.currentTarget
                  const container = iframe.parentElement
                  if (!container) return
                  const cw = container.offsetWidth
                  const ch = container.offsetHeight
                  const contentW = exportOpts.width + 64
                  const scale = Math.min(cw / contentW, 1)
                  iframe.style.width = `${contentW}px`
                  iframe.style.height = `${ch / scale}px`
                  iframe.style.transform = `scale(${scale})`
                }}
              />
            </div>
          </div>
        </Rnd>
      )}
    </main>
  )
}

// ── Image Editor Component ────────────────────────────────────────────────────
type ImageLayer = {
  kind: 'image'
  id: string
  src: string
  el: HTMLImageElement
  pos: { x: number; y: number }
  scale: number
  visible: boolean
  followColor: boolean
  name: string
}

type TextLayer = {
  kind: 'text'
  id: string
  text: string
  fontSize: number
  color: string
  fontFamily: string        // CSS font-family string（预设或已加载的自定义）
  fontLabel: string         // 显示名称
  pos: { x: number; y: number }
  visible: boolean
  name: string
}

type OverlayLayer = ImageLayer | TextLayer

const PRESET_FONTS: { label: string; family: string }[] = [
  { label: 'Space Mono',   family: 'Space Mono, monospace' },
  { label: 'Inter',        family: 'Inter, sans-serif' },
  { label: 'DM Serif',     family: '"DM Serif Display", serif' },
  { label: 'Playfair',     family: '"Playfair Display", serif' },
  { label: 'Bebas Neue',   family: '"Bebas Neue", sans-serif' },
  { label: 'Courier New',  family: '"Courier New", monospace' },
]

function measureTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): { w: number; h: number } {
  ctx.font = `${layer.fontSize}px ${layer.fontFamily}`
  const lines = layer.text.split('\n')
  const lineH = layer.fontSize * 1.3
  const w = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
  return { w: w + 12, h: lines.length * lineH + 10 }
}

function ImageEditor({
  src, isZh, onSave, onClose,
}: { src: string; isZh: boolean; onSave: (dataUrl: string) => void; onClose: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const layerInputRef = React.useRef<HTMLInputElement>(null)
  const fontInputRef = React.useRef<HTMLInputElement>(null)
  const [customFonts, setCustomFonts] = React.useState<{ label: string; family: string }[]>([])

  const [brightness, setBrightness] = React.useState(100)
  const [contrast, setContrast] = React.useState(100)
  const [saturate, setSaturate] = React.useState(100)
  const [rotation, setRotation] = React.useState(0)
  const [flipH, setFlipH] = React.useState(false)
  const [cropMode, setCropMode] = React.useState(false)
  const [cropStart, setCropStart] = React.useState<{x:number,y:number}|null>(null)
  const [cropRect, setCropRect] = React.useState<{x:number,y:number,w:number,h:number}|null>(null)
  const [isCropDragging, setIsCropDragging] = React.useState(false)
  const [imgEl, setImgEl] = React.useState<HTMLImageElement|null>(null)
  const [canvasSize, setCanvasSize] = React.useState({w:0,h:0})

  // ── 多图层 ──
  const [layers, setLayers] = React.useState<OverlayLayer[]>([])
  const [activeLayerId, setActiveLayerId] = React.useState<string|null>(null)
  const [isDraggingLayer, setIsDraggingLayer] = React.useState(false)
  const layerDragRef = React.useRef<{startX:number,startY:number,origX:number,origY:number,id:string}|null>(null)

  const updateLayer = (id: string, patch: Partial<OverlayLayer>) =>
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } as OverlayLayer : l))

  // 主图加载
  React.useEffect(() => {
    const img = new Image()
    img.onload = () => {
      const maxW = Math.min(img.naturalWidth, 800)
      const scale = maxW / img.naturalWidth
      setCanvasSize({ w: maxW, h: img.naturalHeight * scale })
      setImgEl(img)
    }
    img.src = src
  }, [src])

  // canvas 渲染
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl || canvasSize.w === 0) return
    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext('2d')!

    // 主图
    ctx.save()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`
    ctx.translate(canvasSize.w/2, canvasSize.h/2)
    ctx.rotate((rotation * Math.PI) / 180)
    if (flipH) ctx.scale(-1, 1)
    ctx.drawImage(imgEl, -canvasSize.w/2, -canvasSize.h/2, canvasSize.w, canvasSize.h)
    ctx.restore()

    // 图层（从下到上渲染）
    for (const layer of layers) {
      if (!layer.visible) continue

      if (layer.kind === 'image') {
        const ow = (canvasSize.w * layer.scale) / 100
        const oh = (layer.el.naturalHeight / layer.el.naturalWidth) * ow
        ctx.save()
        ctx.filter = layer.followColor ? `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)` : 'none'
        ctx.globalAlpha = 0.92
        ctx.drawImage(layer.el, layer.pos.x, layer.pos.y, ow, oh)
        ctx.restore()
        ctx.globalAlpha = 1
        if (layer.id === activeLayerId && !cropMode) {
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
          ctx.strokeRect(layer.pos.x, layer.pos.y, ow, oh)
          ctx.restore()
        }
      } else {
        // 文字图层
        const lines = layer.text.split('\n')
        const lineH = layer.fontSize * 1.3
        ctx.save()
        ctx.font = `${layer.fontSize}px ${layer.fontFamily}`
        ctx.fillStyle = layer.color
        ctx.textBaseline = 'top'
        lines.forEach((line, li) => {
          ctx.fillText(line, layer.pos.x + 6, layer.pos.y + 5 + li * lineH)
        })
        ctx.restore()
        // 选中框
        if (layer.id === activeLayerId && !cropMode) {
          const { w, h } = measureTextLayer(ctx, layer)
          ctx.save()
          ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3])
          ctx.strokeRect(layer.pos.x, layer.pos.y, w, h)
          ctx.restore()
        }
      }
    }

    // 裁剪遮罩
    if (cropRect && cropMode) {
      ctx.save()
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 3])
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h)
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.restore()
    }
  }, [imgEl, brightness, contrast, saturate, rotation, flipH, layers, activeLayerId, cropRect, cropMode, canvasSize])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvasSize.w / rect.width), y: (e.clientY - rect.top) * (canvasSize.h / rect.height) }
  }

  const getLayerAtPos = (pos: {x:number,y:number}) => {
    const ctx = canvasRef.current?.getContext('2d')
    for (let i = layers.length - 1; i >= 0; i--) {
      const l = layers[i]
      if (!l.visible) continue
      if (l.kind === 'image') {
        const ow = (canvasSize.w * l.scale) / 100
        const oh = (l.el.naturalHeight / l.el.naturalWidth) * ow
        if (pos.x >= l.pos.x && pos.x <= l.pos.x + ow && pos.y >= l.pos.y && pos.y <= l.pos.y + oh) return l
      } else if (ctx) {
        const { w, h } = measureTextLayer(ctx, l)
        if (pos.x >= l.pos.x && pos.x <= l.pos.x + w && pos.y >= l.pos.y && pos.y <= l.pos.y + h) return l
      }
    }
    return null
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    if (cropMode) { setCropStart(pos); setCropRect(null); setIsCropDragging(true); return }
    const hit = getLayerAtPos(pos)
    if (hit) {
      setActiveLayerId(hit.id)
      setIsDraggingLayer(true)
      layerDragRef.current = { startX: e.clientX, startY: e.clientY, origX: hit.pos.x, origY: hit.pos.y, id: hit.id }
    } else {
      setActiveLayerId(null)
    }
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e)
    if (isCropDragging && cropStart && cropMode) {
      setCropRect({ x: Math.min(cropStart.x, pos.x), y: Math.min(cropStart.y, pos.y), w: Math.abs(pos.x - cropStart.x), h: Math.abs(pos.y - cropStart.y) })
      return
    }
    if (isDraggingLayer && layerDragRef.current) {
      const rect = canvasRef.current!.getBoundingClientRect()
      const scaleX = canvasSize.w / rect.width; const scaleY = canvasSize.h / rect.height
      const dx = (e.clientX - layerDragRef.current.startX) * scaleX
      const dy = (e.clientY - layerDragRef.current.startY) * scaleY
      updateLayer(layerDragRef.current.id, { pos: { x: layerDragRef.current.origX + dx, y: layerDragRef.current.origY + dy } })
    }
  }

  const handleCanvasMouseUp = () => { setIsCropDragging(false); setIsDraggingLayer(false); layerDragRef.current = null }

  const applyCrop = () => {
    if (!cropRect || !imgEl) return
    const offscreen = document.createElement('canvas'); offscreen.width = canvasSize.w; offscreen.height = canvasSize.h
    const ctx = offscreen.getContext('2d')!
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`
    ctx.translate(canvasSize.w/2, canvasSize.h/2); ctx.rotate((rotation * Math.PI) / 180)
    if (flipH) ctx.scale(-1, 1)
    ctx.drawImage(imgEl, -canvasSize.w/2, -canvasSize.h/2, canvasSize.w, canvasSize.h)
    const tmp = document.createElement('canvas'); tmp.width = Math.max(1, cropRect.w); tmp.height = Math.max(1, cropRect.h)
    tmp.getContext('2d')!.drawImage(offscreen, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h)
    const newSrc = tmp.toDataURL('image/jpeg', 0.92)
    const img = new Image(); img.onload = () => { setImgEl(img); setCanvasSize({ w: cropRect.w, h: cropRect.h }); setCropRect(null); setCropMode(false) }; img.src = newSrc
  }

  const handleSave = () => { if (!canvasRef.current) return; onSave(canvasRef.current.toDataURL('image/jpeg', 0.92)) }

  const handleLayerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach((file, fi) => {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataSrc = ev.target?.result as string
        const img = new Image()
        img.onload = () => {
          const newLayer: ImageLayer = {
            kind: 'image',
            id: Date.now().toString(36) + fi,
            src: dataSrc, el: img,
            pos: { x: 40 + fi * 20, y: 40 + fi * 20 },
            scale: 50, visible: true, followColor: false,
            name: file.name.replace(/\.[^.]+$/, '').slice(0, 18),
          }
          setLayers(prev => [...prev, newLayer])
          setActiveLayerId(newLayer.id)
        }
        img.src = dataSrc
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>, targetLayerId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const ab = ev.target?.result as ArrayBuffer
      const fontName = `custom-${Date.now()}`
      const face = new FontFace(fontName, ab)
      face.load().then(loaded => {
        document.fonts.add(loaded)
        const entry = { label: file.name.replace(/\.[^.]+$/, '').slice(0, 20), family: fontName }
        setCustomFonts(prev => [...prev, entry])
        updateLayer(targetLayerId, { fontFamily: fontName, fontLabel: entry.label } as Partial<TextLayer>)
      }).catch(console.error)
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  const addTextLayer = () => {
    const newLayer: TextLayer = {
      kind: 'text',
      id: Date.now().toString(36) + 't',
      text: isZh ? '输入文字' : 'Your text',
      fontSize: 48,
      color: '#ffffff',
      fontFamily: PRESET_FONTS[0].family,
      fontLabel: PRESET_FONTS[0].label,
      pos: { x: 40, y: 40 },
      visible: true,
      name: isZh ? '文字图层' : 'Text',
    }
    setLayers(prev => [...prev, newLayer])
    setActiveLayerId(newLayer.id)
  }

  const getCursor = () => {
    if (cropMode) return 'crosshair'
    if (isDraggingLayer) return 'grabbing'
    return 'default'
  }

  const allFonts = [...PRESET_FONTS, ...customFonts]
  const sliders = [
    { label: isZh ? '亮度' : 'Brightness', value: brightness, set: setBrightness, min: 20, max: 200 },
    { label: isZh ? '对比度' : 'Contrast', value: contrast, set: setContrast, min: 20, max: 200 },
    { label: isZh ? '饱和度' : 'Saturate', value: saturate, set: setSaturate, min: 0, max: 200 },
  ]
  const monoSm: React.CSSProperties = { fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#666', textTransform: 'uppercase' as const, marginBottom: '14px' }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(20,20,20,0.96)', display: 'flex', flexDirection: 'column' }}>
      {/* top bar */}
      <div style={{ height: '56px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em' }}>{isZh ? '← 取消' : '← Cancel'}</button>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.15em', color: '#aaa', textTransform: 'uppercase' }}>{isZh ? '图片编辑器' : 'Image Editor'}</span>
        <button onClick={handleSave} style={{ background: '#f7f7f5', color: '#1a1a1a', border: 'none', padding: '10px 24px', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>{isZh ? '保存' : 'Save'}</button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 300px', overflow: 'hidden' }}>
        {/* canvas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', overflow: 'auto' }}>
          <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '10px', cursor: getCursor(), boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseUp} />
        </div>

        {/* right panel */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* 调色 */}
          <div>
            <p style={monoSm}>{isZh ? '调色' : 'Adjustments'}</p>
            {sliders.map(s => (
              <div key={s.label} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#888' }}>{s.label}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#555' }}>{s.value}%</span>
                </div>
                <input type="range" min={s.min} max={s.max} value={s.value} onChange={e => s.set(Number(e.target.value))} style={{ width: '100%', accentColor: '#f7f7f5' }} />
              </div>
            ))}
            <button onClick={() => { setBrightness(100); setContrast(100); setSaturate(100) }} style={{ fontSize: '0.68rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em' }}>{isZh ? '重置' : 'Reset'}</button>
          </div>

          {/* 旋转/翻转 */}
          <div>
            <p style={monoSm}>{isZh ? '旋转 / 翻转' : 'Rotate / Flip'}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[90, 180, 270].map(deg => (
                <button key={deg} onClick={() => setRotation(r => (r + deg) % 360)}
                  style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>+{deg}°</button>
              ))}
              <button onClick={() => setFlipH(f => !f)}
                style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: flipH ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>⇄ {isZh ? '翻转' : 'Flip'}</button>
            </div>
          </div>

          {/* 裁剪 */}
          <div>
            <p style={monoSm}>{isZh ? '裁剪主图' : 'Crop Main'}</p>
            {!cropMode
              ? <button onClick={() => { setCropMode(true); setCropRect(null) }} style={{ width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em' }}>{isZh ? '✂ 开始裁剪' : '✂ Start Crop'}</button>
              : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#666' }}>{isZh ? '在画布上拖动选区' : 'Drag on canvas to select'}</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={applyCrop} disabled={!cropRect} style={{ flex: 1, padding: '9px', background: cropRect ? '#f7f7f5' : 'rgba(255,255,255,0.1)', color: cropRect ? '#1a1a1a' : '#555', border: 'none', borderRadius: '8px', cursor: cropRect ? 'pointer' : 'not-allowed', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>{isZh ? '确认' : 'Apply'}</button>
                    <button onClick={() => { setCropMode(false); setCropRect(null) }} style={{ flex: 1, padding: '9px', background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>{isZh ? '取消' : 'Cancel'}</button>
                  </div>
                </div>
            }
          </div>

          {/* ── 图层 ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ ...monoSm, marginBottom: 0 }}>{isZh ? '图层' : 'Layers'} {layers.length > 0 && <span style={{ color: '#444' }}>({layers.length})</span>}</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={addTextLayer}
                  style={{ fontSize: '0.65rem', color: '#aaa', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ddd' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa' }}>
                  T+
                </button>
                <button onClick={() => layerInputRef.current?.click()}
                  style={{ fontSize: '0.65rem', color: '#aaa', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#ddd' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#aaa' }}>
                  IMG+
                </button>
              </div>
            </div>
            <input ref={layerInputRef} type="file" accept="image/*" multiple onChange={handleLayerUpload} style={{ display: 'none' }} />

            {layers.length === 0 && (
              <div style={{ border: '1.5px dashed rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', display: 'flex', gap: '8px' }}>
                <button onClick={addTextLayer} style={{ flex: 1, padding: '10px 6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.06em', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#aaa' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#555' }}>
                  T {isZh ? '文字' : 'Text'}
                </button>
                <button onClick={() => layerInputRef.current?.click()} style={{ flex: 1, padding: '10px 6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.06em', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#aaa' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#555' }}>
                  ⊞ {isZh ? '图片' : 'Image'}
                </button>
              </div>
            )}

            {/* 图层列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: layers.length > 0 ? '10px' : '0' }}>
              {[...layers].reverse().map((layer, ri) => {
                const isActive = layer.id === activeLayerId
                const isText = layer.kind === 'text'
                return (
                  <div key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    style={{ border: `1px solid ${isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', overflow: 'hidden', cursor: 'pointer', transition: 'all 0.12s' }}>

                    {/* 图层头部 */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px' }}>
                      {/* 缩略图 / 文字标识 */}
                      {isText
                        ? <div style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '4px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: layer.visible ? 1 : 0.3 }}>
                            <span style={{ fontSize: '14px', color: (layer as TextLayer).color, fontFamily: (layer as TextLayer).fontFamily, lineHeight: 1 }}>T</span>
                          </div>
                        : <img src={(layer as ImageLayer).src} alt="" style={{ width: '32px', height: '32px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0, opacity: layer.visible ? 1 : 0.3 }} />
                      }
                      {/* 名称 */}
                      <span style={{ flex: 1, fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: layer.visible ? '#ccc' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                        {layer.name || `Layer ${layers.length - ri}`}
                      </span>
                      {/* 眼睛 */}
                      <button onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? '#888' : '#333', fontSize: '0.85rem', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>
                        {layer.visible ? '👁' : '🙈'}
                      </button>
                      {/* 删除 */}
                      <button onClick={e => { e.stopPropagation(); setLayers(prev => prev.filter(l => l.id !== layer.id)); if (activeLayerId === layer.id) setActiveLayerId(null) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(191,74,74,0.5)', fontSize: '0.8rem', padding: '2px 4px', flexShrink: 0, lineHeight: 1, transition: 'color 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,74,74,1)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(191,74,74,0.5)')}>✕</button>
                    </div>

                    {/* 选中展开 */}
                    {isActive && (
                      <div style={{ padding: '10px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}
                        onClick={e => e.stopPropagation()}>

                        {isText ? (
                          // ── 文字图层控制 ──
                          <>
                            {/* 文字内容 */}
                            <textarea
                              value={(layer as TextLayer).text}
                              onChange={e => updateLayer(layer.id, { text: e.target.value } as Partial<TextLayer>)}
                              rows={3}
                              style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#ddd', fontFamily: (layer as TextLayer).fontFamily, fontSize: '0.88rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                            />
                            {/* 字号 */}
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '字号' : 'Size'}</span>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#444' }}>{(layer as TextLayer).fontSize}px</span>
                              </div>
                              <input type="range" min={10} max={200} value={(layer as TextLayer).fontSize}
                                onChange={e => updateLayer(layer.id, { fontSize: Number(e.target.value) } as Partial<TextLayer>)}
                                style={{ width: '100%', accentColor: '#f7f7f5' }} />
                            </div>
                            {/* 颜色 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666', flex: 1 }}>{isZh ? '颜色' : 'Color'}</span>
                              <input type="color" value={(layer as TextLayer).color}
                                onChange={e => updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>)}
                                style={{ width: '32px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none', padding: 0 }} />
                              <input type="text" value={(layer as TextLayer).color}
                                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>) }}
                                style={{ width: '72px', padding: '3px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', outline: 'none' }} />
                            </div>
                            {/* 字体 */}
                            <div>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666', display: 'block', marginBottom: '7px' }}>{isZh ? '字体' : 'Font'}</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {allFonts.map(f => (
                                  <button key={f.family} onClick={() => updateLayer(layer.id, { fontFamily: f.family, fontLabel: f.label } as Partial<TextLayer>)}
                                    style={{ padding: '4px 9px', borderRadius: '5px', border: `1px solid ${(layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: (layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.12)' : 'transparent', color: (layer as TextLayer).fontFamily === f.family ? '#eee' : '#666', cursor: 'pointer', fontFamily: f.family, fontSize: '0.72rem', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                                    {f.label}
                                  </button>
                                ))}
                                {/* 上传本地字体 */}
                                <button onClick={() => fontInputRef.current?.click()}
                                  style={{ padding: '4px 9px', borderRadius: '5px', border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.12s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = '#aaa' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#555' }}>
                                  + {isZh ? '本地字体' : 'Upload'}
                                </button>
                                <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                                  onChange={e => handleFontUpload(e, layer.id)} />
                              </div>
                            </div>
                            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444', margin: 0 }}>
                              {isZh ? '↖ 在画布上拖动此图层' : '↖ Drag this layer on canvas'}
                            </p>
                          </>
                        ) : (
                          // ── 图片图层控制 ──
                          <>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '大小' : 'Size'}</span>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#444' }}>{(layer as ImageLayer).scale}%</span>
                              </div>
                              <input type="range" min={3} max={150} value={(layer as ImageLayer).scale}
                                onChange={e => updateLayer(layer.id, { scale: Number(e.target.value) } as Partial<ImageLayer>)}
                                style={{ width: '100%', accentColor: '#f7f7f5' }} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '跟随调色' : 'Follow color'}</span>
                              <button onClick={() => updateLayer(layer.id, { followColor: !(layer as ImageLayer).followColor } as Partial<ImageLayer>)}
                                style={{ padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: (layer as ImageLayer).followColor ? '#4aab6f' : 'rgba(255,255,255,0.08)', color: (layer as ImageLayer).followColor ? '#fff' : '#555', fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', transition: 'all 0.15s' }}>
                                {(layer as ImageLayer).followColor ? 'YES' : 'NO'}
                              </button>
                            </div>
                            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444', margin: 0 }}>
                              {isZh ? '↖ 在画布上拖动此图层' : '↖ Drag this layer on canvas'}
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}