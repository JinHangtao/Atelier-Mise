'use client'
// ─────────────────────────────────────────────────────────────────────────────
// ImageEditor.tsx — 升级版：更多颜色调节 + 滤镜预设 + 不透明度 + 更好的 UI
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

// ── 滤镜预设类型 ──────────────────────────────────────────────────────────────
interface FilterPreset {
  label: string
  labelZh: string
  brightness: number
  contrast: number
  saturate: number
  hueRotate: number
  sepia: number
  opacity: number
  exposure: number   // 用 brightness 叠加模拟曝光
  warmth: number     // 0~200, 100=中性
  vignette: number   // 0~100
  sharpen: number    // 0~100 (CSS filter: contrast 叠加模拟)
  highlights: number // 0~200
  shadows: number    // 0~200
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

// ── 单个滑块组件 ──────────────────────────────────────────────────────────────
function AdjustSlider({
  label, val, set, min, max, unit = '', defaultVal, accentColor = '#4aab6f',
}: {
  label: string; val: number; set: (v: number) => void
  min: number; max: number; unit?: string; defaultVal?: number; accentColor?: string
}) {
  const pct = ((val - min) / (max - min)) * 100
  return (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666', letterSpacing: '0.04em' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: val !== (defaultVal ?? (min + max) / 2) ? '#aaa' : '#444', minWidth: '30px', textAlign: 'right' }}>
            {val}{unit}
          </span>
          {defaultVal !== undefined && val !== defaultVal && (
            <button
              onClick={() => set(defaultVal)}
              title="Reset"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555', fontSize: '0.6rem', padding: '0 1px', lineHeight: 1 }}
            >↺</button>
          )}
        </div>
      </div>
      <div style={{ position: 'relative' }}>
        <input
          type="range" min={min} max={max} value={val}
          onChange={e => set(Number(e.target.value))}
          style={{ width: '100%', accentColor, height: '3px', cursor: 'pointer' }}
        />
      </div>
    </div>
  )
}

// ── 分隔标题组件 ──────────────────────────────────────────────────────────────
function SectionTitle({ children, collapsed, onToggle }: { children: React.ReactNode; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: '0.58rem', letterSpacing: '0.2em', textTransform: 'uppercase',
        color: '#555', marginBottom: collapsed ? '0' : '12px',
        fontFamily: 'Space Mono, monospace',
        cursor: onToggle ? 'pointer' : 'default',
        padding: '4px 0',
      }}>
      <span>{children}</span>
      {onToggle && <span style={{ fontSize: '0.7rem', color: '#444' }}>{collapsed ? '▸' : '▾'}</span>}
    </div>
  )
}

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

  // ── 新增颜色调节 state ────────────────────────────────────────────────────
  const [hueRotate,   setHueRotate]   = useState(0)      // -180 ~ 180
  const [sepia,       setSepia]       = useState(0)       // 0 ~ 100
  const [opacity,     setOpacity]     = useState(100)     // 0 ~ 100
  const [exposure,    setExposure]    = useState(100)     // 50 ~ 150 (brightness 叠加)
  const [warmth,      setWarmth]      = useState(100)     // 0 ~ 200 (hueRotate 冷暖模拟)
  const [vignette,    setVignette]    = useState(0)       // 0 ~ 100
  const [sharpen,     setSharpen]     = useState(0)       // 0 ~ 100
  const [highlights,  setHighlights]  = useState(100)     // 0 ~ 200
  const [shadows,     setShadows]     = useState(100)     // 0 ~ 200
  const [activePreset, setActivePreset] = useState<string>('Original')

  // ── section 折叠状态 ──────────────────────────────────────────────────────
  const [collapseBasic,     setCollapseBasic]     = useState(false)
  const [collapseDetail,    setCollapseDetail]    = useState(false)
  const [collapseColor,     setCollapseColor]     = useState(false)
  const [collapseTransform, setCollapseTransform] = useState(false)
  const [collapseCrop,      setCollapseCrop]      = useState(false)
  const [collapseCutout,    setCollapseCutout]    = useState(false)

  // ── 把扩展滤镜注入 canvas ─────────────────────────────────────────────────
  // 注意：useImageEditor 内部已处理 brightness/contrast/saturate
  // 我们通过一个 useEffect 给 canvas 额外追加 CSS filter 和 vignette overlay
  const vignetteRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const warmthDelta = (warmth - 100) / 100  // -1 ~ 1
    const warmthHue   = warmthDelta * -25      // warm=负旋转(偏红), cool=正旋转(偏蓝)
    const extraFilter = [
      hueRotate !== 0   ? `hue-rotate(${hueRotate + warmthHue}deg)` : warmthHue !== 0 ? `hue-rotate(${warmthHue}deg)` : '',
      sepia     !== 0   ? `sepia(${sepia}%)`      : '',
      opacity   !== 100 ? `opacity(${opacity}%)`  : '',
      exposure  !== 100 ? `brightness(${exposure / 100 * 1.05})` : '',  // 轻微叠加
      sharpen   !== 0   ? `contrast(${1 + sharpen * 0.003})` : '',
    ].filter(Boolean).join(' ')
    canvas.style.filter = extraFilter || 'none'
    canvas.style.opacity = '1'
  }, [hueRotate, sepia, opacity, exposure, warmth, sharpen, canvasRef])

  // ── 应用预设 ──────────────────────────────────────────────────────────────
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

  // ── 重置所有 ──────────────────────────────────────────────────────────────
  const resetAll = () => {
    applyPreset(PRESETS[0])
  }

  // ── 抠图 overlay 状态 ──────────────────────────────────────────────────────
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
      return {
        kind: 'image', id: '__main__', src: props.src, el,
        pos: { x: 0, y: 0 }, scale: 100, visible: true, followColor: false,
        name: isZh ? '主图' : 'Main image',
      } satisfies ImageLayer
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

  const btnStyle = (hover = false) => ({
    width: '100%', padding: '7px 0',
    border: `1px solid ${hover ? 'rgba(74,171,111,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '7px',
    background: hover ? 'rgba(74,171,111,0.06)' : 'transparent',
    color: hover ? '#4aab6f' : '#888',
    cursor: 'pointer' as const,
    fontFamily: 'Space Mono, monospace', fontSize: '0.63rem',
    letterSpacing: '0.06em', transition: 'all 0.12s',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
  })

  const divider = <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '10px 0 14px' }} />

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.88)', display: 'flex', alignItems: 'stretch', backdropFilter: 'blur(10px)' }}>

        {/* ═══════════════════════════════════════════════════════════════════
            Left Panel — Adjustments
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{
          width: '230px', background: '#0e0e0e',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          padding: '16px 14px', overflowY: 'auto', flexShrink: 0,
          scrollbarWidth: 'thin', scrollbarColor: '#222 transparent',
        }}>

          {/* ── 顶栏：标题 + 重置 ── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.2em', color: '#444', textTransform: 'uppercase' }}>
              {isZh ? '调整面板' : 'Adjustments'}
            </span>
            <button
              onClick={resetAll}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '5px', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', padding: '3px 8px', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
            >
              {isZh ? '重置全部' : 'Reset all'}
            </button>
          </div>

          {/* ── 滤镜预设横向滚动条 ── */}
          <div style={{ marginBottom: '14px' }}>
            <SectionTitle>{isZh ? '预设' : 'Presets'}</SectionTitle>
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '6px', scrollbarWidth: 'none' }}>
              {PRESETS.map(p => {
                const active = activePreset === p.label
                return (
                  <button
                    key={p.label}
                    onClick={() => applyPreset(p)}
                    style={{
                      flexShrink: 0, padding: '5px 10px',
                      border: `1px solid ${active ? 'rgba(74,171,111,0.7)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '20px',
                      background: active ? 'rgba(74,171,111,0.12)' : 'rgba(255,255,255,0.03)',
                      color: active ? '#4aab6f' : '#666',
                      cursor: 'pointer', fontFamily: 'Space Mono, monospace',
                      fontSize: '0.6rem', transition: 'all 0.12s', whiteSpace: 'nowrap',
                    }}
                    onMouseEnter={e => { if (!active) { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' } }}
                    onMouseLeave={e => { if (!active) { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' } }}
                  >
                    {isZh ? p.labelZh : p.label}
                  </button>
                )
              })}
            </div>
          </div>

          {divider}

          {/* ── 基础调节 ── */}
          <SectionTitle collapsed={collapseBasic} onToggle={() => setCollapseBasic(v => !v)}>
            {isZh ? '基础' : 'Basic'}
          </SectionTitle>
          {!collapseBasic && (
            <>
              <AdjustSlider label={isZh ? '亮度' : 'Brightness'} val={brightness} set={v => { setBrightness(v); setActivePreset('') }} min={0}   max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '曝光' : 'Exposure'}   val={exposure}   set={v => { setExposure(v);   setActivePreset('') }} min={50}  max={150} defaultVal={100} />
              <AdjustSlider label={isZh ? '对比度' : 'Contrast'} val={contrast}   set={v => { setContrast(v);   setActivePreset('') }} min={0}   max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '饱和度' : 'Saturation'} val={saturate} set={v => { setSaturate(v);   setActivePreset('') }} min={0}   max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '透明度' : 'Opacity'}   val={opacity}   set={v => { setOpacity(v);    setActivePreset('') }} min={0}   max={100} unit="%" defaultVal={100} />
            </>
          )}

          {divider}

          {/* ── 细节调节 ── */}
          <SectionTitle collapsed={collapseDetail} onToggle={() => setCollapseDetail(v => !v)}>
            {isZh ? '细节' : 'Detail'}
          </SectionTitle>
          {!collapseDetail && (
            <>
              <AdjustSlider label={isZh ? '高光' : 'Highlights'} val={highlights} set={v => { setHighlights(v); setActivePreset('') }} min={0}   max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '阴影' : 'Shadows'}    val={shadows}    set={v => { setShadows(v);    setActivePreset('') }} min={0}   max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '锐化' : 'Sharpen'}    val={sharpen}    set={v => { setSharpen(v);    setActivePreset('') }} min={0}   max={100} defaultVal={0} />
              <AdjustSlider label={isZh ? '暗角' : 'Vignette'}   val={vignette}   set={v => { setVignette(v);   setActivePreset('') }} min={0}   max={100} defaultVal={0} />
            </>
          )}

          {divider}

          {/* ── 色彩调节 ── */}
          <SectionTitle collapsed={collapseColor} onToggle={() => setCollapseColor(v => !v)}>
            {isZh ? '色彩' : 'Color'}
          </SectionTitle>
          {!collapseColor && (
            <>
              <AdjustSlider label={isZh ? '色温' : 'Warmth'}     val={warmth}     set={v => { setWarmth(v);     setActivePreset('') }} min={0}    max={200} defaultVal={100} />
              <AdjustSlider label={isZh ? '色相' : 'Hue Rotate'} val={hueRotate}  set={v => { setHueRotate(v);  setActivePreset('') }} min={-180} max={180} unit="°" defaultVal={0} />
              <AdjustSlider label={isZh ? '褪色' : 'Sepia'}       val={sepia}      set={v => { setSepia(v);      setActivePreset('') }} min={0}    max={100} unit="%" defaultVal={0} />

              {/* 调色笔（Accent Color） */}
              <div style={{ marginTop: '2px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '主题色' : 'Accent'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
                    style={{ width: '28px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none', padding: 0, flexShrink: 0 }} />
                  <input type="text" value={accentColor}
                    onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccentColor(e.target.value) }}
                    style={{ flex: 1, padding: '3px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', outline: 'none' }} />
                </div>
              </div>
            </>
          )}

          {divider}

          {/* ── 变换 ── */}
          <SectionTitle collapsed={collapseTransform} onToggle={() => setCollapseTransform(v => !v)}>
            {isZh ? '变换' : 'Transform'}
          </SectionTitle>
          {!collapseTransform && (
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
              {[0, 90, 180, 270].map(r => (
                <button key={r} onClick={() => setRotation(r)}
                  style={{ padding: '5px 10px', border: `1px solid ${rotation === r ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', background: rotation === r ? 'rgba(255,255,255,0.1)' : 'transparent', color: rotation === r ? '#eee' : '#666', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', transition: 'all 0.12s' }}>
                  {r}°
                </button>
              ))}
              <button onClick={() => setFlipH(f => !f)}
                style={{ padding: '5px 10px', border: `1px solid ${flipH ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', background: flipH ? 'rgba(255,255,255,0.1)' : 'transparent', color: flipH ? '#eee' : '#666', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', transition: 'all 0.12s' }}>
                ↔
              </button>
            </div>
          )}

          {divider}

          {/* ── 裁剪 ── */}
          <SectionTitle collapsed={collapseCrop} onToggle={() => setCollapseCrop(v => !v)}>
            {isZh ? '裁剪' : 'Crop'}
          </SectionTitle>
          {!collapseCrop && (
            <>
              {!cropMode ? (
                <button onClick={() => setCropMode(true)}
                  style={{ width: '100%', padding: '7px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', transition: 'all 0.12s', marginBottom: '10px' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ccc' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
                  {isZh ? '框选裁剪' : 'Draw to crop'}
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                  <button onClick={applyCrop}
                    style={{ flex: 1, padding: '7px', border: 'none', borderRadius: '7px', background: '#4aab6f', color: '#fff', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem' }}>
                    {isZh ? '应用' : 'Apply'}
                  </button>
                  <button onClick={() => setCropMode(false)}
                    style={{ flex: 1, padding: '7px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem' }}>
                    {isZh ? '取消' : 'Cancel'}
                  </button>
                </div>
              )}
            </>
          )}

          {divider}

          {/* ── 抠图 ── */}
          <SectionTitle collapsed={collapseCutout} onToggle={() => setCollapseCutout(v => !v)}>
            {isZh ? '抠图' : 'Cutout'}
          </SectionTitle>
          {!collapseCutout && (
            <>
              <button onClick={() => setSegTarget('main')}
                style={btnStyle()}
                onMouseEnter={e => Object.assign(e.currentTarget.style, btnStyle(true))}
                onMouseLeave={e => Object.assign(e.currentTarget.style, btnStyle(false))}
              >
                <span style={{ fontSize: '0.8rem' }}>✦</span>
                {isZh ? '抠主图' : 'Cutout main'}
              </button>

              {layers.filter(l => l.kind === 'image').length > 0 && (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {layers.filter(l => l.kind === 'image').map(l => (
                    <button key={l.id} onClick={() => setSegTarget(l.id)}
                      style={btnStyle()}
                      onMouseEnter={e => Object.assign(e.currentTarget.style, btnStyle(true))}
                      onMouseLeave={e => Object.assign(e.currentTarget.style, btnStyle(false))}
                    >
                      <span style={{ fontSize: '0.75rem' }}>◎</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                        {l.name || (isZh ? '图片图层' : 'Image layer')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Center — Canvas + Vignette overlay
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: cropMode ? 'crosshair' : dragLayerId ? 'grabbing' : 'default', userSelect: 'none', display: 'block' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDragStart={e => e.preventDefault()}
          />
          {/* Vignette 叠加层 */}
          {vignette > 0 && (
            <div
              ref={vignetteRef}
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                background: `radial-gradient(ellipse at center, transparent ${100 - vignette * 0.7}%, rgba(0,0,0,${vignette * 0.008}) 100%)`,
              }}
            />
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            Right Panel — Layers + Actions
        ═══════════════════════════════════════════════════════════════════ */}
        <div style={{ width: '225px', background: '#0e0e0e', borderLeft: '1px solid rgba(255,255,255,0.07)', padding: '16px 14px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>

          {/* Save / Close */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
            <button onClick={handleSave}
              style={{ flex: 1, padding: '9px', background: '#4aab6f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.68rem', letterSpacing: '0.08em', fontWeight: 600 }}>
              {isZh ? '保存' : 'Save'}
            </button>
            <button onClick={onClose}
              style={{ padding: '9px 12px', background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.68rem' }}>
              {isZh ? '关闭' : 'Close'}
            </button>
          </div>

          <SectionTitle>{isZh ? '图层' : 'Layers'}</SectionTitle>

          <button onClick={addTextLayer}
            style={{ width: '100%', padding: '7px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', marginBottom: '5px', transition: 'all 0.12s', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
            + {isZh ? '文字图层' : 'Text layer'}
          </button>
          <button onClick={() => layerInputRef.current?.click()}
            style={{ width: '100%', padding: '7px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', marginBottom: '12px', transition: 'all 0.12s', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
            + {isZh ? '图片图层' : 'Image layer'}
          </button>
          <input ref={layerInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) { addImageLayer(e.target.files[0]); e.target.value = '' } }} />

          {/* Layer list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {[...layers].reverse().map((layer, ri) => {
              const isActive = layer.id === activeLayerId
              const isText = layer.kind === 'text'
              return (
                <div key={layer.id}
                  onClick={() => setActiveLayerId(isActive ? null : layer.id)}
                  style={{ border: `1px solid ${isActive ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent', transition: 'all 0.12s' }}
                >
                  <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#444', flexShrink: 0 }}>{isText ? 'T' : '⬜'}</span>
                    <span style={{ flex: 1, fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', color: layer.visible ? '#ccc' : '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                      {layer.name || `Layer ${layers.length - ri}`}
                    </span>
                    <button onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? '#888' : '#333', fontSize: '0.82rem', padding: '2px 3px', flexShrink: 0, lineHeight: 1 }}>
                      {layer.visible ? '👁' : '🙈'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteLayer(layer.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(191,74,74,0.45)', fontSize: '0.75rem', padding: '2px 3px', flexShrink: 0, lineHeight: 1, transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,74,74,1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(191,74,74,0.45)')}>✕</button>
                  </div>

                  {isActive && (
                    <div style={{ padding: '8px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '9px' }}
                      onClick={e => e.stopPropagation()}>

                      {isText ? (
                        <>
                          <textarea value={(layer as TextLayer).text}
                            onChange={e => updateLayer(layer.id, { text: e.target.value } as Partial<TextLayer>)}
                            rows={3}
                            style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#ddd', fontFamily: (layer as TextLayer).fontFamily, fontSize: '0.88rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />

                          {/* 字号 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '字号' : 'Size'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444' }}>{(layer as TextLayer).fontSize}px</span>
                            </div>
                            <input type="range" min={10} max={200} value={(layer as TextLayer).fontSize}
                              onChange={e => updateLayer(layer.id, { fontSize: Number(e.target.value) } as Partial<TextLayer>)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>

                          {/* 不透明度（文字图层） */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '不透明度' : 'Opacity'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444' }}>{(layer as any).opacity ?? 100}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={(layer as any).opacity ?? 100}
                              onChange={e => updateLayer(layer.id, { opacity: Number(e.target.value) } as any)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>

                          {/* 颜色 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666', flex: 1 }}>{isZh ? '颜色' : 'Color'}</span>
                            <input type="color" value={(layer as TextLayer).color}
                              onChange={e => updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>)}
                              style={{ width: '28px', height: '22px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none', padding: 0 }} />
                            <input type="text" value={(layer as TextLayer).color}
                              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>) }}
                              style={{ width: '68px', padding: '3px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.63rem', outline: 'none' }} />
                          </div>

                          {/* 字体 */}
                          <div>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666', display: 'block', marginBottom: '6px' }}>{isZh ? '字体' : 'Font'}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {allFonts.map(f => (
                                <button key={f.family}
                                  onClick={() => updateLayer(layer.id, { fontFamily: f.family, fontLabel: f.label } as Partial<TextLayer>)}
                                  style={{ padding: '3px 8px', borderRadius: '5px', border: `1px solid ${(layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: (layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.12)' : 'transparent', color: (layer as TextLayer).fontFamily === f.family ? '#eee' : '#555', cursor: 'pointer', fontFamily: f.family, fontSize: '0.7rem', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                                  {f.label}
                                </button>
                              ))}
                              <button onClick={() => fontInputRef.current?.click()}
                                style={{ padding: '3px 8px', borderRadius: '5px', border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', transition: 'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = '#aaa' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#555' }}>
                                + {isZh ? '上传字体' : 'Upload'}
                              </button>
                              <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                                onChange={e => handleFontUpload(e, layer.id)} />
                            </div>
                          </div>

                          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', color: '#3a3a3a', margin: 0 }}>
                            {isZh ? '↖ 在画布上拖动此图层' : '↖ Drag this layer on canvas'}
                          </p>
                        </>
                      ) : (
                        <>
                          {/* 大小 */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '大小' : 'Scale'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444' }}>{(layer as ImageLayer).scale}%</span>
                            </div>
                            <input type="range" min={3} max={150} value={(layer as ImageLayer).scale}
                              onChange={e => updateLayer(layer.id, { scale: Number(e.target.value) } as Partial<ImageLayer>)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>

                          {/* 不透明度（图片图层） */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '不透明度' : 'Opacity'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444' }}>{(layer as any).opacity ?? 100}%</span>
                            </div>
                            <input type="range" min={0} max={100} value={(layer as any).opacity ?? 100}
                              onChange={e => updateLayer(layer.id, { opacity: Number(e.target.value) } as any)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>

                          {/* 跟随调色 */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#666' }}>{isZh ? '跟随调色' : 'Follow color'}</span>
                            <button onClick={() => updateLayer(layer.id, { followColor: !(layer as ImageLayer).followColor } as Partial<ImageLayer>)}
                              style={{ padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: (layer as ImageLayer).followColor ? '#4aab6f' : 'rgba(255,255,255,0.08)', color: (layer as ImageLayer).followColor ? '#fff' : '#555', fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', transition: 'all 0.15s' }}>
                              {(layer as ImageLayer).followColor ? 'YES' : 'NO'}
                            </button>
                          </div>

                          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.58rem', color: '#3a3a3a', margin: 0 }}>
                            {isZh ? '↖ 在画布上拖动此图层' : '↖ Drag this layer on canvas'}
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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