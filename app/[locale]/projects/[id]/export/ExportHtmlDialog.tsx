'use client'
/**
 * ExportHtmlDialog.tsx
 *
 * 导出 HTML 截图前弹出的设置对话框。
 * 包含：背景色预设 + 自定义 color picker、页面间距 slider、截图圆角 slider。
 *
 * 使用方式（在你的页面组件里）：
 * ─────────────────────────────────────────────────────────────
 * import { ExportHtmlDialog, HtmlExportConfig, DEFAULT_HTML_EXPORT_CONFIG } from './ExportHtmlDialog'
 *
 * const [exportDialogOpen, setExportDialogOpen] = useState(false)
 * const [htmlExportConfig, setHtmlExportConfig] = useState<HtmlExportConfig>(DEFAULT_HTML_EXPORT_CONFIG)
 *
 * // 把原来直接调用 doExportHTML() 的按钮改成打开对话框：
 * <button onClick={() => setExportDialogOpen(true)}>导出 HTML</button>
 *
 * <ExportHtmlDialog
 *   open={exportDialogOpen}
 *   config={htmlExportConfig}
 *   onChange={setHtmlExportConfig}
 *   onConfirm={() => { setExportDialogOpen(false); doExportHTML(htmlExportConfig) }}
 *   onCancel={() => setExportDialogOpen(false)}
 *   isZh={isZh}
 * />
 *
 * // doExportHTML 签名改为接收 config：
 * // doExportHTML(config: HtmlExportConfig)
 * ─────────────────────────────────────────────────────────────
 */

