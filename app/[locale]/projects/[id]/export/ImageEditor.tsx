'use client'
// ─────────────────────────────────────────────────────────────────────────────
// ImageEditor.tsx — Professional redesign
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useImageEditor } from './useImageEditor'
import { ImageLayer, TextLayer } from './imageEditorTypes'
import { SegmentationOverlay } from './SegmentationOverlay'

interface ImageEditorProps {
  src: string
  isZh: boolean
  onSave: (dataUrl: string) => void
  onClose: () => void
}

interface FilterPreset {
  label: string
  labelZh: string
  brightness: number
  contrast: number
  saturate: number
  hueRotate: number
  sepia: number
  opacity: number
  exposure: number
  warmth: number
  vignette: number
  sharpen: number
  highlights: number
  shadows: number
}

const PRESETS: FilterPreset[] = [
  { label: 'Original',  labelZh: '原图',   brightness:100, contrast:100, saturate:100, hueRotate:0,   sepia:0,  opacity:100, exposure:100, warmth:100, vignette:0,  sharpen:0,  highlights:100, shadows:100 },
  { label: 'Vivid',     labelZh: '鲜艳',   brightness:108, contrast:115, saturate:140, hueRotate:0,   sepia:0,  opacity:100, exposure:105, warmth:105, vignette:10, sharpen:20, highlights:110, shadows:95  },
  { label: 'Matte',     labelZh: '哑光',   brightness:105, contrast:85,  saturate:80,  hueRotate:0,   sepia:10, opacity:100, exposure:100, warmth:102, vignette:20, sharpen:0,  highlights:90,  shadows:110 },
  { label: 'B&W',       labelZh: '黑白',   brightness:100, contrast:120, saturate:0,   hueRotate:0,   sepia:0,  opacity:100, exposure:100, warmth:100, vignette:30, sharpen:15, highlights:100, shadows:100 },
  { label: 'Warm',      labelZh: '暖调',   brightness:105, contrast:100, saturate:110, hueRotate:-10, sepia:20, opacity:100, exposure:103, warmth:140, vignette:15, sharpen:0,  highlights:105, shadows:100 },
  { label: 'Cool',      labelZh: '冷调',   brightness:100, contrast:105, saturate:95,  hueRotate:15,  sepia:0,  opacity:100, exposure:98,  warmth:65,  vignette:10, sharpen:10, highlights:100, shadows:105 },
  { label: 'Film',      labelZh: '胶片',   brightness:98,  contrast:90,  saturate:85,  hueRotate:5,   sepia:15, opacity:100, exposure:95,  warmth:115, vignette:40, sharpen:5,  highlights:85,  shadows:115 },
  { label: 'Fade',      labelZh: '褪色',   brightness:115, contrast:75,  saturate:70,  hueRotate:0,   sepia:8,  opacity:88,  exposure:110, warmth:108, vignette:0,  sharpen:0,  highlights:115, shadows:120 },
  { label: 'Drama',     labelZh: '戏剧',   brightness:90,  contrast:145, saturate:110, hueRotate:0,   sepia:0,  opacity:100, exposure:88,  warmth:98,  vignette:50, sharpen:40, highlights:80,  shadows:85  },
  { label: 'Vintage',   labelZh: '复古',   brightness:100, contrast:88,  saturate:75,  hueRotate:-5,  sepia:35, opacity:100, exposure:98,  warmth:125, vignette:55, sharpen:0,  highlights:88,  shadows:112 },
]

