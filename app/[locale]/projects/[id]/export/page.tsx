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
  images?: string[]
  imageCaptions?: string[]
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

// ── Export options ────────────────────────────────────────────────────────────
interface ExportOptions {
  theme: string
  font: string
  width: number
  radius: number
  gap: number
  imageStyle: string
}

const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  theme: 'sensei',
  font: 'mixed',
  width: 800,
  radius: 16,
  gap: 20,
  imageStyle: 'cover',
}

// ── Theme definitions ─────────────────────────────────────────────────────────
interface ThemeDef {
  label: string
  labelZh: string
  bg: string
  card: string
  text: string
  muted: string
  subtle: string
  border: string
  accent: string
  accentWarm: string
  noteBorder: string
  noteBg: string
  schoolBorder: string
  infoBox: string
  statementBox: string
  blockStyle: 'card' | 'editorial' | 'bare'
}

const THEMES: Record<string, ThemeDef> = {
  sensei: {
    label: 'Sensei', labelZh: '默认暖白',
    bg: '#f4f2ee', card: '#ffffff', text: '#1a1a1a', muted: '#888887', subtle: '#c0c0bc',
    border: 'rgba(0,0,0,0.07)', accent: '#4aab6f', accentWarm: '#c4a044',
    noteBorder: '#4a8abf', noteBg: 'rgba(100,140,180,0.06)',
    schoolBorder: '#c4a044', infoBox: '#f7f7f5', statementBox: 'rgba(196,160,68,0.06)',
    blockStyle: 'card',
  },
  editorial: {
    label: 'Editorial', labelZh: '杂志版式',
    bg: '#ffffff', card: '#ffffff', text: '#1a1a1a', muted: '#666666', subtle: '#bbb',
    border: 'rgba(0,0,0,0.1)', accent: '#1a1a1a', accentWarm: '#888888',
    noteBorder: '#1a1a1a', noteBg: 'rgba(0,0,0,0.03)',
    schoolBorder: '#1a1a1a', infoBox: '#f5f5f5', statementBox: 'rgba(0,0,0,0.03)',
    blockStyle: 'editorial',
  },
  noir: {
    label: 'Noir', labelZh: '深色高对比',
    bg: '#111111', card: '#1c1c1c', text: '#f0f0ee', muted: '#888888', subtle: '#555',
    border: 'rgba(255,255,255,0.08)', accent: '#4aab6f', accentWarm: '#e8c06a',
    noteBorder: '#378ADD', noteBg: 'rgba(55,138,221,0.1)',
    schoolBorder: '#c4a044', infoBox: '#252525', statementBox: 'rgba(196,160,68,0.08)',
    blockStyle: 'card',
  },
  cream: {
    label: 'Cream', labelZh: '奶油纸质',
    bg: '#fdf8f0', card: '#fffdf7', text: '#2c2416', muted: '#9a8870', subtle: '#c8b89a',
    border: 'rgba(180,140,80,0.13)', accent: '#7a6840', accentWarm: '#c4943a',
    noteBorder: '#c4943a', noteBg: 'rgba(196,148,58,0.07)',
    schoolBorder: '#c4943a', infoBox: 'rgba(180,140,80,0.07)', statementBox: 'rgba(196,148,58,0.05)',
    blockStyle: 'card',
  },
  minimal: {
    label: 'Minimal', labelZh: '极简无框',
    bg: '#ffffff', card: '#ffffff', text: '#1a1a1a', muted: '#aaaaaa', subtle: '#ddd',
    border: 'transparent', accent: '#1a1a1a', accentWarm: '#888',
    noteBorder: 'rgba(0,0,0,0.15)', noteBg: 'transparent',
    schoolBorder: 'rgba(0,0,0,0.15)', infoBox: '#f8f8f8', statementBox: '#f5f5f5',
    blockStyle: 'bare',
  },
  blueprint: {
    label: 'Blueprint', labelZh: '深蓝技术',
    bg: '#0d1b2a', card: '#102236', text: '#d4e8ff', muted: '#6a9bbf', subtle: '#2a4a6a',
    border: 'rgba(100,180,255,0.14)', accent: '#4db8ff', accentWarm: '#64d4b8',
    noteBorder: '#4db8ff', noteBg: 'rgba(77,184,255,0.07)',
    schoolBorder: '#64d4b8', infoBox: 'rgba(100,180,255,0.07)', statementBox: 'rgba(100,212,184,0.07)',
    blockStyle: 'card',
  },
  ember: {
    label: 'Ember', labelZh: '深棕暖调',
    bg: '#1a0f0a', card: '#231510', text: '#f0e0d0', muted: '#9a7060', subtle: '#4a2a1a',
    border: 'rgba(220,120,60,0.15)', accent: '#dc783c', accentWarm: '#e8a040',
    noteBorder: '#dc783c', noteBg: 'rgba(220,120,60,0.08)',
    schoolBorder: '#e8a040', infoBox: 'rgba(220,120,60,0.07)', statementBox: 'rgba(232,160,64,0.07)',
    blockStyle: 'card',
  },
  gallery: {
    label: 'Gallery', labelZh: '画廊留白',
    bg: '#f8f8f6', card: '#ffffff', text: '#1a1a1a', muted: '#999', subtle: '#ddd',
    border: 'rgba(0,0,0,0.06)', accent: '#1a1a1a', accentWarm: '#777',
    noteBorder: '#aaa', noteBg: 'rgba(0,0,0,0.02)',
    schoolBorder: '#aaa', infoBox: '#f0f0ee', statementBox: '#eeede9',
    blockStyle: 'card',
  },
}

