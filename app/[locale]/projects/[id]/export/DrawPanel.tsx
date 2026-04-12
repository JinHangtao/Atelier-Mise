'use client'
import React, { useRef, useState, useEffect, useCallback } from 'react'
import { getDrawLayerManager } from './DrawLayerManager'

// ── Perfect-freehand outline engine (full port, MIT) ─────────────────────────
// Source: github.com/steveruizok/perfect-freehand
type PFVec2 = [number, number]
const pfAdd  = (a: PFVec2, b: PFVec2): PFVec2 => [a[0]+b[0], a[1]+b[1]]
const pfSub  = (a: PFVec2, b: PFVec2): PFVec2 => [a[0]-b[0], a[1]-b[1]]
const pfMul  = (a: PFVec2, n: number): PFVec2  => [a[0]*n, a[1]*n]
const pfLen  = (a: PFVec2): number => Math.hypot(a[0], a[1])
const pfUni  = (a: PFVec2): PFVec2 => { const l=pfLen(a)||1; return [a[0]/l,a[1]/l] }
const pfPer  = (a: PFVec2): PFVec2 => [a[1],-a[0]]
const pfLerp = (a: PFVec2, b: PFVec2, t: number): PFVec2 => [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]
const pfDist = (a: PFVec2, b: PFVec2): number => Math.hypot(a[0]-b[0],a[1]-b[1])
const pfDot  = (a: PFVec2, b: PFVec2): number => a[0]*b[0]+a[1]*b[1]
const pfMed  = (a: PFVec2, b: PFVec2): PFVec2 => [(a[0]+b[0])/2,(a[1]+b[1])/2]

function pfSvgPath(pts: PFVec2[]): string {
  if (pts.length < 4) return ''
  const d: string[] = []
  const start = pfMed(pts[0], pts[1])
  d.push(`M ${start[0].toFixed(2)} ${start[1].toFixed(2)}`)
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i+1]
    const mid = pfMed(a, b)
    d.push(`Q ${a[0].toFixed(2)} ${a[1].toFixed(2)} ${mid[0].toFixed(2)} ${mid[1].toFixed(2)}`)
  }
  d.push('Z')
  return d.join(' ')
}

// ── PERFECT-FREEHAND FULL ENGINE ──────────────────────────────────────────────
// Full port of steveruizok/perfect-freehand (MIT).
// Uses fill(Path2D) instead of stroke() — this is the key to SAI-level quality:
// filled anti-aliased polygons have zero seam artifacts at any zoom level.
// ─────────────────────────────────────────────────────────────────────────────

interface PFOptions {
  size: number
  thinning: number        // 0 = uniform, 1 = full pressure sensitivity
  smoothing: number       // 0–1: soften polygon edges (not same as streamline)
  streamline: number      // 0–1: input point smoothing (lag tradeoff)
  easing: (t: number) => number
  simulatePressure: boolean
  last: boolean           // true = stroke is complete (enables tapers)
  start: { taper: number; easing: (t: number) => number; cap: boolean }
  end:   { taper: number; easing: (t: number) => number; cap: boolean }
}

const PF_DEFAULTS: PFOptions = {
  size: 8,
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  easing: t => t,
  simulatePressure: true,
  last: false,
  start: { taper: 0, easing: t => t * t * t, cap: true },
  end:   { taper: 0, easing: t => t * t * t, cap: true },
}

interface PFStrokePoint {
  point: PFVec2
  pressure: number
  vector: PFVec2
  distance: number
  runningLength: number
}

function pfGetStrokePoints(
  rawPts: { x: number; y: number; pressure: number }[],
  opts: Partial<PFOptions> = {},
): PFStrokePoint[] {
  const { streamline, size, simulatePressure, last } = { ...PF_DEFAULTS, ...opts }
  if (rawPts.length === 0) return []

  const pts: { x: number; y: number; pressure: number }[] = [rawPts[0]]
  for (let i = 1; i < rawPts.length; i++) {
    const prev = pts[i - 1], curr = rawPts[i]
    pts.push({
      x: prev.x + (curr.x - prev.x) * (1 - streamline),
      y: prev.y + (curr.y - prev.y) * (1 - streamline),
      pressure: curr.pressure,
    })
  }

  // Deduplicate adjacent identical points
  const deduped: typeof pts = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pfDist([pts[i].x, pts[i].y], [pts[i-1].x, pts[i-1].y]) >= 0.5) deduped.push(pts[i])
  }
  if (deduped.length === 1) deduped.push({ ...deduped[0] })

  let totalLength = 0
  const result: PFStrokePoint[] = []

  for (let i = 0; i < deduped.length; i++) {
    const p = deduped[i], prev = deduped[Math.max(0, i - 1)]
    const vec = i === 0
      ? [1, 0] as PFVec2
      : pfUni(pfSub([p.x, p.y], [prev.x, prev.y]))

    // Pressure: real if available, else simulate via velocity
    let pressure = p.pressure
    if (simulatePressure) {
      const dist = pfDist([p.x, p.y], [prev.x, prev.y])
      // velocity-based: fast strokes → thin, slow → thick
      const sp = Math.min(1, dist / size)
      const next = Math.min(1, 1 + (0.5 - sp) * 0.3)
      pressure = i === 0 ? 0.5 : Math.min(1, Math.max(0, (result[i-1]?.pressure ?? 0.5) * 0.6 + next * 0.4))
    }

    const dist = i === 0 ? 0 : pfDist([p.x, p.y], [prev.x, prev.y])
    totalLength += dist

    result.push({
      point: [p.x, p.y],
      pressure,
      vector: vec,
      distance: dist,
      runningLength: totalLength,
    })
  }

  // If completing, ensure final point is exactly at last input
  if (last && result.length > 1) {
    const lastRaw = deduped[deduped.length - 1]
    const sp = result[result.length - 1]
    sp.point = [lastRaw.x, lastRaw.y]
  }

  return result
}

function pfGetStrokeOutlinePoints(
  strokePts: PFStrokePoint[],
  opts: Partial<PFOptions> = {},
): PFVec2[] {
  const {
    size, thinning, smoothing, easing,
    start, end, last,
  } = { ...PF_DEFAULTS, ...opts }

  if (strokePts.length === 0) return []

  const totalLen = strokePts[strokePts.length - 1].runningLength
  const taperStart = start.taper === 0 ? 0 : Math.max(size, start.taper)
  const taperEnd   = end.taper   === 0 ? 0 : Math.max(size, end.taper)

  const minSize = Math.min(size * (1 - thinning), 1)

  const left: PFVec2[] = []
  const right: PFVec2[] = []

  let prevLeft:  PFVec2 = strokePts[0].point
  let prevRight: PFVec2 = strokePts[0].point
  let prevPressure = strokePts[0].pressure
  let prevVec: PFVec2 = strokePts[0].vector

  for (let i = 0; i < strokePts.length; i++) {
    const { point, pressure, vector, runningLength } = strokePts[i]

    // Taper easing at start/end
    let ts = 1, te = 1
    if (taperStart > 0) ts = start.easing(Math.min(1, runningLength / taperStart))
    if (taperEnd   > 0 && last) te = end.easing(Math.min(1, (totalLen - runningLength) / taperEnd))
    const taper = Math.min(ts, te)

    // Radius at this point
    const r = Math.max(
      minSize,
      (size / 2) * (1 - thinning + thinning * easing(pressure)) * taper,
    )

    // Normal to the stroke direction (perpendicular)
    const perp = pfPer(vector)

    // Smooth normal with previous
    const smoothedPerp: PFVec2 = i === 0
      ? perp
      : pfUni(pfAdd(pfMul(pfPer(prevVec), 1 - smoothing), pfMul(perp, smoothing)))

    const lpt = pfAdd(point, pfMul(smoothedPerp,  r))
    const rpt = pfAdd(point, pfMul(smoothedPerp, -r))

    left.push(lpt)
    right.push(rpt)

    prevLeft = lpt; prevRight = rpt
    prevPressure = pressure; prevVec = vector
  }

  // Start cap
  const startCapPts: PFVec2[] = []
  if (start.cap && taperStart === 0) {
    const p0 = strokePts[0].point
    const v0 = pfMul(strokePts[0].vector, -1)
    const r0 = Math.max(minSize, (size / 2) * (1 - thinning + thinning * easing(strokePts[0].pressure)))
    for (let i = 1; i < 8; i++) {
      const t = i / 8
      const angle = t * Math.PI
      startCapPts.push(pfAdd(p0, [
        Math.cos(angle) * v0[0] * r0 - Math.sin(angle) * v0[1] * r0,
        Math.cos(angle) * v0[1] * r0 + Math.sin(angle) * v0[0] * r0,
      ]))
    }
  }

  // End cap
  const endCapPts: PFVec2[] = []
  if (end.cap && taperEnd === 0 && last) {
    const pn = strokePts[strokePts.length - 1].point
    const vn = strokePts[strokePts.length - 1].vector
    const rn = Math.max(minSize, (size / 2) * (1 - thinning + thinning * easing(strokePts[strokePts.length - 1].pressure)))
    for (let i = 1; i < 8; i++) {
      const t = i / 8
      const angle = -t * Math.PI
      endCapPts.push(pfAdd(pn, [
        Math.cos(angle) * vn[0] * rn - Math.sin(angle) * vn[1] * rn,
        Math.cos(angle) * vn[1] * rn + Math.sin(angle) * vn[0] * rn,
      ]))
    }
  }

  return [...left, ...endCapPts, ...[...right].reverse(), ...startCapPts]
}

/**
 * Full perfect-freehand getStroke — returns outline polygon points.
 */
export function pfGetStroke(
  rawPts: { x: number; y: number; pressure: number }[],
  opts: Partial<PFOptions> = {},
): PFVec2[] {
  return pfGetStrokeOutlinePoints(pfGetStrokePoints(rawPts, opts), opts)
}

/**
 * Convert outline polygon → SVG path string (quadratic bezier midpoints).
 * Identical to the reference getSvgPathFromStroke.
 */
