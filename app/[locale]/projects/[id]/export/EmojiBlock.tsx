'use client'
// ─────────────────────────────────────────────────────────────────────────────
// EmojiBlock.tsx
// canvas 上可拖拽的 emoji 元素，复用 react-rnd
// ─────────────────────────────────────────────────────────────────────────────

import { useRef } from 'react'
import { Rnd } from 'react-rnd'
import { EmojiBlock as EmojiBlockType, ArrowDirection, SelectedEmojiId } from './types'
import DirectionalArrows from './DirectionalArrows'

const BLOCK_W = 56   // block 容器宽度
const BLOCK_H = 56   // block 容器高度

interface EmojiBlockProps {
  block: EmojiBlockType
  selected: boolean
  canvasScale: number   // 当前 canvas 缩放比例（immersive zoom 用）
  onSelect: (id: string) => void
  onDeselect: () => void
  onMove: (id: string, x: number, y: number) => void
  onArrowClick: (
    fromId: string,
    direction: ArrowDirection,
    anchorX: number,
    anchorY: number
  ) => void
}

export default function EmojiBlock({
  block,
  selected,
  canvasScale,
  onSelect,
  onDeselect,
  onMove,
  onArrowClick,
}: EmojiBlockProps) {
  const isDragging = useRef(false)

  // 防御：block 数据不完整时不渲染
  if (!block) {
    console.error('[EmojiBlock] block is undefined or null')
    return null
  }
  if (block.x === undefined || block.y === undefined) {
    console.error('[EmojiBlock] block.x or block.y is undefined', block)
    return null
  }

  return (
    <Rnd
      className="rnd-block"
      position={{ x: block.x, y: block.y }}
      size={{ width: BLOCK_W, height: BLOCK_H }}
      scale={canvasScale}
      enableResizing={false}
      onDragStart={() => { isDragging.current = true }}
      onDragStop={(_e, d) => {
        isDragging.current = false
        onMove(block.id, d.x, d.y)
      }}
      style={{ zIndex: selected ? 200 : 100 }}
    >
      {/* 选中时的四方向箭头 */}
      {selected && (
        <DirectionalArrows
          blockSize={BLOCK_W}
          onArrowClick={(dir, cx, cy) => onArrowClick(block.id, dir, cx, cy)}
        />
      )}

      {/* emoji 主体 */}
      <div
        data-emoji-block="true"
        onPointerDown={(e) => {
          e.stopPropagation()
          onSelect(block.id)
        }}
        style={{
          width: BLOCK_W,
          height: BLOCK_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: block.size,
          cursor: 'grab',
          borderRadius: 12,
          background: selected ? 'rgba(79,110,247,0.08)' : 'transparent',
          border: selected ? '2px solid #4f6ef7' : '2px solid transparent',
          transition: 'background 0.15s, border-color 0.15s',
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        {block.emoji}
      </div>
    </Rnd>
  )
}