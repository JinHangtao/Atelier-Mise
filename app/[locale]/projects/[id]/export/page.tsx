'use client'
import React from 'react'
import { Rnd } from 'react-rnd'
import { buildExportHTML, THEMES } from '../../../../../lib/exportStyles'
import { ImageEditor } from './ImageEditor'
import { useExportPage } from './useExportPage'
import { ExportHtmlDialog, HtmlExportConfig, DEFAULT_HTML_EXPORT_CONFIG } from './ExportHtmlDialog'
import { CanvasArea } from './CanvasArea'
import { RightPanel } from './RightPanel'
import { pageHeight } from './pageHelpers'
import { useGridSystem } from './useGridSystem'
import { useEmojiPicker } from './useEmojiPicker'
import { EmojiBlock, ArrowDirection } from './types'
import { generateId } from './pageHelpers'
import EmojiPickerPanel from './EmojiPickerPanel'
import { exportCanvasFile } from '@/lib/canvasFormat'
import { MobileBottomSheet, MobileBottomBar, MobileAddSheet } from './MobileBottomSheet'

export default function ExportPage() {
  const s = useExportPage()
  const gridHook = useGridSystem()

  // ── Mobile detection + bottom sheet state ─────────────────────────────────
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const [mobileSheetBlock, setMobileSheetBlock] = React.useState<any>(null)
  const [mobileAddOpen, setMobileAddOpen] = React.useState(false)
  const mobileImageInputRef = React.useRef<HTMLInputElement>(null)
  // Expose setter so CanvasArea long-press can open sheet instead of ctxMenu on mobile
  ;(s as any).__openMobileSheet = setMobileSheetBlock
  const [gridEditMode, setGridEditMode] = React.useState(false)
  const [exportDialogOpen, setExportDialogOpen] = React.useState(false)
  const [htmlExportConfig, setHtmlExportConfig] = React.useState<HtmlExportConfig>(DEFAULT_HTML_EXPORT_CONFIG)
  const [immersive, setImmersive] = React.useState(false)
  const prevZoomRef = React.useRef<number>(1)
  const prevPanRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const canvasWrapRef = s.canvasWrapRef
  const [canvasExportOpen, setCanvasExportOpen] = React.useState(false)
  const [mobileExportOpen, setMobileExportOpen] = React.useState(false)
  const mobileExportRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!mobileExportOpen) return
    const handler = (e: MouseEvent) => {
      if (mobileExportRef.current && !mobileExportRef.current.contains(e.target as Node)) {
        setMobileExportOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileExportOpen])
  const [canvasFilename, setCanvasFilename] = React.useState(s.project?.title ?? 'untitled')