// ── Font definitions ──────────────────────────────────────────────────────────
interface FontDef {
  label: string
  labelZh: string
  bodyStack: string
  headingStack: string
  googleUrl: string
  h1size: string
  h1weight: string
  h1tracking: string
}

const FONTS: Record<string, FontDef> = {
  mixed: {
    label: 'Mixed', labelZh: '混排（推荐）',
    bodyStack: '"DM Sans","PingFang SC","Microsoft YaHei",sans-serif',
    headingStack: '"DM Serif Display",Georgia,serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Serif+Display:ital@0;1&display=swap',
    h1size: '40px', h1weight: '400', h1tracking: '-0.02em',
  },
  sans: {
    label: 'Sans-serif', labelZh: '无衬线',
    bodyStack: '"Inter","DM Sans","PingFang SC","Microsoft YaHei",sans-serif',
    headingStack: '"Inter","DM Sans","PingFang SC","Microsoft YaHei",sans-serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    h1size: '34px', h1weight: '700', h1tracking: '-0.025em',
  },
  serif: {
    label: 'Serif', labelZh: '衬线体',
    bodyStack: 'Georgia,"Noto Serif SC","Songti SC",serif',
    headingStack: 'Georgia,"Noto Serif SC","Songti SC",serif',
    googleUrl: '',
    h1size: '36px', h1weight: '700', h1tracking: '-0.01em',
  },
  mono: {
    label: 'Mono', labelZh: '等宽体',
    bodyStack: '"Space Mono","Courier New",monospace',
    headingStack: '"Space Mono","Courier New",monospace',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap',
    h1size: '28px', h1weight: '700', h1tracking: '-0.01em',
  },
  elegant: {
    label: 'Elegant', labelZh: '优雅衬线',
    bodyStack: '"Cormorant Garamond","PingFang SC",Georgia,serif',
    headingStack: '"Cormorant Garamond","PingFang SC",Georgia,serif',
    googleUrl: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap',
    h1size: '44px', h1weight: '600', h1tracking: '-0.01em',
  },
}

