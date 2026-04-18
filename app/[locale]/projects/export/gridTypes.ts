// ─── Grid System Types ─────────────────────────────────────────────────────
// Each page can have multiple independent grid layers.
// A GridLayer is one overlay unit: column / baseline / table.

export type GridLayerType = 'column' | 'baseline' | 'table'

// ─── Per-layer configs ────────────────────────────────────────────────────

export interface ColumnLayer {
  id: string
  type: 'column'
  visible: boolean
  columns: number
  gutter: number
  margin: number
  color: string
  strokeWidth: number
  // ── drag / resize ──────────────────────────────────────────────
  /** 整体平移 X（canvas 逻辑 px） */
  offsetX: number
  /** 整体平移 Y（canvas 逻辑 px） */
  offsetY: number
  /**
   * 每列宽度占比（长度 === columns，总和为 1）。
   * 缺省 = 等分。拖动列线后写入。
   */
  colWidths?: number[]
  /** 整体缩放比例（相对画布宽高），缺省 1 */
  scaleX?: number
  scaleY?: number
}

export interface BaselineLayer {
  id: string
  type: 'baseline'
  visible: boolean
  lineHeight: number
  color: string
  strokeWidth: number
  // ── drag ──────────────────────────────────────────────────────
  offsetX: number
  offsetY: number
  /** 整体缩放比例（相对画布宽高），缺省 1 */
  scaleX?: number
  scaleY?: number
}

export interface TableLayer {
  id: string
  type: 'table'
  visible: boolean
  rows: number
  columns: number
  color: string
  strokeWidth: number
  showHeader: boolean
  // ── drag / resize ──────────────────────────────────────────────
  offsetX: number
  offsetY: number
  /** 每列宽度占比，总和为 1，缺省等分 */
  colWidths?: number[]
  /** 每行高度占比，总和为 1，缺省等分 */
  rowHeights?: number[]
  /** 整体缩放比例（相对画布宽高），缺省 1 */
  scaleX?: number
  scaleY?: number
  /** 格子文字，key = "row_col"（0-indexed） */
  cellTexts?: Record<string, string>
}

export type GridLayer = ColumnLayer | BaselineLayer | TableLayer

// ─── Per-page grid state ──────────────────────────────────────────────────

export interface GridSystemState {
  /** pageId → layers */
  pages: Record<string, GridLayer[]>
  /** which layer is being configured in the panel */
  editingLayerId: string | null
  /** which type card is selected for "add new" */
  draftType: GridLayerType
}

// ─── Defaults ────────────────────────────────────────────────────────────

export function defaultColumnLayer(id: string): ColumnLayer {
  return {
    id, type: 'column', visible: true,
    columns: 12, gutter: 16, margin: 32,
    color: 'rgba(99,102,241,0.15)', strokeWidth: 0.5,
    offsetX: 0, offsetY: 0,
  }
}

export function defaultBaselineLayer(id: string): BaselineLayer {
  return {
    id, type: 'baseline', visible: true,
    lineHeight: 8,
    color: 'rgba(16,185,129,0.2)', strokeWidth: 0.75,
    offsetX: 0, offsetY: 0,
  }
}

export function defaultTableLayer(id: string): TableLayer {
  return {
    id, type: 'table', visible: true,
    rows: 3, columns: 3,
    color: 'rgba(99,102,241,0.25)', strokeWidth: 1,
    showHeader: true,
    offsetX: 0, offsetY: 0,
  }
}

export function makeDefaultLayer(type: GridLayerType, id: string): GridLayer {
  if (type === 'column')   return defaultColumnLayer(id)
  if (type === 'baseline') return defaultBaselineLayer(id)
  return defaultTableLayer(id)
}

export const DEFAULT_GRID_STATE: GridSystemState = {
  pages: {},
  editingLayerId: null,
  draftType: 'column',
}