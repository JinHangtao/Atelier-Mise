// ─────────────────────────────────────────────────────────────────────────────
// useEmojiPicker.ts
// 管理 EmojiPickerPanel 的显示/隐藏、位置、触发来源
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useState } from 'react'
import { EmojiPickerTrigger } from './types'

export type EmojiPickerState = {
  open: boolean
  x: number   // picker 面板左上角屏幕坐标
  y: number
  trigger: EmojiPickerTrigger | null
}

const INITIAL: EmojiPickerState = {
  open: false,
  x: 0,
  y: 0,
  trigger: null,
}

export function useEmojiPicker() {
  const [state, setState] = useState<EmojiPickerState>(INITIAL)

  /** 工具栏按钮点击，在按钮附近弹出 */
  const openFromToolbar = useCallback((anchorRect: DOMRect) => {
    const PANEL_W = 352
    const PANEL_H = 435
    const OFFSET = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 优先往左弹（RightPanel 在最右边）
    let x = anchorRect.left - PANEL_W - OFFSET
    let y = anchorRect.top

    // 如果左边放不下，才往右
    if (x < 8) x = anchorRect.right + OFFSET

    // 垂直方向不超出视口底部
    if (y + PANEL_H > vh - 8) y = vh - PANEL_H - 8
    if (y < 8) y = 8

    setState({
      open: true,
      x,
      y,
      trigger: { type: 'toolbar' },
    })
  }, [])

  /**
   * 箭头点击触发，面板紧贴箭头出现
   * anchorX/Y 是箭头按钮在屏幕上的中心点坐标
   */
  const openFromArrow = useCallback(
    (
      anchorX: number,
      anchorY: number,
      fromId: string,
      direction: 'top' | 'right' | 'bottom' | 'left'
    ) => {
      // 根据方向把面板偏移到箭头外侧
      const OFFSET = 12
      const PANEL_W = 352
      const PANEL_H = 400

      let x = anchorX
      let y = anchorY

      if (direction === 'right')  { x = anchorX + OFFSET; y = anchorY - PANEL_H / 2 }
      if (direction === 'left')   { x = anchorX - PANEL_W - OFFSET; y = anchorY - PANEL_H / 2 }
      if (direction === 'bottom') { x = anchorX - PANEL_W / 2; y = anchorY + OFFSET }
      if (direction === 'top')    { x = anchorX - PANEL_W / 2; y = anchorY - PANEL_H - OFFSET }

      setState({
        open: true,
        x,
        y,
        trigger: { type: 'arrow', fromId, direction },
      })
    },
    []
  )

  const close = useCallback(() => setState(INITIAL), [])

  return { state, openFromToolbar, openFromArrow, close }
}