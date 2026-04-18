// ─────────────────────────────────────────────────────────────────────────────
// useImageEditor.ts
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/useImageEditor.ts
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { generateId } from './pageHelpers'
import {
  OverlayLayer, ImageLayer, TextLayer,
  measureTextLayer, PRESET_FONTS,
} from './imageEditorTypes'

interface UseImageEditorProps {
  src: string
  isZh: boolean
  onSave: (dataUrl: string) => void
  onClose: () => void
}

export function useImageEditor({ src, isZh, onSave, onClose }: UseImageEditorProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const layerInputRef = React.useRef<HTMLInputElement>(null)
  const fontInputRef = React.useRef<HTMLInputElement>(null)
  const baseImageRef = React.useRef<HTMLImageElement | null>(null)
  const dragStart = React.useRef<{ mx: number; my: number; lx: number; ly: number } | null>(null)
  const cropDrag = React.useRef<{ startX: number; startY: number } | null>(null)

  // ── 用 ref 持有最新的 drawCanvas，解决异步回调里拿到旧闭包的问题 ──────────
  const drawCanvasRef = React.useRef<() => void>(() => {})

  const [customFonts, setCustomFonts] = React.useState<{ label: string; family: string }[]>([])
  const [brightness, setBrightness] = React.useState(100)
  const [contrast, setContrast] = React.useState(100)
  const [saturate, setSaturate] = React.useState(100)
  const [rotation, setRotation] = React.useState(0)
  const [flipH, setFlipH] = React.useState(false)
  const [cropMode, setCropMode] = React.useState(false)
  const [cropRect, setCropRect] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [layers, setLayers] = React.useState<OverlayLayer[]>([])
  const [activeLayerId, setActiveLayerId] = React.useState<string | null>(null)
  const [dragLayerId, setDragLayerId] = React.useState<string | null>(null)
  const [accentColor, setAccentColor] = React.useState('#4aab6f')

  const [hasCutout, setHasCutout] = React.useState(false)

  const allFonts = [...PRESET_FONTS, ...customFonts]

  // ── Layer helpers ────────────────────────────────────────────────────────────

  const updateLayer = (id: string, patch: Partial<OverlayLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } as OverlayLayer : l))
  }

  const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>, layerId: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const familyName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    const style = document.createElement('style')
    style.textContent = `@font-face { font-family: "${familyName}"; src: url("${url}"); }`
    document.head.appendChild(style)
    document.fonts.load(`16px "${familyName}"`).then(() => {
      setCustomFonts(prev => [...prev, { label: familyName, family: familyName }])
      updateLayer(layerId, { fontFamily: familyName, fontLabel: familyName } as Partial<TextLayer>)
    })
    e.target.value = ''
  }

  const addTextLayer = () => {
    const newLayer: TextLayer = {
      kind: 'text', id: generateId(),
      text: isZh ? '双击编辑' : 'Click to edit',
      fontSize: 48, color: '#ffffff',
      fontFamily: 'Inter, sans-serif', fontLabel: 'Inter',
      pos: { x: 60, y: 60 }, visible: true,
      name: `Text ${layers.length + 1}`,
    }
    setLayers(prev => [...prev, newLayer])
    setActiveLayerId(newLayer.id)
  }

  const addImageLayer = (file: File) => {
    const reader = new FileReader()
    reader.onload = ev => {
      const img = new Image()
      img.onload = () => {
        const newLayer: ImageLayer = {
          kind: 'image', id: generateId(),
          src: ev.target?.result as string, el: img,
          pos: { x: 0, y: 0 }, scale: 50,
          visible: true, followColor: false,
          name: file.name,
        }
        setLayers(prev => [...prev, newLayer])
        setActiveLayerId(newLayer.id)
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const deleteLayer = (id: string) => {
    setLayers(prev => prev.filter(l => l.id !== id))
    if (activeLayerId === id) setActiveLayerId(null)
  }

  // ── 主图替换（抠图结果回写）────────────────────────────────────────────────
  const setBaseImage = React.useCallback((img: HTMLImageElement) => {
    baseImageRef.current = img
    setHasCutout(true)
    // setHasCutout 触发 re-render → drawCanvas useEffect 会重跑，不需要手动调
  }, [])

  // ── Canvas draw ──────────────────────────────────────────────────────────────

  const drawCanvas = React.useCallback(() => {
    const canvas = canvasRef.current
    const baseImg = baseImageRef.current
    if (!canvas || !baseImg) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = baseImg.naturalWidth
    canvas.height = baseImg.naturalHeight

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.save()
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`
    ctx.translate(canvas.width / 2, canvas.height / 2)
    if (flipH) ctx.scale(-1, 1)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.drawImage(baseImg, -baseImg.naturalWidth / 2, -baseImg.naturalHeight / 2)
    ctx.restore()

    for (const layer of layers) {
      if (!layer.visible) continue
      if (layer.kind === 'image') {
        const il = layer as ImageLayer
        const w = il.el.naturalWidth * (il.scale / 100)
        const h = il.el.naturalHeight * (il.scale / 100)
        ctx.save()
        ctx.globalAlpha = (il as any).opacity != null ? (il as any).opacity / 100 : 1
        if (il.followColor) {
          ctx.globalCompositeOperation = 'multiply'
          ctx.fillStyle = accentColor
          ctx.fillRect(il.pos.x, il.pos.y, w, h)
        } else {
          ctx.drawImage(il.el, il.pos.x, il.pos.y, w, h)
        }
        ctx.restore()
      } else {
        const tl = layer as TextLayer
        ctx.save()
        ctx.globalAlpha = (tl as any).opacity != null ? (tl as any).opacity / 100 : 1
        ctx.font = `${tl.fontSize}px ${tl.fontFamily}`
        ctx.fillStyle = tl.color
        const lines = tl.text.split('\n')
        const lineH = tl.fontSize * 1.3
        lines.forEach((line, i) => ctx.fillText(line, tl.pos.x, tl.pos.y + tl.fontSize + i * lineH))
        ctx.restore()
      }
    }

    if (cropMode && cropRect) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
      ctx.restore()
    }
  }, [brightness, contrast, saturate, rotation, flipH, layers, accentColor, cropMode, cropRect, hasCutout])

  // ── 每次 drawCanvas 更新时同步到 ref，确保异步回调里始终拿到最新版本 ──────
  React.useEffect(() => {
    drawCanvasRef.current = drawCanvas
  }, [drawCanvas])

  // ── Canvas mouse events ──────────────────────────────────────────────────────

  const getCanvasPosFromEvent = (e: MouseEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY }
  }

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault()
    const pos = getCanvasPosFromEvent(e)
    if (cropMode) {
      cropDrag.current = { startX: pos.x, startY: pos.y }
      setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 })
      return
    }
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i]
      if (!layer.visible) continue
      const { w, h } = layer.kind === 'text'
        ? measureTextLayer(canvasRef.current!.getContext('2d')!, layer as TextLayer)
        : {
            w: (layer as ImageLayer).el.naturalWidth * ((layer as ImageLayer).scale / 100),
            h: (layer as ImageLayer).el.naturalHeight * ((layer as ImageLayer).scale / 100),
          }
      if (pos.x >= layer.pos.x && pos.x <= layer.pos.x + w && pos.y >= layer.pos.y && pos.y <= layer.pos.y + h) {
        setActiveLayerId(layer.id)
        setDragLayerId(layer.id)
        dragStart.current = { mx: pos.x, my: pos.y, lx: layer.pos.x, ly: layer.pos.y }
        return
      }
    }
    setActiveLayerId(null)
  }

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode || !cropDrag.current) return
    const pos = getCanvasPosFromEvent(e)
    const { startX, startY } = cropDrag.current
    setCropRect({
      x: Math.min(pos.x, startX), y: Math.min(pos.y, startY),
      w: Math.abs(pos.x - startX), h: Math.abs(pos.y - startY),
    })
  }

  const handleCanvasMouseUp = () => {
    setDragLayerId(null)
    dragStart.current = null
    cropDrag.current = null
  }

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragStart.current || !dragLayerId) return
      const pos = getCanvasPosFromEvent(e)
      const dx = pos.x - dragStart.current.mx
      const dy = pos.y - dragStart.current.my
      updateLayer(dragLayerId, { pos: { x: dragStart.current.lx + dx, y: dragStart.current.ly + dy } })
    }
    const onUp = () => {
      setDragLayerId(null)
      dragStart.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragLayerId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Crop ─────────────────────────────────────────────────────────────────────

  const applyCrop = () => {
    if (!cropRect || !canvasRef.current) return
    const canvas = canvasRef.current
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = cropRect.w
    tempCanvas.height = cropRect.h
    const ctx = tempCanvas.getContext('2d')!
    ctx.drawImage(canvas, cropRect.x, cropRect.y, cropRect.w, cropRect.h, 0, 0, cropRect.w, cropRect.h)
    const img = new Image()
    img.onload = () => {
      baseImageRef.current = img
      setCropMode(false)
      setCropRect(null)
      // 用 ref 调最新的 drawCanvas，避免闭包陷阱
      drawCanvasRef.current()
    }
    img.src = tempCanvas.toDataURL()
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave(hasCutout
      ? canvas.toDataURL('image/png')
      : canvas.toDataURL('image/jpeg', 0.92)
    )
  }

  // ── Effects ──────────────────────────────────────────────────────────────────

  // 加载主图：用 drawCanvasRef.current() 确保 onload 回调里拿到最新的 drawCanvas
  React.useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      baseImageRef.current = img
      // 通过 ref 调用，永远是最新版本的 drawCanvas
      drawCanvasRef.current()
    }
    img.src = src
  }, [src])

  // state/props 变化时重绘（brightness、layers 等调整）
  React.useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  return {
    // refs
    canvasRef, layerInputRef, fontInputRef,
    // state
    brightness, setBrightness,
    contrast, setContrast,
    saturate, setSaturate,
    rotation, setRotation,
    flipH, setFlipH,
    cropMode, setCropMode,
    cropRect,
    layers, setLayers,
    activeLayerId, setActiveLayerId,
    dragLayerId,
    accentColor, setAccentColor,
    allFonts,
    // handlers
    updateLayer,
    deleteLayer,
    handleFontUpload,
    addTextLayer,
    addImageLayer,
    setBaseImage,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    applyCrop,
    handleSave,
    onClose,
  }
}