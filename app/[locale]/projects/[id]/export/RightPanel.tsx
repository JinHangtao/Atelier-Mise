'use client'
import React from 'react'
import { buildExportHTML, THEMES, FONTS } from '../../../../../lib/exportStyles'
import { aspectLabel, pageHeight } from './pageHelpers'

import { PagesPanel, CoverEditor, ThemePickerPanel } from './PanelComponents'
import { DrawPanel } from './DrawPanel'
import { ExportPageState, TEXT_BLOCK_TYPES, FONT_OPTIONS, COLOR_PRESETS } from './useExportPage'
import { type TableData } from './TableBlock'
import { Aspect } from './types'
import DrawLayerPanel from './DrawLayerPanel'

const TABS = ['pages', 'blocks', 'draw', 'style'] as const
type RightTabKey = typeof TABS[number]

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '6px 0', fontSize: '0.62rem', letterSpacing: '0.14em',
  textTransform: 'uppercase', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600,
  border: 'none', cursor: 'pointer',
  borderRadius: '7px',
  background: 'transparent',
  color: active ? '#1a1a1a' : '#9a9a9a',
  position: 'relative', zIndex: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'color 0.22s cubic-bezier(0.22,1,0.36,1)',
})

export function RightPanel(s: ExportPageState) {
  const {
    rightTab, setRightTab, previewOpen, setPreviewOpen,
    activePage, activePageId, setActivePageId, pages, setPages,
    blocks, selectedBlockId, exportOpts, setExportOpts,
    pagedExport, setPagedExport, doExportHTML, allBlocksForExport,
    patchBlock, updatePageBlocks, addBlock,
    addPage, deletePage, duplicatePage, reorderPages, renamePage, changePageAspect,
    setEditingBlockId,
    isZh, project, schools, visibleSchools, schoolsExpanded, setSchoolsExpanded,
    compressImage,
    setImageEditorUrl, setImageEditorIdx,
    contentWidth, setSelectedBlockId,
  } = s

  const {
    gridState,
    addLayer, removeLayer, updateLayer, toggleLayer, clearPage,
    setEditingLayer, setDraftType,
  } = s as any

  // ── 快速插入文字 state ──
  const [quickText, setQuickText] = React.useState('')
  const [quickTextHeight, setQuickTextHeight] = React.useState(72)
  const quickDragRef = React.useRef<{ startY: number; startH: number } | null>(null)

  return (
    <div
      style={{ background: '#fff', overflowY: 'auto', WebkitOverflowScrolling: 'touch', borderLeft: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', maxHeight: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
      data-rp-scroll=""
      onDragOver={e => e.stopPropagation()} onDrop={e => e.stopPropagation()}
    >
      <style>{`
      @keyframes _rp-block-in {
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
        @keyframes _rp-tab-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes _rp-press  { 0%,100% { transform: scale(1); } 45% { transform: scale(0.96); } }
        @keyframes _rp-flash  { 0% { background: rgba(26,26,26,0.07); } 100% { background: transparent; } }
        ._rp-tab-panel { animation: _rp-tab-in 0.16s cubic-bezier(0.22,1,0.36,1) both; }
        ._rp-addblock:active { animation: _rp-press 0.18s ease; }
        ._rp-export-btn { transition: background 0.15s, transform 0.12s !important; }
        ._rp-export-btn:hover { background: #333 !important; }
        ._rp-export-btn:active { transform: scale(0.98) !important; }
        ._rp-quick-ta { resize: none; outline: none; border: none; background: transparent; width: 100%; font-family: Inter, DM Sans, sans-serif; font-size: 0.82rem; color: #1a1a1a; line-height: 1.6; padding: 0; box-sizing: border-box; }
        ._rp-quick-ta::placeholder { color: #ccc; }
        ._rp-quick-ta:focus { outline: none; }
        ._rp-drag-handle { height: 12px; cursor: ns-resize; display: flex; align-items: center; justify-content: center; margin: 0 -14px -14px; border-radius: 0 0 10px 10px; transition: background 0.12s; }
        ._rp-drag-handle:hover { background: rgba(26,26,26,0.04); }
        ._rp-drag-handle-bar { width: 28px; height: 3px; border-radius: 2px; background: rgba(26,26,26,0.12); transition: background 0.12s; }
        ._rp-drag-handle:hover ._rp-drag-handle-bar { background: rgba(26,26,26,0.28); }
        div:hover > ._media-del { opacity: 1 !important; }
        [data-rp-scroll]::-webkit-scrollbar { display: none; }
        [data-rp-scroll] { scrollbar-width: none; }
      `}</style>
      {/* Tab switcher */}
      <div style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '6px', background: 'rgba(26,26,26,0.04)', margin: '8px 10px', borderRadius: '10px' }}>
          <div style={{ flex: 1, display: 'flex', position: 'relative' }}>
            {/* Sliding pill — same coordinate system as buttons */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '0', bottom: '0',
                left: `calc(${TABS.indexOf(rightTab as RightTabKey)} * 25%)`,
                width: '25%',
                background: '#fff',
                borderRadius: '7px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 0 0 0.5px rgba(26,26,26,0.055)',
                transition: 'left 0.3s cubic-bezier(0.34,1.2,0.64,1)',
                pointerEvents: 'none',
              }}
            />
            {TABS.map(tab => (
              <button key={tab} onClick={() => setRightTab(tab)} style={tabStyle(rightTab === tab)}>
                {tab === 'pages' ? 'Pages' : tab === 'blocks' ? 'Blocks' : tab === 'draw' ? (isZh ? '画图' : 'Draw') : 'Style'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PAGES tab ── */}
      {rightTab === 'pages' && (
        <div className="_rp-tab-panel" style={{ display: 'contents' }}>
          {activePage?.isCover ? (
            <CoverEditor
              page={activePage}
              project={project!}
              onBlocksChange={blocks => updatePageBlocks(activePage.id, blocks)}
              isZh={isZh}
            />
          ) : null}
          <PagesPanel
            pages={pages}
            activePageId={activePageId}
            setActivePageId={id => { setActivePageId(id); setEditingBlockId(null) }}
            onAdd={addPage}
            onDelete={deletePage}
            onDuplicate={duplicatePage}
            onReorder={reorderPages}
            onRename={renamePage}
            onAspectChange={changePageAspect}
            isZh={isZh}
            contentWidth={contentWidth}
          />
        </div>
      )}

      {/* ── BLOCKS tab ── */}
      {rightTab === 'blocks' && (
        <div className="_rp-tab-panel" style={{ padding: '24px 20px', flex: 1 }}>

          {/* Current page label */}
          <div style={{ marginBottom: '16px', padding: '8px 12px', background: activePage?.isCover ? 'rgba(196,160,68,0.07)' : 'rgba(26,26,26,0.03)', borderRadius: '8px', border: `1px solid ${activePage?.isCover ? 'rgba(196,160,68,0.2)' : 'rgba(26,26,26,0.07)'}` }}>
            <span style={{ fontSize: '0.65rem', fontFamily: 'Space Mono, monospace', color: activePage?.isCover ? '#c4a044' : '#888', letterSpacing: '0.08em' }}>
              {activePage?.isCover ? (isZh ? '★ 封面' : '★ Cover') : activePage?.label}
              {' · '}{aspectLabel(activePage?.aspect ?? 'free')}
              {' · '}{blocks.length} {isZh ? '块' : 'block'}{blocks.length !== 1 && !isZh ? 's' : ''}
            </span>
          </div>

          {/* ── 快速插入 ── */}
          <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(26,26,26,0.025)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.07)', position: 'relative' }}>
            {/* 顶栏：标签 + 插入按钮 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600 }}>
                {isZh ? '插入' : 'Insert'}
              </span>
              <button
              onClick={() => {
  const trimmed = quickText.trim()
  console.log('[QuickInsert] clicked, trimmed:', JSON.stringify(trimmed))
  console.log('[QuickInsert] addBlock fn:', typeof addBlock)
  if (!trimmed) { console.log('[QuickInsert] early return — empty'); return }
  trimmed.split('\n').filter(l => l.trim()).forEach(line => {
    console.log('[QuickInsert] calling addBlock with:', JSON.stringify(line.trim()))
    addBlock('note', line.trim())
  })
  console.log('[QuickInsert] done, clearing text')
  setQuickText('')
}}
                disabled={!quickText.trim()}
                style={{
                  padding: '3px 10px', borderRadius: '6px', border: 'none', cursor: quickText.trim() ? 'pointer' : 'default',
                  background: quickText.trim() ? '#1a1a1a' : 'rgba(26,26,26,0.06)',
                  color: quickText.trim() ? '#fff' : '#ccc',
                  fontSize: '0.62rem', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600,
                  letterSpacing: '0.06em', transition: 'all 0.15s cubic-bezier(0.22,1,0.36,1)',
                }}
                onMouseEnter={e => { if (quickText.trim()) e.currentTarget.style.background = '#333' }}
                onMouseLeave={e => { if (quickText.trim()) e.currentTarget.style.background = '#1a1a1a' }}
              >
                {isZh ? '加入 ↵' : 'Add ↵'}
              </button>
            </div>

            {/* Textarea */}
            <textarea
              className="_rp-quick-ta"
              value={quickText}
              onChange={e => setQuickText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  const trimmed = quickText.trim()
                  if (!trimmed) return
                  trimmed.split('\n').filter(l => l.trim()).forEach(line => addBlock('note', line.trim()))
                  setQuickText('')
                }
              }}
              placeholder={isZh ? '输入任意内容，每行一个 block…\n⌘↵ 插入' : 'Type anything, one block per line…\n⌘↵ to insert'}
              style={{ height: quickTextHeight }}
            />

            {/* 拖拽调高手柄 */}
            <div
              className="_rp-drag-handle"
              onMouseDown={e => {
                e.preventDefault()
                quickDragRef.current = { startY: e.clientY, startH: quickTextHeight }
                const onMove = (ev: MouseEvent) => {
                  if (!quickDragRef.current) return
                  const delta = ev.clientY - quickDragRef.current.startY
                  setQuickTextHeight(Math.max(48, Math.min(400, quickDragRef.current.startH + delta)))
                }
                const onUp = () => {
                  quickDragRef.current = null
                  document.body.style.cursor = ''
                  document.body.style.userSelect = ''
                  window.removeEventListener('mousemove', onMove)
                  window.removeEventListener('mouseup', onUp)
                }
                document.body.style.cursor = 'ns-resize'
                document.body.style.userSelect = 'none'
                window.addEventListener('mousemove', onMove)
                window.addEventListener('mouseup', onUp)
              }}
            >
              <div className="_rp-drag-handle-bar" />
            </div>
          </div>

{/* Table style controls */}
{(() => {
  const selBlock = blocks.find(b => b.id === selectedBlockId)
  if (!selBlock || selBlock.type !== 'table') return null
  const td = selBlock.tableData as TableData
  if (!td) return null
  const lb: React.CSSProperties = { fontSize:'0.58rem', color:'#b0b0ac', fontFamily:'Inter, sans-serif', letterSpacing:'0.12em', textTransform:'uppercase', fontWeight:600, display:'block', marginBottom:'6px' }
  const btn = (active: boolean): React.CSSProperties => ({ flex:1, padding:'5px 0', borderRadius:'6px', cursor:'pointer', border:`1px solid ${active?'rgba(26,26,26,0.5)':'rgba(26,26,26,0.1)'}`, background:active?'rgba(26,26,26,0.08)':'transparent', color:active?'#1a1a1a':'#aaa', fontSize:'0.7rem', fontFamily:'Space Mono, monospace', transition:'all 0.12s' })
  const patch = (p: Partial<TableData>) => patchBlock(selBlock.id, { tableData: { ...td, ...p } })
  const addRow = () => patch({ rows: [...td.rows, td.rows[0].map(() => ({ text:'', align:'left' as const }))] })
  const delRow = () => { if (td.rows.length > 1) patch({ rows: td.rows.slice(0,-1) }) }
  const addCol = () => { const n=td.colWidths.length+1; patch({ rows:td.rows.map(r=>[...r,{text:'',align:'left' as const}]), colWidths:Array(n).fill(1/n) }) }
  const delCol = () => { if(td.colWidths.length<=1) return; const w=td.colWidths.slice(0,-1); const t2=w.reduce((a,b)=>a+b,0); patch({ rows:td.rows.map(r=>r.slice(0,-1)), colWidths:w.map(x=>x/t2) }) }
  return (
    <div style={{ marginBottom:'20px', padding:'14px', background:'rgba(26,26,26,0.03)', borderRadius:'10px', border:'1px solid rgba(26,26,26,0.07)' }}>
      <p style={{ fontSize:'0.58rem', letterSpacing:'0.2em', textTransform:'uppercase', color:'#b0b0ac', fontFamily:'Inter, DM Sans, sans-serif', fontWeight:600, marginBottom:'12px' }}>{isZh?'表格样式':'Table Style'}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        <div>
          <span style={lb}>{isZh?'行 / 列':'Rows / Cols'} · {td.rows.length} × {td.colWidths.length}</span>
          <div style={{ display:'flex', gap:'5px' }}>
            <button onClick={delRow} style={btn(false)}>− {isZh?'行':'Row'}</button>
            <button onClick={addRow} style={btn(false)}>+ {isZh?'行':'Row'}</button>
            <button onClick={delCol} style={btn(false)}>− {isZh?'列':'Col'}</button>
            <button onClick={addCol} style={btn(false)}>+ {isZh?'列':'Col'}</button>
          </div>
        </div>
        <div>
          <span style={lb}>{isZh?'表头高亮':'Header'}</span>
          <div style={{ display:'flex', gap:'5px' }}>
            <button onClick={()=>patch({headerRow:!td.headerRow})} style={btn(!!td.headerRow)}>{isZh?'首行':'First Row'}</button>
            <button onClick={()=>patch({headerCol:!td.headerCol})} style={btn(!!td.headerCol)}>{isZh?'首列':'First Col'}</button>
          </div>
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
            <span style={lb}>{isZh?'字号':'Font size'}</span>
            <span style={{ fontSize:'0.62rem', color:'#888', fontFamily:'Space Mono, monospace' }}>{td.fontSize??13}px</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
            <button onClick={()=>patch({fontSize:Math.max(8,(td.fontSize??13)-1)})} style={{ width:24,height:24,flexShrink:0,border:'1px solid rgba(26,26,26,0.12)',borderRadius:'6px',background:'transparent',color:'#888',cursor:'pointer',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
            <input type="range" min={8} max={32} value={td.fontSize??13} onChange={e=>patch({fontSize:Number(e.target.value)})} style={{ flex:1, accentColor:'#1a1a1a' }} />
            <button onClick={()=>patch({fontSize:Math.min(32,(td.fontSize??13)+1)})} style={{ width:24,height:24,flexShrink:0,border:'1px solid rgba(26,26,26,0.12)',borderRadius:'6px',background:'transparent',color:'#888',cursor:'pointer',fontSize:'0.9rem',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
          </div>
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
            <span style={lb}>{isZh?'内边距':'Padding'}</span>
            <span style={{ fontSize:'0.62rem', color:'#888', fontFamily:'Space Mono, monospace' }}>{td.cellPadding??10}px</span>
          </div>
          <input type="range" min={4} max={32} value={td.cellPadding??10} onChange={e=>patch({cellPadding:Number(e.target.value)})} style={{ width:'100%', accentColor:'#1a1a1a' }} />
        </div>
        <div>
          <span style={lb}>{isZh?'边框颜色':'Border'}</span>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
            {['rgba(26,26,26,0.12)','rgba(26,26,26,0.35)','#1a1a1a','rgba(196,160,68,0.6)','rgba(74,171,111,0.6)','transparent'].map(c=>(
              <button key={c} onClick={()=>patch({borderColor:c})} style={{ width:22,height:22,borderRadius:'50%',padding:0,cursor:'pointer',flexShrink:0,transition:'transform 0.1s', background:c==='transparent'?'repeating-linear-gradient(45deg,#ddd,#ddd 2px,#fff 2px,#fff 6px)':c, border:(td.borderColor??'rgba(26,26,26,0.12)')===c?'2px solid #1a1a1a':'1px solid rgba(26,26,26,0.12)', transform:(td.borderColor??'rgba(26,26,26,0.12)')===c?'scale(1.2)':'scale(1)' }} />
            ))}
          </div>
        </div>
        <div>
          <span style={lb}>{isZh?'字体':'Font'}</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
            {[{label:'Default',value:'Inter, DM Sans, sans-serif'},{label:'Serif',value:'Georgia, serif'},{label:'Mono',value:'"Space Mono", monospace'},{label:'宋体',value:'"Songti SC", "Noto Serif SC", serif'}].map(f=>(
              <button key={f.value} onClick={()=>patch({fontFamily:f.value})} style={{ padding:'5px 10px',borderRadius:'6px',cursor:'pointer',fontSize:'0.72rem',fontFamily:f.value,transition:'all 0.1s', border:`1px solid ${(td.fontFamily??'Inter, DM Sans, sans-serif')===f.value?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.1)'}`, background:(td.fontFamily??'Inter, DM Sans, sans-serif')===f.value?'rgba(26,26,26,0.07)':'transparent', color:(td.fontFamily??'Inter, DM Sans, sans-serif')===f.value?'#1a1a1a':'#aaa' }}>{f.label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})()}

          {/* Sticky style controls */}
          {(() => {
            const selBlock = blocks.find(b => b.id === selectedBlockId)
            if (!selBlock || selBlock.type !== 'sticky') return null

            const curColor  = (selBlock as any).stickyColor || '#fef08a'
            const curShadow = (selBlock as any).stickyShadow ?? 12
            const curSpread = (selBlock as any).stickySpread ?? 0

            // ── 预设 ──────────────────────────────────────────────────────
            const PRESETS = [
              { label: isZh ? '经典黄' : 'Classic',  bg: '#fef08a', color: '#1a1a1a', shadow: 12, fontSize: 15 },
              { label: isZh ? '薄荷绿' : 'Mint',     bg: '#86efac', color: '#1a1a1a', shadow: 12, fontSize: 15 },
              { label: isZh ? '天空蓝' : 'Sky',      bg: '#93c5fd', color: '#1a1a1a', shadow: 12, fontSize: 15 },
              { label: isZh ? '玫瑰粉' : 'Rose',     bg: '#f9a8d4', color: '#1a1a1a', shadow: 12, fontSize: 15 },
              { label: isZh ? '暗夜黑' : 'Dark',     bg: '#1a1a1a', color: '#f5f5f0', shadow: 20, fontSize: 14 },
              { label: isZh ? '纸张白' : 'Paper',    bg: '#fafaf8', color: '#1a1a1a', shadow:  6, fontSize: 15 },
              { label: isZh ? '珊瑚橙' : 'Coral',    bg: '#fdba74', color: '#1a1a1a', shadow: 12, fontSize: 15 },
              { label: isZh ? '薰衣草' : 'Lavender', bg: '#e9d5ff', color: '#4c1d95', shadow: 10, fontSize: 15 },
            ]

            const STICKY_COLORS = [
              { hex: '#fef08a' }, { hex: '#86efac' }, { hex: '#93c5fd' },
              { hex: '#f9a8d4' }, { hex: '#fca5a5' }, { hex: '#fdba74' },
              { hex: '#e9d5ff' }, { hex: '#ffffff' }, { hex: '#1a1a1a' },
              { hex: '#f0ede8' }, { hex: '#2a2a3a' }, { hex: '#fafaf8' },
            ]

            const lb: React.CSSProperties = { fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase' as const, fontWeight: 600, display: 'block', marginBottom: '8px' }

            return (
              <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(26,26,26,0.03)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.07)' }}>
                <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, marginBottom: '14px' }}>{isZh ? '便利贴样式' : 'Sticky Style'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* ── 预设 ── */}
                  <div>
                    <span style={lb}>{isZh ? '预设' : 'Presets'}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
                      {PRESETS.map(p => (
                        <button key={p.label}
                          onClick={() => patchBlock(selBlock.id, { stickyColor: p.bg, color: p.color, stickyShadow: p.shadow, fontSize: p.fontSize } as any)}
                          title={p.label}
                          style={{
                            height: 32, borderRadius: '8px', border: '1.5px solid',
                            borderColor: curColor === p.bg ? '#1a1a1a' : 'rgba(26,26,26,0.1)',
                            background: p.bg, cursor: 'pointer', padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.55rem', color: p.color, fontFamily: 'Inter, sans-serif',
                            fontWeight: 600, letterSpacing: '0.04em',
                            boxShadow: curColor === p.bg ? '0 0 0 1.5px #1a1a1a' : 'none',
                            transition: 'all 0.12s',
                            outline: p.bg === '#ffffff' || p.bg === '#fafaf8' ? '1px solid rgba(26,26,26,0.08)' : 'none',
                          }}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── 背景色 ── */}
                  <div>
                    <span style={lb}>{isZh ? '背景色' : 'Background'}</span>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {STICKY_COLORS.map(({ hex }) => (
                        <button key={hex}
                          onClick={() => patchBlock(selBlock.id, { stickyColor: hex } as any)}
                          style={{
                            width: 22, height: 22, borderRadius: '6px', border: 'none', cursor: 'pointer',
                            background: hex, flexShrink: 0, padding: 0,
                            boxShadow: curColor === hex ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)',
                            transform: curColor === hex ? 'scale(1.18)' : 'scale(1)',
                            transition: 'transform 0.1s, box-shadow 0.1s',
                            outline: hex === '#ffffff' || hex === '#fafaf8' ? '1px solid rgba(26,26,26,0.1)' : 'none',
                          }}
                        />
                      ))}
                      <label style={{ width: 22, height: 22, borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', flexShrink: 0, background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}>
                        <input type="color" value={curColor}
                          onChange={e => patchBlock(selBlock.id, { stickyColor: e.target.value } as any)}
                          style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                      </label>
                    </div>
                  </div>

                  {/* ── 阴影 ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ ...lb, marginBottom: 0 }}>{isZh ? '阴影强度' : 'Shadow'}</span>
                      <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{curShadow}</span>
                    </div>
                    <input type="range" min={0} max={40} value={curShadow}
                      onChange={e => patchBlock(selBlock.id, { stickyShadow: Number(e.target.value) } as any)}
                      style={{ width: '100%', accentColor: '#1a1a1a' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      {[0, 6, 12, 24, 40].map(v => (
                        <button key={v} onClick={() => patchBlock(selBlock.id, { stickyShadow: v } as any)}
                          style={{ fontSize: '0.55rem', color: curShadow === v ? '#1a1a1a' : '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', padding: '2px 4px', transition: 'color 0.1s' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── 阴影扩散 ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ ...lb, marginBottom: 0 }}>{isZh ? '阴影扩散' : 'Spread'}</span>
                      <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{curSpread}</span>
                    </div>
                    <input type="range" min={0} max={200} value={curSpread}
                      onChange={e => patchBlock(selBlock.id, { stickySpread: Number(e.target.value) } as any)}
                      style={{ width: '100%', accentColor: '#1a1a1a' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                      {[0, 50, 100, 150, 200].map(v => (
                        <button key={v} onClick={() => patchBlock(selBlock.id, { stickySpread: v } as any)}
                          style={{ fontSize: '0.55rem', color: curSpread === v ? '#1a1a1a' : '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', padding: '2px 4px', transition: 'color 0.1s' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ── 字号 ── */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ ...lb, marginBottom: 0 }}>{isZh ? '字号' : 'Font size'}</span>
                      <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{selBlock.fontSize || 15}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => patchBlock(selBlock.id, { fontSize: Math.max(10, (selBlock.fontSize || 15) - 1) })}
                        style={{ width: 24, height: 24, flexShrink: 0, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <input type="range" min={10} max={40} value={selBlock.fontSize || 15}
                        onChange={e => patchBlock(selBlock.id, { fontSize: Number(e.target.value) })}
                        style={{ flex: 1, accentColor: '#1a1a1a' }} />
                      <button onClick={() => patchBlock(selBlock.id, { fontSize: Math.min(40, (selBlock.fontSize || 15) + 1) })}
                        style={{ width: 24, height: 24, flexShrink: 0, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>

                  {/* ── 文字颜色 ── */}
                  <div>
                    <span style={lb}>{isZh ? '文字颜色' : 'Text color'}</span>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {['#1a1a1a', '#444444', '#888888', '#ffffff', '#4c1d95', '#1e3a5f'].map(c => (
                        <button key={c} onClick={() => patchBlock(selBlock.id, { color: c })}
                          style={{ width: 22, height: 22, borderRadius: '50%', border: (selBlock.color || '#1a1a1a') === c ? '2px solid #1a1a1a' : '1px solid rgba(26,26,26,0.12)', background: c, cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'transform 0.1s', transform: (selBlock.color || '#1a1a1a') === c ? 'scale(1.2)' : 'scale(1)', outline: c === '#ffffff' ? '1px solid rgba(26,26,26,0.12)' : 'none' }} />
                      ))}
                      <input type="color" value={selBlock.color || '#1a1a1a'}
                        onChange={e => patchBlock(selBlock.id, { color: e.target.value })}
                        style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', cursor: 'pointer', background: 'none', padding: 0 }} />
                    </div>
                  </div>

                </div>
              </div>
            )
          })()}

          {/* Text style controls */}
          {(() => {
            const selBlock = blocks.find(b => b.id === selectedBlockId)
            if (!selBlock || !TEXT_BLOCK_TYPES.includes(selBlock.type)) return null
            return (
              <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(26,26,26,0.03)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.07)' }}>
                <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, marginBottom: '12px' }}>{isZh ? '文字样式' : 'Text Style'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Font size */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{isZh ? '字号' : 'Font size'}</span>
                      <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{selBlock.fontSize || 16}px</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={() => patchBlock(selBlock.id, { fontSize: Math.max(8, (selBlock.fontSize || 16) - 1) })}
                        style={{ width: '24px', height: '24px', flexShrink: 0, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <input type="range" min={8} max={96} value={selBlock.fontSize || 16}
                        onChange={e => patchBlock(selBlock.id, { fontSize: Number(e.target.value) })}
                        style={{ flex: 1, accentColor: '#1a1a1a' }} />
                      <button onClick={() => patchBlock(selBlock.id, { fontSize: Math.min(96, (selBlock.fontSize || 16) + 1) })}
                        style={{ width: '24px', height: '24px', flexShrink: 0, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                  {/* Font family */}
                  <div>
                    <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{isZh ? '字体' : 'Font'}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      <button onClick={() => patchBlock(selBlock.id, { fontFamily: undefined })}
                        style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${!selBlock.fontFamily ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, background: !selBlock.fontFamily ? 'rgba(26,26,26,0.07)' : 'transparent', color: !selBlock.fontFamily ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontSize: '0.72rem', fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.1s' }}>
                        {isZh ? '默认' : 'Default'}
                      </button>
                      {FONT_OPTIONS.map(f => (
                        <button key={f.value} onClick={() => patchBlock(selBlock.id, { fontFamily: f.value })}
                          style={{ padding: '5px 10px', borderRadius: '6px', border: `1px solid ${selBlock.fontFamily === f.value ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, background: selBlock.fontFamily === f.value ? 'rgba(26,26,26,0.07)' : 'transparent', color: selBlock.fontFamily === f.value ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontSize: '0.72rem', fontFamily: f.value, transition: 'all 0.1s' }}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Color */}
                  <div>
                    <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>{isZh ? '颜色' : 'Color'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {COLOR_PRESETS.map(c => (
                        <button key={c} onClick={() => patchBlock(selBlock.id, { color: c })}
                          style={{ width: '22px', height: '22px', borderRadius: '50%', border: (selBlock.color || '#1a1a1a') === c ? '2px solid #1a1a1a' : '1px solid rgba(26,26,26,0.12)', background: c, cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'transform 0.1s', transform: (selBlock.color || '#1a1a1a') === c ? 'scale(1.2)' : 'scale(1)', outline: c === '#ffffff' ? '1px solid rgba(26,26,26,0.12)' : 'none' }} />
                      ))}
                      <input type="color" value={selBlock.color || '#1a1a1a'}
                        onChange={e => patchBlock(selBlock.id, { color: e.target.value })}
                        style={{ width: 26, height: 26, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', cursor: 'pointer', background: 'none', padding: 0 }} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Image style controls */}
          {(() => {
            const selBlock = blocks.find(b => b.id === selectedBlockId)
            if (!selBlock || selBlock.type !== 'image') return null
            return (
              <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(26,26,26,0.03)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.07)' }}>
                <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, marginBottom: '12px' }}>{isZh ? '图片样式' : 'Image Style'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '5px' }}>{isZh ? '填充模式' : 'Fit'}</span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {(['cover', 'contain'] as const).map(fit => (
                        <button key={fit} onClick={() => patchBlock(selBlock.id, { imgFit: fit })}
                          style={{ flex: 1, padding: '6px 0', border: `1px solid ${(selBlock.imgFit ?? 'cover') === fit ? 'rgba(26,26,26,0.5)' : 'rgba(26,26,26,0.1)'}`, borderRadius: '6px', background: (selBlock.imgFit ?? 'cover') === fit ? 'rgba(26,26,26,0.08)' : 'transparent', color: (selBlock.imgFit ?? 'cover') === fit ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', transition: 'all 0.12s' }}>
                          {fit === 'cover' ? (isZh ? '填充' : 'Fill') : (isZh ? '完整' : 'Fit')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(selBlock.imgFit ?? 'cover') === 'cover' && (
                    <>
                      {[{ label: isZh ? '焦点 X' : 'Focus X', key: 'imgOffsetX' as const }, { label: isZh ? '焦点 Y' : 'Focus Y', key: 'imgOffsetY' as const }].map(({ label, key }) => (
                        <div key={key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                            <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{(selBlock as any)[key] ?? 0}</span>
                          </div>
                          <input type="range" min={-50} max={50} value={(selBlock as any)[key] ?? 0}
                            onChange={e => patchBlock(selBlock.id, { [key]: Number(e.target.value) })}
                            style={{ width: '100%', accentColor: '#1a1a1a' }} />
                        </div>
                      ))}
                    </>
                  )}
                  {/* Remove background */}
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => {
                        const url = selBlock.content
                        if (url) (s as any).removeBackground(selBlock.id, url)
                      }}
                      disabled={!!(s as any).removingBgBlockId}
                      style={{ flex: 1, padding: '7px 0', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '7px', background: 'transparent', color: (s as any).removingBgBlockId === selBlock.id ? '#aaa' : '#1a1a1a', cursor: (s as any).removingBgBlockId ? 'default' : 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', transition: 'all 0.12s' }}
                      onMouseEnter={e => { if (!(s as any).removingBgBlockId) e.currentTarget.style.background = 'rgba(26,26,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {(s as any).removingBgBlockId === selBlock.id
                        ? (isZh ? '抠图中…' : 'Removing…')
                        : (isZh ? '✂ 去除背景' : '✂ Remove BG')}
                    </button>
                    <button
                      onClick={() => { setImageEditorUrl(selBlock.content); setImageEditorIdx(null) }}
                      style={{ flex: 1, padding: '7px 0', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '7px', background: 'transparent', color: '#1a1a1a', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', transition: 'all 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      {isZh ? '✏ 编辑' : '✏ Edit'}
                    </button>
                  </div>
                  {[
                    { label: isZh ? '圆角' : 'Radius', key: 'imgRadius' as const, min: 0, max: 50, unit: 'px' },
                    { label: isZh ? '阴影' : 'Shadow', key: 'imgShadow' as const, min: 0, max: 40, unit: '' },
                    { label: isZh ? '虚化' : 'Blur',   key: 'imgBlur'   as const, min: 0, max: 20, unit: 'px' },
                  ].map(({ label, key, min, max, unit }) => (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: '0.62rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{(selBlock as any)[key] ?? 0}{unit}</span>
                      </div>
                      <input type="range" min={min} max={max} value={(selBlock as any)[key] ?? 0}
                        onChange={e => patchBlock(selBlock.id, { [key]: Number(e.target.value) })}
                        style={{ width: '100%', accentColor: '#1a1a1a' }} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Position & Size */}
          {(() => {
            const selBlock = blocks.find(b => b.id === selectedBlockId)
            if (!selBlock?.pixelPos) return null
            const pos = selBlock.pixelPos
            const numInput = (label: string, value: number, key: 'x' | 'y' | 'w' | 'h', min: number) => (
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: '0.5rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.1em', display: 'block', marginBottom: '3px' }}>{label}</span>
                <input type="number" value={value} min={min}
                  onChange={e => patchBlock(selBlock.id, { pixelPos: { ...pos, [key]: Math.max(min, Number(e.target.value) || 0) } })}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation() }}
                  style={{ width: '100%', padding: '5px 7px', border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px', background: '#fafaf8', fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )
            return (
              <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(26,26,26,0.03)', borderRadius: '10px', border: '1px solid rgba(26,26,26,0.07)' }}>
                <p style={{ fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600, marginBottom: '12px' }}>{isZh ? '位置 & 尺寸' : 'Position & Size'}</p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  {numInput('X', pos.x, 'x', 0)}{numInput('Y', pos.y, 'y', 0)}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                  {numInput('W', pos.w, 'w', 20)}{numInput('H', pos.h, 'h', 20)}
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.5rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace' }}>{isZh ? '宽度' : 'Width'}</span>
                    <span style={{ fontSize: '0.5rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{pos.w}px</span>
                  </div>
                  <input type="range" min={20} max={contentWidth * 2} value={pos.w}
                    onChange={e => patchBlock(selBlock.id, { pixelPos: { ...pos, w: Number(e.target.value) } })}
                    style={{ width: '100%', accentColor: '#1a1a1a' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <span style={{ fontSize: '0.5rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace' }}>{isZh ? '高度' : 'Height'}</span>
                    <span style={{ fontSize: '0.5rem', color: '#888', fontFamily: 'Space Mono, monospace' }}>{pos.h}px</span>
                  </div>
                  <input type="range" min={20} max={3000} value={pos.h}
                    onChange={e => patchBlock(selBlock.id, { pixelPos: { ...pos, h: Number(e.target.value) } })}
                    style={{ width: '100%', accentColor: '#1a1a1a' }} />
                </div>
              </div>
            )
          })()}

          <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />

          {/* Images section */}
          <div style={{ marginBottom: '24px' }}>
            {(() => {
              const imgBlocks = blocks.filter(b => b.type === 'image' || b.type === 'image-row')
              return (
                <div>
                  <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '图片' : 'Images'}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    <label
                      style={{ width: 64, height: 64, borderRadius: '8px', border: '1.5px dashed rgba(26,26,26,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'border-color 0.12s, background 0.12s', background: 'transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.35)'; e.currentTarget.style.background = 'rgba(26,26,26,0.02)' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(26,26,26,0.15)'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: '1.4rem', color: '#ccc', lineHeight: 1, userSelect: 'none' }}>+</span>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                        onChange={e => {
                          const files = Array.from(e.target.files ?? [])
                          if (!files.length) return
                          files.forEach(file => {
                            const reader = new FileReader()
                            reader.onload = ev => {
                              const dataUrl = ev.target?.result as string
                              if (dataUrl) compressImage(dataUrl, 2400, 0.88).then(compressed => addBlock('image', compressed))
                            }
                            reader.readAsDataURL(file)
                          })
                          e.target.value = ''
                        }}
                      />
                    </label>
                    {imgBlocks.map(b => {
                      const src = b.type === 'image-row' ? (b.images?.[0] ?? b.content) : b.content
                      return (
                        <div
                          key={b.id}
                          onClick={() => setSelectedBlockId(b.id)}
                          style={{ width: 64, height: 64, borderRadius: '8px', overflow: 'hidden', border: selectedBlockId === b.id ? '2px solid #1a1a1a' : '1px solid rgba(26,26,26,0.1)', cursor: 'pointer', flexShrink: 0, position: 'relative', background: '#f0ede8', transition: 'border-color 0.12s' }}
                          onMouseEnter={e => { if (selectedBlockId !== b.id) e.currentTarget.style.borderColor = 'rgba(26,26,26,0.3)' }}
                          onMouseLeave={e => { if (selectedBlockId !== b.id) e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)' }}
                        >
                          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          {b.type === 'image-row' && b.images && b.images.length > 1 && (
                            <div style={{ position: 'absolute', bottom: 3, right: 4, fontSize: '0.5rem', color: '#fff', background: 'rgba(0,0,0,0.45)', borderRadius: '3px', padding: '1px 4px', fontFamily: 'Space Mono, monospace', lineHeight: 1.4 }}>
                              ×{b.images.length}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Page background picker */}
          {activePage && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '页面背景' : 'Background'}</p>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  { color: '#ffffff', label: isZh ? '白' : 'White' },
                  { color: '#f7f7f5', label: isZh ? '暖白' : 'Warm' },
                  { color: '#f0ede8', label: isZh ? '米' : 'Cream' },
                  { color: '#1a1a1a', label: isZh ? '黑' : 'Black' },
                  { color: '#2a2a3a', label: isZh ? '深蓝' : 'Navy' },
                  { color: '#1a2a1a', label: isZh ? '深绿' : 'Forest' },
                ].map(({ color, label }) => {
                  const isActive = (activePage.background || '#ffffff') === color
                  return (
                    <button key={color} title={label}
                      onClick={() => setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, background: color } : p))}
                      style={{ width: '28px', height: '28px', borderRadius: '7px', background: color, border: 'none', cursor: 'pointer', flexShrink: 0, boxShadow: isActive ? '0 0 0 2px #1a1a1a, 0 0 0 3.5px #fff' : '0 0 0 1px rgba(26,26,26,0.14)', transition: 'box-shadow 0.12s' }} />
                  )
                })}
                <label title={isZh ? '自定义颜色' : 'Custom color'}
                  style={{ width: '28px', height: '28px', borderRadius: '7px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, position: 'relative', boxShadow: '0 0 0 1px rgba(26,26,26,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}>
                  <input type="color" value={activePage.background || '#ffffff'}
                    onChange={e => setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, background: e.target.value } : p))}
                    style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
                </label>
                {activePage.background && activePage.background !== '#ffffff' && (
                  <button onClick={() => setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, background: '#ffffff' } : p))} title={isZh ? '重置' : 'Reset'}
                    style={{ fontSize: '0.6rem', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', padding: '0 2px', letterSpacing: '0.04em' }}>↺</button>
                )}
              </div>

              {/* Background image */}
              <div style={{ marginTop: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>{isZh ? '背景图片' : 'Background image'}</span>
                  {activePage.backgroundImage && (
                    <button onClick={() => setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, backgroundImage: undefined, bgSize: undefined, bgPosition: undefined } : p))}
                      style={{ fontSize: '0.55rem', color: '#e05c5c', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', padding: '0' }}>
                      {isZh ? '移除' : 'Remove'}
                    </button>
                  )}
                </div>
                {/* Current bg preview + size controls */}
                {activePage.backgroundImage && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
                      <img src={activePage.backgroundImage} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {(['cover', 'contain', '100% 100%'] as const).map(sz => (
                        <button key={sz} onClick={() => setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, bgSize: sz } : p))}
                          style={{ flex: 1, padding: '4px 0', border: `1px solid ${(activePage.bgSize || 'cover') === sz ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, borderRadius: '5px', background: (activePage.bgSize || 'cover') === sz ? 'rgba(26,26,26,0.06)' : 'transparent', color: (activePage.bgSize || 'cover') === sz ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.55rem' }}>
                          {sz === 'cover' ? (isZh ? '填充' : 'Cover') : sz === 'contain' ? (isZh ? '完整' : 'Contain') : (isZh ? '拉伸' : 'Stretch')}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload button */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px dashed rgba(26,26,26,0.15)', borderRadius: '8px', cursor: 'pointer', transition: 'border-color 0.12s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.15)')}>
                  <span style={{ fontSize: '0.75rem', color: '#ccc' }}>+</span>
                  <span style={{ fontSize: '0.72rem', color: '#aaa', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '上传背景图' : 'Upload background'}</span>
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]; if (!file) return
                      const reader = new FileReader()
                      reader.onload = ev => {
                        const dataUrl = ev.target?.result as string
                        if (dataUrl) compressImage(dataUrl, 2400, 0.88).then(compressed => {
                          setPages(prev => prev.map(p => p.id === activePage.id ? { ...p, backgroundImage: compressed } : p))
                        })
                      }
                      reader.readAsDataURL(file)
                      e.target.value = ''
                    }} />
                </label>

                
              </div>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />

          {/* ── Grid System ── */}
          {gridState && activePageId && (() => {
            const pageId: string = activePageId
            const layers: any[] = gridState.pages?.[pageId] ?? []
            const editingId: string | null = gridState.editingLayerId
            const draftType: string = gridState.draftType ?? 'column'
            const editingLayer = layers.find((l: any) => l.id === editingId) ?? null

            const GRID_TYPES = [
              { key: 'column',   labelZh: '列网格',   labelEn: 'Column',   descZh: '对齐到列',      descEn: 'Align columns' },
              { key: 'baseline', labelZh: '基线网格', labelEn: 'Baseline', descZh: '文字行高',      descEn: 'Type rhythm' },
              { key: 'table',    labelZh: '表格参考', labelEn: 'Table',    descZh: '行列参考线',    descEn: 'Row/col guide' },
            ] as const

            const lb: React.CSSProperties = { fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }

            const sliderRow = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, step = 1) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={lb}>{label}</span>
                <input type="range" min={min} max={max} step={step} value={value}
                  onChange={e => onChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#1a1a1a', height: 2 }} />
                <span style={{ fontSize: '0.58rem', color: '#888', fontFamily: 'Space Mono, monospace', width: 26, textAlign: 'right', flexShrink: 0 }}>{value}</span>
              </div>
            )

            const typeIcon = (key: string, isOn: boolean) => {
              if (key === 'column') return (
                <svg width="20" height="14" viewBox="0 0 20 14">
                  {[0,1,2,3].map(i => <rect key={i} x={i*5+0.5} y={0} width={4} height={14} rx={1} fill={isOn ? '#1a1a1a' : '#d0d0cc'} fillOpacity={isOn ? 0.18 : 1} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.5} />)}
                </svg>
              )
              if (key === 'baseline') return (
                <svg width="20" height="14" viewBox="0 0 20 14">
                  {[0,1,2,3,4].map(i => <line key={i} x1={0} y1={i*3+1.5} x2={20} y2={i*3+1.5} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.75} />)}
                </svg>
              )
              // table
              return (
                <svg width="20" height="14" viewBox="0 0 20 14">
                  <rect x={0.5} y={0.5} width={19} height={3.5} rx={0.8} fill={isOn ? '#1a1a1a' : '#d0d0cc'} fillOpacity={isOn ? 0.25 : 1} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.5} />
                  {[0,1].map(r => [0,1,2].map(c => <rect key={`${r}${c}`} x={c*6.5+0.5} y={r*4.5+5} width={5.5} height={3.5} rx={0.5} fill={isOn ? '#1a1a1a' : '#e8e8e4'} fillOpacity={isOn ? 0.1 : 1} stroke={isOn ? '#1a1a1a' : '#d0d0cc'} strokeWidth={0.5} />))}
                </svg>
              )
            }

            const layerTypeColor: Record<string, string> = {
              column:   'rgba(99,102,241,0.7)',
              baseline: 'rgba(16,185,129,0.7)',
              table:    'rgba(245,158,11,0.7)',
            }

            return (
              <div style={{ marginBottom: '24px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                    {isZh ? '网格' : 'Grid'}{layers.length > 0 && <span style={{ color: '#d0d0cc', marginLeft: 4 }}>({layers.length})</span>}
                  </p>
                  {layers.length > 0 && (
                    <button onClick={() => clearPage(pageId)}
                      style={{ fontSize: '0.55rem', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', padding: 0, transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e05c5c')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}
                    >{isZh ? '清空 ×' : 'Clear ×'}</button>
                  )}
                </div>

                {/* Existing layers list */}
                {layers.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px' }}>
                    {layers.map((layer: any) => {
                      const isEditing = editingId === layer.id
                      const accent = layerTypeColor[layer.type] ?? '#888'
                      const typeLabel = GRID_TYPES.find(g => g.key === layer.type)
                      return (
                        <div key={layer.id}>
                          {/* Layer row */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '8px', border: `1px solid ${isEditing ? 'rgba(26,26,26,0.2)' : 'rgba(26,26,26,0.07)'}`, background: isEditing ? 'rgba(26,26,26,0.03)' : 'transparent', transition: 'all 0.12s' }}>
                            {/* Visibility dot */}
                            <button onClick={() => toggleLayer(pageId, layer.id)}
                              title={layer.visible ? (isZh ? '隐藏' : 'Hide') : (isZh ? '显示' : 'Show')}
                              style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer', background: layer.visible ? accent : 'rgba(26,26,26,0.15)', transition: 'background 0.15s' }} />
                            {/* Type badge */}
                            <span style={{ fontSize: '0.58rem', fontFamily: 'Space Mono, monospace', color: layer.visible ? '#555' : '#bbb', flex: 1, letterSpacing: '0.04em' }}>
                              {isZh ? typeLabel?.labelZh : typeLabel?.labelEn}
                              {layer.type === 'column' && <span style={{ color: '#bbb' }}> ·{layer.columns}col</span>}
                              {layer.type === 'baseline' && <span style={{ color: '#bbb' }}> ·{layer.lineHeight}px</span>}
                              {layer.type === 'table' && <span style={{ color: '#bbb' }}> ·{layer.rows}×{layer.columns}</span>}
                            </span>
                            {/* Edit toggle */}
                            <button onClick={() => setEditingLayer(isEditing ? null : layer.id)}
                              style={{ fontSize: '0.55rem', color: isEditing ? '#1a1a1a' : '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontFamily: 'Space Mono, monospace', transition: 'color 0.12s' }}>
                              {isEditing ? '▲' : '▼'}
                            </button>
                            {/* Delete */}
                            <button onClick={() => removeLayer(pageId, layer.id)}
                              style={{ fontSize: '0.65rem', color: '#ccc', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1, transition: 'color 0.12s' }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#e05c5c')}
                              onMouseLeave={e => (e.currentTarget.style.color = '#ccc')}>×</button>
                          </div>

                          {/* Inline editor for this layer */}
                          {isEditing && (
                            <div style={{ padding: '10px 12px', background: 'rgba(26,26,26,0.025)', borderRadius: '0 0 8px 8px', border: '1px solid rgba(26,26,26,0.07)', borderTop: 'none', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                              {layer.type === 'column' && (<>
                                {sliderRow(isZh ? '列数' : 'Cols',   layer.columns,     1,    24,  v => updateLayer(pageId, layer.id, { columns: v }))}
                                {sliderRow(isZh ? '间距' : 'Gutter', layer.gutter,      0,    80,  v => updateLayer(pageId, layer.id, { gutter: v }))}
                                {sliderRow(isZh ? '边距' : 'Margin', layer.margin,      0,    120, v => updateLayer(pageId, layer.id, { margin: v }))}
                                {sliderRow(isZh ? '线宽' : 'Stroke', layer.strokeWidth, 0.25, 4,   v => updateLayer(pageId, layer.id, { strokeWidth: v }), 0.25)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={lb}>{isZh ? '颜色' : 'Color'}</span>
                                  <input type="color"
                                    value={'#' + (layer.color.match(/\d+/g) ?? ['99','102','241']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                                    onChange={e => { const h = e.target.value; const r=parseInt(h.slice(1,3),16),g2=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); updateLayer(pageId, layer.id, { color: `rgba(${r},${g2},${b},0.15)` }) }}
                                    style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0 }} />
                                </div>
                              </>)}
                              {layer.type === 'baseline' && (<>
                                {sliderRow(isZh ? '行高' : 'Height', layer.lineHeight,  2,    64,  v => updateLayer(pageId, layer.id, { lineHeight: v }))}
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {[4,6,8,10,12,16,20,24].map((v: number) => (
                                    <button key={v} onClick={() => updateLayer(pageId, layer.id, { lineHeight: v })}
                                      style={{ padding: '2px 6px', borderRadius: '5px', border: `1px solid ${layer.lineHeight === v ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, background: layer.lineHeight === v ? 'rgba(26,26,26,0.07)' : 'transparent', color: layer.lineHeight === v ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', transition: 'all 0.1s' }}>{v}</button>
                                  ))}
                                </div>
                                {sliderRow(isZh ? '线宽' : 'Stroke', layer.strokeWidth, 0.25, 4,   v => updateLayer(pageId, layer.id, { strokeWidth: v }), 0.25)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={lb}>{isZh ? '颜色' : 'Color'}</span>
                                  <input type="color"
                                    value={'#' + (layer.color.match(/\d+/g) ?? ['16','185','129']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                                    onChange={e => { const h = e.target.value; const r=parseInt(h.slice(1,3),16),g2=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); updateLayer(pageId, layer.id, { color: `rgba(${r},${g2},${b},0.2)` }) }}
                                    style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0 }} />
                                </div>
                              </>)}
                              {layer.type === 'table' && (<>
                                {sliderRow(isZh ? '行数' : 'Rows',   layer.rows,        1,    20,  v => updateLayer(pageId, layer.id, { rows: v }))}
                                {sliderRow(isZh ? '列数' : 'Cols',   layer.columns,     1,    24,  v => updateLayer(pageId, layer.id, { columns: v }))}
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                  {([{r:2,c:2},{r:3,c:3},{r:4,c:4},{r:3,c:4},{r:5,c:5},{r:6,c:3}] as const).map(({r,c}) => {
                                    const on = layer.rows===r && layer.columns===c
                                    return <button key={`${r}x${c}`} onClick={() => updateLayer(pageId, layer.id, { rows: r, columns: c })}
                                      style={{ padding:'2px 7px', borderRadius:'5px', border:`1px solid ${on?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.1)'}`, background:on?'rgba(26,26,26,0.07)':'transparent', color:on?'#1a1a1a':'#aaa', cursor:'pointer', fontFamily:'Space Mono, monospace', fontSize:'0.58rem', transition:'all 0.1s' }}>{r}×{c}</button>
                                  })}
                                </div>
                                {sliderRow(isZh ? '线宽' : 'Stroke', layer.strokeWidth, 0.25, 4,   v => updateLayer(pageId, layer.id, { strokeWidth: v }), 0.25)}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={lb}>{isZh ? '颜色' : 'Color'}</span>
                                  <input type="color"
                                    value={'#' + (layer.color.match(/\d+/g) ?? ['99','102','241']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                                    onChange={e => { const h = e.target.value; const r=parseInt(h.slice(1,3),16),g2=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16); updateLayer(pageId, layer.id, { color: `rgba(${r},${g2},${b},0.25)` }) }}
                                    style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0 }} />
                                  {[{rgba:'rgba(99,102,241,0.25)',hex:'#6366f1'},{rgba:'rgba(16,185,129,0.25)',hex:'#10b981'},{rgba:'rgba(245,158,11,0.25)',hex:'#f59e0b'},{rgba:'rgba(239,68,68,0.25)',hex:'#ef4444'},{rgba:'rgba(26,26,26,0.15)',hex:'#1a1a1a'}].map(({rgba,hex}) => (
                                    <button key={hex} onClick={() => updateLayer(pageId, layer.id, { color: rgba })}
                                      style={{ width:16, height:16, borderRadius:'50%', border: layer.color===rgba?'2px solid #1a1a1a':'1px solid rgba(26,26,26,0.12)', background:hex, cursor:'pointer', padding:0, flexShrink:0, transition:'transform 0.1s', transform:layer.color===rgba?'scale(1.25)':'scale(1)' }} />
                                  ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em' }}>{isZh ? '表头行' : 'Header row'}</span>
                                  <button onClick={() => updateLayer(pageId, layer.id, { showHeader: !layer.showHeader })}
                                    style={{ padding:'3px 10px', borderRadius:'6px', border:`1px solid ${layer.showHeader?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.1)'}`, background:layer.showHeader?'rgba(26,26,26,0.07)':'transparent', color:layer.showHeader?'#1a1a1a':'#aaa', cursor:'pointer', fontFamily:'Space Mono, monospace', fontSize:'0.58rem', transition:'all 0.12s' }}>
                                    {layer.showHeader?(isZh?'开 ●':'ON ●'):(isZh?'关 ○':'OFF ○')}
                                  </button>
                                </div>

                              </>)}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Add new layer section */}
                <div style={{ padding: '10px 12px', background: 'rgba(26,26,26,0.025)', borderRadius: '9px', border: '1px dashed rgba(26,26,26,0.1)' }}>
                  <p style={{ fontSize: '0.52rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#c0c0bc', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '8px' }}>
                    {isZh ? '添加网格层' : 'Add layer'}
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginBottom: '8px' }}>
                    {GRID_TYPES.map(g => {
                      const isSelected = draftType === g.key
                      return (
                        <button key={g.key} onClick={() => setDraftType(g.key as any)}
                          style={{ padding: '7px 4px 6px', border: `1px solid ${isSelected ? 'rgba(26,26,26,0.35)' : 'rgba(26,26,26,0.08)'}`, borderRadius: '7px', background: isSelected ? 'rgba(26,26,26,0.05)' : 'transparent', cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s' }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(26,26,26,0.03)' }}
                          onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>{typeIcon(g.key, isSelected)}</div>
                          <span style={{ fontSize: '0.55rem', fontFamily: 'Inter, DM Sans, sans-serif', color: isSelected ? '#1a1a1a' : '#aaa', fontWeight: isSelected ? 600 : 400, display: 'block' }}>
                            {isZh ? g.labelZh : g.labelEn}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => addLayer(pageId, draftType as any)}
                    style={{ width: '100%', padding: '7px 0', borderRadius: '7px', border: '1px solid rgba(26,26,26,0.15)', background: 'rgba(26,26,26,0.05)', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'Inter, DM Sans, sans-serif', color: '#1a1a1a', fontWeight: 500, transition: 'background 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.09)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.05)')}
                  >
                    <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>+</span>
                    {isZh ? `添加${GRID_TYPES.find(g=>g.key===draftType)?.labelZh ?? ''}层` : `Add ${GRID_TYPES.find(g=>g.key===draftType)?.labelEn ?? ''} layer`}
                  </button>
                </div>
              </div>
            )
          })()}

          {/* Add Block section */}
          <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '16px' }} />
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '添加块' : 'Add Block'}</p>
            {/* Sticky note */}
            <div
              className="_rp-addblock"
              onClick={() => addBlock('sticky' as any, '', { pixelPos: { x: 60, y: 60, w: 200, h: 200 }, stickyColor: '#fef08a' } as any)}
              style={{ padding: '9px 13px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#666', lineHeight: 1.55, transition: 'background 0.12s', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>🗒️</span>
              {isZh ? '便利贴' : 'Sticky Note'}
            </div>
            {/* Emoji block button */}
            <div
              className="_rp-addblock"
              onClick={e => {
                const openFn = (s as any).openEmojiFromToolbar
                if (typeof openFn === 'function') {
                  openFn((e.currentTarget as HTMLElement).getBoundingClientRect())
                }
              }}
              style={{ padding: '9px 13px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#666', lineHeight: 1.55, transition: 'background 0.12s', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>🙂</span>
              {isZh ? 'Emoji' : 'Emoji'}
            </div>
          </div>

          {/* Notes */}
          {(project?.notes || []).length > 0 && (
            <>
              <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />
              <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '笔记' : 'Notes'}</p>
                {(project?.notes || []).map(n => (
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

          {/* Schools */}
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
                  {visibleSchools.map(sc => (
                    <div key={sc.id} className="school-item _rp-addblock" onClick={() => addBlock('school-profile', sc.id)}
                      style={{ padding: '10px 13px', border: '1px solid rgba(26,26,26,0.09)', borderLeft: '2.5px solid rgba(196,160,68,0.45)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s', background: 'transparent' }}>
                      <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.8rem', color: '#1a1a1a', fontWeight: 600, marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {isZh ? (sc.nameZh || sc.name) : sc.name}
                      </p>
                      {(isZh ? (sc.departmentZh || sc.department) : sc.department) && (
                        <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', color: '#bbb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {isZh ? (sc.departmentZh || sc.department) : sc.department}
                        </p>
                      )}
                      {sc.aiStatement && <p style={{ fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.68rem', color: '#4aab6f', marginTop: '3px' }}>✓ {isZh ? '有文书' : 'has statement'}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── DRAW tab ── */}
      {/* 用 display 控制而非条件渲染，保证组件不被销毁重建，图层状态不丢失 */}
      <div style={{ display: rightTab === 'draw' ? 'flex' : 'none', flexDirection: 'column' }}>
        <DrawLayerPanel
          isZh={isZh}
          activePageId={activePageId}
        />
        <DrawPanel
          isZh={isZh}
          canvasWidth={contentWidth}
          activePageId={activePageId}
        />
      </div>

      {/* ── STYLE tab ── */}
      {rightTab === 'style' && (
        <div className="_rp-tab-panel" style={{ padding: '24px 20px', flex: 1 }}>
          <ThemePickerPanel opts={exportOpts} setOpts={setExportOpts} isZh={isZh} />

          <div style={{ marginTop: '4px', marginBottom: '4px' }}>
            <button onClick={() => setPagedExport(p => !p)}
              style={{ width: '100%', padding: '11px 14px', borderRadius: '9px', cursor: 'pointer', border: `1px solid ${pagedExport ? 'rgba(26,26,26,0.3)' : 'rgba(26,26,26,0.1)'}`, background: pagedExport ? 'rgba(26,26,26,0.06)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s' }}>
              <span style={{ fontSize: '0.8rem', color: '#3a3a3a', letterSpacing: '0.02em' }}>{isZh ? '翻页模式' : 'Paged mode'}</span>
              <span style={{ fontSize: '0.7rem', color: pagedExport ? '#1a1a1a' : '#bbb', letterSpacing: '0.06em' }}>{pagedExport ? (isZh ? '开 ●' : 'ON ●') : (isZh ? '关 ○' : 'OFF ○')}</span>
            </button>
            {pagedExport && (
              <p style={{ fontSize: '0.68rem', color: '#aaa', fontFamily: 'Inter, DM Sans, sans-serif', marginTop: '6px', lineHeight: 1.5, padding: '0 2px' }}>
                {isZh ? '每个 block 单独一页，← → 键翻页' : 'Each block is a page · ← → to navigate'}
              </p>
            )}
          </div>



          <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(26,26,26,0.04)', borderRadius: '10px' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '8px' }}>{isZh ? '当前配置' : 'Current config'}</p>
            <p style={{ fontSize: '0.75rem', color: '#777', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.6 }}>
              {THEMES[exportOpts.theme]?.label} · {FONTS[exportOpts.font]?.label} · {exportOpts.width}px · R{exportOpts.radius} · {pages.length}p {pagedExport ? '· paged' : ''}
            </p>
            <button onClick={() => doExportHTML()}
              className="_rp-export-btn"
              style={{ width: '100%', marginTop: '12px', padding: '11px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '9px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', letterSpacing: '0.08em', cursor: 'pointer' }}>
              {isZh ? '导出 HTML' : 'Export HTML'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}