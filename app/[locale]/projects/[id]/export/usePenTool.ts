'use client'
// ─────────────────────────────────────────────────────────────────────────────
// usePenTool.ts — PS-style pen tool for SegmentationOverlay
//
// 交互逻辑：
//   • 单击        → 放置直线锚点
//   • 点击+拖拽   → 放置锚点并拉出贝塞尔手柄（对称双手柄）
//   • Alt+拖拽手柄 → 断开对称，只移动当前侧手柄
//   • 点击第一个锚点（距离 < 10px）→ 闭合路径
//   • 闭合后调用 onCommit(maskData, w, h) → 外部写入 mask
//   • ESC         → 清空重来
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState, useCallback, useEffect } from 'react'

// ── 类型 ──────────────────────────────────────────────────────────────────────
export interface PenAnchor {
  x: number        // canvas 坐标
  y: number
  cp1x: number     // 入手柄（前一段的控制点）
  cp1y: number
  cp2x: number     // 出手柄（后一段的控制点）
  cp2y: number
  broken: boolean  // true = Alt 断开了对称
}

export interface PenToolControls {
  anchors: PenAnchor[]
  closed: boolean
  active: boolean   // 有锚点在画
  // 渲染用：当前鼠标位置（用于预览下一段路径）
  previewPos: { x: number; y: number } | null
  // 事件
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>, altKey: boolean) => void
  onPointerUp:   (e: React.PointerEvent<HTMLCanvasElement>) => void
  onKeyDown:     (e: KeyboardEvent) => void
  reset:         () => void
  // 绘制（外部每帧调用）
  draw: (ctx: CanvasRenderingContext2D) => void
}