export function pfGetStrokePath(
  rawPts: { x: number; y: number; pressure: number }[],
  size: number,
  thinning: number,
  streamline: number,
): string {
  const outline = pfGetStroke(rawPts, { size, thinning, streamline, smoothing: 0.5 })
  return pfSvgPath(outline)
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type BrushType =
  | 'pen'
  | 'marker'
  | 'pencil'
  | 'ink'
  | 'chalk'
  | 'wetbrush'
  | 'watercolor'   // SAI-style color-mixing watercolor
  | 'blur'         // true local gaussian blur
  | 'softblur'     // soft gaussian blur variant
  | 'smear'        // pixel-drag smear
  | 'blend'        // SAI blender: finger-smudge, mixes adjacent colors without adding new color
  | 'oilpaint'     // thick oil paint with canvas color pickup
  | 'airbrush'     // pressure-sensitive spray
  | 'eraser'

export type ShapeType =
  | 'rect' | 'ellipse' | 'line' | 'arrow'
  | 'triangle' | 'polygon' | 'star'

export interface ShapeConfig {
  type: ShapeType
  label: string
  labelZh: string
  icon: string
  sides?: number
}

export const SHAPES: ShapeConfig[] = [
  { type: 'rect',     label: 'Rect',     labelZh: '矩形',   icon: '▭' },
  { type: 'ellipse',  label: 'Ellipse',  labelZh: '椭圆',   icon: '◯' },
  { type: 'line',     label: 'Line',     labelZh: '直线',   icon: '╱' },
  { type: 'arrow',    label: 'Arrow',    labelZh: '箭头',   icon: '→' },
  { type: 'triangle', label: 'Triangle', labelZh: '三角',   icon: '△' },
  { type: 'polygon',  label: 'Polygon',  labelZh: '多边形', icon: '⬡', sides: 6 },
  { type: 'star',     label: 'Star',     labelZh: '星形',   icon: '☆', sides: 5 },
]

export const SHAPE_GROUPS: { label: string; labelZh: string; shapes: ShapeConfig[] }[] = [
  { label: 'Basic', labelZh: '基础', shapes: SHAPES.filter(s => ['rect','ellipse','line','arrow'].includes(s.type)) },
  { label: 'Geo',   labelZh: '几何', shapes: SHAPES.filter(s => ['triangle','polygon','star'].includes(s.type)) },
]

// ─── RenderMode ───────────────────────────────────────────────────────────────
// Declares which rendering pipeline handles this brush.
export type RenderMode =
  | 'stamp'       // stamp-based (ink, chalk, wetbrush, oilpaint, airbrush, watercolor, pen)
  | 'line'        // fast canvas lineTo path (pen-hard, marker)
  | 'pixel_blur'  // pixel-level local blur
  | 'pixel_smear' // pixel-level smear/drag
  | 'pixel_blend' // SAI blender: neighbor-color averaging, no new color injected
  | 'erase'       // destination-out composite

export interface BrushConfig {
  type: BrushType
  label: string
  labelZh: string
  icon: string
  renderMode: RenderMode
  composite: GlobalCompositeOperation
  defaultSize: number
  defaultAlpha: number
  defaultHardness: number
  defaultMixRate: number      // 0–100 (watercolor/oil canvas pickup rate)
  pressureSim: boolean
  scatter: boolean
  smoothing: number
  wetMix?: boolean            // watercolor/oilpaint: sample + blend canvas pixels
  airSpray?: boolean          // airbrush spray dot mode
  defaultDilution?: number     // SAI dilution 默认值 0–100
  defaultPersistence?: number  // SAI persistence 默认值 0–100
}

export const BRUSHES: BrushConfig[] = [
  {
    type: 'pen', label: 'Pen', labelZh: '钢笔', icon: '✒',
    renderMode: 'line', composite: 'source-over',
    defaultSize: 2, defaultAlpha: 1, defaultHardness: 100, defaultMixRate: 0,
    pressureSim: true, scatter: false, smoothing: 0.85,
  },
  {
    type: 'marker', label: 'Marker', labelZh: '马克笔', icon: '▌',
    renderMode: 'line', composite: 'source-over',
    defaultSize: 16, defaultAlpha: 0.55, defaultHardness: 90, defaultMixRate: 0,
    pressureSim: false, scatter: false, smoothing: 0.2,
  },
  {
    type: 'pencil', label: 'Pencil', labelZh: '铅笔', icon: '/',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 3, defaultAlpha: 0.7, defaultHardness: 70, defaultMixRate: 0,
    pressureSim: true, scatter: true, smoothing: 0.1,
  },
  {
    type: 'ink', label: 'Ink', labelZh: '墨水笔', icon: '◉',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 6, defaultAlpha: 0.9, defaultHardness: 85, defaultMixRate: 0,
    pressureSim: true, scatter: false, smoothing: 0.5,
  },
  {
    type: 'chalk', label: 'Chalk', labelZh: '粉笔', icon: '▓',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 10, defaultAlpha: 0.8, defaultHardness: 40, defaultMixRate: 0,
    pressureSim: false, scatter: true, smoothing: 0.15,
  },
  // wetbrush: SAI marker-style，blending高但无稀释，拖尾中等
  {
    type: 'wetbrush', label: 'Wet Brush', labelZh: '湿笔晕染', icon: '◌',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 20, defaultAlpha: 0.5, defaultHardness: 0, defaultMixRate: 30,
    defaultDilution: 0, defaultPersistence: 50,
    pressureSim: true, scatter: false, smoothing: 0.35,
    wetMix: true,
  },
  // ── NEW ───────────────────────────────────────────────────────────────────
  // SAI watercolor: blending=50, dilution=17, persistence=34 — 社区经典可用设置
  {
    type: 'watercolor', label: 'Watercolor', labelZh: '水彩', icon: '💧',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 24, defaultAlpha: 0.6, defaultHardness: 15, defaultMixRate: 50,
    defaultDilution: 17, defaultPersistence: 34,
    pressureSim: true, scatter: false, smoothing: 0.45,
    wetMix: true,
  },
  // SAI oilpaint: blending=40-60, persistence=100, dilution低 — 颜色厚重持久
  {
    type: 'oilpaint', label: 'Oil Paint', labelZh: '油画', icon: '🖌',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 18, defaultAlpha: 0.88, defaultHardness: 60, defaultMixRate: 45,
    defaultDilution: 5, defaultPersistence: 80,
    pressureSim: true, scatter: false, smoothing: 0.3,
    wetMix: true,
  },
  {
    type: 'airbrush', label: 'Airbrush', labelZh: '喷枪', icon: '✦',
    renderMode: 'stamp', composite: 'source-over',
    defaultSize: 30, defaultAlpha: 0.25, defaultHardness: 0, defaultMixRate: 0,
    pressureSim: true, scatter: true, smoothing: 0.5,
    airSpray: true,
  },
  {
    type: 'blur', label: 'Blur', labelZh: 'SAI模糊', icon: '◎',
    renderMode: 'pixel_blur', composite: 'source-over',
    defaultSize: 28, defaultAlpha: 0.7, defaultHardness: 0, defaultMixRate: 0,
    pressureSim: false, scatter: false, smoothing: 0.3,
  },
  {
    type: 'smear', label: 'Smear', labelZh: '涂抹', icon: '≋',
    renderMode: 'pixel_smear', composite: 'source-over',
    defaultSize: 22, defaultAlpha: 0.6, defaultHardness: 0, defaultMixRate: 0,
    pressureSim: false, scatter: false, smoothing: 0.3,
  },
  {
    // SAI blender: 手指涂抹，只重新分配已有颜色，不注入前景色
    // 算法：对笔刷圆内每像素，采样以该像素为中心的小邻域平均色，按 strength 插值写回
    type: 'blend', label: 'Blend', labelZh: '手指涂抹', icon: '☁',
    renderMode: 'pixel_blend', composite: 'source-over',
    defaultSize: 26, defaultAlpha: 0.7, defaultHardness: 0, defaultMixRate: 0,
    pressureSim: false, scatter: false, smoothing: 0.35,
  },
  {
    type: 'eraser', label: 'Eraser', labelZh: '橡皮', icon: '□',
    renderMode: 'erase', composite: 'destination-out',
    defaultSize: 18, defaultAlpha: 1, defaultHardness: 100, defaultMixRate: 0,
    pressureSim: false, scatter: false, smoothing: 0.3,
  },
]

// ── PRO PEN RENDERER ─────────────────────────────────────────────────────────
// Uses perfect-freehand fill-polygon approach: ctx.fill(Path2D).
//
// WHY THIS IS BETTER THAN stroke():
//  • Filled anti-aliased polygons have zero seam/joint artifacts at any zoom
//  • stroke() with changing lineWidth creates visible joints between segments
//  • This is exactly how SAI / Procreate / Clip Studio render ink lines
//
// SAI-tuned defaults:
//  streamline 0.38 — like SAI "Stabilizer 2", responsive but smooth
//  thinning   0.45 — subtle pressure response, not dramatic (no pen tablet = simulate)
//  smoothing  0.5  — smooth outline polygon edges (reduces jaggies on curves)
//  tapers     20px — natural entry/exit taper like brush on paper
//
/**
 * Build the SVG path string for a pen stroke — used for live SVG overlay rendering.
 * Returns empty string if not enough points.
 */
export function buildPenSvgPath(
  rawPts: { x: number; y: number; pressure: number }[],
  size: number,
  streamline: number = 0.38,
  thinning: number  = 0.45,
  isComplete: boolean = false,
): string {
  if (rawPts.length < 2) return ''
  const hasPenPressure = rawPts.some(p => p.pressure !== 0.5)
  const outline = pfGetStroke(rawPts, {
    size,
    thinning,
    smoothing: 0.3,
    streamline,
    simulatePressure: !hasPenPressure,
    last: isComplete,
    start: { taper: Math.max(size * 1.5, 12), easing: t => t * t, cap: true },
    end:   { taper: isComplete ? Math.max(size * 2, 20) : 0, easing: t => t * t * t, cap: true },
  })
  if (outline.length < 3) return ''
  return pfSvgPath(outline)
}

export function renderPenStrokeCrisp(
  ctx: CanvasRenderingContext2D,
  rawPts: { x: number; y: number; pressure: number }[],
  size: number,
  color: string,
  alpha: number,
  streamline: number = 0.38,
  thinning: number  = 0.45,
  isComplete: boolean = false,
) {
  if (rawPts.length < 2) return

  const hasPenPressure = rawPts.some(p => p.pressure !== 0.5)

  const outline = pfGetStroke(rawPts, {
    size,
    thinning,
    smoothing: 0.3,
    streamline,
    simulatePressure: !hasPenPressure,
    last: isComplete,
    // SAI-style tapers: gentle entry, sharper exit
    start: { taper: Math.max(size * 1.5, 12), easing: t => t * t, cap: true },
    end:   { taper: isComplete ? Math.max(size * 2, 20) : 0, easing: t => t * t * t, cap: true },
  })

  if (outline.length < 3) return

  const pathStr = pfSvgPath(outline)
  if (!pathStr) return

  const [r, g, b] = hexToRgb(color)
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = alpha
  ctx.fillStyle = `rgb(${r},${g},${b})`
  ctx.fill(new Path2D(pathStr))
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════

export interface BrushPreset {
  id: string
  name: string
  brushType: BrushType
  color: string
  size: number
  alpha: number
  hardness: number
  mixRate: number
  dilution: number
  persistence: number
  createdAt: number
}

const PRESETS_KEY = 'ps-draw-brush-presets-v2'

function loadPresets(): BrushPreset[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePresets(presets: BrushPreset[]) {
  try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)) } catch {}
}

