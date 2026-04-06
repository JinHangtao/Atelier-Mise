'use client'
import { useRef, useEffect, useState, useCallback } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Tool = 'pen' | 'pencil' | 'eraser' | 'fill'
type BlendMode = 'source-over' | 'multiply' | 'screen' | 'overlay'

interface BrushSettings {
  size: number
  opacity: number
  color: string
  blend: BlendMode
  stabilizer: number   // 0–10, motion-average lag
}

interface HistoryEntry {
  imageData: ImageData
}

interface DrawingStudioProps {
  open: boolean
  onClose: () => void
  /** Called when user clicks "Insert to canvas" */
  onInsert?: (dataUrl: string) => void
  /** Default export canvas size */
  defaultWidth?: number
  defaultHeight?: number
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  '#1a1a1a', '#4a4a4a', '#888888', '#c0c0c0', '#ffffff',
  '#e05c5c', '#e0874a', '#d4b84a', '#4aab6f', '#4a8abf',
  '#7b5ea7', '#c4638a', '#5bb8c4', '#8fba5e', '#c47a3c',
]

const CANVAS_PRESETS = [
  { label: 'A4 横向', w: 2480, h: 1754 },
  { label: 'A4 纵向', w: 1754, h: 2480 },
  { label: '1920×1080', w: 1920, h: 1080 },
  { label: '方形', w: 2000, h: 2000 },
]

