'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocalStorage } from '../../../../hooks/useLocalStorage'
import { useSearchParams, usePathname, useRouter } from 'next/navigation'
import { Project } from '../../../../types'
import { exportPDF, exportDOCX } from '../../../../lib/exportProject'
import {
  Block, School, ExportOptions, DEFAULT_EXPORT_OPTIONS,
  THEMES, FONTS, buildExportHTML, buildExportHTMLMultiPage,
} from '../../../../lib/exportStyles'
import { Page, Aspect, BlockType, SaveStatus } from './types'
import {
  generateId, aspectLabel, pageHeight, migrateOrLoad,
  defaultPages, makeNewPage, draftKey, optKey, pagesKey,
  idbGetPages, idbSetPages,
} from './pageHelpers'
import { destroyDrawLayerManager } from './DrawLayerManager'
import { makeLineBlock, makeArrowBlock } from './LineArrowLayer'
import type { LineArrowBlock } from './LineArrowLayer'
import type { UseGridSystemReturn } from './useGridSystem'
import {
  saveMediaImage,
  loadMediaImages,
  deleteMediaImage,
  saveImageIfNeeded,
  saveImagesIfNeeded,
} from './mediaLibraryDB'

export type ExportPageState = ReturnType<typeof useExportPage> &
  UseGridSystemReturn & {
    gridEditMode: boolean
    setGridEditMode: (v: boolean) => void
  }

export type Anchor = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'

export const TEXT_BLOCK_TYPES: BlockType[] = ['title', 'custom', 'note', 'milestone', 'school-profile']
export const FONT_OPTIONS = [
  { label: 'Inter',     value: 'Inter, DM Sans, sans-serif' },
  { label: 'Serif',     value: 'Georgia, "Noto Serif SC", serif' },
  { label: 'Mono',      value: '"Space Mono", "Courier New", monospace' },
  { label: 'Elegant',   value: '"Cormorant Garamond", Georgia, serif' },
  { label: 'DM Serif',  value: '"DM Serif Display", Georgia, serif' },
  { label: '宋体',       value: '"Songti SC", "Noto Serif SC", serif' },
]
export const COLOR_PRESETS = ['#1a1a1a', '#444444', '#888888', '#c4a044', '#4aab6f', '#4a8abf', '#dc783c', '#e05c5c', '#ffffff']

