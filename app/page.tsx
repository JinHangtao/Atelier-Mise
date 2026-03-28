'use client'
import Link from 'next/link'

const navLinks: Record<string, string> = {
  Schools: '/en/schools',
  Projects: '/en/projects',
  Roadmap: '/en/roadmap',
  'AI Tools': '/en/ai-tools',
  Settings: '/en/settings',
}

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* NAV */}
      <nav style={{
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--line)',
      }}>
        <Link href="/en" className="font-serif" style={{ color: 'var(--gold)', fontSize: '1.1rem', fontStyle: 'italic', textDecoration: 'none' }}>
          Portfolio Sensei
        </Link>
        <div style={{ display: 'flex', gap: '32px' }}>
          {['Schools', 'Projects', 'Roadmap', 'AI Tools', 'Settings'].map(item => (
            <Link key={item} href={navLinks[item]} style={{
              fontSize: '0.6rem',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--fg-d)',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--cream)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--fg-d)')}
            >
              {item}
            </Link>
          ))}
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 40px',
        textAlign: 'center',
        gap: '24px',
      }}>
        <div style={{
          fontSize: '0.55rem',
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          border: '1px solid var(--gold-d)',
          padding: '5px 16px',
          borderRadius: '6px',
        }}>
          Open Source · Free Forever
        </div>

        <h1 className="font-serif" style={{
          fontSize: 'clamp(2rem, 5vw, 3.8rem)',
          fontWeight: 500,
          fontStyle: 'italic',
          color: 'var(--cream)',
          lineHeight: 1.2,
          maxWidth: '700px',
        }}>
          Your portfolio,<br />
          <span style={{ color: 'var(--gold)' }}>finally</span> has a plan.
        </h1>

        <p style={{
          fontSize: '0.85rem',
          color: 'var(--fg-d)',
          maxWidth: '480px',
          lineHeight: 1.8,
          fontWeight: 300,
        }}>
          Plan your art & design school application. Organize projects,
          discover schools, build your artist statement — with AI that
          understands creative work.
        </p>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <Link href="/en/schools" style={{
            background: 'var(--gold)',
            color: 'var(--bg)',
            border: 'none',
            padding: '12px 28px',
            borderRadius: '8px',
            fontSize: '0.62rem',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textDecoration: 'none',
            display: 'inline-block',
          }}>
            Get Started
          </Link>
          <a
            href="https://github.com/JinHangtao/portfolio-sensei"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: 'transparent',
              color: 'var(--fg)',
              border: '1px solid var(--line2)',
              padding: '12px 28px',
              borderRadius: '8px',
              fontSize: '0.62rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 400,
              cursor: 'pointer',
              fontFamily: 'inherit',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
            View on GitHub
          </a>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{
        padding: '60px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%',
      }}>
        {[
          { icon: '◎', title: 'School Database', desc: 'Curated art & design schools worldwide, filtered by discipline and culture.', href: '/en/schools' },
          { icon: '◈', title: 'Project Planner', desc: 'Track in-school and personal projects. Attach images, video, PDF.', href: '/en/projects' },
          { icon: '◇', title: 'AI Statement', desc: 'Generate artist statements and portfolio narratives with AI guidance.', href: '/en/ai-tools' },
          { icon: '◉', title: 'Multi-format Export', desc: 'Export as HTML, PDF, or ebook. Three.js viewer coming soon.', href: '/en/projects' },
        ].map(f => (
          <Link key={f.title} href={f.href} style={{
            background: 'var(--card)',
            border: '1px solid var(--line2)',
            borderRadius: '14px',
            padding: '28px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            textDecoration: 'none',
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-d)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--line2)')}
          >
            <span style={{ fontSize: '1.2rem', color: 'var(--gold)' }}>{f.icon}</span>
            <h3 className="font-serif" style={{ fontSize: '0.95rem', color: 'var(--cream)', fontStyle: 'italic' }}>
              {f.title}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--fg-d)', lineHeight: 1.7 }}>{f.desc}</p>
          </Link>
        ))}
      </section>

      {/* FOOTER */}
      <footer style={{
        padding: '24px 40px',
        borderTop: '1px solid var(--line)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span className="font-serif" style={{ fontSize: '0.7rem', color: 'var(--fg-dd)', fontStyle: 'italic' }}>
          Portfolio Sensei — open source
        </span>
        <span style={{ fontSize: '0.6rem', color: 'var(--fg-dd)', letterSpacing: '0.2em' }}>
          MIT LICENSE
        </span>
      </footer>

    </main>
  )
}