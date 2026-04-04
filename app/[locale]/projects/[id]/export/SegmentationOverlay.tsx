'use client'
// ─────────────────────────────────────────────────────────────────────────────
// SegmentationOverlay.tsx  —  v2  (PS-style quick-select animation)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useEffect, useCallback, useState } from 'react'
import type { ImageLayer } from './imageEditorTypes'
import { useSegmentation } from './useSegmentation'
import type { BrushMode } from './segmentationTypes'

interface SegmentationOverlayProps {
  layer: ImageLayer
  isZh: boolean
  onApply: (newSrc: string) => void
  onClose: () => void
}

const STATUS_LABEL: Record<string, string> = {
  idle:      '准备中…',
  loading:   '模型加载中…',
  encoding:  '分析图像…',
  ready:     '点击选择保留区域',
  inferring: '推理中…',
  error:     '出错了，请刷新重试',
}
const STATUS_LABEL_EN: Record<string, string> = {
  idle:      'Initializing…',
  loading:   'Loading model…',
  encoding:  'Analyzing image…',
  ready:     'Click to select areas to keep',
  inferring: 'Running…',
  error:     'Error — please refresh',
}

const QS_TIPS_ZH = ['左键拖动 = 扩张选区', '右键 / Alt+拖动 = 从选区减去', '容差越大选区越宽']
const QS_TIPS_EN = ['Drag = expand selection', 'Right drag / Alt = subtract', 'Higher tolerance = wider spread']
const DEFAULT_TIPS_ZH = ['左键 = 加入选区', '右键 / Alt+点 = 排除', '多次点击可精细修正']
const DEFAULT_TIPS_EN = ['Left click = add', 'Right click / Alt = exclude', 'Multiple clicks to refine']

// ── 工具按钮 ──────────────────────────────────────────────────────────────────
function ToolBtn({
  active, onClick, title, children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        padding: '6px 11px',
        borderRadius: '7px',
        border: `1px solid ${active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.12)'}`,
        background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: active ? '#f0f0f0' : '#666',
        cursor: 'pointer',
        fontFamily: 'Space Mono, monospace',
        fontSize: '0.68rem',
        letterSpacing: '0.04em',
        transition: 'all 0.1s',
        lineHeight: 1,
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
    >
      {children}
    </button>
  )
}

// ── marching ants 参数 ────────────────────────────────────────────────────────
const DASH_LEN   = 6
const GAP_LEN    = 4
const ANT_SPEED  = 0.8   // px per frame

// ── 从 mask 提取轮廓边缘像素（canvas 坐标空间） ────────────────────────────────
function extractEdgePixels(
  maskData: Uint8ClampedArray,
  mw: number, mh: number,
  dx: number, dy: number,
  scale: number,
): { x: number; y: number }[] {
  // 降采样扫描（每隔 2px），性能更好
  const step = 2
  const pts: { x: number; y: number }[] = []
  for (let y = step; y < mh - step; y += step) {
    for (let x = step; x < mw - step; x += step) {
      const idx = y * mw + x
      if (maskData[idx] === 0) continue
      // 检测 4 邻域是否有背景像素
      const hasEdge =
        maskData[(y - step) * mw + x] === 0 ||
        maskData[(y + step) * mw + x] === 0 ||
        maskData[y * mw + (x - step)] === 0 ||
        maskData[y * mw + (x + step)] === 0
      if (hasEdge) {
        pts.push({ x: dx + x * scale, y: dy + y * scale })
      }
    }
  }
  return pts
}