// ── CSS generator ─────────────────────────────────────────────────────────────
function buildExportCSS(opts: ExportOptions, isZh: boolean): string {
  const t = THEMES[opts.theme] || THEMES.sensei
  const f = FONTS[opts.font] || FONTS.mixed
  const r = opts.radius
  const innerR = Math.max(0, r - 6)

  const isEditorial = t.blockStyle === 'editorial'
  const isBare = t.blockStyle === 'bare'

  const blockBase = isEditorial
    ? `background:transparent; border:none; border-bottom:1px solid ${t.border}; border-radius:0; padding:40px 0;`
    : isBare
    ? `background:transparent; border:none; border-radius:0; padding:32px 0;`
    : `background:${t.card}; border-radius:${r}px; border:1px solid ${t.border}; padding:36px 40px;`

  const h1Extra = isEditorial
    ? `border-bottom:2px solid ${t.text}; padding-bottom:14px; margin-bottom:18px;`
    : ''

  return `
    @import url('${f.googleUrl}');
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    html { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    body {
      font-family:${f.bodyStack};
      background:${t.bg};
      color:${t.text};
      padding:56px 32px;
      max-width:${opts.width}px;
      margin:0 auto;
      line-height:1.75;
      font-size:16px;
    }
    .block {
      ${blockBase}
      margin-bottom:${opts.gap}px;
    }
    h1 {
      font-family:${f.headingStack};
      font-size:${f.h1size};
      font-weight:${f.h1weight};
      letter-spacing:${f.h1tracking};
      line-height:1.15;
      margin-bottom:10px;
      ${h1Extra}
    }
    h2 {
      font-family:${f.headingStack};
      font-size:clamp(20px,2.2vw,26px);
      font-weight:600;
      letter-spacing:-0.01em;
      margin-bottom:6px;
      margin-top:4px;
    }
    h3 {
      font-size:11px;
      font-weight:600;
      margin-bottom:16px;
      text-transform:uppercase;
      letter-spacing:0.2em;
      color:${t.muted};
    }
    .meta {
      color:${t.muted};
      font-size:12px;
      letter-spacing:0.12em;
      text-transform:uppercase;
      margin-bottom:14px;
      font-weight:500;
    }
    .desc {
      color:${t.muted};
      line-height:1.85;
      margin-top:16px;
      font-size:15px;
    }
    .caption {
      color:${t.subtle};
      font-size:12px;
      margin-top:10px;
      font-style:italic;
      text-align:center;
      line-height:1.5;
    }
    img {
      display:block;
      width:100%;
      border-radius:${innerR}px;
    }
    .img-cover { aspect-ratio:16/9; object-fit:cover; }
    .img-contain { object-fit:contain; max-height:520px; }
    .img-square { aspect-ratio:1; object-fit:cover; }
    .note-block {
      border-left:3px solid ${t.noteBorder} !important;
      background:${t.noteBg} !important;
      ${isBare || isEditorial ? 'border-radius:0 !important;' : `border-radius:0 ${r}px ${r}px 0 !important;`}
    }
    .note-block p { font-size:15px; line-height:1.85; }
    .school-block {
      border-left:3px solid ${t.schoolBorder} !important;
      ${isBare || isEditorial ? 'border-radius:0 !important;' : `border-radius:0 ${r}px ${r}px 0 !important;`}
    }
    .dept { color:${t.muted}; margin-top:8px; font-size:15px; line-height:1.65; }
    .info-box {
      margin-top:18px;
      padding:16px 20px;
      background:${t.infoBox};
      border-radius:${innerR}px;
    }
    .statement-box { background:${t.statementBox}; }
    .box-label {
      font-size:10px;
      letter-spacing:0.2em;
      text-transform:uppercase;
      color:${t.muted};
      margin-bottom:8px;
      font-weight:600;
    }
    .info-box p:last-child { font-size:14px; color:${t.text}; line-height:1.85; white-space:pre-wrap; }
    .ms-row { display:flex; align-items:baseline; gap:14px; margin-bottom:10px; font-size:15px; }
    .done { color:${t.accent}; }
    .pending { color:${t.subtle}; }
    .ms-done { color:${t.muted}; text-decoration:line-through; }
    .date { color:${t.subtle}; font-size:12px; margin-left:auto; }
    .img-grid { display:grid; gap:10px; }
    .img-caption { font-size:12px; color:${t.muted}; text-align:center; margin-top:6px; font-style:italic; line-height:1.4; }
    @media (max-width:600px) {
      body { padding:32px 18px; }
      .block { padding:${isEditorial ? '32px 0' : '24px 20px'}; }
      h1 { font-size:clamp(24px,6vw,${f.h1size}); }
      .img-grid { grid-template-columns:1fr !important; }
    }
    @media print {
      body { background:#fff; padding:20px; max-width:none; }
      .block { break-inside:avoid; }
    }
  `.trim()
}

