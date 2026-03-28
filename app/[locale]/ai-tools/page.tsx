'use client'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

type Tool = 'plan' | 'statement' | 'artists'
type Message = { role: 'user' | 'assistant'; content: string }

const TX = {
  en: {
    section: '06 / AI TOOLS',
    title: 'AI TOOLS',
    subtitle: 'Three tools for artists — powered by Groq.',
    tabs: [
      { id: 'plan',      n: '01', name: 'PROJECT PLAN',     desc: 'Turn a raw idea into a full creative roadmap.' },
      { id: 'statement', n: '02', name: 'ARTIST STATEMENT', desc: 'Describe your work, get a polished statement.' },
      { id: 'artists',   n: '03', name: 'ARTIST RESEARCH',  desc: 'Find artists who share your medium or vision.' },
    ],
    chatPlaceholder: 'Describe your idea, or ask anything...',
    send: 'SEND',
    surprise: '✦ SURPRISE ME',
    surprisePrompts: [
      'Give me a random art project idea involving natural materials and digital media.',
      'Suggest an unexpected combination of two art movements for a new project.',
      'Give me a site-specific installation concept for an urban environment.',
      'Propose a performative artwork that engages with memory and time.',
    ],
    generateOutput: 'GENERATE OUTPUT',
    generating: 'GENERATING...',
    outputTitle: 'OUTPUT',
    outputEmpty: 'Your generated content will appear here.\nStart a conversation on the left, then click Generate Output.',
    exportTitle: 'EXPORT',
    filenamePlaceholder: 'untitled-project',
    copyBtn: 'COPY',
    downloadTxt: 'TXT',
    downloadMd: 'MD',
    langMatch: 'LANGUAGE MATCH',
    langMatchDesc: ['Loose / Creative', 'Strict / Academic'],
    clearChat: 'CLEAR',
    you: 'YOU',
    ai: 'AI',
    error: 'Something went wrong. Please try again.',
  },
  zh: {
    section: '06 / AI 工具',
    title: 'AI 工具',
    subtitle: '三个为艺术家设计的工具，由 Groq 驱动。',
    tabs: [
      { id: 'plan',      n: '01', name: '项目方案',   desc: '将粗糙想法变成完整的创作路线图。' },
      { id: 'statement', n: '02', name: '艺术家陈述', desc: '描述你的作品，生成精炼的艺术家陈述。' },
      { id: 'artists',   n: '03', name: '艺术家研究', desc: '找到与你有相同媒介或愿景的艺术家。' },
    ],
    chatPlaceholder: '描述你的想法，或随便问点什么……',
    send: '发送',
    surprise: '✦ 随机灵感',
    surprisePrompts: [
      '给我一个结合自然材料与数字媒介的艺术项目想法。',
      '给我一个意想不到的两种艺术运动组合方向。',
      '给我一个城市环境中的场域特定装置概念。',
      '给我一个关于记忆与时间的行为艺术方案。',
    ],
    generateOutput: '生成输出',
    generating: '生成中…',
    outputTitle: '输出内容',
    outputEmpty: '生成的内容将在这里显示。\n先在左侧对话，再点击「生成输出」。',
    exportTitle: '导出',
    filenamePlaceholder: '未命名项目',
    copyBtn: '复制',
    downloadTxt: 'TXT',
    downloadMd: 'MD',
    langMatch: '语言风格',
    langMatchDesc: ['宽松 / 创意', '严谨 / 学术'],
    clearChat: '清空',
    you: '你',
    ai: 'AI',
    error: '出错了，请稍后再试。',
  },
}

