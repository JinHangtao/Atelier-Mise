'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useLocalStorage } from '../../../../../hooks/useLocalStorage'
import { Project } from '../../../../../types'
import { exportPDF, exportDOCX } from '../../../../../lib/exportProject'
import { useParams, usePathname, useRouter } from 'next/navigation'

type BlockType = 'title' | 'image' | 'image-row' | 'note' | 'custom' | 'milestone' | 'school-profile'

interface Block {
  id: string
  type: BlockType
  content: string
  caption?: string
  images?: string[] // for image-row
  imageCaptions?: string[] // per-image captions for image-row
}

interface School {
  id: string
  name: string
  nameZh?: string
  country: string
  department: string
  departmentZh?: string
  deadline: string
  requirements: string
  notes: string
  website: string
  aiStatement: string
  aiGeneratedAt: string
  createdAt: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function draftKey(projectId: string) {
  return `ps-export-draft-${projectId}`
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── Draft Banner: shown on mount when saved data is restored ──────────────
function DraftBanner({ blocks, isZh, onClear }: { blocks: Block[]; isZh: boolean; onClear: () => void }) {
  const [visible, setVisible] = useState(true)
  if (!visible) return null
  return (
    <div
      className="draft-banner"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(74,171,111,0.08)', border: '1px solid rgba(74,171,111,0.2)',
        borderRadius: '10px', padding: '10px 16px', marginBottom: '20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#4aab6f', fontSize: '0.8rem' }}>●</span>
        <span style={{ fontSize: '0.8rem', color: '#3a8a58', letterSpacing: '0.04em' }}>
          {isZh
            ? `已恢复上次草稿（${blocks.length} 个块）`
            : `Draft restored — ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onClear}
          style={{ fontSize: '0.72rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          {isZh ? '清空重来' : 'Start fresh'}
        </button>
        <button
          onClick={() => setVisible(false)}
          style={{ fontSize: '0.72rem', color: '#4aab6f', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
        >
          {isZh ? '继续编辑 →' : 'Keep editing →'}
        </button>
      </div>
    </div>
  )
}

export default function ExportPage() {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')
  const id = params.id as string

  const [projects] = useLocalStorage<Project[]>('ps-projects', [])
  const [schools] = useLocalStorage<School[]>('ps-schools', [])
  const project = projects.find(p => p.id === id)

  // ── Draft recovery: load saved blocks from localStorage on first render ──
  const [blocks, setBlocksRaw] = useState<Block[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = localStorage.getItem(draftKey(id))
      if (saved) return JSON.parse(saved) as Block[]
    } catch {}
    return []
  })

  // tracks whether we loaded blocks from a saved draft (to show the banner once)
  const [justRestored] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const saved = localStorage.getItem(draftKey(id))
      return !!saved && JSON.parse(saved).length > 0
    } catch { return false }
  })

  // ── Undo stack (keeps last 50 snapshots) ──
  const undoStack = useRef<Block[][]>([])
  const isUndoing = useRef(false)

  const setBlocks = useCallback((updater: Block[] | ((prev: Block[]) => Block[])) => {
    setBlocksRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      if (!isUndoing.current) {
        undoStack.current = [...undoStack.current.slice(-49), prev]
      }
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

  // ── Auto-save: debounced write to localStorage ──
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasMounted = useRef(false)

  useEffect(() => {
    // skip the very first render (initial load from localStorage)
    if (!hasMounted.current) { hasMounted.current = true; return }
    setSaveStatus('saving')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(id), JSON.stringify(blocks))
        setSaveStatus('saved')
        // fade back to idle after 2.5s
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [blocks, id])

  // ── Keyboard shortcut: Ctrl/Cmd+Z ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo])

  const clearDraft = useCallback(() => {
    try { localStorage.removeItem(draftKey(id)) } catch {}
    setBlocksRaw([])
    undoStack.current = []
    setSaveStatus('idle')
  }, [id])
  const [customText, setCustomText] = useState('')
  const [schoolsExpanded, setSchoolsExpanded] = useState(false)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [editingCaption, setEditingCaption] = useState('')
  const [editingImageCaptions, setEditingImageCaptions] = useState<string[]>([])
  const [imagePickerOpen, setImagePickerOpen] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const dragIndex = useRef<number | null>(null)
  const imageDragIndex = useRef<number | null>(null) // for dragging images within image-row

  if (!project) return (
    <div style={{ padding: '60px', fontFamily: 'Space Mono, monospace', color: '#888' }}>
      {isZh ? '找不到项目' : 'Project not found'}
    </div>
  )

  const addBlock = (type: BlockType, content: string, caption?: string, images?: string[]) => {
    setBlocks(b => [...b, { id: generateId(), type, content, caption, images }])
  }

  const removeBlock = (id: string) => setBlocks(b => b.filter(x => x.id !== id))

  const moveBlock = (from: number, to: number) => {
    setBlocks(b => {
      const arr = [...b]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  const startEdit = (block: Block) => {
    setEditingBlockId(block.id)
    setEditingContent(block.content)
    setEditingCaption(block.caption || '')
    setEditingImageCaptions(block.imageCaptions || (block.images || []).map(() => ''))
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

  const toggleImageSelection = (url: string) => {
    setSelectedImages(prev =>
      prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]
    )
  }

  const addImageRow = () => {
    if (selectedImages.length === 0) return
    if (selectedImages.length === 1) {
      addBlock('image', selectedImages[0])
    } else {
      addBlock('image-row', '', '', selectedImages)
    }
    setSelectedImages([])
    setImagePickerOpen(false)
  }

  const exportHTML = () => {
    const blocksHTML = blocks.map(b => {
      if (b.type === 'title') return `
        <div class="block">
          <h1>${project.title}</h1>
          <p class="meta">${project.category} · ${project.status}</p>
          ${project.description ? `<p class="desc">${project.description}</p>` : ''}
        </div>`
      if (b.type === 'image') return `
        <div class="block">
          <img src="${b.content}" style="width:100%;border-radius:8px;" />
          ${b.caption ? `<p class="caption">${b.caption}</p>` : ''}
        </div>`
      if (b.type === 'image-row') return `
        <div class="block">
          <div style="display:grid;grid-template-columns:repeat(${(b.images || []).length},1fr);gap:10px;">
            ${(b.images || []).map((url, idx) => `
              <div>
                <img src="${url}" style="width:100%;border-radius:8px;aspect-ratio:1;object-fit:cover;" />
                ${(b.imageCaptions || [])[idx] ? `<p style="font-size:12px;color:#888;text-align:center;margin-top:5px;font-style:italic;">${(b.imageCaptions || [])[idx]}</p>` : ''}
              </div>
            `).join('')}
          </div>
          ${b.caption ? `<p class="caption">${b.caption}</p>` : ''}
        </div>`
      if (b.type === 'note') return `
        <div class="block note-block">
          <p>${b.content}</p>
          ${b.caption ? `<p class="caption">${b.caption}</p>` : ''}
        </div>`
      if (b.type === 'milestone') return `
        <div class="block">
          <h3>${isZh ? '进度节点' : 'Milestones'}</h3>
          ${project.milestones.map(m => `
            <div class="ms-row">
              <span class="${m.status === 'done' ? 'done' : 'pending'}">${m.status === 'done' ? '✓' : '○'}</span>
              <span style="text-decoration:${m.status === 'done' ? 'line-through' : 'none'};color:${m.status === 'done' ? '#aaa' : '#1a1a1a'}">${m.title}</span>
              ${m.date ? `<span class="date">${m.date}</span>` : ''}
            </div>
          `).join('')}
        </div>`
      if (b.type === 'custom') return `
        <div class="block">
          <p style="white-space:pre-wrap;">${b.content}</p>
        </div>`
      if (b.type === 'school-profile') {
        const school = schools.find(s => s.id === b.content)
        if (!school) return ''
        const displayName = isZh ? (school.nameZh || school.name) : school.name
        const displayDept = isZh ? (school.departmentZh || school.department) : school.department
        return `
        <div class="block school-block">
          <p class="meta">${school.country}${school.deadline ? ` · ${isZh ? '截止' : 'Deadline'}: ${school.deadline}` : ''}</p>
          <h2>${displayName}</h2>
          ${displayDept ? `<p class="dept">${displayDept}</p>` : ''}
          ${school.requirements ? `
            <div class="info-box">
              <p class="box-label">${isZh ? '申请要求' : 'Requirements'}</p>
              <p>${school.requirements}</p>
            </div>` : ''}
          ${school.aiStatement ? `
            <div class="info-box statement-box">
              <p class="box-label">${isZh ? 'AI 申请文书' : 'Application Statement'}</p>
              <p>${school.aiStatement}</p>
            </div>` : ''}
        </div>`
      }
      return ''
    }).join('\n')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #f7f7f5; color: #1a1a1a; padding: 48px; max-width: 800px; margin: 0 auto; }
    .block { background: #fff; border-radius: 14px; padding: 32px; margin-bottom: 20px; border: 1px solid rgba(0,0,0,0.07); }
    h1 { font-size: 36px; font-weight: 700; margin-bottom: 8px; }
    h2 { font-size: 24px; font-weight: 700; margin-bottom: 8px; margin-top: 4px; }
    h3 { font-size: 16px; font-weight: 700; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
    .meta { color: #888; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 12px; }
    .desc { color: #555; line-height: 1.8; margin-top: 12px; }
    .caption { color: #aaa; font-size: 12px; margin-top: 10px; font-style: italic; }
    .note-block { border-left: 3px solid #4a8abf; background: rgba(100,140,180,0.06); }
    .school-block { border-left: 3px solid #c4a044; }
    .dept { color: #555; margin-top: 6px; font-size: 16px; line-height: 1.6; }
    .info-box { margin-top: 18px; padding: 16px 18px; background: #f7f7f5; border-radius: 8px; }
    .statement-box { background: rgba(196,160,68,0.06); }
    .box-label { font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #aaa; margin-bottom: 8px; }
    .info-box p:last-child { font-size: 15px; color: #333; line-height: 1.8; white-space: pre-wrap; }
    .ms-row { display: flex; align-items: baseline; gap: 12px; margin-bottom: 10px; font-size: 15px; }
    .done { color: #4aab6f; }
    .pending { color: #ccc; }
    .date { color: #aaa; font-size: 12px; margin-left: auto; }
  </style>
</head>
<body>
${blocksHTML}
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/\s+/g, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const visibleSchools = schoolsExpanded ? schools : schools.slice(0, 3)
  const mediaUrls = project.mediaUrls || []

  return (
    <main style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace' }}>
      <style>{`
        .block-card { transition: box-shadow 0.15s; }
        .block-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
        .edit-btn { opacity: 0; transition: opacity 0.15s; }
        .block-card:hover .edit-btn { opacity: 1; }
        .school-item:hover { background: rgba(26,26,26,0.03) !important; }
        .img-thumb { transition: transform 0.15s, box-shadow 0.15s; }
        .img-thumb:hover { transform: scale(1.03); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
        .img-thumb.selected { outline: 2.5px solid #1a1a1a; outline-offset: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        .draft-banner { animation: fadeIn 0.3s ease; }
        .nav-clear-btn:hover { border-color: rgba(180,80,80,0.6) !important; color: rgba(180,80,80,1) !important; }
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          {isZh ? '← 返回' : '← Back'}
        </button>

        {/* Centre: title + save status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>
            {isZh ? '导出编辑器' : 'Export Editor'} — {project.title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '16px' }}>
            {saveStatus === 'saving' && (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e8c06a', display: 'inline-block', animation: 'pulse 0.8s ease-in-out infinite' }} />
                <span style={{ fontSize: '0.68rem', color: '#c8a84a', letterSpacing: '0.08em' }}>{isZh ? '保存中…' : 'Saving…'}</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4aab6f', display: 'inline-block' }} />
                <span style={{ fontSize: '0.68rem', color: '#4aab6f', letterSpacing: '0.08em' }}>{isZh ? '已自动保存' : 'Draft saved'}</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e05c5c', display: 'inline-block' }} />
                <span style={{ fontSize: '0.68rem', color: '#e05c5c', letterSpacing: '0.08em' }}>{isZh ? '保存失败' : 'Save failed'}</span>
              </>
            )}
            {saveStatus === 'idle' && blocks.length > 0 && (
              <span style={{ fontSize: '0.68rem', color: '#c8c8c4', letterSpacing: '0.08em' }}>{isZh ? `${blocks.length} 个块` : `${blocks.length} block${blocks.length !== 1 ? 's' : ''}`}</span>
            )}
          </div>
        </div>

        {/* Right: undo + clear + export */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Undo */}
          <button
            onClick={undo}
            disabled={undoStack.current.length === 0}
            title={isZh ? '撤销 (⌘Z)' : 'Undo (⌘Z)'}
            style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.12)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', cursor: undoStack.current.length === 0 ? 'not-allowed' : 'pointer', color: undoStack.current.length === 0 ? '#ccc' : '#888', letterSpacing: '0.05em' }}
          >
            ↩
          </button>
          {/* Clear draft */}
          {blocks.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm(isZh ? '清空当前画布？此操作不可撤销。' : 'Clear the canvas? This cannot be undone.')) clearDraft()
              }}
              title={isZh ? '清空画布' : 'Clear canvas'}
              style={{ background: 'transparent', border: '1px solid rgba(180,80,80,0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', cursor: 'pointer', color: 'rgba(180,80,80,0.5)', letterSpacing: '0.05em', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.5)'; e.currentTarget.style.color = 'rgba(180,80,80,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.2)'; e.currentTarget.style.color = 'rgba(180,80,80,0.5)' }}
            >
              {isZh ? '清空' : 'Clear'}
            </button>
          )}
          <button onClick={exportHTML} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '12px 20px', borderRadius: '10px', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
            HTML
          </button>
          <button onClick={() => exportPDF(project, blocks)} style={{ background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.15)', padding: '12px 20px', borderRadius: '10px', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
            PDF
          </button>
          <button onClick={() => exportDOCX(project)} style={{ background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.15)', padding: '12px 20px', borderRadius: '10px', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
            Word
          </button>
        </div>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '0', minHeight: 'calc(100vh - 65px)' }}>

