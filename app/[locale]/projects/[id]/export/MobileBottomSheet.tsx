'use client'
import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
interface Block {
  id: string
  type: string
  content?: string
  images?: string[]
  pixelPos?: { x: number; y: number; w: number; h: number } | null
  [key: string]: any
}

interface MobileBottomSheetProps {
  block: Block | null
  isZh: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onBringForward: (id: string) => void
  onSendBackward: (id: string) => void
  onBringToFront: (id: string) => void
  onSendToBack: (id: string) => void
  onReplaceImage?: (id: string) => void
  onEditImage?: (id: string) => void
  onStartEdit?: (block: Block) => void
  onRemoveBg?: (id: string, content: string) => void
}

// ── MobileBottomSheet ──────────────────────────────────────────────────────
export function MobileBottomSheet({
  block,
  isZh,
  onClose,
  onDelete,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onReplaceImage,
  onEditImage,
  onStartEdit,
  onRemoveBg,
}: MobileBottomSheetProps) {
  const isVisible = !!block
  const dragRef = React.useRef<{ startY: number; currentY: number } | null>(null)
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const [dragOffset, setDragOffset] = React.useState(0)

  // Reset drag offset when block changes
  React.useEffect(() => {
    setDragOffset(0)
  }, [block?.id])

  // Close on backdrop tap
  const handleBackdrop = (e: React.TouchEvent | React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  // Drag-to-dismiss handle
  const onHandleTouchStart = (e: React.TouchEvent) => {
    dragRef.current = { startY: e.touches[0].clientY, currentY: e.touches[0].clientY }
  }
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current) return
    const dy = e.touches[0].clientY - dragRef.current.startY
    if (dy > 0) setDragOffset(dy)
  }
  const onHandleTouchEnd = () => {
    if (dragOffset > 80) {
      onClose()
    } else {
      setDragOffset(0)
    }
    dragRef.current = null
  }

  const blockTypeLabel = (type: string) => {
    const map: Record<string, [string, string]> = {
      image: ['🖼', isZh ? '图片' : 'Image'],
      title: ['✦', isZh ? '标题' : 'Title'],
      note: ['✎', isZh ? '文字' : 'Text'],
      custom: ['⊞', isZh ? '自定义' : 'Custom'],
      sticky: ['📝', isZh ? '便利贴' : 'Sticky'],
      table: ['⊟', isZh ? '表格' : 'Table'],
      'image-row': ['🖼', isZh ? '图片组' : 'Image Row'],
      milestone: ['◎', isZh ? '进度' : 'Milestone'],
    }
    return map[type] ?? ['◻', type]
  }

  const isTextBlock = block && ['title', 'note', 'custom', 'milestone'].includes(block.type)
  const isImageBlock = block?.type === 'image' || block?.type === 'image-row'

  if (!block) return null

  const [typeIcon, typeLabel] = blockTypeLabel(block.type)

  // Row button component
  const Row = ({
    icon, label, sub, onClick, danger, disabled,
  }: {
    icon: string; label: string; sub?: string
    onClick: () => void; danger?: boolean; disabled?: boolean
  }) => (
    <button
      onClick={() => { if (!disabled) { onClick(); onClose() } }}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 20px', border: 'none', background: 'transparent',
        textAlign: 'left', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.1s',
        borderRadius: 0,
      }}
      onTouchStart={e => { if (!disabled) (e.currentTarget.style.background = danger ? 'rgba(220,60,60,0.06)' : 'rgba(26,26,26,0.04)') }}
      onTouchEnd={e => { (e.currentTarget.style.background = 'transparent') }}
    >
      <span style={{
        fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0,
        color: danger ? '#dc3c3c' : '#444',
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.9rem', fontWeight: 500, color: danger ? '#c03030' : '#1a1a1a',
          fontFamily: 'Inter, DM Sans, sans-serif',
        }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  )

  const Divider = () => (
    <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '4px 0' }} />
  )

  const sheetTransform = isVisible
    ? `translateY(${dragOffset}px)`
    : 'translateY(100%)'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: isVisible ? 'rgba(0,0,0,0.3)' : 'transparent',
          backdropFilter: isVisible ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: isVisible ? 'blur(2px)' : 'none',
          transition: 'background 0.28s ease, backdrop-filter 0.28s ease',
          pointerEvents: isVisible ? 'auto' : 'none',
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1201,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
          transform: sheetTransform,
          transition: dragRef.current ? 'none' : 'transform 0.36s cubic-bezier(0.34,1.05,0.64,1)',
          maxHeight: '82vh',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Drag handle */}
        <div
          style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center', flexShrink: 0, cursor: 'grab' }}
          onTouchStart={onHandleTouchStart}
          onTouchMove={onHandleTouchMove}
          onTouchEnd={onHandleTouchEnd}
        >
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(26,26,26,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px', flexShrink: 0,
          borderBottom: '1px solid rgba(26,26,26,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{typeIcon}</span>
            <div>
              <div style={{
                fontSize: '0.88rem', fontWeight: 700, color: '#1a1a1a',
                fontFamily: 'Inter, DM Sans, sans-serif',
              }}>{typeLabel}</div>
              {block.content && (
                <div style={{
                  fontSize: '0.68rem', color: '#aaa', marginTop: 1,
                  maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{block.content}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(26,26,26,0.07)', border: 'none',
              fontSize: 16, color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Actions */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Image-specific */}
          {isImageBlock && onReplaceImage && (
            <>
              <Row icon="🔄" label={isZh ? '替换图片' : 'Replace image'} sub={isZh ? '从相册或文件选择' : 'From photos or files'} onClick={() => onReplaceImage(block.id)} />
              {onEditImage && <Row icon="✂️" label={isZh ? '编辑图片' : 'Edit image'} sub={isZh ? '裁剪 · 滤镜' : 'Crop · Filters'} onClick={() => onEditImage(block.id)} />}
              {onRemoveBg && <Row icon="⊡" label={isZh ? 'AI 智能抠图' : 'Remove background'} sub={isZh ? 'AI 去除背景' : 'AI-powered'} onClick={() => onRemoveBg(block.id, block.content || '')} />}
              <Divider />
            </>
          )}

          {/* Text edit */}
          {isTextBlock && onStartEdit && (
            <>
              <Row icon="✏️" label={isZh ? '编辑内容' : 'Edit text'} sub={isZh ? '点击进入编辑模式' : 'Enter edit mode'} onClick={() => onStartEdit(block)} />
              <Divider />
            </>
          )}

          {/* Universal */}
          <Row icon="⎘" label={isZh ? '复制元素' : 'Duplicate'} onClick={() => onDuplicate(block.id)} />

          <Divider />

          {/* Layer controls */}
          <div style={{ padding: '8px 20px 4px' }}>
            <div style={{ fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c4c4c0', fontWeight: 600, marginBottom: 4 }}>
              {isZh ? '层级' : 'Layer order'}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* 2-col grid for layer ops */}
            {[
              { icon: '⇑', label: isZh ? '置顶' : 'To front', onClick: () => onBringToFront(block.id) },
              { icon: '↑', label: isZh ? '上移' : 'Forward', onClick: () => onBringForward(block.id) },
              { icon: '↓', label: isZh ? '下移' : 'Backward', onClick: () => onSendBackward(block.id) },
              { icon: '⇓', label: isZh ? '置底' : 'To back', onClick: () => onSendToBack(block.id) },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); onClose() }}
                style={{
                  padding: '13px 0', border: 'none', background: 'transparent',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                  borderTop: '1px solid rgba(26,26,26,0.05)',
                }}
                onTouchStart={e => { (e.currentTarget.style.background = 'rgba(26,26,26,0.04)') }}
                onTouchEnd={e => { (e.currentTarget.style.background = 'transparent') }}
              >
                <span style={{ fontSize: 18, color: '#555' }}>{item.icon}</span>
                <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif' }}>{item.label}</span>
              </button>
            ))}
          </div>

          <Divider />

          {/* Delete */}
          <Row
            icon="🗑"
            label={isZh ? '删除' : 'Delete'}
            sub={isZh ? '此操作不可撤销' : 'Cannot be undone'}
            onClick={() => onDelete(block.id)}
            danger
          />

          {/* Safe area spacer */}
          <div style={{ height: 8 }} />
        </div>
      </div>
    </>
  )
}