// ─── CSS 注入 ─────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&family=DM+Sans:wght@300;400;500&display=swap');

  .ie-root * { box-sizing: border-box; }

  /* 自定义滚动条 */
  .ie-panel::-webkit-scrollbar { width: 3px; }
  .ie-panel::-webkit-scrollbar-track { background: transparent; }
  .ie-panel::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }

  /* 滑块样式 */
  .ie-range {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 2px;
    background: transparent;
    cursor: pointer;
    outline: none;
    position: relative;
  }
  .ie-range::-webkit-slider-track { height: 2px; }
  .ie-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #e8e8e6;
    border: 2px solid #1a1a1a;
    box-shadow: 0 0 0 1px #444;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    margin-top: -5px;
  }
  .ie-range::-webkit-slider-thumb:hover {
    transform: scale(1.3);
    box-shadow: 0 0 0 2px #666;
  }
  .ie-range::-webkit-slider-runnable-track {
    height: 2px;
    background: #2a2a2a;
    border-radius: 2px;
  }
  .ie-range::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #e8e8e6;
    border: 2px solid #1a1a1a;
    box-shadow: 0 0 0 1px #444;
    cursor: pointer;
  }
  .ie-range::-moz-range-track {
    height: 2px;
    background: #2a2a2a;
    border-radius: 2px;
  }
  .ie-range::-moz-range-progress {
    height: 2px;
    background: #2a2a2a;
    border-radius: 2px;
  }

  /* preset 滚动条隐藏 */
  .ie-presets::-webkit-scrollbar { display: none; }

  /* 图层列表滚动条 */
  .ie-layers::-webkit-scrollbar { width: 2px; }
  .ie-layers::-webkit-scrollbar-thumb { background: #222; }

  /* 按钮悬停效果 */
  .ie-btn-ghost {
    background: transparent;
    border: 1px solid #252525;
    color: #555;
    cursor: pointer;
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    letter-spacing: 0.08em;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    border-radius: 6px;
  }
  .ie-btn-ghost:hover {
    border-color: #444;
    color: #bbb;
    background: rgba(255,255,255,0.03);
  }

  .ie-section-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    padding: 8px 0 6px;
    user-select: none;
  }
  .ie-section-toggle:hover .ie-section-label { color: #888; }

  .ie-layer-row:hover { background: rgba(255,255,255,0.025) !important; }
`

// ─── StyleInjector ────────────────────────────────────────────────────────────
function StyleInjector() {
  useEffect(() => {
    const id = 'ie-styles'
    if (document.getElementById(id)) return
    const el = document.createElement('style')
    el.id = id
    el.textContent = STYLES
    document.head.appendChild(el)
    return () => { document.getElementById(id)?.remove() }
  }, [])
  return null
}

// ─── AdjustSlider ─────────────────────────────────────────────────────────────
function AdjustSlider({
  label, val, set, min, max, unit = '', defaultVal,
}: {
  label: string; val: number; set: (v: number) => void
  min: number; max: number; unit?: string; defaultVal?: number
}) {
  const pct = ((val - min) / (max - min)) * 100
  const isDefault = defaultVal !== undefined && val === defaultVal
  const trackFill = val > (defaultVal ?? (min + max) / 2) ? '#6b8cff' : '#6b8cff'

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
        <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          {defaultVal !== undefined && !isDefault && (
            <button
              onClick={() => set(defaultVal)}
              title="Reset"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '10px', padding: '0', lineHeight: 1, transition: 'color 0.12s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#888')}
              onMouseLeave={e => (e.currentTarget.style.color = '#555')}
            >↺</button>
          )}
          <span style={{
            fontFamily: '"DM Mono", monospace', fontSize: '9.5px',
            color: isDefault ? '#555' : '#999',
            minWidth: '32px', textAlign: 'right',
            letterSpacing: '0.04em',
          }}>
            {val}{unit}
          </span>
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range" min={min} max={max} value={val}
          onChange={e => set(Number(e.target.value))}
          className="ie-range"
          style={{
            '--track-pct': `${pct}%`,
            '--track-fill': '#2a2a2a',
          } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

// ─── SectionTitle ─────────────────────────────────────────────────────────────
function SectionTitle({ children, collapsed, onToggle }: { children: React.ReactNode; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div className={onToggle ? 'ie-section-toggle' : ''} onClick={onToggle} style={{ marginBottom: collapsed ? 0 : '2px' }}>
      <span
        className="ie-section-label"
        style={{
          fontFamily: '"DM Mono", monospace',
          fontSize: '8.5px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: '#666',
          transition: 'color 0.12s',
        }}
      >
        {children}
      </span>
      {onToggle && (
        <span style={{ color: '#555', fontSize: '8px', transition: 'transform 0.2s', display: 'inline-block', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
          ▾
        </span>
      )}
    </div>
  )
}

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = () => (
  <div style={{ height: '1px', background: '#181818', margin: '14px 0 18px' }} />
)

// ─── IconText / IconImage ─────────────────────────────────────────────────────
const IconText = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <rect x="0.5" y="1.5" width="10" height="8" rx="1" stroke="#444" strokeWidth="1"/>
    <path d="M3 4h5M5.5 4v4" stroke="#444" strokeWidth="1" strokeLinecap="round"/>
  </svg>
)
const IconImage = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <rect x="0.5" y="1.5" width="10" height="8" rx="1" stroke="#444" strokeWidth="1"/>
    <circle cx="3.5" cy="4.5" r="1" fill="#444"/>
    <path d="M1 8.5l3-2.5 2 2 1.5-1.5L10 9" stroke="#444" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconEye = ({ visible }: { visible: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    {visible
      ? <>
          <path d="M1 6.5C1 6.5 3 3 6.5 3S12 6.5 12 6.5 10 10 6.5 10 1 6.5 1 6.5z" stroke="#555" strokeWidth="1" strokeLinejoin="round"/>
          <circle cx="6.5" cy="6.5" r="1.5" fill="#555"/>
        </>
      : <>
          <path d="M1 6.5C1 6.5 3 3 6.5 3S12 6.5 12 6.5 10 10 6.5 10 1 6.5 1 6.5z" stroke="#333" strokeWidth="1" strokeLinejoin="round"/>
          <path d="M2 2l9 9" stroke="#333" strokeWidth="1" strokeLinecap="round"/>
        </>
    }
  </svg>
)
const IconDelete = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M2 2l7 7M9 2l-7 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
)

// ═════════════════════════════════════════════════════════════════════════════
export function ImageEditor(props: ImageEditorProps) {
  const {
    canvasRef, layerInputRef, fontInputRef,
    brightness, setBrightness,
    contrast, setContrast,
    saturate, setSaturate,
    rotation, setRotation,
    flipH, setFlipH,
    cropMode, setCropMode,
    layers,
    activeLayerId, setActiveLayerId,
    dragLayerId,
    accentColor, setAccentColor,
    allFonts,
    updateLayer, deleteLayer, handleFontUpload,
    addTextLayer, addImageLayer, setBaseImage,
    handleCanvasMouseDown, handleCanvasMouseMove, handleCanvasMouseUp,
    applyCrop, handleSave, onClose,
  } = useImageEditor(props)

  const { isZh } = props

  const [hueRotate,   setHueRotate]   = useState(0)
  const [sepia,       setSepia]       = useState(0)
  const [opacity,     setOpacity]     = useState(100)
  const [exposure,    setExposure]    = useState(100)
  const [warmth,      setWarmth]      = useState(100)
  const [vignette,    setVignette]    = useState(0)
  const [sharpen,     setSharpen]     = useState(0)
  const [highlights,  setHighlights]  = useState(100)
  const [shadows,     setShadows]     = useState(100)
  const [activePreset, setActivePreset] = useState<string>('Original')

  const [collapseBasic,     setCollapseBasic]     = useState(false)
  const [collapseDetail,    setCollapseDetail]    = useState(true)
  const [collapseColor,     setCollapseColor]     = useState(true)
  const [collapseTransform, setCollapseTransform] = useState(true)
  const [collapseCrop,      setCollapseCrop]      = useState(true)
  const [collapseCutout,    setCollapseCutout]    = useState(true)

  const vignetteRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const warmthDelta = (warmth - 100) / 100
    const warmthHue   = warmthDelta * -25
    const extraFilter = [
      hueRotate !== 0   ? `hue-rotate(${hueRotate + warmthHue}deg)` : warmthHue !== 0 ? `hue-rotate(${warmthHue}deg)` : '',
      sepia     !== 0   ? `sepia(${sepia}%)` : '',
      opacity   !== 100 ? `opacity(${opacity}%)` : '',
      exposure  !== 100 ? `brightness(${exposure / 100 * 1.05})` : '',
      sharpen   !== 0   ? `contrast(${1 + sharpen * 0.003})` : '',
    ].filter(Boolean).join(' ')
    canvas.style.filter = extraFilter || 'none'
    canvas.style.opacity = '1'
  }, [hueRotate, sepia, opacity, exposure, warmth, sharpen, canvasRef])

  const applyPreset = useCallback((preset: FilterPreset) => {
    setBrightness(preset.brightness)
    setContrast(preset.contrast)
    setSaturate(preset.saturate)
    setHueRotate(preset.hueRotate)
    setSepia(preset.sepia)
    setOpacity(preset.opacity)
    setExposure(preset.exposure)
    setWarmth(preset.warmth)
    setVignette(preset.vignette)
    setSharpen(preset.sharpen)
    setHighlights(preset.highlights)
    setShadows(preset.shadows)
    setActivePreset(preset.label)
  }, [setBrightness, setContrast, setSaturate])

  const resetAll = () => applyPreset(PRESETS[0])

  const [segTarget, setSegTarget] = useState<'main' | string | null>(null)
  const mainImgRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { mainImgRef.current = img }
    img.src = props.src
  }, [props.src])

  const segImageLayer = (segTarget && segTarget !== 'main')
    ? (layers.find(l => l.id === segTarget && l.kind === 'image') as ImageLayer | undefined) ?? null
    : null

  const segLayer: ImageLayer | null = (() => {
    if (!segTarget) return null
    if (segTarget === 'main') {
      const el = mainImgRef.current
      if (!el) return null
      return { kind: 'image', id: '__main__', src: props.src, el, pos: { x: 0, y: 0 }, scale: 100, visible: true, followColor: false, name: isZh ? '主图' : 'Main image' } satisfies ImageLayer
    }
    return segImageLayer
  })()

  const handleSegApply = (newSrc: string) => {
    if (!segTarget) return
    if (segTarget === 'main') {
      const img = new Image()
      img.onload = () => { mainImgRef.current = img; setBaseImage(img) }
      img.src = newSrc
    } else {
      const img = new Image()
      img.onload = () => { updateLayer(segTarget, { src: newSrc, el: img } as Partial<ImageLayer>) }
      img.src = newSrc
    }
    setSegTarget(null)
  }

  // ─── Panel widths ───────────────────────────────────────────────────────────
  const PANEL_W = 220

  const panelBase: React.CSSProperties = {
    width: PANEL_W,
    background: '#0d0d0d',
    padding: '0',
    overflowY: 'auto',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <>
      <StyleInjector />

      <div
        className="ie-root"
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: '#080808',
          display: 'flex', alignItems: 'stretch',
          fontFamily: '"DM Sans", sans-serif',
        }}
      >

        {/* ═══════════════════════ LEFT PANEL ═══════════════════════════════ */}
        <div
          className="ie-panel"
          style={{
            ...panelBase,
            borderRight: '1px solid #141414',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '16px 18px 12px',
            borderBottom: '1px solid #141414',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{
              fontFamily: '"DM Mono", monospace',
              fontSize: '8px',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: '#555',
            }}>
              {isZh ? '调整' : 'Adjust'}
            </span>
            <button
              onClick={resetAll}
              className="ie-btn-ghost"
              style={{ padding: '4px 9px', fontSize: '9px' }}
            >
              {isZh ? '全部重置' : 'Reset all'}
            </button>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 18px 20px' }} className="ie-panel">

            {/* ── 预设 ── */}
            <div style={{ paddingTop: '16px', marginBottom: '18px' }}>
              <SectionTitle>{isZh ? '预设' : 'Presets'}</SectionTitle>
              <div
                className="ie-presets"
                style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '4px', paddingTop: '10px', marginLeft: '-2px', paddingLeft: '2px' }}
              >
                {PRESETS.map(p => {
                  const active = activePreset === p.label
                  return (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      style={{
                        flexShrink: 0,
                        padding: '5px 11px',
                        border: `1px solid ${active ? '#444' : '#1e1e1e'}`,
                        borderRadius: '3px',
                        background: active ? '#1c1c1c' : 'transparent',
                        color: active ? '#ccc' : '#383838',
                        cursor: 'pointer',
                        fontFamily: '"DM Mono", monospace',
                        fontSize: '9px',
                        letterSpacing: '0.07em',
                        transition: 'all 0.12s',
                        whiteSpace: 'nowrap',
                      }}
                      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = '#2e2e2e' } }}
                      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#383838'; e.currentTarget.style.borderColor = '#1e1e1e' } }}
                    >
                      {isZh ? p.labelZh : p.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Divider />

            {/* ── 基础 ── */}
            <SectionTitle collapsed={collapseBasic} onToggle={() => setCollapseBasic(v => !v)}>
              {isZh ? '基础' : 'Basic'}
            </SectionTitle>
            {!collapseBasic && (
              <div style={{ paddingTop: '12px' }}>
                <AdjustSlider label={isZh ? '亮度' : 'Brightness'} val={brightness} set={v => { setBrightness(v); setActivePreset('') }} min={0} max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '曝光' : 'Exposure'}   val={exposure}   set={v => { setExposure(v);   setActivePreset('') }} min={50} max={150} defaultVal={100} />
                <AdjustSlider label={isZh ? '对比度' : 'Contrast'} val={contrast}   set={v => { setContrast(v);   setActivePreset('') }} min={0} max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '饱和度' : 'Saturation'} val={saturate} set={v => { setSaturate(v);   setActivePreset('') }} min={0} max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '透明度' : 'Opacity'}   val={opacity}   set={v => { setOpacity(v);    setActivePreset('') }} min={0} max={100} unit="%" defaultVal={100} />
              </div>
            )}

            <Divider />

            {/* ── 细节 ── */}
            <SectionTitle collapsed={collapseDetail} onToggle={() => setCollapseDetail(v => !v)}>
              {isZh ? '细节' : 'Detail'}
            </SectionTitle>
            {!collapseDetail && (
              <div style={{ paddingTop: '12px' }}>
                <AdjustSlider label={isZh ? '高光' : 'Highlights'} val={highlights} set={v => { setHighlights(v); setActivePreset('') }} min={0} max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '阴影' : 'Shadows'}    val={shadows}    set={v => { setShadows(v);    setActivePreset('') }} min={0} max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '锐化' : 'Sharpen'}    val={sharpen}    set={v => { setSharpen(v);    setActivePreset('') }} min={0} max={100} defaultVal={0} />
                <AdjustSlider label={isZh ? '暗角' : 'Vignette'}   val={vignette}   set={v => { setVignette(v);   setActivePreset('') }} min={0} max={100} defaultVal={0} />
              </div>
            )}

            <Divider />

            {/* ── 色彩 ── */}
            <SectionTitle collapsed={collapseColor} onToggle={() => setCollapseColor(v => !v)}>
              {isZh ? '色彩' : 'Color'}
            </SectionTitle>
            {!collapseColor && (
              <div style={{ paddingTop: '12px' }}>
                <AdjustSlider label={isZh ? '色温' : 'Warmth'}     val={warmth}    set={v => { setWarmth(v);    setActivePreset('') }} min={0}    max={200} defaultVal={100} />
                <AdjustSlider label={isZh ? '色相' : 'Hue'}        val={hueRotate} set={v => { setHueRotate(v); setActivePreset('') }} min={-180} max={180} unit="°" defaultVal={0} />
                <AdjustSlider label={isZh ? '褪色' : 'Sepia'}      val={sepia}     set={v => { setSepia(v);     setActivePreset('') }} min={0}    max={100} unit="%" defaultVal={0} />

                {/* Accent color */}
                <div style={{ marginTop: '4px', marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#888' }}>
                      {isZh ? '主题色' : 'Accent'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '4px', background: accentColor, border: '1px solid #222', cursor: 'pointer', overflow: 'hidden' }}>
                        <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                          style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }} />
                      </div>
                    </div>
                    <input type="text" value={accentColor}
                      onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccentColor(e.target.value) }}
                      style={{ flex: 1, padding: '5px 8px', background: '#111', border: '1px solid #1e1e1e', borderRadius: '4px', color: '#666', fontFamily: '"DM Mono", monospace', fontSize: '10px', outline: 'none', letterSpacing: '0.06em' }} />
                  </div>
                </div>
              </div>
            )}

            <Divider />

            {/* ── 变换 ── */}
            <SectionTitle collapsed={collapseTransform} onToggle={() => setCollapseTransform(v => !v)}>
              {isZh ? '变换' : 'Transform'}
            </SectionTitle>
            {!collapseTransform && (
              <div style={{ paddingTop: '10px', marginBottom: '18px' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[0, 90, 180, 270].map(r => (
                    <button key={r} onClick={() => setRotation(r)}
                      style={{
                        padding: '6px 11px',
                        border: `1px solid ${rotation === r ? '#3a3a3a' : '#1e1e1e'}`,
                        borderRadius: '4px',
                        background: rotation === r ? '#1c1c1c' : 'transparent',
                        color: rotation === r ? '#aaa' : '#333',
                        cursor: 'pointer',
                        fontFamily: '"DM Mono", monospace',
                        fontSize: '9.5px',
                        letterSpacing: '0.04em',
                        transition: 'all 0.12s',
                      }}>
                      {r}°
                    </button>
                  ))}
                  <button onClick={() => setFlipH(f => !f)}
                    style={{
                      padding: '6px 13px',
                      border: `1px solid ${flipH ? '#3a3a3a' : '#1e1e1e'}`,
                      borderRadius: '4px',
                      background: flipH ? '#1c1c1c' : 'transparent',
                      color: flipH ? '#aaa' : '#333',
                      cursor: 'pointer',
                      fontFamily: '"DM Mono", monospace',
                      fontSize: '12px',
                      transition: 'all 0.12s',
                    }}>
                    ↔
                  </button>
                </div>
              </div>
            )}

            <Divider />

            {/* ── 裁剪 ── */}
            <SectionTitle collapsed={collapseCrop} onToggle={() => setCollapseCrop(v => !v)}>
              {isZh ? '裁剪' : 'Crop'}
            </SectionTitle>
            {!collapseCrop && (
              <div style={{ paddingTop: '10px', marginBottom: '18px' }}>
                {!cropMode ? (
                  <button onClick={() => setCropMode(true)}
                    className="ie-btn-ghost"
                    style={{ width: '100%', padding: '8px 0', textAlign: 'center', display: 'block', letterSpacing: '0.1em' }}>
                    {isZh ? '框选裁剪' : 'Draw to crop'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={applyCrop}
                      style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '5px', background: '#e8e8e6', color: '#0d0d0d', cursor: 'pointer', fontFamily: '"DM Mono", monospace', fontSize: '9.5px', letterSpacing: '0.08em', fontWeight: 500 }}>
                      {isZh ? '应用' : 'Apply'}
                    </button>
                    <button onClick={() => setCropMode(false)}
                      className="ie-btn-ghost"
                      style={{ flex: 1, padding: '8px 0', textAlign: 'center' }}>
                      {isZh ? '取消' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            )}

            <Divider />

            {/* ── 抠图 ── */}
            <SectionTitle collapsed={collapseCutout} onToggle={() => setCollapseCutout(v => !v)}>
              {isZh ? '抠图' : 'Cutout'}
            </SectionTitle>
            {!collapseCutout && (
              <div style={{ paddingTop: '10px', marginBottom: '18px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <button onClick={() => setSegTarget('main')}
                  className="ie-btn-ghost"
                  style={{ width: '100%', padding: '8px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', letterSpacing: '0.1em' }}>
                  <span style={{ fontSize: '11px', opacity: 0.5 }}>✦</span>
                  {isZh ? '抠主图' : 'Cutout main'}
                </button>
                {layers.filter(l => l.kind === 'image').map(l => (
                  <button key={l.id} onClick={() => setSegTarget(l.id)}
                    className="ie-btn-ghost"
                    style={{ width: '100%', padding: '7px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', letterSpacing: '0.08em' }}>
                    <span style={{ fontSize: '9px', opacity: 0.4 }}>◎</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                      {l.name || (isZh ? '图片图层' : 'Image layer')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════ CENTER — CANVAS ══════════════════════════ */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          background: '#080808',
        }}>
          {/* Subtle grid background */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'radial-gradient(circle, #161616 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            opacity: 0.5,
          }} />

          <canvas
            ref={canvasRef}
            draggable={false}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              cursor: cropMode ? 'crosshair' : dragLayerId ? 'grabbing' : 'default',
              userSelect: 'none',
              display: 'block',
              position: 'relative',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 80px rgba(0,0,0,0.8)',
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDragStart={e => e.preventDefault()}
          />

          {vignette > 0 && (
            <div
              ref={vignetteRef}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at center, transparent ${100 - vignette * 0.7}%, rgba(0,0,0,${vignette * 0.008}) 100%)`,
              }}
            />
          )}

          {/* Crop mode indicator */}
          {cropMode && (
            <div style={{
              position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.7)',
              border: '1px solid #2a2a2a',
              borderRadius: '4px',
              padding: '6px 14px',
              fontFamily: '"DM Mono", monospace',
              fontSize: '9px',
              letterSpacing: '0.16em',
              color: '#777',
              backdropFilter: 'blur(8px)',
            }}>
              {isZh ? '在画布上拖拽选区' : 'DRAG TO SELECT CROP AREA'}
            </div>
          )}
        </div>

        {/* ═══════════════════════ RIGHT PANEL ══════════════════════════════ */}
        <div
          className="ie-panel"
          style={{
            ...panelBase,
            borderLeft: '1px solid #141414',
          }}
        >
          {/* Save / Close header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #141414',
            display: 'flex', gap: '6px', flexShrink: 0,
          }}>
            <button
              onClick={handleSave}
              style={{
                flex: 1, padding: '9px 0',
                background: '#e8e8e6',
                color: '#0d0d0d',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                fontFamily: '"DM Mono", monospace',
                fontSize: '9.5px',
                letterSpacing: '0.12em',
                fontWeight: 500,
                transition: 'opacity 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {isZh ? '保存' : 'SAVE'}
            </button>
            <button
              onClick={onClose}
              className="ie-btn-ghost"
              style={{ padding: '9px 13px' }}
            >
              {isZh ? '关闭' : '✕'}
            </button>
          </div>

          {/* Layers section */}
          <div style={{ padding: '14px 16px 8px', borderBottom: '1px solid #141414', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '8.5px', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#666' }}>
                {isZh ? '图层' : 'Layers'}
              </span>
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '8.5px', color: '#222', letterSpacing: '0.1em' }}>
                {layers.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <button
                onClick={addTextLayer}
                className="ie-btn-ghost"
                style={{ flex: 1, padding: '7px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <IconText />
                <span>{isZh ? '文字' : 'Text'}</span>
              </button>
              <button
                onClick={() => layerInputRef.current?.click()}
                className="ie-btn-ghost"
                style={{ flex: 1, padding: '7px 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
              >
                <IconImage />
                <span>{isZh ? '图片' : 'Image'}</span>
              </button>
            </div>
            <input ref={layerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => { if (e.target.files?.[0]) { addImageLayer(e.target.files[0]); e.target.value = '' } }} />
          </div>

          {/* Layer list */}
          <div className="ie-layers" style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            {[...layers].reverse().map((layer, ri) => {
              const isActive = layer.id === activeLayerId
              const isText = layer.kind === 'text'

              return (
                <div
                  key={layer.id}
                  className="ie-layer-row"
                  onClick={() => setActiveLayerId(isActive ? null : layer.id)}
                  style={{
                    border: `1px solid ${isActive ? '#282828' : 'transparent'}`,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    background: isActive ? '#111' : 'transparent',
                    transition: 'all 0.12s',
                    marginBottom: '2px',
                  }}
                >
                  {/* Layer row */}
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: '#2e2e2e', flexShrink: 0 }}>
                      {isText ? <IconText /> : <IconImage />}
                    </span>
                    <span style={{
                      flex: 1,
                      fontFamily: '"DM Mono", monospace',
                      fontSize: '9.5px',
                      letterSpacing: '0.05em',
                      color: layer.visible ? (isActive ? '#aaa' : '#555') : '#252525',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {layer.name || `${isText ? (isZh ? '文字' : 'Text') : (isZh ? '图片' : 'Image')} ${layers.length - ri}`}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: layer.visible ? 1 : 0.4 }}
                    >
                      <IconEye visible={layer.visible} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteLayer(layer.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0, color: '#2a2a2a', transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(200,80,80,0.9)')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#2a2a2a')}
                    >
                      <IconDelete />
                    </button>
                  </div>

                  {/* Expanded layer options */}
                  {isActive && (
                    <div
                      style={{ padding: '10px 12px 14px', borderTop: '1px solid #171717', display: 'flex', flexDirection: 'column', gap: '12px' }}
                      onClick={e => e.stopPropagation()}
                    >
                      {isText ? (
                        <>
                          <textarea
                            value={(layer as TextLayer).text}
                            onChange={e => updateLayer(layer.id, { text: e.target.value } as Partial<TextLayer>)}
                            rows={2}
                            style={{
                              width: '100%', padding: '8px 10px',
                              background: '#0d0d0d',
                              border: '1px solid #1e1e1e',
                              borderRadius: '5px',
                              color: '#888',
                              fontFamily: (layer as TextLayer).fontFamily,
                              fontSize: '12px',
                              resize: 'vertical',
                              outline: 'none',
                              boxSizing: 'border-box',
                              lineHeight: 1.5,
                            }}
                          />

                          {/* Font size */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777' }}>{isZh ? '字号' : 'Size'}</span>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', color: '#777' }}>{(layer as TextLayer).fontSize}px</span>
                            </div>
                            <input type="range" min={10} max={200} value={(layer as TextLayer).fontSize}
                              onChange={e => updateLayer(layer.id, { fontSize: Number(e.target.value) } as Partial<TextLayer>)}
                              className="ie-range"
                              style={{ '--track-pct': `${((( layer as TextLayer).fontSize - 10) / 190) * 100}%`, '--track-fill': '#444' } as React.CSSProperties}
                            />
                          </div>

                          {/* Opacity */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777' }}>{isZh ? '不透明度' : 'Opacity'}</span>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', color: '#777' }}>{(layer as any).opacity ?? 100}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={(layer as any).opacity ?? 100}
                              onChange={e => updateLayer(layer.id, { opacity: Number(e.target.value) } as any)}
                              className="ie-range"
                              style={{ '--track-pct': `${(layer as any).opacity ?? 100}%`, '--track-fill': '#444' } as React.CSSProperties}
                            />
                          </div>

                          {/* Color */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777', flex: 1 }}>{isZh ? '颜色' : 'Color'}</span>
                            <div style={{ position: 'relative', width: '24px', height: '24px', borderRadius: '4px', background: (layer as TextLayer).color, border: '1px solid #222', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' }}>
                              <input type="color" value={(layer as TextLayer).color}
                                onChange={e => updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>)}
                                style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }} />
                            </div>
                            <input type="text" value={(layer as TextLayer).color}
                              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>) }}
                              style={{ width: '66px', padding: '4px 7px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '4px', color: '#666', fontFamily: '"DM Mono", monospace', fontSize: '9.5px', outline: 'none', letterSpacing: '0.06em' }} />
                          </div>

                          {/* Font family */}
                          <div>
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777', display: 'block', marginBottom: '7px' }}>{isZh ? '字体' : 'Font'}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {allFonts.map(f => (
                                <button key={f.family}
                                  onClick={() => updateLayer(layer.id, { fontFamily: f.family, fontLabel: f.label } as Partial<TextLayer>)}
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: '3px',
                                    border: `1px solid ${(layer as TextLayer).fontFamily === f.family ? '#3a3a3a' : '#1e1e1e'}`,
                                    background: (layer as TextLayer).fontFamily === f.family ? '#1c1c1c' : 'transparent',
                                    color: (layer as TextLayer).fontFamily === f.family ? '#bbb' : '#333',
                                    cursor: 'pointer', fontFamily: f.family, fontSize: '11px',
                                    transition: 'all 0.12s', whiteSpace: 'nowrap',
                                  }}>
                                  {f.label}
                                </button>
                              ))}
                              <button
                                onClick={() => fontInputRef.current?.click()}
                                style={{ padding: '4px 8px', borderRadius: '3px', border: '1px dashed #1e1e1e', background: 'transparent', color: '#2e2e2e', cursor: 'pointer', fontFamily: '"DM Mono", monospace', fontSize: '9px', transition: 'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#666' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#2e2e2e' }}
                              >
                                + {isZh ? '上传' : 'Upload'}
                              </button>
                              <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                                onChange={e => handleFontUpload(e, layer.id)} />
                            </div>
                          </div>

                          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: '8.5px', color: '#222', margin: 0, letterSpacing: '0.08em' }}>
                            ↖ {isZh ? '在画布上拖动此图层' : 'Drag on canvas'}
                          </p>
                        </>
                      ) : (
                        <>
                          {/* Scale */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777' }}>{isZh ? '大小' : 'Scale'}</span>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', color: '#777' }}>{(layer as ImageLayer).scale}%</span>
                            </div>
                            <input type="range" min={3} max={150} value={(layer as ImageLayer).scale}
                              onChange={e => updateLayer(layer.id, { scale: Number(e.target.value) } as Partial<ImageLayer>)}
                              className="ie-range"
                              style={{ '--track-pct': `${(((layer as ImageLayer).scale - 3) / 147) * 100}%`, '--track-fill': '#444' } as React.CSSProperties}
                            />
                          </div>

                          {/* Opacity */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777' }}>{isZh ? '不透明度' : 'Opacity'}</span>
                              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', color: '#777' }}>{(layer as any).opacity ?? 100}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={(layer as any).opacity ?? 100}
                              onChange={e => updateLayer(layer.id, { opacity: Number(e.target.value) } as any)}
                              className="ie-range"
                              style={{ '--track-pct': `${(layer as any).opacity ?? 100}%`, '--track-fill': '#444' } as React.CSSProperties}
                            />
                          </div>

                          {/* Follow color toggle */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#777' }}>
                              {isZh ? '跟随调色' : 'Follow color'}
                            </span>
                            <button
                              onClick={() => updateLayer(layer.id, { followColor: !(layer as ImageLayer).followColor } as Partial<ImageLayer>)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '20px',
                                border: `1px solid ${(layer as ImageLayer).followColor ? '#3a3a3a' : '#1e1e1e'}`,
                                background: (layer as ImageLayer).followColor ? '#1e1e1e' : 'transparent',
                                color: (layer as ImageLayer).followColor ? '#888' : '#2e2e2e',
                                cursor: 'pointer',
                                fontFamily: '"DM Mono", monospace',
                                fontSize: '8.5px',
                                letterSpacing: '0.1em',
                                transition: 'all 0.15s',
                              }}>
                              {(layer as ImageLayer).followColor ? 'ON' : 'OFF'}
                            </button>
                          </div>

                          <p style={{ fontFamily: '"DM Mono", monospace', fontSize: '8.5px', color: '#222', margin: 0, letterSpacing: '0.08em' }}>
                            ↖ {isZh ? '在画布上拖动此图层' : 'Drag on canvas'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {layers.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', fontFamily: '"DM Mono", monospace', fontSize: '9px', letterSpacing: '0.12em', color: '#1e1e1e' }}>
                {isZh ? '暂无图层' : 'NO LAYERS'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 抠图 Overlay ── */}
      {segLayer && (
        <SegmentationOverlay
          layer={segLayer}
          isZh={isZh}
          onApply={handleSegApply}
          onClose={() => setSegTarget(null)}
        />
      )}
    </>
  )
}