        {/* 画布 */}
        <div style={{ padding: '40px', borderRight: '1px solid rgba(26,26,26,0.08)' }}>

          {/* Draft recovered banner — shown on mount when saved data was restored */}
          {justRestored && (
            <DraftBanner blocks={blocks} isZh={isZh} onClear={clearDraft} />
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8c8c4' }}>
              {isZh ? '画布 — 拖动调整顺序' : 'Canvas — drag to reorder'}
            </p>
            {blocks.length > 0 && (
              <button
                onClick={undo}
                disabled={undoStack.current.length === 0}
                style={{ fontSize: '0.68rem', color: undoStack.current.length > 0 ? '#aaa' : '#ddd', background: 'none', border: 'none', cursor: undoStack.current.length > 0 ? 'pointer' : 'default', letterSpacing: '0.08em' }}
              >
                {isZh ? '↩ 撤销' : '↩ undo'}
              </button>
            )}
          </div>

          {blocks.length === 0 && (
            <div style={{ border: '2px dashed rgba(26,26,26,0.1)', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#c8c8c4', fontSize: '0.9rem' }}>
              {isZh ? '从右侧添加内容块' : 'Add blocks from the right panel'}
            </div>
          )}

          {blocks.map((block, i) => (
            <div
              key={block.id}
              className="block-card"
              draggable={editingBlockId !== block.id}
              onDragStart={() => { dragIndex.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIndex.current !== null && dragIndex.current !== i) moveBlock(dragIndex.current, i); dragIndex.current = null }}
              style={{ background: '#fff', border: `1px solid ${editingBlockId === block.id ? '#1a1a1a' : 'rgba(26,26,26,0.08)'}`, borderRadius: '14px', padding: '20px 24px', marginBottom: '12px', cursor: editingBlockId === block.id ? 'default' : 'grab', position: 'relative' }}
            >
              {/* 块类型标签 */}
              <span style={{ fontSize: '0.68rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c8c8c4', display: 'block', marginBottom: '10px' }}>
                {block.type === 'image-row' ? (isZh ? '图片行' : 'Image Row') :
                 block.type === 'school-profile' ? (isZh ? '院校' : 'School') :
                 block.type === 'milestone' ? (isZh ? '进度' : 'Milestone') :
                 block.type === 'custom' ? (isZh ? '自定义' : 'Custom') :
                 block.type === 'note' ? (isZh ? '笔记' : 'Note') :
                 block.type === 'title' ? (isZh ? '标题' : 'Title') :
                 block.type === 'image' ? (isZh ? '图片' : 'Image') : block.type}
              </span>

              {/* ── 编辑态 ── */}
              {editingBlockId === block.id ? (
                <div>
                  {(block.type === 'custom' || block.type === 'note') && (
                    <textarea
                      autoFocus
                      value={editingContent}
                      onChange={e => setEditingContent(e.target.value)}
                      rows={5}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(26,26,26,0.15)', borderRadius: '10px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#1a1a1a', outline: 'none', resize: 'vertical', background: '#f7f7f5', marginBottom: '10px' }}
                    />
                  )}
                  {block.type === 'image' && (
                    <div>
                      <img src={block.content} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
                    </div>
                  )}
                  {block.type === 'image-row' && (
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ fontSize: '0.68rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c8c8c4', marginBottom: '8px' }}>
                        {isZh ? '拖拽图片调整顺序，每张图可填写名称' : 'Drag to reorder · add a label under each image'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '8px' }}>
                        {(block.images || []).map((url, idx) => (
                          <div
                            key={idx}
                            draggable
                            onDragStart={() => { imageDragIndex.current = idx }}
                            onDragOver={e => e.preventDefault()}
                            onDrop={() => {
                              if (imageDragIndex.current !== null && imageDragIndex.current !== idx) {
                                const fromIdx = imageDragIndex.current
                                setBlocks(b => b.map(bl => {
                                  if (bl.id !== block.id) return bl
                                  const imgs = [...(bl.images || [])]
                                  const caps = [...(editingImageCaptions.length === imgs.length ? editingImageCaptions : imgs.map((_, i) => editingImageCaptions[i] || ''))]
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
                            style={{ cursor: 'grab' }}
                          >
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', display: 'block', pointerEvents: 'none' }} />
                            <input
                              value={editingImageCaptions[idx] || ''}
                              onChange={e => {
                                const updated = [...editingImageCaptions]
                                updated[idx] = e.target.value
                                setEditingImageCaptions(updated)
                              }}
                              placeholder={isZh ? `图片 ${idx + 1} 名称…` : `Image ${idx + 1} label…`}
                              style={{ width: '100%', marginTop: '6px', padding: '5px 8px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem', color: '#555', outline: 'none', background: '#f7f7f5' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* caption 通用 */}
                  {(block.type === 'image' || block.type === 'image-row' || block.type === 'note') && (
                    <input
                      value={editingCaption}
                      onChange={e => setEditingCaption(e.target.value)}
                      placeholder={isZh ? '图片说明（可选）' : 'Caption (optional)'}
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#888', outline: 'none', background: '#f7f7f5' }}
                    />
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={saveEdit} style={{ padding: '8px 18px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em', cursor: 'pointer' }}>
                      {isZh ? '保存' : 'Save'}
                    </button>
                    <button onClick={cancelEdit} style={{ padding: '8px 18px', background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', cursor: 'pointer' }}>
                      {isZh ? '取消' : 'Cancel'}
                    </button>
                  </div>
                </div>
              ) : (
                /* ── 展示态 ── */
                <div>
                  {block.type === 'title' && (
                    <div>
                      <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a' }}>{project.title}</p>
                      {project.description && <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '6px' }}>{project.description.slice(0, 100)}…</p>}
                    </div>
                  )}
                  {block.type === 'image' && (
                    <div>
                      <img src={block.content} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                      {block.caption && <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '8px', fontStyle: 'italic' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'image-row' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '6px' }}>
                        {(block.images || []).map((url, idx) => (
                          <div key={idx}>
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', display: 'block' }} />
                            {(block.imageCaptions || [])[idx] && (
                              <p style={{ fontSize: '0.78rem', color: '#888', marginTop: '5px', textAlign: 'center', fontStyle: 'italic', lineHeight: 1.4 }}>
                                {(block.imageCaptions || [])[idx]}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {block.caption && <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '8px', fontStyle: 'italic' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'note' && (
                    <div>
                      <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.7 }}>{block.content}</p>
                      {block.caption && <p style={{ fontSize: '0.82rem', color: '#aaa', marginTop: '6px', fontStyle: 'italic' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'milestone' && (
                    <div>
                      <p style={{ fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: '10px' }}>{isZh ? '进度节点' : 'Milestones'}</p>
                      {project.milestones.slice(0, 3).map(m => (
                        <p key={m.id} style={{ fontSize: '0.9rem', color: m.status === 'done' ? '#aaa' : '#1a1a1a', marginBottom: '4px' }}>
                          {m.status === 'done' ? '✓' : '○'} {m.title}
                        </p>
                      ))}
                      {project.milestones.length > 3 && <p style={{ fontSize: '0.8rem', color: '#c8c8c4', marginTop: '4px' }}>+{project.milestones.length - 3} {isZh ? '个节点' : 'more'}</p>}
                    </div>
                  )}
                  {block.type === 'custom' && (
                    <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{block.content}</p>
                  )}
                  {block.type === 'school-profile' && (() => {
                    const school = schools.find(s => s.id === block.content)
                    if (!school) return <p style={{ fontSize: '0.85rem', color: '#aaa' }}>School not found</p>
                    const displayName = isZh ? (school.nameZh || school.name) : school.name
                    const displayDept = isZh ? (school.departmentZh || school.department) : school.department
                    return (
                      <div>
                        <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c4a044', marginBottom: '6px' }}>{school.country}</p>
                        <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '3px' }}>{displayName}</p>
                        {displayDept && <p style={{ fontSize: '0.88rem', color: '#888' }}>{displayDept}</p>}
                        {school.deadline && <p style={{ fontSize: '0.78rem', color: '#b8b8b4', marginTop: '6px' }}>⏱ {school.deadline}</p>}
                        {school.aiStatement && (
                          <p style={{ fontSize: '0.78rem', color: '#4aab6f', marginTop: '6px' }}>✓ {isZh ? '含申请文书' : 'includes statement'}</p>
                        )}
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* 操作按钮 */}
              {editingBlockId !== block.id && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                  {/* 编辑按钮：只对可编辑类型显示 */}
                  {['custom', 'note', 'image', 'image-row'].includes(block.type) && (
                    <button
                      className="edit-btn"
                      onClick={() => startEdit(block)}
                      style={{ background: 'rgba(26,26,26,0.06)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', color: '#888', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={isZh ? '编辑' : 'Edit'}
                    >✎</button>
                  )}
                  <button
                    onClick={() => removeBlock(block.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(180,80,80,0.4)', fontSize: '0.85rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.9)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}
                  >✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 右侧面板 */}
        <div style={{ padding: '40px 28px', background: 'rgba(255,255,255,0.6)', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8c8c4', marginBottom: '24px' }}>
            {isZh ? '内容块' : 'Content Blocks'}
          </p>

          {/* 项目信息 */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '项目信息' : 'Project Info'}</p>
            <button onClick={() => addBlock('title', '')} style={{ width: '100%', padding: '12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', textAlign: 'left', letterSpacing: '0.05em' }}>
              + {isZh ? '标题 & 描述' : 'Title & Description'}
            </button>
          </div>

          {/* 进度 */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '进度' : 'Progress'}</p>
            <button onClick={() => addBlock('milestone', '')} style={{ width: '100%', padding: '12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', textAlign: 'left', letterSpacing: '0.05em' }}>
              + {isZh ? '进度节点' : 'Milestones'}
            </button>
          </div>

          {/* 目标院校 — 折叠 */}
          {schools.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4' }}>
                  {isZh ? '目标院校' : 'Target Schools'} <span style={{ color: '#c8c8c4' }}>({schools.length})</span>
                </p>
                {schools.length > 3 && (
                  <button onClick={() => setSchoolsExpanded(e => !e)} style={{ fontSize: '0.68rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}>
                    {schoolsExpanded ? (isZh ? '收起 ↑' : 'Less ↑') : (isZh ? '展开全部 ↓' : 'Show all ↓')}
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {visibleSchools.map(s => (
                  <div key={s.id}
                    className="school-item"
                    onClick={() => addBlock('school-profile', s.id)}
                    style={{ padding: '11px 14px', border: '1px solid rgba(26,26,26,0.1)', borderLeft: '3px solid rgba(196,160,68,0.5)', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s', background: 'transparent' }}
                  >
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', color: '#1a1a1a', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isZh ? (s.nameZh || s.name) : s.name}
                    </p>
                    {(isZh ? (s.departmentZh || s.department) : s.department) && (
                      <p style={{ fontSize: '0.72rem', color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isZh ? (s.departmentZh || s.department) : s.department}
                      </p>
                    )}
                    {s.aiStatement && (
                      <p style={{ fontSize: '0.68rem', color: '#4aab6f', marginTop: '4px' }}>✓ {isZh ? '有申请文书' : 'has statement'}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 图片 — 多选模式 */}
          {mediaUrls.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4' }}>
                  {isZh ? '图片' : 'Images'}
                </p>
                <button
                  onClick={() => { setImagePickerOpen(o => !o); setSelectedImages([]) }}
                  style={{ fontSize: '0.68rem', color: imagePickerOpen ? '#1a1a1a' : '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.1em' }}
                >
                  {imagePickerOpen ? (isZh ? '取消' : 'Cancel') : (isZh ? '多选并排' : 'Multi-select')}
                </button>
              </div>

              {imagePickerOpen ? (
                /* 多选模式 */
                <div>
                  <p style={{ fontSize: '0.68rem', color: '#b8b8b4', marginBottom: '10px', letterSpacing: '0.06em' }}>
                    {isZh ? `已选 ${selectedImages.length} 张，点击选择后点添加` : `${selectedImages.length} selected — click to pick, then add`}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
                    {mediaUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt=""
                        className={`img-thumb${selectedImages.includes(url) ? ' selected' : ''}`}
                        onClick={() => toggleImageSelection(url)}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={addImageRow}
                    disabled={selectedImages.length === 0}
                    style={{ width: '100%', padding: '11px', background: selectedImages.length > 0 ? '#1a1a1a' : 'rgba(26,26,26,0.2)', color: '#f7f7f5', border: 'none', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.08em', cursor: selectedImages.length > 0 ? 'pointer' : 'not-allowed' }}
                  >
                    {selectedImages.length <= 1
                      ? (isZh ? '+ 添加图片' : '+ Add Image')
                      : (isZh ? `+ 并排添加 ${selectedImages.length} 张` : `+ Add ${selectedImages.length} images in a row`)}
                  </button>
                </div>
              ) : (
                /* 普通模式：单击直接添加 */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {mediaUrls.map((url, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img
                        src={url}
                        alt=""
                        className="img-thumb"
                        onClick={() => addBlock('image', url)}
                        style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)' }}
                      />
                      <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '10px', padding: '2px 5px', borderRadius: '4px' }}>+</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 笔记 */}
          {(project.notes || []).length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '笔记' : 'Notes'}</p>
              {(project.notes || []).map(n => (
                <div key={n.id} onClick={() => addBlock('note', n.content)} style={{ padding: '10px 14px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#555', lineHeight: 1.6, transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {n.content.slice(0, 60)}{n.content.length > 60 ? '…' : ''}
                </div>
              ))}
            </div>
          )}

          {/* 自定义文本 */}
          <div>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '自定义文本' : 'Custom Text'}</p>
            <textarea value={customText} onChange={e => setCustomText(e.target.value)} rows={4}
              placeholder={isZh ? '输入任意文字…' : 'Type anything...'}
              style={{ width: '100%', padding: '12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#1a1a1a', outline: 'none', resize: 'none', marginBottom: '8px' }}
            />
            <button onClick={() => { if (customText.trim()) { addBlock('custom', customText); setCustomText('') } }}
              style={{ width: '100%', padding: '11px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
              + {isZh ? '添加' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}