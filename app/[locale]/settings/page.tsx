'use client'
import { useLocalStorage } from '../../../hooks/useLocalStorage'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SettingsPage() {
  const pathname = usePathname()
  const router = useRouter()
  const isZh = pathname.startsWith('/zh')

  const [geminiKey, setGeminiKey] = useLocalStorage('ps-gemini-key', '')
  const [githubKey, setGithubKey] = useLocalStorage('ps-github-key', '')
  const [openrouterKey, setOpenrouterKey] = useLocalStorage('ps-openrouter-key', '')

  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const tx = {
    title:    isZh ? '设置' : 'Settings',
    subtitle: isZh ? '配置你的AI API密钥，存储在本地，不会上传' : 'Configure your AI API keys. Stored locally, never uploaded.',
    back:     isZh ? '← 返回' : '← Back',
    save:     isZh ? '保存' : 'Save',
    saved:    isZh ? '已保存 ✓' : 'Saved ✓',
    apiKeys:  isZh ? 'API 密钥' : 'API Keys',
    gemini:   'Google Gemini API',
    github:   'GitHub Models API',
    openrouter: 'OpenRouter API',
    geminiDesc:   isZh ? '免费tier，推荐首选' : 'Free tier available — recommended',
    githubDesc:   isZh ? '有GitHub账号即可使用' : 'Available with any GitHub account',
    openrouterDesc: isZh ? '聚合多家模型' : 'Access to multiple AI models',
    placeholder: isZh ? '粘贴你的API密钥' : 'Paste your API key here',
    getKey:   isZh ? '获取密钥 →' : 'Get key →',
  }

  const apis = [
    {
      name: tx.gemini,
      desc: tx.geminiDesc,
      key: geminiKey,
      setKey: setGeminiKey,
      link: 'https://aistudio.google.com/app/apikey',
      color: '#4285f4',
    },
    {
      name: tx.github,
      desc: tx.githubDesc,
      key: githubKey,
      setKey: setGithubKey,
      link: 'https://github.com/marketplace/models',
      color: '#1a1a1a',
    },
    {
      name: tx.openrouter,
      desc: tx.openrouterDesc,
      key: openrouterKey,
      setKey: setOpenrouterKey,
      link: 'https://openrouter.ai/keys',
      color: '#7c3aed',
    },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes savedPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        input:focus {
          outline: none;
          border-color: #1a1a1a !important;
          box-shadow: 0 0 0 3px rgba(26,26,26,0.06);
        }
      `}</style>

      <main style={{ minHeight: '100vh', background: '#f7f7f5', position: 'relative', overflow: 'hidden' }}>

        {/* 背景圆 */}
        <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-120px', right: '-120px', width: '500px', height: '500px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.07)' }}/>
          <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '380px', height: '380px', borderRadius: '50%', border: '1px solid rgba(26,26,26,0.06)' }}/>
        </div>

        {/* NAV */}
        <nav style={{ padding: '18px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(26,26,26,0.08)', background: 'rgba(247,247,245,0.85)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
          <button onClick={() => router.push(isZh ? '/zh' : '/en')} style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', letterSpacing: '0.14em', color: '#888884', background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1a1a1a')}
            onMouseLeave={e => (e.currentTarget.style.color = '#888884')}
          >
            {tx.back}
          </button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.1em', color: '#1a1a1a' }}>
            PORTFOLIO_SENSEI
          </span>
          <button onClick={handleSave} style={{
            background: saved ? '#4aab6f' : '#1a1a1a',
            color: '#f7f7f5', border: 'none', padding: '8px 20px', borderRadius: '10px',
            fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.12em',
            cursor: 'pointer', transition: 'background 0.3s',
            animation: saved ? 'savedPop 0.3s ease' : 'none',
          }}>
            {saved ? tx.saved : tx.save}
          </button>
        </nav>

        {/* HEADER */}
        <div style={{ padding: '52px 48px 40px', position: 'relative', zIndex: 1, animation: 'fadeUp 0.6s both' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.52rem', letterSpacing: '0.3em', color: '#b8b8b4', textTransform: 'uppercase', marginBottom: '10px' }}>05 / SETTINGS</p>
          <h1 style={{ fontFamily: 'Space Mono, monospace', fontSize: 'clamp(1.6rem, 3vw, 2.6rem)', fontWeight: 700, color: '#1a1a1a', letterSpacing: '-0.02em' }}>{tx.title}</h1>
          <p style={{ fontSize: '0.85rem', color: '#888884', marginTop: '8px', maxWidth: '480px' }}>{tx.subtitle}</p>
        </div>

        {/* API KEYS */}
        <div style={{ padding: '0 48px 80px', maxWidth: '680px', position: 'relative', zIndex: 1 }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#b8b8b4', marginBottom: '16px' }}>{tx.apiKeys}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {apis.map((api, i) => (
              <div key={api.name} style={{
                background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(26,26,26,0.08)',
                borderRadius: '20px', padding: '24px 28px',
                backdropFilter: 'blur(12px)',
                animation: `fadeUp 0.5s ${i * 0.08}s both`,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: api.color }}/>
                      <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.75rem', fontWeight: 700, color: '#1a1a1a', letterSpacing: '0.02em' }}>
                        {api.name}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: '#888884', marginLeft: '16px' }}>{api.desc}</p>
                  </div>
                  <a href={api.link} target="_blank" rel="noopener noreferrer" style={{
                    fontFamily: 'Space Mono, monospace', fontSize: '0.52rem', letterSpacing: '0.12em',
                    color: '#888884', textDecoration: 'none', border: '1px solid rgba(26,26,26,0.12)',
                    padding: '5px 12px', borderRadius: '8px', whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#1a1a1a' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.12)'; e.currentTarget.style.color = '#888884' }}
                  >
                    {tx.getKey}
                  </a>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    value={api.key}
                    onChange={e => api.setKey(e.target.value)}
                    placeholder={tx.placeholder}
                    style={{
                      width: '100%', padding: '11px 16px', borderRadius: '12px',
                      border: '1px solid rgba(26,26,26,0.12)', background: '#f7f7f5',
                      fontFamily: 'Space Mono, monospace', fontSize: '0.7rem',
                      color: '#1a1a1a', transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                  {api.key && (
                    <span style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      width: '8px', height: '8px', borderRadius: '50%', background: '#4aab6f',
                    }}/>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 说明 */}
          <div style={{ marginTop: '24px', padding: '18px 22px', borderRadius: '14px', background: 'rgba(26,26,26,0.03)', border: '1px solid rgba(26,26,26,0.06)' }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', color: '#b8b8b4', letterSpacing: '0.08em', lineHeight: 1.8 }}>
              {isZh
                ? '🔒 所有密钥仅存储在你的浏览器本地（localStorage），不会发送到任何服务器。'
                : '🔒 All keys are stored only in your browser (localStorage). Never sent to any server.'}
            </p>
          </div>
        </div>

      </main>
    </>
  )
}