const BUILTIN_PRESETS: BrushPreset[] = [
  // ── 线稿类 ──────────────────────────────────────────────────────────────────
  { id: 'b1',  name: '细线速写',    brushType: 'pen',        color: '#1a1a1a', size: 1,  alpha: 1,    hardness: 100, mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b2',  name: '书法墨笔',    brushType: 'ink',        color: '#0a0a0a', size: 8,  alpha: 0.92, hardness: 88,  mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b3',  name: '铅笔素描',    brushType: 'pencil',     color: '#555555', size: 4,  alpha: 0.65, hardness: 65,  mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  // ── 着色类 ──────────────────────────────────────────────────────────────────
  // SAI blending 50, dilution 17, persistence 34 — 社区公认入门水彩参数
  { id: 'b4',  name: 'SAI 水彩',    brushType: 'watercolor', color: '#4a90d9', size: 22, alpha: 0.6,  hardness: 15,  mixRate: 50, dilution: 17, persistence: 34, createdAt: 0 },
  // SAI blending 50, dilution 50, persistence 80 — 柔滑混色水彩
  { id: 'b5',  name: '柔滑晕染',    brushType: 'watercolor', color: '#c471ed', size: 26, alpha: 0.55, hardness: 10,  mixRate: 50, dilution: 50, persistence: 80, createdAt: 0 },
  // SAI oilpaint: blending 40-60, persistence=100 厚涂感
  { id: 'b6',  name: '油画厚涂',    brushType: 'oilpaint',   color: '#c4a044', size: 16, alpha: 0.9,  hardness: 60,  mixRate: 45, dilution: 5,  persistence: 80, createdAt: 0 },
  // marker-style: blending 49, dilution 0, persistence 80
  { id: 'b7',  name: '湿笔晕染',    brushType: 'wetbrush',   color: '#6fcf97', size: 20, alpha: 0.5,  hardness: 0,   mixRate: 49, dilution: 0,  persistence: 80, createdAt: 0 },
  // ── 特效类 ──────────────────────────────────────────────────────────────────
  { id: 'b8',  name: '黄色高光',    brushType: 'marker',     color: '#f2c94c', size: 20, alpha: 0.45, hardness: 90,  mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b9',  name: '软喷枪',      brushType: 'airbrush',   color: '#e05c5c', size: 35, alpha: 0.2,  hardness: 0,   mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b10', name: 'SAI 模糊',    brushType: 'blur',       color: '#ffffff', size: 30, alpha: 0.7,  hardness: 0,   mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b11', name: '粉笔纹理',    brushType: 'chalk',      color: '#e8e0d0', size: 12, alpha: 0.8,  hardness: 40,  mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b12', name: '涂抹混色',    brushType: 'smear',      color: '#ffffff', size: 24, alpha: 0.65, hardness: 0,   mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
  { id: 'b13', name: '手指涂抹',    brushType: 'blend',      color: '#ffffff', size: 26, alpha: 0.7,  hardness: 0,   mixRate: 0,  dilution: 0,  persistence: 0,  createdAt: 0 },
]

const COLOR_PALETTE = [
  '#1a1a1a', '#3a3a3a', '#777777', '#b0b0ac',
  '#ffffff', '#f7f2e8', '#e8d5b0', '#c4a044',
  '#e05c5c', '#e07a5c', '#f2c94c', '#6fcf97',
  '#56b6c2', '#4a90d9', '#7c6af7', '#c471ed',
]

// ═══════════════════════════════════════════════════════════════════════════════
// DRAW STATE
// ═══════════════════════════════════════════════════════════════════════════════

export interface DrawState {
  brushType: BrushType
  color: string
  size: number
  alpha: number
  hardness: number
  mixRate: number      // blending: 0–100，画布颜色拾取量
  dilution: number     // SAI dilution: 0–100，稀释度（透明区域画色能力，0=完全可画，100=透明区完全不上色）
  persistence: number  // SAI persistence: 0–100，拖尾长度（颜色拖尾惯性）
  shapeType: ShapeType | null
  shapeFill: boolean
  shapeStroke: number
  shapeSides: number
}

export const sharedDrawState: DrawState = {
  brushType: 'pen', color: '#1a1a1a', size: 2, alpha: 1,
  hardness: 100, mixRate: 0, dilution: 0, persistence: 0,
  shapeType: null, shapeFill: false, shapeStroke: 2, shapeSides: 6,
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════════

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  if (clean.length === 3) {
    return [
      parseInt(clean[0]+clean[0], 16),
      parseInt(clean[1]+clean[1], 16),
      parseInt(clean[2]+clean[2], 16),
    ]
  }
  return [
    parseInt(clean.slice(0,2), 16),
    parseInt(clean.slice(2,4), 16),
    parseInt(clean.slice(4,6), 16),
  ]
}

export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIXEL OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LOCAL BLUR (SAI-style):
 * Reads pixels in a circle, box-blurs them, writes them back with feathered mask.
 * Repeated strokes accumulate blur naturally — no pre-snapshot needed.
 *
 * ── 颜色偏移修复 ──────────────────────────────────────────────────────────────
 * getImageData 返回 straight alpha（RGB 与 alpha 独立）。
 * 直接对 straight alpha 数据做 box blur，会把透明像素的 RGB=0 一起平均进去，
 * 导致颜色越模糊越偏暗/偏灰（premultiplied alpha 问题）。
 * 修复：blur 前先转 premultiplied（RGB *= alpha/255），
 *       blur 后再转回 straight（RGB /= alpha/255），保持颜色正确。
 */
export function applyLocalBlur(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number,
  strength: number,
  passes: number = 2,
) {
  const r  = Math.ceil(radius)
  const W  = ctx.canvas.width, H = ctx.canvas.height
  const x0 = Math.max(0, Math.round(cx - r))
  const y0 = Math.max(0, Math.round(cy - r))
  const x1 = Math.min(W, x0 + r * 2)
  const y1 = Math.min(H, y0 + r * 2)
  const rw = x1 - x0, rh = y1 - y0
  if (rw <= 0 || rh <= 0) return

  const src  = ctx.getImageData(x0, y0, rw, rh)
  const orig = new Uint8ClampedArray(src.data)   // 保留原始 straight alpha 数据

  // ── straight → premultiplied ──
  const pre = new Float32Array(src.data.length)
  for (let i = 0; i < src.data.length; i += 4) {
    const a = src.data[i + 3] / 255
    pre[i]   = src.data[i]   * a
    pre[i+1] = src.data[i+1] * a
    pre[i+2] = src.data[i+2] * a
    pre[i+3] = src.data[i+3]
  }

  // ── separable box blur（在 premultiplied 空间做，颜色不会偏移）──
  const buf = new Float32Array(pre)
  const tmp = new Float32Array(pre.length)

  for (let p = 0; p < passes; p++) {
    // 水平 pass
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        let rr = 0, g = 0, b = 0, a = 0, n = 0
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= rw) continue
          const i = (y * rw + nx) * 4
          rr += buf[i]; g += buf[i+1]; b += buf[i+2]; a += buf[i+3]; n++
        }
        const i = (y * rw + x) * 4
        tmp[i] = rr/n; tmp[i+1] = g/n; tmp[i+2] = b/n; tmp[i+3] = a/n
      }
    }
    // 垂直 pass
    for (let y = 0; y < rh; y++) {
      for (let x = 0; x < rw; x++) {
        let rr = 0, g = 0, b = 0, a = 0, n = 0
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= rh) continue
          const i = (ny * rw + x) * 4
          rr += tmp[i]; g += tmp[i+1]; b += tmp[i+2]; a += tmp[i+3]; n++
        }
        const i = (y * rw + x) * 4
        buf[i] = rr/n; buf[i+1] = g/n; buf[i+2] = b/n; buf[i+3] = a/n
      }
    }
  }

  // ── premultiplied → straight alpha ──
  const blurred = new Float32Array(buf.length)
  for (let i = 0; i < buf.length; i += 4) {
    const a = buf[i + 3]
    if (a > 0) {
      blurred[i]   = buf[i]   / (a / 255)
      blurred[i+1] = buf[i+1] / (a / 255)
      blurred[i+2] = buf[i+2] / (a / 255)
    }
    blurred[i+3] = a
  }

  // ── feathered blend：圆形羽化蒙版，只改变圆内像素 ──
  const rcx = r, rcy = r
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      const dx = x - rcx, dy = y - rcy
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist > r) continue
      const t = Math.max(0, 1 - dist / r)
      const blend = strength * t * t
      const i = (y * rw + x) * 4
      src.data[i]   = orig[i]   + (blurred[i]   - orig[i])   * blend
      src.data[i+1] = orig[i+1] + (blurred[i+1] - orig[i+1]) * blend
      src.data[i+2] = orig[i+2] + (blurred[i+2] - orig[i+2]) * blend
      src.data[i+3] = orig[i+3] + (blurred[i+3] - orig[i+3]) * blend
    }
  }
  ctx.putImageData(src, x0, y0)
}