export function SegmentationOverlay({
  layer, isZh, onApply, onClose,
}: SegmentationOverlayProps) {

  const seg = useSegmentation(layer.el)

  const containerRef  = useRef<HTMLDivElement>(null)
  const imgCanvasRef  = useRef<HTMLCanvasElement>(null)
  const maskCanvasRef = useRef<HTMLCanvasElement>(null)
  const interactRef   = useRef<HTMLCanvasElement>(null)
  // 新增：动画专用层（最顶层，pointer-events: none）
  const animCanvasRef = useRef<HTMLCanvasElement>(null)

  const isDrawingRef  = useRef(false)
  const strokeBufRef  = useRef<{ x: number; y: number }[]>([])
  // 快选笔画：记录上次触发 QS 的坐标，用于 8px 节流
  const lastQSPosRef  = useRef<{ x: number; y: number } | null>(null)
  const isQSDrawRef   = useRef(false)
  const qsSubtractRef = useRef(false)

  const [showCheckerboard, setShowCheckerboard] = useState(false)

  // ── 动画状态 refs（不触发 re-render）────────────────────────────────────────
  const antOffsetRef  = useRef(0)
  const animFrameRef  = useRef<number>(0)
  const edgePtsRef    = useRef<{ x: number; y: number }[]>([])
  // 记录 mask 对应的 canvas 变换参数，供动画层使用
  const maskXfRef     = useRef<{ dx: number; dy: number; scale: number; mw: number; mh: number } | null>(null)

  // ── canvas 尺寸同步 ────────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resize = () => {
      const { width: w, height: h } = container.getBoundingClientRect()
      for (const ref of [imgCanvasRef, maskCanvasRef, interactRef, animCanvasRef]) {
        if (ref.current) {
          ref.current.width  = w
          ref.current.height = h
        }
      }
      seg._setCanvasSize(w, h)
      drawImage()
    }

    const ro = new ResizeObserver(resize)
    ro.observe(container)
    resize()
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer.el])

  // ── 绘制底层原图 ───────────────────────────────────────────────────────────
  const drawImage = useCallback(() => {
    const canvas = imgCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { naturalWidth: iw, naturalHeight: ih } = layer.el
    const cw = canvas.width, ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    if (showCheckerboard) {
      const size = 12
      for (let y = 0; y < ch; y += size) {
        for (let x = 0; x < cw; x += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0
            ? '#2a2a2a' : '#1a1a1a'
          ctx.fillRect(x, y, size, size)
        }
      }
    }

    const scale = Math.min(cw / iw, ch / ih)
    ctx.drawImage(layer.el,
      (cw - iw * scale) / 2, (ch - ih * scale) / 2,
      iw * scale, ih * scale,
    )
  }, [layer.el, showCheckerboard])

  useEffect(() => { drawImage() }, [drawImage])

  // ── 绘制 mask 覆盖层 ───────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = maskCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const cw = canvas.width, ch = canvas.height
    ctx.clearRect(0, 0, cw, ch)

    if (!seg.mask) {
      maskXfRef.current = null
      edgePtsRef.current = []
      return
    }

    const { data: maskData, width: mw, height: mh } = seg.mask
    const { naturalWidth: iw, naturalHeight: ih } = layer.el
    const scale = Math.min(cw / iw, ch / ih)
    const dw = iw * scale, dh = ih * scale
    const dx = (cw - dw) / 2, dy = (ch - dh) / 2
    // mask 像素 → canvas 坐标的缩放比
    const maskScale = dw / mw

    // 保存变换参数
    maskXfRef.current = { dx, dy, scale: maskScale, mw, mh }

    // 重新计算边缘像素
    edgePtsRef.current = extractEdgePixels(maskData, mw, mh, dx, dy, maskScale)

    if (showCheckerboard) {
      ctx.save()
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, cw, ch)
      const off = document.createElement('canvas')
      off.width = mw; off.height = mh
      const octx = off.getContext('2d')!
      octx.drawImage(layer.el, 0, 0, mw, mh)
      const imgData = octx.getImageData(0, 0, mw, mh)
      for (let i = 0; i < maskData.length; i++) imgData.data[i * 4 + 3] = maskData[i]
      octx.putImageData(imgData, 0, 0)
      ctx.globalCompositeOperation = 'destination-out'
      ctx.drawImage(off, dx, dy, dw, dh)
      ctx.restore()
    } else {
      const off = document.createElement('canvas')
      off.width = mw; off.height = mh
      const octx = off.getContext('2d')!
      const overlay = octx.createImageData(mw, mh)
      for (let i = 0; i < maskData.length; i++) {
        const fg = maskData[i] > 0
        overlay.data[i * 4 + 0] = fg ? 74  : 0
        overlay.data[i * 4 + 1] = fg ? 171 : 0
        overlay.data[i * 4 + 2] = fg ? 111 : 0
        overlay.data[i * 4 + 3] = fg ? 110 : 0
      }
      octx.putImageData(overlay, 0, 0)
      ctx.drawImage(off, dx, dy, dw, dh)
    }
  }, [seg.mask, layer.el, showCheckerboard])

  // ── 绘制交互点 + cursor ────────────────────────────────────────────────────
  const drawInteract = useCallback(
    (cursorX?: number, cursorY?: number) => {
      const canvas = interactRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!
      const cw = canvas.width, ch = canvas.height
      ctx.clearRect(0, 0, cw, ch)

      const { naturalWidth: iw, naturalHeight: ih } = layer.el
      const scale = Math.min(cw / iw, ch / ih)
      const dw = iw * scale, dh = ih * scale
      const dx = (cw - dw) / 2, dy = (ch - dh) / 2

      // SAM prompt 点
      for (const pt of seg.points) {
        const px = dx + pt.x * dw
        const py = dy + pt.y * dh
        const isPos = pt.label === 1
        ctx.beginPath()
        ctx.arc(px, py, 7, 0, Math.PI * 2)
        ctx.fillStyle = isPos ? 'rgba(74,171,111,0.9)' : 'rgba(191,74,74,0.9)'
        ctx.fill()
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 9px Space Mono, monospace'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(isPos ? '+' : '−', px, py)
      }

      // 画笔 cursor
      if (cursorX !== undefined && cursorY !== undefined &&
          (seg.brushMode === 'brush_add' || seg.brushMode === 'brush_erase')) {
        ctx.beginPath()
        ctx.arc(cursorX, cursorY, seg.brushRadius, 0, Math.PI * 2)
        ctx.strokeStyle = seg.brushMode === 'brush_erase'
          ? 'rgba(191,74,74,0.8)' : 'rgba(74,171,111,0.8)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([3, 3])
        ctx.stroke()
        ctx.setLineDash([])
      }

      // 快速选择 cursor：精密十字准星（PS 风格）
      if (cursorX !== undefined && cursorY !== undefined &&
          seg.brushMode === 'quick_select') {
        const r = 9
        const arm = 6
        const gap = 3

        ctx.save()
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.setLineDash([])
        // 阴影十字
        ctx.beginPath()
        ctx.moveTo(cursorX - r - arm, cursorY); ctx.lineTo(cursorX - r - gap, cursorY)
        ctx.moveTo(cursorX + r + gap, cursorY); ctx.lineTo(cursorX + r + arm, cursorY)
        ctx.moveTo(cursorX, cursorY - r - arm); ctx.lineTo(cursorX, cursorY - r - gap)
        ctx.moveTo(cursorX, cursorY + r + gap); ctx.lineTo(cursorX, cursorY + r + arm)
        ctx.stroke()
        // 阴影外圆
        ctx.beginPath()
        ctx.arc(cursorX, cursorY, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()

        ctx.save()
        ctx.strokeStyle = 'rgba(255,210,60,1)'
        ctx.lineWidth = 1.5
        ctx.lineCap = 'round'
        ctx.setLineDash([])
        // 前景十字
        ctx.beginPath()
        ctx.moveTo(cursorX - r - arm, cursorY); ctx.lineTo(cursorX - r - gap, cursorY)
        ctx.moveTo(cursorX + r + gap, cursorY); ctx.lineTo(cursorX + r + arm, cursorY)
        ctx.moveTo(cursorX, cursorY - r - arm); ctx.lineTo(cursorX, cursorY - r - gap)
        ctx.moveTo(cursorX, cursorY + r + gap); ctx.lineTo(cursorX, cursorY + r + arm)
        ctx.stroke()
        // 前景外圆
        ctx.beginPath()
        ctx.arc(cursorX, cursorY, r, 0, Math.PI * 2)
        ctx.stroke()
        // 中心点
        ctx.beginPath()
        ctx.arc(cursorX, cursorY, 1.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,210,60,1)'
        ctx.fill()
        ctx.restore()
      }
    },
    [seg.points, seg.brushMode, seg.brushRadius, layer.el],
  )

  useEffect(() => { drawInteract() }, [drawInteract])

  // ── 动画循环：marching ants + 波纹扩散 ─────────────────────────────────────
  useEffect(() => {
    const canvas = animCanvasRef.current
    if (!canvas) return

    let running = true

    const loop = () => {
      if (!running) return
      const ctx = canvas.getContext('2d')!
      const cw = canvas.width, ch = canvas.height
      ctx.clearRect(0, 0, cw, ch)

      // ── Marching ants 选区蚂蚁线 ──────────────────────────────────────────
      const edges = edgePtsRef.current
      if (edges.length > 0) {
        antOffsetRef.current = (antOffsetRef.current + ANT_SPEED) % (DASH_LEN + GAP_LEN)
        const offset = antOffsetRef.current

        // 白色线（实线）
        ctx.save()
        ctx.setLineDash([DASH_LEN, GAP_LEN])
        ctx.lineDashOffset = -offset
        ctx.strokeStyle = 'rgba(255,255,255,0.95)'
        ctx.lineWidth = 1

        // 用散点模拟轮廓（比 path 更适合非连续轮廓）
        for (const pt of edges) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 0.8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.fill()
        }
        ctx.restore()

        // 黑色偏移线（对比用）
        ctx.save()
        ctx.setLineDash([DASH_LEN, GAP_LEN])
        ctx.lineDashOffset = -(offset + DASH_LEN)
        for (const pt of edges) {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 0.8, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.fill()
        }
        ctx.restore()
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)
    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [])

  // ── Pointer 事件 ───────────────────────────────────────────────────────────
  const getCanvasXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const { x, y } = getCanvasXY(e)
      const isBrush = seg.brushMode === 'brush_add' || seg.brushMode === 'brush_erase'
      const isQS    = seg.brushMode === 'quick_select'

      if (isBrush) {
        isDrawingRef.current = true
        strokeBufRef.current = [{ x, y }]
        ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
      } else if (isQS) {
        const isSubtract = e.button === 2 || e.altKey
        isQSDrawRef.current   = true
        qsSubtractRef.current = isSubtract
        lastQSPosRef.current  = { x, y }
        seg.onQuickSelect(x, y, isSubtract)
        ;(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId)
      } else {
        const isNeg = e.button === 2 || e.altKey
        seg.onCanvasClick(x, y, isNeg)
      }
    },
    [seg],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasXY(e)
      const isBrush = seg.brushMode === 'brush_add' || seg.brushMode === 'brush_erase'
      drawInteract(x, y)

      if (isBrush && isDrawingRef.current) {
        strokeBufRef.current.push({ x, y })
        if (strokeBufRef.current.length >= 4) {
          seg.onBrushStroke([...strokeBufRef.current])
          strokeBufRef.current = [{ x, y }]
        }
      }

      // 快选笔画：每移动 8px（canvas 坐标）触发一次 QS
      if (isQSDrawRef.current && lastQSPosRef.current) {
        const dx = x - lastQSPosRef.current.x
        const dy = y - lastQSPosRef.current.y
        if (dx * dx + dy * dy >= 64) {   // 8px²
          seg.onQuickSelect(x, y, qsSubtractRef.current)
          lastQSPosRef.current = { x, y }
        }
      }
    },
    [seg, drawInteract],
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (isDrawingRef.current) {
        if (strokeBufRef.current.length > 0) seg.onBrushStroke(strokeBufRef.current)
        strokeBufRef.current = []
        isDrawingRef.current = false
      }
      // 快选笔画结束
      isQSDrawRef.current  = false
      lastQSPosRef.current = null
    },
    [seg],
  )

  const handlePointerLeave = useCallback(() => { drawInteract() }, [drawInteract])
  const handleContextMenu = useCallback((e: React.MouseEvent) => { e.preventDefault() }, [])

  // ── 应用 ──────────────────────────────────────────────────────────────────
  const handleApply = useCallback(() => {
    const dataUrl = seg.applyMaskToImage(layer.el)
    if (dataUrl) onApply(dataUrl)
  }, [seg, layer.el, onApply])

  // ── 派生状态 ───────────────────────────────────────────────────────────────
  const isBrushMode = seg.brushMode === 'brush_add' || seg.brushMode === 'brush_erase'
  const isQSMode    = seg.brushMode === 'quick_select'

  const cursorStyle = isBrushMode || isQSMode ? 'none' : (
    seg.brushMode === 'point_negative' ? 'crosshair' : 'cell'
  )

  const statusText = isZh
    ? (STATUS_LABEL[seg.status] ?? seg.status)
    : (STATUS_LABEL_EN[seg.status] ?? seg.status)

  const canApply = !!seg.mask && seg.status === 'ready'

  const tips = isQSMode
    ? (isZh ? QS_TIPS_ZH : QS_TIPS_EN)
    : (isZh ? DEFAULT_TIPS_ZH : DEFAULT_TIPS_EN)

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(4px)',
    }}>

      {/* ── 顶部工具栏 ── */}
      <div style={{
        height: '52px', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        background: '#0e0e0e',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: '8px',
      }}>
        <span style={{
          fontFamily: 'Space Mono, monospace', fontSize: '0.62rem',
          color: '#444', letterSpacing: '0.2em', textTransform: 'uppercase',
          marginRight: '8px',
        }}>
          {isZh ? '抠图' : 'Cutout'}
        </span>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* 快速选择 */}
        <ToolBtn
          active={isQSMode}
          onClick={() => seg.setBrushMode('quick_select')}
          title={isZh ? '快速选择：拖动扩张相似区域' : 'Quick select: drag to expand similar pixels'}
        >
          <span style={{ fontSize: '0.8rem' }}>⊕</span>
          {isZh ? '快选' : 'Quick'}
        </ToolBtn>

        {/* 快选参数：容差 + 采样半径，并排一行 */}
        {isQSMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#555', whiteSpace: 'nowrap' }}>
                {isZh ? `容差 ${seg.tolerance}` : `tol ${seg.tolerance}`}
              </span>
              <input
                type="range" min={4} max={80} step={1} value={seg.tolerance}
                onChange={e => seg.setTolerance(Number(e.target.value))}
                style={{ width: '68px', accentColor: '#c8a020' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#555', whiteSpace: 'nowrap' }}>
                {isZh ? `采样 ${seg.sampleRadius}` : `smpl ${seg.sampleRadius}`}
              </span>
              <input
                type="range" min={1} max={12} step={1} value={seg.sampleRadius}
                onChange={e => seg.setSampleRadius(Number(e.target.value))}
                style={{ width: '56px', accentColor: '#a06820' }}
              />
            </div>
          </div>
        )}

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* SAM 点选 */}
        <ToolBtn
          active={seg.brushMode === 'point_positive'}
          onClick={() => seg.setBrushMode('point_positive')}
          title={isZh ? '左键点击：AI 选区' : 'Click: AI select'}
        >
          <span style={{ fontSize: '0.75rem' }}>✦</span>
          {isZh ? 'AI选' : 'AI'}
        </ToolBtn>
        <ToolBtn
          active={seg.brushMode === 'point_negative'}
          onClick={() => seg.setBrushMode('point_negative')}
          title={isZh ? '点击：排除区域' : 'Click: exclude'}
        >
          <span style={{ fontSize: '0.75rem' }}>✕</span>
          {isZh ? '排除' : 'Excl'}
        </ToolBtn>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* 画笔 */}
        <ToolBtn
          active={seg.brushMode === 'brush_add'}
          onClick={() => seg.setBrushMode('brush_add')}
          title={isZh ? '画笔：手动涂抹加入' : 'Brush: paint to add'}
        >
          <span style={{ fontSize: '0.8rem' }}>◎</span>
          {isZh ? '画笔' : 'Brush'}
        </ToolBtn>
        <ToolBtn
          active={seg.brushMode === 'brush_erase'}
          onClick={() => seg.setBrushMode('brush_erase')}
          title={isZh ? '橡皮：涂抹删除' : 'Eraser'}
        >
          <span style={{ fontSize: '0.8rem' }}>◌</span>
          {isZh ? '橡皮' : 'Erase'}
        </ToolBtn>

        {isBrushMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#555' }}>
              {seg.brushRadius}px
            </span>
            <input
              type="range" min={4} max={80} value={seg.brushRadius}
              onChange={e => seg.setBrushRadius(Number(e.target.value))}
              style={{ width: '72px', accentColor: '#4aab6f' }}
            />
          </div>
        )}

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* 撤销 / 重置 */}
        <ToolBtn onClick={seg.undoLastPoint} title={isZh ? '撤销上一个点' : 'Undo last point'}>↩</ToolBtn>
        <ToolBtn onClick={seg.reset} title={isZh ? '清空所有' : 'Reset all'}>
          {isZh ? '清空' : 'Reset'}
        </ToolBtn>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)' }} />

        {/* 透明预览 */}
        <ToolBtn
          active={showCheckerboard}
          onClick={() => setShowCheckerboard(v => !v)}
          title={isZh ? '透明预览' : 'Preview transparency'}
        >
          <span style={{ fontSize: '0.75rem' }}>⬜</span>
          {isZh ? '预览' : 'Preview'}
        </ToolBtn>

        {/* 状态 */}
        <span style={{
          marginLeft: 'auto',
          fontFamily: 'Space Mono, monospace', fontSize: '0.6rem',
          color: seg.status === 'error' ? '#bf4a4a' : '#3a5a46',
          letterSpacing: '0.08em',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          {(seg.status === 'loading' || seg.status === 'encoding' || seg.status === 'inferring') && (
            <span style={{ display: 'inline-block', animation: 'seg-spin 1s linear infinite' }}>◌</span>
          )}
          {seg.mask && seg.status === 'ready' && (
            <span style={{ color: isQSMode ? '#c8a020' : '#4aab6f' }}>
              {isQSMode
                ? (isZh ? '选区就绪' : 'Selection ready')
                : (isZh ? `置信度 ${Math.round(seg.mask.score * 100)}%` : `IoU ${Math.round(seg.mask.score * 100)}%`)
              }
            </span>
          )}
          {statusText}
        </span>

        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.07)', marginLeft: '12px' }} />

        {/* 羽化滑块：全局参数，apply 时生效 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#555', whiteSpace: 'nowrap' }}>
            {isZh ? `羽化 ${seg.featherRadius}` : `fth ${seg.featherRadius}`}
          </span>
          <input
            type="range" min={0} max={6} step={1} value={seg.featherRadius}
            onChange={e => seg.setFeatherRadius(Number(e.target.value))}
            style={{ width: '56px', accentColor: '#7a6aaa' }}
          />
        </div>

        {/* 取消 */}
        <button
          onClick={onClose}
          style={{
            padding: '6px 14px', borderRadius: '7px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'transparent', color: '#666',
            cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: '0.68rem',
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ccc'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#666'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)' }}
        >
          {isZh ? '取消' : 'Cancel'}
        </button>

        {/* 应用 */}
        <button
          onClick={handleApply}
          disabled={!canApply}
          style={{
            padding: '6px 18px', borderRadius: '7px',
            border: 'none',
            background: canApply ? '#4aab6f' : 'rgba(74,171,111,0.15)',
            color: canApply ? '#fff' : '#2a5a3a',
            cursor: canApply ? 'pointer' : 'not-allowed',
            fontFamily: 'Space Mono, monospace', fontSize: '0.68rem',
            transition: 'all 0.1s',
          }}
        >
          {isZh ? '应用抠图' : 'Apply'}
        </button>
      </div>

      {/* ── 提示栏 ── */}
      <div style={{
        height: '28px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '20px',
        background: isQSMode ? 'rgba(30,24,0,0.6)' : 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        transition: 'background 0.2s',
      }}>
        {tips.map(tip => (
          <span key={tip} style={{
            fontFamily: 'Space Mono, monospace', fontSize: '0.58rem',
            color: isQSMode ? '#554a00' : '#333',
            letterSpacing: '0.06em',
          }}>
            {tip}
          </span>
        ))}
      </div>

      {/* ── 画布区域 ── */}
      <div
        ref={containerRef}
        style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
      >
        {/* 层顺序（z-index 低→高）: 原图 → mask → 交互点 → 动画 */}
        <canvas ref={imgCanvasRef}  style={{ position: 'absolute', inset: 0 }} />
        <canvas ref={maskCanvasRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
        <canvas
          ref={interactRef}
          style={{ position: 'absolute', inset: 0, cursor: cursorStyle }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={handleContextMenu}
        />
        {/* 动画层：marching ants + 波纹，完全不捕获事件 */}
        <canvas
          ref={animCanvasRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        />

        {/* 加载遮罩 */}
        {(seg.status === 'loading' || seg.status === 'encoding') && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.55)',
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '32px', height: '32px', margin: '0 auto 12px',
                border: '2px solid rgba(74,171,111,0.2)',
                borderTop: '2px solid #4aab6f',
                borderRadius: '50%',
                animation: 'seg-spin 0.8s linear infinite',
              }} />
              <p style={{
                fontFamily: 'Space Mono, monospace', fontSize: '0.62rem',
                color: '#4aab6f', letterSpacing: '0.1em',
              }}>
                {statusText}
              </p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes seg-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}