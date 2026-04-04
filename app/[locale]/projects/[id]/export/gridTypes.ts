// ─── Grid System Types ────────────────────────────────────────────────────────

export type GridType = 'column' | 'baseline' | 'modular'

// ─── Column Grid ─────────────────────────────────────────────────────────────
export interface ColumnGridConfig {
  type: 'column'
  columns: number        // 列数，例如 12
  gutter: number         // 列间距 px
  margin: number         // 左右页边距 px
  color: string          // 网格线颜色（含 alpha）
  strokeWidth: number    // 线条粗细
  visible: boolean
}

// ─── Baseline Grid ────────────────────────────────────────────────────────────
export interface BaselineGridConfig {
  type: 'baseline'
  lineHeight: number     // 基线间距 px，例如 8
  color: string
  strokeWidth: number
  visible: boolean
}

// ─── Modular Grid ─────────────────────────────────────────────────────────────
export interface ModularGridConfig {
  type: 'modular'
  columns: number        // 列数
  rows: number           // 行数
  columnGutter: number   // 列间距 px
  rowGutter: number      // 行间距 px
  margin: number         // 页边距 px
  color: string
  strokeWidth: number
  visible: boolean
  cellTexts?: string[]                        // 每个格子的文字，index = row*columns+col
  cellAligns?: ('left' | 'center' | 'right')[] // 每个格子的对齐方式
  cellFontSize?: number                       // 格子字号 px
  cellColor?: string                          // 格子文字颜色
  offsetX?: number                            // 整体水平偏移 px
  offsetY?: number                            // 整体垂直偏移 px
}

export type GridConfig =
  | ColumnGridConfig
  | BaselineGridConfig
  | ModularGridConfig

// ─── Grid System State ────────────────────────────────────────────────────────
export interface GridSystemState {
  activeType: GridType | null   // null = 关闭
  column: ColumnGridConfig
  baseline: BaselineGridConfig
  modular: ModularGridConfig
}

export const DEFAULT_GRID_STATE: GridSystemState = {
  activeType: null,
  column: {
    type: 'column',
    columns: 12,
    gutter: 16,
    margin: 32,
    color: 'rgba(99,102,241,0.15)',
    strokeWidth: 0.5,
    visible: true,
  },
  baseline: {
    type: 'baseline',
    lineHeight: 8,
    color: 'rgba(16,185,129,0.2)',
    strokeWidth: 0.75,
    visible: true,
  },
  modular: {
    type: 'modular',
    columns: 6,
    rows: 8,
    columnGutter: 12,
    rowGutter: 12,
    margin: 24,
    color: 'rgba(245,158,11,0.15)',
    strokeWidth: 0.5,
    visible: true,
  },
}