// ─── Stabilizer buffer ────────────────────────────────────────────────────────
function useStabilizer(level: number) {
  const buf = useRef<{ x: number; y: number }[]>([])
  const get = useCallback((x: number, y: number) => {
    if (level === 0) return { x, y }
    buf.current.push({ x, y })
    const maxLen = level * 2
    if (buf.current.length > maxLen) buf.current.shift()
    const avg = buf.current.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 })
    return { x: avg.x / buf.current.length, y: avg.y / buf.current.length }
  }, [level])
  const reset = useCallback(() => { buf.current = [] }, [])
  return { get, reset }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function DrawingStudio({
  open,
  onClose,
  onInsert,
  defaultWidth  = 2480,
  defaultHeight = 1754,
}: DrawingStudioProps) {
  // Canvas refs
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const overlayRef  = useRef<HTMLCanvasElement>(null)  // cursor preview
  const wrapRef     = useRef<HTMLDivElement>(null)

  // Drawing state
  const isDrawing   = useRef(false)
  const lastPos     = useRef<{ x: number; y: number } | null>(null)
  const pressure    = useRef(1)

  // History
  const history     = useRef<HistoryEntry[]>([])
  const redoStack   = useRef<HistoryEntry[]>([])
  const MAX_HISTORY = 40

  // Canvas logical size (the actual pixel dimensions of the artwork)
  const [canvasSize, setCanvasSize] = useState({ w: defaultWidth, h: defaultHeight })
  const [showSizePanel, setShowSizePanel] = useState(false)
  const [customW, setCustomW] = useState(String(defaultWidth))
  const [customH, setCustomH] = useState(String(defaultHeight))

  // Viewport transform (screen display)
  const [zoom, setZoom]   = useState(1)
  const [pan,  setPan]    = useState({ x: 0, y: 0 })
  const isPanning         = useRef(false)
  const panStart          = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  // Tool state
  const [tool, setTool]   = useState<Tool>('pen')
  const [brush, setBrush] = useState<BrushSettings>({
    size: 8, opacity: 1, color: '#1a1a1a', blend: 'source-over', stabilizer: 3,
  })
  const [bgColor, setBgColor] = useState<string | null>(null) // null = transparent

  // UI
  const [colorInput, setColorInput]   = useState('#1a1a1a')
  const [historyLen, setHistoryLen]   = useState(0)
  const [redoLen,    setRedoLen]      = useState(0)
  const [showGrid,   setShowGrid]     = useState(false)
  const [exportFmt,  setExportFmt]    = useState<'png' | 'jpeg'>('png')

  const stabilizer = useStabilizer(brush.stabilizer)

  // ── Fit canvas to viewport on open ──────────────────────────────────────────
  const fitToView = useCallback(() => {
    if (!wrapRef.current) return
    const vw = wrapRef.current.clientWidth  - 80
    const vh = wrapRef.current.clientHeight - 80
    const scale = Math.min(vw / canvasSize.w, vh / canvasSize.h, 1)
    setZoom(+scale.toFixed(4))
    setPan({ x: 0, y: 0 })
  }, [canvasSize])

  useEffect(() => { if (open) setTimeout(fitToView, 50) }, [open, fitToView])

  // ── Init canvas ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Only resize (clears canvas) when size actually changes
    canvas.width  = canvasSize.w
    canvas.height = canvasSize.h
    const ctx = canvas.getContext('2d')!
    if (bgColor) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height) }
    history.current  = []
    redoStack.current = []
    setHistoryLen(0)
    setRedoLen(0)
    fitToView()
  }, [canvasSize]) // eslint-disable-line

  // ── Coordinate helpers ───────────────────────────────────────────────────────
  const screenToCanvas = useCallback((e: React.MouseEvent | MouseEvent) => {
    const wrap = wrapRef.current
    if (!wrap) return { x: 0, y: 0 }
    const rect = wrap.getBoundingClientRect()
    // The canvas is centered in wrap, offset by pan
    const cx = wrap.clientWidth  / 2 + pan.x
    const cy = wrap.clientHeight / 2 + pan.y
    const sx = e.clientX - rect.left - cx + (canvasSize.w * zoom) / 2
    const sy = e.clientY - rect.top  - cy + (canvasSize.h * zoom) / 2
    return { x: sx / zoom, y: sy / zoom }
  }, [pan, zoom, canvasSize])

  // ── Save/restore history ─────────────────────────────────────────────────────
  const saveHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height)
    history.current = [...history.current.slice(-(MAX_HISTORY - 1)), { imageData: snap }]
    redoStack.current = []
    setHistoryLen(history.current.length)
    setRedoLen(0)
  }, [])

  const undo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || history.current.length === 0) return
    const ctx   = canvas.getContext('2d')!
    const entry = history.current[history.current.length - 1]
    // Push current state to redo
    redoStack.current = [...redoStack.current, { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }]
    history.current   = history.current.slice(0, -1)
    ctx.putImageData(entry.imageData, 0, 0)
    setHistoryLen(history.current.length)
    setRedoLen(redoStack.current.length)
  }, [])

  const redo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || redoStack.current.length === 0) return
    const ctx   = canvas.getContext('2d')!
    const entry = redoStack.current[redoStack.current.length - 1]
    history.current   = [...history.current, { imageData: ctx.getImageData(0, 0, canvas.width, canvas.height) }]
    redoStack.current = redoStack.current.slice(0, -1)
    ctx.putImageData(entry.imageData, 0, 0)
    setHistoryLen(history.current.length)
    setRedoLen(redoStack.current.length)
  }, [])

  // ── Fill bucket ──────────────────────────────────────────────────────────────
  const floodFill = useCallback((startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx  = canvas.getContext('2d')!
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const px   = data.data
    const W    = canvas.width
    const H    = canvas.height
    const toIdx = (x: number, y: number) => (y * W + x) * 4

    const sx = Math.round(startX), sy = Math.round(startY)
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) return
    const si   = toIdx(sx, sy)
    const tr   = px[si], tg = px[si+1], tb = px[si+2], ta = px[si+3]

    // Parse fill color
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 1
    const tc  = tmp.getContext('2d')!
    tc.fillStyle = fillColor; tc.fillRect(0, 0, 1, 1)
    const [fr, fg, fb, fa_raw] = Array.from(tc.getImageData(0, 0, 1, 1).data)
    const fa = Math.round((brush.opacity) * fa_raw)

    if (tr === fr && tg === fg && tb === fb && ta === fa) return

    const stack = [si]
    const visited = new Uint8Array(px.length / 4)
    while (stack.length) {
      const i = stack.pop()!
      const idx = i / 4 | 0
      if (visited[idx]) continue
      visited[idx] = 1
      if (px[i] !== tr || px[i+1] !== tg || px[i+2] !== tb || px[i+3] !== ta) continue
      px[i] = fr; px[i+1] = fg; px[i+2] = fb; px[i+3] = fa
      const x = idx % W, y = (idx / W) | 0
      if (x > 0)   stack.push(toIdx(x-1, y))
      if (x < W-1) stack.push(toIdx(x+1, y))
      if (y > 0)   stack.push(toIdx(x, y-1))
      if (y < H-1) stack.push(toIdx(x, y+1))
    }
    ctx.putImageData(data, 0, 0)
  }, [brush.opacity])

  // ── Draw stroke ──────────────────────────────────────────────────────────────
  const applyStroke = useCallback((
    ctx: CanvasRenderingContext2D,
    from: { x: number; y: number },
    to:   { x: number; y: number },
    t: Tool,
    b: BrushSettings,
    pres: number,
  ) => {
    ctx.save()
    ctx.globalCompositeOperation = t === 'eraser' ? 'destination-out' : b.blend
    ctx.globalAlpha = t === 'pencil' ? b.opacity * 0.55 : b.opacity

    const size = b.size * (0.5 + pres * 0.5)

    if (t === 'pencil') {
      // Pencil: slightly textured by drawing multiple thin lines with jitter
      const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2)
      for (let i = 0; i <= steps; i++) {
        const t_ = steps === 0 ? 0 : i / steps
        const x = from.x + (to.x - from.x) * t_ + (Math.random() - 0.5) * size * 0.3
        const y = from.y + (to.y - from.y) * t_ + (Math.random() - 0.5) * size * 0.3
        ctx.beginPath()
        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2)
        ctx.fillStyle = t === 'eraser' ? '#000' : b.color
        ctx.fill()
      }
    } else {
      ctx.strokeStyle = t === 'eraser' ? '#000' : b.color
      ctx.lineWidth   = size
      ctx.lineCap     = 'round'
      ctx.lineJoin    = 'round'
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(to.x, to.y)
      ctx.stroke()
    }
    ctx.restore()
  }, [])

  // ── Pointer events ───────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or alt+drag = pan
      isPanning.current = true
      panStart.current  = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y }
      return
    }
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)

    const pos = screenToCanvas(e.nativeEvent)
    pressure.current = e.pressure > 0 ? e.pressure : 1

    if (tool === 'fill') {
      saveHistory()
      floodFill(pos.x, pos.y, brush.color)
      return
    }

    saveHistory()
    isDrawing.current = true
    lastPos.current   = stabilizer.get(pos.x, pos.y)

    // Draw a dot on click
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    applyStroke(ctx, lastPos.current, lastPos.current, tool, brush, pressure.current)
  }, [pan, screenToCanvas, tool, brush, saveHistory, floodFill, stabilizer, applyStroke])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      setPan({
        x: panStart.current.px + e.clientX - panStart.current.mx,
        y: panStart.current.py + e.clientY - panStart.current.my,
      })
      return
    }

    // Update cursor overlay
    const overlay = overlayRef.current
    if (overlay) {
      const octx = overlay.getContext('2d')!
      octx.clearRect(0, 0, overlay.width, overlay.height)
      const pos = screenToCanvas(e.nativeEvent)
      const sz  = brush.size * zoom
      octx.beginPath()
      octx.arc(
        pos.x * zoom + overlay.width  / 2 - canvasSize.w * zoom / 2 + pan.x + (wrapRef.current?.clientWidth  ?? 0) / 2 - (wrapRef.current?.clientWidth  ?? 0) / 2,
        pos.y * zoom + overlay.height / 2 - canvasSize.h * zoom / 2 + pan.y + (wrapRef.current?.clientHeight ?? 0) / 2 - (wrapRef.current?.clientHeight ?? 0) / 2,
        Math.max(sz / 2, 1), 0, Math.PI * 2,
      )
      octx.strokeStyle = tool === 'eraser' ? '#f06' : brush.color
      octx.lineWidth   = 1
      octx.globalAlpha = 0.6
      octx.stroke()
    }

    if (!isDrawing.current || !lastPos.current) return

    pressure.current = e.pressure > 0 ? e.pressure : 1
    const raw = screenToCanvas(e.nativeEvent)
    const pos = stabilizer.get(raw.x, raw.y)

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    applyStroke(ctx, lastPos.current, pos, tool, brush, pressure.current)
    lastPos.current = pos
  }, [screenToCanvas, brush, tool, zoom, pan, canvasSize, stabilizer, applyStroke])

  const onPointerUp = useCallback(() => {
    isDrawing.current  = false
    isPanning.current  = false
    lastPos.current    = null
    stabilizer.reset()
  }, [stabilizer])

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setZoom(z => Math.min(8, Math.max(0.05, +(z * delta).toFixed(4))))
    }
    wrap.addEventListener('wheel', handler, { passive: false })
    return () => wrap.removeEventListener('wheel', handler)
  }, [])

  // ── Keyboard shortcuts ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return }
      if (e.key === 'b' || e.key === 'B') setTool('pen')
      if (e.key === 'p' || e.key === 'P') setTool('pencil')
      if (e.key === 'e' || e.key === 'E') setTool('eraser')
      if (e.key === 'g' || e.key === 'G') setTool('fill')
      if (e.key === 'f' || e.key === 'F') fitToView()
      if (e.key === 'Escape') onClose()
      if (e.key === '[') setBrush(b => ({ ...b, size: Math.max(1, b.size - 2) }))
      if (e.key === ']') setBrush(b => ({ ...b, size: Math.min(200, b.size + 2) }))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, undo, redo, fitToView, onClose])

  // ── Export ───────────────────────────────────────────────────────────────────
  const getExportDataUrl = useCallback((fmt: 'png' | 'jpeg') => {
    const src = canvasRef.current
    if (!src) return null
    if (fmt === 'png' && !bgColor) return src.toDataURL('image/png')
    // Composite with background
    const out = document.createElement('canvas')
    out.width = src.width; out.height = src.height
    const ctx = out.getContext('2d')!
    if (bgColor || fmt === 'jpeg') {
      ctx.fillStyle = bgColor ?? '#ffffff'
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(src, 0, 0)
    return fmt === 'jpeg' ? out.toDataURL('image/jpeg', 0.95) : out.toDataURL('image/png')
  }, [bgColor])

  const doExport = useCallback(() => {
    const url = getExportDataUrl(exportFmt)
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `drawing.${exportFmt}`
    a.click()
  }, [getExportDataUrl, exportFmt])

  const doInsert = useCallback(() => {
    const url = getExportDataUrl('png')
    if (!url || !onInsert) return
    onInsert(url)
    onClose()
  }, [getExportDataUrl, onInsert, onClose])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    saveHistory()
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [saveHistory])

  // ── Overlay size sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const wrap = wrapRef.current
      const ov   = overlayRef.current
      if (!wrap || !ov) return
      ov.width  = wrap.clientWidth
      ov.height = wrap.clientHeight
    }
    const ro = new ResizeObserver(resize)
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  if (!open) return null

  const TOOL_LIST: { id: Tool; label: string; key: string }[] = [
    { id: 'pen',    label: '画笔',  key: 'B' },
    { id: 'pencil', label: '铅笔',  key: 'P' },
    { id: 'eraser', label: '橡皮',  key: 'E' },
    { id: 'fill',   label: '填充',  key: 'G' },
  ]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#1a1a1e',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"DM Sans", "PingFang SC", system-ui, sans-serif',
    }}>
      {/* ── Top bar ── */}
      <div style={{
        height: 44, flexShrink: 0,
        background: '#111114',
        borderBottom: '1px solid #2a2a2e',
        display: 'flex', alignItems: 'center',
        padding: '0 12px', gap: 8,
      }}>
        {/* Title */}
        <span style={{ color: '#888', fontSize: 13, letterSpacing: '0.05em', marginRight: 8 }}>
          DRAWING STUDIO
        </span>
        <span style={{ color: '#3a3a3e', fontSize: 13 }}>|</span>
        <span style={{ color: '#555', fontSize: 12 }}>{canvasSize.w} × {canvasSize.h}px</span>

        <div style={{ flex: 1 }} />

        {/* Zoom */}
        <span style={{ color: '#666', fontSize: 12 }}>{Math.round(zoom * 100)}%</span>
        <button onClick={fitToView} style={topBtnStyle}>适合窗口 F</button>
        <button onClick={() => setShowGrid(v => !v)} style={{ ...topBtnStyle, color: showGrid ? '#7b9ef0' : '#888' }}>网格</button>

        {/* Size preset */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowSizePanel(v => !v)} style={topBtnStyle}>画布尺寸</button>
          {showSizePanel && (
            <div style={{
              position: 'absolute', top: 34, right: 0,
              background: '#1e1e22', border: '1px solid #333',
              borderRadius: 8, padding: 12, zIndex: 100,
              minWidth: 200,
            }}>
              {CANVAS_PRESETS.map(p => (
                <button key={p.label} onClick={() => {
                  setCanvasSize({ w: p.w, h: p.h })
                  setCustomW(String(p.w)); setCustomH(String(p.h))
                  setShowSizePanel(false)
                }} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', color: '#ccc',
                  fontSize: 13, padding: '6px 8px', cursor: 'pointer',
                  borderRadius: 4,
                }}>
                  {p.label} — {p.w}×{p.h}
                </button>
              ))}
              <div style={{ borderTop: '1px solid #333', marginTop: 8, paddingTop: 8, display: 'flex', gap: 6 }}>
                <input value={customW} onChange={e => setCustomW(e.target.value)}
                  style={{ width: 70, background: '#111', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 12, padding: '4px 6px' }}
                  placeholder="宽" />
                <span style={{ color: '#555', lineHeight: '28px' }}>×</span>
                <input value={customH} onChange={e => setCustomH(e.target.value)}
                  style={{ width: 70, background: '#111', border: '1px solid #333', borderRadius: 4, color: '#ccc', fontSize: 12, padding: '4px 6px' }}
                  placeholder="高" />
                <button onClick={() => {
                  const w = parseInt(customW), h = parseInt(customH)
                  if (w > 0 && h > 0) { setCanvasSize({ w, h }); setShowSizePanel(false) }
                }} style={{ ...topBtnStyle, background: '#3a5aff22', color: '#7b9ef0' }}>应用</button>
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: '#2a2a2e' }} />

        {/* Export */}
        <select value={exportFmt} onChange={e => setExportFmt(e.target.value as 'png' | 'jpeg')}
          style={{ background: '#1e1e22', border: '1px solid #333', borderRadius: 4, color: '#999', fontSize: 12, padding: '3px 6px' }}>
          <option value="png">PNG</option>
          <option value="jpeg">JPEG</option>
        </select>
        <button onClick={doExport} style={topBtnStyle}>导出</button>
        {onInsert && (
          <button onClick={doInsert} style={{
            ...topBtnStyle,
            background: '#3a5aff33', color: '#7b9ef0',
            border: '1px solid #3a5aff66',
          }}>插入工作台</button>
        )}
        <button onClick={onClose} style={{ ...topBtnStyle, color: '#888' }}>✕ 关闭</button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left toolbar ── */}
        <div style={{
          width: 52, flexShrink: 0,
          background: '#111114',
          borderRight: '1px solid #2a2a2e',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 4, padding: '12px 0',
        }}>
          {TOOL_LIST.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={`${t.label} (${t.key})`}
              style={{
                width: 40, height: 40, borderRadius: 8,
                border: tool === t.id ? '1px solid #3a5aff' : '1px solid transparent',
                background: tool === t.id ? '#3a5aff22' : 'transparent',
                color: tool === t.id ? '#7b9ef0' : '#666',
                fontSize: 10, cursor: 'pointer', display: 'flex',
                flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              }}>
              <ToolIcon id={t.id} active={tool === t.id} />
              <span style={{ fontSize: 9, letterSpacing: '0.03em' }}>{t.label}</span>
            </button>
          ))}

          <div style={{ width: 28, height: 1, background: '#2a2a2e', margin: '4px 0' }} />

          {/* Undo/Redo */}
          <button onClick={undo} disabled={historyLen === 0} title="撤销 ⌘Z"
            style={{ ...iconBtnStyle, opacity: historyLen === 0 ? 0.3 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8a5 5 0 1 0 1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 4v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={redo} disabled={redoLen === 0} title="重做 ⌘Y"
            style={{ ...iconBtnStyle, opacity: redoLen === 0 ? 0.3 : 1 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 8a5 5 0 1 1-1-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13 4v4H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button onClick={clearCanvas} title="清空画布" style={iconBtnStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* ── Canvas viewport ── */}
        <div
          ref={wrapRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            cursor: tool === 'fill' ? 'crosshair' : 'none',
            // Checker background = transparent
            backgroundImage: `
              linear-gradient(45deg, #2a2a2e 25%, transparent 25%),
              linear-gradient(-45deg, #2a2a2e 25%, transparent 25%),
              linear-gradient(45deg, transparent 75%, #2a2a2e 75%),
              linear-gradient(-45deg, transparent 75%, #2a2a2e 75%)
            `,
            backgroundSize: '12px 12px',
            backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
            backgroundColor: '#222226',
          }}
        >
          {/* The actual canvas, centered + transformed */}
          <div style={{
            position: 'absolute',
            left: '50%', top: '50%',
            transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            transformOrigin: 'center center',
          }}>
            {/* Shadow behind canvas */}
            <div style={{
              width: canvasSize.w * zoom,
              height: canvasSize.h * zoom,
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              borderRadius: 1,
              position: 'relative',
            }}>
              <canvas
                ref={canvasRef}
                style={{
                  width:  canvasSize.w * zoom,
                  height: canvasSize.h * zoom,
                  display: 'block',
                  imageRendering: zoom > 2 ? 'pixelated' : 'auto',
                }}
              />
              {/* Grid overlay */}
              {showGrid && (
                <svg style={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  pointerEvents: 'none', opacity: 0.15,
                }}>
                  <defs>
                    <pattern id="grid" width={50 * zoom} height={50 * zoom} patternUnits="userSpaceOnUse">
                      <path d={`M ${50 * zoom} 0 L 0 0 0 ${50 * zoom}`} fill="none" stroke="#fff" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              )}
            </div>
          </div>

          {/* Cursor overlay (full-viewport, pointer-events:none) */}
          <canvas
            ref={overlayRef}
            style={{
              position: 'absolute', inset: 0,
              pointerEvents: 'none',
              width: '100%', height: '100%',
            }}
          />
        </div>

        {/* ── Right panel ── */}
        <div style={{
          width: 200, flexShrink: 0,
          background: '#111114',
          borderLeft: '1px solid #2a2a2e',
          padding: '12px 10px',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          {/* Color */}
          <Section label="颜色">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 6,
                background: brush.color,
                border: '1px solid #333', flexShrink: 0,
                position: 'relative', overflow: 'hidden', cursor: 'pointer',
              }}>
                <input type="color" value={brush.color}
                  onChange={e => { setBrush(b => ({ ...b, color: e.target.value })); setColorInput(e.target.value) }}
                  style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                />
              </div>
              <input value={colorInput}
                onChange={e => {
                  setColorInput(e.target.value)
                  if (/^#[0-9a-f]{6}$/i.test(e.target.value)) setBrush(b => ({ ...b, color: e.target.value }))
                }}
                style={{
                  flex: 1, background: '#1e1e22', border: '1px solid #333',
                  borderRadius: 4, color: '#ccc', fontSize: 12, padding: '4px 6px',
                  fontFamily: 'monospace',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => { setBrush(b => ({ ...b, color: c })); setColorInput(c) }}
                  style={{
                    width: 20, height: 20, borderRadius: 4, background: c,
                    border: brush.color === c ? '2px solid #7b9ef0' : '1px solid #333',
                    cursor: 'pointer', padding: 0,
                  }} />
              ))}
            </div>
          </Section>

          {/* Brush */}
          <Section label="笔刷">
            <SliderRow label="大小" value={brush.size} min={1} max={200}
              onChange={v => setBrush(b => ({ ...b, size: v }))} unit="px" />
            <SliderRow label="透明度" value={Math.round(brush.opacity * 100)} min={1} max={100}
              onChange={v => setBrush(b => ({ ...b, opacity: v / 100 }))} unit="%" />
            <SliderRow label="稳定器" value={brush.stabilizer} min={0} max={10}
              onChange={v => setBrush(b => ({ ...b, stabilizer: v }))} unit="" />
          </Section>

          {/* Blend mode */}
          <Section label="混合模式">
            <select value={brush.blend}
              onChange={e => setBrush(b => ({ ...b, blend: e.target.value as BlendMode }))}
              style={{
                width: '100%', background: '#1e1e22', border: '1px solid #333',
                borderRadius: 4, color: '#ccc', fontSize: 12, padding: '5px 6px',
              }}>
              <option value="source-over">正常</option>
              <option value="multiply">正片叠底</option>
              <option value="screen">滤色</option>
              <option value="overlay">叠加</option>
            </select>
          </Section>

          {/* Background */}
          <Section label="画布背景">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button onClick={() => setBgColor(null)} style={{
                ...bgBtnStyle, border: bgColor === null ? '1px solid #3a5aff' : '1px solid #333',
                color: bgColor === null ? '#7b9ef0' : '#888',
              }}>
                <span style={{
                  display: 'inline-block', width: 12, height: 12, borderRadius: 2, marginRight: 6,
                  backgroundImage: 'linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%),linear-gradient(45deg,#555 25%,transparent 25%,transparent 75%,#555 75%)',
                  backgroundSize: '6px 6px', backgroundPosition: '0 0,3px 3px', verticalAlign: 'middle',
                }} />
                透明
              </button>
              <button onClick={() => setBgColor('#ffffff')} style={{
                ...bgBtnStyle, border: bgColor === '#ffffff' ? '1px solid #3a5aff' : '1px solid #333',
                color: bgColor === '#ffffff' ? '#7b9ef0' : '#888',
              }}>
                <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, background: '#fff', border: '1px solid #555', marginRight: 6, verticalAlign: 'middle' }} />
                白色
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 4,
                  background: bgColor && bgColor !== '#ffffff' ? bgColor : '#2a2a2e',
                  border: '1px solid #333', position: 'relative', overflow: 'hidden', cursor: 'pointer',
                }}>
                  <input type="color"
                    onChange={e => setBgColor(e.target.value)}
                    style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                  />
                </div>
                <span style={{ color: '#666', fontSize: 12 }}>自定义</span>
              </div>
            </div>
          </Section>

          {/* History info */}
          <div style={{ color: '#444', fontSize: 11, textAlign: 'center' }}>
            {historyLen} 步可撤销 · {redoLen} 步可重做
          </div>

          {/* Shortcuts */}
          <Section label="快捷键">
            {[
              ['B', '画笔'], ['P', '铅笔'], ['E', '橡皮'], ['G', '填充'],
              ['[  ]', '调整笔刷'], ['F', '适合窗口'],
              ['⌘Z', '撤销'], ['⌘Y', '重做'],
              ['Alt+拖拽', '平移'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ color: '#555', fontSize: 11, fontFamily: 'monospace' }}>{k}</span>
                <span style={{ color: '#555', fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </Section>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: '#444', fontSize: 10, letterSpacing: '0.08em', marginBottom: 8, textTransform: 'uppercase' }}>{label}</div>
      {children}
    </div>
  )
}

