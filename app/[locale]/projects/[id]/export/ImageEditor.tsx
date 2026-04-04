'use client'
// ─────────────────────────────────────────────────────────────────────────────
// ImageEditor.tsx — 薄壳 UI，逻辑全部在 useImageEditor
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/ImageEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useRef, useEffect } from 'react'
import { useImageEditor } from './useImageEditor'
import { ImageLayer, TextLayer } from './imageEditorTypes'
import { SegmentationOverlay } from './SegmentationOverlay'

interface ImageEditorProps {
  src: string
  isZh: boolean
  onSave: (dataUrl: string) => void
  onClose: () => void
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

  // ── 抠图 overlay 状态 ──────────────────────────────────────────────────────
  // null = 关闭；'main' = 抠主图；string layerId = 抠图层
  const [segTarget, setSegTarget] = useState<'main' | string | null>(null)

  // 主图的 HTMLImageElement（用于传给 SegmentationOverlay）
  const mainImgRef = useRef<HTMLImageElement | null>(null)
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { mainImgRef.current = img }
    img.src = props.src
  }, [props.src])

  // 计算当前要抠的 ImageLayer（图层模式）
  const segImageLayer = (segTarget && segTarget !== 'main')
    ? (layers.find(l => l.id === segTarget && l.kind === 'image') as ImageLayer | undefined) ?? null
    : null

  // 构造传给 SegmentationOverlay 的 layer 对象
  const segLayer: ImageLayer | null = (() => {
    if (!segTarget) return null
    if (segTarget === 'main') {
      const el = mainImgRef.current
      if (!el) return null
      return {
        kind: 'image',
        id: '__main__',
        src: props.src,
        el,
        pos: { x: 0, y: 0 },
        scale: 100,
        visible: true,
        followColor: false,
        name: isZh ? '主图' : 'Main image',
      } satisfies ImageLayer
    }
    return segImageLayer
  })()

  // 抠图完成回调
  const handleSegApply = (newSrc: string) => {
    if (!segTarget) return
    if (segTarget === 'main') {
      // 主图：把抠图结果回写 baseImageRef，让 drawCanvas 自然重绘
      // 不直接操作 canvas，避免黑底污染 alpha
      const img = new Image()
      img.onload = () => {
        mainImgRef.current = img
        setBaseImage(img)
      }
      img.src = newSrc
    } else {
      // 图层：替换图层 src + el
      const img = new Image()
      img.onload = () => {
        updateLayer(segTarget, { src: newSrc, el: img } as Partial<ImageLayer>)
      }
      img.src = newSrc
    }
    setSegTarget(null)
  }

  const btnStyle = (hover = false) => ({
    width: '100%',
    padding: '8px 0',
    border: `1px solid ${hover ? 'rgba(74,171,111,0.5)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '7px',
    background: hover ? 'rgba(74,171,111,0.06)' : 'transparent',
    color: hover ? '#4aab6f' : '#888',
    cursor: 'pointer' as const,
    fontFamily: 'Space Mono, monospace',
    fontSize: '0.65rem',
    letterSpacing: '0.06em',
    transition: 'all 0.12s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  })

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'stretch', backdropFilter: 'blur(8px)' }}>

        {/* ── Left: Adjustments ── */}
        <div style={{ width: '220px', background: '#111', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '20px 16px', overflowY: 'auto', flexShrink: 0 }}>
          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '16px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '调整' : 'Adjust'}
          </p>
          {[
            { label: isZh ? '亮度' : 'Brightness', val: brightness, set: setBrightness, min: 0, max: 200 },
            { label: isZh ? '对比度' : 'Contrast',  val: contrast,   set: setContrast,   min: 0, max: 200 },
            { label: isZh ? '饱和度' : 'Saturation', val: saturate,  set: setSaturate,   min: 0, max: 200 },
          ].map(({ label, val, set, min, max }) => (
            <div key={label} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{label}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#444' }}>{val}</span>
              </div>
              <input type="range" min={min} max={max} value={val} onChange={e => set(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4aab6f' }} />
            </div>
          ))}

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0 16px' }} />

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '12px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '变换' : 'Transform'}
          </p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[0, 90, 180, 270].map(r => (
              <button key={r} onClick={() => setRotation(r)}
                style={{ padding: '5px 10px', border: `1px solid ${rotation === r ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', background: rotation === r ? 'rgba(255,255,255,0.1)' : 'transparent', color: rotation === r ? '#eee' : '#666', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.12s' }}>
                {r}°
              </button>
            ))}
            <button onClick={() => setFlipH(f => !f)}
              style={{ padding: '5px 10px', border: `1px solid ${flipH ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '6px', background: flipH ? 'rgba(255,255,255,0.1)' : 'transparent', color: flipH ? '#eee' : '#666', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.12s' }}>
              ↔
            </button>
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0 16px' }} />

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '12px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '调色' : 'Accent'}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
              style={{ width: '32px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none', padding: 0 }} />
            <input type="text" value={accentColor} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccentColor(e.target.value) }}
              style={{ flex: 1, padding: '3px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', outline: 'none' }} />
          </div>

          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '12px 0 16px' }} />

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '12px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '裁剪' : 'Crop'}
          </p>
          {!cropMode ? (
            <button onClick={() => setCropMode(true)}
              style={{ width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ccc' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
              {isZh ? '框选裁剪' : 'Draw to crop'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={applyCrop}
                style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '7px', background: '#4aab6f', color: '#fff', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
                {isZh ? '应用' : 'Apply'}
              </button>
              <button onClick={() => setCropMode(false)}
                style={{ flex: 1, padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem' }}>
                {isZh ? '取消' : 'Cancel'}
              </button>
            </div>
          )}

          {/* ── Cutout ── */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '12px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '抠图' : 'Cutout'}
          </p>

          {/* 主图抠图 */}
          <button
            onClick={() => setSegTarget('main')}
            style={btnStyle()}
            onMouseEnter={e => Object.assign(e.currentTarget.style, btnStyle(true))}
            onMouseLeave={e => Object.assign(e.currentTarget.style, btnStyle(false))}
          >
            <span style={{ fontSize: '0.8rem' }}>✦</span>
            {isZh ? '抠主图' : 'Cutout main'}
          </button>

          {/* 图片图层抠图（有图片图层时显示） */}
          {layers.filter(l => l.kind === 'image').length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {layers.filter(l => l.kind === 'image').map(l => (
                <button
                  key={l.id}
                  onClick={() => setSegTarget(l.id)}
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
        </div>

        {/* ── Center: Canvas ── */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <canvas
            ref={canvasRef}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', cursor: cropMode ? 'crosshair' : dragLayerId ? 'grabbing' : 'default', userSelect: 'none' }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            onDragStart={e => e.preventDefault()}
          />
        </div>

        {/* ── Right: Layers + Actions ── */}
        <div style={{ width: '220px', background: '#111', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '20px 16px', display: 'flex', flexDirection: 'column', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
            <button onClick={handleSave}
              style={{ flex: 1, padding: '9px', background: '#4aab6f', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.08em', fontWeight: 600 }}>
              {isZh ? '保存' : 'Save'}
            </button>
            <button onClick={onClose}
              style={{ padding: '9px 12px', background: 'transparent', color: '#666', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.7rem' }}>
              {isZh ? '关闭' : 'Close'}
            </button>
          </div>

          <p style={{ fontSize: '0.6rem', letterSpacing: '0.22em', textTransform: 'uppercase', color: '#555', marginBottom: '10px', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '图层' : 'Layers'}
          </p>
          <button onClick={addTextLayer}
            style={{ width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', marginBottom: '6px', transition: 'all 0.12s', textAlign: 'left' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; e.currentTarget.style.color = '#ccc' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#888' }}>
            + {isZh ? '文字图层' : 'Text layer'}
          </button>
          <button onClick={() => layerInputRef.current?.click()}
            style={{ width: '100%', padding: '8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', marginBottom: '14px', transition: 'all 0.12s', textAlign: 'left' }}
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
                  style={{ border: `1px solid ${isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: isActive ? 'rgba(255,255,255,0.04)' : 'transparent', transition: 'all 0.12s' }}
                >
                  <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '0.7rem', color: '#555', flexShrink: 0 }}>{isText ? 'T' : '⬜'}</span>
                    <span style={{ flex: 1, fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: layer.visible ? '#ccc' : '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>
                      {layer.name || `Layer ${layers.length - ri}`}
                    </span>
                    <button onClick={e => { e.stopPropagation(); updateLayer(layer.id, { visible: !layer.visible }) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: layer.visible ? '#888' : '#333', fontSize: '0.85rem', padding: '2px 4px', flexShrink: 0, lineHeight: 1 }}>
                      {layer.visible ? '👁' : '🙈'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); deleteLayer(layer.id) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(191,74,74,0.5)', fontSize: '0.8rem', padding: '2px 4px', flexShrink: 0, lineHeight: 1, transition: 'color 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(191,74,74,1)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(191,74,74,0.5)')}>✕</button>
                  </div>

                  {isActive && (
                    <div style={{ padding: '10px 10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}
                      onClick={e => e.stopPropagation()}>

                      {isText ? (
                        <>
                          <textarea value={(layer as TextLayer).text}
                            onChange={e => updateLayer(layer.id, { text: e.target.value } as Partial<TextLayer>)}
                            rows={3}
                            style={{ width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '7px', color: '#ddd', fontFamily: (layer as TextLayer).fontFamily, fontSize: '0.88rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '字号' : 'Size'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#444' }}>{(layer as TextLayer).fontSize}px</span>
                            </div>
                            <input type="range" min={10} max={200} value={(layer as TextLayer).fontSize}
                              onChange={e => updateLayer(layer.id, { fontSize: Number(e.target.value) } as Partial<TextLayer>)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666', flex: 1 }}>{isZh ? '颜色' : 'Color'}</span>
                            <input type="color" value={(layer as TextLayer).color}
                              onChange={e => updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>)}
                              style={{ width: '32px', height: '24px', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'none', padding: 0 }} />
                            <input type="text" value={(layer as TextLayer).color}
                              onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) updateLayer(layer.id, { color: e.target.value } as Partial<TextLayer>) }}
                              style={{ width: '72px', padding: '3px 7px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '5px', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', outline: 'none' }} />
                          </div>
                          <div>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666', display: 'block', marginBottom: '7px' }}>{isZh ? '字体' : 'Font'}</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                              {allFonts.map(f => (
                                <button key={f.family}
                                  onClick={() => updateLayer(layer.id, { fontFamily: f.family, fontLabel: f.label } as Partial<TextLayer>)}
                                  style={{ padding: '4px 9px', borderRadius: '5px', border: `1px solid ${(layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'}`, background: (layer as TextLayer).fontFamily === f.family ? 'rgba(255,255,255,0.12)' : 'transparent', color: (layer as TextLayer).fontFamily === f.family ? '#eee' : '#666', cursor: 'pointer', fontFamily: f.family, fontSize: '0.72rem', transition: 'all 0.12s', whiteSpace: 'nowrap' }}>
                                  {f.label}
                                </button>
                              ))}
                              <button onClick={() => fontInputRef.current?.click()}
                                style={{ padding: '4px 9px', borderRadius: '5px', border: '1px dashed rgba(255,255,255,0.15)', background: 'transparent', color: '#555', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.12s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; e.currentTarget.style.color = '#aaa' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = '#555' }}>
                                + {isZh ? '本地字体' : 'Upload'}
                              </button>
                              <input ref={fontInputRef} type="file" accept=".ttf,.otf,.woff,.woff2" style={{ display: 'none' }}
                                onChange={e => handleFontUpload(e, layer.id)} />
                            </div>
                          </div>
                          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444', margin: 0 }}>
                            {isZh ? '↖ 在画布上拖动此图层' : '↖ Drag this layer on canvas'}
                          </p>
                        </>
                      ) : (
                        <>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '大小' : 'Size'}</span>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#444' }}>{(layer as ImageLayer).scale}%</span>
                            </div>
                            <input type="range" min={3} max={150} value={(layer as ImageLayer).scale}
                              onChange={e => updateLayer(layer.id, { scale: Number(e.target.value) } as Partial<ImageLayer>)}
                              style={{ width: '100%', accentColor: '#f7f7f5' }} />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#666' }}>{isZh ? '跟随调色' : 'Follow color'}</span>
                            <button onClick={() => updateLayer(layer.id, { followColor: !(layer as ImageLayer).followColor } as Partial<ImageLayer>)}
                              style={{ padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', background: (layer as ImageLayer).followColor ? '#4aab6f' : 'rgba(255,255,255,0.08)', color: (layer as ImageLayer).followColor ? '#fff' : '#555', fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', transition: 'all 0.15s' }}>
                              {(layer as ImageLayer).followColor ? 'YES' : 'NO'}
                            </button>
                          </div>
                          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#444', margin: 0 }}>
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

      {/* ── 抠图 Overlay（zIndex: 600，盖在编辑器上） ── */}
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