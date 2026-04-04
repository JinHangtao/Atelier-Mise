// ─────────────────────────────────────────────────────────────────────────────
// Export Editor — 共享类型
// 放在 page.tsx 同级目录，例如：
//   app/[locale]/projects/[id]/export/types.ts
// ─────────────────────────────────────────────────────────────────────────────

import { Block } from '../../../../../lib/exportStyles'

export type BlockType =
  | 'title'
  | 'image'
  | 'image-row'
  | 'note'
  | 'custom'
  | 'milestone'
  | 'school-profile'
  | 'sticky'
  | 'table'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export type Aspect = '16:9' | 'A4' | '1:1' | '4:3' | 'free'

/** A single page in the book. Every page owns its own Block[]. */
export type Page = {
  id: string
  label: string      // display name, e.g. "Cover", "Page 2"
  aspect: Aspect     // canvas dimensions rule
  isCover?: boolean  // cover page gets special editor
  background?: string // page background color, defaults to #ffffff
  backgroundImage?: string // optional background image URL
  bgSize?: string          // CSS background-size, e.g. 'cover' | 'contain'
  bgPosition?: string      // CSS background-position, e.g. 'center'
  blocks: Block[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Emoji Block — canvas 上可拖拽的 emoji 元素
// ─────────────────────────────────────────────────────────────────────────────

export type ArrowDirection = 'top' | 'right' | 'bottom' | 'left'

export type EmojiBlock = {
  id: string
  pageId: string
  emoji: string
  x: number
  y: number
  size: number
  fromId?: string
  fromDirection?: ArrowDirection
}

export type SelectedEmojiId = string | null

export type EmojiPickerTrigger =
  | { type: 'toolbar' }
  | { type: 'arrow'; fromId: string; direction: ArrowDirection }