function getSystemPrompt(tool: Tool, isZh: boolean, langMatch: number) {
  const style = langMatch < 40
    ? (isZh ? '语言宽松有创意，像艺术家朋友对话。' : 'Tone: loose, creative, like talking to an artist friend.')
    : langMatch > 70
    ? (isZh ? '语言严谨学术，适合正式申请。' : 'Tone: precise, academic, suitable for formal applications.')
    : (isZh ? '语言平衡，专业且易读。' : 'Tone: balanced, professional yet readable.')

  if (tool === 'plan') return isZh
    ? `你是一位经验丰富的艺术导师，帮助学生梳理创作项目方案。保持回复简短、有针对性。${style} 用中文回复。`
    : `You are an experienced art mentor helping students develop creative project plans. Keep replies concise and focused. ${style}`
  if (tool === 'statement') return isZh
    ? `你是一位专业的艺术写作顾问，帮助艺术家撰写陈述。保持回复简短，帮助用户提炼表达。${style} 用中文回复。`
    : `You are a professional art writing consultant. Keep replies concise, help users refine their expression. ${style}`
  return isZh
    ? `你是一位艺术史学者和当代艺术专家，帮助学生发现相关艺术家。回复简短、信息密度高。${style} 用中文回复。`
    : `You are an art historian helping students discover relevant artists. Keep replies concise and information-dense. ${style}`
}

function getOutputPrompt(tool: Tool, isZh: boolean, langMatch: number, history: Message[]) {
  const conv = history.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n')
  const style = langMatch < 40
    ? (isZh ? '风格宽松创意' : 'Style: loose and creative')
    : langMatch > 70
    ? (isZh ? '风格严谨学术' : 'Style: strict and academic')
    : (isZh ? '风格平衡专业' : 'Style: balanced professional')

  if (tool === 'plan') return isZh
    ? `根据以下对话，生成完整艺术项目方案，包含：概念阐述、媒介与材料、制作阶段与时间线、参考艺术家、潜在挑战。${style}，结构清晰，用中文输出。\n\n${conv}`
    : `Based on the conversation, generate a complete creative project plan: concept, medium & materials, phases & timeline, reference artists, challenges. ${style}.\n\n${conv}`
  if (tool === 'statement') return isZh
    ? `根据以下对话，生成专业艺术家陈述（200-300字），真诚具体，避免陈词滥调。${style}，用中文输出。\n\n${conv}`
    : `Based on the conversation, write a professional artist statement (200-300 words). Sincere, specific, no clichés. ${style}.\n\n${conv}`
  return isZh
    ? `根据以下对话，整理艺术家参考清单，分「历史参考」和「当代参考」，每位含：姓名、国籍/年代、代表作、关联说明。${style}，用中文输出。\n\n${conv}`
    : `Based on the conversation, compile an artist reference list: "Historical References" and "Contemporary References". For each: name, era, key works, relevance. ${style}.\n\n${conv}`
}

