'use client'
import React from 'react'
import { buildExportHTML, THEMES, FONTS } from '../../../../../lib/exportStyles'
import { aspectLabel } from './pageHelpers'
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
    mediaUrls, localImageInputRef, selectedImages, toggleImageSelection,
    addImageRow, imagePickerOpen, setImagePickerOpen,
    addImageBlock, compressImage, addToMediaLibrary,
    setImageEditorUrl, setImageEditorIdx, imageDragIndex,
    contentWidth, setSelectedBlockId,
  } = s

  const {
    gridState, setActiveGrid, updateColumn, updateBaseline, updateModular,
    gridEditMode, setGridEditMode,
  } = s as any

  // ── 快速插入文字 state ──
  const [quickText, setQuickText] = React.useState('')
  const [quickTextHeight, setQuickTextHeight] = React.useState(72)
  const quickDragRef = React.useRef<{ startY: number; startH: number } | null>(null)

  return (
    <div
      style={{ background: '#fff', overflowY: 'auto', borderLeft: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
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
                  if (!trimmed) return
                  trimmed.split('\n').filter(l => l.trim()).forEach(line => addBlock('text' as any, line.trim()))
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
                  trimmed.split('\n').filter(l => l.trim()).forEach(line => addBlock('text' as any, line.trim()))
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

          {/* ── Images / Media Library — 始终显示，放在 Background 上面 ── */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                {isZh ? '图片' : 'Images'}{mediaUrls.length > 0 && <span style={{ color: '#d0d0cc' }}> ({mediaUrls.length})</span>}
              </p>
              {mediaUrls.length > 0 && (
                <span style={{ fontSize: '0.62rem', color: '#ccc', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '点击加入画布' : 'Click to add'}</span>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
              {/* Upload cell — 始终显示 */}
              <label
                style={{ aspectRatio: '1', borderRadius: '6px', border: '1px dashed rgba(26,26,26,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', transition: 'border-color 0.12s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.35)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(26,26,26,0.15)')}
                title={isZh ? '上传图片' : 'Upload image'}
              >
                <span style={{ fontSize: '1rem', color: '#ccc', lineHeight: 1 }}>+</span>
                <input ref={localImageInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={async e => {
                    const files = Array.from(e.target.files || [])
                    for (const file of files) {
                      const dataUrl = await new Promise<string>(res => {
                        const r = new FileReader(); r.onload = ev => res(ev.target?.result as string); r.readAsDataURL(file)
                      })
                      const compressed = await compressImage(dataUrl, 2400, 0.88)
                      addToMediaLibrary(compressed)
                    }
                    e.target.value = ''
                  }} />
              </label>
              {/* Image thumbnails */}
              {mediaUrls.map((media) => (
                <div key={media.id} style={{ position: 'relative', aspectRatio: '1' }}>
                  <button onClick={() => addImageBlock(media.url)}
                    style={{ position: 'absolute', inset: 0, padding: 0, border: 'none', borderRadius: '6px', overflow: 'hidden', cursor: 'pointer', width: '100%', height: '100%', outline: '1px solid rgba(26,26,26,0.1)', background: 'rgba(26,26,26,0.04)', transition: 'outline-color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.outlineColor = 'rgba(26,26,26,0.4)')}
                    onMouseLeave={e => (e.currentTarget.style.outlineColor = 'rgba(26,26,26,0.1)')}
                    title={isZh ? '加入画布' : 'Add to canvas'}
                  >
                    <img src={media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,26,26,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.22)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(26,26,26,0)')}>
                      <span style={{ color: '#fff', fontSize: '0.65rem', fontFamily: 'Space Mono, monospace', opacity: 0, transition: 'opacity 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={e => (e.currentTarget.style.opacity = '0')}>+</span>
                    </div>
                  </button>
                  {(s as any).removeFromMediaLibrary && (
                    <button
                      onClick={e => { e.stopPropagation(); (s as any).removeFromMediaLibrary(media.id) }}
                      style={{ position: 'absolute', top: 3, right: 3, width: 16, height: 16, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '0.5rem', lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.12s', zIndex: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(220,60,60,0.9)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
                      title={isZh ? '删除' : 'Remove'}
                      className="_media-del"
                    >×</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '24px' }} />

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
          {gridState && (() => {
            const active: string | null = gridState.activeType
            const GRIDS = [
              { key: 'modular',  labelZh: '模块网格', labelEn: 'Modular',  descZh: '行列交叉单元格',  descEn: 'Row × column cells' },
              { key: 'column',   labelZh: '列网格',   labelEn: 'Column',   descZh: '内容对齐到列',    descEn: 'Align to columns' },
              { key: 'baseline', labelZh: '基线网格', labelEn: 'Baseline', descZh: '文字行高对齐',    descEn: 'Typography rhythm' },
            ] as const

            const sliderRow = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, step = 1) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }}>{label}</span>
                <input type="range" min={min} max={max} step={step} value={value}
                  onChange={e => onChange(Number(e.target.value))}
                  style={{ flex: 1, accentColor: '#1a1a1a', height: 2 }} />
                <span style={{ fontSize: '0.58rem', color: '#888', fontFamily: 'Space Mono, monospace', width: 26, textAlign: 'right', flexShrink: 0 }}>{value}</span>
              </div>
            )

            return (
              <div style={{ marginBottom: '24px' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif' }}>
                    {isZh ? '网格' : 'Grid'}
                  </p>
                  {active && (
                    <button
                      onClick={() => setActiveGrid(active)}
                      style={{ fontSize: '0.55rem', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', letterSpacing: '0.06em', padding: 0, transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#e05c5c')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}
                    >{isZh ? '关闭 ×' : 'Off ×'}</button>
                  )}
                </div>

                {/* Type selector — 3 cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px', marginBottom: active ? '12px' : 0 }}>
                  {GRIDS.map(g => {
                    const isOn = active === g.key
                    return (
                      <button key={g.key} onClick={() => setActiveGrid(g.key)}
                        style={{
                          padding: '9px 6px 8px',
                          border: `1px solid ${isOn ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.09)'}`,
                          borderRadius: '8px',
                          background: isOn ? 'rgba(26,26,26,0.05)' : 'transparent',
                          cursor: 'pointer', textAlign: 'center',
                          transition: 'all 0.12s',
                        }}
                        onMouseEnter={e => { if (!isOn) e.currentTarget.style.background = 'rgba(26,26,26,0.03)' }}
                        onMouseLeave={e => { if (!isOn) e.currentTarget.style.background = 'transparent' }}
                      >
                        {/* Mini grid icon */}
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '5px' }}>
                          {g.key === 'column' && (
                            <svg width="22" height="16" viewBox="0 0 22 16">
                              {[0,1,2,3].map(i => <rect key={i} x={i*5.5+0.5} y={0} width={4} height={16} rx={1} fill={isOn ? '#1a1a1a' : '#d0d0cc'} fillOpacity={isOn ? 0.18 : 1} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.5} />)}
                            </svg>
                          )}
                          {g.key === 'baseline' && (
                            <svg width="22" height="16" viewBox="0 0 22 16">
                              {[0,1,2,3,4,5].map(i => <line key={i} x1={0} y1={i*2.8+1.4} x2={22} y2={i*2.8+1.4} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.75} />)}
                            </svg>
                          )}
                          {g.key === 'modular' && (
                            <svg width="22" height="16" viewBox="0 0 22 16">
                              {[0,1,2].map(r => [0,1,2].map(c => <rect key={`${r}${c}`} x={c*7.5+0.5} y={r*5.5+0.5} width={6} height={4.5} rx={0.8} fill={isOn ? '#1a1a1a' : '#d0d0cc'} fillOpacity={isOn ? 0.15 : 1} stroke={isOn ? '#1a1a1a' : '#c8c8c4'} strokeWidth={0.5} />))}
                            </svg>
                          )}
                        </div>
                        <span style={{ fontSize: '0.58rem', fontFamily: 'Inter, DM Sans, sans-serif', color: isOn ? '#1a1a1a' : '#aaa', fontWeight: isOn ? 600 : 400, letterSpacing: '0.04em', display: 'block', lineHeight: 1.2 }}>
                          {isZh ? g.labelZh : g.labelEn}
                        </span>
                        <span style={{ fontSize: '0.5rem', fontFamily: 'Inter, DM Sans, sans-serif', color: isOn ? '#888' : '#ccc', display: 'block', marginTop: '2px', lineHeight: 1.2, letterSpacing: '0.02em' }}>
                          {isZh ? g.descZh : g.descEn}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* ── Column controls ── */}
                {active === 'column' && (
                  <div style={{ padding: '12px 13px', background: 'rgba(26,26,26,0.03)', borderRadius: '9px', border: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sliderRow(isZh ? '列数' : 'Cols', gridState.column.columns, 1, 24, v => updateColumn({ columns: v }))}
                    {sliderRow(isZh ? '间距' : 'Gutter', gridState.column.gutter, 0, 80, v => updateColumn({ gutter: v }))}
                    {sliderRow(isZh ? '边距' : 'Margin', gridState.column.margin, 0, 120, v => updateColumn({ margin: v }))}
                    {sliderRow(isZh ? '线宽' : 'Stroke', gridState.column.strokeWidth ?? 0.5, 0.25, 4, v => updateColumn({ strokeWidth: v }), 0.25)}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }}>{isZh ? '颜色' : 'Color'}</span>
                      <input type="color"
                        value={'#' + (gridState.column.color.match(/\d+/g) ?? ['99','102','241']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                        onChange={e => { const h = e.target.value; const r = parseInt(h.slice(1,3),16); const g2 = parseInt(h.slice(3,5),16); const b = parseInt(h.slice(5,7),16); updateColumn({ color: `rgba(${r},${g2},${b},0.15)` }) }}
                        style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }} />
                    </div>
                  </div>
                )}

                {/* ── Baseline controls ── */}
                {active === 'baseline' && (
                  <div style={{ padding: '12px 13px', background: 'rgba(26,26,26,0.03)', borderRadius: '9px', border: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {sliderRow(isZh ? '行高' : 'Height', gridState.baseline.lineHeight, 2, 64, v => updateBaseline({ lineHeight: v }))}
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {[4,6,8,10,12,16,20,24].map(v => (
                        <button key={v} onClick={() => updateBaseline({ lineHeight: v })}
                          style={{ padding: '3px 7px', borderRadius: '5px', border: `1px solid ${gridState.baseline.lineHeight === v ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`, background: gridState.baseline.lineHeight === v ? 'rgba(26,26,26,0.07)' : 'transparent', color: gridState.baseline.lineHeight === v ? '#1a1a1a' : '#aaa', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', transition: 'all 0.1s' }}>
                          {v}
                        </button>
                      ))}
                    </div>
                    {sliderRow(isZh ? '线宽' : 'Stroke', gridState.baseline.strokeWidth ?? 0.75, 0.25, 4, v => updateBaseline({ strokeWidth: v }), 0.25)}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }}>{isZh ? '颜色' : 'Color'}</span>
                      <input type="color"
                        value={'#' + (gridState.baseline.color.match(/\d+/g) ?? ['16','185','129']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                        onChange={e => { const h = e.target.value; const r = parseInt(h.slice(1,3),16); const g2 = parseInt(h.slice(3,5),16); const b = parseInt(h.slice(5,7),16); updateBaseline({ color: `rgba(${r},${g2},${b},0.2)` }) }}
                        style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }} />
                    </div>
                  </div>
                )}

                {/* ── Modular controls ── */}
                {active === 'modular' && (
                  <div style={{ padding: '12px 13px', background: 'rgba(26,26,26,0.03)', borderRadius: '9px', border: '1px solid rgba(26,26,26,0.07)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* 编辑模式开关 */}
                    <button
                      onClick={() => setGridEditMode?.(!gridEditMode)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '7px', cursor: 'pointer', border: `1px solid ${gridEditMode ? 'rgba(196,160,68,0.6)' : 'rgba(26,26,26,0.1)'}`, background: gridEditMode ? 'rgba(196,160,68,0.1)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'Inter, DM Sans, sans-serif', transition: 'all 0.12s' }}>
                      <span style={{ fontSize: '0.72rem', color: gridEditMode ? '#c4a044' : '#888' }}>{isZh ? '✎ 编辑网格文字' : '✎ Edit grid text'}</span>
                      <span style={{ fontSize: '0.65rem', color: gridEditMode ? '#c4a044' : '#bbb', fontFamily: 'Space Mono, monospace' }}>{gridEditMode ? (isZh ? '开 ●' : 'ON ●') : (isZh ? '关 ○' : 'OFF ○')}</span>
                    </button>
                    {gridEditMode && <p style={{ fontSize: '0.6rem', color: '#aaa', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.5 }}>{isZh ? '点格子打字 · 拖空白处移动网格 · 左侧调字号' : 'Click cell to type · Drag to move grid · Font size below'}</p>}
                    {sliderRow(isZh ? '列数' : 'Cols', gridState.modular.columns, 1, 24, v => updateModular({ columns: v }))}
                    {sliderRow(isZh ? '行数' : 'Rows', gridState.modular.rows, 1, 32, v => updateModular({ rows: v }))}
                    {sliderRow(isZh ? '列间距' : 'Col gap', gridState.modular.columnGutter, 0, 40, v => updateModular({ columnGutter: v }))}
                    {sliderRow(isZh ? '行间距' : 'Row gap', gridState.modular.rowGutter, 0, 40, v => updateModular({ rowGutter: v }))}
                    {sliderRow(isZh ? '边距' : 'Margin', gridState.modular.margin, 0, 100, v => updateModular({ margin: v }))}
                    {sliderRow(isZh ? '线宽' : 'Stroke', gridState.modular.strokeWidth ?? 0.5, 0.25, 4, v => updateModular({ strokeWidth: v }), 0.25)}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }}>{isZh ? '颜色' : 'Color'}</span>
                      <input type="color"
                        value={'#' + (gridState.modular.color.match(/\d+/g) ?? ['245','158','11']).slice(0,3).map((n: string) => parseInt(n).toString(16).padStart(2,'0')).join('')}
                        onChange={e => { const h = e.target.value; const r = parseInt(h.slice(1,3),16); const g2 = parseInt(h.slice(3,5),16); const b = parseInt(h.slice(5,7),16); updateModular({ color: `rgba(${r},${g2},${b},0.15)` }) }}
                        style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }} />
                    </div>
                    {/* 格子文字设置 */}
                    {sliderRow(isZh ? '文字大小' : 'Text size', gridState.modular.cellFontSize ?? 13, 8, 32, v => updateModular({ cellFontSize: v }))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.55rem', color: '#b0b0ac', fontFamily: 'Space Mono, monospace', letterSpacing: '0.08em', width: 54, flexShrink: 0 }}>{isZh ? '文字色' : 'Text'}</span>
                      <input type="color"
                        value={gridState.modular.cellColor ?? '#1a1a1a'}
                        onChange={e => updateModular({ cellColor: e.target.value })}
                        style={{ width: 22, height: 22, border: '1px solid rgba(26,26,26,0.12)', borderRadius: '5px', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }} />
                      <span style={{ fontSize: '0.58rem', color: '#bbb', fontFamily: 'Space Mono, monospace' }}>{gridState.modular.cellColor ?? '#1a1a1a'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}



          {/* Add Table block + Sticky + Emoji */}
          <div style={{ height: '1px', background: 'rgba(26,26,26,0.06)', marginBottom: '16px' }} />
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '0.65rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#b0b0ac', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>{isZh ? '添加块' : 'Add Block'}</p>
            <div onClick={() => addBlock('table', '')}
              className="_rp-addblock"
              style={{ padding: '9px 13px', border: '1px solid rgba(26,26,26,0.08)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', color: '#666', lineHeight: 1.55, transition: 'background 0.12s', display: 'flex', alignItems: 'center', gap: '8px' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.03)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <span style={{ fontSize: '1rem', color: '#bbb' }}>⊞</span>
              {isZh ? '表格' : 'Table'}
            </div>
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
          addImageBlock={addImageBlock}
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