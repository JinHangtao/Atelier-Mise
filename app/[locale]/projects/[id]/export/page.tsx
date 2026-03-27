'use client'
import { useState, useRef } from 'react'
import { useLocalStorage } from '../../../../../hooks/useLocalStorage'
import { Project } from '../../../../../types'
import { exportPDF, exportDOCX } from '../../../../../lib/exportProject'
import { useParams, usePathname, useRouter } from 'next/navigation'

type BlockType = 'title' | 'image' | 'note' | 'custom' | 'milestone' | 'school-profile'

interface Block {
  id: string
  type: BlockType
  content: string
  caption?: string
}

interface School {
  id: string
  name: string
  country: string
  department: string
  deadline: string
  requirements: string
  notes: string
  website: string
  aiStatement: string
  aiGeneratedAt: string
  createdAt: string
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
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

  const [blocks, setBlocks] = useState<Block[]>([])
  const [customText, setCustomText] = useState('')
  const [noteCaption, setNoteCaption] = useState('')
  const dragIndex = useRef<number | null>(null)

  if (!project) return (
    <div style={{ padding: '60px', fontFamily: 'Space Mono, monospace', color: '#888' }}>
      {isZh ? '找不到项目' : 'Project not found'}
    </div>
  )

  const addBlock = (type: BlockType, content: string, caption?: string) => {
    setBlocks(b => [...b, { id: generateId(), type, content, caption }])
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
        return `
        <div class="block school-block">
          <p class="meta">${school.country}${school.deadline ? ` · ${isZh ? '截止' : 'Deadline'}: ${school.deadline}` : ''}</p>
          <h2>${school.name}</h2>
          ${school.department ? `<p class="dept">${school.department}</p>` : ''}
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

  return (
    <main style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace' }}>
      {/* NAV */}
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          {isZh ? '← 返回' : '← Back'}
        </button>
        <span style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>
          {isZh ? '导出编辑器' : 'Export Editor'} — {project.title}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
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
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8c8c4', marginBottom: '24px' }}>
            {isZh ? '画布 — 拖动调整顺序' : 'Canvas — drag to reorder'}
          </p>

          {blocks.length === 0 && (
            <div style={{ border: '2px dashed rgba(26,26,26,0.1)', borderRadius: '16px', padding: '60px', textAlign: 'center', color: '#c8c8c4', fontSize: '0.9rem' }}>
              {isZh ? '从右侧添加内容块' : 'Add blocks from the right panel'}
            </div>
          )}

          {blocks.map((block, i) => (
            <div
              key={block.id}
              draggable
              onDragStart={() => { dragIndex.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIndex.current !== null && dragIndex.current !== i) moveBlock(dragIndex.current, i); dragIndex.current = null }}
              style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '14px', padding: '20px 24px', marginBottom: '12px', cursor: 'grab', position: 'relative' }}
            >
              <span style={{ fontSize: '0.7rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#c8c8c4', display: 'block', marginBottom: '8px' }}>
                {block.type}
              </span>

              {block.type === 'title' && (
                <div>
                  <p style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1a1a1a' }}>{project.title}</p>
                  {project.description && <p style={{ fontSize: '0.9rem', color: '#888', marginTop: '6px' }}>{project.description.slice(0, 80)}…</p>}
                </div>
              )}
              {block.type === 'image' && (
                <div>
                  <img src={block.content} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                  {block.caption && <p style={{ fontSize: '0.85rem', color: '#aaa', marginTop: '8px', fontStyle: 'italic' }}>{block.caption}</p>}
                </div>
              )}
              {block.type === 'note' && (
                <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.7 }}>{block.content}</p>
              )}
              {block.type === 'milestone' && (
                <div>
                  <p style={{ fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: '10px' }}>{isZh ? '进度节点' : 'Milestones'}</p>
                  {project.milestones.slice(0, 3).map(m => (
                    <p key={m.id} style={{ fontSize: '0.9rem', color: m.status === 'done' ? '#aaa' : '#1a1a1a', marginBottom: '4px' }}>
                      {m.status === 'done' ? '✓' : '○'} {m.title}
                    </p>
                  ))}
                  {project.milestones.length > 3 && <p style={{ fontSize: '0.8rem', color: '#c8c8c4' }}>+{project.milestones.length - 3} more</p>}
                </div>
              )}
              {block.type === 'custom' && (
                <p style={{ fontSize: '0.95rem', color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{block.content}</p>
              )}
              {block.type === 'school-profile' && (() => {
                const school = schools.find(s => s.id === block.content)
                if (!school) return <p style={{ fontSize: '0.85rem', color: '#aaa' }}>School not found</p>
                return (
                  <div>
                    <p style={{ fontSize: '0.7rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#c4a044', marginBottom: '6px' }}>{school.country}</p>
                    <p style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '3px' }}>{school.name}</p>
                    {school.department && <p style={{ fontSize: '0.88rem', color: '#888' }}>{school.department}</p>}
                    {school.deadline && <p style={{ fontSize: '0.78rem', color: '#b8b8b4', marginTop: '6px' }}>⏱ {school.deadline}</p>}
                    {school.aiStatement && (
                      <p style={{ fontSize: '0.78rem', color: '#4aab6f', marginTop: '6px' }}>✓ {isZh ? '含申请文书' : 'includes statement'}</p>
                    )}
                  </div>
                )
              })()}

              <button onClick={() => removeBlock(block.id)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(180,80,80,0.4)', fontSize: '0.85rem' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.9)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}
              >✕</button>
            </div>
          ))}
        </div>

        {/* 右侧面板 */}
        <div style={{ padding: '40px 28px', background: 'rgba(255,255,255,0.6)', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8c8c4', marginBottom: '24px' }}>
            {isZh ? '内容块' : 'Content Blocks'}
          </p>

          {/* 标题块 */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '项目信息' : 'Project Info'}</p>
            <button onClick={() => addBlock('title', '')} style={{ width: '100%', padding: '12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', textAlign: 'left', letterSpacing: '0.05em' }}>
              + {isZh ? '标题 & 描述' : 'Title & Description'}
            </button>
          </div>

          {/* Milestone块 */}
          <div style={{ marginBottom: '28px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '进度' : 'Progress'}</p>
            <button onClick={() => addBlock('milestone', '')} style={{ width: '100%', padding: '12px', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '10px', background: 'transparent', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', textAlign: 'left', letterSpacing: '0.05em' }}>
              + {isZh ? '进度节点' : 'Milestones'}
            </button>
          </div>

          {/* 院校块 */}
          {schools.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '目标院校' : 'Target Schools'}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {schools.map(s => (
                  <div key={s.id}
                    onClick={() => addBlock('school-profile', s.id)}
                    style={{ padding: '11px 14px', border: '1px solid rgba(26,26,26,0.1)', borderLeft: '3px solid rgba(196,160,68,0.5)', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', fontWeight: 600, marginBottom: '2px' }}>{s.name}</p>
                    {s.department && <p style={{ fontSize: '0.75rem', color: '#aaa' }}>{s.department}</p>}
                    {s.aiStatement && (
                      <p style={{ fontSize: '0.7rem', color: '#4aab6f', marginTop: '4px' }}>✓ {isZh ? '有申请文书' : 'has statement'}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 图片块 */}
          {(project.mediaUrls || []).length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '图片' : 'Images'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {(project.mediaUrls || []).map((url, i) => (
                  <div key={i} style={{ position: 'relative' }}>
                    <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)' }}
                      onClick={() => {
                        const cap = prompt(isZh ? '图片说明（可选）' : 'Image caption (optional)') || ''
                        addBlock('image', url, cap)
                      }}
                    />
                    <span style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.4)', color: '#fff', fontSize: '10px', padding: '2px 5px', borderRadius: '4px' }}>+</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 笔记块 */}
          {(project.notes || []).length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <p style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '10px' }}>{isZh ? '笔记' : 'Notes'}</p>
              {(project.notes || []).map(n => (
                <div key={n.id} onClick={() => addBlock('note', n.content)} style={{ padding: '10px 14px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '0.85rem', color: '#555', lineHeight: 1.6 }}
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