/**
 * LOCAL BLEND (SAI blender / finger-smudge):
 * 在笔刷圆内，对每个像素采样其小邻域（radius * neighborRatio）的平均色，
 * 按 strength 与原色插值写回。不注入任何前景色——只重新分配已有颜色。
 *
 * 与 blur 的区别：
 *   blur   → 每像素与自身周围 1px 3×3 box 平均（kernel 固定小）
 *   blend  → 每像素与自身周围 neighborR px 圆形平均（kernel 随笔刷大小缩放），
 *             且 neighborRatio 可调，产生更明显的颜色融合感
 *
 * premultiplied alpha 空间做运算，防止颜色偏暗。
 */
export function applyLocalBlend(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number,
  strength: number,         // 0–1，涂抹强度（对应笔刷 alpha）
  neighborRatio: number = 0.35, // 邻域采样半径 / 笔刷半径，0.2–0.5 为佳
) {
  const r  = Math.ceil(radius)
  const W  = ctx.canvas.width, H = ctx.canvas.height
  const x0 = Math.max(0, Math.round(cx - r))
  const y0 = Math.max(0, Math.round(cy - r))
  const x1 = Math.min(W, x0 + r * 2)
  const y1 = Math.min(H, y0 + r * 2)
  const rw = x1 - x0, rh = y1 - y0
  if (rw <= 0 || rh <= 0) return

  const imgData = ctx.getImageData(x0, y0, rw, rh)
  const src = imgData.data
  const orig = new Uint8ClampedArray(src)  // 原始像素（采样源，不随写入变化）

  // straight → premultiplied，防止透明像素 RGB=0 污染邻域平均
  const pre = new Float32Array(src.length)
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3] / 255
    pre[i]   = src[i]   * a
    pre[i+1] = src[i+1] * a
    pre[i+2] = src[i+2] * a
    pre[i+3] = src[i+3]
  }

  const nr = Math.max(1, Math.round(radius * neighborRatio)) // 邻域采样半径（px）
  const rcx = r, rcy = r  // 笔刷圆心在 patch 内坐标

  for (let py = 0; py < rh; py++) {
    for (let px = 0; px < rw; px++) {
      // 只处理笔刷圆内的像素
      const bdx = px - rcx, bdy = py - rcy
      const bdist = Math.sqrt(bdx * bdx + bdy * bdy)
      if (bdist > r) continue

      // 圆形羽化权重（中心强，边缘弱）
      const brushT = Math.max(0, 1 - bdist / r)
      const blendW = strength * brushT * brushT

      // 采样邻域（以 px,py 为中心，nr 为半径）的 premultiplied 平均色
      let ar = 0, ag = 0, ab = 0, aa = 0, n = 0
      for (let dy = -nr; dy <= nr; dy++) {
        for (let dx = -nr; dx <= nr; dx++) {
          if (dx * dx + dy * dy > nr * nr) continue  // 圆形邻域
          const nx = px + dx, ny = py + dy
          if (nx < 0 || nx >= rw || ny < 0 || ny >= rh) continue
          const ni = (ny * rw + nx) * 4
          ar += pre[ni]; ag += pre[ni+1]; ab += pre[ni+2]; aa += pre[ni+3]; n++
        }
      }
      if (n === 0) continue
      ar /= n; ag /= n; ab /= n; aa /= n

      // premultiplied → straight（邻域平均色）
      let nr2 = ar, ng2 = ag, nb2 = ab
      if (aa > 0) {
        const invA = 255 / aa
        nr2 = ar * invA; ng2 = ag * invA; nb2 = ab * invA
      }

      // 与原色按 blendW 插值写回
      const i = (py * rw + px) * 4
      src[i]   = orig[i]   + (nr2 - orig[i])   * blendW
      src[i+1] = orig[i+1] + (ng2 - orig[i+1]) * blendW
      src[i+2] = orig[i+2] + (nb2 - orig[i+2]) * blendW
      // alpha 也轻微均匀化（让透明区稍微被拉入，产生晕开感）
      src[i+3] = orig[i+3] + (aa  - orig[i+3]) * blendW * 0.4
    }
  }
  ctx.putImageData(imgData, x0, y0)
}

/**
 */
export function applySmearStamp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  srcX: number, srcY: number,
  radius: number,
  strength: number,
  snapshotCanvas: HTMLCanvasElement,
) {
  const r  = Math.ceil(radius)
  const d  = r * 2
  const W  = ctx.canvas.width, H = ctx.canvas.height
  const ssx = Math.round(srcX - r), ssy = Math.round(srcY - r)
  const ddx = Math.round(x - r),    ddy = Math.round(y - r)
  if (ddx+d<=0 || ddy+d<=0 || ddx>=W || ddy>=H) return
  if (ssx+d<=0 || ssy+d<=0 || ssx>=snapshotCanvas.width || ssy>=snapshotCanvas.height) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.clip()
  ctx.globalAlpha = strength
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(snapshotCanvas, ssx, ssy, d, d, ddx, ddy, d, d)
  ctx.restore()
}

