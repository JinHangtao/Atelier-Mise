// ─────────────────────────────────────────────────────────────────────────────
// imageEditorTypes.ts
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/imageEditorTypes.ts
// ─────────────────────────────────────────────────────────────────────────────

export type ImageLayer = {
  kind: 'image'
  id: string
  src: string
  el: HTMLImageElement
  pos: { x: number; y: number }
  scale: number
  visible: boolean
  followColor: boolean
  name: string
}

export type TextLayer = {
  kind: 'text'
  id: string
  text: string
  fontSize: number
  color: string
  fontFamily: string
  fontLabel: string
  pos: { x: number; y: number }
  visible: boolean
  name: string
}

export type OverlayLayer = ImageLayer | TextLayer

export const PRESET_FONTS: { label: string; family: string }[] = [
  { label: 'Space Mono',  family: 'Space Mono, monospace' },
  { label: 'Inter',       family: 'Inter, sans-serif' },
  { label: 'DM Serif',    family: '"DM Serif Display", serif' },
  { label: 'Playfair',    family: '"Playfair Display", serif' },
  { label: 'Bebas Neue',  family: '"Bebas Neue", sans-serif' },
  { label: 'Courier New', family: '"Courier New", monospace' },
]

export function measureTextLayer(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
): { w: number; h: number } {
  ctx.font = `${layer.fontSize}px ${layer.fontFamily}`
  const lines = layer.text.split('\n')
  const lineH = layer.fontSize * 1.3
  const w = Math.max(...lines.map(l => ctx.measureText(l).width), 20)
  return { w: w + 12, h: lines.length * lineH + 10 }
}
