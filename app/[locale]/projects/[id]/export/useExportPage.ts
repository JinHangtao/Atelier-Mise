'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocalStorage } from '../../../../../hooks/useLocalStorage'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { Project } from '../../../../../types'
import { exportPDF, exportDOCX } from '../../../../../lib/exportProject'
import {
  Block, School, ExportOptions, DEFAULT_EXPORT_OPTIONS,
  THEMES, FONTS, buildExportHTML, buildExportHTMLMultiPage,
} from '../../../../../lib/exportStyles'
import { Page, Aspect, BlockType, SaveStatus } from './types'
import {
  generateId, aspectLabel, pageHeight, migrateOrLoad,
  defaultPages, makeNewPage, draftKey, optKey, pagesKey,
} from './pageHelpers'

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
  const params   = useParams()
  const pathname = usePathname()
  const router   = useRouter()
  const isZh = pathname.startsWith('/zh')
  const id   = params.id as string

  const [projects, setProjects] = useLocalStorage<Project[]>('ps-projects', [])
  const [schools]               = useLocalStorage<School[]>('ps-schools', [])
  const project = projects.find(p => p.id === id)

  // ── Export options ──
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
  // 必须先于 useState 声明，因为 initializer 里要写入它
  const pagesRef = useRef<Page[]>([])
  const [pages, setPagesRaw] = useState<Page[]>(() => {
    const initial = sanitizePages(migrateOrLoad(id))
    pagesRef.current = initial
    return initial
  })
  const [justRestored]       = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return !!(localStorage.getItem(pagesKey(id)) || localStorage.getItem(draftKey(id)))
  })
  const [activePageId, setActivePageId] = useState<string>(() => {
    const loaded = migrateOrLoad(id)
    return loaded[0]?.id ?? ''
  })

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
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(pagesKey(id), JSON.stringify(pages))
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch { setSaveStatus('error') }
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [pages, id])

  // ── Canvas zoom / pan ──
  const canvasWrapRef   = useRef<HTMLDivElement | null>(null)
  const isPanningRef    = useRef(false)
  const panStart        = useRef({ mx: 0, my: 0, px: 0, py: 0 })
  const [canvasZoom, setCanvasZoom]         = useState(1)
  const canvasZoomRef = useRef(1)  // ref 镜像，让拖拽回调不依赖闭包旧值
  useEffect(() => { canvasZoomRef.current = canvasZoom }, [canvasZoom])
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

  // Wheel listener
  useEffect(() => {
    let el: HTMLDivElement | null = null
    const MIN_ZOOM = 0.3, MAX_ZOOM = 3
    const handler = (e: WheelEvent) => {
      const wrap = canvasWrapRef.current
      if (!wrap) return
      const W = wrap.offsetWidth
      const H = wrap.offsetHeight
      const MARGIN = 120
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const wrapRect = wrap.getBoundingClientRect()
        const mouseX = e.clientX - wrapRect.left
        const mouseY = e.clientY - wrapRect.top
        setCanvasZoom(prevZoom => {
          const isPinch     = Math.abs(e.deltaY) < 50 && e.deltaMode === 0
          const scaleDelta  = isPinch ? -(e.deltaY * 0.008) : (e.deltaY > 0 ? -0.09 : 0.09)
          const newZoom     = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom + scaleDelta))
          const ratio       = newZoom / prevZoom
          setCanvasPan(p => ({
            x: Math.min(W - MARGIN, Math.max(-(W * 2), mouseX - (mouseX - p.x) * ratio)),
            y: Math.min(H - MARGIN, Math.max(-(H * 4), mouseY - (mouseY - p.y) * ratio)),
          }))
          return +newZoom.toFixed(4)
        })
      } else if (e.shiftKey) {
        e.preventDefault()
        const dx = e.deltaY !== 0 ? e.deltaY : e.deltaX
        setCanvasPan(p => ({
          x: Math.min(W - MARGIN, Math.max(-(W * 2), p.x - dx)),
          y: p.y,
        }))
      } else {
        e.preventDefault()
        const mult = e.deltaMode === 1 ? 20 : 1
        setCanvasPan(p => ({
          x: p.x,
          y: Math.min(H - MARGIN, Math.max(-(H * 4), p.y - e.deltaY * mult)),
        }))
      }
    }
    const tryBind = () => {
      const target = canvasWrapRef.current
      if (target && target !== el) {
        if (el) el.removeEventListener('wheel', handler)
        el = target
        el.addEventListener('wheel', handler, { passive: false })
      }
    }
    tryBind()
    const raf = requestAnimationFrame(tryBind)
    return () => { cancelAnimationFrame(raf); if (el) el.removeEventListener('wheel', handler) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ResizeObserver
  useEffect(() => {
    const target = canvasWrapRef.current
    if (!target) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setCanvasWrapWidth(entry.contentRect.width)
    })
    ro.observe(target)
    setCanvasWrapWidth(target.offsetWidth)
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
    setPages(prev => prev.map(p => {
      if (p.id !== pageId) return p
      const next = typeof updater === 'function' ? updater(p.blocks) : updater
      return { ...p, blocks: next }
    }))
  }, [setPages])

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
    try { localStorage.removeItem(pagesKey(id)); localStorage.removeItem(draftKey(id)) } catch {}
    const fresh = defaultPages()
    setPagesRaw(fresh)
    setActivePageId(fresh[0].id)
    undoStack.current = []
    setSaveStatus('idle')
  }, [id])

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
  const [imagePickerOpen,      setImagePickerOpen]      = useState(false)
  const [selectedImages,       setSelectedImages]       = useState<string[]>([])
  const [rightTab,             setRightTab]             = useState<'pages' | 'blocks' | 'draw' | 'style'>('pages')
  const [imageEditorUrl,       setImageEditorUrl]       = useState<string | null>(null)
  const [imageEditorIdx,       setImageEditorIdx]       = useState<number | null>(null)
  const [pagedExport,          setPagedExport]          = useState(false)
  const [previewOpen,          setPreviewOpen]          = useState(false)
  const [ctxMenu,              setCtxMenu]              = useState<{ x: number; y: number; gridX: number; gridY: number; blockId?: string } | null>(null)
  const [dragOverPageId,       setDragOverPageId]       = useState<string | null>(null)
  const [removingBgBlockId,    setRemovingBgBlockId]    = useState<string | null>(null)

  const dragIndex      = useRef<number | null>(null)
  const imageDragIndex = useRef<number | null>(null)
  const localImageInputRef = useRef<HTMLInputElement | null>(null)
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
    new Promise(resolve => {
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

  const addToMediaLibrary = (dataUrl: string) => {
    compressImage(dataUrl).then(compressed => {
      setProjects(ps => ps.map(p => p.id === id ? { ...p, mediaUrls: [...(p.mediaUrls || []), compressed] } : p))
    })
  }

  // ── Block CRUD ──
  const addBlock = (type: BlockType, content: string, caption?: string, images?: string[]) => {
    setBlocks(b => {
      const maxY = b.reduce((acc, bl) => {
        const pos = bl.pixelPos
        return pos ? Math.max(acc, pos.y + pos.h) : acc
      }, 0)
      const cw       = contentWidth
      const defaultH = type === 'image' || type === 'image-row' ? Math.round(cw * 0.5625) : type === 'title' ? Math.round(cw * 0.3) : type === 'table' ? 160 : Math.round(cw * 0.2)
      return [...b, { id: generateId(), type, content, caption, images, pixelPos: { x: 0, y: maxY, w: cw, h: defaultH }, ...(type === 'table' ? { tableData: { rows: [[{text:'标题A',align:'left',bold:true},{text:'标题B',align:'left',bold:true},{text:'标题C',align:'left',bold:true}],[{text:'',align:'left'},{text:'',align:'left'},{text:'',align:'left'}],[{text:'',align:'left'},{text:'',align:'left'},{text:'',align:'left'}]], colWidths:[0.333,0.333,0.334], headerRow:true, headerCol:false, borderColor:'rgba(26,26,26,0.12)', fontSize:13, fontFamily:'Inter, DM Sans, sans-serif', cellPadding:10 } } : {}) }]
    })
  }

  const addBlockAt = (type: BlockType, content: string, pxX: number, pxY: number, caption?: string, images?: string[]) => {
    const cw       = contentWidth
    const defaultH = type === 'image' || type === 'image-row' ? Math.round(cw * 0.5625) : type === 'title' ? Math.round(cw * 0.3) : Math.round(cw * 0.2)
    const defaultW = type === 'title' ? cw : Math.round(cw * 0.5)
    setBlocks(b => [...b, {
      id: generateId(), type, content, caption, images,
      pixelPos: { x: Math.min(pxX, cw - defaultW), y: pxY, w: defaultW, h: defaultH },
    }])
  }

  const removeBlock = (blockId: string) => setBlocks(b => b.filter(x => x.id !== blockId))

  const addImageBlock = (url: string, pxX?: number, pxY?: number) => {
    const imgEl = new window.Image()
    imgEl.onload = () => {
      const ratio = imgEl.naturalHeight / imgEl.naturalWidth
      const cw    = Math.max(canvasWrapWidth - 40, 400)
      const autoH = Math.round(cw * ratio)
      setBlocks(b => {
        const maxY = b.reduce((acc, bl) => bl.pixelPos ? Math.max(acc, bl.pixelPos.y + bl.pixelPos.h) : acc, 0)
        return [...b, { id: generateId(), type: 'image' as BlockType, content: url, pixelPos: { x: pxX ?? 0, y: pxY ?? maxY, w: cw, h: autoH } }]
      })
    }
    imgEl.src = url
  }

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

  const toggleImageSelection = (url: string) =>
    setSelectedImages(prev => prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url])

  const addImageRow = () => {
    if (selectedImages.length === 0) return
    if (selectedImages.length === 1) addImageBlock(selectedImages[0])
    else addBlock('image-row', '', '', selectedImages)
    setSelectedImages([])
    setImagePickerOpen(false)
  }

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

  // ── 核心截图逻辑，HTML / PDF / DOCX 共用 ─────────────────────────────────────
  const capturePages = async (): Promise<{ dataUrls: string[]; dims: { w: number; h: number }[] } | null> => {
    if (!project) return null
    const html2canvas = (await import('html2canvas')).default
    setSelectedBlockId(null)
    setEditingBlockId(null)
    const exportablePageIds = pages.filter(p => p.blocks.length > 0).map(p => p.id)
    if (exportablePageIds.length === 0) {
      alert(isZh ? '没有可导出的页面' : 'No pages to export')
      return null
    }
    const prevActivePageId = activePageId
    const dataUrls: string[] = []
    const dims: { w: number; h: number }[] = []
    for (let i = 0; i < exportablePageIds.length; i++) {
      setActivePageId(exportablePageIds[i])
      await new Promise(r => setTimeout(r, 150))
      const frameEls = Array.from(document.querySelectorAll('.page-canvas-frame')) as HTMLElement[]
      const el = frameEls[i]
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
      // scale: 3 导出时 html2canvas 把 DOM 放大 3x，canvas 内容也要同步放大
      // 否则笔迹分辨率不变，放大后反而更糊
// ── 把原始 canvas 像素复制到 clone 里对应的 canvas ──────────────────
const EXPORT_SCALE = 4
const dpr = window.devicePixelRatio || 1
const srcCanvases = Array.from(el.querySelectorAll('canvas')) as HTMLCanvasElement[]
const dstCanvases = Array.from(clone.querySelectorAll('canvas')) as HTMLCanvasElement[]
srcCanvases.forEach((src, idx) => {
  const dst = dstCanvases[idx]
  if (!dst) return
  const cssW = Math.round(src.width  / dpr)
  const cssH = Math.round(src.height / dpr)
  dst.width  = cssW * EXPORT_SCALE
  dst.height = cssH * EXPORT_SCALE
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
      offscreenWrap.appendChild(clone)
      document.body.appendChild(offscreenWrap)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      const canvas = await html2canvas(clone, {
        useCORS: true, allowTaint: true, scale: EXPORT_SCALE,
        width: naturalW, height: naturalH,
        windowWidth: naturalW, windowHeight: naturalH,
        x: 0, y: 0, scrollX: 0, scrollY: 0,
        backgroundColor: el.style.background || el.style.backgroundColor || '#ffffff',
        logging: false,
        ignoreElements: (node: Element) =>
          node.hasAttribute('data-html2canvas-ignore') ||
          node.classList.contains('block-toolbar') ||
          node.classList.contains('resize-handle') ||
          node.classList.contains('selection-ring'),
      })
      document.body.removeChild(offscreenWrap)

      // ── 手动补画 sticky block 阴影 ───────────────────────────────────────
      // html2canvas 不支持 filter:drop-shadow
      // 方案：在比截图更大的中间 canvas 上先画带阴影的矩形，再把截图贴上去，最后裁回原尺寸
      // 参考：https://zhuanlan.zhihu.com/p/43104164
      const SCALE = EXPORT_SCALE
      const currentPage = pages.find(p => p.id === exportablePageIds[i])
      const stickyBlocks = (currentPage?.blocks ?? []).filter(
        b => b.type === 'sticky' && ((b as any).stickyShadow ?? 12) > 0
      )

      if (stickyBlocks.length > 0) {
        // 计算所有 sticky 里最大的阴影尺寸，作为 padding
        const maxBlur = stickyBlocks.reduce((max, block) => {
          const sh = (block as any).stickyShadow ?? 12
          const sp = (block as any).stickySpread ?? 0
          return Math.max(max, (sh * 2 + sp) * SCALE + Math.round(sh * 0.4) * SCALE)
        }, 80 * SCALE)
        const PAD = maxBlur

        // 中间 canvas：比截图四周各大 PAD，阴影有空间溢出
        const mid = document.createElement('canvas')
        mid.width  = canvas.width  + PAD * 2
        mid.height = canvas.height + PAD * 2
        const mctx = mid.getContext('2d')!

        // 第一步：在中间 canvas 上为每个 sticky 画带阴影的矩形
        stickyBlocks.forEach(block => {
          const pos = block.pixelPos
          if (!pos) return
          const sh = (block as any).stickyShadow ?? 12
          const sp = (block as any).stickySpread ?? 0
          const blur    = (sh * 2 + sp) * SCALE
          const offsetY = Math.round(sh * 0.4) * SCALE
          const opacity = Math.min(0.6, 0.08 + sh * 0.012)
          const color   = (block as any).stickyColor || '#fef08a'

          mctx.save()
          mctx.shadowColor   = `rgba(0,0,0,${opacity.toFixed(2)})`
          mctx.shadowBlur    = blur
          mctx.shadowOffsetX = 0
          mctx.shadowOffsetY = offsetY
          mctx.fillStyle = color
          mctx.beginPath()
          // 坐标偏移 PAD，因为中间 canvas 比截图大了 PAD
          if (mctx.roundRect) {
            mctx.roundRect(PAD + pos.x * SCALE, PAD + pos.y * SCALE, pos.w * SCALE, pos.h * SCALE, 4 * SCALE)
          } else {
            mctx.rect(PAD + pos.x * SCALE, PAD + pos.y * SCALE, pos.w * SCALE, pos.h * SCALE)
          }
          mctx.fill()
          mctx.restore()
        })

        // 第二步：把 html2canvas 截图贴到中间 canvas 上（偏移 PAD，覆盖阴影矩形，只留溢出的阴影）
        mctx.drawImage(canvas, PAD, PAD)

        // 第三步：裁回原始尺寸（去掉 PAD 边框），输出最终图片
        const final = document.createElement('canvas')
        final.width  = canvas.width
        final.height = canvas.height
        const fctx = final.getContext('2d')!
        fctx.drawImage(mid, -PAD, -PAD)

        dataUrls.push(final.toDataURL('image/png'))
      } else {
        dataUrls.push(canvas.toDataURL('image/png'))
      }
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
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${project.title.replace(/\s+/g, '_')}_${exportOpts.theme}.html`
    a.click()
    URL.revokeObjectURL(url)
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
    doc.save(`${project.title.replace(/\s+/g, '_')}.pdf`)
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
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/\s+/g, '_')}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleSchools = schoolsExpanded ? schools : schools.slice(0, 3)
  const mediaUrls      = project?.mediaUrls || []

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
    contentWidth,
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
    imagePickerOpen, setImagePickerOpen,
    selectedImages, setSelectedImages,
    rightTab, setRightTab,
    imageEditorUrl, setImageEditorUrl,
    imageEditorIdx, setImageEditorIdx,
    pagedExport, setPagedExport,
    previewOpen, setPreviewOpen,
    ctxMenu, setCtxMenu,
    dragOverPageId, setDragOverPageId,
    removingBgBlockId,
    // refs
    dragIndex, imageDragIndex, localImageInputRef, ctxImageInputRef,
    // block ops
    addBlock, addBlockAt, removeBlock, addImageBlock, patchBlock,
    moveBlockToPage, onBlockDragStop,
    startEdit, saveEdit, cancelEdit,
    toggleImageSelection, addImageRow,
    compressImage, addToMediaLibrary, removeBackground,
    // export
    pagesForExport, allBlocksForExport, doExportHTML, doExportPDF, doExportDOCX,
    visibleSchools, mediaUrls,
    // theme labels
    THEMES, FONTS,
  }
}

import type { UseGridSystemReturn } from './useGridSystem'

export type ExportPageState = ReturnType<typeof useExportPage> &
  UseGridSystemReturn & {
    gridEditMode: boolean
    setGridEditMode: (v: boolean) => void
  }