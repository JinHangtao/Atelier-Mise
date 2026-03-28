'use client'
import { useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const t = useTranslations()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const isZh = pathname.startsWith('/zh')
  const locale = isZh ? 'zh' : 'en'

  const switchLang = () => {
    router.push(isZh ? '/en' : '/zh')
  }

  const navLinks: Record<string, string> = {
    schools: `/${locale}/schools`,
    projects: `/${locale}/projects`,
    roadmap: `/${locale}/roadmap`,
    aiTools: `/${locale}/ai-tools`,
    settings: `/${locale}/settings`,
  }

  return (
    <>
      <style>{`
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
        .fade-up { animation: fadeUp 0.7s cubic-bezier(.4,0,.2,1) both; }
        .fade-up-1 { animation-delay: 0.1s; }
        .fade-up-2 { animation-delay: 0.22s; }
        .fade-up-3 { animation-delay: 0.34s; }
        .fade-up-4 { animation-delay: 0.46s; }
      `}</style>

      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', background: '#f7f7f5' }}>

        {/* ── 背景圆圈动画 ── */}
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{
            position: 'absolute', top: '-160px', right: '-120px',
            width: '600px', height: '600px', borderRadius: '50%',
            border: '1.5px solid rgba(26,26,26,0.13)',
            animation: 'floatA 18s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', top: '-80px', right: '-50px',
            width: '420px', height: '420px', borderRadius: '50%',
            border: '1px solid rgba(26,26,26,0.09)',
            filter: 'blur(1px)',
            animation: 'floatA 22s ease-in-out infinite reverse',
          }}/>
          <div style={{
            position: 'absolute', top: '60px', right: '80px',
            width: '200px', height: '200px', borderRadius: '50%',
            border: '1.5px solid rgba(26,26,26,0.18)',
            animation: 'floatB 14s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', bottom: '-140px', left: '-140px',
            width: '560px', height: '560px', borderRadius: '50%',
            border: '1.5px solid rgba(26,26,26,0.11)',
            animation: 'floatB 20s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', bottom: '60px', left: '-30px',
            width: '280px', height: '280px', borderRadius: '50%',
            border: '1px solid rgba(26,26,26,0.16)',
            filter: 'blur(0.5px)',
            animation: 'floatA 16s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', bottom: '180px', left: '120px',
            width: '100px', height: '100px', borderRadius: '50%',
            border: '1.5px solid rgba(26,26,26,0.2)',
            animation: 'floatC 10s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            width: '1000px', height: '1000px', borderRadius: '50%',
            border: '1px solid rgba(26,26,26,0.04)',
            filter: 'blur(2px)',
            transform: 'translate(-50%,-50%)',
            animation: 'floatC 30s ease-in-out infinite',
          }}/>
          <div style={{
            position: 'absolute', bottom: '40px', right: '80px',
            width: '160px', height: '160px', borderRadius: '50%',
            border: '1px solid rgba(26,26,26,0.14)',
            animation: 'floatB 12s ease-in-out infinite',
          }}/>
        </div>

        {/* ── NAV ── */}
        <nav style={{
          padding: '18px 48px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(26,26,26,0.08)',
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(247,247,245,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          <Link href={`/${locale}`} className="font-mono" style={{ fontSize: '0.75rem', letterSpacing: '0.1em', color: '#1a1a1a', textDecoration: 'none' }}>
            PORTFOLIO_SENSEI
          </Link>
          <div style={{ display: 'flex', gap: '28px', alignItems: 'center' }}>
            {(['schools','projects','roadmap','aiTools','settings'] as const).map(key => (
              <Link key={key} href={navLinks[key]} style={{
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.56rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: '#888884',
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
                onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
              >
                {t(`nav.${key}`)}
              </Link>
            ))}
            <button onClick={switchLang} style={{
              background: 'transparent',
              border: '1px solid rgba(26,26,26,0.2)',
              color: '#888884',
              padding: '4px 11px',
              borderRadius: '8px',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.56rem',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#1a1a1a' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.2)'; e.currentTarget.style.color = '#888884' }}
            >
              {isZh ? 'EN' : '中文'}
            </button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 48px 80px',
          textAlign: 'center',
          gap: '24px',
          position: 'relative', zIndex: 1,
        }}>
          <div className="font-mono fade-up fade-up-1" style={{
            fontSize: '0.5rem',
            letterSpacing: '0.36em',
            textTransform: 'uppercase',
            color: '#b8b8b4',
            border: '1px solid rgba(26,26,26,0.12)',
            padding: '5px 14px',
            borderRadius: '20px',
            background: 'rgba(255,255,255,0.6)',
            backdropFilter: 'blur(8px)',
          }}>
            {t('hero.badge')}
          </div>

          <h1 className="font-mono fade-up fade-up-2" style={{
            fontSize: 'clamp(1.9rem, 4.5vw, 3.6rem)',
            fontWeight: 700,
            color: '#1a1a1a',
            lineHeight: 1.12,
            maxWidth: '700px',
            letterSpacing: '-0.03em',
          }}>
            {t('hero.title1')}<br />
            <span style={{ color: '#888884' }}>{t('hero.title2')}</span>{' '}
            {t('hero.title3')}
          </h1>

          <p className="fade-up fade-up-3" style={{
            fontSize: '0.83rem',
            color: '#888884',
            maxWidth: '460px',
            lineHeight: 1.9,
            fontWeight: 300,
          }}>
            {t('hero.desc')}
          </p>

          <div className="fade-up fade-up-4" style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <Link href={`/${locale}/schools`} style={{
              background: '#1a1a1a',
              color: '#f7f7f5',
              border: 'none',
              padding: '12px 28px',
              borderRadius: '14px',
              fontFamily: 'Space Mono, monospace',
              fontSize: '0.58rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'none',
              display: 'inline-block',
              transition: 'opacity 0.15s, transform 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {t('hero.cta')}
            </Link>
            <a
              href="https://github.com/JinHangtao/portfolio-sensei"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: 'rgba(255,255,255,0.7)',
                color: '#1a1a1a',
                border: '1px solid rgba(26,26,26,0.14)',
                padding: '12px 28px',
                borderRadius: '14px',
                fontFamily: 'Space Mono, monospace',
                fontSize: '0.58rem',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 400,
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.7)'; e.currentTarget.style.transform = 'translateY(0)' }}
            >
              {t('hero.github')}
            </a>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section style={{
          padding: '0 48px 80px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          maxWidth: '1080px',
          margin: '0 auto',
          width: '100%',
          position: 'relative', zIndex: 1,
        }}>
          {([
            { key: 'schools', href: `/${locale}/schools` },
            { key: 'projects', href: `/${locale}/projects` },
            { key: 'ai', href: `/${locale}/ai-tools` },
            { key: 'export', href: `/${locale}/projects` },
          ] as const).map(({ key }, i) => (
            <Link key={key} href={`/${locale}/${key === 'ai' ? 'ai-tools' : key === 'export' ? 'projects' : key}`} style={{
              background: 'rgba(255,255,255,0.72)',
              border: '1px solid rgba(26,26,26,0.08)',
              borderRadius: '20px',
              padding: '28px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              textDecoration: 'none',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.07)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <span className="font-mono" style={{ fontSize: '0.52rem', color: '#b8b8b4', letterSpacing: '0.2em' }}>
                0{i + 1}
              </span>
              <h3 className="font-mono" style={{
                fontSize: '0.72rem',
                color: '#1a1a1a',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {t(`features.${key}.title`)}
              </h3>
              <p style={{ fontSize: '0.74rem', color: '#888884', lineHeight: 1.8, fontWeight: 300 }}>
                {t(`features.${key}.desc`)}
              </p>
            </Link>
          ))}
        </section>

        {/* ── FOOTER ── */}
        <footer style={{
          padding: '22px 48px',
          borderTop: '1px solid rgba(26,26,26,0.07)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative', zIndex: 1,
        }}>
          <span className="font-mono" style={{ fontSize: '0.55rem', color: '#b8b8b4', letterSpacing: '0.12em' }}>
            {t('footer.label')}
          </span>
          <span className="font-mono" style={{ fontSize: '0.52rem', color: '#b8b8b4', letterSpacing: '0.18em' }}>
            MIT LICENSE
          </span>
        </footer>

      </main>
    </>
  )
}