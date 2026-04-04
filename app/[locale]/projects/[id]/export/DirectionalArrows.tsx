'use client'
// ─────────────────────────────────────────────────────────────────────────────
// DirectionalArrows.tsx
// 选中 EmojiBlock 时显示的四方向箭头，点击 → 触发生成新 emoji
// ─────────────────────────────────────────────────────────────────────────────

import { ArrowDirection } from './types'

interface DirectionalArrowsProps {
  /** 当前 emoji block 的宽高（px），用于计算箭头位置 */
  blockSize: number
  /** 父容器已经是 position:relative，箭头用 absolute 定位 */
  onArrowClick: (direction: ArrowDirection, anchorX: number, anchorY: number) => void
}

const ARROW_SIZE = 24   // 箭头按钮直径 px
const ARROW_GAP  = 10   // 距离 block 边缘的间距 px

// 每个方向的样式：偏移量相对于 block 中心
function getArrowStyle(
  direction: ArrowDirection,
  blockSize: number
): React.CSSProperties {
  const half = blockSize / 2
  const offset = half + ARROW_GAP + ARROW_SIZE / 2

  const base: React.CSSProperties = {
    position: 'absolute',
    width: ARROW_SIZE,
    height: ARROW_SIZE,
    borderRadius: '50%',
    background: '#fff',
    border: '1.5px solid #d1d5db',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.12s, box-shadow 0.12s, background 0.12s',
    fontSize: 11,
    color: '#6b7280',
    userSelect: 'none',
    zIndex: 10,
  }

  // 以 block 中心为原点
  const center = blockSize / 2
  const arrowHalf = ARROW_SIZE / 2

  switch (direction) {
    case 'top':
      return { ...base, top: -(ARROW_GAP + ARROW_SIZE), left: center - arrowHalf }
    case 'bottom':
      return { ...base, bottom: -(ARROW_GAP + ARROW_SIZE), left: center - arrowHalf }
    case 'left':
      return { ...base, left: -(ARROW_GAP + ARROW_SIZE), top: center - arrowHalf }
    case 'right':
      return { ...base, right: -(ARROW_GAP + ARROW_SIZE), top: center - arrowHalf }
  }
}

const ARROW_ICONS: Record<ArrowDirection, string> = {
  top: '↑',
  right: '→',
  bottom: '↓',
  left: '←',
}

export default function DirectionalArrows({
  blockSize,
  onArrowClick,
}: DirectionalArrowsProps) {
  const directions: ArrowDirection[] = ['top', 'right', 'bottom', 'left']

  function handleClick(
    e: React.MouseEvent<HTMLButtonElement>,
    direction: ArrowDirection
  ) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    onArrowClick(direction, cx, cy)
  }

  return (
    <>
      {directions.map((dir) => (
        <button
          key={dir}
          style={getArrowStyle(dir, blockSize)}
          onMouseEnter={(e) => {
            const el = e.currentTarget
            el.style.background = '#4f6ef7'
            el.style.borderColor = '#4f6ef7'
            el.style.color = '#fff'
            el.style.transform = 'scale(1.15)'
            el.style.boxShadow = '0 4px 12px rgba(79,110,247,0.35)'
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget
            el.style.background = '#fff'
            el.style.borderColor = '#d1d5db'
            el.style.color = '#6b7280'
            el.style.transform = 'scale(1)'
            el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
          }}
          onClick={(e) => handleClick(e, dir)}
          title={`在${dir === 'top' ? '上' : dir === 'bottom' ? '下' : dir === 'left' ? '左' : '右'}方添加 emoji`}
        >
          {ARROW_ICONS[dir]}
        </button>
      ))}
    </>
  )
}
