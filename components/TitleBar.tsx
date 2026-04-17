'use client'
import { useEffect, useState } from 'react'

export default function TitleBar() {
  const [win, setWin] = useState<any>(null)
  const [isTauri, setIsTauri] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      setIsTauri(true)
      document.body.style.paddingTop = '34px'
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        setWin(getCurrentWindow())
      })
    }
  }, [])

  if (!isTauri) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '34px',
        background: '#f7f7f5',
        borderBottom: '1px solid rgba(26,26,26,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '12px',
        paddingRight: '4px',
        userSelect: 'none',
        zIndex: 9999,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <img src="/icon.png" alt="" width={16} height={16} style={{ borderRadius: '3px', opacity: 0.8 }} />
        <span style={{ fontFamily: 'Georgia, serif', fontSize: '9px', letterSpacing: '0.22em', color: '#c0c0bc', textTransform: 'uppercase' }}>
          Atelier Mise
        </span>
      </div>

      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={() => win?.minimize()} style={btn}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="10" height="2" viewBox="0 0 10 2" fill="none">
            <line x1="0" y1="1" x2="10" y2="1" stroke="#bbb" strokeWidth="1.2"/>
          </svg>
        </button>
        <button onClick={() => win?.toggleMaximize()} style={btn}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.6" y="0.6" width="8.8" height="8.8" stroke="#bbb" strokeWidth="1.1"/>
          </svg>
        </button>
        <button onClick={() => win?.close()} style={btn}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,92,92,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <line x1="1" y1="1" x2="9" y2="9" stroke="#bbb" strokeWidth="1.1" strokeLinecap="round"/>
            <line x1="9" y1="1" x2="1" y2="9" stroke="#bbb" strokeWidth="1.1" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  width: '40px',
  height: '34px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.12s',
  padding: 0,
  borderRadius: 0,
}