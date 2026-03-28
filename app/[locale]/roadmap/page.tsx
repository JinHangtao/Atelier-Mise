'use client'
import { usePathname, useRouter } from 'next/navigation'

const ROADMAP = [
  {
    phase: '01',
    status: 'done',
    titleEn: 'Core Foundation',
    titleZh: '核心基础',
    items: [
      { en: 'Project tracker with milestones & notes', zh: '项目追踪 + 节点 + 笔记' },
      { en: 'School database with AI statement generator', zh: '院校管理 + AI 申请文书' },
      { en: 'Bilingual support (EN / ZH)', zh: '中英双语支持' },
      { en: 'PDF & Word export', zh: 'PDF 和 Word 导出' },
    ],
  },
  {
    phase: '02',
    status: 'in-progress',
    titleEn: 'AI Tools',
    titleZh: 'AI 工具',
    items: [
      { en: 'Project plan generator', zh: '项目方案生成器' },
      { en: 'Artist statement writer', zh: '艺术家陈述生成器' },
      { en: 'Artist research assistant', zh: '艺术家研究助手' },
      { en: 'Language style control', zh: '语言风格调节' },
    ],
  },
  {
    phase: '03',
    status: 'planned',
    titleEn: 'Cloud Sync',
    titleZh: '云端同步',
    items: [
      { en: 'Account system & login', zh: '账户系统与登录' },
      { en: 'Cross-device data sync', zh: '跨设备数据同步' },
      { en: 'Shared portfolio links', zh: '作品集分享链接' },
    ],
  },
  {
    phase: '04',
    status: 'planned',
    titleEn: 'Portfolio Export',
    titleZh: '作品集导出',
    items: [
      { en: 'HTML portfolio page generator', zh: 'HTML 作品集页面生成' },
      { en: 'Three.js 3D viewer', zh: 'Three.js 3D 展示器' },
      { en: 'ebook / PDF portfolio', zh: 'ebook / PDF 作品集' },
    ],
  },
  {
    phase: '05',
    status: 'planned',
    titleEn: 'Community',
    titleZh: '社区',
    items: [
      { en: 'Public school reviews & notes', zh: '院校公开评价与笔记' },
      { en: 'Portfolio inspiration gallery', zh: '作品集灵感画廊' },
      { en: 'Application timeline sharing', zh: '申请时间线分享' },
    ],
  },
]

const STATUS_CONFIG = {
  done: {
    en: 'Completed',
    zh: '已完成',
    color: '#4aab6f',
    bg: 'rgba(74,171,111,0.1)',
    dot: '#4aab6f',
  },
  'in-progress': {
    en: 'In Progress',
    zh: '进行中',
    color: '#4a8abf',
    bg: 'rgba(74,138,191,0.1)',
    dot: '#4a8abf',
  },
  planned: {
    en: 'Planned',
    zh: '计划中',
    color: '#b8b8b4',
    bg: 'rgba(184,184,180,0.1)',
    dot: '#c8c8c4',
  },
}

