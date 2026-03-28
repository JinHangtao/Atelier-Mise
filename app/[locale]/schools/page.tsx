'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface School {
  id: string
  name: string
  nameZh: string
  country: string
  department: string
  departmentZh: string
  deadline: string
  requirements: string
  notes: string
  website: string
  aiStatement: string
  aiGeneratedAt: string
  createdAt: string
}

interface Project {
  id: string
  title: string
  description: string
  medium?: string
  category: string
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

const EMPTY_FORM: Omit<School, 'id' | 'createdAt' | 'aiStatement' | 'aiGeneratedAt'> = {
  name: '',
  nameZh: '',
  country: '',
  department: '',
  departmentZh: '',
  deadline: '',
  requirements: '',
  notes: '',
  website: '',
}

const TX = {
  en: {
    section: '07 / SCHOOLS',
    title: 'TARGET SCHOOLS',
    subtitle: 'Manage your target institutions and generate tailored application statements.',
    newSchool: '+ Add School',
    empty: 'No target schools yet. Add one to get started.',
    back: '← Back',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    nameLabel: 'Institution Name (EN) *',
    nameZhLabel: 'Institution Name (中文)',
    countryLabel: 'Country',
    deptLabel: 'Department / Program (EN)',
    deptZhLabel: 'Department / Program (中文)',
    deadlineLabel: 'Application Deadline',
    reqLabel: 'Requirements / Portfolio Notes',
    notesLabel: 'Personal Notes',
    websiteLabel: 'Website URL',
    genStatement: '✦ Generate Application Statement',
    generating: 'Generating...',
    saveStatement: 'Save Statement',
    regenerate: '↺ Regenerate',
    statementTitle: 'AI APPLICATION STATEMENT',
    noStatement: 'No statement generated yet.\nClick the button above to generate one tailored to this school.',
    copyStatement: 'Copy',
    copied: '✓ Copied',
    daysLeft: 'days left',
    overdue: 'OVERDUE',
    today: 'TODAY',
    noDeadline: 'No deadline set',
    exportBlock: 'Add to Export',
    requirements: 'Requirements',
    notes: 'Notes',
    website: 'Website',
    addSchool: 'Add School',
    searchPlaceholder: 'Search schools...',
    sortBy: 'Sort:',
    sortDeadline: 'Deadline',
    sortName: 'Name',
    sortCountry: 'Country',
    statementHint: 'Statement generated based on your projects and school requirements.',
  },
  zh: {
    section: '07 / 院校',
    title: '目标院校',
    subtitle: '管理你的目标院校，并为每所学校生成定制化申请文书。',
    newSchool: '+ 添加院校',
    empty: '还没有目标院校，点击添加开始。',
    back: '← 返回',
    save: '保存',
    cancel: '取消',
    delete: '删除',
    edit: '编辑',
    nameLabel: '院校名称（英文）*',
    nameZhLabel: '院校名称（中文）',
    countryLabel: '国家/地区',
    deptLabel: '学院 / 专业方向（英文）',
    deptZhLabel: '学院 / 专业方向（中文）',
    deadlineLabel: '申请截止日期',
    reqLabel: '申请要求 / 作品集备注',
    notesLabel: '个人备注',
    websiteLabel: '官网链接',
    genStatement: '✦ 生成申请文书',
    generating: '生成中…',
    saveStatement: '保存文书',
    regenerate: '↺ 重新生成',
    statementTitle: 'AI 申请文书',
    noStatement: '还没有生成文书。\n点击上方按钮生成针对此院校的定制文书。',
    copyStatement: '复制',
    copied: '✓ 已复制',
    daysLeft: '天后截止',
    overdue: '已逾期',
    today: '今天截止',
    noDeadline: '未设置截止日期',
    exportBlock: '添加到导出',
    requirements: '申请要求',
    notes: '备注',
    website: '官网',
    addSchool: '添加院校',
    searchPlaceholder: '搜索院校…',
    sortBy: '排序：',
    sortDeadline: '截止日期',
    sortName: '院校名',
    sortCountry: '国家',
    statementHint: '文书基于你的项目信息和院校要求生成。',
  },
}


const COUNTRY_ZH: Record<string, string> = {
  'USA': '美国', 'UK': '英国', 'France': '法国', 'Italy': '意大利',
  'Sweden': '瑞典', 'Australia': '澳大利亚', 'Singapore': '新加坡',
}

// Longitude, Latitude for each country
const COUNTRY_COORDS: Record<string, [number, number]> = {
  'USA':       [-100, 40],
  'UK':        [-2, 54],
  'France':    [2, 46],
  'Italy':     [12, 42],
  'Sweden':    [18, 62],
  'Australia': [134, -25],
  'Singapore': [104, 1],
}


// ── WORLD MAP COMPONENT (no external deps) ──
const COUNTRY_PATHS: Record<string, string> = {
  USA: "M 180 140 L 185 120 L 220 115 L 255 120 L 270 135 L 265 155 L 245 170 L 210 172 L 188 165 Z M 155 155 L 170 148 L 178 158 L 172 170 L 158 168 Z M 100 180 L 108 172 L 118 178 L 112 188 L 102 185 Z",
  UK: "M 448 105 L 452 98 L 458 102 L 456 112 L 450 115 Z M 450 118 L 455 115 L 460 122 L 457 132 L 449 130 Z",
  France: "M 452 130 L 462 125 L 472 130 L 474 145 L 465 152 L 454 148 Z",
  Italy: "M 468 140 L 474 136 L 480 142 L 478 155 L 472 162 L 468 158 L 466 148 Z M 472 163 L 476 160 L 480 166 L 476 170 Z",
  Sweden: "M 468 85 L 472 78 L 478 82 L 477 100 L 471 105 L 466 98 Z",
  Australia: "M 720 290 L 740 278 L 775 280 L 790 295 L 785 318 L 760 330 L 732 322 L 718 308 Z M 795 285 L 802 282 L 808 288 L 804 294 L 797 292 Z",
  Singapore: "M 738 228 L 742 226 L 745 229 L 743 233 L 739 232 Z",
}

// Marker positions [x, y] on 900x500 viewBox
const MARKER_POS: Record<string, [number, number]> = {
  USA: [222, 148],
  UK: [452, 112],
  France: [463, 138],
  Italy: [472, 150],
  Sweden: [472, 92],
  Australia: [754, 305],
  Singapore: [741, 229],
}

function WorldMap({ schools, selectedCountry, setSelectedCountry, isZh }: {
  schools: School[]
  selectedCountry: string | null
  setSelectedCountry: (c: string | null) => void
  isZh: boolean
}) {
  const activeCountries = [...new Set(schools.map(s => s.country))]

  return (
    <svg viewBox="0 0 900 500" style={{ width: '100%', height: '100%' }} xmlns="http://www.w3.org/2000/svg">
      {/* Ocean background */}
      <rect width="900" height="500" fill="transparent"/>

      {/* Simple continent shapes */}
      {/* North America */}
      <path d="M 80 80 L 110 65 L 150 60 L 190 68 L 220 80 L 240 100 L 250 130 L 235 160 L 210 175 L 180 178 L 155 165 L 135 155 L 115 160 L 100 178 L 88 170 L 80 155 L 72 130 L 78 100 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Greenland */}
      <path d="M 230 35 L 260 28 L 285 38 L 282 60 L 260 68 L 235 58 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* South America */}
      <path d="M 175 210 L 200 205 L 225 215 L 235 240 L 230 275 L 215 310 L 195 340 L 175 345 L 160 325 L 155 295 L 158 260 L 165 235 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Europe */}
      <path d="M 430 75 L 450 68 L 475 72 L 495 80 L 505 95 L 498 110 L 485 118 L 468 122 L 450 118 L 435 108 L 428 95 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Scandinavia */}
      <path d="M 455 55 L 468 48 L 482 52 L 485 70 L 475 80 L 462 78 L 453 68 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Africa */}
      <path d="M 440 160 L 465 150 L 490 155 L 505 175 L 510 210 L 505 250 L 490 295 L 470 325 L 450 330 L 430 318 L 415 285 L 412 245 L 418 205 L 428 175 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Middle East */}
      <path d="M 505 150 L 530 145 L 550 152 L 555 168 L 540 175 L 515 172 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Asia */}
      <path d="M 515 65 L 560 55 L 630 50 L 700 58 L 760 68 L 800 80 L 820 100 L 815 130 L 795 150 L 760 162 L 720 168 L 680 162 L 640 155 L 600 148 L 565 140 L 540 130 L 520 115 L 510 95 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* India */}
      <path d="M 590 165 L 610 160 L 625 170 L 622 195 L 608 215 L 592 210 L 582 192 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Southeast Asia */}
      <path d="M 690 175 L 720 170 L 745 178 L 748 195 L 730 205 L 705 200 L 688 190 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Australia */}
      <path d="M 710 280 L 745 268 L 785 270 L 808 285 L 812 312 L 800 335 L 772 348 L 740 345 L 715 328 L 705 305 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* New Zealand */}
      <path d="M 830 330 L 838 322 L 845 328 L 842 342 L 834 345 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>
      {/* Japan */}
      <path d="M 780 105 L 788 100 L 795 106 L 792 118 L 783 120 Z" fill="#eeeeea" stroke="#d8d8d4" strokeWidth="0.8"/>

      {/* Active country highlights */}
      {Object.entries(COUNTRY_PATHS).map(([country, path]) => {
        if (!activeCountries.includes(country)) return null
        const isSelected = selectedCountry === country
        return (
          <path
            key={country}
            d={path}
            fill={isSelected ? '#1a1a1a' : '#888884'}
            stroke="#fff"
            strokeWidth="0.8"
            style={{ cursor: 'pointer', transition: 'fill 0.2s' }}
            onClick={() => setSelectedCountry(isSelected ? null : country)}
          />
        )
      })}

      {/* Markers */}
      {Object.entries(MARKER_POS).map(([country, [x, y]]) => {
        if (!activeCountries.includes(country)) return null
        const count = schools.filter(s => s.country === country).length
        const isSelected = selectedCountry === country
        const label = isZh ? (COUNTRY_ZH[country] || country) : country
        return (
          <g key={country} style={{ cursor: 'pointer' }} onClick={() => setSelectedCountry(isSelected ? null : country)}>
            <circle cx={x} cy={y} r={isSelected ? 9 : 7}
              fill={isSelected ? '#f7f7f5' : '#1a1a1a'}
              stroke={isSelected ? '#1a1a1a' : '#f7f7f5'}
              strokeWidth="1.5"
            />
            <text x={x} y={y - 13} textAnchor="middle"
              style={{ fontSize: '8px', fontFamily: 'Space Mono, monospace', fill: '#1a1a1a', fontWeight: 700, pointerEvents: 'none' }}>
              {label}
            </text>
            <text x={x} y={y - 4} textAnchor="middle"
              style={{ fontSize: '7px', fontFamily: 'Space Mono, monospace', fill: isSelected ? '#1a1a1a' : '#f7f7f5', pointerEvents: 'none' }}>
              {count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function getDeadlineInfo(deadline: string, isZh: boolean, t: typeof TX.en) {
  if (!deadline) return { label: t.noDeadline, color: '#c8c8c4', bg: 'transparent', urgent: false }
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
  if (diff < 0) return { label: t.overdue, color: '#bf4a4a', bg: 'rgba(180,80,80,0.08)', urgent: true }
  if (diff === 0) return { label: t.today, color: '#c4a044', bg: 'rgba(196,160,68,0.1)', urgent: true }
  if (diff <= 30) return { label: `${diff} ${t.daysLeft}`, color: '#c4a044', bg: 'rgba(196,160,68,0.08)', urgent: true }
  return { label: `${diff} ${t.daysLeft}`, color: '#b8b8b4', bg: 'transparent', urgent: false }
}

export default function SchoolsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')
  const t = isZh ? TX.zh : TX.en

  const [schools, setSchools] = useState<School[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'deadline' | 'name' | 'country'>('deadline')
  const [aiLoading, setAiLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [localStatement, setLocalStatement] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)

  useEffect(() => {
    const SCHEMA_VERSION = 'v2-bilingual'
    const cachedVersion = localStorage.getItem('ps-schools-version')
    const raw = localStorage.getItem('ps-schools')

    const loadPreset = () =>
      fetch('/data/schools-preset.json')
        .then(r => r.json())
        .then((preset: School[]) => {
          setSchools(preset)
          localStorage.setItem('ps-schools', JSON.stringify(preset))
          localStorage.setItem('ps-schools-version', SCHEMA_VERSION)
        })
        .catch(() => {})

    if (!raw || cachedVersion !== SCHEMA_VERSION) {
      // No cache or outdated schema: reload from preset
      loadPreset()
    } else {
      const parsed: School[] = JSON.parse(raw)
      // Extra guard: if name contains Chinese, cache is stale
      const stale = parsed[0] && /[一-鿿]/.test(parsed[0].name)
      if (stale) {
        loadPreset()
      } else {
        setSchools(parsed)
      }
    }
    const rawP = localStorage.getItem('ps-projects')
    if (rawP) setProjects(JSON.parse(rawP))
  }, [])

  const persist = (updated: School[]) => {
    setSchools(updated)
    localStorage.setItem('ps-schools', JSON.stringify(updated))
  }

  const openNew = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowModal(true)
  }

  const openEdit = (s: School) => {
    setForm({
      name: s.name, nameZh: s.nameZh || '', country: s.country,
      department: s.department, departmentZh: s.departmentZh || '',
      deadline: s.deadline, requirements: s.requirements,
      notes: s.notes, website: s.website,
    })
    setEditId(s.id)
    setShowModal(true)
  }

  const save = () => {
    if (!form.name.trim()) return
    const now = new Date().toISOString()
    const normalized = {
      ...form,
      nameZh: form.nameZh || form.name,
      departmentZh: form.departmentZh || form.department,
    }
    if (editId) {
      persist(schools.map(s => s.id === editId ? { ...s, ...normalized } : s))
    } else {
      persist([{
        id: generateId(), ...normalized,
        aiStatement: '', aiGeneratedAt: '', createdAt: now,
      }, ...schools])
    }
    setShowModal(false)
  }

  const remove = (id: string) => {
    persist(schools.filter(s => s.id !== id))
    if (detailId === id) setDetailId(null)
  }

  const generateStatement = async (school: School) => {
    setAiLoading(true)
    setLocalStatement('')
    const projectSummary = projects.slice(0, 6).map(p =>
      `- ${p.title}: ${p.description || 'No description'}${p.medium ? ` (${p.medium})` : ''}`
    ).join('\n')

    const prompt = isZh
      ? `你是一位专业的艺术留学申请顾问。请根据以下信息，为申请者生成一份针对特定院校的申请文书草稿（300-400字）。

目标院校：${school.nameZh || school.name}
国家：${school.country}
专业方向：${school.departmentZh || school.department}
申请要求：${school.requirements || '未指定'}

申请者的主要项目：
${projectSummary || '- 暂无项目信息'}

要求：文书需真诚、具体，突出申请者的创作理念与该院校专业方向的契合度。避免陈词滥调，语言要有个人特色。用中文输出。`
      : `You are a professional art school application advisor. Based on the following information, write a tailored application statement (300-400 words) for this specific school.

Target School: ${school.name}
Country: ${school.country}
Program: ${school.department}
Requirements: ${school.requirements || 'Not specified'}

Applicant's key projects:
${projectSummary || '- No project info available'}

Requirements: The statement should be sincere and specific, highlighting alignment between the applicant's creative practice and the school's program. Avoid clichés. Make it personal and memorable.`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const result = data.result || data.error || 'Error'
      setLocalStatement(result)
    } catch {
      setLocalStatement('Error — please try again.')
    } finally {
      setAiLoading(false)
    }
  }

  const saveStatement = (schoolId: string) => {
    if (!localStatement) return
    persist(schools.map(s => s.id === schoolId
      ? { ...s, aiStatement: localStatement, aiGeneratedAt: new Date().toISOString() }
      : s
    ))
    setLocalStatement('')
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const detail = schools.find(s => s.id === detailId) || null
  const displayStatement = localStatement || detail?.aiStatement || ''

  const filtered = schools
    .filter(s => {
      if (selectedCountry && s.country !== selectedCountry) return false
      if (!search) return true
      return (
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.nameZh || '').toLowerCase().includes(search.toLowerCase()) ||
        s.country.toLowerCase().includes(search.toLowerCase())
      )
    })
    .sort((a, b) => {
      if (sort === 'deadline') {
        if (!a.deadline) return 1
        if (!b.deadline) return -1
        return a.deadline.localeCompare(b.deadline)
      }
      if (sort === 'name') return a.name.localeCompare(b.name)
      if (sort === 'country') return a.country.localeCompare(b.country)
      return 0
    })

  // ── DETAIL VIEW ──
  if (detail) {
    const dl = getDeadlineInfo(detail.deadline, isZh, t)

    return (
      <>
        <style>{`
          @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
          @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes spin { to{transform:rotate(360deg)} }
          .gen-btn { transition: all 0.15s; }
          .gen-btn:hover:not(:disabled) { background: #333 !important; }
          .gen-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .action-btn { transition: all 0.15s; }
          .action-btn:hover { opacity: 0.75; }
          textarea:focus, input:focus { outline: none; border-color: #1a1a1a !important; box-shadow: 0 0 0 3px rgba(26,26,26,0.06); }
        `}</style>

        <main style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace' }}>
          <nav style={{ padding: '20px 48px', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.92)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => { setDetailId(null); setLocalStatement('') }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888884', fontSize: '0.9rem', letterSpacing: '0.1em' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
              onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
            >{t.back}</button>
            <span style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>PORTFOLIO_SENSEI</span>
            <button onClick={() => openEdit(detail)}
              style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
              {t.edit}
            </button>
          </nav>

          <div style={{ maxWidth: '860px', margin: '0 auto', padding: '56px 48px 96px', animation: 'fadeUp 0.5s both' }}>

            {/* 院校标题区 */}
            <div style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
                {detail.country && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888884', padding: '6px 14px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '20px' }}>
                    {detail.country}
                  </span>
                )}
                {detail.deadline && (
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.8rem', letterSpacing: '0.1em', color: dl.color, background: dl.bg, padding: '6px 14px', borderRadius: '20px' }}>
                    {dl.label}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', marginBottom: '10px', lineHeight: 1.2 }}>
                {isZh ? (detail.nameZh || detail.name) : detail.name}
              </h1>
              {(detail.department || detail.departmentZh) && (
                <p style={{ fontSize: '1.1rem', color: '#666', lineHeight: 1.7 }}>
                  {isZh ? (detail.departmentZh || detail.department) : detail.department}
                </p>
              )}
            </div>

            {/* 信息卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: '48px' }}>
              {[
                { label: isZh ? '截止日期' : 'Deadline', value: detail.deadline },
                { label: isZh ? '官网' : 'Website', value: detail.website, isLink: true },
              ].filter(m => m.value).map(m => (
                <div key={m.label} style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '14px', padding: '18px 20px' }}>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.2em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '6px' }}>{m.label}</p>
                  {m.isLink
                    ? <a href={m.value} target="_blank" rel="noreferrer" style={{ fontSize: '0.92rem', color: '#4a8abf', textDecoration: 'none', wordBreak: 'break-all' }}>{m.value}</a>
                    : <p style={{ fontSize: '1rem', color: '#1a1a1a' }}>{m.value}</p>
                  }
                </div>
              ))}
            </div>

            {/* 申请要求 */}
            {detail.requirements && (
              <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>{t.requirements}</h2>
                <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderLeft: '3px solid rgba(100,140,180,0.5)', borderRadius: '14px', padding: '22px 24px' }}>
                  <p style={{ fontSize: '1rem', color: '#444', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{detail.requirements}</p>
                </div>
              </section>
            )}

            {/* 个人备注 */}
            {detail.notes && (
              <section style={{ marginBottom: '48px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>{t.notes}</h2>
                <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '14px', padding: '22px 24px' }}>
                  <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{detail.notes}</p>
                </div>
              </section>
            )}

            {/* AI 申请文书 */}
            <section style={{ marginBottom: '48px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{t.statementTitle}</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {displayStatement && (
                    <button onClick={() => handleCopy(displayStatement)} className="action-btn"
                      style={{ background: 'none', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 16px', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.1em', cursor: 'pointer', color: '#888884' }}>
                      {copied ? t.copied : t.copyStatement}
                    </button>
                  )}
                  {localStatement && (
                    <button onClick={() => saveStatement(detail.id)} className="action-btn"
                      style={{ background: 'none', border: '1px solid rgba(74,171,111,0.4)', padding: '8px 16px', borderRadius: '8px', fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.1em', cursor: 'pointer', color: '#4aab6f' }}>
                      {t.saveStatement}
                    </button>
                  )}
                  <button onClick={() => generateStatement(detail)} disabled={aiLoading} className="gen-btn"
                    style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '10px 20px', borderRadius: '10px', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.1em', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {aiLoading
                      ? <><div style={{ width: '12px', height: '12px', border: '2px solid rgba(247,247,245,0.3)', borderTopColor: '#f7f7f5', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>{t.generating}</>
                      : (detail.aiStatement ? t.regenerate : t.genStatement)
                    }
                  </button>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '20px', minHeight: '200px', overflow: 'hidden' }}>
                {aiLoading && (
                  <div style={{ padding: '40px', display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                    {[0,1,2].map(i => (
                      <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#b8b8b4', animation: `blink 1.2s ${i*0.2}s infinite` }}/>
                    ))}
                  </div>
                )}
                {!aiLoading && displayStatement && (
                  <div style={{ padding: '28px 32px', animation: 'slideUp 0.3s both' }}>
                    {localStatement && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '8px 14px', background: 'rgba(196,160,68,0.08)', borderRadius: '8px', border: '1px solid rgba(196,160,68,0.2)' }}>
                        <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: '#c4a044', fontFamily: 'Space Mono, monospace' }}>
                          {isZh ? '⚠ 未保存 — 点击「保存文书」' : '⚠ UNSAVED — click Save Statement'}
                        </span>
                      </div>
                    )}
                    <p style={{ fontSize: '1rem', color: '#1a1a1a', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{displayStatement}</p>
                    {detail.aiGeneratedAt && !localStatement && (
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', color: '#c8c8c4', marginTop: '20px', letterSpacing: '0.1em' }}>
                        {isZh ? '生成于' : 'Generated'} {new Date(detail.aiGeneratedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
                {!aiLoading && !displayStatement && (
                  <div style={{ padding: '56px', textAlign: 'center' }}>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#c8c8c4', letterSpacing: '0.08em', lineHeight: 2.2, whiteSpace: 'pre-line' }}>{t.noStatement}</p>
                  </div>
                )}
              </div>
              {projects.length > 0 && (
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#c8c8c4', letterSpacing: '0.08em', marginTop: '10px' }}>
                  {t.statementHint} ({projects.length} {isZh ? '个项目' : 'projects'})
                </p>
              )}
            </section>

            {/* 危险区 */}
            <div style={{ borderTop: '1px solid rgba(26,26,26,0.06)', paddingTop: '32px' }}>
              <button onClick={() => remove(detail.id)}
                style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', letterSpacing: '0.12em', textTransform: 'uppercase', padding: '12px 22px', borderRadius: '10px', border: '1px solid rgba(180,80,80,0.2)', background: 'transparent', color: 'rgba(180,80,80,0.6)', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(180,80,80,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >{t.delete} {isZh ? '此院校' : 'School'}</button>
            </div>
          </div>
        </main>

        {showModal && renderModal()}
      </>
    )
  }

  // ── MODAL ──
  function renderModal() {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(247,247,245,0.75)', backdropFilter: 'blur(16px)' }}>
        <div style={{ background: '#fff', border: '1px solid rgba(26,26,26,0.1)', borderRadius: '28px', padding: '44px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 80px rgba(0,0,0,0.12)', position: 'relative' }}>
          <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '18px', right: '18px', background: 'rgba(26,26,26,0.06)', border: 'none', borderRadius: '50%', width: '34px', height: '34px', cursor: 'pointer', color: '#888884', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          <h2 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '32px' }}>
            {editId ? t.edit : t.addSchool}
          </h2>
          {[
            { label: t.nameLabel, key: 'name', type: 'text' },
            { label: t.nameZhLabel, key: 'nameZh', type: 'text' },
            { label: t.countryLabel, key: 'country', type: 'text' },
            { label: t.deptLabel, key: 'department', type: 'text' },
            { label: t.deptZhLabel, key: 'departmentZh', type: 'text' },
            { label: t.deadlineLabel, key: 'deadline', type: 'date' },
            { label: t.websiteLabel, key: 'website', type: 'url' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '7px' }}>{f.label}</label>
              <input type={f.type} value={form[f.key as keyof typeof EMPTY_FORM]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#1a1a1a', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          {[
            { label: t.reqLabel, key: 'requirements' },
            { label: t.notesLabel, key: 'notes' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '7px' }}>{f.label}</label>
              <textarea value={form[f.key as keyof typeof EMPTY_FORM]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} rows={3}
                style={{ width: '100%', padding: '13px 16px', borderRadius: '12px', border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5', fontFamily: 'DM Sans, sans-serif', fontSize: '1rem', color: '#1a1a1a', outline: 'none', resize: 'vertical', transition: 'border-color 0.15s, box-shadow 0.15s', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button onClick={save} style={{ flex: 1, background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '16px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer' }}>{t.save}</button>
            <button onClick={() => setShowModal(false)} style={{ flex: 1, background: 'transparent', color: '#888884', border: '1px solid rgba(26,26,26,0.12)', padding: '16px', borderRadius: '12px', fontFamily: 'Space Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer' }}>{t.cancel}</button>
          </div>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:0.3} 50%{transform:scale(1.8);opacity:0} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.97) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
        .school-card { transition: transform 0.2s cubic-bezier(.4,0,.2,1), box-shadow 0.2s; cursor: pointer; }
        .school-card:hover { transform: translateY(-5px); box-shadow: 0 14px 48px rgba(0,0,0,0.09); }
        .sort-btn { transition: all 0.15s; }
        .sort-btn:hover { background: rgba(26,26,26,0.06) !important; }
        input[type=search]:focus { outline: none; border-color: #1a1a1a !important; }
        input[type=search]::-webkit-search-cancel-button { cursor: pointer; }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#f7f7f5', fontFamily: 'Space Mono, monospace', position: 'relative', overflow: 'hidden' }}>
        {/* 背景装饰 */}
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '420px', height: '420px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.07)' }}/>
          <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '320px', height: '320px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.05)' }}/>
        </div>

        {/* NAV */}
        <nav style={{ padding: '20px 48px', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.88)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => router.push(isZh ? '/zh' : '/en')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888884', fontSize: '0.9rem', letterSpacing: '0.1em' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
          >{t.back}</button>
          <span style={{ fontSize: '0.9rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>PORTFOLIO_SENSEI</span>
          <button onClick={openNew} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '10px 22px', borderRadius: '10px', fontSize: '0.82rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
            {t.newSchool}
          </button>
        </nav>

        {/* HEADER */}
        <div style={{ padding: '56px 48px 32px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.5s both' }}>
          <p style={{ fontSize: '0.78rem', letterSpacing: '0.3em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '12px' }}>{t.section}</p>
          <h1 style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', marginBottom: '10px' }}>{t.title}</h1>
          <p style={{ fontSize: '1rem', color: '#888884', marginBottom: '32px' }}>{t.subtitle}</p>

          {/* 世界地图 */}
          {(() => {
            const activeCountries = [...new Set(schools.map(s => s.country))]
            // Country pill buttons — clean, no dependency needed
            const allCountries = Object.keys(COUNTRY_COORDS).filter(c => activeCountries.includes(c))
            return (
              <div style={{ marginBottom: '24px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '860px', height: '280px', marginBottom: '16px', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '20px', overflow: 'hidden' }}>
                  <WorldMap
                    schools={schools}
                    selectedCountry={selectedCountry}
                    setSelectedCountry={setSelectedCountry}
                    isZh={isZh}
                  />
                  <div style={{ position: 'absolute', bottom: '12px', right: '16px', fontSize: '0.65rem', color: '#c8c8c4', fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em' }}>
                    {isZh ? '点击国家筛选' : 'Click country to filter'}
                  </div>
                  {selectedCountry && (
                    <div style={{ position: 'absolute', top: '12px', left: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', fontFamily: 'Space Mono, monospace', color: '#1a1a1a', letterSpacing: '0.08em' }}>
                        {isZh ? (COUNTRY_ZH[selectedCountry] || selectedCountry) : selectedCountry}
                      </span>
                      <button onClick={() => setSelectedCountry(null)}
                        style={{ fontSize: '0.65rem', color: '#888884', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', background: 'rgba(26,26,26,0.06)' }}>
                        {isZh ? '清除' : 'Clear'} ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* 搜索 + 排序 */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.12)', background: 'rgba(255,255,255,0.7)', fontFamily: 'Space Mono, monospace', fontSize: '0.82rem', color: '#1a1a1a', width: '260px', transition: 'border-color 0.15s' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: '#b8b8b4', textTransform: 'uppercase' }}>{t.sortBy}</span>
              {(['deadline', 'name', 'country'] as const).map(s => (
                <button key={s} className="sort-btn" onClick={() => setSort(s)}
                  style={{ padding: '8px 16px', borderRadius: '20px', border: '1px solid rgba(26,26,26,0.12)', background: sort === s ? '#1a1a1a' : 'transparent', color: sort === s ? '#f7f7f5' : '#888884', fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', letterSpacing: '0.1em', cursor: 'pointer' }}>
                  {s === 'deadline' ? t.sortDeadline : s === 'name' ? t.sortName : t.sortCountry}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* LIST */}
        <div style={{ padding: '0 48px 96px', position: 'relative', zIndex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '100px 0', color: '#b8b8b4', fontSize: '0.95rem', letterSpacing: '0.08em' }}>
              {schools.length === 0 ? t.empty : (isZh ? '没有匹配的院校' : 'No schools match your search')}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {filtered.map((s, i) => {
              const dl = getDeadlineInfo(s.deadline, isZh, t)
              return (
                <div key={s.id} className="school-card"
                  onClick={() => { setDetailId(s.id); setLocalStatement('') }}
                  style={{ background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '22px', padding: '28px 30px', backdropFilter: 'blur(12px)', animation: `fadeUp 0.5s ${i * 0.05}s both`, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* 顶部：国家 + 截止状态 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.75rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#b8b8b4' }}>{s.country || '—'}</span>
                    {s.deadline && (
                      <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: dl.color, background: dl.bg, padding: '4px 10px', borderRadius: '12px', fontWeight: dl.urgent ? 700 : 400 }}>
                        {dl.label}
                      </span>
                    )}
                  </div>

                  {/* 院校名 */}
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                    {isZh ? (s.nameZh || s.name) : s.name}
                  </h3>

                  {/* 专业 */}
                  {(s.department || s.departmentZh) && (
                    <p style={{ fontSize: '0.9rem', color: '#888884', lineHeight: 1.6 }}>
                      {isZh ? (s.departmentZh || s.department) : s.department}
                    </p>
                  )}

                  {/* 底部状态 */}
                  <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid rgba(26,26,26,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', letterSpacing: '0.1em', color: s.aiStatement ? '#4aab6f' : '#c8c8c4' }}>
                      {s.aiStatement ? (isZh ? '✓ 已有文书' : '✓ Statement ready') : (isZh ? '○ 未生成文书' : '○ No statement')}
                    </span>
                    <span style={{ fontSize: '0.78rem', color: '#b8b8b4', letterSpacing: '0.08em' }}>
                      {isZh ? '查看 →' : 'Open →'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {showModal && renderModal()}
      </main>
    </>
  )
}