export function useExportPage() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router   = useRouter()
  const isZh = pathname.startsWith('/zh')
  const id = searchParams.get('id') as string

  const [projects, setProjects] = useLocalStorage<Project[]>('ps-projects', [])
  const [schools]               = useLocalStorage<School[]>('ps-schools', [])
  const project = projects.find(p => p.id === id)

  // ── Export options ──
  const [exportOpts, setExportOptsRaw] = useState<ExportOptions>(DEFAULT_EXPORT_OPTIONS)
  // 从 IndexedDB 加载 exportOpts
  useEffect(() => {
    idbGetPages(optKey(id)).then(saved => {
      if (saved) setExportOptsRaw({ ...DEFAULT_EXPORT_OPTIONS, ...(saved as ExportOptions) })
    }).catch(() => {
      // 降级：尝试旧 localStorage
      try {
        const raw = localStorage.getItem(optKey(id))
        if (raw) setExportOptsRaw({ ...DEFAULT_EXPORT_OPTIONS, ...JSON.parse(raw) })
      } catch {}
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  const setExportOpts = useCallback((opts: ExportOptions) => {
    setExportOptsRaw(opts)
    idbSetPages(optKey(id), opts).catch(console.error)
  }, [id])

  // ── Pages ──
  // 修复存量数据：将 pixelPos 超出页面尺寸的 block 夹紧到合法范围
  const sanitizePages = (raw: Page[]): Page[] => {
    const EW = 860
    return raw.map(p => {
      const frameH = pageHeight(p.aspect, EW) ?? 9999
      return {
        ...p,
        blocks: p.blocks.map(b => {
          if (!b.pixelPos) return b
          const { x, y, w, h } = b.pixelPos
          const clampedW = Math.min(w, EW)
          const clampedH = Math.min(h, frameH)
          const clampedX = Math.min(Math.max(x, 0), EW - clampedW)
          const clampedY = Math.min(Math.max(y, 0), frameH - clampedH)
          if (clampedW === w && clampedH === h && clampedX === x && clampedY === y) return b
          return { ...b, pixelPos: { x: clampedX, y: clampedY, w: clampedW, h: clampedH } }
        }),
      }
    })
  }
  // ── ref 镜像：让所有回调始终读到最新 pages，彻底消灭闭包旧快照导致的僵尸态 ──
  const pagesRef = useRef<Page[]>([])
  // migrateOrLoad 现在是 async（读 IndexedDB），初始先用默认页，mount 后异步加载
  const [pages, setPagesRaw] = useState<Page[]>(() => {
    const fresh = defaultPages()
    pagesRef.current = fresh
    return fresh
  })
  const [justRestored, setJustRestored] = useState(false)
  const [activePageId, setActivePageId] = useState<string>(
    () => pagesRef.current[0]?.id ?? ''
  )
  const activePageIdRef = useRef<string>('')
  activePageIdRef.current = activePageId

  // 异步从 IndexedDB 加载页面数据（替代原来同步读 localStorage 的 _initPages）
  const hasLoaded = useRef(false)
  useEffect(() => {
    if (hasLoaded.current) return
    hasLoaded.current = true
    migrateOrLoad(id).then(loaded => {
      const sanitized = sanitizePages(loaded)
      setPagesRaw(sanitized)
      pagesRef.current = sanitized
      setActivePageId(sanitized[0]?.id ?? '')
      setJustRestored(true)
    }).catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

// ── Undo / Redo ──
  const undoStack  = useRef<Page[][]>([])
  const redoStack  = useRef<Page[][]>([])
  const isUndoing  = useRef(false)
  const setPages   = useCallback((updater: Page[] | ((prev: Page[]) => Page[])) => {
    setPagesRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (!isUndoing.current) {
        undoStack.current = [...undoStack.current.slice(-49), prev]
        redoStack.current = []  // 新操作清空 redo
      }
      pagesRef.current = next
      return next
    })
  }, [])
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current[undoStack.current.length - 1]
    undoStack.current = undoStack.current.slice(0, -1)
    isUndoing.current = true
    setPagesRaw(cur => {
      redoStack.current = [...redoStack.current, cur]  // 当前状态推入 redo
      pagesRef.current = prev
      return prev
    })
    isUndoing.current = false
  }, [])
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current[redoStack.current.length - 1]
    redoStack.current = redoStack.current.slice(0, -1)
    isUndoing.current = true
    setPagesRaw(cur => {
      undoStack.current = [...undoStack.current, cur]  // 当前状态推回 undo
      pagesRef.current = next
      return next
    })
    isUndoing.current = false
  }, [])

  // ── Auto-save ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)
  useEffect(() => {
    if (!hasMounted.current) { hasMounted.current = true; return }
    // 初始加载时 pages 是 defaultPages()，等 hasLoaded 后才真正有数据，跳过空白页防止覆盖
    if (!hasLoaded.current) return
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      idbSetPages(pagesKey(id), pages)
        .then(() => {
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        })
        .catch(() => setSaveStatus('error'))
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [pages, id])

  // ── 迁移：把存量 base64 block.content 迁移到 IndexedDB ──────────────────────
  // 只跑一次，把旧数据搬走后更新 pages，localStorage 不再存大图
  const hasMigrated = useRef(false)
  useEffect(() => {
    if (hasMigrated.current) return
    hasMigrated.current = true
    const needsMigration = pages.some(p =>
      p.blocks.some(b =>
        (b.type === 'image' && b.content.startsWith('data:')) ||
        (b.type === 'image-row' && (b.images ?? []).some(u => u.startsWith('data:')))
      )
    )
    if (!needsMigration) return
    ;(async () => {
      const newPages = await Promise.all(pages.map(async p => ({
        ...p,
        blocks: await Promise.all(p.blocks.map(async b => {
          if (b.type === 'image' && b.content.startsWith('data:')) {
            try {
              const imgId = await saveMediaImage(id, b.content)
              return { ...b, content: `idb:${imgId}` }
            } catch { return b }
          }
          if (b.type === 'image-row' && (b.images ?? []).some(u => u.startsWith('data:'))) {
            try {
              const newImages = await Promise.all((b.images ?? []).map(async u => {
                if (!u.startsWith('data:')) return u
                const imgId = await saveMediaImage(id, u)
                return `idb:${imgId}`
              }))
              return { ...b, images: newImages }
            } catch { return b }
          }
          return b
        })),
      })))
      setPagesRaw(newPages)
      pagesRef.current = newPages
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Canvas zoom / pan ──
  const canvasWrapRef   = useRef<HTMLDivElement | null>(null)
  const isPanningRef    = useRef(false)
  const panStart        = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const [canvasZoom, setCanvasZoom]         = useState(1)
  const canvasZoomRef = useRef(1)  // ref 镜像，让拖拽回调不依赖闭包旧值
  useEffect(() => { canvasZoomRef.current = canvasZoom; liveZoom.current = canvasZoom }, [canvasZoom])
  const [canvasPan,  setCanvasPan]          = useState({ x: 0, y: 0 })
  const [canvasWrapWidth, setCanvasWrapWidth] = useState(900)
  const [panningCursor,   setPanningCursor]   = useState(false)
  const [shiftHeld,       setShiftHeld]       = useState(false)

  // Toolbar
  const [toolbarAnchor,   setToolbarAnchor]   = useState<Anchor>('top-center')
  const [toolbarDragging, setToolbarDragging] = useState(false)
  const [toolbarDragPos,  setToolbarDragPos]  = useState<{ x: number; y: number } | null>(null)
  const toolbarDragStart = useRef<{ mx: number; my: number; ex: number; ey: number } | null>(null)
  const toolbarRef       = useRef<HTMLDivElement | null>(null)

  // ── Live refs for DOM-direct pan/zoom (zero setState during wheel) ──────────
  const panLayerRef = useRef<HTMLDivElement | null>(null)
  const livePan     = useRef({ x: 0, y: 0 })
  const liveZoom    = useRef(1)

  // Keep live refs in sync when state changes from non-wheel sources
  useEffect(() => { livePan.current = { x: canvasPan.x, y: canvasPan.y } }, [canvasPan])
  useEffect(() => { liveZoom.current = canvasZoom }, [canvasZoom])

  const applyTransform = useCallback((pan: { x: number; y: number }, zoom: number, transition = 'none') => {
    if (panLayerRef.current) {
      panLayerRef.current.style.transition = transition
      panLayerRef.current.style.transform  = `translate(${pan.x}px,${pan.y}px) scale(${zoom})`
    }
  }, [])

  // Wheel listener — DOM-direct, zero setState during scroll, debounce settle on idle
  useEffect(() => {
    let el: HTMLDivElement | null = null
    let settleTimer = 0
    const MIN_ZOOM = 0.3, MAX_ZOOM = 3

    // settle: 用户停止操作后才 setState — 期间纯 DOM 直驱，零 re-render
    // ⚠️ 不加 CSS transition：transition + setState 同帧 = 闪烁根源
    const settle = () => {
      if (isPanningRef.current) return  // 鼠标拖拽中，不覆盖 pan
      applyTransform(livePan.current, liveZoom.current)
      setCanvasZoom(liveZoom.current)
      setCanvasPan({ x: livePan.current.x, y: livePan.current.y })
    }

    // RAF 节流：每帧最多写一次 DOM，防止同帧多次覆盖 transform 抖动
    let rafId = 0
    const scheduleApply = () => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        rafId = 0
        applyTransform(livePan.current, liveZoom.current)
      })
    }

    const handler = (e: WheelEvent) => {
      const wrap = canvasWrapRef.current
      if (!wrap) return
      e.preventDefault()
      const W = wrap.offsetWidth
      const H = wrap.offsetHeight
      const MARGIN = 120

      if (e.ctrlKey || e.metaKey) {
        const wrapRect = wrap.getBoundingClientRect()
        const mouseX   = e.clientX - wrapRect.left
        const mouseY   = e.clientY - wrapRect.top
        // exponential factor：鼠标和触控板统一公式，无需区分 isPinch，无跳变
        // clamp ±50 截断鼠标大步长，触控板小值（±1~15）原样通过
        const raw      = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
        const clamped  = Math.max(-50, Math.min(50, raw))
        const factor   = Math.pow(0.997, clamped)   // <0 放大, >0 缩小，连续无级
        const prevZoom = liveZoom.current
        const newZoom  = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor))
        const ratio    = newZoom / prevZoom
        liveZoom.current = +newZoom.toFixed(4)
        const halfVW = window.innerWidth
        livePan.current  = {
          x: Math.min(halfVW, Math.max(-halfVW, mouseX - (mouseX - livePan.current.x) * ratio)),
          y: Math.min(H - MARGIN, Math.max(-(H * 4), mouseY - (mouseY - livePan.current.y) * ratio)),
        }
      } else if (e.shiftKey) {
        const dx = (e.deltaY !== 0 ? e.deltaY : e.deltaX) * (e.deltaMode === 1 ? 16 : 1)
        const halfVW = window.innerWidth
        livePan.current = {
          x: Math.min(halfVW, Math.max(-halfVW, livePan.current.x - dx)),
          y: livePan.current.y,
        }
      } else {
        // 触控板双指滑动：同时处理 X/Y 轴，手感与系统原生一致
        const mult = e.deltaMode === 1 ? 16 : 1
        const halfVW = window.innerWidth
        livePan.current = {
          x: Math.min(halfVW, Math.max(-halfVW, livePan.current.x - e.deltaX * mult)),
          y: Math.min(H - MARGIN, Math.max(-(H * 4), livePan.current.y - e.deltaY * mult)),
        }
      }

      scheduleApply()
      clearTimeout(settleTimer)
      settleTimer = window.setTimeout(settle, 160)
    }

    let retryTimer = 0
    const tryBind = () => {
      const target = canvasWrapRef.current
      if (target && target !== el) {
        if (el) el.removeEventListener('wheel', handler)
        el = target
        el.addEventListener('wheel', handler, { passive: false })
      } else if (!target) {
        // PC 端 ref 附着可能晚于 effect mount，轮询直到绑上
        retryTimer = window.setTimeout(tryBind, 50)
      }
    }
    const raf = requestAnimationFrame(tryBind)
    return () => { cancelAnimationFrame(raf); clearTimeout(retryTimer); cancelAnimationFrame(rafId); if (el) el.removeEventListener('wheel', handler); clearTimeout(settleTimer) }
  }, [applyTransform]) // eslint-disable-line react-hooks/exhaustive-deps

  // ResizeObserver
  useEffect(() => {
    const target = canvasWrapRef.current
    if (!target) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setCanvasWrapWidth(entry.contentRect.width)
      }
    })
    ro.observe(target)
    const W = target.offsetWidth
    setCanvasWrapWidth(W)
    return () => ro.disconnect()
  }, [])

  // ── Bug fix: block-body 内的 img/video 不应拦截 frame 的 onClick ──
  // 封面点击失效根因：img 默认 pointer-events:auto，吃掉了 frame 的点击事件
  useEffect(() => {
    const styleId = 'export-editor-block-fix'
    if (document.getElementById(styleId)) return
    const style = document.createElement('style')
    style.id = styleId
    // 只对非激活页的 block 内 img/video 穿透，激活页保持完整交互
    // 激活页内未选中的 block，img 也穿透让点击落到 rnd-block 拖拽层
    style.textContent = [
      `.page-canvas-frame:not([data-active="true"]) .block-body img,`,
      `.page-canvas-frame:not([data-active="true"]) .block-body video {`,
      `  pointer-events: none;`,
      `}`,
      `.page-canvas-frame[data-active="true"] .rnd-block:not([data-selected="true"]) .block-body img,`,
      `.page-canvas-frame[data-active="true"] .rnd-block:not([data-selected="true"]) .block-body video {`,
      `  pointer-events: none;`,
      `}`,
    ].join('\n')
    document.head.appendChild(style)
    return () => { document.getElementById(styleId)?.remove() }
  }, [])

  // ── Page helpers ──
  const activePage = pages.find(p => p.id === activePageId) ?? pages[0]

  const updatePageBlocks = useCallback((pageId: string, updater: Block[] | ((b: Block[]) => Block[])) => {
    setPagesRaw(prev => {
      const next = prev.map(p => {
        if (p.id !== pageId) return p
        const nextBlocks = typeof updater === 'function' ? updater(p.blocks) : updater
        return { ...p, blocks: nextBlocks }
      })
      if (!isUndoing.current) {
        undoStack.current = [...undoStack.current.slice(-49), prev]
        redoStack.current = []
      }
      pagesRef.current = next
      return next
    })
  }, [setPagesRaw])

  const setBlocks = useCallback((updater: Block[] | ((b: Block[]) => Block[])) => {
    updatePageBlocks(activePageId, updater)
  }, [updatePageBlocks, activePageId])

  const blocks      = activePage?.blocks ?? []
  // ── 固定画布宽度 = 导出宽度，彻底消除 scale 换算，实现所见即所得 ──
  const EXPORT_WIDTH = 860
  const contentWidth = EXPORT_WIDTH

  const addPage = (aspect: Aspect) => {
    const nonCoverCount = pages.filter(p => !p.isCover).length
    const newPage = makeNewPage(nonCoverCount + 1, aspect)
    setPages(prev => [...prev, newPage])
    setActivePageId(newPage.id)
  }
  const deletePage = (pageId: string) => {
    // 删除页面时同时销毁其绘图数据（shapes + snapshot），
    // 否则 localStorage 残留会在"新建同 id 页面"时被错误恢复。
    destroyDrawLayerManager(pageId)
    setLineArrowBlocks(prev => prev.filter(b => b.pageId !== pageId))
    setPages(prev => {
      const next = prev.filter(p => p.id !== pageId)
      if (activePageId === pageId) setActivePageId(next[0]?.id ?? '')
      return next
    })
  }
  const duplicatePage = (pageId: string) => {
    setPages(prev => {
      const idx = prev.findIndex(p => p.id === pageId)
      if (idx === -1) return prev
      const original = prev[idx]
      const clone: Page = {
        ...original,
        id: generateId(),
        label: original.label + (isZh ? ' 副本' : ' copy'),
        isCover: false,
        blocks: original.blocks.map(b => ({ ...b, id: generateId() })),
      }
      // 复制原页面的矢量图形到新页面（shapes 存入 localStorage，
      // 新 manager mount 时会通过 _restoreShapes 读取）
      try {
        const srcShapesRaw = localStorage.getItem(`dlm-shapes-${pageId}`)
        if (srcShapesRaw) {
          localStorage.setItem(`dlm-shapes-${clone.id}`, srcShapesRaw)
        }
      } catch {}
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      setActivePageId(clone.id)
      return next
    })
  }
  const reorderPages = (from: number, to: number) => {
    setPages(prev => {
      const coverPage = prev.find(p => p.isCover)
      const rest      = prev.filter(p => !p.isCover)
      const fromRest  = from - (coverPage ? 1 : 0)
      const toRest    = to   - (coverPage ? 1 : 0)
      if (fromRest < 0 || toRest < 0) return prev
      const arr = [...rest]
      const [item] = arr.splice(fromRest, 1)
      arr.splice(toRest, 0, item)
      return coverPage ? [coverPage, ...arr] : arr
    })
  }
  const renamePage = (pageId: string, label: string) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, label } : p))
  }
  const changePageAspect = (pageId: string, aspect: Aspect) => {
    setPages(prev => prev.map(p => p.id === pageId ? { ...p, aspect } : p))
  }
  const clearAll = useCallback(() => {
    idbSetPages(pagesKey(id), null).catch(() => {})
    idbSetPages(draftKey(id), null).catch(() => {})
    idbSetPages(`line-arrows-${id}`, []).catch(() => {})
    // 清空所有页面的绘图数据，防止 _restoreShapes 在下次进入时读回旧图形
    pagesRef.current.forEach(p => destroyDrawLayerManager(p.id))
    const fresh = defaultPages()
    setPagesRaw(fresh)
    setActivePageId(fresh[0].id)
    setLineArrowBlocks([])
    undoStack.current = []
    setSaveStatus('idle')
  }, [id])

  // ── addLineArrowBlock ──
  const addLineArrowBlock = useCallback((type: 'line-block' | 'arrow-block') => {
    if (!activePageId) return
    const cx = 860 / 2
    const block = type === 'line-block'
      ? makeLineBlock(activePageId, cx, 300)
      : makeArrowBlock(activePageId, cx, 300)
    setLineArrowBlocks(prev => [...prev, block])
    setSelectedLineArrowId(block.id)
  }, [activePageId])

  // ── Block editor state ──
  const [customText,           setCustomText]           = useState('')
  const [schoolsExpanded,      setSchoolsExpanded]      = useState(false)
  const [editingBlockId,       setEditingBlockId]       = useState<string | null>(null)
  const [editingContent,       setEditingContent]       = useState('')
  const [editingCaption,       setEditingCaption]       = useState('')
  const [editingFontSize,      setEditingFontSize]      = useState<number>(16)
  const [editingImageCaptions, setEditingImageCaptions] = useState<string[]>([])
  const [selectedBlockId,      setSelectedBlockId]      = useState<string | null>(null)
  const [fontPickerOpen,       setFontPickerOpen]       = useState(false)
  const [colorPickerOpen,      setColorPickerOpen]      = useState(false)
  const [rightTab,             setRightTab]             = useState<'pages' | 'blocks' | 'draw' | 'style'>('pages')
  const [imageEditorUrl,       setImageEditorUrl]       = useState<string | null>(null)
  const [imageEditorIdx,       setImageEditorIdx]       = useState<number | null>(null)
  const [pagedExport,          setPagedExport]          = useState(false)
  const [previewOpen,          setPreviewOpen]          = useState(false)
  const [ctxMenu,              setCtxMenu]              = useState<{ x: number; y: number; gridX: number; gridY: number; blockId?: string } | null>(null)
  const [dragOverPageId,       setDragOverPageId]       = useState<string | null>(null)
  const [removingBgBlockId,    setRemovingBgBlockId]    = useState<string | null>(null)

  // ── Line / Arrow blocks ──
  const [lineArrowBlocks,    setLineArrowBlocks]    = useState<LineArrowBlock[]>([])
  const [selectedLineArrowId, setSelectedLineArrowId] = useState<string | null>(null)
  const lineArrowBlocksRef = useRef<LineArrowBlock[]>([])

  // 从 IndexedDB 加载 lineArrowBlocks（与 pages 异步加载同步触发）
  const hasLoadedLineArrows = useRef(false)
  useEffect(() => {
    if (hasLoadedLineArrows.current) return
    hasLoadedLineArrows.current = true
    idbGetPages(`line-arrows-${id}`).then(saved => {
      if (Array.isArray(saved) && saved.length > 0) {
        setLineArrowBlocks(saved as LineArrowBlock[])
        lineArrowBlocksRef.current = saved as LineArrowBlock[]
      }
    }).catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // lineArrowBlocks 变化时自动保存到 IndexedDB（防抖 600ms，与 pages auto-save 对齐）
  const lineArrowSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    lineArrowBlocksRef.current = lineArrowBlocks
    if (!hasLoadedLineArrows.current) return
    if (lineArrowSaveTimer.current) clearTimeout(lineArrowSaveTimer.current)
    lineArrowSaveTimer.current = setTimeout(() => {
      idbSetPages(`line-arrows-${id}`, lineArrowBlocks).catch(() => {})
    }, 600)
    return () => { if (lineArrowSaveTimer.current) clearTimeout(lineArrowSaveTimer.current) }
  }, [lineArrowBlocks, id])

  const dragIndex      = useRef<number | null>(null)
  const ctxImageInputRef   = useRef<HTMLInputElement | null>(null)

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockId && !editingBlockId) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
        e.preventDefault()
        updatePageBlocks(activePageId, prev => prev.filter(b => b.id !== selectedBlockId))
        setSelectedBlockId(null)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selectedBlockId && !editingBlockId) {
        e.preventDefault()
        updatePageBlocks(activePageId, prev => {
          const src = prev.find(b => b.id === selectedBlockId)
          if (!src) return prev
          const clone = { ...src, id: generateId(), pixelPos: src.pixelPos ? { ...src.pixelPos, x: src.pixelPos.x + 20, y: src.pixelPos.y + 20 } : src.pixelPos }
          setSelectedBlockId(clone.id)
          return [...prev, clone]
        })
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ']' && selectedBlockId && !editingBlockId) {
        e.preventDefault()
        updatePageBlocks(activePageId, prev => {
          const idx = prev.findIndex(b => b.id === selectedBlockId)
          if (idx === -1 || idx === prev.length - 1) return prev
          const arr = [...prev]; [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]; return arr
        })
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '[' && selectedBlockId && !editingBlockId) {
        e.preventDefault()
        updatePageBlocks(activePageId, prev => {
          const idx = prev.findIndex(b => b.id === selectedBlockId)
          if (idx <= 0) return prev
          const arr = [...prev]; [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]]; return arr
        })
        return
      }
      if (e.key === 'Escape') setEditingBlockId(null)
      if (e.key === 'Shift') setShiftHeld(true)
    }
    const upHandler = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', handler)
    window.addEventListener('keyup', upHandler)
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', upHandler) }
  }, [undo, selectedBlockId, editingBlockId, activePageId, updatePageBlocks])

  // ── Utilities ──
  const compressImage = (dataUrl: string, maxW = 1200, quality = 0.82): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxW / img.naturalWidth)
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        const pixels = ctx.getImageData(0, 0, w, h).data
        let hasAlpha = false
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 255) { hasAlpha = true; break }
        }
        resolve(hasAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(dataUrl) // 压缩失败直接用原图，不卡死
      img.src = dataUrl
    })

  const removeBackground = async (blockId: string, imageDataUrl: string) => {
    setRemovingBgBlockId(blockId)
    try {
      const { removeBackground: imglyRemoveBg } = await import('@imgly/background-removal')
      const blob = await imglyRemoveBg(imageDataUrl, {
        progress: (key: string, current: number, total: number) => {
          console.log(`[BG Removal] ${key}: ${Math.round((current / total) * 100)}%`)
        },
      })
      const reader = new FileReader()
      const resultUrl: string = await new Promise((resolve, reject) => {
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      patchBlock(blockId, { content: resultUrl })
    } catch (err) {
      console.error('Background removal failed:', err)
      alert(isZh ? '抠图失败，请检查是否已安装 @imgly/background-removal' : 'Background removal failed. Make sure @imgly/background-removal is installed.')
    } finally {
      setRemovingBgBlockId(null)
    }
  }

  // ── Block CRUD ──
  const addBlock = useCallback((type: BlockType, content: string, caption?: string, images?: string[]) => {
    const currentPageId = activePageIdRef.current || activePageId
    const targetPage = pagesRef.current.find(p => p.id === currentPageId) ?? pagesRef.current[0]
    if (!targetPage) return
    updatePageBlocks(targetPage.id, b => {
      const cw       = 860
      const isImage  = type === 'image' || type === 'image-row'
      const defaultW = isImage ? Math.round(cw * 0.5) : cw
      const defaultH = isImage ? Math.round(cw * 0.5625) : type === 'title' ? Math.round(cw * 0.3) : type === 'table' ? 160 : Math.round(cw * 0.2)
      // 图片：放在画布中心；其他 block：排到最下方
      const centerX  = isImage ? Math.round((cw - defaultW) / 2) : 20
      const centerY  = isImage ? Math.round((pageHeight(targetPage.aspect, cw) ?? 800) / 2 - defaultH / 2) : (
        b.length > 0
          ? b.reduce((max, bl) => Math.max(max, (bl.pixelPos?.y ?? 0) + (bl.pixelPos?.h ?? 0)), 0) + 20
          : 20
      )
      return [...b, { id: generateId(), type, content, caption, images, pixelPos: { x: centerX, y: centerY, w: defaultW, h: defaultH }, ...(type === 'table' ? { tableData: { rows: [[{text:'标题A',align:'left',bold:true},{text:'标题B',align:'left',bold:true},{text:'标题C',align:'left',bold:true}],[{text:'',align:'left'},{text:'',align:'left'},{text:'',align:'left'}],[{text:'',align:'left'},{text:'',align:'left'},{text:'',align:'left'}]], colWidths:[0.333,0.333,0.334], headerRow:true, headerCol:false, borderColor:'rgba(26,26,26,0.12)', fontSize:13, fontFamily:'Inter, DM Sans, sans-serif', cellPadding:10 } } : {}) }]
    })
  }, [updatePageBlocks])  // activePageId 通过 ref 读取，无需列为依赖

  // ── [修复] addBlockAt：改用 activePageIdRef + updatePageBlocks，与 addBlock 一致，
  // 避免 setBlocks 闭包捕获旧 activePageId 导致首次插入写入错误页面或静默失败。
  // 同时包裹 useCallback 使引用稳定，修复 addImageBlock deps 的陈旧引用问题。
  const addBlockAt = useCallback((type: BlockType, content: string, pxX: number, pxY: number, caption?: string, images?: string[]) => {
    const currentPageId = activePageIdRef.current || activePageId
    const cw       = contentWidth
    const isImage  = type === 'image' || type === 'image-row'
    const defaultW = isImage ? Math.round(cw * 0.5) : cw
    const defaultH = isImage ? Math.round(cw * 0.5625) : type === 'title' ? Math.round(cw * 0.3) : Math.round(cw * 0.2)
    // 图片：以鼠标点击点为中心放置；其他 block：左上角对齐点击点
    const finalX   = isImage ? Math.min(Math.max(Math.round(pxX - defaultW / 2), 0), cw - defaultW) : Math.min(pxX, cw - defaultW)
    const finalY   = isImage ? Math.max(Math.round(pxY - defaultH / 2), 0) : pxY
    updatePageBlocks(currentPageId, b => [...b, {
      id: generateId(), type, content, caption, images,
      pixelPos: { x: finalX, y: finalY, w: defaultW, h: defaultH },
    }])
  }, [updatePageBlocks, contentWidth])  // activePageId 通过 ref 读取，无需列为依赖

  // ── addImageBlock：快捷添加 image block，图片存入 IndexedDB，block 只存 idb:id ──
  const addImageBlock = useCallback(async (dataUrl: string, pxX?: number, pxY?: number) => {
    // 存入 IndexedDB，block.content 只存 "idb:imageId"
    let content = dataUrl
    try {
      const imageId = await saveMediaImage(id, dataUrl)
      content = `idb:${imageId}`
    } catch {
      // IndexedDB 失败时降级存 dataUrl（旧行为）
      content = dataUrl
    }
    if (pxX !== undefined && pxY !== undefined) {
      addBlockAt('image', content, pxX, pxY)
    } else {
      addBlock('image', content)
    }
  }, [addBlock, addBlockAt, id])

  // ── addToMediaLibrary：将图片加入媒体库（当前为 no-op，后续可扩展）──
  const addToMediaLibrary = useCallback((_dataUrl: string) => {
    // TODO: implement media library persistence
  }, [])

  const removeBlock = (blockId: string) => setBlocks(b => b.filter(x => x.id !== blockId))

  // ── [修复] patchBlock：不依赖 activePageId 闭包，遍历所有页找到 block 真实所在页写入 ──
  // 原实现：updatePageBlocks(activePageId, ...) 在跨页拖拽后 activePageId 尚未 re-render 更新，
  // 导致写入旧页面，block 在目标页进入僵尸态（可见但不可编辑/移动）。
  const patchBlock = useCallback((blockId: string, patch: Partial<Block>) => {
    setPages(prev => prev.map(p => {
      if (!p.blocks.some(b => b.id === blockId)) return p
      return { ...p, blocks: p.blocks.map(b => b.id === blockId ? { ...b, ...patch } : b) }
    }))
  }, [setPages])

  // ── 跨页移动：block 归属转移，坐标自由落点（不强制夹紧）──
  // newX/newY 是相对于目标页 frame 左上角的像素坐标
  const moveBlockToPage = useCallback((
    blockId:    string,
    fromPageId: string,
    toPageId:   string,
    newX:       number,
    newY:       number,
  ) => {
    if (fromPageId === toPageId) return
    setPages(prev => {
      const fromPage = prev.find(p => p.id === fromPageId)
      const toPage   = prev.find(p => p.id === toPageId)
      if (!fromPage || !toPage) return prev
      const block = fromPage.blocks.find(b => b.id === blockId)
      if (!block) return prev
      const bw = block.pixelPos?.w ?? 860
      const bh = block.pixelPos?.h ?? 100
      // 落点自由，只保证左上角不超出左/上边界，右下可超出（用户可再拖调整）
      const moved: Block = {
        ...block,
        pixelPos: { x: Math.max(newX, 0), y: Math.max(newY, 0), w: bw, h: bh },
      }
      return prev.map(p => {
        if (p.id === fromPageId) return { ...p, blocks: p.blocks.filter(b => b.id !== blockId) }
        if (p.id === toPageId)   return { ...p, blocks: [...p.blocks, moved] }
        return p
      })
    })
    // 清掉编辑态，激活目标页，选中该 block → 立即可编辑
    setEditingBlockId(null)
    setActivePageId(toPageId)
    setSelectedBlockId(blockId)
  }, [setPages])

  // ── 拖拽结束时检测是否跨页，自动调用 moveBlockToPage ──
  // 拖拽结束：用 block 自身 DOM 矩形和各页 frame 矩形做重叠面积检测
  // 重叠面积最大的 frame 就是归属页，松手即归属、完全可编辑
  // 注意：全部走 ref 读值（pagesRef / canvasZoomRef），永不依赖闭包旧快照
  const onBlockDragStop = useCallback((
    blockId:    string,
    fromPageId: string,
    dragX:      number,  // react-rnd 给的新 x（相对于 fromFrame）
    dragY:      number,  // react-rnd 给的新 y（相对于 fromFrame）
  ) => {
    const frames = Array.from(document.querySelectorAll('.page-canvas-frame')) as HTMLElement[]
    const fromFrame = frames.find(f => f.dataset.pageId === fromPageId)

    if (!fromFrame) {
      updatePageBlocks(fromPageId, prev => prev.map(b =>
        b.id === blockId ? { ...b, pixelPos: { ...b.pixelPos!, x: dragX, y: dragY } } : b
      ))
      return
    }

    // ✅ 用 pagesRef.current 读最新数据，不依赖闭包旧快照
    const srcBlock = pagesRef.current.find(p => p.id === fromPageId)?.blocks.find(b => b.id === blockId)
    const bw = srcBlock?.pixelPos?.w ?? 200
    const bh = srcBlock?.pixelPos?.h ?? 100

    // ✅ 用 canvasZoomRef.current 读最新缩放值
    const zoom = canvasZoomRef.current

    // 把 block 的像素坐标转成视口绝对矩形（考虑 canvasZoom）
    const fromRect = fromFrame.getBoundingClientRect()
    const blockAbsLeft   = fromRect.left + dragX * zoom
    const blockAbsTop    = fromRect.top  + dragY * zoom
    const blockAbsRight  = blockAbsLeft  + bw * zoom
    const blockAbsBottom = blockAbsTop   + bh * zoom

    // 计算与每个 frame 的重叠面积，取最大值
    let bestPageId: string = fromPageId
    let bestArea: number   = -1
    let bestFrame: HTMLElement = fromFrame

    for (const frame of frames) {
      const pid = frame.dataset.pageId
      if (!pid) continue
      const r = frame.getBoundingClientRect()
      const overlapW = Math.max(0, Math.min(blockAbsRight, r.right)   - Math.max(blockAbsLeft, r.left))
      const overlapH = Math.max(0, Math.min(blockAbsBottom, r.bottom) - Math.max(blockAbsTop,  r.top))
      const area = overlapW * overlapH
      if (area > bestArea) { bestArea = area; bestPageId = pid; bestFrame = frame }
    }

    if (bestPageId === fromPageId) {
      // 同页，正常更新坐标
      updatePageBlocks(fromPageId, prev => prev.map(b =>
        b.id === blockId ? { ...b, pixelPos: { ...b.pixelPos!, x: dragX, y: dragY } } : b
      ))
      return
    }

    // 跨页：把坐标换算到目标 frame 坐标系
    const targetRect = bestFrame.getBoundingClientRect()
    const newX = (blockAbsLeft - targetRect.left) / zoom
    const newY = (blockAbsTop  - targetRect.top)  / zoom
    moveBlockToPage(blockId, fromPageId, bestPageId, newX, newY)
  }, [updatePageBlocks, moveBlockToPage])  // ✅ 去掉 pages / canvasZoom，改走 ref

  const startEdit = (block: Block) => {
    setEditingBlockId(block.id)
    setEditingContent(block.content)
    setEditingCaption(block.caption || '')
    setEditingFontSize(block.fontSize ?? 16)
    setEditingImageCaptions(block.imageCaptions || (block.type === 'image' ? [''] : (block.images || []).map(() => '')))
  }

  // ── [修复] saveEdit：不依赖 activePageId 闭包，遍历所有页找到 block 真实所在页写入 ──
  // 原实现：updatePageBlocks(activePageId, ...) 在跨页拖拽后 activePageId 尚未 re-render 更新，
  // 导致 saveEdit 把内容写入旧页面，目标页上的 block 编辑内容丢失。
  const saveEdit = () => {
    if (!editingBlockId) return
    setPages(prev => prev.map(p => {
      if (!p.blocks.some(b => b.id === editingBlockId)) return p
      return {
        ...p,
        blocks: p.blocks.map(b =>
          b.id === editingBlockId
            ? { ...b, content: editingContent, caption: editingCaption, imageCaptions: editingImageCaptions, fontSize: editingFontSize }
            : b
        ),
      }
    }))
    setEditingBlockId(null)
  }
  const cancelEdit = () => setEditingBlockId(null)

  // ── Export ──
  // 画布宽度已固定为 EXPORT_WIDTH，坐标完全一致，无需任何 scale 换算
  const pagesForExport = pages.map(p => {
    const fixedH = pageHeight(p.aspect, EXPORT_WIDTH)
    const autoH  = p.blocks.reduce(
      (max, b) => Math.max(max, (b.pixelPos?.y ?? 0) + (b.pixelPos?.h ?? 0)),
      0,
    ) + 40
    return {
      blocks:     p.blocks,
      width:      EXPORT_WIDTH,
      height:     fixedH ?? autoH,
      background: p.background,
    }
  }).filter(p => p.blocks.length > 0)

  // 保留供 PDF 路径使用（exportPDF 仍需要）
  // 坐标已与画布一致，仅叠加页面 yOffset
  const allBlocksForExport: Block[] = pages.flatMap((p, pageIndex) => {
    const yOffset = pages.slice(0, pageIndex).reduce((sum, prev) => {
      const h = pageHeight(prev.aspect, EXPORT_WIDTH)
      return sum + (h ?? prev.blocks.reduce((m, b) => Math.max(m, (b.pixelPos?.y ?? 0) + (b.pixelPos?.h ?? 0)), 600))
    }, 0)
    return p.blocks.map(b => ({
      ...b,
      pixelPos: b.pixelPos ? { ...b.pixelPos, y: b.pixelPos.y + yOffset } : undefined,
    }))
  })

  // ── resolveIdbImages：把 pages 里所有 idb:id 替换成真实 dataUrl，供导出用 ──
  const resolveIdbImages = async (pagesToResolve: typeof pages): Promise<typeof pages> => {
    const idbImages = await loadMediaImages(id)
    return pagesToResolve.map(p => ({
      ...p,
      blocks: p.blocks.map(b => {
        const resolveUrl = (url: string) =>
          url.startsWith('idb:') ? (idbImages[url.slice(4)] ?? url) : url
        return {
          ...b,
          content: resolveUrl(b.content),
          images: b.images?.map(resolveUrl),
        }
      }),
    }))
  }

  // ── 核心截图逻辑，HTML / PDF / DOCX 共用 ─────────────────────────────────────
  const capturePages = async (): Promise<{ dataUrls: string[]; dims: { w: number; h: number }[] } | null> => {
    if (!project) return null
    const html2canvas = (await import('html2canvas-pro')).default
    setSelectedBlockId(null)
    setEditingBlockId(null)
    const exportablePageIds = pages.filter(p => p.blocks.length > 0).map(p => p.id)
    if (exportablePageIds.length === 0) {
      alert(isZh ? '没有可导出的页面' : 'No pages to export')
      return null
    }
    const prevActivePageId = activePageId

    // ── 平板 / 高 dpr 设备自适应导出倍率 ──────────────────────────────────────
    // iPad dpr=2，EXPORT_SCALE=4 → 实际 8x，单页 canvas 超过 3000×4000，内存溢出
    // 策略：目标最长边不超过 4096px（GPU纹理上限），反推 EXPORT_SCALE
    const dpr = window.devicePixelRatio || 1
    const TARGET_MAX_PX = 4096
    // 以固定 EXPORT_WIDTH=860 估算：860 * scale ≤ 4096 → scale ≤ 4.76
    // 再考虑 dpr：实际渲染像素 = cssW * scale，canvas 内容已是 dpr 倍，不需要额外补偿
    const EXPORT_SCALE = Math.min(4, Math.floor(TARGET_MAX_PX / 860))  // = 4，但受 dpr 保护
    // 平板（dpr≥2）时降到 2，PC（dpr=1）时保持 4
    const SAFE_EXPORT_SCALE = dpr >= 2 ? Math.min(EXPORT_SCALE, 2) : EXPORT_SCALE

    const dataUrls: string[] = []
    const dims: { w: number; h: number }[] = []
    for (let i = 0; i < exportablePageIds.length; i++) {
      const pageId = exportablePageIds[i]
      setActivePageId(pageId)

      // ── Bug1修复：平板渲染慢，等待时间自适应 ──────────────────────────────
      // PC 150ms 够，平板 Safari 需要更长时间等 React re-render + 图层 composite
      const waitMs = dpr >= 2 ? 300 : 150
      await new Promise(r => setTimeout(r, waitMs))

      // ── Bug5修复：用 data-page-id 精准找 DOM，不依赖顺序 index ──────────
      const el = document.querySelector<HTMLElement>(`.page-canvas-frame[data-page-id="${pageId}"]`)
        ?? (Array.from(document.querySelectorAll('.page-canvas-frame')) as HTMLElement[])[i]
      if (!el) continue

      const naturalW = el.offsetWidth
      const naturalH = el.offsetHeight
      const offscreenWrap = document.createElement('div')
      Object.assign(offscreenWrap.style, {
        position: 'fixed', top: '0', left: '0',
        width: `${naturalW}px`, height: `${naturalH}px`,
        overflow: 'visible', zIndex: '-9999',
        pointerEvents: 'none', transform: 'translateX(-99999px)',
      })
      const clone = el.cloneNode(true) as HTMLElement

      // ── 把原始 canvas 像素复制到 clone 里对应的 canvas ──────────────────
      // cloneNode 不复制 canvas 内容，需要手动 drawImage
      // Bug3修复：原来用 cssW*EXPORT_SCALE 算目标尺寸有误
      // 正确：目标像素 = src物理像素 × (SAFE_EXPORT_SCALE / dpr)
      // 这样 dpr=2 时不会把笔迹双倍拉伸
      const srcCanvases = Array.from(el.querySelectorAll('canvas')) as HTMLCanvasElement[]
      const dstCanvases = Array.from(clone.querySelectorAll('canvas')) as HTMLCanvasElement[]
      srcCanvases.forEach((src, idx) => {
        const dst = dstCanvases[idx]
        if (!dst) return
        // src.width 是物理像素，目标尺寸按导出倍率等比放大
        const scaleRatio = SAFE_EXPORT_SCALE / dpr
        dst.width  = Math.round(src.width  * scaleRatio)
        dst.height = Math.round(src.height * scaleRatio)
        const ctx = dst.getContext('2d')
        if (!ctx) return
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(
          src,
          0, 0, src.width, src.height,
          0, 0, dst.width, dst.height
        )
      })
      ;[
        '[data-resize-handle]', '[data-selection-overlay]', '[data-drag-handle]',
        '.block-toolbar', '.resize-handle', '.selection-ring', '.block-selected-indicator',
      ].forEach(sel => clone.querySelectorAll(sel).forEach(n => n.remove()))
      Object.assign(clone.style, {
        transform: 'none', zoom: '1', position: 'relative',
        top: '0', left: '0', width: `${naturalW}px`, height: `${naturalH}px`,
        boxShadow: 'none', outline: 'none',
      })
      // clone 안의 모든 overflow:hidden을 visible로 — box-shadow가 잘리지 않도록
      // react-rnd 내부 wrapper, block-body 등이 shadow를 clip할 수 있음
      Array.from(clone.querySelectorAll<HTMLElement>('*')).forEach(el => {
        const cs = getComputedStyle(el)
        if (cs.overflow === 'hidden' || cs.overflowX === 'hidden' || cs.overflowY === 'hidden') {
          // borderRadius가 있는 요소는 건드리지 않음 (이미지 크롭 유지)
          if (!cs.borderRadius || cs.borderRadius === '0px') {
            el.style.overflow = 'visible'
          }
        }
      })

      // ── 骚操作：在 clone 里给每个有阴影的图片注入一个绝对定位的 shadow div ──
      // 原理：在图片 wrapper 下面插一个 position:absolute 的 div，
      // 用 box-shadow 渲染柔和投影，让 html2canvas 直接截到，不依赖任何 canvas 后处理
      const _shadowPage = pagesRef.current.find(p => p.id === exportablePageIds[i])
      if (_shadowPage) {
        const _imgBlocksData = _shadowPage.blocks.filter(
          b => (b.type === 'image' || b.type === 'image-row') && (b.imgShadow ?? 0) > 0
        )
        _imgBlocksData.forEach((_b) => {
          const _blockEl = clone.querySelector<HTMLElement>(`[data-block-id="${_b.id}"]`)
          if (!_blockEl) return
          const _sh = _b.imgShadow ?? 0
          const _radius = _b.imgRadius ?? 0
          const _offsetY = Math.round(_sh * 0.35)
          const _blur = Math.round(_sh * 0.8)
          const _opacity = Math.min(0.55, 0.1 + _sh * 0.012)
          // 找图片实际尺寸容器（data-blockid div）
          const _imgWrapper = _blockEl.querySelector<HTMLElement>('[data-blockid]') ?? _blockEl
          // 注入 shadow div：绝对定位，尺寸和图片一样，box-shadow 向外柔和扩散
          const _shadowDiv = document.createElement('div')
          _shadowDiv.setAttribute('data-shadow-inject', '1')
          _shadowDiv.style.cssText = [
            'position:absolute',
            'inset:0',
            `border-radius:${_radius}px`,
            `box-shadow:0 ${_offsetY}px ${_blur}px rgba(0,0,0,${_opacity.toFixed(2)})`,
            'pointer-events:none',
            'z-index:-1',
          ].join(';')
          // 确保父容器 overflow:visible 让阴影不被裁掉
          _imgWrapper.style.overflow = 'visible'
          _imgWrapper.style.position = 'relative'
          let _parent = _imgWrapper.parentElement
          while (_parent && _parent !== clone) {
            if (getComputedStyle(_parent).overflow === 'hidden') {
              _parent.style.overflow = 'visible'
            }
            _parent = _parent.parentElement
          }
          _imgWrapper.appendChild(_shadowDiv)
        })
      }

      offscreenWrap.appendChild(clone)
      document.body.appendChild(offscreenWrap)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const pageBgColor = el.style.background || el.style.backgroundColor || '#ffffff'
      const canvas = await html2canvas(clone, {
        useCORS: true, allowTaint: true, scale: SAFE_EXPORT_SCALE,
        width: naturalW, height: naturalH,
        windowWidth: naturalW, windowHeight: naturalH,
        x: 0, y: 0, scrollX: 0, scrollY: 0,
        backgroundColor: pageBgColor,
        logging: false,
        ignoreElements: (node: Element) =>
          node.hasAttribute('data-html2canvas-ignore') ||
          node.classList.contains('block-toolbar') ||
          node.classList.contains('resize-handle') ||
          node.classList.contains('selection-ring'),
      })
      ;(canvas as any)._bgColor = pageBgColor
      // ── 截图后纯 Canvas 手绘阴影（完全绕开 html2canvas，不依赖 pixelPos）────────
      // 原理：clone 还挂在 offscreenWrap 里（已移出视口），
      // 直接用 getBoundingClientRect 读每张 img 的真实位置，换算到 canvas 坐标后手绘
      const SCALE = SAFE_EXPORT_SCALE
      const currentPage = pagesRef.current.find(p => p.id === exportablePageIds[i])
      const shadowBlocks = (currentPage?.blocks ?? []).filter(
        b => (b.type === 'image' || b.type === 'image-row') && (b.imgShadow ?? 0) > 0
      )

      // 收集 clone 里所有需要加阴影的 img 元素及其对应的 shadow 参数
      type ShadowTarget = { x: number; y: number; w: number; h: number; sh: number; radius: number }
      const shadowTargets: ShadowTarget[] = []

      if (shadowBlocks.length > 0) {
        const cloneRect = clone.getBoundingClientRect()
        shadowBlocks.forEach((shadowBlock) => {
          // data-block-id 精准匹配，不依赖顺序或坐标
          const blockEl = clone.querySelector<HTMLElement>(`[data-block-id="${shadowBlock.id}"]`)
          if (!blockEl) return
          const imgEls = Array.from(blockEl.querySelectorAll<HTMLImageElement>('img'))
          imgEls.forEach(imgEl => {
            const rect = imgEl.getBoundingClientRect()
            const x = rect.left - cloneRect.left
            const y = rect.top  - cloneRect.top
            const w = rect.width
            const h = rect.height
            if (w <= 0 || h <= 0) return
            shadowTargets.push({
              x, y, w, h,
              sh: shadowBlock.imgShadow ?? 0,
              radius: shadowBlock.imgRadius ?? 0,
            })
          })
        })
      }

      // ── inset shadow：在 removeChild 之前收集坐标（clone 还在 DOM 里）──
      type InsetTarget = { x: number; y: number; w: number; h: number; sh: number; radius: number }
      const insetTargets: InsetTarget[] = []
      if (currentPage) {
        const insetBlocks = currentPage.blocks.filter(
          b => (b.type === 'image' || b.type === 'image-row') && (b.imgInsetShadow ?? 0) > 0
        )
        if (insetBlocks.length > 0) {
          const cloneRect = clone.getBoundingClientRect()
          insetBlocks.forEach((insetBlock) => {
            const blockEl = clone.querySelector<HTMLElement>(`[data-block-id="${insetBlock.id}"]`)
            if (!blockEl) return
            const imgEls = Array.from(blockEl.querySelectorAll<HTMLImageElement>('img'))
            imgEls.forEach(imgEl => {
              const rect = imgEl.getBoundingClientRect()
              const x = rect.left - cloneRect.left
              const y = rect.top  - cloneRect.top
              const w = rect.width
              const h = rect.height
              if (w <= 0 || h <= 0) return
              insetTargets.push({
                x, y, w, h,
                sh: insetBlock.imgInsetShadow ?? 0,
                radius: insetBlock.imgRadius ?? 0,
              })
            })
          })
        }
      }

      // offscreenWrap 截图完成后移除
      document.body.removeChild(offscreenWrap)

      // outset shadow 由 clone DOM 注入的 shadow div 处理，html2canvas 直接截到
      let outputCanvas: HTMLCanvasElement = canvas

      // ── inset shadow canvas 手绘（destination-out 正确实现）──────────────────
      // 原理：
      //   1. offscreen 画与图片同形的黑色填充（实心形状）
      //   2. ctx.filter = blur() 模糊整个 offscreen（得到向外晕开的模糊块）
      //   3. destination-out 把形状中心"挖掉"，只留边缘晕圈
      //   4. clip 限制在图片矩形内，叠到 outputCanvas 上
      if (insetTargets.length > 0) {
        const ictx = outputCanvas.getContext('2d')!
        insetTargets.forEach(({ x, y, w, h, sh, radius }) => {
          const blurPx = Math.round(sh * SCALE)
          const cx = x * SCALE
          const cy = y * SCALE
          const cw = w * SCALE
          const ch = h * SCALE
          const cr = radius * SCALE

          // ── 1. offscreen：比图片大一圈（pad），留出模糊溢出空间 ──
          const pad = blurPx * 2
          const off = document.createElement('canvas')
          off.width  = cw + pad * 2
          off.height = ch + pad * 2
          const octx = off.getContext('2d')!

          // ── 2. 画黑色填充形状，居中偏移 pad ──
          octx.fillStyle = 'black'
          octx.beginPath()
          if (cr > 0 && octx.roundRect) {
            octx.roundRect(pad, pad, cw, ch, cr)
          } else {
            octx.rect(pad, pad, cw, ch)
          }
          octx.fill()

          // ── 3. 把 offscreen 模糊后画到 tmp ──
          // filter 必须在独立 canvas 上操作，直接在 off 上 filter 会污染后续 destination-out
          const tmp = document.createElement('canvas')
          tmp.width  = off.width
          tmp.height = off.height
          const tctx = tmp.getContext('2d')!
          tctx.filter = `blur(${blurPx}px)`
          tctx.drawImage(off, 0, 0)
          tctx.filter = 'none'

          // ── 4. destination-out：挖掉中心形状，只留边缘晕圈 ──
          tctx.globalCompositeOperation = 'destination-out'
          tctx.fillStyle = 'black'
          tctx.beginPath()
          if (cr > 0 && tctx.roundRect) {
            tctx.roundRect(pad, pad, cw, ch, cr)
          } else {
            tctx.rect(pad, pad, cw, ch)
          }
          tctx.fill()
          tctx.globalCompositeOperation = 'source-over'

          // ── 5. clip 限制在图片矩形内，防止晕圈溢出 ──
          ictx.save()
          ictx.beginPath()
          if (cr > 0 && ictx.roundRect) {
            ictx.roundRect(cx, cy, cw, ch, cr)
          } else {
            ictx.rect(cx, cy, cw, ch)
          }
          ictx.clip()

          // ── 6. 叠加到 outputCanvas，globalAlpha 控制整体浓度 ──
          const opacity = Math.min(0.85, 0.2 + sh * 0.015)
          ictx.globalAlpha = opacity
          ictx.drawImage(tmp, cx - pad, cy - pad)
          ictx.globalAlpha = 1
          ictx.restore()
        })
      }

      dataUrls.push(outputCanvas.toDataURL('image/png'))

      dims.push({ w: naturalW, h: naturalH })
    }
    setActivePageId(prevActivePageId)
    return { dataUrls, dims }
  }

  const doExportHTML = async (htmlConfig?: { background: string; gap: number; radius: number; maxWidth?: number; shadow?: number }) => {
    if (!project) return
    const bgValue     = htmlConfig?.background      ?? '#f0f0f0'
    const gapValue    = htmlConfig?.gap             ?? 32
    const radValue    = htmlConfig?.radius          ?? 8
    const shadowValue = htmlConfig?.shadow          ?? 20
    const maxWValue   = (htmlConfig?.maxWidth && htmlConfig.maxWidth > 0)
      ? `min(100%, ${htmlConfig.maxWidth}px)`
      : '100%'
    const result = await capturePages()
    if (!result) return
    const { dataUrls: imageDataUrls } = result
    const pagesHTML = imageDataUrls.map(dataUrl =>
      `<img src="${dataUrl}" style="display:block;max-width:100%;height:auto;" />`
    ).join('\n')
    const bodyCss = [
      '* { margin: 0; padding: 0; box-sizing: border-box; }',
      'body {',
      '  background: ' + bgValue + ';',
      '  display: flex;',
      '  flex-direction: column;',
      '  align-items: center;',
      '  gap: 0;',
      '  padding: 0;',
      '  min-height: 100vh;',
      '}',
      'img {',
      '  border-radius: ' + radValue + 'px;',
      '  box-shadow: 0 ' + Math.round(shadowValue * 0.08) + 'px ' + Math.round(shadowValue * 0.5) + 'px rgba(0,0,0,' + (shadowValue * 0.003).toFixed(3) + ');',
      '  display: block;',
      '  width: ' + maxWValue + ';',
      '  max-width: 100%;',
      '  height: auto;',
      '  margin: 0 auto;',
      '}',
      'img + img {',
      '  margin-top: ' + gapValue + 'px;',
      '}',
    ].join('\n')
    const html = [
      '<!DOCTYPE html>',
      '<html lang="' + (isZh ? 'zh-CN' : 'en') + '">',
      '<head>',
      '  <meta charset="UTF-8">',
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
      '  <title>' + project.title + '</title>',
      '  <style>' + bodyCss + '</style>',
      '</head>',
      '<body>',
      pagesHTML,
      '</body>',
      '</html>',
    ].join('\n')
    const isTauri = typeof window !== 'undefined' && !!(window as any).__TAURI__
    if (isTauri) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await save({
        defaultPath: `${project.title.replace(/\s+/g, '_')}.html`,
        filters: [{ name: 'HTML', extensions: ['html'] }],
      })
      if (path) {
        const encoder = new TextEncoder()
        await invoke('write_file', { path, contents: Array.from(encoder.encode(html)) })
      }
    } else {
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.title.replace(/\s+/g, '_')}_${exportOpts.theme}.html`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  // ── PDF：截图 → jsPDF，纯客户端，不走服务端 ──────────────────────────────────
  const doExportPDF = async () => {
    if (!project) return
    const result = await capturePages()
    if (!result) return
    const { dataUrls, dims } = result
    const { jsPDF } = await import('jspdf')
    // 以第一页尺寸决定 PDF 方向
    const firstDim = dims[0] ?? { w: 860, h: 600 }
    const orientation = firstDim.w >= firstDim.h ? 'landscape' : 'portrait'
    const doc = new jsPDF({ orientation, unit: 'px', hotfixes: ['px_scaling'] })
    dataUrls.forEach((dataUrl, i) => {
      const { w, h } = dims[i] ?? firstDim
      if (i > 0) doc.addPage([w, h], w >= h ? 'landscape' : 'portrait')
      else {
        // 第一页已自动创建，设置尺寸
        doc.internal.pageSize.width  = w
        doc.internal.pageSize.height = h
      }
      doc.addImage(dataUrl, 'PNG', 0, 0, w, h)
    })
    const isTauriPDF = typeof window !== 'undefined' && !!(window as any).__TAURI__
    if (isTauriPDF) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await save({
        defaultPath: `${project.title.replace(/\s+/g, '_')}.pdf`,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })
      if (path) {
        const pdfBytes = doc.output('arraybuffer')
        await invoke('write_file', { path, contents: Array.from(new Uint8Array(pdfBytes)) })
      }
    } else {
      doc.save(`${project.title.replace(/\s+/g, '_')}.pdf`)
    }
  }

  // ── DOCX：截图 → docx，每页一张图 ────────────────────────────────────────────
  const doExportDOCX = async () => {
    if (!project) return
    const result = await capturePages()
    if (!result) return
    const { dataUrls, dims } = result
    const { Document, Packer, Paragraph, ImageRun, PageBreak } = await import('docx')
    // dataUrl → Uint8Array
    const toUint8 = (dataUrl: string) => {
      const base64 = dataUrl.split(',')[1]
      const bin = atob(base64)
      const arr = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
      return arr
    }
    const MAX_W = 600  // Word 页面可用宽度 px（近似 A4）
    const children = dataUrls.flatMap((dataUrl, i) => {
      const { w, h } = dims[i] ?? { w: 860, h: 600 }
      const scale = Math.min(1, MAX_W / w)
      const imgW = Math.round(w * scale)
      const imgH = Math.round(h * scale)
      const nodes: InstanceType<typeof Paragraph>[] = [
        new Paragraph({
          children: [
            new ImageRun({
              data: toUint8(dataUrl),
              transformation: { width: imgW, height: imgH },
              type: 'png',
            }),
          ],
        }),
      ]
      if (i < dataUrls.length - 1) nodes.push(new Paragraph({ children: [new PageBreak()] }))
      return nodes
    })
    const doc = new Document({ sections: [{ children }] })
    const blob = await Packer.toBlob(doc)
    const isTauriDOCX = typeof window !== 'undefined' && !!(window as any).__TAURI__
    if (isTauriDOCX) {
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { invoke } = await import('@tauri-apps/api/core')
      const path = await save({
        defaultPath: `${project.title.replace(/\s+/g, '_')}.docx`,
        filters: [{ name: 'Word Document', extensions: ['docx'] }],
      })
      if (path) {
        const buf = await blob.arrayBuffer()
        await invoke('write_file', { path, contents: Array.from(new Uint8Array(buf)) })
      }
    } else {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.title.replace(/\s+/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const visibleSchools = schoolsExpanded ? schools : schools.slice(0, 3)

  return {
    // routing
    router, isZh, id,
    // data
    project, projects, setProjects, schools,
    // export opts
    exportOpts, setExportOpts,
    // pages
    pages, setPages, setPagesRaw, activePageId, setActivePageId,
    activePage, blocks, justRestored, saveStatus,
    // page mutations
    addPage, deletePage, duplicatePage, reorderPages, renamePage, changePageAspect, clearAll,
    updatePageBlocks, setBlocks,
   // undo / redo
    undo, redo, undoStack, redoStack,
    // canvas
    canvasWrapRef, isPanningRef, panStart,
    canvasZoom, setCanvasZoom, canvasPan, setCanvasPan,
    canvasWrapWidth, panningCursor, setPanningCursor, shiftHeld,
    contentWidth, panLayerRef,
    // toolbar
    toolbarRef, toolbarAnchor, setToolbarAnchor,
    toolbarDragging, setToolbarDragging,
    toolbarDragPos, setToolbarDragPos, toolbarDragStart,
    // block editor state
    customText, setCustomText,
    schoolsExpanded, setSchoolsExpanded,
    editingBlockId, setEditingBlockId,
    editingContent, setEditingContent,
    editingCaption, setEditingCaption,
    editingFontSize, setEditingFontSize,
    editingImageCaptions, setEditingImageCaptions,
    selectedBlockId, setSelectedBlockId,
    fontPickerOpen, setFontPickerOpen,
    colorPickerOpen, setColorPickerOpen,
    rightTab, setRightTab,
    imageEditorUrl, setImageEditorUrl,
    imageEditorIdx, setImageEditorIdx,
    pagedExport, setPagedExport,
    previewOpen, setPreviewOpen,
    ctxMenu, setCtxMenu,
    dragOverPageId, setDragOverPageId,
    removingBgBlockId,
    // refs
    dragIndex, ctxImageInputRef,
    // block ops
    addBlock, addBlockAt, addImageBlock, addToMediaLibrary, removeBlock, patchBlock,
    moveBlockToPage, onBlockDragStop,
    startEdit, saveEdit, cancelEdit,
    compressImage, removeBackground,
    // export
    pagesForExport, allBlocksForExport, doExportHTML, doExportPDF, doExportDOCX,
    visibleSchools,
    // theme labels
    THEMES, FONTS,
    // line / arrow blocks
    lineArrowBlocks, setLineArrowBlocks,
    selectedLineArrowId, setSelectedLineArrowId,
    addLineArrowBlock,
  }
}