const handleOpen = () => { setCanvasFilename(s.project?.title ?? 'untitled'); setCanvasExportOpen(true) }
  // ── Emoji state ───────────────────────────────────────────────────────────
  const [emojiBlocks, setEmojiBlocks] = React.useState<EmojiBlock[]>([])
  const [selectedEmojiId, setSelectedEmojiId] = React.useState<string | null>(null)
  const emojiPicker = useEmojiPicker()

  // ── Undo history panel ───────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen] = React.useState(false)
  const historyRef = React.useRef<HTMLDivElement>(null)
  const historyBtnRef = React.useRef<HTMLButtonElement>(null)
  const [historyPos, setHistoryPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 })

  const openHistory = () => {
    if (historyBtnRef.current) {
      const r = historyBtnRef.current.getBoundingClientRect()
      setHistoryPos({ top: r.bottom + 8, left: r.left })
    }
    setHistoryOpen(v => !v)
  }

  // 点击外部关闭
  React.useEffect(() => {
    if (!historyOpen) return
    const handler = (e: MouseEvent) => {
      if (
        historyRef.current && !historyRef.current.contains(e.target as Node) &&
        historyBtnRef.current && !historyBtnRef.current.contains(e.target as Node)
      ) {
        setHistoryOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  // ── Workspace settings ────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const settingsRef = React.useRef<HTMLDivElement>(null)
  const [panelSide, setPanelSide] = React.useState<'left' | 'right'>(() => {
    try { return (localStorage.getItem('ws_panelSide') as 'left' | 'right') || 'right' } catch { return 'right' }
  })
  const [panelVisible, setPanelVisible] = React.useState<boolean>(() => {
    try { return localStorage.getItem('ws_panelVisible') !== 'false' } catch { return true }
  })
  const [hoverShadow, setHoverShadow] = React.useState<boolean>(() => {
    try { return localStorage.getItem('ws_hoverShadow') !== 'false' } catch { return true }
  })
  const [cursorShadow, setCursorShadow] = React.useState<boolean>(() => {
    try { return localStorage.getItem('ws_cursorShadow') !== 'false' } catch { return true }
  })
  const [cursorFill, setCursorFill] = React.useState<string>(() => {
    try { return localStorage.getItem('ws_cursorFill') || 'white' } catch { return 'white' }
  })
  const [cursorStroke, setCursorStroke] = React.useState<string>(() => {
    try { return localStorage.getItem('ws_cursorStroke') || 'black' } catch { return 'black' }
  })
  const [canvasBg, setCanvasBg] = React.useState<string>(() => {
    try { return localStorage.getItem('ws_canvasBg') || '#EBEBF0' } catch { return '#EBEBF0' }
  })
  const [dotGrid, setDotGrid] = React.useState<boolean>(() => {
    try { return localStorage.getItem('ws_dotGrid') === 'true' } catch { return false }
  })
  const [dotColor, setDotColor] = React.useState<string>(() => {
    try { return localStorage.getItem('ws_dotColor') || '#c8c8c4' } catch { return '#c8c8c4' }
  })
  const [pageRadius, setPageRadius] = React.useState<number>(() => {
    try { return Number(localStorage.getItem('ws_pageRadius') ?? 6) } catch { return 6 }
  })
  const [selectionStroke, setSelectionStroke] = React.useState<{ width: number; color: string }>(() => {
    try {
      const saved = localStorage.getItem('ws_selectionStroke')
      return saved ? JSON.parse(saved) : { width: 1.5, color: '#1a1a1a' }
    } catch { return { width: 1.5, color: '#1a1a1a' } }
  })
  const [selectionShadow, setSelectionShadow] = React.useState<{ size: number; color: string }>(() => {
    try {
      const saved = localStorage.getItem('ws_selectionShadow')
      return saved ? JSON.parse(saved) : { size: 32, color: 'rgba(0,0,0,0.12)' }
    } catch { return { size: 32, color: 'rgba(0,0,0,0.12)' } }
  })
  const [cursorStyle, setCursorStyle] = React.useState<'grab' | 'arrow'>(() => {
    try { return (localStorage.getItem('canvasCursorStyle') as 'grab' | 'arrow') || 'grab' } catch { return 'grab' }
  })

  // ── Immersive panel ───────────────────────────────────────────────────────
  const [immPanelMode, setImmPanelMode] = React.useState<'peek'|'hidden'>(() => {
    try { return (localStorage.getItem('ws_immPanelMode') as 'peek'|'hidden') || 'peek' } catch { return 'peek' }
  })
  const [immPanelSide, setImmPanelSide] = React.useState<'left'|'right'|'top'|'bottom'>(() => {
    try { return (localStorage.getItem('ws_immPanelSide') as any) || 'right' } catch { return 'right' }
  })
  const [immPanelPinned, setImmPanelPinned] = React.useState(false)
  const [immPanelOpen, setImmPanelOpen] = React.useState(false)

  const saveSetting = (key: string, val: string) => { try { localStorage.setItem(key, val) } catch {} }

  const immPanelCloseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const emojiBlocksRef = React.useRef<EmojiBlock[]>([])
  emojiBlocksRef.current = emojiBlocks

  const handleEmojiSelect = React.useCallback((emoji: string) => {
    const trigger = emojiPicker.state.trigger
    if (!trigger) return

    if (trigger.type === 'toolbar') {
      const newBlock: EmojiBlock = {
        id: generateId(),
        pageId: s.activePageId || '',
        emoji,
        x: 860 / 2 - 28,
        y: 160,
        size: 40,
      }
      if (!newBlock.pageId) return
      setEmojiBlocks(prev => [...prev, newBlock])
    } else {
      const { fromId, direction } = trigger
      // 用 ref 拿最新值，避免 stale closure
      const from = emojiBlocksRef.current.find(b => b.id === fromId)
      if (!from || from.x === undefined || from.y === undefined) return

      const OFFSET = 100
      const BLOCK_SIZE = 56
      const offsets: Record<ArrowDirection, { dx: number; dy: number }> = {
        top:    { dx: 0,                      dy: -(OFFSET + BLOCK_SIZE) },
        bottom: { dx: 0,                      dy:  (OFFSET + BLOCK_SIZE) },
        left:   { dx: -(OFFSET + BLOCK_SIZE), dy: 0 },
        right:  { dx:  (OFFSET + BLOCK_SIZE), dy: 0 },
      }
      const { dx, dy } = offsets[direction]
      const newBlock: EmojiBlock = {
        id: generateId(),
        pageId: from.pageId,
        emoji,
        x: from.x + dx,
        y: from.y + dy,
        size: 40,
        fromId,
        fromDirection: direction,
      }
      setEmojiBlocks(prev => [...prev, newBlock])
    }

    emojiPicker.close()
  }, [emojiPicker, s.activePageId])

  const sWithGrid = {
    ...s,
    ...gridHook,
    gridEditMode,
    setGridEditMode,
    // emoji
    emojiBlocks,
    setEmojiBlocks,
    selectedEmojiId,
    setSelectedEmojiId,
    emojiPickerState: emojiPicker.state,
    openEmojiFromToolbar: emojiPicker.openFromToolbar,
    openEmojiFromArrow: emojiPicker.openFromArrow,
    closeEmojiPicker: emojiPicker.close,
    handleEmojiSelect,
    // workspace settings
    hoverShadow,
    cursorShadow,
    cursorFill,
    cursorStroke,
    canvasBg,
    dotGrid,
    dotColor,
    pageRadius,
    selectionStroke,
    selectionShadow,
    cursorStyle,
  }

  const enterImmersive = React.useCallback(() => {
    // 从 panLayer DOM 读实际值，普通模式下 inline style 可能是空的
    // 必须用 getComputedStyle，否则 prevPanRef 存的是 {0,0} 导致退出时视角跳回原点
    const panLayerEl = s.panLayerRef?.current
    if (panLayerEl) {
      const ct = getComputedStyle(panLayerEl).transform
      if (ct && ct !== 'none') {
        const mat = new DOMMatrix(ct)
        prevPanRef.current  = { x: mat.m41, y: mat.m42 }
        prevZoomRef.current = mat.a
      } else {
        prevZoomRef.current = s.canvasZoom
        prevPanRef.current  = s.canvasPan
      }
    } else {
      prevZoomRef.current = s.canvasZoom
      prevPanRef.current  = s.canvasPan
    }
    setImmersive(true)

    setTimeout(() => {
      const PAGE_WIDTH   = 860
      const PAGE_GAP     = 48
      const LABEL_HEIGHT = 28
      const CANVAS_PAD_Y = 24

      const wrap = canvasWrapRef?.current
      const panLayer = s.panLayerRef?.current
      if (!wrap || !panLayer || !s.activePage) return

      const availW = wrap.offsetWidth
      const availH = wrap.offsetHeight

      const activeFrameEl = wrap.querySelector(`[data-page-id="${s.activePage.id}"]`) as HTMLElement | null
      const pgHFixed = pageHeight(s.activePage?.aspect ?? 'free', PAGE_WIDTH)
      const pgH = pgHFixed ?? (activeFrameEl?.offsetHeight ?? null)
      const zoomW = (availW - 48) / PAGE_WIDTH
      const zoomH = pgH ? (availH - 48) / pgH : zoomW
      const zoom  = +Math.min(zoomW, zoomH, 2).toFixed(2)

      // 从 DOM 读实际 pan（inline style 或 computed），不用 React state 闭包旧值
      const ct0 = getComputedStyle(panLayer).transform
      const mat0 = (ct0 && ct0 !== 'none') ? new DOMMatrix(ct0) : null
      const startPanX = mat0 ? mat0.m41 : s.canvasPan.x
      const startPanY = mat0 ? mat0.m42 : s.canvasPan.y

      // 先把 zoom 写入 DOM（带过渡），让 frame 缩放到位
      panLayer.style.transition = 'transform 480ms cubic-bezier(0.4,0,0.2,1)'
      panLayer.style.transform  = `translate(${startPanX}px,${startPanY}px) scale(${zoom})`

      setTimeout(() => {
        const frameEl = wrap.querySelector(`[data-page-id="${s.activePage!.id}"]`) as HTMLElement | null
        if (!frameEl) return
        const wrapRect  = wrap.getBoundingClientRect()
        const frameRect = frameEl.getBoundingClientRect()
        const frameCenterX = frameRect.left - wrapRect.left + frameRect.width  / 2
        const frameCenterY = frameRect.top  - wrapRect.top  + frameRect.height / 2
        const driftX = availW / 2 - frameCenterX
        const driftY = availH / 2 - frameCenterY
        const targetPanX = startPanX + driftX
        const targetPanY = startPanY + driftY
        panLayer.style.transition = 'transform 320ms cubic-bezier(0.4,0,0.2,1)'
        panLayer.style.transform  = `translate(${targetPanX}px,${targetPanY}px) scale(${zoom})`
        setTimeout(() => {
          s.setCanvasZoom(zoom)
          s.setCanvasPan({ x: targetPanX, y: targetPanY })
          panLayer.style.transition = 'none'
        }, 340)
      }, 520)
    }, 380)
  }, [s, canvasWrapRef])

  const exitImmersive = React.useCallback(() => {
    const panLayer = s.panLayerRef?.current
    const targetZoom = prevZoomRef.current
    const targetPan  = prevPanRef.current
    if (panLayer) {
      panLayer.style.transition = 'transform 400ms cubic-bezier(0.4,0,0.2,1)'
      panLayer.style.transform  = `translate(${targetPan.x}px,${targetPan.y}px) scale(${targetZoom})`
      setTimeout(() => {
        s.setCanvasZoom(targetZoom)
        s.setCanvasPan(targetPan)
        panLayer.style.transition = 'none'
      }, 420)
    } else {
      s.setCanvasZoom(targetZoom)
      s.setCanvasPan(targetPan)
    }
    setImmersive(false)
  }, [s])

  const handleImmEnter = React.useCallback(() => {
    if (immPanelCloseTimer.current) {
      clearTimeout(immPanelCloseTimer.current)
      immPanelCloseTimer.current = null
    }
    if (!immPanelPinned) setImmPanelOpen(true)
  }, [immPanelPinned])

  const handleImmLeave = React.useCallback(() => {
    if (immPanelPinned) return
    immPanelCloseTimer.current = setTimeout(() => {
      setImmPanelOpen(false)
    }, 150)
  }, [immPanelPinned])

  React.useEffect(() => {
    return () => {
      if (immPanelCloseTimer.current) clearTimeout(immPanelCloseTimer.current)
    }
  }, [])


  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      if (e.key === 'f' || e.key === 'F') immersive ? exitImmersive() : enterImmersive()
      if (e.key === 'Escape') exitImmersive()
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') { e.preventDefault(); s.redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [immersive, enterImmersive, exitImmersive, s])

  const { router, isZh, project, schools, pages, allBlocksForExport, exportOpts, saveStatus, undoStack, undo, redo, redoStack, clearAll,imageEditorUrl, imageEditorIdx, setImageEditorUrl, setImageEditorIdx, setBlocks, previewOpen, setPreviewOpen, doExportHTML, doExportPDF, doExportDOCX, } = s

  if (!project) return (
    <div style={{ padding: '60px', fontFamily: 'Space Mono, monospace', color: '#888' }}>
      {isZh ? '找不到项目' : 'Project not found'}
    </div>
  )

  // 计算当前默认光标，用于全局注入
  const _cursorFill   = cursorFill.replace(/#/g, '%23')
  const _cursorStroke = cursorStroke.replace(/#/g, '%23')
  const _globalCursor = `url("data:image/svg+xml,<svg height='40' width='40' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'><g fill='none'><path d='m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z' fill='${_cursorFill}' stroke='${_cursorFill}' stroke-width='1.2' stroke-linejoin='round'/><path d='m12 24.4219v-16.015l11.591 11.619h-6.781l-.411.124z' fill='none' stroke='${_cursorStroke}' stroke-width='0.8' stroke-linejoin='round'/><path d='m13 10.814v11.188l2.969-2.866.428-.139h4.768z' fill='${_cursorStroke}' stroke='${_cursorStroke}' stroke-width='0.4' stroke-linejoin='round'/></g></svg>") 15 10, default`

  return (
    <main style={{ height: '100dvh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace', display: 'flex', flexDirection: 'column', overflow: 'hidden', cursor: _globalCursor, ['--custom-cursor' as any]: _globalCursor }}>
      {/* 全局 cursor 覆盖 — button UA stylesheet 有 cursor:default，必须 !important 覆盖 */}
      <style>{`
        *, *::before, *::after { cursor: inherit }
        button, [role="button"], select, label, a { cursor: var(--custom-cursor) !important }
        ::-webkit-scrollbar { display: none; }
        input[type="text"], input[type="number"], input[type="email"], textarea, [contenteditable="true"] { cursor: text !important }
        input[type="range"] { cursor: ew-resize !important }
        input[type="color"] { cursor: var(--custom-cursor) !important }
        /* Tablet/mobile: lock body scroll but keep touch-action auto so JS pan can work */
        @media (max-width: 1200px) and (orientation: landscape) {
          html, body { overflow: hidden !important; height: 100% !important; overscroll-behavior: none !important; }
        }
        @media (max-width: 1024px) {
          html, body { overflow: hidden !important; height: 100% !important; overscroll-behavior: none !important; }
        }
        html, body { overscroll-behavior: none !important; }
      `}</style>
      {/* Export HTML Dialog */}
      <ExportHtmlDialog open={exportDialogOpen} config={htmlExportConfig} onChange={setHtmlExportConfig} onConfirm={() => { setExportDialogOpen(false); doExportHTML(htmlExportConfig) }} onCancel={() => setExportDialogOpen(false)} isZh={isZh}/>

      {/* Image Editor overlay */}
      {imageEditorUrl !== null && imageEditorIdx !== null && (
        <ImageEditor src={imageEditorUrl} isZh={isZh} onSave={dataUrl => {
          const blockId = (window as any).__editingBlockId
          const imgIdx  = (window as any).__editingImageIdx
          if (typeof imgIdx === 'number' && imgIdx >= 0) {
            s.updatePageBlocks(s.activePageId, prev => prev.map(bl => {
              if (bl.id !== blockId) return bl
              const imgs = [...(bl.images || [])]
              imgs[imgIdx] = dataUrl
              return { ...bl, images: imgs }
            }))
          } else {
            s.patchBlock(blockId, { content: dataUrl })
          }
          setImageEditorUrl(null)
          setImageEditorIdx(null)
        }} onClose={() => { setImageEditorUrl(null); setImageEditorIdx(null) }} />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
        @keyframes pulse  { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
        .draft-banner { animation: fadeIn 0.3s ease; }
        .page-frame { transition: box-shadow 0.18s; }
        .page-frame.active { box-shadow: 0 0 0 2.5px #1a1a1a, 0 8px 32px rgba(0,0,0,0.12); }
        .page-frame.cover-active { box-shadow: 0 0 0 2.5px #c4a044, 0 8px 32px rgba(196,160,68,0.15); }
      `}</style>

      {/* ── Nav ── */}
      <nav style={{ padding: isMobile ? '0 16px' : '0 32px', borderBottom: '1px solid rgba(26,26,26,0.1)', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', position: 'sticky',  top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: immersive ? '0px' : isMobile ? '48px' : '52px', overflow: 'hidden', opacity: immersive ? 0 : 1, transition: 'height 0.32s cubic-bezier(0.4,0,0.2,1), opacity 0.24s ease', gap: '16px', flexShrink: 0, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '8px' : '16px', minWidth: 0, overflow: 'hidden' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '0.78rem', letterSpacing: '0.12em', fontFamily: 'Inter, DM Sans, sans-serif', flexShrink: 0, padding: '0', transition: 'color 0.12s' }} onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')} onMouseLeave={e => (e.currentTarget.style.color = '#aaa')}>
            ← {isZh ? '返回' : 'Back'}
          </button>

          {/* ── 撤销历史记录 ── */}
          <div style={{ flexShrink: 0, display: isMobile ? 'none' : undefined }}>
            <button
              ref={historyBtnRef}
              onClick={openHistory}
              title={isZh ? '撤销历史' : 'Undo history'}
              style={{
                background: historyOpen ? 'rgba(26,26,26,0.06)' : 'transparent',
                border: '1px solid rgba(26,26,26,0.1)',
                padding: '5px 9px',
                borderRadius: '8px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                color: historyOpen ? '#1a1a1a' : '#aaa',
                transition: 'all 0.12s',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'Inter, DM Sans, sans-serif',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }}
              onMouseLeave={e => { if (!historyOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' } }}
            >
              <span style={{ fontSize: '0.82rem' }}>↺</span>
              {undoStack.current.length > 0 && (
                <span style={{ fontSize: '0.58rem', background: 'rgba(26,26,26,0.08)', padding: '1px 5px', borderRadius: 4, letterSpacing: '0.04em', color: '#888', fontWeight: 600 }}>
                  {undoStack.current.length}
                </span>
              )}
            </button>

            {historyOpen && (
              <div ref={historyRef} style={{
                position: 'fixed',
                top: historyPos.top,
                left: historyPos.left,
                width: 260,
                background: '#fff',
                borderRadius: 14,
                boxShadow: '0 8px 32px rgba(0,0,0,0.13), 0 0 0 1px rgba(26,26,26,0.07)',
                zIndex: 200,
                overflow: 'hidden',
                animation: 'fadeIn 0.18s ease',
                fontFamily: 'Inter, DM Sans, sans-serif',
              }}>
                {/* 标题栏 */}
                <div style={{ padding: '12px 16px 10px', borderBottom: '1px solid rgba(26,26,26,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbb', fontWeight: 600 }}>
                    {isZh ? '撤销历史' : 'Undo History'}
                  </span>
                  <span style={{ fontSize: '0.65rem', color: '#ccc' }}>
                    {undoStack.current.length} {isZh ? '条' : 'steps'}
                  </span>
                </div>

                {/* 列表 */}
                <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 0' }}>
                  {undoStack.current.length === 0 ? (
                    <div style={{ padding: '20px 16px', textAlign: 'center', color: '#ccc', fontSize: '0.75rem' }}>
                      {isZh ? '暂无撤销记录' : 'No history yet'}
                    </div>
                  ) : (
                    // 从最新到最旧排列，索引 0 = 最新
                    [...undoStack.current].reverse().map((snapshot, revIdx) => {
                      const realIdx = undoStack.current.length - 1 - revIdx
                      // stepsToUndo：当前在栈顶，点这条要 undo 多少次
                      const stepsToUndo = undoStack.current.length - realIdx
                      const isLatest = revIdx === 0
                      // 尝试读取 snapshot 的页面/块信息
                      const pageCount = Array.isArray((snapshot as any)?.pages) ? (snapshot as any).pages.length : null
                      const blockCount = Array.isArray((snapshot as any)?.pages)
                        ? (snapshot as any).pages.reduce((acc: number, p: any) => acc + (Array.isArray(p.blocks) ? p.blocks.length : 0), 0)
                        : null

                      return (
                        <button
                          key={realIdx}
                          onClick={() => {
                            for (let i = 0; i < stepsToUndo; i++) undo()
                            setHistoryOpen(false)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '9px 16px',
                            border: 'none',
                            background: isLatest ? 'rgba(26,26,26,0.03)' : 'transparent',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.05)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = isLatest ? 'rgba(26,26,26,0.03)' : 'transparent' }}
                        >
                          {/* 序号圆点 */}
                          <span style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: isLatest ? '#1a1a1a' : 'rgba(26,26,26,0.07)',
                            color: isLatest ? '#fff' : '#aaa',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.58rem', fontWeight: 700,
                          }}>
                            {undoStack.current.length - realIdx}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.75rem', color: '#1a1a1a', fontWeight: isLatest ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {isLatest
                                ? (isZh ? '最新状态（当前）' : 'Latest (current)')
                                : (isZh ? `回到第 ${stepsToUndo} 步前` : `Go back ${stepsToUndo} step${stepsToUndo > 1 ? 's' : ''}`)}
                            </div>
                            {(pageCount !== null || blockCount !== null) && (
                              <div style={{ fontSize: '0.62rem', color: '#bbb', marginTop: 1 }}>
                                {pageCount !== null && `${pageCount} ${isZh ? '页' : 'pages'}`}
                                {pageCount !== null && blockCount !== null && ' · '}
                                {blockCount !== null && `${blockCount} ${isZh ? '块' : 'blocks'}`}
                              </div>
                            )}
                          </div>
                          {!isLatest && (
                            <span style={{ fontSize: '0.6rem', color: '#ccc', flexShrink: 0 }}>↺</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>

                {/* 底部提示 */}
                <div style={{ padding: '8px 16px 10px', borderTop: '1px solid rgba(26,26,26,0.05)', fontSize: '0.6rem', color: '#ccc', textAlign: 'center' }}>
                  {isZh ? '点击任意记录跳回该状态' : 'Click any step to restore that state'}
                </div>
              </div>
            )}
          </div>

          {!isMobile && <span style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.1)', flexShrink: 0 }} />}
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.06em', color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? '110px' : '220px' }}>
            {project.title}
          </span>
          {!isMobile && <span style={{ fontSize: '0.68rem', letterSpacing: '0.1em', color: '#ccc', fontFamily: 'Inter, DM Sans, sans-serif', flexShrink: 0 }}>{isZh ? '导出编辑器' : 'Export Editor'}</span>}
          {!isMobile && s.activePage && (
            <span style={{ fontSize: '0.65rem', color: '#999', fontFamily: 'Space Mono, monospace', flexShrink: 0, background: s.activePage.isCover ? 'rgba(196,160,68,0.1)' : 'rgba(26,26,26,0.05)', padding: '3px 8px', borderRadius: '5px' }}>
              {s.activePage.isCover ? (isZh ? '封面' : 'Cover') : s.activePage.label} {' · '}{s.activePage.aspect}
            </span>
          )}
        </div>

        {/* Save status - desktop only (absolute positioning overlaps on mobile) */}
        {!isMobile && <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          {saveStatus === 'saving' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e8c06a', display: 'inline-block', animation: 'pulse 0.8s ease-in-out infinite' }} /><span style={{ fontSize: '0.65rem', color: '#c8a84a', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>SAVING…</span></>}
          {saveStatus === 'saved' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4aab6f', display: 'inline-block' }} /><span style={{ fontSize: '0.65rem', color: '#4aab6f', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>SAVED</span></>}
          {saveStatus === 'error' && <><span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#e05c5c', display: 'inline-block' }} /><span style={{ fontSize: '0.65rem', color: '#e05c5c', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>ERROR</span></>}
          {saveStatus === 'idle' && <span style={{ fontSize: '0.65rem', color: '#d0d0cc', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif' }}>{pages.length} PAGES · {allBlocksForExport.length} BLOCKS</span>}
        </div>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
          {!isMobile && <button onClick={undo} disabled={undoStack.current.length === 0} title={isZh ? '撤销 (⌘Z)' : 'Undo (⌘Z)'} style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.1)', padding: '7px 12px', borderRadius: '8px', fontSize: '0.82rem', cursor: undoStack.current.length === 0 ? 'not-allowed' : 'pointer', color: undoStack.current.length === 0 ? '#ddd' : '#888', transition: 'all 0.12s' }}>↩</button>}
          {!isMobile && <button onClick={redo} disabled={redoStack.current.length === 0} title={isZh ? '重做 (⌘⇧Z)' : 'Redo (⌘⇧Z)'} style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.1)', padding: '7px 12px', borderRadius: '8px', fontSize: '0.82rem', cursor: redoStack.current.length === 0 ? 'not-allowed' : 'pointer', color: redoStack.current.length === 0 ? '#ddd' : '#888', transition: 'all 0.12s' }}>↪</button>}
          {!isMobile && allBlocksForExport.length > 0 && (
            <button onClick={() => {
              if (window.confirm(isZh ? '清空全部页面？此操作不可撤销。' : 'Clear all pages? This cannot be undone.')) clearAll()
            }} style={{ background: 'transparent', border: '1px solid rgba(180,80,80,0.18)', padding: '7px 12px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.06em', cursor: 'pointer', color: 'rgba(180,80,80,0.45)', fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.45)'; e.currentTarget.style.color = 'rgba(180,80,80,0.85)' }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.18)'; e.currentTarget.style.color = 'rgba(180,80,80,0.45)' }}>
              Clear
            </button>
          )}
          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.08)' }} />}

          {/* ⚙ Settings - desktop only */}
          {!isMobile && <div style={{ position: 'relative' }} ref={settingsRef}>
            <button
              onClick={() => setSettingsOpen(v => !v)}
              title={isZh ? '工作台设置' : 'Workspace settings'}
              style={{ background: settingsOpen ? 'rgba(26,26,26,0.06)' : 'transparent', border: '1px solid rgba(26,26,26,0.1)', padding: '7px 10px', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', color: settingsOpen ? '#1a1a1a' : '#aaa', transition: 'all 0.12s', lineHeight: 1 }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }}
              onMouseLeave={e => { if (!settingsOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' } }}
            >⚙</button>
          </div>}

          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.08)' }} />}
          {!isMobile && <button onClick={() => enterImmersive()} title={isZh ? '沉浸模式 (F)' : 'Immersive mode (F)'} style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.1)', padding: '7px 11px', borderRadius: '8px', fontSize: '0.75rem', cursor: 'pointer', color: '#aaa', transition: 'all 0.12s', lineHeight: 1 }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#aaa' }}>⛶</button>}
          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.08)' }} />}

          {/* Save - always visible, compact on mobile */}
          <button
            onClick={handleOpen}
            style={{ background: 'rgba(74,171,111,0.06)', color: '#4aab6f', border: '1px solid rgba(74,171,111,0.25)', padding: isMobile ? '6px 10px' : '8px 14px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.06em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,171,111,0.12)'; e.currentTarget.style.borderColor = 'rgba(74,171,111,0.5)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(74,171,111,0.06)'; e.currentTarget.style.borderColor = 'rgba(74,171,111,0.25)' }}
          >
            {isMobile ? (isZh ? '保存' : 'Save') : (isZh ? '保存项目' : 'Save')}
            {!isMobile && <span style={{ fontSize: '0.58rem', background: 'rgba(74,171,111,0.15)', padding: '2px 6px', borderRadius: 4 }}>.sensei</span>}
          </button>

          {!isMobile && <div style={{ width: '1px', height: '18px', background: 'rgba(26,26,26,0.08)' }} />}

          {/* Export — desktop: HTML button only; mobile: dropdown with HTML/PDF/Word */}
          {isMobile ? (
            <div ref={mobileExportRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setMobileExportOpen(v => !v)}
                style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
              >
                {isZh ? '导出' : 'Export'}
                <span style={{ fontSize: '0.6rem', opacity: 0.6 }}>{mobileExportOpen ? '▲' : '▼'}</span>
              </button>
              {mobileExportOpen && (
                <div style={{ position: 'fixed', top: 'auto', right: 16, marginTop: 6, background: '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(26,26,26,0.07)', zIndex: 300, overflow: 'hidden', minWidth: 140, animation: 'fadeIn 0.15s ease', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                  {[
                    { label: 'HTML', sub: isZh ? '网页文件' : 'Web file', action: () => { setMobileExportOpen(false); setExportDialogOpen(true) } },
                    { label: 'PDF',  sub: isZh ? '打印 / 分享' : 'Print / share', action: () => { setMobileExportOpen(false); doExportPDF() } },
                    { label: 'Word', sub: isZh ? '.docx 文档' : '.docx document', action: () => { setMobileExportOpen(false); doExportDOCX() } },
                  ].map(({ label, sub, action }) => (
                    <button key={label} onClick={action} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', borderBottom: label !== 'Word' ? '1px solid rgba(26,26,26,0.06)' : 'none' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1a1a1a' }}>{label}</span>
                      <span style={{ fontSize: '0.65rem', color: '#aaa', marginLeft: 10 }}>{sub}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => setExportDialogOpen(true)} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.1em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '7px', fontWeight: 600 }}>
              {isZh ? '导出' : 'Export'}
              <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.18)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.06em' }}>HTML</span>
            </button>
          )}

          {!isMobile && <><button onClick={() => doExportPDF()} style={{ background: 'transparent', color: '#666', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.08em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}>PDF</button>
          <button onClick={() => doExportDOCX()} style={{ background: 'transparent', color: '#666', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 14px', borderRadius: '8px', fontSize: '0.72rem', letterSpacing: '0.08em', fontFamily: 'Inter, DM Sans, sans-serif', cursor: 'pointer', transition: 'all 0.12s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.color = '#1a1a1a' }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#666' }}>Word</button></>}
        </div>
      </nav>

      {/* .sensei 导出弹窗 */}
      {canvasExportOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setCanvasExportOpen(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div style={{ background: '#fff', borderRadius: 18, padding: '28px 32px', width: 360, boxShadow: '0 16px 48px rgba(0,0,0,0.16)', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, DM Sans, sans-serif' }}>
            <div>
              <p style={{ fontSize: '0.6rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#bbb', fontWeight: 600, margin: '0 0 6px' }}>{isZh ? '保存为项目文件' : 'Save project file'}</p>
              <p style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{isZh ? '导出 .sensei' : 'Export .sensei'}</p>
            </div>
            <div>
              <p style={{ fontSize: '0.72rem', color: '#888', marginBottom: 8 }}>{isZh ? '文件名' : 'Filename'}</p>
              <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid rgba(26,26,26,0.12)', borderRadius: 10, overflow: 'hidden' }}>
                <input
                  value={canvasFilename}
                  onChange={e => setCanvasFilename(e.target.value)}
                  autoFocus
                  style={{ flex: 1, border: 'none', outline: 'none', padding: '10px 14px', fontSize: '0.85rem', color: '#1a1a1a', fontFamily: 'inherit', background: 'transparent' }}
                  placeholder="untitled"
                />
                <span style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#aaa', borderLeft: '1px solid rgba(26,26,26,0.08)', background: '#fafafa' }}>.sensei</span>
              </div>
            </div>
            <div style={{ background: '#f7f7f5', borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: isZh ? '页面数' : 'Pages', value: `${pages.length}` },
                { label: isZh ? '元素数' : 'Blocks', value: `${allBlocksForExport.length}` },
                { label: isZh ? '格式' : 'Format', value: 'ZIP · 懒加载资源' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: '#aaa' }}>{label}</span>
                  <span style={{ color: '#1a1a1a', fontWeight: 500 }}>{value}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setCanvasExportOpen(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: '1px solid rgba(26,26,26,0.1)', background: 'transparent', fontSize: '0.82rem', color: '#888', cursor: 'pointer', fontFamily: 'inherit' }}>
                {isZh ? '取消' : 'Cancel'}
              </button>
              <button
                onClick={async () => {
                  setCanvasExportOpen(false)
                  const PAGE_WIDTH = 860
                  const pagesWithDimensions = pages.map(p => ({
                    ...p,
                    width: PAGE_WIDTH,
                    height: pageHeight(p.aspect ?? 'free', PAGE_WIDTH) ?? PAGE_WIDTH,
                  }))
                  await exportCanvasFile(project, pagesWithDimensions, canvasFilename || project.title)
                }}
                style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: '#1a1a1a', fontSize: '0.82rem', color: '#fff', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit' }}>
                {isZh ? '下载 .sensei ↓' : 'Download .sensei ↓'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main layout ── */}
      {isMobile ? (
        // ── Mobile: full-screen canvas only, no side panel ──
        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <CanvasArea {...sWithGrid} />
        </div>
      ) : (
      (() => {
        const panelCol = immersive ? '0px' : panelVisible ? '300px' : '0px'
        const cols = panelSide === 'left'
          ? `${panelCol} 1fr`
          : `1fr ${panelCol}`
        return (
          <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '0', flex: 1, minHeight: 0, height: 0, transition: 'grid-template-columns 0.32s cubic-bezier(0.4,0,0.2,1)', position: 'relative' }}>
            {panelSide === 'left' && (
              <div style={{ overflow: 'hidden', height: '100%', maxHeight: '100%', opacity: immersive || !panelVisible ? 0 : 1, transition: 'opacity 0.2s ease', minWidth: 0 }}>
                <RightPanel {...sWithGrid} />
              </div>
            )}
            <CanvasArea {...sWithGrid} />
            {panelSide === 'right' && (
              <div style={{ overflow: 'hidden', height: '100%', maxHeight: '100%', opacity: immersive || !panelVisible ? 0 : 1, transition: 'opacity 0.2s ease', minWidth: 0 }}>
                <RightPanel {...sWithGrid} />
              </div>
            )}
          </div>
        )
      })()
      )}

      {/* ── Immersive floating panel ── */}
      {immersive && (() => {
        const isOpen = immPanelOpen || immPanelPinned
        const PANEL_W = 300
        const PANEL_H = 420

        // 트리거 존 - 마우스가 가장자리에 오면 패널 열림
        const triggerStyle = (side: typeof immPanelSide): React.CSSProperties => {
          const base: React.CSSProperties = { position: 'fixed', zIndex: 490, cursor: 'pointer' }
          if (side === 'right')  return { ...base, top: 0, right: 0, width: immPanelMode === 'peek' ? 6 : 2, height: '100vh' }
          if (side === 'left')   return { ...base, top: 0, left: 0, width: immPanelMode === 'peek' ? 6 : 2, height: '100vh' }
          if (side === 'bottom') return { ...base, bottom: 0, left: 0, right: 0, height: immPanelMode === 'peek' ? 6 : 2 }
          return { ...base, top: 0, left: 0, right: 0, height: immPanelMode === 'peek' ? 6 : 2 }
        }

        // 패널 위치 + 애니메이션
        const panelStyle = (): React.CSSProperties => {
          const base: React.CSSProperties = {
            position: 'fixed', zIndex: 500,
            background: '#fff',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            transition: 'transform 0.32s cubic-bezier(0.34,1.1,0.64,1), opacity 0.28s ease',
            overflow: 'hidden',
          }
          if (immPanelSide === 'right') return {
            ...base, top: 0, right: 0, width: PANEL_W, height: '100vh',
            borderRadius: '16px 0 0 16px',
            transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
            opacity: isOpen ? 1 : 0,
          }
          if (immPanelSide === 'left') return {
            ...base, top: 0, left: 0, width: PANEL_W, height: '100vh',
            borderRadius: '0 16px 16px 0',
            transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
            opacity: isOpen ? 1 : 0,
          }
          if (immPanelSide === 'bottom') return {
            ...base, bottom: 0, left: '50%', marginLeft: -PANEL_W * 1.5,
            width: PANEL_W * 3, height: PANEL_H,
            borderRadius: '16px 16px 0 0',
            transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
            opacity: isOpen ? 1 : 0,
          }
          // top
          return {
            ...base, top: 0, left: '50%', marginLeft: -PANEL_W * 1.5,
            width: PANEL_W * 3, height: PANEL_H,
            borderRadius: '0 0 16px 16px',
            transform: isOpen ? 'translateY(0)' : 'translateY(-100%)',
            opacity: isOpen ? 1 : 0,
          }
        }

        // peek 인디케이터 (얇은 탭)
        const peekTabStyle = (): React.CSSProperties => {
          if (immPanelMode !== 'peek') return { display: 'none' }
          const base: React.CSSProperties = {
            position: 'fixed', zIndex: 491,
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(26,26,26,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            transition: 'opacity 0.2s',
            opacity: isOpen ? 0 : 1,
            pointerEvents: isOpen ? 'none' : 'auto',
          }
          if (immPanelSide === 'right')  return { ...base, top: '50%', right: 0, transform: 'translateY(-50%)', width: 20, height: 60, borderRadius: '8px 0 0 8px', flexDirection: 'column' }
          if (immPanelSide === 'left')   return { ...base, top: '50%', left: 0, transform: 'translateY(-50%)', width: 20, height: 60, borderRadius: '0 8px 8px 0', flexDirection: 'column' }
          if (immPanelSide === 'bottom') return { ...base, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 60, height: 20, borderRadius: '8px 8px 0 0', flexDirection: 'row' }
          return { ...base, top: 0, left: '50%', transform: 'translateX(-50%)', width: 60, height: 20, borderRadius: '0 0 8px 8px', flexDirection: 'row' }
        }

        return (
          <>
            {/* Peek tab */}
            <div style={peekTabStyle()} onClick={() => setImmPanelOpen(true)}>
              <span style={{ fontSize: 8, color: '#aaa', letterSpacing: '0.05em' }}>
                {immPanelSide === 'right' ? '‹‹' : immPanelSide === 'left' ? '››' : immPanelSide === 'bottom' ? '∧∧' : '∨∨'}
              </span>
            </div>

            {/* 트리거 존 */}
            <div
              style={triggerStyle(immPanelSide)}
              onMouseEnter={handleImmEnter}
              onMouseLeave={handleImmLeave}
            />

            {/* Floating panel */}
            <div
              style={panelStyle()}
              onMouseEnter={handleImmEnter}
              onMouseLeave={handleImmLeave}
            >
              {/* 핀 버튼 */}
              <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setImmPanelPinned(v => !v)}
                  title={immPanelPinned ? (isZh ? '取消固定' : 'Unpin') : (isZh ? '固定面板' : 'Pin panel')}
                  style={{ width: 28, height: 28, borderRadius: 8, border: `1px solid ${immPanelPinned ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, background: immPanelPinned ? 'rgba(26,26,26,0.08)' : 'rgba(255,255,255,0.9)', cursor: 'pointer', fontSize: 12, color: immPanelPinned ? '#1a1a1a' : '#aaa', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                >
                  📌
                </button>
              </div>
              <RightPanel {...sWithGrid} />
            </div>
          </>
        )
      })()}

      {/* ── Immersive mode hint ── */}
      <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 500, opacity: immersive ? 1 : 0, pointerEvents: immersive ? 'auto' : 'none', transition: 'opacity 0.3s ease', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(12,10,8,0.72)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid rgba(196,160,68,0.15)', borderRadius: '10px', padding: '8px 16px', }}>
        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'rgba(196,160,68,0.7)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.6rem', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, DM Sans, sans-serif', textTransform: 'uppercase' }}>
          {isZh ? '沉浸模式 · 按 F 或 Esc 退出' : 'Immersive · press F or Esc to exit'}
        </span>
        <button onClick={() => exitImmersive()} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: '0.75rem', padding: '0 0 0 4px', lineHeight: 1, transition: 'color 0.12s' }} onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.7)')} onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.3)')}>✕</button>
      </div>

      {/* ── Floating Preview ── */}
      {previewOpen && (
        <Rnd default={{ x: window.innerWidth - 480, y: window.innerHeight - 520, width: 420, height: 460 }} minWidth={280} minHeight={220} bounds="window" style={{ zIndex: 999 }}>
          <div style={{ width: '100%', height: '100%', background: '#ffffff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(26,26,26,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f7f7f5' }}>
              <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: '#666', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600 }}>{isZh ? '预览' : 'Preview'}</span>
              <button onClick={() => setPreviewOpen(false)} style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '0.75rem', padding: '0', lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
              <div style={{ background: '#ffffff', minHeight: '100%', padding: '20px', borderRadius: '4px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                {buildExportHTML(allBlocksForExport, project, schools, exportOpts, isZh)}
              </div>
            </div>
          </div>
        </Rnd>
      )}
      {/* ── Emoji Picker Panel ── fixed 定位，直接在 page 级渲染确保响应 state 变化 */}
      <EmojiPickerPanel
        state={emojiPicker.state}
        onSelect={handleEmojiSelect}
        onClose={emojiPicker.close}
      />
      {/* ── Workspace Settings Modal ── */}
      {settingsOpen && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}
        >
          <div style={{ width: 420, maxHeight: '90vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(0,0,0,0.22)', overflow: 'hidden', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#1a1a1a' }}>
                {isZh ? '工作台设置' : 'Workspace Settings'}
              </span>
              <button onClick={() => setSettingsOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', scrollbarWidth: 'none', msOverflowStyle: 'none', display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* 面板位置 */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 10 }}>{isZh ? '面板位置' : 'Panel Side'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {(['left', 'right'] as const).map(side => {
                    const isActive = panelSide === side
                    return (
                      <button key={side} onClick={() => { setPanelSide(side); saveSetting('ws_panelSide', side) }}
                        style={{ padding: '14px 0', borderRadius: 12, border: `1.5px solid ${isActive ? '#1a1a1a' : 'rgba(26,26,26,0.1)'}`, background: isActive ? 'rgba(26,26,26,0.05)' : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, transition: 'all 0.12s' }}>
                        {/* 미니 레이아웃 아이콘 */}
                        <div style={{ display: 'flex', gap: 3, width: 48, height: 28 }}>
                          {side === 'left' ? (
                            <>
                              <div style={{ width: 14, background: isActive ? '#1a1a1a' : '#ddd', borderRadius: 3 }} />
                              <div style={{ flex: 1, background: isActive ? 'rgba(26,26,26,0.15)' : '#f0f0f0', borderRadius: 3 }} />
                            </>
                          ) : (
                            <>
                              <div style={{ flex: 1, background: isActive ? 'rgba(26,26,26,0.15)' : '#f0f0f0', borderRadius: 3 }} />
                              <div style={{ width: 14, background: isActive ? '#1a1a1a' : '#ddd', borderRadius: 3 }} />
                            </>
                          )}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: isActive ? '#1a1a1a' : '#aaa', fontWeight: isActive ? 600 : 400 }}>
                          {side === 'left' ? (isZh ? '← 左侧' : '← Left') : (isZh ? '右侧 →' : 'Right →')}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 工作台背景色 */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 10 }}>{isZh ? '画布背景' : 'Canvas Background'}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    { hex: '#EBEBF0', label: isZh ? '默认灰' : 'Default' },
                    { hex: '#f7f7f5', label: isZh ? '暖白' : 'Warm' },
                    { hex: '#1a1a1a', label: isZh ? '深黑' : 'Dark' },
                    { hex: '#1e2a3a', label: isZh ? '深蓝' : 'Navy' },
                    { hex: '#1a2a1a', label: isZh ? '深绿' : 'Forest' },
                    { hex: '#2a1a2a', label: isZh ? '深紫' : 'Plum' },
                    { hex: '#ffffff', label: isZh ? '纯白' : 'White' },
                    { hex: '#f0ede8', label: isZh ? '米色' : 'Cream' },
                  ].map(({ hex, label }) => (
                    <button key={hex} title={label}
                      onClick={() => { setCanvasBg(hex); saveSetting('ws_canvasBg', hex) }}
                      style={{ width: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', background: hex, flexShrink: 0, padding: 0, transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: canvasBg === hex ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transform: canvasBg === hex ? 'scale(1.15)' : 'scale(1)', outline: hex === '#ffffff' ? '1px solid rgba(26,26,26,0.1)' : 'none' }} />
                  ))}
                  <label style={{ width: 28, height: 28, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                    <input type="color" value={canvasBg} onChange={e => { setCanvasBg(e.target.value); saveSetting('ws_canvasBg', e.target.value) }} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                  </label>
                </div>
              </div>

              {/* 圆点阵列 */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, margin: 0 }}>{isZh ? '圆点阵列' : 'Dot Grid'}</p>
                  <button onClick={() => { setDotGrid(v => { saveSetting('ws_dotGrid', String(!v)); return !v }) }}
                    style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: dotGrid ? '#1a1a1a' : '#e0e0e0', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <span style={{ position: 'absolute', top: 3, left: dotGrid ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                  </button>
                </div>
                {dotGrid && (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {['#c8c8c4', '#a0a0a0', '#666666', '#4a8abf', '#4aab6f', '#c4a044', '#ffffff'].map(c => (
                      <button key={c} onClick={() => { setDotColor(c); saveSetting('ws_dotColor', c) }}
                        style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: c, flexShrink: 0, padding: 0, boxShadow: dotColor === c ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transform: dotColor === c ? 'scale(1.18)' : 'scale(1)', transition: 'transform 0.1s, box-shadow 0.1s', outline: c === '#ffffff' ? '1px solid rgba(26,26,26,0.1)' : 'none' }} />
                    ))}
                    <label style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                      <input type="color" value={dotColor} onChange={e => { setDotColor(e.target.value); saveSetting('ws_dotColor', e.target.value) }} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </label>
                  </div>
                )}
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 页面外观 */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 16 }}>{isZh ? '页面外观' : 'Page Appearance'}</p>

                {/* 圆角 */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', color: '#555', fontWeight: 500 }}>{isZh ? '页面圆角' : 'Corner Radius'}</span>
                    <span style={{ fontSize: '0.68rem', color: '#aaa', fontFamily: 'Space Mono, monospace' }}>{pageRadius}px</span>
                  </div>
                  <input type="range" min={0} max={24} step={1} value={pageRadius}
                    onChange={e => { const v = Number(e.target.value); setPageRadius(v); saveSetting('ws_pageRadius', String(v)) }}
                    style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                    <span style={{ fontSize: '0.58rem', color: '#ccc', fontFamily: 'Space Mono, monospace' }}>0</span>
                    <span style={{ fontSize: '0.58rem', color: '#ccc', fontFamily: 'Space Mono, monospace' }}>24</span>
                  </div>
                </div>

                {/* 选中线条 */}
                <div style={{ marginBottom: 18 }}>
                  <p style={{ fontSize: '0.72rem', color: '#555', fontWeight: 500, marginBottom: 8 }}>{isZh ? '选中线条' : 'Selection Stroke'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.68rem', color: '#aaa' }}>{isZh ? '粗细' : 'Width'}</span>
                    <span style={{ fontSize: '0.68rem', color: '#aaa', fontFamily: 'Space Mono, monospace' }}>{selectionStroke.width}px</span>
                  </div>
                  <input type="range" min={0} max={6} step={0.25} value={selectionStroke.width}
                    onChange={e => { const v = { ...selectionStroke, width: Number(e.target.value) }; setSelectionStroke(v); saveSetting('ws_selectionStroke', JSON.stringify(v)) }}
                    style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer', marginBottom: 10 }} />
                  <span style={{ fontSize: '0.68rem', color: '#aaa', display: 'block', marginBottom: 6 }}>{isZh ? '颜色' : 'Color'}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {['#1a1a1a', '#c4a044', '#4aab6f', '#4a8abf', '#e05c5c', '#7048e8', '#ffffff'].map(hex => (
                      <button key={hex} onClick={() => { const v = { ...selectionStroke, color: hex }; setSelectionStroke(v); saveSetting('ws_selectionStroke', JSON.stringify(v)) }}
                        style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: hex, padding: 0, flexShrink: 0, transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: selectionStroke.color === hex ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transform: selectionStroke.color === hex ? 'scale(1.18)' : 'scale(1)', outline: hex === '#ffffff' ? '1px solid rgba(26,26,26,0.1)' : 'none' }} />
                    ))}
                    <label style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', flexShrink: 0 }}>
                      <input type="color" value={selectionStroke.color} onChange={e => { const v = { ...selectionStroke, color: e.target.value }; setSelectionStroke(v); saveSetting('ws_selectionStroke', JSON.stringify(v)) }} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </label>
                  </div>
                </div>

                {/* 选中阴影 */}
                <div>
                  <p style={{ fontSize: '0.72rem', color: '#555', fontWeight: 500, marginBottom: 8 }}>{isZh ? '选中阴影' : 'Selection Shadow'}</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: '0.68rem', color: '#aaa' }}>{isZh ? '扩散范围' : 'Spread'}</span>
                    <span style={{ fontSize: '0.68rem', color: '#aaa', fontFamily: 'Space Mono, monospace' }}>{selectionShadow.size}px</span>
                  </div>
                  <input type="range" min={0} max={64} step={2} value={selectionShadow.size}
                    onChange={e => { const v = { ...selectionShadow, size: Number(e.target.value) }; setSelectionShadow(v); saveSetting('ws_selectionShadow', JSON.stringify(v)) }}
                    style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer', marginBottom: 10 }} />
                  <span style={{ fontSize: '0.68rem', color: '#aaa', display: 'block', marginBottom: 6 }}>{isZh ? '颜色' : 'Color'}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[
                      { label: '黑', val: 'rgba(0,0,0,0.12)' },
                      { label: '金', val: 'rgba(196,160,68,0.2)' },
                      { label: '绿', val: 'rgba(74,171,111,0.2)' },
                      { label: '蓝', val: 'rgba(74,138,191,0.2)' },
                      { label: '红', val: 'rgba(224,92,92,0.2)' },
                      { label: '紫', val: 'rgba(112,72,232,0.2)' },
                    ].map(({ label, val }) => (
                      <button key={val} title={label} onClick={() => { const v = { ...selectionShadow, color: val }; setSelectionShadow(v); saveSetting('ws_selectionShadow', JSON.stringify(v)) }}
                        style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: val.replace(/[\d.]+\)$/, '0.85)'), padding: 0, flexShrink: 0, transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: selectionShadow.color === val ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transform: selectionShadow.color === val ? 'scale(1.18)' : 'scale(1)' }} />
                    ))}
                    <label style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', flexShrink: 0 }}>
                      <input type="color" onChange={e => { const v = { ...selectionShadow, color: e.target.value }; setSelectionShadow(v); saveSetting('ws_selectionShadow', JSON.stringify(v)) }} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                    </label>
                  </div>
                </div>
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 鼠标样式 */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 10 }}>{isZh ? '鼠标样式' : 'Cursor Style'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {([
                    { val: 'grab',  icon: '🖐', label: isZh ? '手套' : 'Hand',  sub: isZh ? '平移画布时显示抓手' : 'Pan gesture feel' },
                    { val: 'arrow', icon: '↖',  label: isZh ? '箭头' : 'Arrow', sub: isZh ? 'Figma 风格箭头光标' : 'Figma-style pointer' },
                  ] as const).map(({ val, icon, label, sub }) => {
                    const isActive = cursorStyle === val
                    return (
                      <button key={val} onClick={() => { setCursorStyle(val); saveSetting('canvasCursorStyle', val) }}
                        style={{ padding: '14px 0', borderRadius: 12, border: `1.5px solid ${isActive ? '#1a1a1a' : 'rgba(26,26,26,0.1)'}`, background: isActive ? 'rgba(26,26,26,0.05)' : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, transition: 'all 0.12s' }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
                        <span style={{ fontSize: '0.72rem', color: isActive ? '#1a1a1a' : '#aaa', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                        <span style={{ fontSize: '0.6rem', color: '#bbb', textAlign: 'center', padding: '0 8px' }}>{sub}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 开关区 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {([
                  { key: 'panel', label: isZh ? '显示面板' : 'Show Panel', sub: isZh ? '隐藏后画布占满全屏' : 'Canvas fills full width when hidden', value: panelVisible, set: (v: boolean) => { setPanelVisible(v); saveSetting('ws_panelVisible', String(v)) } },
                  { key: 'hover', label: isZh ? '悬停阴影' : 'Hover Shadow', sub: isZh ? '鼠标停留在元素上时显示阴影' : 'Drop shadow when hovering over blocks', value: hoverShadow, set: (v: boolean) => { setHoverShadow(v); saveSetting('ws_hoverShadow', String(v)) } },
                  { key: 'cursorShadow', label: isZh ? '光标阴影' : 'Cursor Shadow', sub: isZh ? '自定义光标下方的投影效果' : 'Drop shadow beneath custom cursors', value: cursorShadow, set: (v: boolean) => { setCursorShadow(v); saveSetting('ws_cursorShadow', String(v)) } },
                ]).map((item, i) => (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
                    <div>
                      <p style={{ fontSize: '0.82rem', color: '#1a1a1a', fontWeight: 500, margin: 0 }}>{item.label}</p>
                      <p style={{ fontSize: '0.68rem', color: '#aaa', margin: '2px 0 0' }}>{item.sub}</p>
                    </div>
                    <button onClick={() => item.set(!item.value)}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: item.value ? '#1a1a1a' : '#e0e0e0', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <span style={{ position: 'absolute', top: 3, left: item.value ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }} />
                    </button>
                  </div>
                ))}
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 光标颜色 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {([
                  { key: 'fill',   label: isZh ? '光标填充色' : 'Cursor Fill',   val: cursorFill,   presets: ['white', '#1a1a1a', '#f7f7f5', '#4f46e5', '#c4a044', '#4aab6f', '#e45c3a'], set: (v: string) => { setCursorFill(v); saveSetting('ws_cursorFill', v) } },
                  { key: 'stroke', label: isZh ? '光标描边色' : 'Cursor Stroke', val: cursorStroke, presets: ['black', 'white', '#4f46e5', '#c4a044', '#4aab6f', '#e45c3a', '#1a1a1a'], set: (v: string) => { setCursorStroke(v); saveSetting('ws_cursorStroke', v) } },
                ] as const).map(item => (
                  <div key={item.key}>
                    <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 8 }}>{item.label}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {item.presets.map(c => (
                        <button key={c} onClick={() => item.set(c)}
                          style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', cursor: 'pointer', background: c, flexShrink: 0, padding: 0, transition: 'transform 0.1s, box-shadow 0.1s', boxShadow: item.val === c ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transform: item.val === c ? 'scale(1.18)' : 'scale(1)', outline: (c === 'white' || c === '#f7f7f5') ? '1px solid rgba(26,26,26,0.1)' : 'none' }} />
                      ))}
                      <label style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)', flexShrink: 0 }}>
                        <input type="color" value={item.val.startsWith('#') ? item.val : '#ffffff'} onChange={e => item.set(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* 分隔线 */}
              <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />

              {/* 沉浸模式面板设置 */}
              <div>
                <p style={{ fontSize: '0.6rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontWeight: 600, marginBottom: 12 }}>{isZh ? '沉浸模式面板' : 'Immersive Panel'}</p>

                {/* 弹出方向 */}
                <p style={{ fontSize: '0.72rem', color: '#666', marginBottom: 8 }}>{isZh ? '弹出方向' : 'Direction'}</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginBottom: 14 }}>
                  {([
                    { val: 'left',   icon: '◁', label: isZh ? '左' : 'Left' },
                    { val: 'right',  icon: '▷', label: isZh ? '右' : 'Right' },
                    { val: 'top',    icon: '△', label: isZh ? '上' : 'Top' },
                    { val: 'bottom', icon: '▽', label: isZh ? '下' : 'Bottom' },
                  ] as const).map(({ val, icon, label }) => {
                    const isActive = immPanelSide === val
                    return (
                      <button key={val} onClick={() => { setImmPanelSide(val); saveSetting('ws_immPanelSide', val) }}
                        style={{ padding: '10px 0', borderRadius: 10, border: `1.5px solid ${isActive ? '#1a1a1a' : 'rgba(26,26,26,0.1)'}`, background: isActive ? 'rgba(26,26,26,0.06)' : 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, transition: 'all 0.12s' }}>
                        <span style={{ fontSize: 14, color: isActive ? '#1a1a1a' : '#bbb' }}>{icon}</span>
                        <span style={{ fontSize: '0.62rem', color: isActive ? '#1a1a1a' : '#aaa', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                      </button>
                    )
                  })}
                </div>

                {/* 显示模式 */}
                <p style={{ fontSize: '0.72rem', color: '#666', marginBottom: 8 }}>{isZh ? '触发方式' : 'Trigger'}</p>
                <div style={{ display: 'flex', gap: 6, marginBottom: 0 }}>
                  {([
                    { val: 'peek', label: isZh ? '靠近边缘弹出' : 'Peek on hover', sub: isZh ? '显示细条' : 'Shows thin tab' },
                    { val: 'hidden', label: isZh ? '完全隐藏' : 'Fully hidden', sub: isZh ? '靠边缘触发' : 'Edge trigger' },
                  ] as const).map(({ val, label, sub }) => {
                    const isActive = immPanelMode === val
                    return (
                      <button key={val} onClick={() => { setImmPanelMode(val); saveSetting('ws_immPanelMode', val) }}
                        style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${isActive ? '#1a1a1a' : 'rgba(26,26,26,0.1)'}`, background: isActive ? 'rgba(26,26,26,0.06)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                        <p style={{ fontSize: '0.72rem', color: isActive ? '#1a1a1a' : '#888', fontWeight: isActive ? 600 : 400, margin: '0 0 2px' }}>{label}</p>
                        <p style={{ fontSize: '0.62rem', color: '#bbb', margin: 0 }}>{sub}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setSettingsOpen(false)}
                style={{ padding: '9px 24px', borderRadius: 10, background: '#1a1a1a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.04em' }}>
                {isZh ? '完成' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Bar ── */}
      {isMobile && (
        <MobileBottomBar
          zoom={s.canvasZoom}
          onZoomIn={() => {
            const nz = Math.min(3, +(s.canvasZoom + 0.15).toFixed(2))
            s.setCanvasZoom(nz)
            if (s.panLayerRef?.current) {
              s.panLayerRef.current.style.transform = `translate(${s.canvasPan.x}px,${s.canvasPan.y}px) scale(${nz})`
            }
          }}
          onZoomOut={() => {
            const nz = Math.max(0.2, +(s.canvasZoom - 0.15).toFixed(2))
            s.setCanvasZoom(nz)
            if (s.panLayerRef?.current) {
              s.panLayerRef.current.style.transform = `translate(${s.canvasPan.x}px,${s.canvasPan.y}px) scale(${nz})`
            }
          }}
          onZoomFit={() => {
            const wrap = canvasWrapRef?.current
            if (!wrap) return
            const PAGE_WIDTH = 860
            const availW = wrap.offsetWidth
            const zoom = +(availW / PAGE_WIDTH * 0.92).toFixed(3)
            const panX = (availW - PAGE_WIDTH * zoom) / 2
            s.setCanvasZoom(zoom)
            s.setCanvasPan({ x: panX, y: 24 })
            if (s.panLayerRef?.current) {
              s.panLayerRef.current.style.transform = `translate(${panX}px,24px) scale(${zoom})`
            }
          }}
          currentPage={s.pages.findIndex(p => p.id === s.activePageId) + 1 || 1}
          totalPages={s.pages.length}
          isZh={isZh}
          onAdd={() => setMobileAddOpen(true)}
        />
      )}

      {/* ── Mobile Image Input ── */}
      <input
        ref={mobileImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (!file) return
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            if (!dataUrl) return
            s.compressImage(dataUrl).then(compressed => {
              s.addImageBlock(compressed, 0, 0)
            })
          }
          reader.readAsDataURL(file)
          e.target.value = ''
        }}
      />

      {/* ── Mobile Add Sheet ── */}
      {isMobile && (
        <MobileAddSheet
          isOpen={mobileAddOpen}
          isZh={isZh}
          onClose={() => setMobileAddOpen(false)}
          onAddTitle={() => s.addBlockAt('title', isZh ? '新标题' : 'New Title', 0, 0)}
          onAddText={() => s.addBlockAt('note', isZh ? '在此输入内容…' : 'Type something…', 0, 0)}
          onAddImage={() => mobileImageInputRef.current?.click()}
        />
      )}

      {/* ── Mobile Bottom Sheet ── */}
      {isMobile && (
        <MobileBottomSheet
          block={mobileSheetBlock}
          isZh={isZh}
          onClose={() => setMobileSheetBlock(null)}
          onDelete={id => {
            s.updatePageBlocks(s.activePageId, prev => prev.filter(b => b.id !== id))
            s.setSelectedBlockId(null)
            setMobileSheetBlock(null)
          }}
          onDuplicate={id => {
            s.updatePageBlocks(s.activePageId, prev => {
              const src = prev.find(b => b.id === id)
              if (!src) return prev
              const { generateId } = require('./pageHelpers')
              const clone = { ...src, id: generateId(), pixelPos: src.pixelPos ? { ...src.pixelPos, x: src.pixelPos.x + 20, y: src.pixelPos.y + 20 } : src.pixelPos }
              return [...prev, clone]
            })
          }}
          onBringForward={id => {
            s.updatePageBlocks(s.activePageId, prev => {
              const idx = prev.findIndex(b => b.id === id)
              if (idx === -1 || idx === prev.length - 1) return prev
              const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr
            })
          }}
          onSendBackward={id => {
            s.updatePageBlocks(s.activePageId, prev => {
              const idx = prev.findIndex(b => b.id === id)
              if (idx <= 0) return prev
              const arr = [...prev]; [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; return arr
            })
          }}
          onBringToFront={id => {
            s.updatePageBlocks(s.activePageId, prev => {
              const idx = prev.findIndex(b => b.id === id)
              if (idx === -1) return prev
              const arr = [...prev]; const [item] = arr.splice(idx, 1); arr.push(item); return arr
            })
          }}
          onSendToBack={id => {
            s.updatePageBlocks(s.activePageId, prev => {
              const idx = prev.findIndex(b => b.id === id)
              if (idx <= 0) return prev
              const arr = [...prev]; const [item] = arr.splice(idx, 1); arr.unshift(item); return arr
            })
          }}
          onReplaceImage={id => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'
            inp.onchange = () => {
              const f = inp.files?.[0]; if (!f) return
              const reader = new FileReader()
              reader.onload = () => {
                s.compressImage(reader.result as string).then(compressed => {
                  const block = s.activePage?.blocks.find(b => b.id === id)
                  const imgEl = new window.Image()
                  imgEl.onload = () => {
                    const ratio = imgEl.naturalHeight / imgEl.naturalWidth
                    const curW = block?.pixelPos?.w ?? s.contentWidth
                    s.patchBlock(id, { content: compressed, pixelPos: block?.pixelPos ? { ...block.pixelPos, h: Math.round(curW * ratio) } : block?.pixelPos })
                  }
                  imgEl.src = compressed
                })
              }
              reader.readAsDataURL(f)
            }
            inp.click()
          }}
          onEditImage={id => {
            const block = s.activePage?.blocks.find(b => b.id === id)
            if (!block) return
            s.setImageEditorUrl(block.content)
            s.setImageEditorIdx(-1);
            (window as any).__editingBlockId = id;
            (window as any).__editingImageIdx = null
          }}
          onStartEdit={block => {
            s.startEdit(block as import('../../../../../lib/exportStyles').Block)
          }}
          onRemoveBg={(id, content) => {
            s.removeBackground(id, content)
          }}
        />
      )}
    </main>
  )
}