// ── MobileBottomBar ────────────────────────────────────────────────────────
// 固定在画布底部的小工具条：zoom控制 + 页码
interface MobileBottomBarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  currentPage: number
  totalPages: number
  isZh: boolean
}

export function MobileBottomBar({
  zoom, onZoomIn, onZoomOut, onZoomFit,
  currentPage, totalPages, isZh,
}: MobileBottomBarProps) {
  const Btn = ({ label, onPress, wide }: { label: string; onPress: () => void; wide?: boolean }) => (
    <button
      onClick={onPress}
      style={{
        height: 36, minWidth: wide ? 64 : 36, padding: '0 10px',
        borderRadius: 10, border: '1px solid rgba(26,26,26,0.12)',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
        fontSize: wide ? '0.7rem' : '1rem', color: '#444', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Space Mono, monospace',
        WebkitTapHighlightColor: 'transparent',
      }}
      onTouchStart={e => { (e.currentTarget.style.background = 'rgba(26,26,26,0.08)') }}
      onTouchEnd={e => { (e.currentTarget.style.background = 'rgba(255,255,255,0.85)') }}
    >
      {label}
    </button>
  )

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      zIndex: 900,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 16px',
      paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      background: 'rgba(247,247,245,0.88)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderTop: '1px solid rgba(26,26,26,0.08)',
    }}>
      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Btn label="−" onPress={onZoomOut} />
        <Btn label={`${Math.round(zoom * 100)}%`} onPress={onZoomFit} wide />
        <Btn label="+" onPress={onZoomIn} />
      </div>

      {/* Page indicator */}
      <div style={{
        fontSize: '0.7rem', color: '#888',
        fontFamily: 'Space Mono, monospace',
        letterSpacing: '0.05em',
      }}>
        {isZh ? `第 ${currentPage} / ${totalPages} 页` : `${currentPage} / ${totalPages}`}
      </div>
    </div>
  )
}
