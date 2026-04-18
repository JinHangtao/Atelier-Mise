'use client'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const cards = cardRefs.current.filter(Boolean) as HTMLAnchorElement[]
    const handleMouseMove = (e: MouseEvent, card: HTMLAnchorElement) => {
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = ((y - centerY) / centerY) * -4
      const rotateY = ((x - centerX) / centerX) * 4
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02) translateZ(10px)`
    }
    const handleMouseLeave = (card: HTMLAnchorElement) => { card.style.transform = '' }
    cards.forEach(card => {
      const onMove = (e: MouseEvent) => handleMouseMove(e, card)
      const onLeave = () => handleMouseLeave(card)
      card.addEventListener('mousemove', onMove as any)
      card.addEventListener('mouseleave', onLeave as any)
      ;(card as any)._cleanup = () => {
        card.removeEventListener('mousemove', onMove as any)
        card.removeEventListener('mouseleave', onLeave as any)
      }
    })
    return () => { cards.forEach(card => { if ((card as any)._cleanup) (card as any)._cleanup() }) }
  }, [])

  const isZh = pathname.startsWith('/zh')
  const locale = isZh ? 'zh' : 'en'
  const switchLang = () => { router.push(isZh ? '/en' : '/zh') }

  const navLinks: Record<string, string> = {
    schools: `/${locale}/schools`,
    projects: `/${locale}/projects`,
    roadmap: `/${locale}/roadmap`,
    aiTools: `/${locale}/ai-tools`,
    settings: `/${locale}/settings`,
  }

  return (
    <>
      {/* ── SKELETON SCREEN ── */}
      <div className={`skeleton-screen${mounted ? ' hide' : ''}`} aria-hidden>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '96px' }}>
          <div className="sk sk-pill" style={{ width: '130px' }} />
          <div className="sk sk-pill" style={{ width: '320px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', marginBottom: '80px' }}>
          <div className="sk sk-badge" />
          <div className="sk sk-h1" style={{ width: '52%' }} />
          <div className="sk sk-h1" style={{ width: '68%' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', width: '340px', marginTop: '8px' }}>
            <div className="sk sk-desc" style={{ width: '100%' }} />
            <div className="sk sk-desc" style={{ width: '83%' }} />
            <div className="sk sk-desc" style={{ width: '91%' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <div className="sk sk-btn" style={{ width: '130px' }} />
            <div className="sk sk-btn" style={{ width: '112px' }} />
          </div>
        </div>
        <div className="sk" style={{ height: '42px', borderRadius: '0', marginBottom: '52px', opacity: 0.4, animation: 'none' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
          {[0,1,2,3].map(i => <div key={i} className="sk sk-card" style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0%   { background-position: -600px 0; }
          100% { background-position: 600px 0; }
        }
        .skeleton-screen {
          position: fixed; inset: 0; z-index: 9999;
          background: #f7f7f5;
          display: flex; flex-direction: column;
          padding: 20px 48px;
          transition: opacity 0.45s cubic-bezier(.4,0,.2,1);
        }
        .skeleton-screen.hide {
          opacity: 0;
          pointer-events: none;
        }
        .sk {
          border-radius: 8px;
          background: linear-gradient(90deg, rgba(26,26,26,0.055) 25%, rgba(26,26,26,0.10) 50%, rgba(26,26,26,0.055) 75%);
          background-size: 600px 100%;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        .sk-pill  { height: 36px; border-radius: 999px; }
        .sk-badge { height: 22px; width: 160px; border-radius: 20px; }
        .sk-h1    { height: clamp(42px, 7vw, 82px); border-radius: 12px; }
        .sk-desc  { height: 13px; border-radius: 6px; }
        .sk-btn   { height: 42px; border-radius: 14px; }
        .sk-card  { border-radius: 20px; min-height: 170px; }
        @keyframes floatA {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(18px, -22px) scale(1.03); }
          66%  { transform: translate(-12px, 14px) scale(0.97); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatB {
          0%   { transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-20px, 16px) scale(0.96); }
          66%  { transform: translate(14px, -10px) scale(1.04); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes floatC {
          0%   { transform: translate(0px, 0px); }
          50%  { transform: translate(10px, 20px); }
          100% { transform: translate(0px, 0px); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .fade-up { animation: fadeUp 0.7s cubic-bezier(.4,0,.2,1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.22s; }
        .fade-up-3 { animation-delay: 0.34s; }
        .fade-up-4 { animation-delay: 0.46s; }
        .noise-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 2;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 140px;
          background-repeat: repeat;
        }
        .halo-cool {
          position: fixed; pointer-events: none; z-index: 0;
          width: 800px; height: 800px; border-radius: 50%;
          top: -200px; right: -180px;
          background: radial-gradient(circle, rgba(180,190,210,0.18) 0%, rgba(180,190,210,0.06) 40%, transparent 70%);
          filter: blur(50px);
          animation: floatA 28s ease-in-out infinite;
        }
        .halo-mid {
          position: fixed; pointer-events: none; z-index: 0;
          width: 500px; height: 500px; border-radius: 50%;
          top: 40%; left: 35%;
          background: radial-gradient(circle, rgba(200,195,180,0.1) 0%, transparent 65%);
          filter: blur(60px);
          animation: floatC 20s ease-in-out infinite;
        }
        .marquee-track {
          display: flex;
          animation: marquee 28s linear infinite;
          width: max-content;
        }
        .marquee-track:hover { animation-play-state: paused; }
        .stroke-title {
          -webkit-text-stroke: 2px #1a1a1a;
          color: transparent;
        }
        .feature-card {
          background: rgba(255,255,255,0.72);
          border: 1px solid rgba(26,26,26,0.08);
          border-left: 2.5px solid rgba(26,26,26,0.2);
          border-radius: 20px;
          padding: 32px 26px 28px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          text-decoration: none;
          transition: transform 0.2s ease-out, box-shadow 0.2s, border-left-color 0.2s;
          will-change: transform;
        }
        .feature-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.07);
          border-left-color: rgba(26,26,26,0.55);
        }
        .nav-pill {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(26,26,26,0.08);
          border-radius: 999px;
          display: flex;
          align-items: center;
        }
      `}</style>

      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'auto', background: '#f7f7f5' }}>

        <div className="halo-cool" aria-hidden />
        <div className="halo-mid" aria-hidden />
        <div className="noise-overlay" aria-hidden />

        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-160px', right: '-120px', width: '600px', height: '600px', borderRadius: '50%', border: '1.5px solid rgba(26,26,26,0.25)', animation: 'floatA 18s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', top: '-80px', right: '-50px', width: '420px', height: '420px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.18)', filter: 'blur(1px)', animation: 'floatA 22s ease-in-out infinite reverse' }}/>
          <div style={{ position: 'absolute', top: '60px', right: '80px', width: '200px', height: '200px', borderRadius: '50%', border: '1.5px solid rgba(26,26,26,0.28)', animation: 'floatB 14s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', bottom: '-140px', left: '-140px', width: '560px', height: '560px', borderRadius: '50%', border: '1.5px solid rgba(26,26,26,0.22)', animation: 'floatB 20s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', bottom: '60px', left: '-30px', width: '280px', height: '280px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.2)', filter: 'blur(0.5px)', animation: 'floatA 16s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', bottom: '180px', left: '120px', width: '100px', height: '100px', borderRadius: '50%', border: '1.5px solid rgba(26,26,26,0.3)', animation: 'floatC 10s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '1000px', height: '1000px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.07)', filter: 'blur(2px)', transform: 'translate(-50%,-50%)', animation: 'floatC 30s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', bottom: '40px', right: '80px', width: '160px', height: '160px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.22)', animation: 'floatB 12s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', top: '30%', left: '8%', width: '60px', height: '60px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.18)', animation: 'floatC 8s ease-in-out infinite' }}/>
          <div style={{ position: 'absolute', top: '20%', right: '22%', width: '40px', height: '40px', borderRadius: '50%', border: '1.5px solid rgba(26,26,26,0.22)', animation: 'floatB 9s ease-in-out infinite reverse' }}/>
        </div>

        <div aria-hidden style={{ position: 'fixed', bottom: '28px', left: '48px', fontFamily: 'Space Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.22em', color: 'rgba(26,26,26,0.2)', zIndex: 1, pointerEvents: 'none', textTransform: 'uppercase' }}>
          EST. 2024 · OPEN SOURCE
        </div>
        <div aria-hidden style={{ position: 'fixed', top: '50%', right: '28px', fontFamily: 'Space Mono, monospace', fontSize: '0.48rem', letterSpacing: '0.18em', color: 'rgba(26,26,26,0.15)', zIndex: 1, pointerEvents: 'none', writingMode: 'vertical-rl', textTransform: 'uppercase', transform: 'translateY(-50%)' }}>
          ART · DESIGN · PORTFOLIO
        </div>

        {/* ── NAV 两个药丸 ── */}
        <nav style={{ padding: '20px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100 }}>
          {/* 左药丸：logo */}
          <Link href={`/${locale}`} className="nav-pill font-mono" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#1a1a1a', textDecoration: 'none', padding: '8px 18px' }}>
            <img src="/icon.png" alt="" width={20} height={20} style={{ borderRadius: '6px' }} />
            ATELIER MISE
          </Link>

          {/* 右药丸：导航链接 */}
          <div className="nav-pill" style={{ padding: '6px 8px', gap: '2px' }}>
            {(['schools','projects','roadmap','aiTools','settings'] as const).map(key => (
              <Link key={key} href={navLinks[key]} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.5rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#8a8a86', textDecoration: 'none', padding: '5px 13px', borderRadius: '999px', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#1a1a1a'; e.currentTarget.style.background = 'rgba(26,26,26,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#888884'; e.currentTarget.style.background = 'transparent' }}
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
            <button onClick={switchLang} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '5px 12px', borderRadius: '999px', fontFamily: 'Space Mono, monospace', fontSize: '0.52rem', letterSpacing: '0.1em', cursor: 'pointer', marginLeft: '4px', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {isZh ? 'EN' : '中文'}
            </button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 48px 60px', textAlign: 'center', gap: '28px', position: 'relative', zIndex: 3 }}>
          <div className="font-mono fade-up fade-up-1" style={{ fontSize: '0.5rem', letterSpacing: '0.36em', textTransform: 'uppercase', color: '#b8b8b4', border: '1px solid rgba(26,26,26,0.12)', padding: '5px 14px', borderRadius: '20px', background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(8px)' }}>
            {t('hero.badge')}
          </div>

          <h1 className="font-mono fade-up fade-up-2" style={{ fontSize: 'clamp(2.8rem, 7vw, 6.2rem)', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.04, maxWidth: '900px', letterSpacing: '-0.035em' }}>
            <span className="stroke-title">{t('hero.title1')}</span><br />
            <span style={{ color: '#aaaaaa', fontStyle: 'italic', fontFamily: 'Georgia, "DM Serif Display", serif', fontWeight: 400, letterSpacing: '-0.01em' }}>{t('hero.title2')}</span>{' '}
            {t('hero.title3')}
          </h1>

          <p className="fade-up fade-up-3" style={{ fontSize: '0.8rem', color: '#888884', maxWidth: '420px', lineHeight: 2.0, fontWeight: 300, letterSpacing: '0.01em' }}>
            {t('hero.desc')}
          </p>

          <div className="fade-up fade-up-4" style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <Link href={`/${locale}/projects`} style={{ background: '#1a1a1a', color: '#f7f7f5', border: 'none', padding: '12px 28px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, cursor: 'pointer', textDecoration: 'none', display: 'inline-block', transition: 'opacity 0.15s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {t('hero.cta')}
            </Link>
            <a href="https://github.com/JinHangtao/portfolio-sensei" target="_blank" rel="noopener noreferrer"
              style={{ background: 'rgba(255,255,255,0.7)', color: '#1a1a1a', border: '1px solid rgba(26,26,26,0.14)', padding: '12px 28px', borderRadius: '14px', fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 400, cursor: 'pointer', backdropFilter: 'blur(8px)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1a1a1a', flexShrink: 0 }}>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57C20.565 21.795 24 17.31 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              {t('hero.github')}
            </a>
          </div>
        </section>

        {/* ── MARQUEE ── */}
        <div style={{ borderTop: '1px solid rgba(26,26,26,0.08)', borderBottom: '1px solid rgba(26,26,26,0.08)', overflow: 'hidden', position: 'relative', zIndex: 3, background: 'rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)', padding: '13px 0' }}>
          <div className="marquee-track">
            {[...Array(2)].map((_, rep) => (
              <div key={rep} style={{ display: 'flex', whiteSpace: 'nowrap' }}>
                {['SCHOOL DATABASE', 'PROJECT PLANNER', 'AI STATEMENT', 'MULTI-FORMAT EXPORT', 'OPEN SOURCE', 'MIT LICENSE'].map((item, i) => (
                  <span key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.22em', color: 'rgba(26,26,26,0.32)', textTransform: 'uppercase', padding: '0 36px' }}>
                    {item} <span style={{ opacity: 0.25 }}>·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section style={{ padding: '48px 48px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', maxWidth: '1080px', margin: '0 auto', width: '100%', position: 'relative', zIndex: 3 }}>
          {([
            { key: 'schools' },
            { key: 'projects' },
            { key: 'ai' },
            { key: 'export' },
          ] as const).map(({ key }, i) => (
            <Link key={key} href={`/${locale}/${key === 'ai' ? 'ai-tools' : key === 'export' ? 'projects' : key}`}
              className="feature-card"
              ref={(el) => { cardRefs.current[i] = el }}
              style={{ transition: 'transform 0.2s ease-out, box-shadow 0.2s, border-left-color 0.2s' }}
            >
              <span className="font-mono" style={{ fontSize: '0.48rem', color: '#c8c8c4', letterSpacing: '0.28em' }}>0{i + 1}</span>
              <h3 className="font-mono" style={{ fontSize: '0.68rem', color: '#1a1a1a', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1.3 }}>
                {t(`features.${key}.title`)}
              </h3>
              <p style={{ fontSize: '0.72rem', color: '#8a8a86', lineHeight: 1.85, fontWeight: 300, marginTop: '2px' }}>
                {t(`features.${key}.desc`)}
              </p>
            </Link>
          ))}
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ padding: '22px 48px', borderTop: '1px solid rgba(26,26,26,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 3 }}>
          <span className="font-mono" style={{ fontSize: '0.52rem', color: '#c0c0bc', letterSpacing: '0.14em' }}>
            {t('footer.label')}
          </span>
          <span className="font-mono" style={{ fontSize: '0.48rem', color: '#c8c8c4', letterSpacing: '0.22em' }}>
            MIT LICENSE
          </span>
        </footer>

      </main>
    </>
  )
}