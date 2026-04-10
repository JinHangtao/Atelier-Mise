import { useCallback, useReducer } from 'react'
import {
  GridSystemState,
  GridLayer,
  GridLayerType,
  DEFAULT_GRID_STATE,
  makeDefaultLayer,
} from './gridTypes'

// ─── Tiny ID generator ────────────────────────────────────────────────────
let _seq = 0
function genId() { return `gl_${Date.now()}_${++_seq}` }

// ─── Actions ─────────────────────────────────────────────────────────────

type GridAction =
  | { type: 'ADD_LAYER';    pageId: string; layerType: GridLayerType }
  | { type: 'REMOVE_LAYER'; pageId: string; layerId: string }
  | { type: 'UPDATE_LAYER'; pageId: string; layerId: string; patch: Partial<GridLayer> }
  | { type: 'TOGGLE_LAYER'; pageId: string; layerId: string }
  | { type: 'REORDER_LAYERS'; pageId: string; layers: GridLayer[] }
  | { type: 'CLEAR_PAGE';   pageId: string }
  | { type: 'SET_EDITING';  layerId: string | null }
  | { type: 'SET_DRAFT_TYPE'; draftType: GridLayerType }
  | { type: 'RESET' }

// ─── Reducer ─────────────────────────────────────────────────────────────

function getPageLayers(state: GridSystemState, pageId: string): GridLayer[] {
  return state.pages[pageId] ?? []
}

function gridReducer(state: GridSystemState, action: GridAction): GridSystemState {
  switch (action.type) {

    case 'ADD_LAYER': {
      const id = genId()
      const newLayer = makeDefaultLayer(action.layerType, id)
      const existing = getPageLayers(state, action.pageId)
      return {
        ...state,
        pages: {
          ...state.pages,
          [action.pageId]: [...existing, newLayer],
        },
        editingLayerId: id,
      }
    }

    case 'REMOVE_LAYER': {
      const layers = getPageLayers(state, action.pageId).filter(l => l.id !== action.layerId)
      const editingLayerId = state.editingLayerId === action.layerId ? null : state.editingLayerId
      return {
        ...state,
        pages: { ...state.pages, [action.pageId]: layers },
        editingLayerId,
      }
    }

    case 'UPDATE_LAYER': {
      const layers = getPageLayers(state, action.pageId).map(l =>
        l.id === action.layerId ? { ...l, ...action.patch } as GridLayer : l
      )
      return {
        ...state,
        pages: { ...state.pages, [action.pageId]: layers },
      }
    }

    case 'TOGGLE_LAYER': {
      const layers = getPageLayers(state, action.pageId).map(l =>
        l.id === action.layerId ? { ...l, visible: !l.visible } : l
      )
      return {
        ...state,
        pages: { ...state.pages, [action.pageId]: layers },
      }
    }

    case 'REORDER_LAYERS': {
      return {
        ...state,
        pages: { ...state.pages, [action.pageId]: action.layers },
      }
    }

    case 'CLEAR_PAGE': {
      const { [action.pageId]: _, ...rest } = state.pages
      return { ...state, pages: rest, editingLayerId: null }
    }

    case 'SET_EDITING':
      return { ...state, editingLayerId: action.layerId }

    case 'SET_DRAFT_TYPE':
      return { ...state, draftType: action.draftType }

    case 'RESET':
      return DEFAULT_GRID_STATE

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useGridSystem() {
  const [state, dispatch] = useReducer(gridReducer, DEFAULT_GRID_STATE)

  const addLayer = useCallback((pageId: string, layerType: GridLayerType) => {
    dispatch({ type: 'ADD_LAYER', pageId, layerType })
  }, [])

  const removeLayer = useCallback((pageId: string, layerId: string) => {
    dispatch({ type: 'REMOVE_LAYER', pageId, layerId })
  }, [])

  const updateLayer = useCallback((pageId: string, layerId: string, patch: Partial<GridLayer>) => {
    dispatch({ type: 'UPDATE_LAYER', pageId, layerId, patch })
  }, [])

  const toggleLayer = useCallback((pageId: string, layerId: string) => {
    dispatch({ type: 'TOGGLE_LAYER', pageId, layerId })
  }, [])

  const reorderLayers = useCallback((pageId: string, layers: GridLayer[]) => {
    dispatch({ type: 'REORDER_LAYERS', pageId, layers })
  }, [])

  const clearPage = useCallback((pageId: string) => {
    dispatch({ type: 'CLEAR_PAGE', pageId })
  }, [])

  const setEditingLayer = useCallback((layerId: string | null) => {
    dispatch({ type: 'SET_EDITING', layerId })
  }, [])

  const setDraftType = useCallback((draftType: GridLayerType) => {
    dispatch({ type: 'SET_DRAFT_TYPE', draftType })
  }, [])

  const getPageLayers = useCallback((pageId: string): GridLayer[] => {
    return state.pages[pageId] ?? []
  }, [state.pages])

  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  return {
    gridState: state,
    addLayer,
    removeLayer,
    updateLayer,
    toggleLayer,
    reorderLayers,
    clearPage,
    setEditingLayer,
    setDraftType,
    getPageLayers,
    reset,
  }
}

export type UseGridSystemReturn = ReturnType<typeof useGridSystem>