export default function AIToolsPage() {
  const pathname = usePathname()
  const isZh = pathname.startsWith('/zh')
  const t = isZh ? TX.zh : TX.en

  const [activeTool, setActiveTool] = useState<Tool>('plan')
  const [langMatch, setLangMatch] = useState(50)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [output, setOutput] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [filename, setFilename] = useState('')
  const [copied, setCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  
  useEffect(() => {
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isChatLoading])

  const callAI = async (msgs: Message[], system: string): Promise<string> => {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: system, messages: msgs }),
    })
    const data = await res.json()
    return data.result || data.error || 'Error'
  }

  const handleSend = async (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || isChatLoading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setIsChatLoading(true)
    try {
      const system = getSystemPrompt(activeTool, isZh, langMatch)
      const reply = await callAI(newMessages, system)
      setMessages([...newMessages, { role: 'assistant', content: reply }])
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: t.error }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleSurprise = () => {
    const prompts = t.surprisePrompts
    const random = prompts[Math.floor(Math.random() * prompts.length)]
    handleSend(random)
  }

  const handleGenerateOutput = async () => {
    if (messages.length === 0 || isGenerating) return
    setIsGenerating(true)
    setOutput('')
    try {
      const prompt = getOutputPrompt(activeTool, isZh, langMatch, messages)
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      setOutput(data.result || data.error || 'Error')
    } catch {
      setOutput(t.error)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(output)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = (ext: 'txt' | 'md') => {
    const name = (filename.trim() || t.filenamePlaceholder) + '.' + ext
    const blob = new Blob([output], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = name; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .tool-tab{transition:all 0.15s;border:1px solid rgba(26,26,26,0.12)}
        .tool-tab:hover{background:rgba(26,26,26,0.04)}
        .tool-tab.active{background:#1a1a1a!important;color:#f7f7f5!important}
        .tool-tab.active .tab-n{color:rgba(247,247,245,0.4)!important}
        textarea{resize:none}
        textarea:focus{outline:none;border-color:#1a1a1a!important;box-shadow:0 0 0 3px rgba(26,26,26,0.06)}
        .send-btn{transition:all 0.15s}
        .send-btn:hover:not(:disabled){background:#333!important}
        .send-btn:disabled{opacity:0.4;cursor:not-allowed}
        .gen-btn{transition:all 0.15s}
        .gen-btn:hover:not(:disabled){background:rgba(26,26,26,0.06)!important}
        .gen-btn:disabled{opacity:0.4;cursor:not-allowed}
        .export-btn{transition:all 0.15s}
        .export-btn:hover:not(:disabled){background:#1a1a1a!important;color:#f7f7f5!important}
        .export-btn:disabled{opacity:0.4;cursor:not-allowed}
        .surprise-btn{transition:all 0.15s}
        .surprise-btn:hover:not(:disabled){border-color:#1a1a1a!important;color:#1a1a1a!important}
        .surprise-btn:disabled{opacity:0.4;cursor:not-allowed}
        .msg-ai{animation:fadeUp 0.3s both}
        .chat-scroll::-webkit-scrollbar{width:2px}
        .chat-scroll::-webkit-scrollbar-thumb{background:#d0d0cc;border-radius:2px}
        .output-scroll::-webkit-scrollbar{width:2px}
        .output-scroll::-webkit-scrollbar-thumb{background:#d0d0cc;border-radius:2px}
        input[type=range]{-webkit-appearance:none;appearance:none;height:2px;background:linear-gradient(to right,#1a1a1a var(--val,50%),#e2e2de var(--val,50%));border-radius:2px;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#1a1a1a;cursor:pointer}
      `}</style>

      <main style={{ minHeight:'100vh', background:'#f7f7f5', display:'flex', flexDirection:'column' }}>

        <div style={{ padding:'40px 48px 24px', animation:'fadeUp 0.5s both', flexShrink:0 }}>
          <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.5rem', letterSpacing:'0.3em', color:'#b8b8b4', textTransform:'uppercase', marginBottom:'8px' }}>{t.section}</p>
          <h1 style={{ fontFamily:'Space Mono,monospace', fontSize:'clamp(1.4rem,2.5vw,2.2rem)', fontWeight:700, color:'#1a1a1a', letterSpacing:'-0.02em', marginBottom:'6px' }}>{t.title}</h1>
          <p style={{ fontSize:'0.82rem', color:'#888884' }}>{t.subtitle}</p>
        </div>

        <div style={{ padding:'0 48px 20px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:'8px' }}>
            {t.tabs.map(tab => (
              <button key={tab.id} onClick={() => { setActiveTool(tab.id as Tool); setMessages([]); setOutput('') }}
                className={`tool-tab${activeTool===tab.id?' active':''}`}
                style={{ padding:'8px 18px', borderRadius:'10px', fontFamily:'Space Mono,monospace', fontSize:'0.58rem', letterSpacing:'0.08em', cursor:'pointer', background:'transparent', color:'#1a1a1a', display:'flex', alignItems:'center', gap:'7px' }}>
                <span className="tab-n" style={{ color:'#b8b8b4', fontSize:'0.48rem' }}>{tab.n}</span>
                {tab.name}
              </button>
            ))}
          </div>
          <p style={{ marginTop:'8px', fontFamily:'Space Mono,monospace', fontSize:'0.54rem', letterSpacing:'0.06em', color:'#888884' }}>
            {t.tabs.find(tab => tab.id===activeTool)?.desc}
          </p>
        </div>

        <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', padding:'0 48px 48px', minHeight:0 }}>

          <div style={{ display:'flex', flexDirection:'column', background:'rgba(255,255,255,0.8)', border:'1px solid rgba(26,26,26,0.08)', borderRadius:'20px', backdropFilter:'blur(12px)', overflow:'hidden' }}>
            <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid rgba(26,26,26,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.52rem', letterSpacing:'0.2em', color:'#b8b8b4', textTransform:'uppercase' }}>
                {isZh ? '对话' : 'CONVERSATION'}
              </p>
              {messages.length > 0 && (
                <button onClick={() => { setMessages([]); setOutput('') }}
                  style={{ fontFamily:'Space Mono,monospace', fontSize:'0.48rem', letterSpacing:'0.1em', color:'#b8b8b4', background:'none', border:'1px solid rgba(26,26,26,0.1)', padding:'3px 9px', borderRadius:'6px', cursor:'pointer' }}>
                  {t.clearChat}
                </button>
              )}
            </div>
            <div className="chat-scroll" style={{ flex:1, overflowY:'auto', padding:'18px 22px', display:'flex', flexDirection:'column', gap:'14px', minHeight:0 }}>
              {messages.length === 0 && !isChatLoading && (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.54rem', letterSpacing:'0.1em', color:'#c8c8c4', textAlign:'center', lineHeight:2.2 }}>
                    {isZh ? '开始对话\n或点击随机灵感' : 'Start a conversation\nor try Surprise Me'}
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role==='assistant'?'msg-ai':''} style={{ display:'flex', flexDirection:'column', alignItems:m.role==='user'?'flex-end':'flex-start', gap:'4px' }}>
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.45rem', letterSpacing:'0.15em', color:'#b8b8b4' }}>
                    {m.role==='user' ? t.you : t.ai}
                  </span>
                  <div style={{
                    maxWidth:'85%', padding:'10px 14px',
                    borderRadius: m.role==='user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role==='user' ? '#1a1a1a' : 'rgba(26,26,26,0.05)',
                    color: m.role==='user' ? '#f7f7f5' : '#1a1a1a',
                    fontSize:'0.84rem', lineHeight:1.7, whiteSpace:'pre-wrap', fontWeight:400,
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isChatLoading && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:'4px' }}>
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.45rem', letterSpacing:'0.15em', color:'#b8b8b4' }}>{t.ai}</span>
                  <div style={{ padding:'10px 14px', borderRadius:'14px 14px 14px 4px', background:'rgba(26,26,26,0.05)' }}>
                    <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                      {[0,1,2].map(i => (
                        <div key={i} style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#b8b8b4', animation:`blink 1.2s ${i*0.2}s infinite` }}/>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef}/>
            </div>
            <div style={{ padding:'14px 18px 18px', borderTop:'1px solid rgba(26,26,26,0.06)', flexShrink:0 }}>
              <button onClick={handleSurprise} disabled={isChatLoading}
                className="surprise-btn"
                style={{ fontFamily:'Space Mono,monospace', fontSize:'0.5rem', letterSpacing:'0.1em', color:'#888884', background:'none', border:'1px solid rgba(26,26,26,0.1)', padding:'5px 12px', borderRadius:'8px', cursor:'pointer', marginBottom:'10px' }}>
                {t.surprise}
              </button>
              <div style={{ display:'flex', gap:'8px', alignItems:'flex-end' }}>
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend() } }}
                  placeholder={t.chatPlaceholder}
                  rows={3}
                  style={{ flex:1, padding:'10px 14px', borderRadius:'12px', border:'1px solid rgba(26,26,26,0.12)', background:'#f7f7f5', fontFamily:'DM Sans,Noto Sans SC,sans-serif', fontSize:'0.84rem', color:'#1a1a1a', lineHeight:1.6, transition:'border-color 0.15s,box-shadow 0.15s' }}
                />
                <button onClick={() => handleSend()} disabled={!input.trim() || isChatLoading}
                  className="send-btn"
                  style={{ padding:'10px 16px', background:'#1a1a1a', color:'#f7f7f5', border:'none', borderRadius:'12px', fontFamily:'Space Mono,monospace', fontSize:'0.55rem', letterSpacing:'0.1em', cursor:'pointer', whiteSpace:'nowrap', alignSelf:'flex-end' }}>
                  {t.send}
                </button>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'12px', minHeight:0 }}>

            <div style={{ flex:1, minHeight:'420px', display:'flex', flexDirection:'column', background:'rgba(255,255,255,0.8)', border:'1px solid rgba(26,26,26,0.08)', borderRadius:'20px', backdropFilter:'blur(12px)', overflow:'hidden' }}>
              <div style={{ padding:'18px 22px 14px', borderBottom:'1px solid rgba(26,26,26,0.06)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
                <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.52rem', letterSpacing:'0.2em', color:'#b8b8b4', textTransform:'uppercase' }}>{t.outputTitle}</p>
                <button onClick={handleGenerateOutput} disabled={messages.length===0 || isGenerating}
                  className="gen-btn"
                  style={{ fontFamily:'Space Mono,monospace', fontSize:'0.52rem', letterSpacing:'0.1em', color:'#1a1a1a', background:'none', border:'1px solid rgba(26,26,26,0.15)', padding:'5px 14px', borderRadius:'8px', cursor:'pointer' }}>
                  {isGenerating ? t.generating : t.generateOutput}
                </button>
              </div>
              <div className="output-scroll" style={{ flex:1, overflowY:'auto', padding:'18px 22px', minHeight:0 }}>
                {output ? (
                  <div style={{ fontSize:'0.88rem', color:'#1a1a1a', lineHeight:1.85, whiteSpace:'pre-wrap', fontWeight:400, animation:'fadeUp 0.3s both' }}>
                    {output}
                    {isGenerating && <span style={{ display:'inline-block', width:'2px', height:'14px', background:'#1a1a1a', marginLeft:'2px', verticalAlign:'middle', animation:'blink 0.8s infinite' }}/>}
                  </div>
                ) : (
                  <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.54rem', letterSpacing:'0.1em', color:'#a0a09c', textAlign:'center', lineHeight:2.2, whiteSpace:'pre-line' }}>{t.outputEmpty}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background:'rgba(255,255,255,0.8)', border:'1px solid rgba(26,26,26,0.08)', borderRadius:'20px', padding:'20px 22px', backdropFilter:'blur(12px)', flexShrink:0 }}>
              <div style={{ marginBottom:'18px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                  <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.52rem', letterSpacing:'0.15em', color:'#888884', textTransform:'uppercase' }}>{t.langMatch}</p>
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.5rem', color:'#b8b8b4' }}>{langMatch}%</span>
                </div>
                <input type="range" min={0} max={100} value={langMatch}
                  onChange={e => {
                    setLangMatch(Number(e.target.value))
                    e.target.style.setProperty('--val', e.target.value + '%')
                  }}
                  style={{ width:'100%', '--val': langMatch+'%' } as React.CSSProperties}
                />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:'6px' }}>
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.46rem', color:'#c8c8c4' }}>{t.langMatchDesc[0]}</span>
                  <span style={{ fontFamily:'Space Mono,monospace', fontSize:'0.46rem', color:'#c8c8c4' }}>{t.langMatchDesc[1]}</span>
                </div>
              </div>
              <div>
                <p style={{ fontFamily:'Space Mono,monospace', fontSize:'0.52rem', letterSpacing:'0.15em', color:'#888884', textTransform:'uppercase', marginBottom:'8px' }}>{t.exportTitle}</p>
                <input type="text" value={filename} onChange={e => setFilename(e.target.value)}
                  placeholder={t.filenamePlaceholder}
                  style={{ width:'100%', padding:'8px 12px', borderRadius:'10px', border:'1px solid rgba(26,26,26,0.12)', background:'#f7f7f5', fontFamily:'Space Mono,monospace', fontSize:'0.62rem', color:'#1a1a1a', marginBottom:'10px', outline:'none' }}
                />
                <div style={{ display:'flex', gap:'8px' }}>
                  {[
                    { label: copied ? '✓' : t.copyBtn, action: handleCopy },
                    { label: t.downloadTxt, action: () => handleDownload('txt') },
                    { label: t.downloadMd,  action: () => handleDownload('md') },
                  ].map(btn => (
                    <button key={btn.label} onClick={btn.action} disabled={!output}
                      className="export-btn"
                      style={{ flex:1, padding:'8px', border:'1px solid rgba(26,26,26,0.15)', borderRadius:'10px', fontFamily:'Space Mono,monospace', fontSize:'0.54rem', letterSpacing:'0.1em', background:'transparent', color:'#1a1a1a', cursor: output?'pointer':'not-allowed', opacity: output?1:0.4 }}>
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}