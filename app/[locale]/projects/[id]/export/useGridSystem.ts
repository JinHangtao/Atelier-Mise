import { useCallback, useReducer } from 'react'
import {
  GridSystemState,
  GridType,
  ColumnGridConfig,
  BaselineGridConfig,
  ModularGridConfig,
  DEFAULT_GRID_STATE,
} from './gridTypes'

type GridAction =
  | { type: 'SET_ACTIVE'; payload: GridType | null }
  | { type: 'UPDATE_COLUMN'; payload: Partial<ColumnGridConfig> }
  | { type: 'UPDATE_BASELINE'; payload: Partial<BaselineGridConfig> }
  | { type: 'UPDATE_MODULAR'; payload: Partial<ModularGridConfig> }
  | { type: 'UPDATE_MODULAR_CELL'; payload: { index: number; text: string; align?: 'left' | 'center' | 'right' } }
  | { type: 'RESET' }

function gridReducer(state: GridSystemState, action: GridAction): GridSystemState {
  switch (action.type) {
    case 'SET_ACTIVE':
      return { ...state, activeType: action.payload }
    case 'UPDATE_COLUMN':
      return { ...state, column: { ...state.column, ...action.payload } }
    case 'UPDATE_BASELINE':
      return { ...state, baseline: { ...state.baseline, ...action.payload } }
    case 'UPDATE_MODULAR':
      return { ...state, modular: { ...state.modular, ...action.payload } }
    case 'UPDATE_MODULAR_CELL': {
      const texts = [...(state.modular.cellTexts ?? [])]
      const aligns = [...(state.modular.cellAligns ?? [])]
      texts[action.payload.index] = action.payload.text
      if (action.payload.align !== undefined) aligns[action.payload.index] = action.payload.align
      return { ...state, modular: { ...state.modular, cellTexts: texts, cellAligns: aligns } }
    }
    case 'RESET':
      return DEFAULT_GRID_STATE
    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGridSystem() {
  const [state, dispatch] = useReducer(gridReducer, DEFAULT_GRID_STATE)

  /** 切换网格类型；再次点击同类型则关闭 */
  const setActiveGrid = useCallback((type: GridType) => {
    dispatch({
      type: 'SET_ACTIVE',
      payload: state.activeType === type ? null : type,
    })
  }, [state.activeType])

  /** 完全关闭网格 */
  const hideGrid = useCallback(() => {
    dispatch({ type: 'SET_ACTIVE', payload: null })
  }, [])

  const updateColumn = useCallback((patch: Partial<ColumnGridConfig>) => {
    dispatch({ type: 'UPDATE_COLUMN', payload: patch })
  }, [])

  const updateBaseline = useCallback((patch: Partial<BaselineGridConfig>) => {
    dispatch({ type: 'UPDATE_BASELINE', payload: patch })
  }, [])

  const updateModular = useCallback((patch: Partial<ModularGridConfig>) => {
    dispatch({ type: 'UPDATE_MODULAR', payload: patch })
  }, [])

  const updateModularCell = useCallback((index: number, text: string, align?: 'left' | 'center' | 'right') => {
    dispatch({ type: 'UPDATE_MODULAR_CELL', payload: { index, text, align } })
  }, [])

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    gridState: state,
    setActiveGrid,
    hideGrid,
    updateColumn,
    updateBaseline,
    updateModular,
    updateModularCell,
    reset,
  }
}

export type UseGridSystemReturn = ReturnType<typeof useGridSystem>