export function syncSmearCanvas(src: CanvasRenderingContext2D, dst: HTMLCanvasElement) {
  const dctx = dst.getContext('2d')!
  dctx.clearRect(0, 0, dst.width, dst.height)
  dctx.drawImage(src.canvas, 0, 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// WET MIX — SAI watercolor / oil paint color pickup
// ═══════════════════════════════════════════════════════════════════════════════

function sampleCanvasColor(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  radius: number,
): [number, number, number, number] {
  const r   = Math.max(2, Math.ceil(radius * 0.5))
  const x0  = Math.max(0, Math.round(cx - r))
  const y0  = Math.max(0, Math.round(cy - r))
  const x1  = Math.min(ctx.canvas.width,  x0 + r * 2)
  const y1  = Math.min(ctx.canvas.height, y0 + r * 2)
  const rw  = x1 - x0, rh = y1 - y0
  if (rw <= 0 || rh <= 0) return [0, 0, 0, 0]
  const data = ctx.getImageData(x0, y0, rw, rh).data
  let sr = 0, sg = 0, sb = 0, sa = 0, n = 0
  for (let i = 0; i < data.length; i += 4) {
    sr += data[i]; sg += data[i+1]; sb += data[i+2]; sa += data[i+3]; n++
  }
  if (n === 0) return [0, 0, 0, 0]
  return [sr/n, sg/n, sb/n, sa/n]
}

function blendRGB(
  r1: number, g1: number, b1: number,
  r2: number, g2: number, b2: number,
  t: number,
): [number, number, number] {
  return [r1+(r2-r1)*t, g1+(g2-g1)*t, b1+(b2-b1)*t]
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAMP RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export function drawStamp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  r: number, g: number, b: number,
  alpha: number,
  hardness: number,
  composite: GlobalCompositeOperation = 'source-over',
) {
  const rad = Math.max(0.5, radius)
  ctx.save()
  ctx.globalCompositeOperation = composite
  ctx.globalAlpha = alpha

  if (hardness >= 95) {
    ctx.fillStyle = composite === 'destination-out'
      ? 'rgba(0,0,0,1)'
      : `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  } else {
    // SAI 三段式曲线衰减：硬核 → 平方过渡 → 全透明
    // 消除线性渐变在像素边界产生的硬切锯齿
    const hardCore = (hardness / 100) * 0.92   // 硬核半径比例（留8%给过渡）
    const midStop  = hardCore + (1 - hardCore) * 0.5  // 过渡中点
    const col = composite === 'destination-out'
      ? (a: number) => `rgba(0,0,0,${a})`
      : (a: number) => `rgba(${r},${g},${b},${a})`

    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
    grad.addColorStop(0,        col(1))
    grad.addColorStop(hardCore, col(1))      // 硬核边界：仍然完全不透明
    grad.addColorStop(midStop,  col(0.35))   // 中间过渡：平方曲线感（0.35 ≈ √0.5 * 0.5）
    grad.addColorStop(1,        col(0))      // 边缘：全透明

    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, rad, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════
// AIRBRUSH SPRAY
// ═══════════════════════════════════════════════════════════════════════════════

function drawAirbrushSpray(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  radius: number,
  r: number, g: number, b: number,
  alpha: number,
  pressure: number,
) {
  const dotCount = Math.ceil(radius * 0.8 * pressure)
  ctx.save()
  ctx.globalCompositeOperation = 'source-over'
  for (let i = 0; i < dotCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const dist  = Math.abs((Math.random() + Math.random() - 1)) * radius
    const dx    = Math.cos(angle) * dist
    const dy    = Math.sin(angle) * dist
    ctx.globalAlpha = alpha * (1 - dist / radius) * 0.4
    ctx.fillStyle   = `rgb(${r},${g},${b})`
    ctx.beginPath()
    ctx.arc(x + dx, y + dy, 0.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL STROKE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export function universalRenderStroke(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number; t: number; pressure: number }[],
  state: DrawState,
  brush: BrushConfig,
  lastVelRef: { current: number },
  distAccRef: { current: number } = { current: 0 },
  liveSnapshot?: HTMLCanvasElement,
) {
  if (pts.length < 2) return
  const { hardness, mixRate } = state
  const [fr, fg, fb] = hexToRgb(state.color)

  // ── PIXEL_BLUR (SAI-style: dense interpolated steps, low per-step strength) ─
  if (brush.renderMode === 'pixel_blur') {
    const radius  = state.size / 2
    // Step size = 20% of radius → heavy overlap, no visible blobs
    const spacing = Math.max(1, radius * 0.2)
    // Per-step strength is very small; user's alpha sets the overall feel
    const stepStr = Math.max(0.15, state.alpha * 0.45)

    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      const steps  = Math.max(2, Math.ceil(segLen / spacing))

      for (let s = 0; s <= steps; s++) {
        const tt = s / steps
        const sx = catmullRom(p0.x, p1.x, p2.x, p3.x, tt)
        const sy = catmullRom(p0.y, p1.y, p2.y, p3.y, tt)
        applyLocalBlur(ctx, sx, sy, radius, stepStr, 4)
      }
    }
    return
  }

  // ── PIXEL_SMEAR ────────────────────────────────────────────────────────────
  if (brush.renderMode === 'pixel_smear') {
    if (!liveSnapshot) return
    for (let i = 1; i < pts.length; i++) {
      const cur = pts[i], prev = pts[i-1]
      applySmearStamp(ctx, cur.x, cur.y, prev.x, prev.y, state.size / 2, state.alpha, liveSnapshot)
      syncSmearCanvas(ctx, liveSnapshot)
    }
    return
  }

  // ── PIXEL_BLEND (SAI blender: 手指涂抹，不注入新颜色) ──────────────────────
  if (brush.renderMode === 'pixel_blend') {
    const radius  = state.size / 2
    // 步距 = 邻域半径的 60%，保证相邻 stamp 有足够重叠产生平滑融合
    const neighborR = radius * 0.35
    const spacing   = Math.max(1, neighborR * 0.6)
    const strength  = Math.max(0.1, state.alpha)

    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[Math.min(pts.length - 1, i + 2)]

      const segLen = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
      const steps  = Math.max(2, Math.ceil(segLen / spacing))

      for (let s = 0; s <= steps; s++) {
        const tt = s / steps
        const sx = catmullRom(p0.x, p1.x, p2.x, p3.x, tt)
        const sy = catmullRom(p0.y, p1.y, p2.y, p3.y, tt)
        applyLocalBlend(ctx, sx, sy, radius, strength, 0.35)
      }
    }
    return
  }

  // ── STAMP / ERASE ──────────────────────────────────────────────────────────
  if (brush.renderMode === 'stamp' || brush.renderMode === 'erase') {
    const spacing = Math.max(1, state.size * 0.18)

    for (let i = 1; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i-1)]
      const p1 = pts[i]
      const p2 = pts[i+1]
      const p3 = pts[Math.min(pts.length-1, i+2)]

      let pressure = 1
      if (brush.pressureSim) {
        const hasPen = p1.pressure !== 0.5 && p2.pressure !== 0.5
        if (hasPen) {
          // SAI 默认 pressure curve: ease-in³（轻压细，重压才粗——接近真实画笔手感）
          const rawP = p1.pressure * 0.4 + p2.pressure * 0.6
          const curved = rawP * rawP * rawP  // ease-in³
          pressure = Math.max(0.15, Math.min(1.8, 0.3 + curved * 1.5))
        } else {
          const dt  = Math.max(1, p2.t - p1.t)
          const dx  = p2.x - p1.x, dy = p2.y - p1.y
          const vel = Math.sqrt(dx*dx + dy*dy) / dt
          lastVelRef.current = lastVelRef.current * 0.7 + vel * 0.3
          pressure = Math.max(0.3, Math.min(1.5, 1 - lastVelRef.current * 0.8))
        }
      }

      const radius = (state.size / 2) * pressure
      const segLen = Math.sqrt(Math.pow(p2.x-p1.x,2) + Math.pow(p2.y-p1.y,2))
      const steps  = Math.max(2, Math.ceil(segLen / (spacing * 0.5)))
      let prevSx = catmullRom(p0.x, p1.x, p2.x, p3.x, 0)
      let prevSy = catmullRom(p0.y, p1.y, p2.y, p3.y, 0)

      for (let s = 1; s <= steps; s++) {
        const tt = s / steps
        const sx = catmullRom(p0.x, p1.x, p2.x, p3.x, tt)
        const sy = catmullRom(p0.y, p1.y, p2.y, p3.y, tt)
        distAccRef.current += Math.sqrt(Math.pow(sx-prevSx,2) + Math.pow(sy-prevSy,2))
        prevSx = sx; prevSy = sy

        while (distAccRef.current >= spacing) {
          distAccRef.current -= spacing
          let jx = sx, jy = sy
          if (brush.scatter) {
            const scatterMul = brush.airSpray ? 1.2 : 0.45
            jx += (Math.random() - 0.5) * state.size * scatterMul
            jy += (Math.random() - 0.5) * state.size * scatterMul
          }
          const stampRadius = brush.type === 'wetbrush'
            ? radius * (0.7 + Math.random() * 0.6)
            : radius

          // WET MIX: SAI-style blending + dilution + persistence
          let sr = fr, sg = fg, sb = fb
          let stampAlphaScale = 1.0
          if (brush.wetMix) {
            const blendT   = mixRate / 100                  // SAI blending: 画布颜色拾取比
            const dilutionT = (state.dilution ?? 0) / 100  // SAI dilution: 稀释透明度
            const persistT  = (state.persistence ?? 0) / 100 // SAI persistence: 拖尾

            const [cr, cg, cb, ca] = sampleCanvasColor(ctx, jx, jy, stampRadius)
            const canvasPresence = ca / 255  // 0=透明区域，1=不透明区域

            // blending: 按画布颜色存在量混合（透明区混的少）
            if (blendT > 0) {
              const effectiveMix = blendT * Math.min(1, canvasPresence + 0.15)
              ;[sr, sg, sb] = blendRGB(fr, fg, fb, cr, cg, cb, effectiveMix)
            }

            // dilution: 透明区域上色能力衰减
            // dilution=0: 无影响(完全可画); dilution=100: 透明区完全不上色
            if (dilutionT > 0) {
              // 透明区（canvasPresence低）时 alpha 按 dilution 衰减
              stampAlphaScale *= (1 - dilutionT * (1 - canvasPresence))
              stampAlphaScale = Math.max(0.02, stampAlphaScale)
            }

            // persistence: SAI 拖尾——把拾取到的颜色持续带向前方
            // 简单实现：高 persistence 时，混色后的颜色向前方的 stamp 传递（用 sr/sg/sb 持久化）
            // 这里用 persistence 增强 blendT 下一步的"已有色"权重
            if (persistT > 0 && canvasPresence > 0.1) {
              // persistence 让已拾取的混色颜色比前景更"粘"，产生拖尾感
              const pBlend = persistT * canvasPresence * 0.6
              ;[sr, sg, sb] = blendRGB(sr, sg, sb, cr, cg, cb, pBlend)
            }
          }

          // AIRBRUSH: spray dot mode
          if (brush.airSpray) {
            drawAirbrushSpray(ctx, jx, jy, stampRadius * 2, sr, sg, sb, state.alpha, pressure)
            continue
          }

          const stampAlpha   = (brush.type === 'chalk' ? state.alpha * (0.5 + Math.random() * 0.5)
                             : brush.type === 'marker' ? brush.defaultAlpha
                             : state.alpha) * stampAlphaScale
          const stampHardness = brush.renderMode === 'erase' ? 100 : hardness

          drawStamp(ctx, jx, jy, stampRadius, sr, sg, sb, stampAlpha, stampHardness, brush.composite)
        }
      }
    }
    return
  }

  // ── LINE (marker fast path) ────────────────────────────────────────────────
  // ── PEN uses SAI-style mid-point bezierCurveTo — C1 continuous, never breaks
  ctx.save()
  ctx.globalCompositeOperation = brush.composite
  ctx.lineCap  = 'round'
  ctx.lineJoin = 'round'

  if (brush.type === 'pen') {
    // SAI-quality ink: perfect-freehand fill polygon, no stroke() joints
    renderPenStrokeCrisp(
      ctx,
      pts.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
      state.size,
      state.color,
      state.alpha,
      0.38,   // streamline: SAI stabilizer S2 level — smooth but not laggy
      0.45,   // thinning: subtle pressure variation, natural not dramatic
      false,  // isComplete: false during drawing (no end taper yet)
    )
    lastVelRef.current = 0
    return
  }

  // ── MARKER (original path renderer) ───────────────────────────────────────
  if (brush.type === 'marker') {
    ctx.globalAlpha = brush.defaultAlpha
    ctx.strokeStyle = state.color
  } else {
    ctx.globalAlpha = state.alpha
    ctx.strokeStyle = state.color
  }
  // Smooth quadratic bezier through midpoints — C1 continuous, no joint seams
  ctx.lineWidth = state.size
  if (pts.length === 2) {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(pts[1].x, pts[1].y)
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2
    const my = (pts[i].y + pts[i + 1].y) / 2
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my)
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y)
  ctx.stroke()
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATMULL-ROM → CUBIC BEZIER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 把一组锚点用 centripetal Catmull-Rom 转成 canvas cubic bezierCurveTo 调用。
 * 用户只需点击放锚点，曲线自动平滑经过每个点，无需控制柄。
 * alpha=0.5 (centripetal) 不会产生自交或尖刺。
 */
export function catmullRomToBezierCtx(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
) {
  if (pts.length < 2) return
  if (pts.length === 2) {
    ctx.moveTo(pts[0].x, pts[0].y)
    ctx.lineTo(pts[1].x, pts[1].y)
    return
  }
  // 首尾各复制一个端点作为幽灵点
  const p = [pts[0], ...pts, pts[pts.length - 1]]
  ctx.moveTo(p[1].x, p[1].y)
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    // centripetal parameterization (alpha=0.5)
    const d1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y))
    const d2 = Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y))
    const d3 = Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y))
    const d1s = d1 || 1e-4, d2s = d2 || 1e-4, d3s = d3 || 1e-4
    // control points
    const cp1x = p1.x + (p2.x - p0.x) * d2s / (6 * (d1s + d2s) / d2s)
    const cp1y = p1.y + (p2.y - p0.y) * d2s / (6 * (d1s + d2s) / d2s)
    const cp2x = p2.x - (p3.x - p1.x) * d2s / (6 * (d2s + d3s) / d2s)
    const cp2y = p2.y - (p3.y - p1.y) * d2s / (6 * (d2s + d3s) / d2s)
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y)
  }
}

/**
 * 同上，输出 SVG path string（用于 SVG overlay 预览）。
 */
export function catmullRomToSVGPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)} L ${pts[1].x.toFixed(2)} ${pts[1].y.toFixed(2)}`
  }
  const p = [pts[0], ...pts, pts[pts.length - 1]]
  const parts: string[] = [`M ${p[1].x.toFixed(2)} ${p[1].y.toFixed(2)}`]
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2]
    const d1 = Math.sqrt(Math.hypot(p1.x - p0.x, p1.y - p0.y))
    const d2 = Math.sqrt(Math.hypot(p2.x - p1.x, p2.y - p1.y))
    const d3 = Math.sqrt(Math.hypot(p3.x - p2.x, p3.y - p2.y))
    const d1s = d1 || 1e-4, d2s = d2 || 1e-4, d3s = d3 || 1e-4
    const cp1x = p1.x + (p2.x - p0.x) * d2s / (6 * (d1s + d2s) / d2s)
    const cp1y = p1.y + (p2.y - p0.y) * d2s / (6 * (d1s + d2s) / d2s)
    const cp2x = p2.x - (p3.x - p1.x) * d2s / (6 * (d2s + d3s) / d2s)
    const cp2y = p2.y - (p3.y - p1.y) * d2s / (6 * (d2s + d3s) / d2s)
    parts.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`)
  }
  return parts.join(' ')
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHAPE RENDERER
// ═══════════════════════════════════════════════════════════════════════════════

export function renderShape(
  ctx: CanvasRenderingContext2D,
  state: DrawState,
  x0: number, y0: number,
  x1: number, y1: number,
  bezierPts?: { x: number; y: number }[],
) {
  const { color, alpha, shapeFill, shapeStroke, shapeSides, shapeType } = state
  if (!shapeType) return
  const [r, g, b] = hexToRgb(color)
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = `rgb(${r},${g},${b})`
  ctx.fillStyle   = `rgba(${r},${g},${b},${shapeFill ? 0.35 : 0})`
  ctx.lineWidth   = Math.max(1, shapeStroke)
  ctx.lineCap     = 'round'
  ctx.lineJoin    = 'round'
  const w = x1-x0, h = y1-y0
  const cx = (x0+x1)/2, cy = (y0+y1)/2
  ctx.beginPath()
  switch (shapeType) {
    case 'rect':    { ctx.rect(x0,y0,w,h); break }
    case 'ellipse': { ctx.ellipse(cx,cy,Math.abs(w/2)||1,Math.abs(h/2)||1,0,0,Math.PI*2); break }
    case 'line':    { ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); break }
    case 'arrow': {
      const dx=x1-x0, dy=y1-y0, len=Math.sqrt(dx*dx+dy*dy)
      if (len < 2) { ctx.restore(); return }
      const ang=Math.atan2(dy,dx), hl=Math.min(len*0.4,Math.max(14,shapeStroke*6)), ha=Math.PI/6
      ctx.moveTo(x0,y0); ctx.lineTo(x1,y1)
      ctx.moveTo(x1,y1); ctx.lineTo(x1-hl*Math.cos(ang-ha),y1-hl*Math.sin(ang-ha))
      ctx.moveTo(x1,y1); ctx.lineTo(x1-hl*Math.cos(ang+ha),y1-hl*Math.sin(ang+ha))
      ctx.stroke(); ctx.restore(); return
    }
    case 'triangle': { ctx.moveTo(cx,y0); ctx.lineTo(x0,y1); ctx.lineTo(x1,y1); ctx.closePath(); break }
    case 'polygon': {
      const sides=Math.max(3,shapeSides), rx=Math.abs(w/2), ry=Math.abs(h/2)
      for (let i=0;i<sides;i++) {
        const a=(i/sides)*Math.PI*2-Math.PI/2
        i===0?ctx.moveTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a)):ctx.lineTo(cx+rx*Math.cos(a),cy+ry*Math.sin(a))
      }
      ctx.closePath(); break
    }
    case 'star': {
      const pts2=Math.max(3,shapeSides), orx=Math.abs(w/2), ory=Math.abs(h/2), irx=orx*0.42, iry=ory*0.42
      for (let i=0;i<pts2*2;i++) {
        const a=(i/(pts2*2))*Math.PI*2-Math.PI/2
        const isO=i%2===0
        i===0?ctx.moveTo(cx+(isO?orx:irx)*Math.cos(a),cy+(isO?ory:iry)*Math.sin(a)):ctx.lineTo(cx+(isO?orx:irx)*Math.cos(a),cy+(isO?ory:iry)*Math.sin(a))
      }
      ctx.closePath(); break
    }
    case 'bezier': {
      const bpts = bezierPts && bezierPts.length > 0 ? bezierPts : [{x:x0,y:y0},{x:x1,y:y1}]
      if (bpts.length === 1) { ctx.arc(bpts[0].x, bpts[0].y, 3, 0, Math.PI*2); break }
      catmullRomToBezierCtx(ctx, bpts)
      break
    }
  }
  if (shapeFill && !['line','arrow','bezier'].includes(shapeType)) ctx.fill()
  ctx.stroke()
  ctx.restore()
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface DrawPanelProps {
  isZh: boolean
  addImageBlock: (dataUrl: string) => void
  canvasWidth?: number
  activePageId: string   // 用于获取对应页面的 DrawLayerManager 单例
}

export function DrawPanel({ isZh, addImageBlock, canvasWidth = 600, activePageId }: DrawPanelProps) {

  const [brushType,    setBrushTypeState]   = useState<BrushType>('pen')
  const [color,        setColorState]       = useState('#1a1a1a')
  const [size,         setSizeState]        = useState(2)
  const [alpha,        setAlphaState]       = useState(1)
  const [hardness,     setHardnessState]    = useState(100)
  const [mixRate,      setMixRateState]     = useState(0)
  const [dilution,     setDilutionState]    = useState(0)
  const [persistence,  setPersistenceState] = useState(0)
  const [bgColor,      setBgColor]          = useState<string>('transparent')
  const [canUndo,      setCanUndo]          = useState(false)
  const [userPresets,  setUserPresets]      = useState<BrushPreset[]>(() => loadPresets())
  const [savingPreset, setSavingPreset]     = useState(false)
  const [presetName,   setPresetName]       = useState('')
  const [shapeType,    setShapeTypeState]   = useState<ShapeType | null>(null)
  const [shapeFill,    setShapeFillState]   = useState(false)
  const [shapeStroke,  setShapeStrokeState] = useState(2)
  const [shapeSides,   setShapeSidesState]  = useState(6)

  const brushTypeRef   = useRef<BrushType>('pen')
  const colorRef       = useRef('#1a1a1a')
  const sizeRef        = useRef(2)
  const alphaRef       = useRef(1)
  const hardnessRef    = useRef(100)
  const mixRateRef     = useRef(0)
  const dilutionRef    = useRef(0)
  const persistenceRef = useRef(0)
  const shapeTypeRef   = useRef<ShapeType | null>(null)
  const shapeFillRef   = useRef(false)
  const shapeStrokeRef = useRef(2)
  const shapeSidesRef  = useRef(6)

  const setBrushType   = (v: BrushType) => { brushTypeRef.current = v; sharedDrawState.brushType = v; setBrushTypeState(v) }
  const setColor       = (v: string)    => { colorRef.current = v;     sharedDrawState.color = v;     setColorState(v) }
  const setSize        = (v: number)    => { sizeRef.current = v;      sharedDrawState.size = v;      setSizeState(v) }
  const setAlpha       = (v: number)    => { alphaRef.current = v;     sharedDrawState.alpha = v;     setAlphaState(v) }
  const setHardness    = (v: number)    => { hardnessRef.current = v;  sharedDrawState.hardness = v;  setHardnessState(v) }
  const setMixRate     = (v: number)    => { mixRateRef.current = v;     sharedDrawState.mixRate = v;     setMixRateState(v) }
  const setDilution    = (v: number)    => { dilutionRef.current = v;    sharedDrawState.dilution = v;    setDilutionState(v) }
  const setPersistence = (v: number)    => { persistenceRef.current = v; sharedDrawState.persistence = v; setPersistenceState(v) }
  const setShapeType   = (v: ShapeType | null) => { shapeTypeRef.current = v; sharedDrawState.shapeType = v; setShapeTypeState(v) }
  const setShapeFill   = (v: boolean) => { shapeFillRef.current = v;   sharedDrawState.shapeFill = v;   setShapeFillState(v) }
  const setShapeStroke = (v: number)  => { shapeStrokeRef.current = v; sharedDrawState.shapeStroke = v; setShapeStrokeState(v) }
  const setShapeSides  = (v: number)  => { shapeSidesRef.current = v;  sharedDrawState.shapeSides = v;  setShapeSidesState(v) }

  const allPresets = [...BUILTIN_PRESETS, ...userPresets]

  // ── undo / clear: 全部委托给 DrawLayerManager ─────────────────────────────
  const undo = useCallback(() => {
    const mgr = getDrawLayerManager(activePageId)
    mgr.undo()
    setCanUndo(
      mgr.getLayers().some(() => true) // undo 후 canUndo 상태 갱신은 manager 이벤트로 처리
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  const clearCanvas = useCallback(() => {
    getDrawLayerManager(activePageId).clearActiveLayer()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  // ── undo 상태 동기화 ────────────────────────────────────────────────────────
  useEffect(() => {
    const mgr = getDrawLayerManager(activePageId)
    const onEvent = (e: { type: string; canUndo?: boolean }) => {
      if (e.type === 'undo-state-changed') setCanUndo(e.canUndo ?? false)
    }
    mgr.on(onEvent as any)
    return () => mgr.off(onEvent as any)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePageId])

  const applyPreset = useCallback((p: BrushPreset) => {
    setBrushType(p.brushType)
    setColor(p.color)
    setSize(p.size)
    setAlpha(p.alpha)
    setHardness(p.hardness ?? 100)
    setMixRate(p.mixRate ?? 0)
    setDilution(p.dilution ?? 0)
    setPersistence(p.persistence ?? 0)
  }, [])

  const addPreset = useCallback(() => {
    const name = presetName.trim() || (isZh ? `预设 ${userPresets.length+1}` : `Preset ${userPresets.length+1}`)
    const preset: BrushPreset = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name, brushType, color, size, alpha, hardness, mixRate,
      dilution, persistence, createdAt: Date.now(),
    }
    const next = [...userPresets, preset]
    setUserPresets(next); savePresets(next); setPresetName(''); setSavingPreset(false)
  }, [presetName, brushType, color, size, alpha, hardness, mixRate, dilution, persistence, userPresets, isZh])

  const deletePreset = useCallback((id: string) => {
    const next = userPresets.filter(p => p.id !== id)
    setUserPresets(next); savePresets(next)
  }, [userPresets])

  const exportToBlock = useCallback(() => {
    const mgr = getDrawLayerManager(activePageId)
    const canvas = mgr.getDisplayCanvas()
    if (!canvas) return
    const ec = document.createElement('canvas')
    ec.width = canvas.width; ec.height = canvas.height
    const ectx = ec.getContext('2d')!
    if (bgColor !== 'transparent') {
      ectx.fillStyle = bgColor
      ectx.fillRect(0, 0, ec.width, ec.height)
    }
    ectx.drawImage(canvas, 0, 0)
    addImageBlock(ec.toDataURL('image/png'))
  }, [bgColor, addImageBlock, activePageId])

  const t = (en: string, zh: string) => isZh ? zh : en
  const currentBrush = BRUSHES.find(b => b.type === brushType)!
  const isPixelBrush = currentBrush.renderMode === 'pixel_blur' || currentBrush.renderMode === 'pixel_smear'
  const isWetBrush   = !!currentBrush.wetMix

  const labelStyle: React.CSSProperties = {
    fontSize: '0.58rem', letterSpacing: '0.18em', textTransform: 'uppercase',
    color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', fontWeight: 600,
    display: 'block', marginBottom: '8px',
  }
  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px', padding: '14px',
    background: 'rgba(26,26,26,0.03)', borderRadius: '10px',
    border: '1px solid rgba(26,26,26,0.07)',
  }
  const chipBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: '7px', cursor: 'pointer',
    border: `1px solid ${active ? 'rgba(26,26,26,0.4)' : 'rgba(26,26,26,0.1)'}`,
    background: active ? 'rgba(26,26,26,0.08)' : 'transparent',
    color: active ? '#1a1a1a' : '#aaa',
    fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem',
    transition: 'all 0.12s', display: 'flex', alignItems: 'center', gap: '5px',
  })

  const brushGroups: { label: string; labelZh: string; brushes: BrushConfig[] }[] = [
    { label: 'Line',    labelZh: '线条', brushes: BRUSHES.filter(b => ['pen','marker','pencil','ink'].includes(b.type)) },
    { label: 'Texture', labelZh: '纹理', brushes: BRUSHES.filter(b => ['chalk','wetbrush'].includes(b.type)) },
    { label: 'Paint',   labelZh: '绘画', brushes: BRUSHES.filter(b => ['watercolor','oilpaint','airbrush'].includes(b.type)) },
    { label: 'Special', labelZh: '特殊', brushes: BRUSHES.filter(b => ['blur','smear','blend','eraser'].includes(b.type)) },
  ]

  const sliderBtn = (onClick: () => void, label: string): React.CSSProperties => ({
    width: '24px', height: '24px', flexShrink: 0,
    border: '1px solid rgba(26,26,26,0.12)', borderRadius: '6px',
    background: 'transparent', color: '#888', cursor: 'pointer',
    fontFamily: 'Space Mono, monospace', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  })

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>

      {/* ── Shapes ─────────────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={labelStyle}>{t('Shapes','图形')}</span>
          {shapeType && <button onClick={() => setShapeType(null)} style={{ fontSize: '0.6rem', color: '#4a90d9', background: 'rgba(74,144,217,0.08)', border: '1px solid rgba(74,144,217,0.3)', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'Inter, DM Sans, sans-serif', letterSpacing: '0.06em', fontWeight: 600 }}>{t('✓ Back to brush','✓ 返回笔刷')}</button>}
        </div>
        {SHAPE_GROUPS.map(group => (
          <div key={group.label} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d0d0cb', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '5px' }}>{isZh ? group.labelZh : group.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
              {group.shapes.map(sh => (
                <button key={sh.type} onClick={() => setShapeType(shapeType === sh.type ? null : sh.type)}
                  style={{ ...chipBtn(shapeType === sh.type), flexDirection: 'column', padding: '7px 4px', gap: '3px', fontSize: '0.62rem', justifyContent: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1, fontFamily: 'monospace', color: shapeType === sh.type ? '#1a1a1a' : '#888' }}>{sh.icon}</span>
                  <span style={{ lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{isZh ? sh.labelZh : sh.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {shapeType && (
          <div style={{ marginTop: '10px', borderTop: '1px solid rgba(26,26,26,0.07)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ ...labelStyle, marginBottom: 0 }}>{t('Stroke','描边')}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#888' }}>{shapeStroke}px</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setShapeStroke(Math.max(1,shapeStroke-1))} style={sliderBtn(() => {},'')}>−</button>
                <input type="range" min={1} max={24} value={shapeStroke} onChange={e => setShapeStroke(Number(e.target.value))} style={{ flex: 1, accentColor: '#1a1a1a' }} />
                <button onClick={() => setShapeStroke(Math.min(24,shapeStroke+1))} style={sliderBtn(() => {},'')}>+</button>
              </div>
            </div>
            {shapeType !== 'line' && shapeType !== 'arrow' && shapeType !== 'bezier' && (
              <button onClick={() => setShapeFill(!shapeFill)}
                style={{ padding: '6px 10px', borderRadius: '7px', cursor: 'pointer', textAlign: 'left', border: `1px solid ${shapeFill?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.1)'}`, background: shapeFill?'rgba(26,26,26,0.07)':'transparent', color: shapeFill?'#1a1a1a':'#aaa', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.12s' }}>
                <span style={{ fontSize: '0.85rem' }}>{shapeFill?'▪':'▫'}</span>{t('Fill','填充')}
              </button>
            )}
            {(shapeType === 'polygon' || shapeType === 'star') && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span style={{ ...labelStyle, marginBottom: 0 }}>{shapeType==='star'?t('Points','角数'):t('Sides','边数')}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#888' }}>{shapeSides}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => setShapeSides(Math.max(3,shapeSides-1))} style={sliderBtn(() => {},'')}>−</button>
                  <input type="range" min={3} max={12} value={shapeSides} onChange={e => setShapeSides(Number(e.target.value))} style={{ flex: 1, accentColor: '#1a1a1a' }} />
                  <button onClick={() => setShapeSides(Math.min(12,shapeSides+1))} style={sliderBtn(() => {},'')}>+</button>
                </div>
              </div>
            )}
            <p style={{ fontSize: '0.6rem', color: '#b0b0ac', fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.5 }}>
              {t('Drag to draw · Shift = constrain','拖拽绘制 · Shift = 等比')}
            </p>
          </div>
        )}
      </div>

      {/* ── Brush selector ─────────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <span style={labelStyle}>{t('Brush','笔刷')}</span>
        {brushGroups.map(group => (
          <div key={group.label} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '0.52rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#d0d0cb', fontFamily: 'Inter, DM Sans, sans-serif', marginBottom: '5px' }}>{isZh ? group.labelZh : group.label}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '5px' }}>
              {group.brushes.map(b => (
                <button key={b.type}
                  onClick={() => {
                    setBrushType(b.type); setShapeType(null)
                    setSize(b.defaultSize); setAlpha(b.defaultAlpha)
                    setHardness(b.defaultHardness); setMixRate(b.defaultMixRate)
                    setDilution(b.defaultDilution ?? 0)
                    setPersistence(b.defaultPersistence ?? 0)
                  }}
                  style={{ ...chipBtn(brushType === b.type && shapeType === null), flexDirection: 'column', padding: '7px 4px', gap: '3px', fontSize: '0.62rem', justifyContent: 'center', textAlign: 'center' }}>
                  <span style={{ fontSize: '1rem', lineHeight: 1, fontFamily: 'monospace', color: brushType === b.type && shapeType === null ? '#1a1a1a' : '#888' }}>{b.icon}</span>
                  <span style={{ lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{isZh ? b.labelZh : b.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Color ──────────────────────────────────────────────────────────── */}
      {brushType !== 'eraser' && !isPixelBrush && (
        <div style={sectionStyle}>
          <span style={labelStyle}>{t('Color','颜色')}</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '5px', marginBottom: '8px' }}>
            {COLOR_PALETTE.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ aspectRatio: '1', borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', padding: 0, boxShadow: color===c?'0 0 0 2px #fff, 0 0 0 3.5px #1a1a1a':c==='#ffffff'?'0 0 0 1px rgba(26,26,26,0.15)':'0 0 0 1px rgba(26,26,26,0.06)', transform: color===c?'scale(1.15)':'scale(1)', transition: 'all 0.1s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>{t('Custom','自定义')}</span>
            <label style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, position: 'relative', boxShadow: `0 0 0 2px ${color}, 0 0 0 3px rgba(26,26,26,0.12)`, background: color }}>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </label>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', color: '#888' }}>{color}</span>
          </div>
        </div>
      )}

      {/* ── Size + Opacity + Hardness + Mix Rate ───────────────────────────── */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Size */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={labelStyle}>{t('Size','大小')}</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#888' }}>{size}px</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button onClick={() => setSize(Math.max(1,size-1))} style={sliderBtn(() => {},'')}>−</button>
              <input type="range" min={1} max={80} value={size} onChange={e => setSize(Number(e.target.value))} style={{ flex: 1, accentColor: '#1a1a1a' }} />
              <button onClick={() => setSize(Math.min(80,size+1))} style={sliderBtn(() => {},'')}>+</button>
            </div>
          </div>
          {/* Opacity */}
          {brushType !== 'eraser' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={labelStyle}>{t('Opacity','不透明度')}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#888' }}>{Math.round(alpha*100)}%</span>
              </div>
              <input type="range" min={5} max={100} value={Math.round(alpha*100)} onChange={e => setAlpha(Number(e.target.value)/100)} style={{ width: '100%', accentColor: '#1a1a1a' }} />
            </div>
          )}
          {/* Hardness */}
          {!isPixelBrush && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={labelStyle}>{t('Hardness','边缘硬度')}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#888' }}>{hardness}%</span>
              </div>
              <input type="range" min={0} max={100} value={hardness} onChange={e => setHardness(Number(e.target.value))} style={{ width: '100%', accentColor: '#1a1a1a' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Soft','柔和')}</span>
                <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Hard','硬边')}</span>
              </div>
            </div>
          )}
          {/* Mix Rate — watercolor / oilpaint only */}
          {isWetBrush && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={labelStyle}>{t('Mix Rate','混色率')}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#4a90d9' }}>{mixRate}%</span>
              </div>
              <input type="range" min={0} max={100} value={mixRate} onChange={e => setMixRate(Number(e.target.value))} style={{ width: '100%', accentColor: '#4a90d9' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Pure','纯色')}</span>
                <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Max blend','最大混色')}</span>
              </div>
              <p style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', lineHeight: 1.5, marginTop: '6px' }}>
                {isZh ? '混色率决定笔刷拾取画布颜色的比例，产生水彩/油画叠色感。' : 'Controls how much canvas color is picked up and blended, creating layered watercolor / oil paint feel.'}
              </p>
            </div>
          )}
          {/* Dilution + Persistence — watercolor / oilpaint / wetbrush only */}
          {isWetBrush && (
            <>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={labelStyle}>{t('Dilution','稀释度')}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#4a90d9' }}>{dilution}%</span>
                </div>
                <input type="range" min={0} max={100} value={dilution} onChange={e => setDilution(Number(e.target.value))} style={{ width: '100%', accentColor: '#4a90d9' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Full opacity','完全上色')}</span>
                  <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Thinner','稀释透明')}</span>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={labelStyle}>{t('Persistence','拖尾')}</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.62rem', color: '#4a90d9' }}>{persistence}%</span>
                </div>
                <input type="range" min={0} max={100} value={persistence} onChange={e => setPersistence(Number(e.target.value))} style={{ width: '100%', accentColor: '#4a90d9' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
                  <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('No trail','无拖尾')}</span>
                  <span style={{ fontSize: '0.5rem', color: '#ccc', fontFamily: 'Inter, sans-serif' }}>{t('Long trail','长拖尾')}</span>
                </div>
              </div>
            </>
          )}
          {/* Blur info */}
          {brushType === 'blur' && (
            <p style={{ fontSize: '0.58rem', color: '#b0b0ac', fontFamily: 'Inter, sans-serif', lineHeight: 1.5 }}>
              {isZh ? '真实局部高斯模糊：仅模糊笔刷圆内的像素，多次涂抹累积，与 SAI 模糊笔一致。' : 'Local gaussian blur: blurs only pixels inside the brush circle. Repeated strokes accumulate blur, matching SAI.'}
            </p>
          )}
        </div>
      </div>

      {/* ── Canvas controls ────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={labelStyle}>{t('Canvas','画布')}</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={undo} disabled={!canUndo} style={{ padding: '4px 9px', borderRadius: '6px', cursor: canUndo?'pointer':'default', border: '1px solid rgba(26,26,26,0.1)', background: 'transparent', color: canUndo?'#666':'#d0d0cc', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.1s' }}>↩ {t('Undo','撤销')}</button>
            <button onClick={clearCanvas} style={{ padding: '4px 9px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.1)', background: 'transparent', color: '#aaa', fontFamily: 'Space Mono, monospace', fontSize: '0.65rem', transition: 'all 0.1s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(220,80,60,0.3)'; e.currentTarget.style.color='#e05c5c' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(26,26,26,0.1)'; e.currentTarget.style.color='#aaa' }}>
              {t('Clear','清空')}
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
          {[{val:'transparent',label:t('Transparent','透明')},{val:'#ffffff',label:t('White','白底')},{val:'#1a1a1a',label:t('Black','黑底')}].map(opt => (
            <button key={opt.val} onClick={() => setBgColor(opt.val)}
              style={{ padding: '4px 9px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${bgColor===opt.val?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.1)'}`, background: bgColor===opt.val?'rgba(26,26,26,0.07)':'transparent', color: bgColor===opt.val?'#1a1a1a':'#aaa', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.65rem', transition: 'all 0.12s' }}>
              {opt.label}
            </button>
          ))}
        </div>
        {/* 笔刷状态指示条（替代原来的小 canvas 预览）*/}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(26,26,26,0.07)', background: 'rgba(26,26,26,0.02)' }}>
          <div style={{ position: 'relative', width: `${Math.min(size,32)}px`, height: `${Math.min(size,32)}px`, flexShrink: 0 }}>
            {brushType === 'eraser' ? (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '1.5px dashed #bbb' }} />
            ) : isPixelBrush ? (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: brushType==='blur'?'radial-gradient(circle, rgba(100,100,255,0.35) 0%, transparent 100%)':'radial-gradient(circle, rgba(255,150,50,0.35) 0%, transparent 100%)', border: `1px dashed ${brushType==='blur'?'rgba(100,100,255,0.4)':'rgba(255,150,50,0.4)'}` }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: (() => { const [rr,gg,bb]=hexToRgb(color); const inner=(hardness/100)*95; return `radial-gradient(circle, rgba(${rr},${gg},${bb},${alpha}) ${inner}%, rgba(${rr},${gg},${bb},0) 100%)` })(), transition: 'all 0.15s' }} />
            )}
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.6rem', color: '#b0b0ac' }}>
            {isZh ? currentBrush.labelZh : currentBrush.label}
            {' · '}{size}px
            {brushType !== 'eraser' ? ` · ${Math.round(alpha*100)}%` : ''}
            {!isPixelBrush ? ` · ${hardness}%` : ''}
            {isWetBrush ? ` · mix ${mixRate}%` : ''}
          </span>
        </div>
      </div>

      {/* ── Presets ──────────────────────────────────────────────────────────── */}
      <div style={{ ...sectionStyle, marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={labelStyle}>{t('Presets','笔刷预设')}</span>
          <button onClick={() => setSavingPreset(v => !v)} style={{ padding: '3px 9px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${savingPreset?'rgba(26,26,26,0.4)':'rgba(26,26,26,0.12)'}`, background: savingPreset?'rgba(26,26,26,0.07)':'transparent', color: savingPreset?'#1a1a1a':'#aaa', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.65rem', transition: 'all 0.12s' }}>
            {savingPreset ? t('Cancel','取消') : `+ ${t('Save current','保存当前')}`}
          </button>
        </div>
        {savingPreset && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <input type="text" value={presetName} onChange={e => setPresetName(e.target.value)} onKeyDown={e => { if(e.key==='Enter') addPreset() }}
              placeholder={t('Preset name…','预设名称…')} autoFocus
              style={{ flex: 1, padding: '6px 9px', border: '1px solid rgba(26,26,26,0.15)', borderRadius: '7px', background: '#fafaf8', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.75rem', color: '#1a1a1a', outline: 'none' }} />
            <button onClick={addPreset} style={{ padding: '6px 12px', borderRadius: '7px', cursor: 'pointer', border: 'none', background: '#1a1a1a', color: '#f7f7f5', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', flexShrink: 0 }}>{t('Save','保存')}</button>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {allPresets.map(p => {
            const isBuiltin = p.id.startsWith('b')
            const brushIcon = BRUSHES.find(b => b.type === p.brushType)?.icon ?? '✒'
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', border: '1px solid rgba(26,26,26,0.07)', background: 'rgba(26,26,26,0.02)', transition: 'background 0.1s' }}
                onClick={() => applyPreset(p)}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(26,26,26,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background='rgba(26,26,26,0.02)')}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', flexShrink: 0, background: p.brushType==='blur'?'radial-gradient(circle, rgba(100,100,255,0.35) 0%, transparent 100%)':p.brushType==='smear'?'radial-gradient(circle, rgba(255,150,50,0.35) 0%, transparent 100%)':(() => { const [rr,gg,bb]=hexToRgb(p.color); const inner=((p.hardness??100)/100)*95; return `radial-gradient(circle, rgba(${rr},${gg},${bb},${p.alpha}) ${inner}%, rgba(${rr},${gg},${bb},0) 100%)` })(), boxShadow: p.color==='#ffffff'?'0 0 0 1px rgba(26,26,26,0.2)':'0 0 0 1px rgba(26,26,26,0.08)' }} />
                <span style={{ fontSize: '0.8rem', lineHeight: 1, flexShrink: 0, fontFamily: 'monospace' }}>{brushIcon}</span>
                <span style={{ flex: 1, fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.72rem', color: '#3a3a3a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: '0.55rem', color: '#b0b0ac', flexShrink: 0 }}>{p.size}px</span>
                {!isBuiltin && (
                  <button onClick={e => { e.stopPropagation(); deletePreset(p.id) }}
                    style={{ width: '18px', height: '18px', flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: '#ccc', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', transition: 'all 0.1s', padding: 0 }}
                    onMouseEnter={e => { e.currentTarget.style.color='#e05c5c'; e.currentTarget.style.background='rgba(224,92,92,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.color='#ccc'; e.currentTarget.style.background='transparent' }}
                    title={t('Delete','删除')}>✕</button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <button onClick={exportToBlock}
        style={{ width: '100%', padding: '11px', background: '#1a1a1a', color: '#f7f7f5', border: 'none', borderRadius: '9px', fontFamily: 'Inter, DM Sans, sans-serif', fontSize: '0.82rem', letterSpacing: '0.08em', cursor: 'pointer', transition: 'opacity 0.12s' }}
        onMouseEnter={e => (e.currentTarget.style.opacity='0.85')}
        onMouseLeave={e => (e.currentTarget.style.opacity='1')}>
        {t('Add to Canvas →','插入画布 →')}
      </button>
      <p style={{ textAlign: 'center', fontSize: '0.6rem', color: '#ccc', fontFamily: 'Inter, DM Sans, sans-serif', marginTop: '8px', lineHeight: 1.5 }}>
        {t('Exports as PNG image block','导出为 PNG 图片 block')}
      </p>
    </div>
  )
}