import React, { useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

/** HTML 截图导出的外层包装样式配置（与 ExportOptions 解耦，单独持久化或随用随传） */
export interface HtmlExportConfig {
  /** CSS background（纯色字符串 或 渐变字符串均可） */
  background: string
  /** 截图之间的垂直间距，单位 px */
  gap: number
  /** 截图圆角，单位 px */
  radius: number
  /** 截图最大宽度，单位 px；0 = 撑满屏幕 */
  maxWidth: number
  /** 截图阴影强度 0–100 */
  shadow: number
}

export const DEFAULT_HTML_EXPORT_CONFIG: HtmlExportConfig = {
  background: '#f0f0f0',
  gap: 32,
  radius: 8,
  maxWidth: 0,
  shadow: 20,
}

// ─── Background presets ───────────────────────────────────────────────────────

interface BgPreset {
  key: string
  label: string
  labelEn: string
  /** 实际写入 HTML body background 的 CSS 值 */
  value: string
  /** 仅用于色块预览的 CSS background（磨砂用条纹模拟） */
  preview: string
}

const BG_PRESETS: BgPreset[] = [
  {
    key: 'white',
    label: '纯白', labelEn: 'White',
    value: '#ffffff',
    preview: '#ffffff',
  },
  {
    key: 'offwhite',
    label: '暖白', labelEn: 'Warm',
    value: '#f4f2ee',
    preview: '#f4f2ee',
  },
  {
    key: 'light-gray',
    label: '浅灰', labelEn: 'Light',
    value: '#ebebeb',
    preview: '#ebebeb',
  },
  {
    key: 'dark',
    label: '深灰', labelEn: 'Dark',
    value: '#1e1e1e',
    preview: '#1e1e1e',
  },
  {
    key: 'black',
    label: '纯黑', labelEn: 'Black',
    value: '#0a0a0a',
    preview: '#0a0a0a',
  },
  {
    key: 'grad-cool',
    label: '冷光', labelEn: 'Cool',
    value: 'linear-gradient(135deg,#f5f0ff 0%,#e8f4ff 50%,#f0fff8 100%)',
    preview: 'linear-gradient(135deg,#f5f0ff 0%,#e8f4ff 50%,#f0fff8 100%)',
  },
  {
    key: 'grad-warm',
    label: '暖调', labelEn: 'Warm+',
    value: 'linear-gradient(135deg,#fdf8f0 0%,#fff5e8 50%,#fdf0f5 100%)',
    preview: 'linear-gradient(135deg,#fdf8f0 0%,#fff5e8 50%,#fdf0f5 100%)',
  },
  {
    key: 'grad-dark',
    label: '深夜', labelEn: 'Night',
    value: 'linear-gradient(135deg,#0d1117 0%,#0d1b2a 50%,#1a0d1a 100%)',
    preview: 'linear-gradient(135deg,#0d1117 0%,#0d1b2a 50%,#1a0d1a 100%)',
  },
  {
    key: 'frost-light',
    label: '磨砂白', labelEn: 'Frost',
    value: '#e2e2e2',
    preview: 'repeating-linear-gradient(45deg,#d8d8d8 0px,#d8d8d8 2px,#eaeaea 2px,#eaeaea 8px)',
  },
  {
    key: 'frost-dark',
    label: '磨砂黑', labelEn: 'Smoky',
    value: '#1a1a1a',
    preview: 'repeating-linear-gradient(45deg,#141414 0px,#141414 2px,#232323 2px,#232323 8px)',
  },
  {
    key: 'custom',
    label: '自定义', labelEn: 'Custom',
    value: '',
    preview: '',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  config: HtmlExportConfig
  onChange: (c: HtmlExportConfig) => void
  onConfirm: () => void
  onCancel: () => void
  isZh?: boolean
}

export function ExportHtmlDialog({
  open, config, onChange, onConfirm, onCancel, isZh = true,
}: Props) {
  const [customColor, setCustomColor] = useState('#ffffff')

  // 当前激活的 preset key
  const activeKey = useCallback((): string => {
    const match = BG_PRESETS.find(p => p.key !== 'custom' && p.value === config.background)
    return match ? match.key : 'custom'
  }, [config.background])

  const selectPreset = (preset: BgPreset) => {
    if (preset.key === 'custom') {
      onChange({ ...config, background: customColor })
    } else {
      onChange({ ...config, background: preset.value })
    }
  }

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color)
    onChange({ ...config, background: color })
  }

  if (!open) return null

  const current = activeKey()

  // 判断当前背景是深色（用于预览对比）
  const isDarkBg = ['dark', 'black', 'grad-dark', 'frost-dark'].includes(current)
    || (current === 'custom' && isDarkColor(customColor))

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        style={{
          width: 440,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
        }}>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {isZh ? '导出设置' : 'Export Settings'}
          </span>
          <button
            onClick={onCancel}
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'rgba(0,0,0,0.06)', border: 'none',
              cursor: 'pointer', fontSize: 18, lineHeight: '28px',
              textAlign: 'center', color: '#666',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 页面宽度 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SectionLabel>{isZh ? '页面宽度' : 'Page Width'}</SectionLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {([
                { label: isZh ? '撑满' : 'Full',    sub: '100%',  value: 0 },
                { label: isZh ? '居中' : 'Center',  sub: '860px', value: 860 },
                { label: isZh ? '紧凑' : 'Compact', sub: '640px', value: 640 },
              ] as { label: string; sub: string; value: number }[]).map(s => {
                const isActive = config.maxWidth === s.value
                return (
                  <button
                    key={s.value}
                    onClick={() => onChange({ ...config, maxWidth: s.value })}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: 10,
                      border: isActive ? '2px solid #1a1a1a' : '2px solid rgba(0,0,0,0.1)',
                      background: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                  >
                    <div style={{
                      width: '100%', height: 28, borderRadius: 5,
                      background: 'rgba(0,0,0,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '0 4px',
                    }}>
                      <div style={{
                        height: 14, borderRadius: 3,
                        background: isActive ? '#1a1a1a' : 'rgba(0,0,0,0.18)',
                        width: s.value === 0 ? '100%' : s.value === 860 ? '78%' : '58%',
                        transition: 'width 0.15s',
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? '#1a1a1a' : '#555', letterSpacing: '-0.01em' }}>
                      {s.label}
                    </span>
                    <span style={{ fontSize: 10, color: '#aaa' }}>{s.sub}</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* 背景颜色 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SectionLabel>{isZh ? '背景颜色' : 'Background'}</SectionLabel>

            {/* 预设网格 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {BG_PRESETS.map(preset => {
                const isActive = current === preset.key
                const swatchBg = preset.key === 'custom'
                  ? (customColor || '#ffffff')
                  : preset.preview || preset.value

                return (
                  <button
                    key={preset.key}
                    title={isZh ? preset.label : preset.labelEn}
                    onClick={() => selectPreset(preset)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                      padding: '8px 4px',
                      borderRadius: 12,
                      border: isActive ? '2px solid #1a1a1a' : '2px solid transparent',
                      background: isActive ? 'rgba(0,0,0,0.04)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                  >
                    {/* color swatch */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: swatchBg,
                      border: '1px solid rgba(0,0,0,0.1)',
                      position: 'relative', overflow: 'hidden', flexShrink: 0,
                    }}>
                      {/* native color picker hidden inside custom swatch */}
                      {preset.key === 'custom' && (
                        <input
                          type="color"
                          value={customColor}
                          onChange={e => handleCustomColorChange(e.target.value)}
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', inset: 0,
                            opacity: 0, cursor: 'pointer',
                            width: '100%', height: '100%',
                            padding: 0, border: 'none',
                          }}
                        />
                      )}
                      {/* checkmark for active */}
                      {isActive && (
                        <div style={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <span style={{
                            fontSize: 16, lineHeight: 1,
                            color: isDarkBg ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)',
                            textShadow: isDarkBg
                              ? '0 1px 3px rgba(0,0,0,0.5)'
                              : '0 1px 3px rgba(255,255,255,0.8)',
                          }}>✓</span>
                        </div>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, color: '#777', letterSpacing: '-0.01em',
                      lineHeight: 1.3, textAlign: 'center',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {isZh ? preset.label : preset.labelEn}
                    </span>
                  </button>
                )
              })}
            </div>

          </section>

          {/* 页面间距 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel>{isZh ? '页面间距' : 'Page Gap'}</SectionLabel>
              <ValueTag>{config.gap}px</ValueTag>
            </div>
            <input
              type="range" min={0} max={120} step={4}
              value={config.gap}
              onChange={e => onChange({ ...config, gap: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb' }}>
              <span>0</span>
              <span>120px</span>
            </div>

            {/* ── 实时间距预览（2×2 卡片） ── */}
            <div
              style={{
                marginTop: 4,
                borderRadius: 10,
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.08)',
                background: config.background,
                padding: 12,
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: Math.min(config.gap, 120) * 0.35,
                transition: 'gap 0.08s',
              }}
            >
              {[
                [55, 80], [70, 45], [40, 90], [85, 60],
              ].map(([w1, w2], i) => (
                <div
                  key={i}
                  style={{
                    borderRadius: Math.min(config.radius, 32) * 0.6,
                    background: isDarkBg ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.9)',
                    boxShadow: (() => { const s = config.shadow ?? 20; return isDarkBg
                      ? `0 ${2 + s * 0.08}px ${4 + s * 0.18}px rgba(0,0,0,${(0.15 + s * 0.007).toFixed(2)})`
                      : `0 ${1 + s * 0.06}px ${3 + s * 0.15}px rgba(0,0,0,${(0.04 + s * 0.004).toFixed(2)})`; })(),
                    padding: '10px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    transition: 'border-radius 0.08s',
                  }}
                >
                  {/* 模拟标题行 */}
                  <div style={{
                    height: 5, width: `${w1}%`, borderRadius: 3,
                    background: isDarkBg ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.18)',
                  }} />
                  {/* 模拟内容行 */}
                  <div style={{
                    height: 4, width: `${w2}%`, borderRadius: 3,
                    background: isDarkBg ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)',
                  }} />
                  <div style={{
                    height: 4, width: `${Math.round((w1 + w2) / 2.3)}%`, borderRadius: 3,
                    background: isDarkBg ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)',
                  }} />
                </div>
              ))}
            </div>
          </section>

          {/* 圆角 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel>{isZh ? '截图圆角' : 'Corner Radius'}</SectionLabel>
              <ValueTag>{config.radius}px</ValueTag>
            </div>
            <input
              type="range" min={0} max={32} step={2}
              value={config.radius}
              onChange={e => onChange({ ...config, radius: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb' }}>
              <span>{isZh ? '直角' : 'Square'}</span>
              <span>{isZh ? '大圆角' : 'Rounded'}</span>
            </div>
          </section>

          {/* 阴影 */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <SectionLabel>{isZh ? '截图阴影' : 'Shadow'}</SectionLabel>
              <ValueTag>{config.shadow}</ValueTag>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={config.shadow ?? 20}
              onChange={e => onChange({ ...config, shadow: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#1a1a1a', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb' }}>
              <span>{isZh ? '无阴影' : 'None'}</span>
              <span>{isZh ? '深重' : 'Strong'}</span>
            </div>
          </section>

        </div>

        {/* ── Footer ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
          padding: '16px 24px',
          borderTop: '1px solid rgba(0,0,0,0.07)',
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 20px', borderRadius: 10,
              background: 'rgba(0,0,0,0.05)',
              border: '1px solid rgba(0,0,0,0.08)',
              fontSize: 14, cursor: 'pointer', fontWeight: 500, color: '#333',
            }}
          >{isZh ? '取消' : 'Cancel'}</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 24px', borderRadius: 10,
              background: '#1a1a1a', color: '#fff',
              border: 'none', fontSize: 14,
              cursor: 'pointer', fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >{isZh ? '导出 HTML' : 'Export HTML'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
      {children}
    </span>
  )
}

function ValueTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 500, color: '#666',
      background: 'rgba(0,0,0,0.05)',
      padding: '2px 9px', borderRadius: 6,
      fontVariantNumeric: 'tabular-nums',
      letterSpacing: '-0.01em',
    }}>
      {children}
    </span>
  )
}

/** 粗略判断十六进制颜色是否偏深（用于决定预览内容对比色） */
function isDarkColor(hex: string): boolean {
  try {
    const c = hex.replace('#', '')
    const r = parseInt(c.substring(0, 2), 16)
    const g = parseInt(c.substring(2, 4), 16)
    const b = parseInt(c.substring(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 < 128
  } catch {
    return false
  }
}