// ── HTML block renderer ───────────────────────────────────────────────────────
function buildBlocksHTML(
  blocks: Block[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
): string {
  const imgClass = opts.imageStyle === 'cover' ? 'img-cover'
    : opts.imageStyle === 'contain' ? 'img-contain'
    : 'img-square'

  return blocks.map(b => {
    if (b.type === 'title') {
      return `<div class="block">
  <p class="meta">${[project.category, project.status].filter(Boolean).join(' · ')}</p>
  <h1>${project.title}</h1>
  ${project.description ? `<p class="desc">${project.description}</p>` : ''}
</div>`
    }

    if (b.type === 'image') {
      return `<div class="block" style="padding:0;overflow:hidden;border-radius:inherit">
  <img src="${b.content}" class="${imgClass}" style="width:100%;display:block;" alt="${b.caption || ''}" />
  ${b.caption ? `<p class="caption" style="padding:10px 16px 14px">${b.caption}</p>` : ''}
</div>`
    }

    if (b.type === 'image-row') {
      const imgs = b.images || []
      const cols = Math.min(imgs.length, 4)
      return `<div class="block" style="padding:0;overflow:hidden;border-radius:inherit">
  <div class="img-grid" style="grid-template-columns:repeat(${cols},1fr)">
    ${imgs.map((url, idx) => `<div>
      <img src="${url}" class="img-square" style="width:100%;display:block;" alt="${(b.imageCaptions || [])[idx] || ''}" />
      ${(b.imageCaptions || [])[idx] ? `<p class="img-caption">${(b.imageCaptions || [])[idx]}</p>` : ''}
    </div>`).join('\n    ')}
  </div>
  ${b.caption ? `<p class="caption" style="padding:10px 16px 14px">${b.caption}</p>` : ''}
</div>`
    }

    if (b.type === 'note') {
      return `<div class="block note-block">
  <p>${b.content}</p>
  ${b.caption ? `<p class="caption" style="text-align:left;margin-top:12px">${b.caption}</p>` : ''}
</div>`
    }

    if (b.type === 'milestone') {
      return `<div class="block">
  <h3>${isZh ? '进度节点' : 'Milestones'}</h3>
  ${project.milestones.map(m => `  <div class="ms-row">
    <span class="${m.status === 'done' ? 'done' : 'pending'}">${m.status === 'done' ? '✓' : '○'}</span>
    <span class="${m.status === 'done' ? 'ms-done' : ''}">${m.title}</span>
    ${m.date ? `<span class="date">${m.date}</span>` : ''}
  </div>`).join('\n')}
</div>`
    }

    if (b.type === 'custom') {
      return `<div class="block">
  <p style="white-space:pre-wrap;line-height:1.85;font-size:15px">${b.content}</p>
</div>`
    }

    if (b.type === 'school-profile') {
      const school = schools.find(s => s.id === b.content)
      if (!school) return ''
      const displayName = isZh ? (school.nameZh || school.name) : school.name
      const displayDept = isZh ? (school.departmentZh || school.department) : school.department
      return `<div class="block school-block">
  <p class="meta">${school.country}${school.deadline ? ` · ${isZh ? '截止' : 'Deadline'}: ${school.deadline}` : ''}</p>
  <h2>${displayName}</h2>
  ${displayDept ? `<p class="dept">${displayDept}</p>` : ''}
  ${school.requirements ? `<div class="info-box">
    <p class="box-label">${isZh ? '申请要求' : 'Requirements'}</p>
    <p>${school.requirements}</p>
  </div>` : ''}
  ${school.aiStatement ? `<div class="info-box statement-box">
    <p class="box-label">${isZh ? 'AI 申请文书' : 'Application Statement'}</p>
    <p>${school.aiStatement}</p>
  </div>` : ''}
</div>`
    }

    return ''
  }).filter(Boolean).join('\n\n')
}

// ── Full HTML assembler ───────────────────────────────────────────────────────
function buildExportHTML(
  blocks: Block[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
): string {
  const css = buildExportCSS(opts, isZh)
  const blocksHTML = buildBlocksHTML(blocks, project, schools, opts, isZh)
  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.title}</title>
  <style>${css}</style>
</head>
<body>
${blocksHTML}
</body>
</html>`
}

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
  if (!visible) return null
  return (
    <div className="draft-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(74,171,111,0.08)', border: '1px solid rgba(74,171,111,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#4aab6f', fontSize: '0.8rem' }}>●</span>
        <span style={{ fontSize: '0.8rem', color: '#3a8a58', letterSpacing: '0.04em' }}>
          {isZh ? `已恢复上次草稿（${blocks.length} 个块）` : `Draft restored — ${blocks.length} block${blocks.length !== 1 ? 's' : ''}`}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={onClear} style={{ fontSize: '0.72rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>{isZh ? '清空重来' : 'Start fresh'}</button>
        <button onClick={() => setVisible(false)} style={{ fontSize: '0.72rem', color: '#4aab6f', background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}>{isZh ? '继续编辑 →' : 'Keep editing →'}</button>
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

  const [projects] = useLocalStorage<Project[]>('ps-projects', [])
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
  const dragIndex = useRef<number | null>(null)
  const imageDragIndex = useRef<number | null>(null)

  if (!project) return (
    <div style={{ padding: '60px', fontFamily: 'Space Mono, monospace', color: '#888' }}>
      {isZh ? '找不到项目' : 'Project not found'}
    </div>
  )

  const addBlock = (type: BlockType, content: string, caption?: string, images?: string[]) => {
    setBlocks(b => [...b, { id: generateId(), type, content, caption, images }])
  }
  const removeBlock = (blockId: string) => setBlocks(b => b.filter(x => x.id !== blockId))
  const moveBlock = (from: number, to: number) => {
    setBlocks(b => { const arr = [...b]; const [item] = arr.splice(from, 1); arr.splice(to, 0, item); return arr })
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
    const html = buildExportHTML(blocks, project, schools, exportOpts, isZh)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.title.replace(/\s+/g, '_')}_${exportOpts.theme}.html`
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
      `}</style>

      {/* NAV */}
      <nav style={{ padding: '20px 40px', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.9)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '0.9rem', letterSpacing: '0.1em' }}>
          {isZh ? '← 返回' : '← Back'}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>
            {isZh ? '导出编辑器' : 'Export Editor'} — {project.title}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', height: '16px' }}>
            {saveStatus === 'saving' && <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e8c06a', display: 'inline-block', animation: 'pulse 0.8s ease-in-out infinite' }} /><span style={{ fontSize: '0.68rem', color: '#c8a84a', letterSpacing: '0.08em' }}>{isZh ? '保存中…' : 'Saving…'}</span></>}
            {saveStatus === 'saved' && <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4aab6f', display: 'inline-block' }} /><span style={{ fontSize: '0.68rem', color: '#4aab6f', letterSpacing: '0.08em' }}>{isZh ? '已自动保存' : 'Draft saved'}</span></>}
            {saveStatus === 'error' && <><span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e05c5c', display: 'inline-block' }} /><span style={{ fontSize: '0.68rem', color: '#e05c5c', letterSpacing: '0.08em' }}>{isZh ? '保存失败' : 'Save failed'}</span></>}
            {saveStatus === 'idle' && blocks.length > 0 && <span style={{ fontSize: '0.68rem', color: '#c8c8c4', letterSpacing: '0.08em' }}>{isZh ? `${blocks.length} 个块` : `${blocks.length} block${blocks.length !== 1 ? 's' : ''}`}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={undo} disabled={undoStack.current.length === 0} title={isZh ? '撤销 (⌘Z)' : 'Undo (⌘Z)'}
            style={{ background: 'transparent', border: '1px solid rgba(26,26,26,0.12)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.85rem', cursor: undoStack.current.length === 0 ? 'not-allowed' : 'pointer', color: undoStack.current.length === 0 ? '#ccc' : '#888' }}>↩</button>
          {blocks.length > 0 && (
            <button onClick={() => { if (window.confirm(isZh ? '清空当前画布？此操作不可撤销。' : 'Clear the canvas? This cannot be undone.')) clearDraft() }}
              style={{ background: 'transparent', border: '1px solid rgba(180,80,80,0.2)', padding: '10px 14px', borderRadius: '10px', fontSize: '0.78rem', cursor: 'pointer', color: 'rgba(180,80,80,0.5)', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.5)'; e.currentTarget.style.color = 'rgba(180,80,80,0.9)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(180,80,80,0.2)'; e.currentTarget.style.color = 'rgba(180,80,80,0.5)' }}>
              {isZh ? '清空' : 'Clear'}
            </button>
          )}
          {/* HTML export — prominent */}
          <button onClick={doExportHTML}
            style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '10px 18px', borderRadius: '10px', fontSize: '0.82rem', letterSpacing: '0.08em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{isZh ? '导出' : 'Export'}</span>
            <span style={{ fontSize: '0.68rem', background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.04em' }}>HTML</span>
          </button>
          <button onClick={() => exportPDF(project, blocks)} style={{ background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.15)', padding: '10px 16px', borderRadius: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>PDF</button>
          <button onClick={() => exportDOCX(project)} style={{ background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.15)', padding: '10px 16px', borderRadius: '10px', fontSize: '0.82rem', cursor: 'pointer' }}>Word</button>
        </div>
      </nav>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '0', minHeight: 'calc(100vh - 65px)' }}>

        {/* ── 画布 ── */}
        <div style={{ padding: '40px', borderRight: '1px solid rgba(26,26,26,0.08)' }}>
          {justRestored && <DraftBanner blocks={blocks} isZh={isZh} onClear={clearDraft} />}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8c8c4' }}>
              {isZh ? '画布 — 拖动调整顺序' : 'Canvas — drag to reorder'}
            </p>
            {blocks.length > 0 && (
              <button onClick={undo} disabled={undoStack.current.length === 0}
                style={{ fontSize: '0.68rem', color: undoStack.current.length > 0 ? '#aaa' : '#ddd', background: 'none', border: 'none', cursor: undoStack.current.length > 0 ? 'pointer' : 'default', letterSpacing: '0.08em' }}>
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
            <div key={block.id} className="block-card"
              draggable={editingBlockId !== block.id}
              onDragStart={() => { dragIndex.current = i }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragIndex.current !== null && dragIndex.current !== i) moveBlock(dragIndex.current, i); dragIndex.current = null }}
              style={{ background: '#fff', border: `1px solid ${editingBlockId === block.id ? '#1a1a1a' : 'rgba(26,26,26,0.08)'}`, borderRadius: '14px', padding: '20px 24px', marginBottom: '12px', cursor: editingBlockId === block.id ? 'default' : 'grab', position: 'relative' }}
            >
              <span style={{ fontSize: '0.62rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#d0d0cc', display: 'block', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                {block.type === 'image-row' ? (isZh ? '图片行' : 'Image Row') :
                 block.type === 'school-profile' ? (isZh ? '院校' : 'School') :
                 block.type === 'milestone' ? (isZh ? '进度' : 'Milestone') :
                 block.type === 'custom' ? (isZh ? '自定义' : 'Custom') :
                 block.type === 'note' ? (isZh ? '笔记' : 'Note') :
                 block.type === 'title' ? (isZh ? '标题' : 'Title') :
                 block.type === 'image' ? (isZh ? '图片' : 'Image') : block.type}
              </span>

              {editingBlockId === block.id ? (
                <div>
                  {(block.type === 'custom' || block.type === 'note') && (
                    <textarea autoFocus value={editingContent} onChange={e => setEditingContent(e.target.value)} rows={5}
                      style={{ width: '100%', padding: '10px 14px', border: '1px solid rgba(26,26,26,0.15)', borderRadius: '10px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.95rem', color: '#1a1a1a', outline: 'none', resize: 'vertical', background: '#f7f7f5', marginBottom: '10px' }} />
                  )}
                  {block.type === 'image' && (
                    <img src={block.content} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' }} />
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
                            style={{ cursor: 'grab' }}>
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '6px', display: 'block', pointerEvents: 'none' }} />
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
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: '#888', outline: 'none', background: '#f7f7f5' }} />
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button onClick={saveEdit} style={{ padding: '8px 18px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.08em', cursor: 'pointer' }}>{isZh ? '保存' : 'Save'}</button>
                    <button onClick={cancelEdit} style={{ padding: '8px 18px', background: 'transparent', color: '#888', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', cursor: 'pointer' }}>{isZh ? '取消' : 'Cancel'}</button>
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
                      <img src={block.content} alt="" style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }} />
                      {block.caption && <p style={{ fontSize: '0.78rem', color: '#bbb', marginTop: '7px', fontStyle: 'italic', fontFamily: 'Inter, DM Sans, sans-serif' }}>{block.caption}</p>}
                    </div>
                  )}
                  {block.type === 'image-row' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${(block.images || []).length}, 1fr)`, gap: '6px' }}>
                        {(block.images || []).map((url, idx) => (
                          <div key={idx}>
                            <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', display: 'block' }} />
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

              {editingBlockId !== block.id && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '6px' }}>
                  {['custom', 'note', 'image', 'image-row'].includes(block.type) && (
                    <button className="edit-btn" onClick={() => startEdit(block)}
                      style={{ background: 'rgba(26,26,26,0.06)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', color: '#888', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title={isZh ? '编辑' : 'Edit'}>✎</button>
                  )}
                  <button onClick={() => removeBlock(block.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(180,80,80,0.4)', fontSize: '0.85rem', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.9)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(180,80,80,0.4)')}>✕</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── 右侧面板 ── */}
        <div style={{ background: '#fff', overflowY: 'auto', borderLeft: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column' }}
          onDragOver={e => e.stopPropagation()} onDrop={e => e.stopPropagation()}>

          {/* Tab switcher */}
          <div style={{ padding: '16px 16px 0', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderBottom: '1px solid rgba(26,26,26,0.06)', paddingBottom: '12px' }}>
            <div style={{ display: 'flex', background: 'rgba(26,26,26,0.05)', borderRadius: '9px', padding: '3px', gap: '2px' }}>
              <button style={tabStyle(rightTab === 'blocks')} onClick={() => setRightTab('blocks')}>
                {isZh ? '内容块' : 'Blocks'}
              </button>
              <button style={tabStyle(rightTab === 'style')} onClick={() => setRightTab('style')}>
                {isZh ? '样式设计' : 'Style'}
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

              {/* 图片 */}
              {mediaUrls.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                      {isZh ? '图片' : 'Images'} <span style={{ color: '#d0d0cc' }}>({mediaUrls.length})</span>
                    </p>
                    <button onClick={() => { setImagePickerOpen(o => !o); setSelectedImages([]) }}
                      style={{ fontSize: '0.68rem', color: imagePickerOpen ? '#1a1a1a' : '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.06em' }}>
                      {imagePickerOpen ? (isZh ? '取消' : 'Cancel') : (isZh ? '多选并排' : 'Multi-pick')}
                    </button>
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
                      {mediaUrls.map((url, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                          <img src={url} alt="" className="img-thumb" onClick={() => addBlock('image', url)}
                            style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '7px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.08)', display: 'block' }} />
                          <span style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', width: '18px', height: '18px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>+</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

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

              {/* Export summary + button */}
              <div style={{ marginTop: '24px', padding: '14px 16px', background: 'rgba(26,26,26,0.04)', borderRadius: '10px' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '8px' }}>
                  {isZh ? '当前配置' : 'Current config'}
                </p>
                <p style={{ fontSize: '0.75rem', color: '#777', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.6 }}>
                  {THEMES[exportOpts.theme]?.label} · {FONTS[exportOpts.font]?.label} · {exportOpts.width}px · R{exportOpts.radius}
                </p>
                <button onClick={doExportHTML}
                  style={{ width: '100%', marginTop: '12px', padding: '11px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '9px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', letterSpacing: '0.08em', cursor: 'pointer' }}>
                  {isZh ? '导出此主题 HTML' : 'Export HTML with this style'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}