// ─────────────────────────────────────────────────────────────────────────────
export function usePenTool(
  imageEl: HTMLImageElement | null,
  canvasRef: React.RefObject<HTMLCanvasElement>,
  onCommit: (data: Uint8ClampedArray, w: number, h: number) => void,
): PenToolControls {

  const [anchors, setAnchors] = useState<PenAnchor[]>([])
  const [closed,  setClosed]  = useState(false)
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null)

  // refs for pointer drag state（不触发 re-render）
  const isDraggingRef    = useRef(false)
  const dragAnchorIdxRef = useRef<number>(-1)   // 正在拖拽哪个锚点的手柄
  const anchorsRef       = useRef<PenAnchor[]>([])
  const closedRef        = useRef(false)

  // 同步 state → ref（供事件回调读最新值）
  useEffect(() => { anchorsRef.current = anchors }, [anchors])
  useEffect(() => { closedRef.current  = closed  }, [closed])

  // ── 工具函数 ──────────────────────────────────────────────────────────────
  const dist = (ax: number, ay: number, bx: number, by: number) =>
    Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

  const getXY = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  // ── 闭合 → rasterize → onCommit ──────────────────────────────────────────
  const commitPath = useCallback((pts: PenAnchor[]) => {
    if (!imageEl || pts.length < 2) return
    const iw = imageEl.naturalWidth
    const ih = imageEl.naturalHeight
    const canvas = canvasRef.current
    if (!canvas) return

    const cw = canvas.width
    const ch = canvas.height
    const scale = Math.min(cw / iw, ch / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = (cw - dw) / 2
    const dy = (ch - dh) / 2

    // 在图像原始尺寸上栅格化（和其他 mask 一样是图像坐标系）
    const off = document.createElement('canvas')
    off.width  = iw
    off.height = ih
    const ctx = off.getContext('2d')!

    // 把 canvas 坐标转回图像坐标
    const toImg = (cx: number, cy: number) => ({
      x: ((cx - dx) / dw) * iw,
      y: ((cy - dy) / dh) * ih,
    })

    ctx.beginPath()
    const p0 = toImg(pts[0].x, pts[0].y)
    ctx.moveTo(p0.x, p0.y)

    for (let i = 0; i < pts.length; i++) {
      const cur  = pts[i]
      const next = pts[(i + 1) % pts.length]
      const c1   = toImg(cur.cp2x, cur.cp2y)
      const c2   = toImg(next.cp1x, next.cp1y)
      const np   = toImg(next.x, next.y)
      ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, np.x, np.y)
    }

    ctx.closePath()
    ctx.fillStyle = '#fff'
    ctx.fill()

    const imgData = ctx.getImageData(0, 0, iw, ih)
    const mask = new Uint8ClampedArray(iw * ih)
    for (let i = 0; i < mask.length; i++) {
      // alpha 通道决定是否在选区内
      mask[i] = imgData.data[i * 4 + 3] > 128 ? 255 : 0
    }

    onCommit(mask, iw, ih)
  }, [imageEl, canvasRef, onCommit])

  // ── reset ─────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setAnchors([])
    setClosed(false)
    setPreviewPos(null)
    isDraggingRef.current    = false
    dragAnchorIdxRef.current = -1
  }, [])

  // ── onPointerDown ─────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (closedRef.current) return
    e.preventDefault()
    const { x, y } = getXY(e)
    const pts = anchorsRef.current

    // 检查是否点在第一个锚点附近 → 闭合
    if (pts.length >= 3 && dist(x, y, pts[0].x, pts[0].y) < 10) {
      setClosed(true)
      closedRef.current = true
      commitPath(pts)
      return
    }

    // 新锚点（手柄先等于锚点坐标，拖拽时更新）
    const newAnchor: PenAnchor = {
      x, y,
      cp1x: x, cp1y: y,
      cp2x: x, cp2y: y,
      broken: false,
    }
    const next = [...pts, newAnchor]
    setAnchors(next)
    anchorsRef.current = next

    isDraggingRef.current    = true
    dragAnchorIdxRef.current = next.length - 1
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }, [commitPath])

  // ── onPointerMove ─────────────────────────────────────────────────────────
  const onPointerMove = useCallback((
    e: React.PointerEvent<HTMLCanvasElement>,
    altKey: boolean,
  ) => {
    const { x, y } = getXY(e)
    setPreviewPos({ x, y })

    if (!isDraggingRef.current) return
    const idx = dragAnchorIdxRef.current
    if (idx < 0) return

    const pts = [...anchorsRef.current]
    const anchor = { ...pts[idx] }

    // 出手柄（cp2）跟随鼠标
    anchor.cp2x = x
    anchor.cp2y = y

    // 入手柄（cp1）对称镜像，除非 Alt 断开
    if (!altKey && !anchor.broken) {
      anchor.cp1x = 2 * anchor.x - x
      anchor.cp1y = 2 * anchor.y - y
    } else if (altKey) {
      anchor.broken = true
    }

    pts[idx] = anchor
    setAnchors(pts)
    anchorsRef.current = pts
  }, [])

  // ── onPointerUp ───────────────────────────────────────────────────────────
  const onPointerUp = useCallback((_e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false
  }, [])

  // ── onKeyDown ─────────────────────────────────────────────────────────────
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') reset()
    // Enter / Return → 强制闭合（即使锚点少于 3 个）
    if ((e.key === 'Enter' || e.key === 'Return') && anchorsRef.current.length >= 2) {
      setClosed(true)
      closedRef.current = true
      commitPath(anchorsRef.current)
    }
  }, [reset, commitPath])

  // ── draw（外部 animationFrame 调用） ──────────────────────────────────────
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const pts = anchorsRef.current
    if (pts.length === 0) return
    const cw = ctx.canvas.width
    const ch = ctx.canvas.height
    ctx.save()

    // ── 路径线 ──────────────────────────────────────────────────────────────
    if (pts.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 0; i < pts.length - 1; i++) {
        const cur  = pts[i]
        const next = pts[i + 1]
        ctx.bezierCurveTo(cur.cp2x, cur.cp2y, next.cp1x, next.cp1y, next.x, next.y)
      }
      if (closedRef.current) {
        const last = pts[pts.length - 1]
        const first = pts[0]
        ctx.bezierCurveTo(last.cp2x, last.cp2y, first.cp1x, first.cp1y, first.x, first.y)
        ctx.closePath()
      }
      // 阴影描边（对比用）
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'
      ctx.lineWidth = 2.5
      ctx.setLineDash([])
      ctx.stroke()
      // 主线
      ctx.strokeStyle = '#e8e8e6'
      ctx.lineWidth = 1.2
      ctx.stroke()
    }

    // ── 预览段（最后锚点 → 鼠标） ───────────────────────────────────────────
    if (!closedRef.current && previewPos && pts.length >= 1) {
      const last = pts[pts.length - 1]
      ctx.beginPath()
      ctx.moveTo(last.x, last.y)
      ctx.bezierCurveTo(
        last.cp2x, last.cp2y,
        previewPos.x, previewPos.y,   // 暂无入手柄，直接指向鼠标
        previewPos.x, previewPos.y,
      )
      ctx.strokeStyle = 'rgba(200,200,200,0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // ── 手柄线 + 手柄点 ────────────────────────────────────────────────────
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const hasDrag = a.cp1x !== a.x || a.cp1y !== a.y ||
                      a.cp2x !== a.x || a.cp2y !== a.y

      if (hasDrag) {
        ctx.strokeStyle = 'rgba(150,150,150,0.6)'
        ctx.lineWidth = 0.8
        ctx.setLineDash([])
        // cp1 线
        if (a.cp1x !== a.x || a.cp1y !== a.y) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.cp1x, a.cp1y); ctx.stroke()
          // cp1 菱形
          ctx.save()
          ctx.translate(a.cp1x, a.cp1y)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = '#e8e8e6'
          ctx.strokeStyle = '#555'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.rect(-3, -3, 6, 6)
          ctx.fill(); ctx.stroke()
          ctx.restore()
        }
        // cp2 线
        if (a.cp2x !== a.x || a.cp2y !== a.y) {
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(a.cp2x, a.cp2y); ctx.stroke()
          ctx.save()
          ctx.translate(a.cp2x, a.cp2y)
          ctx.rotate(Math.PI / 4)
          ctx.fillStyle = '#e8e8e6'
          ctx.strokeStyle = '#555'
          ctx.lineWidth = 0.8
          ctx.beginPath()
          ctx.rect(-3, -3, 6, 6)
          ctx.fill(); ctx.stroke()
          ctx.restore()
        }
      }
    }

    // ── 锚点方块 ───────────────────────────────────────────────────────────
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const isFirst = i === 0
      const nearFirst = !closedRef.current && isFirst && pts.length >= 3 &&
        previewPos && dist(previewPos.x, previewPos.y, a.x, a.y) < 10

      ctx.save()
      ctx.translate(a.x, a.y)
      const size = nearFirst ? 8 : 6
      ctx.fillStyle   = nearFirst ? '#aaa' : '#e8e8e6'
      ctx.strokeStyle = nearFirst ? '#fff' : '#666'
      ctx.lineWidth   = nearFirst ? 1.5 : 1
      ctx.beginPath()
      ctx.rect(-size / 2, -size / 2, size, size)
      ctx.fill()
      ctx.stroke()
      ctx.restore()
    }

    ctx.restore()
  }, [previewPos])

  // ── 全局 keydown ──────────────────────────────────────────────────────────
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])

  return {
    anchors,
    closed,
    active: anchors.length > 0,
    previewPos,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onKeyDown,
    reset,
    draw,
  }
}