export default function RoadmapPage() {
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')

  const tx = {
    section: isZh ? '03 / 路线图' : '03 / ROADMAP',
    title: isZh ? '产品路线图' : 'ROADMAP',
    subtitle: isZh
      ? '开源、持续迭代。以下是我们的开发计划。'
      : 'Open source, continuously evolving. Here\'s what we\'re building.',
    back: isZh ? '← 返回' : '← Back',
    github: isZh ? '在 GitHub 上贡献 →' : 'Contribute on GitHub →',
    openSource: isZh ? '完全开源 · 欢迎贡献' : 'Fully open source · contributions welcome',
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .phase-card { transition: transform 0.2s, box-shadow 0.2s; }
        .phase-card:hover { transform: translateY(-3px); box-shadow: 0 12px 40px rgba(0,0,0,0.07); }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#f7f7f5', position: 'relative', overflow: 'hidden' }}>

        {/* 背景装饰 */}
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '480px', height: '480px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.07)' }}/>
          <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '360px', height: '360px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.05)' }}/>
        </div>

        {/* NAV */}
        <nav style={{ padding: '18px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.88)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={() => router.push(isZh ? '/zh' : '/en')}
            style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.14em', color: '#888884', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
          >{tx.back}</button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>PORTFOLIO_SENSEI</span>
          <a href="https://github.com/JinHangtao/portfolio-sensei" target="_blank" rel="noopener noreferrer"
            style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em', color: '#888884', textDecoration: 'none', border: '1px solid rgba(26,26,26,0.12)', padding: '8px 16px', borderRadius: '10px', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#1a1a1a' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.12)'; e.currentTarget.style.color = '#888884' }}
          >{tx.github}</a>
        </nav>

        {/* HEADER */}
        <div style={{ padding: '52px 48px 40px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.5s both' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.52rem', letterSpacing: '0.3em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '10px' }}>{tx.section}</p>
          <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(1.8rem, 3vw, 2.8rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em', marginBottom: '10px' }}>{tx.title}</h1>
          <p style={{ fontSize: '0.88rem', color: '#888884', maxWidth: '480px' }}>{tx.subtitle}</p>
        </div>

        {/* STATUS LEGEND */}
        <div style={{ padding: '0 48px 32px', display: 'flex', gap: '20px', flexWrap: 'wrap', position: 'relative', zIndex: 1 }}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%', background: cfg.dot,
                ...(key === 'in-progress' ? { animation: 'pulse 1.5s infinite' } : {}),
              }}/>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.12em', color: '#888884' }}>
                {isZh ? cfg.zh : cfg.en}
              </span>
            </div>
          ))}
        </div>

        {/* PHASES */}
        <div style={{ padding: '0 48px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px', position: 'relative', zIndex: 1, maxWidth: '1200px' }}>
          {ROADMAP.map((phase, i) => {
            const cfg = STATUS_CONFIG[phase.status as keyof typeof STATUS_CONFIG]
            return (
              <div key={phase.phase} className="phase-card"
                style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '22px', padding: '28px 30px', backdropFilter: 'blur(12px)', animation: `fadeUp 0.5s ${i * 0.07}s both` }}>

                {/* 顶部 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.2em', color: '#c8c8c4' }}>
                    PHASE {phase.phase}
                  </span>
                  <span style={{
                    fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em',
                    padding: '4px 12px', borderRadius: '20px',
                    background: cfg.bg, color: cfg.color,
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}>
                    <span style={{
                      width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0,
                      ...(phase.status === 'in-progress' ? { animation: 'pulse 1.5s infinite' } : {}),
                    }}/>
                    {isZh ? cfg.zh : cfg.en}
                  </span>
                </div>

                {/* 标题 */}
                <h3 style={{ fontFamily: 'Space Mono, monospace', fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em', marginBottom: '18px' }}>
                  {isZh ? phase.titleZh : phase.titleEn}
                </h3>

                {/* 功能列表 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {phase.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{
                        marginTop: '3px', width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: phase.status === 'done' ? '#4aab6f' : phase.status === 'in-progress' ? 'rgba(74,138,191,0.15)' : 'rgba(26,26,26,0.06)',
                        border: phase.status === 'done' ? 'none' : `1px solid ${phase.status === 'in-progress' ? 'rgba(74,138,191,0.3)' : 'rgba(26,26,26,0.12)'}`,
                      }}>
                        {phase.status === 'done' && <span style={{ color: '#fff', fontSize: '8px' }}>✓</span>}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: phase.status === 'done' ? '#888884' : '#1a1a1a', lineHeight: 1.5, textDecoration: phase.status === 'done' ? 'line-through' : 'none', textDecorationColor: 'rgba(136,136,132,0.4)' }}>
                        {isZh ? item.zh : item.en}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* FOOTER CTA */}
        <div style={{ padding: '0 48px 80px', position: 'relative', zIndex: 1 }}>
          <div style={{ background: 'rgba(26,26,26,0.03)', border: '1px solid rgba(26,26,26,0.07)', borderRadius: '20px', padding: '32px', textAlign: 'center', maxWidth: '600px' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', letterSpacing: '0.2em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '12px' }}>{tx.openSource}</p>
            <a href="https://github.com/JinHangtao/portfolio-sensei" target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.12em', color: '#1a1a1a', textDecoration: 'none', borderBottom: '1px solid rgba(26,26,26,0.3)', paddingBottom: '2px', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              github.com/JinHangtao/portfolio-sensei →
            </a>
          </div>
        </div>

      </main>
    </>
  )
}