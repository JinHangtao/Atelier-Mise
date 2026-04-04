import { Project } from '../types'
// ── Types ─────────────────────────────────────────────────────────────────────
export type BlockType = 'title' | 'image' | 'image-row' | 'note' | 'custom' | 'milestone' | 'school-profile' | 'table' | 'sticky'
export interface Block {
  id: string
  type: BlockType
  content: string
  caption?: string
  images?: string[]
  imageCaptions?: string[]
  pixelPos?: { x: number; y: number; w: number; h: number }
  hidden?: boolean
  fontSize?: number
  fontFamily?: string
  color?: string
  imgFit?: 'cover' | 'contain'
  imgRadius?: number
  imgShadow?: number
  imgBlur?: number
  imgOffsetX?: number
  imgOffsetY?: number
  imgScale?: number
  imgClipRange?: [[number, number], [number, number]]
  tableData?: import('./TableBlock').TableData
  // sticky note 专用
  stickyColor?: string   // 背景色，如 '#fef08a'
  stickyW?: number       // 宽度 px，默认 200
  stickyH?: number       // 高度 px，默认 200
  stickyShadow?: number  // 阴影强度 0-40，默认 12
}
export interface School {
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
export interface ExportOptions {
  theme: string
  font: string
  width: number
  radius: number
  gap: number
  imageStyle: string
}
export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  theme: 'sensei',
  font: 'mixed',
  width: 800,
  radius: 16,
  gap: 20,
  imageStyle: 'cover',
}
// ── Theme definitions ─────────────────────────────────────────────────────────
export interface ThemeDef {
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
export const THEMES: Record<string, ThemeDef> = {
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
export interface FontDef {
  label: string
  labelZh: string
  bodyStack: string
  headingStack: string
  googleUrl: string
  h1size: string
  h1weight: string
  h1tracking: string
}
export const FONTS: Record<string, FontDef> = {
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
export function buildExportCSS(opts: ExportOptions, isZh: boolean): string {
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
 .page-break { break-after:page; height:0; overflow:hidden; }
 @media (max-width:600px) {
 body { padding:32px 18px; }
 .block { padding:${isEditorial ? '32px 0' : '24px 20px'}; }
 h1 { font-size:clamp(24px,6vw,${f.h1size}); }
 .img-grid { grid-template-columns:1fr !important; }
 }
 @media print {
 body { background:${t.bg}; padding:20px; max-width:none; }
 .block { break-inside:avoid; }
 .page-break { break-after:page; }
 }
 `.trim()
}
// ── Single block HTML ────────────────────────────────────────────────────────
export function renderBlockHTML(
  b: Block,
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
): string {
  const imgClass = opts.imageStyle === 'cover'
    ? 'img-cover'
    : opts.imageStyle === 'contain' ? 'img-contain'
      : 'img-square'
  if (b.type === 'title') {
    const safeFont = b.fontFamily ? b.fontFamily.replace(/"/g, "'") : ''
    const styles = [b.fontSize && `font-size:${b.fontSize}px`, safeFont && `font-family:${safeFont}`, b.color && `color:${b.color}`].filter(Boolean).join(';')
    return `<div class="block">
 <p class="meta">${[project.category, project.status].filter(Boolean).join(' · ')}</p>
 <h1${styles ? ` style="${styles}"` : ''}>${project.title}</h1>
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
 </div>`).join('\n ')}
 </div>
 ${b.caption ? `<p class="caption" style="padding:10px 16px 14px">${b.caption}</p>` : ''}
</div>`
  }

  if (b.type === 'sticky') {
    const bg = b.stickyColor || '#fef08a'
    const shadow = (b as any).stickyShadow ?? 12
    const fs = b.fontSize || 15
    const safeFont = b.fontFamily ? b.fontFamily.replace(/"/g, "'") : 'Inter, DM Sans, sans-serif'
    const textColor = b.color || '#1a1a1a'
    const spread = (b as any).stickySpread ?? 0
    const shadowCss = shadow > 0 || spread > 0
      ? `${Math.round(shadow * 0.5)}px ${shadow}px ${shadow * 3}px ${spread}px rgba(0,0,0,${Math.min(0.6, 0.1 + shadow * 0.012).toFixed(2)})`
      : 'none'
    return `<div class="block" style="background:${bg};border-radius:4px;padding:18px 20px;box-shadow:${shadowCss};min-height:${b.stickyH || 200}px;width:${b.stickyW || 200}px;box-sizing:border-box;display:flex;align-items:flex-start;position:relative;">
 <div style="position:absolute;top:0;left:0;right:0;height:4px;background:rgba(0,0,0,0.08);border-radius:4px 4px 0 0;"></div>
 <p style="font-size:${fs}px;font-family:${safeFont};color:${textColor};white-space:pre-wrap;line-height:1.6;margin:6px 0 0;word-break:break-word;">${b.content || ''}</p>
</div>`
  }

  if (b.type === 'note') {
    const safeFont = b.fontFamily ? b.fontFamily.replace(/"/g, "'") : ''
    const styles = [b.fontSize && `font-size:${b.fontSize}px`, safeFont && `font-family:${safeFont}`, b.color && `color:${b.color}`].filter(Boolean).join(';')
    return `<div class="block note-block">
 <p${styles ? ` style="${styles}"` : ''}>${b.content}</p>
 ${b.caption ? `<p class="caption" style="text-align:left;margin-top:12px">${b.caption}</p>` : ''}
</div>`
  }

  if (b.type === 'milestone') {
    return `<div class="block">
 <h3>${isZh ? '进度节点' : 'Milestones'}</h3>
 ${project.milestones.map(m => ` <div class="ms-row">
 <span class="${m.status === 'done' ? 'done' : 'pending'}">${m.status === 'done' ? '✓' : '○'}</span>
 <span class="${m.status === 'done' ? 'ms-done' : ''}">${m.title}</span>
 ${m.date ? `<span class="date">${m.date}</span>` : ''}
 </div>`).join('\n')}
</div>`
  }

  if (b.type === 'custom') {
    const fs = b.fontSize || 15
    const safeFont = b.fontFamily ? b.fontFamily.replace(/"/g, "'") : ''
    const styles = [`white-space:pre-wrap`, `line-height:1.85`, `font-size:${fs}px`, safeFont && `font-family:${safeFont}`, b.color && `color:${b.color}`].filter(Boolean).join(';')
    return `<div class="block">
 <p style="${styles}">${b.content}</p>
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
}
// ── HTML block renderer ───────────────────────────────────────────────────────
// forceLinear=true → 导出 PDF/HTML 时忽略 pixelPos，走线性排版
// forceLinear=false（默认）→ 保留原有画布 absolute 定位预览模式
export function buildBlocksHTML(
  blocks: Block[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
  forceLinear = false,
): string {
  const hasPixel = !forceLinear && blocks.every(b => b.pixelPos)

  if (!hasPixel) {
    // 线性输出（导出 HTML / PDF 强制走这里）
    return blocks
      .filter(b => !b.hidden) // ← 已添加
      .map(b => renderBlockHTML(b, project, schools, opts, isZh))
      .filter(Boolean)
      .join('\n\n')
  }

  // ── pixelPos 模式：所见即所得，absolute 定位（仅用于画布预览）──
  const canvasH = blocks.reduce((max, b) => Math.max(max, (b.pixelPos!.y + b.pixelPos!.h)), 0)
  const canvasW = blocks.reduce((max, b) => Math.max(max, (b.pixelPos!.x + b.pixelPos!.w)), 0) || 860

  const innerBlocks = blocks.map(b => {
    const { x, y, w, h } = b.pixelPos!
    const html = renderBlockHTML(b, project, schools, opts, isZh)
    const posStyle = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;`
    if (/^<div class="block[^\"]*"\s+style="/.test(html)) {
      return html.replace(
        /^(<div class="block[^\"]*")\s+style="([^"]*)"(.*?>)/,
        `$1 style="${posStyle}$2"$3`
      )
    }
    return html.replace(
      /^(<div class="block[^\"]*")(.*?>)/,
      `$1 style="${posStyle}"$2`
    )
  }).join('\n')

  return `<div style="position:relative;width:${canvasW}px;height:${canvasH}px;margin:0 auto;">
${innerBlocks}
</div>`
}
// ── Paged mode JS ────────────────────────────────────────────────────────────
const PAGED_SCRIPT = `
(function(){
 var blocks = Array.from(document.querySelectorAll('.block'));
 if(blocks.length === 0) return;
 var idx = 0;
 blocks.forEach(function(b, i){ b.style.display = i === 0 ? '' : 'none'; });
 var counter = document.createElement('div');
 counter.id = 'pg-counter';
 counter.style.cssText = 'position:fixed;top:18px;right:22px;font-size:11px;letter-spacing:0.18em;color:rgba(128,128,128,0.7);font-family:Inter,DM Sans,monospace;z-index:999;user-select:none;pointer-events:none;';
 document.body.appendChild(counter);
 function makeArrow(label, dir){
 var btn = document.createElement('button');
 btn.textContent = label;
 btn.style.cssText = 'position:fixed;bottom:24px;'+(dir==='prev'?'left:50%;transform:translateX(-140%)':'left:50%;transform:translateX(40%)')+';padding:10px 22px;background:rgba(0,0,0,0.08);border:1px solid rgba(0,0,0,0.12);border-radius:8px;font-size:13px;cursor:pointer;z-index:999;backdrop-filter:blur(8px);transition:background 0.12s;font-family:Inter,DM Sans,sans-serif;';
 btn.onmouseenter=function(){btn.style.background='rgba(0,0,0,0.18)'}; 
 btn.onmouseleave=function(){btn.style.background='rgba(0,0,0,0.08)'};
 btn.onclick=function(){ dir==='prev' ? go(-1) : go(1); };
 document.body.appendChild(btn);
 return btn;
 }
 var prevBtn = makeArrow('←', 'prev');
 var nextBtn = makeArrow('→', 'next');
 var scrollBtn = document.createElement('button');
 scrollBtn.textContent = 'scroll';
 scrollBtn.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);padding:5px 14px;background:rgba(0,0,0,0.06);border:1px solid rgba(0,0,0,0.1);border-radius:20px;font-size:10px;letter-spacing:0.12em;cursor:pointer;z-index:999;font-family:Inter,DM Sans,sans-serif;color:#888;';
 scrollBtn.onclick=function(){
 blocks.forEach(function(b){b.style.display='';});
 [counter,prevBtn,nextBtn,scrollBtn].forEach(function(el){el.remove();});
 document.removeEventListener('keydown',keyHandler);
 };
 document.body.appendChild(scrollBtn);
 function update(){
 blocks.forEach(function(b,i){ b.style.display = i===idx ? '' : 'none'; });
 counter.textContent = (idx+1) + ' / ' + blocks.length;
 prevBtn.style.opacity = idx===0 ? '0.3' : '1';
 nextBtn.style.opacity = idx===blocks.length-1 ? '0.3' : '1';
 window.scrollTo(0,0);
 }
 function go(d){
 idx = Math.max(0, Math.min(blocks.length-1, idx+d));
 update();
 }
 function keyHandler(e){
 if(e.key==='ArrowRight'||e.key==='ArrowDown') go(1);
 if(e.key==='ArrowLeft'||e.key==='ArrowUp') go(-1);
 }
 document.addEventListener('keydown', keyHandler);
 update();
})();
`
// ── Full HTML assembler ───────────────────────────────────────────────────────
export function buildExportHTML(
  blocks: Block[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
  paged = false,
  forceLinear = true, // ← 导出时默认强制线性，避免 absolute 坐标叠加
): string {
  const css = buildExportCSS(opts, isZh)
  const blocksHTML = buildBlocksHTML(blocks, project, schools, opts, isZh, forceLinear)
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
${paged ?
    `<script>${PAGED_SCRIPT}<\/script>` : ''}
</body>
</html>`
}
// ── Multi-page WYSIWYG HTML assembler ─────────────────────────────────────────
export interface PageData {
  blocks: Block[]
  width: number
  height: number
  background?: string
}
export function buildExportHTMLMultiPage(
  pages: PageData[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
  paged = false,
): string {
  const t = THEMES[opts.theme] || THEMES.sensei
  const f = FONTS[opts.font] || FONTS.mixed
  const r = opts.radius
  const innerR = Math.max(0, r - 6)
  // ── 专为 absolute 定位多页模式设计的 CSS ──────────────────────────────────
  // 不复用 buildExportCSS：那套 CSS 含有 body max-width / padding / margin:0 auto
  // 以及 .block 的 margin-bottom，全部会破坏 WYSIWYG absolute 坐标布局。
  const wysiwygCSS = `
 @import url('${f.googleUrl}');
 *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
 html { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
 body { background:${t.bg}; font-family:${f.bodyStack}; color:${t.text}; font-size:16px; line-height:1.75; }
 /* 页面容器：absolute 子块的坐标锚点，绝不能有 padding */
 .export-page { position:relative; overflow:hidden; flex-shrink:0; }
 /* block 在多页模式下完全由 pixelPos 决定位置和尺寸，
 不加 margin / padding / border-radius，避免撑出容器 */
 .block {
 position:absolute;
 overflow:hidden;
 box-sizing:border-box;
 }
 /* ── 内容元素样式（与 buildExportCSS 保持一致） ── */
 h1 {
 font-family:${f.headingStack};
 font-size:${f.h1size};
 font-weight:${f.h1weight};
 letter-spacing:${f.h1tracking};
 line-height:1.15;
 margin-bottom:10px;
 }
 h2 {
 font-family:${f.headingStack};
 font-size:22px;
 font-weight:600;
 letter-spacing:-0.01em;
 margin-bottom:6px;
 margin-top:4px;
 }
 h3 {
 font-size:11px;
 font-weight:600;
 text-transform:uppercase;
 letter-spacing:0.2em;
 color:${t.muted};
 margin-bottom:16px;
 }
 .meta {
 color:${t.muted};
 font-size:12px;
 letter-spacing:0.12em;
 text-transform:uppercase;
 margin-bottom:14px;
 font-weight:500;
 }
 .desc { color:${t.muted}; line-height:1.85; margin-top:16px; font-size:15px; }
 .caption { color:${t.subtle}; font-size:12px; margin-top:10px; font-style:italic; text-align:center; line-height:1.5; }
 img { display:block; width:100%; border-radius:${innerR}px; }
 .img-cover { aspect-ratio:16/9; object-fit:cover; }
 .img-contain { object-fit:contain; max-height:100%; }
 .img-square { aspect-ratio:1; object-fit:cover; }
 .note-block {
 border-left:3px solid ${t.noteBorder} !important;
 background:${t.noteBg} !important;
 }
 .note-block p { font-size:15px; line-height:1.85; }
 .school-block { border-left:3px solid ${t.schoolBorder} !important; }
 .dept { color:${t.muted}; margin-top:8px; font-size:15px; line-height:1.65; }
 .info-box { margin-top:18px; padding:16px 20px; background:${t.infoBox}; border-radius:${innerR}px; }
 .statement-box { background:${t.statementBox}; }
 .box-label { font-size:10px; letter-spacing:0.2em; text-transform:uppercase; color:${t.muted}; margin-bottom:8px; font-weight:600; }
 .info-box p:last-child { font-size:14px; color:${t.text}; line-height:1.85; white-space:pre-wrap; }
 .ms-row { display:flex; align-items:baseline; gap:14px; margin-bottom:10px; font-size:15px; }
 .done { color:${t.accent}; }
 .pending { color:${t.subtle}; }
 .ms-done { color:${t.muted}; text-decoration:line-through; }
 .date { color:${t.subtle}; font-size:12px; margin-left:auto; }
 .img-grid { display:grid; gap:10px; }
 .img-caption { font-size:12px; color:${t.muted}; text-align:center; margin-top:6px; font-style:italic; line-height:1.4; }
 `.trim()

  const pagesHTML = pages.map((p, i) => {
    const bg = p.background || t.bg
    // 防止 height 为 NaN / undefined
    const pageW = p.width || 860
    const pageH = (p.height && !isNaN(p.height))
      ? p.height
      : p.blocks.reduce((max, b) => Math.max(max, (b.pixelPos?.y ?? 0) + (b.pixelPos?.h ?? 0)), 400) + 40

    const innerBlocks = p.blocks.map(b => {
      if (!b.pixelPos) return ''
      if (b.hidden) return '' // ← 已添加
      const { x, y, w, h } = b.pixelPos
      const inner = renderBlockHTML(b, project, schools, opts, isZh)
      const posStyle = `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`
      // 关键：如果 renderBlockHTML 已经生成了 style="..."，合并进去而不是再加一个
      if (/^<div class="block[^\"]*"\s+style="/.test(inner)) {
        return inner.replace(
          /^(<div class="block[^\"]*")\s+style="([^"]*)"(.*?>)/,
          `$1 style="${posStyle}$2"$3`
        )
      }
      return inner.replace(
        /^(<div class="block[^\"]*")(.*?>)/,
        `$1 style="${posStyle}"$2`
      )
    }).filter(Boolean).join('\n')

    return `<section class="export-page" data-page="${i}" style="width:${pageW}px;height:${pageH}px;background:${bg};">
${innerBlocks}
</section>`
  }).join('\n\n')

  const pagedScript = paged ? `<script>${PAGED_SCRIPT}<\/script>` : ''

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>${project.title}</title>
 <style>${wysiwygCSS}</style>
</head>
<body>
 <div style="display:flex;flex-direction:column;align-items:center;gap:32px;padding:32px 0;background:${t.bg};min-height:100vh;">
 ${pagesHTML}
 </div>
 ${pagedScript}
</body>
</html>`
}