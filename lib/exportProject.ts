import { Project } from '../types'

// ── PDF ──
export async function exportPDF(project: Project, blocks?: {type: string, content: string, caption?: string}[]) {
  const win = window.open('', '_blank')
  if (!win) return

  if (blocks && blocks.length > 0) {
  const blocksHTML = blocks.map(b => {
      if (b.type === 'title') return `<div class="block"><p class="meta">${project.category} · ${project.status}</p><h1>${project.title}</h1>${project.description ? `<p class="desc">${project.description}</p>` : ''}</div>`
      if (b.type === 'image') return `<div class="block"><img src="${b.content}" style="width:100%;border-radius:8px;" />${b.caption ? `<p class="caption">${b.caption}</p>` : ''}</div>`
      if (b.type === 'note') return `<div class="block"><div class="note-block">${b.content}</div>${b.caption ? `<p class="caption">${b.caption}</p>` : ''}</div>`
      if (b.type === 'milestone') return `<div class="block"><p class="ms-label">Milestones</p>${project.milestones.map(m => `<div class="ms-row"><span class="ms-dot ${m.status === 'done' ? 'done' : 'pending'}">${m.status === 'done' ? '✓' : ''}</span><span style="flex:1;font-size:14px;color:${m.status === 'done' ? '#aaa' : '#1a1a1a'};text-decoration:${m.status === 'done' ? 'line-through' : 'none'}">${m.title}</span>${m.date ? `<span style="font-family:'Courier New',monospace;font-size:11px;color:#ccc">${m.date}</span>` : ''}</div>`).join('')}</div>`
      if (b.type === 'custom') return `<div class="block"><p style="white-space:pre-wrap;font-size:14px;color:#444;line-height:1.7">${b.content}</p></div>`
      return ''
    }).join('')

   win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${project.title}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Georgia',serif; color:#1a1a1a; padding:56px 64px; font-size:14px; line-height:1.7; max-width:800px; margin:0 auto; }
      .block { margin-bottom:16px; padding:24px 28px; background:#fff; border-radius:16px; border:1px solid rgba(0,0,0,0.07); }
      .meta { font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:#999; margin:0 0 10px; }
      h1 { font-size:36px; font-weight:700; letter-spacing:-0.02em; margin:0 0 10px; }
      .desc { font-size:15px; color:#555; margin:0; }
      .note-block { border-left:3px solid #4a8abf; padding:14px 18px; background:rgba(100,140,180,0.06); border-radius:0 8px 8px 0; }
      .caption { font-family:'Courier New',monospace; font-size:11px; color:#bbb; margin-top:8px; font-style:italic; }
      .ms-row { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
      .ms-dot { width:16px; height:16px; border-radius:50%; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; font-size:9px; }
      .ms-dot.done { background:#4aab6f; color:white; }
      .ms-dot.pending { background:white; border:1.5px solid #ccc; }
      .ms-label { font-family:'Courier New',monospace; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#aaa; margin:0 0 14px; }
      .footer { margin-top:48px; padding-top:16px; border-top:0.5px solid #e8e8e6; display:flex; justify-content:space-between; }
      .footer span { font-family:'Courier New',monospace; font-size:10px; color:#ccc; letter-spacing:0.15em; }
      @media print { body { padding:40px 48px; } }
    </style></head><body>
    ${blocksHTML}
    <div class="footer"><span>PORTFOLIO_SENSEI</span><span>${new Date().toLocaleDateString('zh-CN').replace(/\//g, ' / ')}</span></div>
    <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`)
    win.document.close()
    return
  }
win.document.write(`
    <!DOCTYPE html><html><head><meta charset="UTF-8"><title>${project.title}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Georgia',serif; color:#1a1a1a; padding:56px 64px; font-size:14px; line-height:1.7; max-width:800px; margin:0 auto; }
      .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; padding-bottom:24px; border-bottom:1.5px solid #1a1a1a; }
      .header h1 { font-size:36px; font-weight:700; letter-spacing:-0.02em; margin:0 0 10px; }
      .meta { font-family:'Courier New',monospace; font-size:11px; letter-spacing:0.25em; text-transform:uppercase; color:#999; margin:0 0 10px; }
      .desc { font-size:15px; color:#555; margin:0; }
      .brand { font-family:'Courier New',monospace; font-size:10px; color:#bbb; letter-spacing:0.1em; line-height:1.8; text-align:right; flex-shrink:0; margin-left:32px; }
      .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:36px; }
      .info-card { background:#f7f7f5; border-radius:8px; padding:14px 16px; }
      .info-label { font-family:'Courier New',monospace; font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:#aaa; margin:0 0 4px; }
      .info-value { font-size:14px; color:#1a1a1a; margin:0; }
      .section { margin-bottom:32px; }
      .section-title { font-family:'Courier New',monospace; font-size:10px; letter-spacing:0.25em; text-transform:uppercase; color:#aaa; margin:0 0 16px; padding-bottom:8px; border-bottom:0.5px solid #e0e0de; }
      .ms-row { display:flex; align-items:center; gap:14px; margin-bottom:10px; }
      .ms-dot { width:16px; height:16px; border-radius:50%; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; font-size:9px; }
      .ms-dot.done { background:#4aab6f; color:white; }
      .ms-dot.pending { background:white; border:1.5px solid #ccc; }
      .ms-title { flex:1; font-size:14px; }
      .ms-date { font-family:'Courier New',monospace; font-size:11px; color:#ccc; }
      .ms-note { font-size:12px; color:#aaa; margin-top:2px; padding-left:30px; }
      .proposal-row { display:flex; gap:14px; margin-bottom:10px; }
      .proposal-num { font-family:'Courier New',monospace; font-size:11px; color:#ccc; flex-shrink:0; margin-top:2px; }
      .proposal-text { font-size:14px; color:#444; line-height:1.7; margin:0; }
      .footer { margin-top:48px; padding-top:16px; border-top:0.5px solid #e8e8e6; display:flex; justify-content:space-between; }
      .footer span { font-family:'Courier New',monospace; font-size:10px; color:#ccc; letter-spacing:0.15em; }
      @media print { body { padding:40px 48px; } }
    </style></head><body>

    <div class="header">
      <div>
        <p class="meta">${project.category} · ${project.status}</p>
        <h1>${project.title}</h1>
        ${project.description ? `<p class="desc">${project.description}</p>` : ''}
      </div>
      <div class="brand">
        <div>PORTFOLIO_SENSEI</div>
        <div>${new Date().toLocaleDateString('zh-CN').replace(/\//g, ' / ')}</div>
      </div>
    </div>

    ${(project.school || project.medium || project.startDate || project.tags.length > 0) ? `
    <div class="info-grid">
      ${project.school ? `<div class="info-card"><p class="info-label">School</p><p class="info-value">${project.school}</p></div>` : ''}
      ${project.medium ? `<div class="info-card"><p class="info-label">Medium</p><p class="info-value">${project.medium}</p></div>` : ''}
      ${project.startDate ? `<div class="info-card"><p class="info-label">Period</p><p class="info-value">${project.startDate}${project.endDate ? ' → ' + project.endDate : ''}</p></div>` : ''}
      ${project.tags.length > 0 ? `<div class="info-card"><p class="info-label">Tags</p><p class="info-value">${project.tags.join(', ')}</p></div>` : ''}
    </div>` : ''}

    ${project.milestones.length > 0 ? `
    <div class="section">
      <p class="section-title">Milestones</p>
      ${project.milestones.map(m => `
        <div class="ms-row">
          <span class="ms-dot ${m.status === 'done' ? 'done' : 'pending'}">${m.status === 'done' ? '✓' : ''}</span>
          <span class="ms-title" style="color:${m.status === 'done' ? '#aaa' : '#1a1a1a'};text-decoration:${m.status === 'done' ? 'line-through' : 'none'}">${m.title}</span>
          ${m.date ? `<span class="ms-date">${m.date}</span>` : ''}
        </div>
        ${m.note ? `<div class="ms-note">${m.note}</div>` : ''}
      `).join('')}
    </div>` : ''}

    ${project.proposals.length > 0 ? `
    <div class="section">
      <p class="section-title">Proposals & Ideas</p>
      ${project.proposals.map((p, i) => `
        <div class="proposal-row">
          <span class="proposal-num">${String(i + 1).padStart(2, '0')}</span>
          <p class="proposal-text">${p.content}</p>
        </div>
      `).join('')}
    </div>` : ''}

    <div class="footer">
      <span>PORTFOLIO_SENSEI</span>
      <span>1 / 1</span>
    </div>

    <script>window.onload=()=>{window.print();window.close();}<\/script>
    </body></html>
  `)
  win.document.close()
}

// ── WORD (docx) ──
export async function exportDOCX(project: Project, blocks?: {type: string, content: string, caption?: string}[]) {
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } = await import('docx')
  const { saveAs } = await import('file-saver')

  const para = (text: string, opts?: { bold?: boolean; size?: number; color?: string; heading?: typeof HeadingLevel[keyof typeof HeadingLevel] }) =>
    new Paragraph({
      heading: opts?.heading,
      children: [new TextRun({
        text,
        bold: opts?.bold,
        size: opts?.size ?? 22,
        color: opts?.color?.replace('#', '') ?? '1a1a1a',
      })],
    })

  const divider = () => new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: 'DCDCDA' } },
    children: [],
  })

  const children = [
    // 标题
    para(project.title, { bold: true, size: 48, heading: HeadingLevel.HEADING_1 }),
    para(`${project.category.toUpperCase()}  ·  ${project.status.toUpperCase()}`, { size: 18, color: '#888884' }),
    new Paragraph({ children: [] }),
    divider(),

    // 基本信息
    ...(project.school    ? [para(`School: ${project.school}`, { size: 20 })] : []),
    ...(project.medium    ? [para(`Medium: ${project.medium}`, { size: 20 })] : []),
    ...(project.startDate ? [para(`Period: ${project.startDate}${project.endDate ? ' → ' + project.endDate : ''}`, { size: 20 })] : []),
    ...(project.tags.length > 0 ? [para(`Tags: ${project.tags.join(', ')}`, { size: 20 })] : []),
    new Paragraph({ children: [] }),
  ]

  // 描述
  if (project.description) {
    children.push(divider(), para('Description', { bold: true, size: 24 }))
    children.push(para(project.description, { size: 20, color: '#444440' }))
    children.push(new Paragraph({ children: [] }))
  }

  // Milestones
  if (project.milestones.length > 0) {
    children.push(divider(), para('Milestones', { bold: true, size: 24 }))
    project.milestones.forEach(m => {
      const check = m.status === 'done' ? '✓' : '○'
      children.push(para(`${check}  ${m.title}${m.date ? '  —  ' + m.date : ''}`, {
        size: 20,
        color: m.status === 'done' ? '#888884' : '#1a1a1a',
      }))
      if (m.note) children.push(para(`      ${m.note}`, { size: 18, color: '#aaaaaa' }))
    })
    children.push(new Paragraph({ children: [] }))
  }

  // Proposals
  if (project.proposals.length > 0) {
    children.push(divider(), para('Proposals & Ideas', { bold: true, size: 24 }))
    project.proposals.forEach((p, i) => {
      children.push(para(`${i + 1}.  ${p.content}`, { size: 20 }))
      children.push(new Paragraph({ children: [] }))
    })
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${project.title.replace(/\s+/g, '_')}.docx`)
}