function SliderRow({ label, value, min, max, onChange, unit }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
      <span style={{ color: '#666', fontSize: 11, width: 44, flexShrink: 0 }}>{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#3a5aff' }} />
      <span style={{ color: '#555', fontSize: 11, width: 32, textAlign: 'right', fontFamily: 'monospace' }}>
        {value}{unit}
      </span>
    </div>
  )
}

function ToolIcon({ id, active }: { id: Tool; active: boolean }) {
  const c = active ? '#7b9ef0' : '#555'
  if (id === 'pen') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M13 2l3 3-9 9H4v-3L13 2z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
  if (id === 'pencil') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 14l2-2 7-7 2 2-7 7-4 1 0-1z" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M12 5l1-1 2 2-1 1" stroke={c} strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
  if (id === 'eraser') return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="4" y="7" width="10" height="7" rx="1.5" stroke={c} strokeWidth="1.3"/>
      <path d="M7 14v2M11 14v2" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M4 10h10" stroke={c} strokeWidth="1.3"/>
    </svg>
  )
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 3v1M9 14v1M3 9h1M14 9h1" stroke={c} strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="4" stroke={c} strokeWidth="1.3"/>
    </svg>
  )
}

// ─── Style constants ──────────────────────────────────────────────────────────
const topBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #2a2a2e',
  borderRadius: 5, color: '#888', fontSize: 12,
  padding: '4px 10px', cursor: 'pointer',
}

const iconBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 6,
  border: '1px solid transparent',
  background: 'transparent', color: '#666',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
}

const bgBtnStyle: React.CSSProperties = {
  width: '100%', textAlign: 'left',
  background: 'none', borderRadius: 4,
  fontSize: 12, padding: '5px 6px', cursor: 'pointer',
}
