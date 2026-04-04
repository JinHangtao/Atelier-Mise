'use client'
// ─────────────────────────────────────────────────────────────────────────────
// EmojiPickerPanel.tsx
// 浮动 emoji 选择面板，使用 emoji-mart
// dynamic import 避免 Next.js SSR 下 HTMLElement 报错
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { EmojiPickerState } from './useEmojiPicker'

interface EmojiPickerPanelProps {
  state: EmojiPickerState
  onSelect: (emoji: string) => void
  onClose: () => void
}

let PickerComponent: any = null

export default function EmojiPickerPanel({
  state,
  onSelect,
  onClose,
}: EmojiPickerPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [pickerReady, setPickerReady] = useState(false)

  useEffect(() => {
    if (!state.open) return
    if (PickerComponent) { setPickerReady(true); return }
    Promise.all([
      import('@emoji-mart/react'),
      import('@emoji-mart/data'),
    ]).then(([mod, dataMod]) => {
      PickerComponent = { Picker: mod.default, data: dataMod.default }
      setPickerReady(true)
    })
  }, [state.open])

  useEffect(() => {
    if (!state.open) return
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node
      // 点击 emoji block 本身（拖动）不关闭 picker
      if ((e.target as HTMLElement).closest?.('[data-emoji-block]')) return
      if (panelRef.current && !panelRef.current.contains(target)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [state.open, onClose])

  if (!state.open) return null

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        zIndex: 9999,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 1.5px 4px rgba(0,0,0,0.08)',
      }}
    >
      {!pickerReady || !PickerComponent ? (
        <div style={{
          width: 352, height: 80, background: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.75rem', color: '#bbb', fontFamily: 'Inter, sans-serif',
        }}>
          Loading…
        </div>
      ) : (
        <PickerComponent.Picker
          data={PickerComponent.data}
          onEmojiSelect={(em: { native: string }) => {
            onSelect(em.native)
            onClose()
          }}
          theme="light"
          set="native"
          skinTonePosition="none"
          previewPosition="none"
          searchPosition="sticky"
          navPosition="top"
          perLine={9}
          emojiSize={28}
          emojiButtonSize={36}
        />
      )}
    </div>
  )
}