'use client'
import React, { useState, useRef } from 'react'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { Project, ProjectStatus, ProjectCategory, Milestone, Proposal, Note, NoteVisibility } from '../../../types'
import { usePathname, useRouter } from 'next/navigation'
import { exportPDF, exportDOCX } from '../../../lib/exportProject'

const STATUS_COLORS: Record<ProjectStatus, string> = {
  'planning':    'rgba(180,160,100,0.15)',
  'in-progress': 'rgba(100,140,180,0.15)',
  'completed':   'rgba(100,160,120,0.15)',
  'on-hold':     'rgba(180,100,100,0.12)',
}
const STATUS_DOT: Record<ProjectStatus, string> = {
  'planning':    '#c4a044',
  'in-progress': '#4a8abf',
  'completed':   '#4aab6f',
  'on-hold':     '#bf4a4a',
}
const STATUS_LABEL: Record<ProjectStatus, string> = {
  'planning':    'Planning',
  'in-progress': 'In Progress',
  'completed':   'Completed',
  'on-hold':     'On Hold',
}
const CATEGORY_LABEL: Record<ProjectCategory, string> = {
  'school':      'School',
  'personal':    'Personal',
  'commission':  'Commission',
  'experiment':  'Experiment',
}
const NOTE_COLORS: Record<NoteVisibility, { bg: string; color: string; label: string; labelZh: string }> = {
  'private':   { bg: 'rgba(26,26,26,0.06)',   color: '#888884', label: 'Private',   labelZh: '私密' },
  'group':     { bg: 'rgba(100,140,180,0.12)', color: '#4a8abf', label: 'Group',     labelZh: '小组' },
  'professor': { bg: 'rgba(100,160,120,0.12)', color: '#4aab6f', label: 'Professor', labelZh: '教授' },
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const EMPTY_FORM = {
  title: '', description: '', category: 'personal' as ProjectCategory,
  status: 'planning' as ProjectStatus, tags: '', startDate: '',
  endDate: '', school: '', medium: '',
}

export default function ProjectsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')

  const [projects, setProjects] = useLocalStorage<Project[]>('ps-projects', [])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | 'all'>('all')
  const [filterCat, setFilterCat] = useState<ProjectCategory | 'all'>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [newMilestone, setNewMilestone] = useState({ title: '', date: '', note: '' })
  const [newProposal, setNewProposal] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newNoteVis, setNewNoteVis] = useState<NoteVisibility>('private')
  const [noteFilter, setNoteFilter] = useState<NoteVisibility | 'all'>('all')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiType, setAiType] = useState<'plan' | 'statement' | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)
  const [imageEditorUrl, setImageEditorUrl] = useState<string | null>(null)
  const [imageEditorIdx, setImageEditorIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── 新增：日期内联编辑 state ──
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null)
  const [editingMilestoneDate, setEditingMilestoneDate] = useState('')

  const filtered = projects.filter(p => {
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterCat !== 'all' && p.category !== filterCat) return false
    return true
  })

  const detail = projects.find(p => p.id === detailId) || null

  const openNew = () => { setForm(EMPTY_FORM); setEditId(null); setShowModal(true) }
  const openEdit = (p: Project) => {
    setForm({ title: p.title, description: p.description, category: p.category, status: p.status, tags: p.tags.join(', '), startDate: p.startDate, endDate: p.endDate || '', school: p.school || '', medium: p.medium || '' })
    setEditId(p.id); setShowModal(true)
  }

  const save = () => {
    if (!form.title.trim()) return
    const now = new Date().toISOString()
    if (editId) {
      setProjects(projects.map(p => p.id === editId ? { ...p, ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), updatedAt: now } : p))
    } else {
      setProjects([{ id: generateId(), ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean), mediaUrls: [], milestones: [], proposals: [], notes: [], createdAt: now, updatedAt: now }, ...projects])
    }
    setShowModal(false)
  }

  const remove = (id: string) => { setProjects(projects.filter(p => p.id !== id)); if (detailId === id) setDetailId(null) }
  const updateProject = (updated: Project) => setProjects(projects.map(p => p.id === updated.id ? updated : p))

  const addMilestone = () => {
    if (!detail || !newMilestone.title.trim()) return
    updateProject({ ...detail, milestones: [...(detail.milestones || []), { id: generateId(), ...newMilestone, status: 'pending' }], updatedAt: new Date().toISOString() })
    setNewMilestone({ title: '', date: '', note: '' })
  }
  const toggleMilestone = (mId: string) => {
    if (!detail) return
    updateProject({ ...detail, milestones: detail.milestones.map(m => m.id === mId ? { ...m, status: m.status === 'done' ? 'pending' : 'done' } : m), updatedAt: new Date().toISOString() })
  }
  const deleteMilestone = (mId: string) => {
    if (!detail) return
    updateProject({ ...detail, milestones: detail.milestones.filter(m => m.id !== mId), updatedAt: new Date().toISOString() })
  }

  // ── 新增：更新节点日期 ──
  const updateMilestoneDate = (mId: string, date: string) => {
    if (!detail) return
    updateProject({
      ...detail,
      milestones: detail.milestones.map(m => m.id === mId ? { ...m, date } : m),
      updatedAt: new Date().toISOString(),
    })
    setEditingMilestoneId(null)
    setEditingMilestoneDate('')
  }

  const addProposal = () => {
    if (!detail || !newProposal.trim()) return
    updateProject({ ...detail, proposals: [...(detail.proposals || []), { id: generateId(), content: newProposal, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() })
    setNewProposal('')
  }
  const deleteProposal = (pId: string) => { if (!detail) return; updateProject({ ...detail, proposals: detail.proposals.filter(p => p.id !== pId), updatedAt: new Date().toISOString() }) }

  const addNote = () => {
    if (!detail || !newNote.trim()) return
    const n: Note = { id: generateId(), content: newNote, visibility: newNoteVis, createdAt: new Date().toISOString() }
    updateProject({ ...detail, notes: [...(detail.notes || []), n], updatedAt: new Date().toISOString() })
    setNewNote('')
  }
  const deleteNote = (nId: string) => { if (!detail) return; updateProject({ ...detail, notes: detail.notes.filter(n => n.id !== nId), updatedAt: new Date().toISOString() }) }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!detail || !e.target.files) return
    Array.from(e.target.files).forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => { const dataUrl = ev.target?.result as string; updateProject({ ...detail, mediaUrls: [...(detail.mediaUrls || []), dataUrl], updatedAt: new Date().toISOString() }) }
      reader.readAsDataURL(file)
    })
  }
  const deleteImage = (idx: number) => { if (!detail) return; const urls = [...(detail.mediaUrls || [])]; urls.splice(idx, 1); updateProject({ ...detail, mediaUrls: urls, updatedAt: new Date().toISOString() }) }

  const generateAI = async (type: 'plan' | 'statement') => {
    if (!detail) return
    setAiLoading(true); setAiType(type); setAiResult('')
    const prompt = type === 'plan'
      ? `Generate a complete creative project plan for: "${detail.title}". Description: ${detail.description}. Medium: ${detail.medium || 'not specified'}. School: ${detail.school || 'personal'}. Include: concept, materials, phases & timeline, reference artists, challenges.${isZh ? ' Respond in Chinese.' : ''}`
      : `Write a professional artist statement (200-300 words) for project: "${detail.title}". Description: ${detail.description}. Medium: ${detail.medium || 'not specified'}. Be sincere, specific, avoid clichés.${isZh ? ' Respond in Chinese.' : ''}`
    try {
      const res = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }) })
      const data = await res.json()
      setAiResult(data.result || data.error || 'Error')
    } catch { setAiResult('Error') } finally { setAiLoading(false) }
  }

  const saveAiAsProposal = () => {
    if (!detail || !aiResult) return
    updateProject({ ...detail, proposals: [...(detail.proposals || []), { id: generateId(), content: `[AI ${aiType === 'plan' ? (isZh ? '项目方案' : 'Project Plan') : (isZh ? '艺术家陈述' : 'Artist Statement')}]\n\n${aiResult}`, createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() })
    setAiResult(''); setAiType(null)
  }

  const tx = {
    title: isZh ? '项目管理' : 'Projects',
    subtitle: isZh ? '记录你的在校与个人项目' : 'Track your school and personal work',
    newProject: isZh ? '+ 新建项目' : '+ New Project',
    empty: isZh ? '还没有项目，点击新建开始' : 'No projects yet. Create one to get started.',
    all: isZh ? '全部' : 'All',
    save: isZh ? '保存' : 'Save',
    cancel: isZh ? '取消' : 'Cancel',
    delete: isZh ? '删除' : 'Delete',
    edit: isZh ? '编辑' : 'Edit',
    titleLabel: isZh ? '项目标题 *' : 'Title *',
    descLabel: isZh ? '描述' : 'Description',
    catLabel: isZh ? '分类' : 'Category',
    statusLabel: isZh ? '状态' : 'Status',
    tagsLabel: isZh ? '标签（逗号分隔）' : 'Tags (comma separated)',
    startLabel: isZh ? '开始日期' : 'Start Date',
    endLabel: isZh ? '结束日期' : 'End Date',
    schoolLabel: isZh ? '所属院校' : 'School',
    mediumLabel: isZh ? '媒介/材料' : 'Medium / Material',
    back: isZh ? '← 返回' : '← Back',
    backList: isZh ? '← 返回列表' : '← Back to list',
    milestones: isZh ? '进度节点' : 'Milestones',
    proposals: isZh ? '提议 / 想法' : 'Proposals / Ideas',
    notes: isZh ? '笔记' : 'Notes',
    addMilestone: isZh ? '添加节点' : 'Add Milestone',
    addProposal: isZh ? '添加提议' : 'Add Proposal',
    addNote: isZh ? '添加笔记' : 'Add Note',
    mTitle: isZh ? '节点标题' : 'Milestone title',
    mNote: isZh ? '备注' : 'Note',
    pPlaceholder: isZh ? '写下你的提议或想法……' : 'Write a proposal or idea...',
    nPlaceholder: isZh ? '写下笔记……' : 'Write a note...',
    noMilestones: isZh ? '还没有节点' : 'No milestones yet',
    noProposals: isZh ? '还没有提议' : 'No proposals yet',
    noNotes: isZh ? '还没有笔记' : 'No notes yet',
    open: isZh ? '查看详情 →' : 'Open →',
    images: isZh ? '作品图片' : 'Artwork Images',
    uploadImages: isZh ? '上传图片' : 'Upload Images',
    noImages: isZh ? '还没有图片' : 'No images yet',
    aiTools: isZh ? 'AI 辅助' : 'AI Assistant',
    genPlan: isZh ? '生成项目方案' : 'Generate Project Plan',
    genStatement: isZh ? '生成艺术家陈述' : 'Generate Artist Statement',
    generating: isZh ? '生成中…' : 'Generating...',
    saveAsProposal: isZh ? '保存为提议' : 'Save as Proposal',
    dismiss: isZh ? '关闭' : 'Dismiss',
    visibility: isZh ? '可见性' : 'Visibility',
    setDate: isZh ? '设置日期' : 'Set date',
    overdue: isZh ? '已逾期' : 'overdue',
    dateHint: isZh ? 'Enter 确认 · Esc 取消' : 'Enter to save · Esc to cancel',
  }

  // ── DETAIL VIEW ──
  if (detail) {
    const milestones = detail.milestones || []
    const proposals = detail.proposals || []
    const mediaUrls = detail.mediaUrls || []
    const notes = detail.notes || []
    const filteredNotes = noteFilter === 'all' ? notes : notes.filter(n => n.visibility === noteFilter)
    const doneCount = milestones.filter(m => m.status === 'done').length
    const progressPct = milestones.length > 0 ? Math.round((doneCount / milestones.length) * 100) : 0
    const allDone = milestones.length > 0 && doneCount === milestones.length

    return (
      <>
        <style>{`
          @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          @keyframes modalIn { from{opacity:0;transform:scale(0.96)} to{opacity:1;transform:scale(1)} }
          @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          .ms-row { transition: background 0.15s; border-radius: 12px; }
          .ms-row:hover { background: rgba(26,26,26,0.03); }
          .img-card { position:relative; overflow:hidden; border-radius:14px; aspect-ratio:1; cursor:pointer; }
          .img-card img { width:100%; height:100%; object-fit:cover; transition:transform 0.3s; }
          .img-card:hover img { transform:scale(1.04); }
          .img-edit { position:absolute; top:8px; left:8px; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; font-size:12px; }
          .img-card:hover .img-edit { opacity:1; }
          .img-del { position:absolute; top:8px; right:8px; background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s; font-size:13px; }
          .img-card:hover .img-del { opacity:1; }
          .note-pill { transition: all 0.15s; cursor: pointer; border-radius: 20px; }
          .note-pill:hover { opacity: 0.8; }
          .date-btn:hover { color: #4a8abf !important; }
        `}</style>

        {imageEditorUrl !== null && imageEditorIdx !== null && detail && (
          <ImageEditor
            src={imageEditorUrl}
            isZh={isZh}
            onSave={dataUrl => {
              const urls = [...(detail.mediaUrls || [])]
              urls[imageEditorIdx!] = dataUrl
              updateProject({ ...detail, mediaUrls: urls, updatedAt: new Date().toISOString() })
              setImageEditorUrl(null)
              setImageEditorIdx(null)
            }}
            onClose={() => { setImageEditorUrl(null); setImageEditorIdx(null) }}
          />
        )}

        {lightboxImg && (
          <div onClick={() => setLightboxImg(null)} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
            <img src={lightboxImg} alt="" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: '12px', objectFit: 'contain' }} />
          </div>
        )}

        <main style={{ minHeight: '100vh', background: '#f7f7f5' }}>
          <nav style={{ padding: '24px 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
            <button onClick={() => setDetailId(null)} style={{ fontFamily: 'Space Mono, monospace', fontSize: '1rem', letterSpacing: '0.1em', color: '#888884', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
            >{tx.backList}</button>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '1rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>PORTFOLIO_SENSEI</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button onClick={() => router.push(`${isZh ? '/zh' : '/en'}/projects/${detail.id}/export`)} style={{ background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '14px 22px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
                {isZh ? '编辑导出' : 'Export Editor'}
              </button>
              <button onClick={() => exportPDF(detail, [], [], { theme: 'sensei', font: 'mixed', width: 800, radius: 16, gap: 20, imageStyle: 'cover' }, isZh)} style={{ background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '14px 22px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>PDF</button>
              <button onClick={() => exportDOCX(detail, [], [], { theme: 'sensei', font: 'mixed', width: 800, radius: 16, gap: 20, imageStyle: 'cover' }, isZh)} style={{ background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '14px 22px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>Word</button>
              <button onClick={() => openEdit(detail)} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '14px 28px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.12em', cursor: 'pointer' }}>{tx.edit}</button>
            </div>
          </nav>

          <div style={{ maxWidth: '900px', margin: '0 auto', padding: '64px 56px 96px', animation: 'fadeUp 0.5s both' }}>

            {/* 项目标题区 */}
            <div style={{ marginBottom: '56px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '8px 16px', borderRadius: '24px', background: STATUS_COLORS[detail.status], color: STATUS_DOT[detail.status] }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_DOT[detail.status] }}/>
                  {STATUS_LABEL[detail.status]}
                </span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', color: '#b8b8b4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{CATEGORY_LABEL[detail.category]}</span>
              </div>
              <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(2rem, 3vw, 3rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', marginBottom: '16px' }}>{detail.title}</h1>
              {detail.description && <p style={{ fontSize: '1.15rem', color: '#666', lineHeight: 1.8 }}>{detail.description}</p>}
            </div>

            {/* 元数据卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '56px' }}>
              {[
                { label: isZh ? '院校' : 'School', value: detail.school },
                { label: isZh ? '媒介' : 'Medium', value: detail.medium },
                { label: isZh ? '开始' : 'Start', value: detail.startDate },
                { label: isZh ? '结束' : 'End', value: detail.endDate },
              ].filter(m => m.value).map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '14px', padding: '18px 20px' }}>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.2em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '6px' }}>{m.label}</p>
                  <p style={{ fontSize: '1.05rem', color: '#1a1a1a' }}>{m.value}</p>
                </div>
              ))}
            </div>

            {/* 标签 */}
            {detail.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '56px' }}>
                {detail.tags.map(tag => (
                  <span key={tag} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.1em', padding: '7px 16px', borderRadius: '10px', background: 'rgba(26,26,26,0.06)', color: '#888884' }}>{tag}</span>
                ))}
              </div>
            )}

            {/* IMAGES */}
            <section style={{ marginBottom: '64px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tx.images}</h2>
                <button onClick={() => fileInputRef.current?.click()} style={{ padding: '12px 22px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
                  + {tx.uploadImages}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
              </div>
              {mediaUrls.length === 0 ? (
                <div onClick={() => fileInputRef.current?.click()} style={{ border: '2px dashed rgba(26,26,26,0.12)', borderRadius: '16px', padding: '48px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.12)')}
                >
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', color: '#c8c8c4', letterSpacing: '0.1em' }}>{tx.noImages}</p>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', color: '#d8d8d4', marginTop: '8px' }}>{isZh ? '点击上传' : 'Click to upload'}</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                  {mediaUrls.map((url, idx) => (
                    <div key={idx} className="img-card" onClick={() => setLightboxImg(url)}>
                      <img src={url} alt={`artwork ${idx + 1}`} />
                      <button className="img-edit" onClick={e => { e.stopPropagation(); setImageEditorUrl(url); setImageEditorIdx(idx) }}>✎</button>
                      <button className="img-del" onClick={e => { e.stopPropagation(); deleteImage(idx) }}>✕</button>
                    </div>
                  ))}
                  <div onClick={() => fileInputRef.current?.click()} style={{ aspectRatio: '1', border: '2px dashed rgba(26,26,26,0.12)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.6rem', color: '#d0d0cc' }}>+</span>
                  </div>
                </div>
              )}
            </section>

            {/* AI ASSISTANT */}
            <section style={{ marginBottom: '64px' }}>
              <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '24px' }}>{tx.aiTools}</h2>
              <div style={{ display: 'flex', gap: '14px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => generateAI('plan')} disabled={aiLoading} style={{ padding: '14px 26px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.88rem', letterSpacing: '0.1em', cursor: aiLoading ? 'not-allowed' : 'pointer', opacity: aiLoading && aiType === 'plan' ? 0.5 : 1 }}>
                  {aiLoading && aiType === 'plan' ? tx.generating : tx.genPlan}
                </button>
                <button onClick={() => generateAI('statement')} disabled={aiLoading} style={{ padding: '14px 26px', background: 'transparent', color: '#1a1a1a', border: '1.5px solid rgba(26,26,26,0.2)', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.88rem', letterSpacing: '0.1em', cursor: aiLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { if(!aiLoading) { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#f7f7f5' }}}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#1a1a1a' }}
                >
                  {aiLoading && aiType === 'statement' ? tx.generating : tx.genStatement}
                </button>
              </div>
              {aiLoading && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '20px 0' }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b8b8b4', animation: `blink 1.2s ${i*0.2}s infinite` }}/>)}
                </div>
              )}
              {aiResult && !aiLoading && (
                <div style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '16px', padding: '28px', animation: 'slideUp 0.3s both' }}>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.2em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '16px' }}>
                    {aiType === 'plan' ? (isZh ? '项目方案' : 'Project Plan') : (isZh ? '艺术家陈述' : 'Artist Statement')}
                  </p>
                  <p style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: 1.85, whiteSpace: 'pre-wrap', marginBottom: '24px' }}>{aiResult}</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={saveAiAsProposal} style={{ padding: '12px 22px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>{tx.saveAsProposal}</button>
                    <button onClick={() => { setAiResult(''); setAiType(null) }} style={{ padding: '12px 22px', background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>{tx.dismiss}</button>
                  </div>
                </div>
              )}
            </section>

            {/* ── MILESTONES ── */}
            <section style={{ marginBottom: '64px' }}>

              {/* 标题行 + 进度百分比 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {tx.milestones}
                </h2>
                {milestones.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#b8b8b4' }}>
                      {doneCount} / {milestones.length}
                    </span>
                    <span style={{
                      fontFamily: 'Space Mono, monospace', fontSize: '0.92rem', fontWeight: 700,
                      color: allDone ? '#4aab6f' : '#4a8abf',
                      letterSpacing: '0.02em',
                      transition: 'color 0.3s',
                    }}>
                      {progressPct}%
                    </span>
                  </div>
                )}
              </div>

              {/* 进度条 */}
              {milestones.length > 0 && (
                <div style={{ height: '4px', background: 'rgba(26,26,26,0.08)', borderRadius: '2px', marginBottom: '32px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${progressPct}%`,
                    background: allDone ? '#4aab6f' : '#4a8abf',
                    borderRadius: '2px',
                    transition: 'width 0.45s cubic-bezier(.4,0,.2,1), background 0.3s',
                  }}/>
                </div>
              )}

              {/* 时间线节点列表 */}
              <div style={{ position: 'relative', marginBottom: '28px' }}>

                {milestones.length === 0 && (
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.88rem', color: '#c8c8c4', padding: '28px 0' }}>
                    {tx.noMilestones}
                  </p>
                )}

                {/* 脊线 */}
                {milestones.length > 0 && (
                  <div style={{
                    position: 'absolute', left: '10px', top: '12px', bottom: '12px',
                    width: '1px', background: 'rgba(26,26,26,0.09)', zIndex: 0,
                  }}/>
                )}

                {milestones.map((m, idx) => {
                  const isDone = m.status === 'done'
                  const isOverdue = !isDone && !!m.date && new Date(m.date) < new Date()
                  const isEditingDate = editingMilestoneId === m.id

                  return (
                    <div
                      key={m.id}
                      className="ms-row"
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: '18px',
                        padding: '10px 14px 10px 0', position: 'relative', zIndex: 1,
                        marginBottom: idx < milestones.length - 1 ? '2px' : 0,
                      }}
                    >
                      {/* 节点圆圈 — 点击切换完成状态 */}
                      <button
                        onClick={() => toggleMilestone(m.id)}
                        style={{
                          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                          marginTop: '3px',
                          border: isDone ? 'none' : `1.5px solid ${isOverdue ? 'rgba(180,80,80,0.5)' : 'rgba(26,26,26,0.22)'}`,
                          background: isDone ? '#4aab6f' : '#f7f7f5',
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.2s',
                          boxShadow: isDone
                            ? '0 0 0 3px rgba(74,171,111,0.15)'
                            : isOverdue ? '0 0 0 3px rgba(180,80,80,0.1)' : 'none',
                        }}
                      >
                        {isDone && <span style={{ color: '#fff', fontSize: '11px', lineHeight: 1 }}>✓</span>}
                      </button>

                      {/* 内容 */}
                      <div style={{ flex: 1, minWidth: 0 }}>

                        {/* 第一行：标题 + 删除按钮 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <p style={{
                            fontFamily: 'Space Mono, monospace', fontSize: '0.95rem', fontWeight: 600,
                            color: isDone ? '#b8b8b4' : '#1a1a1a',
                            textDecoration: isDone ? 'line-through' : 'none',
                            lineHeight: 1.4,
                          }}>
                            {m.title}
                          </p>
                          <button
                            onClick={() => deleteMilestone(m.id)}
                            style={{ fontSize: '0.85rem', color: 'rgba(180,80,80,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.8)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.35)')}
                          >✕</button>
                        </div>

                        {/* 第二行：日期（点击编辑）+ 逾期标签 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '5px', flexWrap: 'wrap' }}>
                          {isEditingDate ? (
                            // 编辑态
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input
                                type="date"
                                defaultValue={m.date || ''}
                                autoFocus
                                onChange={e => setEditingMilestoneDate(e.target.value)}
                                onBlur={() => {
                                  if (editingMilestoneDate) updateMilestoneDate(m.id, editingMilestoneDate)
                                  else setEditingMilestoneId(null)
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') updateMilestoneDate(m.id, editingMilestoneDate || m.date || '')
                                  if (e.key === 'Escape') setEditingMilestoneId(null)
                                }}
                                style={{
                                  padding: '4px 10px', borderRadius: '8px',
                                  border: '1px solid rgba(74,138,191,0.4)',
                                  background: 'rgba(100,140,180,0.06)',
                                  fontFamily: 'Space Mono, monospace', fontSize: '0.78rem',
                                  color: '#4a8abf', outline: 'none',
                                }}
                              />
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', color: '#c8c8c4' }}>
                                {tx.dateHint}
                              </span>
                            </div>
                          ) : (
                            // 展示态 — 点击进入编辑
                            <button
                              className="date-btn"
                              onClick={() => { setEditingMilestoneId(m.id); setEditingMilestoneDate(m.date || '') }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px',
                                fontFamily: 'Space Mono, monospace', fontSize: '0.78rem',
                                color: m.date ? (isOverdue ? 'rgba(180,80,80,0.75)' : '#b8b8b4') : '#d8d8d4',
                                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                                letterSpacing: '0.04em', transition: 'color 0.15s',
                              }}
                            >
                              <span style={{ fontSize: '0.72rem', opacity: 0.55 }}>◷</span>
                              {m.date || tx.setDate}
                            </button>
                          )}

                          {/* 逾期标签 */}
                          {isOverdue && !isEditingDate && (
                            <span style={{
                              fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.1em',
                              padding: '2px 8px', borderRadius: '6px',
                              background: 'rgba(180,80,80,0.08)', color: 'rgba(180,80,80,0.75)',
                            }}>
                              {tx.overdue}
                            </span>
                          )}
                        </div>

                        {/* 备注 */}
                        {m.note && (
                          <p style={{ fontSize: '0.88rem', color: '#999995', marginTop: '4px', lineHeight: 1.6 }}>
                            {m.note}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* 添加节点表单 */}
              <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '16px', padding: '22px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', marginBottom: '12px' }}>
                  <input
                    value={newMilestone.title}
                    onChange={e => setNewMilestone({ ...newMilestone, title: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') addMilestone() }}
                    placeholder={tx.mTitle}
                    style={{ padding: '13px 16px', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.1)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  />
                  <input
                    type="date"
                    value={newMilestone.date}
                    onChange={e => setNewMilestone({ ...newMilestone, date: e.target.value })}
                    style={{ padding: '13px 16px', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.1)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
                  <input
                    value={newMilestone.note}
                    onChange={e => setNewMilestone({ ...newMilestone, note: e.target.value })}
                    placeholder={tx.mNote}
                    style={{ padding: '13px 16px', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.1)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  />
                  <button
                    onClick={addMilestone}
                    style={{ padding: '13px 22px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer' }}
                  >
                    {tx.addMilestone}
                  </button>
                </div>
              </div>
            </section>

            {/* NOTES */}
            <section style={{ marginBottom: '64px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tx.notes}</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['all', 'private', 'group', 'professor'] as const).map(v => (
                    <button key={v} className="note-pill" onClick={() => setNoteFilter(v)} style={{
                      padding: '6px 14px', fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.1em',
                      border: '1px solid rgba(26,26,26,0.12)', cursor: 'pointer',
                      background: noteFilter === v ? '#1a1a1a' : 'transparent',
                      color: noteFilter === v ? '#f7f7f5' : '#888884',
                    }}>
                      {v === 'all' ? tx.all : isZh ? NOTE_COLORS[v].labelZh : NOTE_COLORS[v].label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                {filteredNotes.length === 0 && <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.88rem', color: '#c8c8c4', padding: '12px 0' }}>{tx.noNotes}</p>}
                {filteredNotes.map(n => (
                  <div key={n.id} style={{ background: 'rgba(255,255,255,0.8)', border: `1px solid ${NOTE_COLORS[n.visibility].bg}`, borderLeft: `3px solid ${NOTE_COLORS[n.visibility].color}`, borderRadius: '14px', padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '20px', background: NOTE_COLORS[n.visibility].bg, color: NOTE_COLORS[n.visibility].color }}>
                          {isZh ? NOTE_COLORS[n.visibility].labelZh : NOTE_COLORS[n.visibility].label}
                        </span>
                        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', color: '#c8c8c4' }}>{new Date(n.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '1.02rem', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.content}</p>
                    </div>
                    <button onClick={() => deleteNote(n.id)} style={{ fontSize: '0.9rem', color: 'rgba(180,80,80,0.4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, paddingTop: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.8)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}
                    >✕</button>
                  </div>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '16px', padding: '22px' }}>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#b8b8b4', letterSpacing: '0.14em', textTransform: 'uppercase', alignSelf: 'center', flexShrink: 0 }}>{tx.visibility}:</p>
                  {(['private', 'group', 'professor'] as const).map(v => (
                    <button key={v} onClick={() => setNewNoteVis(v)} style={{
                      padding: '7px 16px', borderRadius: '20px', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.1em', border: '1px solid rgba(26,26,26,0.12)', cursor: 'pointer', transition: 'all 0.15s',
                      background: newNoteVis === v ? NOTE_COLORS[v].color : 'transparent',
                      color: newNoteVis === v ? '#fff' : '#888884',
                    }}>
                      {isZh ? NOTE_COLORS[v].labelZh : NOTE_COLORS[v].label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={3}
                    placeholder={tx.nPlaceholder}
                    style={{ flex: 1, padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.1)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none', resize: 'none' }}
                  />
                  <button onClick={addNote} style={{ padding: '14px 22px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer', alignSelf: 'flex-end' }}>{tx.addNote}</button>
                </div>
              </div>
            </section>

            {/* PROPOSALS */}
            <section style={{ marginBottom: '64px' }}>
              <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '28px' }}>{tx.proposals}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                {proposals.length === 0 && <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.88rem', color: '#c8c8c4', padding: '12px 0' }}>{tx.noProposals}</p>}
                {proposals.map(p => (
                  <div key={p.id} style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '14px', padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                    <p style={{ fontSize: '1.05rem', color: '#1a1a1a', lineHeight: 1.7, flex: 1, whiteSpace: 'pre-wrap' }}>{p.content}</p>
                    <button onClick={() => deleteProposal(p.id)} style={{ fontSize: '0.9rem', color: 'rgba(180,80,80,0.4)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, paddingTop: '4px' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.8)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}
                    >✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <textarea value={newProposal} onChange={e => setNewProposal(e.target.value)} rows={3}
                  placeholder={tx.pPlaceholder}
                  style={{ flex: 1, padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.1)', background: 'rgba(255,255,255,0.8)', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none', resize: 'none' }}
                />
                <button onClick={addProposal} style={{ padding: '14px 22px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.1em', cursor: 'pointer', alignSelf: 'flex-end' }}>{tx.addProposal}</button>
              </div>
            </section>

            {/* 删除项目 */}
            <div style={{ borderTop: '1px solid rgba(26,26,26,0.06)', paddingTop: '36px' }}>
              <button onClick={() => remove(detail.id)} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '14px 24px', borderRadius: '10px', border: '1px solid rgba(180,80,80,0.2)', background: 'transparent', color: 'rgba(180,80,80,0.6)', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(180,80,80,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >{tx.delete} {isZh ? '此项目' : 'Project'}</button>
            </div>
          </div>
        </main>

        {/* EDIT MODAL */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(247,247,245,0.7)', backdropFilter: 'blur(16px)' }}>
            <div style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '28px', padding: '48px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', animation: 'modalIn 0.25s both', boxShadow: '0 24px 80px rgba(0,0,0,0.1)', position: 'relative' }}>
              <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(26,26,26,0.06)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: '#888884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '36px' }}>{tx.edit}</h2>
              {[
                { label: tx.titleLabel, key: 'title', type: 'text' },
                { label: tx.schoolLabel, key: 'school', type: 'text' },
                { label: tx.mediumLabel, key: 'medium', type: 'text' },
                { label: tx.startLabel, key: 'startDate', type: 'date' },
                { label: tx.endLabel, key: 'endDate', type: 'date' },
                { label: tx.tagsLabel, key: 'tags', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.descLabel}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.catLabel}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ProjectCategory })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  >
                    {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.statusLabel}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '14px' }}>
                <button onClick={save} style={{ flex: 1, background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '18px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}>{tx.save}</button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '18px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>{tx.cancel}</button>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  // ── LIST VIEW ──
  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes pillPop { 0%{transform:scale(1)} 40%{transform:scale(0.92)} 70%{transform:scale(1.06)} 100%{transform:scale(1)} }
        .card-hover { transition: transform 0.22s cubic-bezier(.4,0,.2,1), box-shadow 0.22s; cursor: pointer; }
        .card-hover:hover { transform: translateY(-6px); box-shadow: 0 16px 56px rgba(0,0,0,0.1); }
        .pill { transition: background 0.18s, color 0.18s, border-color 0.18s, transform 0.18s cubic-bezier(.34,1.56,.64,1); cursor: pointer; }
        .pill:hover { transform: translateY(-1px) scale(1.04); }
        .pill:active { transform: scale(0.94) !important; }
        .pill-active { background: #1a1a1a !important; color: #f7f7f5 !important; border-color: #1a1a1a !important; animation: pillPop 0.32s cubic-bezier(.34,1.56,.64,1) both; }
        .pill-inactive { background: transparent !important; color: #1a1a1a !important; border-color: rgba(26,26,26,0.18) !important; }
        .pill-inactive:hover { background: rgba(26,26,26,0.06) !important; }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#f7f7f5', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.08)' }}/>
          <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.06)' }}/>
        </div>

        <nav style={{ padding: '24px 56px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={() => router.push(isZh ? '/zh' : '/en')} style={{ fontFamily: 'Space Mono, monospace', fontSize: '1rem', letterSpacing: '0.14em', color: '#888884', background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
          >{tx.back}</button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '1rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>PORTFOLIO_SENSEI</span>
          <button onClick={openNew} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '14px 28px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.12em', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >{tx.newProject}</button>
        </nav>

        <div style={{ padding: '64px 56px 40px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.6s both' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.3em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '14px' }}>02 / PROJECTS</p>
          <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(2rem, 3vw, 3rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>{tx.title}</h1>
          <p style={{ fontSize: '1.1rem', color: '#888884', marginTop: '12px' }}>{tx.subtitle}</p>
        </div>

        <div style={{ padding: '0 56px 36px', display: 'flex', gap: '12px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {(['all', 'planning', 'in-progress', 'completed', 'on-hold'] as const).map(s => (
            <button key={s} className={`pill ${filterStatus === s ? 'pill-active' : 'pill-inactive'}`} onClick={() => setFilterStatus(s)} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 20px', borderRadius: '24px', border: '1px solid rgba(26,26,26,0.12)', cursor: 'pointer' }}>
              {s === 'all' ? tx.all : STATUS_LABEL[s]}
            </button>
          ))}
          <div style={{ width: '1px', background: 'rgba(26,26,26,0.1)', margin: '0 6px' }}/>
          {(['all', 'school', 'personal', 'commission', 'experiment'] as const).map(c => (
            <button key={c} className={`pill ${filterCat === c ? 'pill-active' : 'pill-inactive'}`} onClick={() => setFilterCat(c)} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.14em', textTransform: 'uppercase', padding: '10px 20px', borderRadius: '24px', border: '1px solid rgba(26,26,26,0.12)', cursor: 'pointer' }}>
              {c === 'all' ? tx.all : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        <div style={{ padding: '0 56px 96px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px', position: 'relative', zIndex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '100px 0', fontFamily: 'Space Mono, monospace', fontSize: '1rem', color: '#b8b8b4', letterSpacing: '0.1em' }}>{tx.empty}</div>
          )}
          {filtered.map((p, i) => {
            const ms = p.milestones || []
            const done = ms.filter(m => m.status === 'done').length
            const imgs = p.mediaUrls || []
            return (
              <div key={p.id} className="card-hover" onClick={() => setDetailId(p.id)} style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '24px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px', backdropFilter: 'blur(12px)', animation: `fadeUp 0.5s ${i * 0.06}s both` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '7px 14px', borderRadius: '24px', background: STATUS_COLORS[p.status], color: STATUS_DOT[p.status] }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: STATUS_DOT[p.status] }}/>
                    {STATUS_LABEL[p.status]}
                  </span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#b8b8b4', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{CATEGORY_LABEL[p.category]}</span>
                </div>
                {imgs.length > 0 && (
                  <div style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' }}>
                    <img src={imgs[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <h3 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.15rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em', lineHeight: 1.3 }}>{p.title}</h3>
                {p.description && (
                  <p style={{ fontSize: '1rem', color: '#888884', lineHeight: 1.7, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</p>
                )}
                {ms.length > 0 && (
                  <div>
                    <div style={{ height: '3px', background: 'rgba(26,26,26,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(done / ms.length) * 100}%`, background: '#4aab6f', borderRadius: '2px' }}/>
                    </div>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', color: '#b8b8b4', marginTop: '6px' }}>{done} / {ms.length} {isZh ? '节点' : 'milestones'}</p>
                  </div>
                )}
                {p.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {p.tags.map(tag => (
                      <span key={tag} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.1em', padding: '5px 12px', borderRadius: '8px', background: 'rgba(26,26,26,0.05)', color: '#888884' }}>{tag}</span>
                    ))}
                  </div>
                )}
                {p.startDate && (
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#b8b8b4', letterSpacing: '0.1em' }}>{p.startDate}{p.endDate ? ` → ${p.endDate}` : ''}</p>
                )}
                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid rgba(26,26,26,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {imgs.length > 0 && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', color: '#b8b8b4' }}>{imgs.length} {isZh ? '张图片' : 'images'}</span>}
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#b8b8b4', letterSpacing: '0.1em', marginLeft: 'auto' }}>{tx.open}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* NEW PROJECT MODAL */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(247,247,245,0.7)', backdropFilter: 'blur(16px)' }}>
            <div style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '28px', padding: '48px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', animation: 'modalIn 0.25s both', boxShadow: '0 24px 80px rgba(0,0,0,0.1)', position: 'relative' }}>
              <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(26,26,26,0.06)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', fontSize: '1rem', color: '#888884', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '36px' }}>{editId ? tx.edit : tx.newProject}</h2>
              {[
                { label: tx.titleLabel, key: 'title', type: 'text' },
                { label: tx.schoolLabel, key: 'school', type: 'text' },
                { label: tx.mediumLabel, key: 'medium', type: 'text' },
                { label: tx.startLabel, key: 'startDate', type: 'date' },
                { label: tx.endLabel, key: 'endDate', type: 'date' },
                { label: tx.tagsLabel, key: 'tags', type: 'text' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  />
                </div>
              ))}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.descLabel}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={4}
                  style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.catLabel}</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ProjectCategory })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  >
                    {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '8px' }}>{tx.statusLabel}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as ProjectStatus })}
                    style={{ width: '100%', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1.05rem', color: '#1a1a1a', outline: 'none' }}
                  >
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '14px' }}>
                <button onClick={save} style={{ flex: 1, background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '18px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}>{tx.save}</button>
                <button onClick={() => setShowModal(false)} style={{ flex: 1, background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '18px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', letterSpacing: '0.14em', textTransform: 'uppercase', cursor: 'pointer' }}>{tx.cancel}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  )
}

// ── Image Editor Component ────────────────────────────────────────────────────
function ImageEditor({
  src,
  isZh,
  onSave,
  onClose,
}: {
  src: string
  isZh: boolean
  onSave: (dataUrl: string) => void
  onClose: () => void
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const overlayInputRef = React.useRef<HTMLInputElement>(null)

  const [brightness, setBrightness] = React.useState(100)
  const [contrast, setContrast] = React.useState(100)
  const [saturate, setSaturate] = React.useState(100)
  const [rotation, setRotation] = React.useState(0)
  const [flipH, setFlipH] = React.useState(false)

  // Crop state
  const [cropMode, setCropMode] = React.useState(false)
  const [cropStart, setCropStart] = React.useState<{x:number,y:number}|null>(null)
  const [cropRect, setCropRect] = React.useState<{x:number,y:number,w:number,h:number}|null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  // Overlay image
  const [overlayImg, setOverlayImg] = React.useState<string|null>(null)
  const [overlayPos, setOverlayPos] = React.useState({x:40,y:40})
  const [overlayScale, setOverlayScale] = React.useState(50)
  const [draggingOverlay, setDraggingOverlay] = React.useState(false)
  const overlayDragStart = React.useRef<{mx:number,my:number,ox:number,oy:number}|null>(null)

  const [imgEl, setImgEl] = React.useState<HTMLImageElement|null>(null)
  const [canvasSize, setCanvasSize] = React.useState({w:0,h:0})

  // Load image
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

  // Redraw canvas
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgEl || canvasSize.w === 0) return
    canvas.width = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`
    ctx.translate(canvasSize.w/2, canvasSize.h/2)
    ctx.rotate((rotation * Math.PI) / 180)
    if (flipH) ctx.scale(-1, 1)
    ctx.drawImage(imgEl, -canvasSize.w/2, -canvasSize.h/2, canvasSize.w, canvasSize.h)
    ctx.restore()

    // Draw overlay image
    if (overlayImg) {
      const ov = new Image()
      ov.onload = () => {
        const ow = (canvasSize.w * overlayScale) / 100
        const oh = (ov.naturalHeight / ov.naturalWidth) * ow
        ctx.globalAlpha = 0.9
        ctx.drawImage(ov, overlayPos.x, overlayPos.y, ow, oh)
        ctx.globalAlpha = 1
      }
      ov.src = overlayImg
    }

    // Draw crop rect
    if (cropRect) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h)
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
    }
  }, [imgEl, brightness, contrast, saturate, rotation, flipH, overlayImg, overlayPos, overlayScale, cropRect, canvasSize])

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasSize.w / rect.width
    const scaleY = canvasSize.h / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode) return
    const pos = getCanvasPos(e)
    setCropStart(pos)
    setCropRect(null)
    setIsDragging(true)
  }
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !cropStart || !cropMode) return
    const pos = getCanvasPos(e)
    setCropRect({
      x: Math.min(cropStart.x, pos.x),
      y: Math.min(cropStart.y, pos.y),
      w: Math.abs(pos.x - cropStart.x),
      h: Math.abs(pos.y - cropStart.y),
    })
  }
  const handleCanvasMouseUp = () => setIsDragging(false)

  const applyCrop = () => {
    if (!cropRect || !canvasRef.current) return
    const canvas = canvasRef.current
    const tmp = document.createElement('canvas')
    tmp.width = cropRect.w
    tmp.height = cropRect.h
    tmp.getContext('2d')!.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h)
    const newSrc = tmp.toDataURL('image/jpeg', 0.92)
    const img = new Image()
    img.onload = () => {
      setImgEl(img)
      setCanvasSize({ w: cropRect.w, h: cropRect.h })
      setCropRect(null)
      setCropMode(false)
    }
    img.src = newSrc
  }

  const handleSave = () => {
    if (!canvasRef.current) return
    onSave(canvasRef.current.toDataURL('image/jpeg', 0.92))
  }

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setOverlayImg(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const sliders = [
    { label: isZh ? '亮度' : 'Brightness', value: brightness, set: setBrightness, min: 20, max: 200 },
    { label: isZh ? '对比度' : 'Contrast', value: contrast, set: setContrast, min: 20, max: 200 },
    { label: isZh ? '饱和度' : 'Saturate', value: saturate, set: setSaturate, min: 0, max: 200 },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, background: 'rgba(20,20,20,0.96)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ height: '56px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 28px', flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em' }}>
          {isZh ? '← 取消' : '← Cancel'}
        </button>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.78rem', letterSpacing: '0.15em', color: '#aaa', textTransform: 'uppercase' }}>
          {isZh ? '图片编辑器' : 'Image Editor'}
        </span>
        <button onClick={handleSave} style={{ background: '#f7f7f5', color: '#1a1a1a', border: 'none', padding: '10px 24px', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
          {isZh ? '保存' : 'Save'}
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', overflow: 'hidden' }}>
        {/* Canvas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', overflow: 'auto' }}>
          <canvas
            ref={canvasRef}
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '10px', cursor: cropMode ? 'crosshair' : 'default', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
          />
        </div>

        {/* Tools */}
        <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', overflowY: 'auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Adjustments */}
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#666', textTransform: 'uppercase', marginBottom: '14px' }}>
              {isZh ? '调色' : 'Adjustments'}
            </p>
            {sliders.map(s => (
              <div key={s.label} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#888' }}>{s.label}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#555' }}>{s.value}%</span>
                </div>
                <input type="range" min={s.min} max={s.max} value={s.value}
                  onChange={e => s.set(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f7f7f5' }}
                />
              </div>
            ))}
            <button onClick={() => { setBrightness(100); setContrast(100); setSaturate(100) }}
              style={{ fontSize: '0.68rem', color: '#555', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', marginTop: '4px' }}>
              {isZh ? '重置' : 'Reset'}
            </button>
          </div>

          {/* Rotate / Flip */}
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#666', textTransform: 'uppercase', marginBottom: '14px' }}>
              {isZh ? '旋转 / 翻转' : 'Rotate / Flip'}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[90, 180, 270].map(deg => (
                <button key={deg} onClick={() => setRotation(r => (r + deg) % 360)}
                  style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>
                  +{deg}°
                </button>
              ))}
              <button onClick={() => setFlipH(f => !f)}
                style={{ padding: '8px 12px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', background: flipH ? 'rgba(255,255,255,0.1)' : 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>
                ⇄ {isZh ? '翻转' : 'Flip'}
              </button>
            </div>
          </div>

          {/* Crop */}
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#666', textTransform: 'uppercase', marginBottom: '14px' }}>
              {isZh ? '裁剪' : 'Crop'}
            </p>
            {!cropMode ? (
              <button onClick={() => { setCropMode(true); setCropRect(null) }}
                style={{ width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em' }}>
                {isZh ? '✂ 开始裁剪' : '✂ Start Crop'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#666' }}>
                  {isZh ? '在画布上拖动选区' : 'Drag on canvas to select'}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={applyCrop} disabled={!cropRect}
                    style={{ flex: 1, padding: '9px', background: cropRect ? '#f7f7f5' : 'rgba(255,255,255,0.1)', color: cropRect ? '#1a1a1a' : '#555', border: 'none', borderRadius: '8px', cursor: cropRect ? 'pointer' : 'not-allowed', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>
                    {isZh ? '确认裁剪' : 'Apply'}
                  </button>
                  <button onClick={() => { setCropMode(false); setCropRect(null) }}
                    style={{ flex: 1, padding: '9px', background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem' }}>
                    {isZh ? '取消' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Overlay image */}
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.2em', color: '#666', textTransform: 'uppercase', marginBottom: '14px' }}>
              {isZh ? '叠加图片' : 'Overlay Image'}
            </p>
            <button onClick={() => overlayInputRef.current?.click()}
              style={{ width: '100%', padding: '10px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em', marginBottom: '10px' }}>
              {isZh ? '+ 导入图片' : '+ Import Image'}
            </button>
            <input ref={overlayInputRef} type="file" accept="image/*" onChange={handleOverlayUpload} style={{ display: 'none' }} />
            {overlayImg && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#888' }}>{isZh ? '大小' : 'Size'}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#555' }}>{overlayScale}%</span>
                </div>
                <input type="range" min={10} max={100} value={overlayScale}
                  onChange={e => setOverlayScale(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#f7f7f5', marginBottom: '8px' }}
                />
                <button onClick={() => setOverlayImg(null)}
                  style={{ fontSize: '0.68rem', color: '#bf4a4a', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace' }}>
                  {isZh ? '移除叠加' : 'Remove'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
