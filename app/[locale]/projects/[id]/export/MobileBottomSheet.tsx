'use client'
import React from 'react'

// ── Types ──────────────────────────────────────────────────────────────────
interface Block {
  id: string
  type: string
  content?: string
  images?: string[]
  pixelPos?: { x: number; y: number; w: number; h: number } | null
  fontSize?: number
  fontWeight?: string
  fontStyle?: string
  color?: string
  align?: string
  opacity?: number
  borderRadius?: number
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
  onPatchBlock?: (id: string, patch: Partial<Block>) => void
}

// ── SheetHandle ────────────────────────────────────────────────────────────
// Purely visual — drag logic is wired via native listeners in useDragToDismiss
function SheetHandle({ handleRef }: { handleRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={handleRef}
      style={{ padding: '12px 0 4px', display: 'flex', justifyContent: 'center', flexShrink: 0, cursor: 'grab', touchAction: 'none' }}
    >
      <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(26,26,26,0.15)' }} />
    </div>
  )
}

// ── useDragToDismiss ───────────────────────────────────────────────────────
// Uses NATIVE touch listeners on the handle element (not React synthetic events)
// so we can call e.preventDefault() and prevent the sheet's overflowY scroll
// from swallowing our drag. The sheet's own scroll is managed separately.
function useDragToDismiss(onClose: () => void) {
  const handleRef = React.useRef<HTMLDivElement>(null)
  const sheetRef  = React.useRef<HTMLDivElement>(null)
  const dragRef   = React.useRef<{ startY: number; startScrollTop: number } | null>(null)
  const [dragOffset, setDragOffset] = React.useState(0)
  const isDraggingRef = React.useRef(false)

  React.useEffect(() => {
    const handle = handleRef.current
    if (!handle) return

    const onTouchStart = (e: TouchEvent) => {
      // Don't preventDefault here — let the touch register, but capture it
      const scrollEl = sheetRef.current?.querySelector('[data-sheet-scroll]') as HTMLElement | null
      dragRef.current = {
        startY: e.touches[0].clientY,
        startScrollTop: scrollEl?.scrollTop ?? 0,
      }
      isDraggingRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return
      const dy = e.touches[0].clientY - dragRef.current.startY
      if (Math.abs(dy) > 4) isDraggingRef.current = true
      if (!isDraggingRef.current) return
      e.preventDefault() // now safe — we know it's a drag, not a tap
      if (dy > 0) setDragOffset(dy)
      else setDragOffset(0)
    }

    const onTouchEnd = () => {
      if (!dragRef.current) return
      dragRef.current = null
      // Read offset synchronously from state via a callback form isn't possible,
      // so we use a ref mirror
      setDragOffset(prev => {
        if (prev > 80) { onClose(); return 0 }
        return 0
      })
      isDraggingRef.current = false
    }

    handle.addEventListener('touchstart', onTouchStart, { passive: true })
    handle.addEventListener('touchmove',  onTouchMove,  { passive: false })
    handle.addEventListener('touchend',   onTouchEnd,   { passive: true })
    handle.addEventListener('touchcancel',onTouchEnd,   { passive: true })

    return () => {
      handle.removeEventListener('touchstart', onTouchStart)
      handle.removeEventListener('touchmove',  onTouchMove)
      handle.removeEventListener('touchend',   onTouchEnd)
      handle.removeEventListener('touchcancel',onTouchEnd)
    }
  // onClose identity changes don't matter — we only care about the gesture
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { handleRef, sheetRef, dragOffset, isDragging: isDraggingRef }
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
  onPatchBlock,
}: MobileBottomSheetProps) {
  const isVisible = !!block
  const { handleRef, sheetRef, dragOffset, isDragging } = useDragToDismiss(onClose)

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const blockTypeLabel = (type: string) => {
    const map: Record<string, [string, string]> = {
      image:       ['🖼', isZh ? '图片'   : 'Image'],
      title:       ['✦',  isZh ? '标题'   : 'Title'],
      note:        ['✎',  isZh ? '文字'   : 'Text'],
      custom:      ['⊞',  isZh ? '自定义' : 'Custom'],
      sticky:      ['📝', isZh ? '便利贴' : 'Sticky'],
      table:       ['⊟',  isZh ? '表格'   : 'Table'],
      'image-row': ['🖼', isZh ? '图片组' : 'Image Row'],
      milestone:   ['◎',  isZh ? '进度'   : 'Milestone'],
    }
    return map[type] ?? ['◻', type]
  }

  const isTextBlock  = block && ['title', 'note', 'custom', 'milestone'].includes(block.type)
  const isImageBlock = block?.type === 'image' || block?.type === 'image-row'

  if (!block) return null

  const [typeIcon, typeLabel] = blockTypeLabel(block.type)
  const sheetTransform = isVisible ? `translateY(${dragOffset}px)` : 'translateY(100%)'

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
      <span style={{ fontSize: 20, width: 32, textAlign: 'center', flexShrink: 0, color: danger ? '#dc3c3c' : '#444' }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 500, color: danger ? '#c03030' : '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif' }}>{label}</div>
        {sub && <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  )

  const Divider = () => (
    <div style={{ height: 1, background: 'rgba(26,26,26,0.06)', margin: '4px 0' }} />
  )

  const SectionLabel = ({ text }: { text: string }) => (
    <div style={{ padding: '8px 20px 4px' }}>
      <div style={{ fontSize: '0.58rem', letterSpacing: '0.16em', textTransform: 'uppercase', color: '#c4c4c0', fontWeight: 600 }}>
        {text}
      </div>
    </div>
  )

  // ── Text properties section ────────────────────────────────────────────
  const TextProps = () => {
    if (!isTextBlock || !onPatchBlock || !block) return null
    const fontSize = block.fontSize ?? 16
    const isBold   = block.fontWeight === 'bold' || block.fontWeight === '700'
    const isItalic = block.fontStyle === 'italic'
    const color    = block.color ?? '#1a1a1a'
    const align    = block.align ?? 'left'

    const ToggleBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
      <button
        onClick={onClick}
        style={{
          flex: 1, height: 36, border: `1.5px solid ${active ? '#1a1a1a' : 'rgba(26,26,26,0.12)'}`,
          borderRadius: 8, background: active ? '#1a1a1a' : 'transparent',
          color: active ? '#fff' : '#888', fontSize: '0.82rem', fontWeight: 600,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          fontFamily: 'Inter, DM Sans, sans-serif',
        }}
      >{label}</button>
    )

    const COLORS = ['#1a1a1a', '#ffffff', '#c03030', '#2563eb', '#16a34a', '#b45309', '#7c3aed', '#888888']

    return (
      <>
        <Divider />
        <SectionLabel text={isZh ? '文字设置' : 'Text'} />

        {/* Font size */}
        <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', width: 56, flexShrink: 0 }}>
            {isZh ? '字号' : 'Size'}
          </span>
          <button
            onClick={() => onPatchBlock(block.id, { fontSize: Math.max(8, fontSize - 2) })}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(26,26,26,0.12)', background: 'transparent', fontSize: '1rem', color: '#555', cursor: 'pointer' }}
          >−</button>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', minWidth: 28, textAlign: 'center', fontFamily: 'Space Mono, monospace' }}>
            {fontSize}
          </span>
          <button
            onClick={() => onPatchBlock(block.id, { fontSize: Math.min(120, fontSize + 2) })}
            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(26,26,26,0.12)', background: 'transparent', fontSize: '1rem', color: '#555', cursor: 'pointer' }}
          >+</button>
        </div>

        {/* Bold / Italic / Align */}
        <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6 }}>
          <ToggleBtn active={isBold}            label="B"   onClick={() => onPatchBlock(block.id, { fontWeight: isBold  ? 'normal' : 'bold'   })} />
          <ToggleBtn active={isItalic}          label="I"   onClick={() => onPatchBlock(block.id, { fontStyle: isItalic ? 'normal' : 'italic' })} />
          <ToggleBtn active={align === 'left'}  label="≡←"  onClick={() => onPatchBlock(block.id, { align: 'left'   })} />
          <ToggleBtn active={align === 'center'}label="≡"   onClick={() => onPatchBlock(block.id, { align: 'center' })} />
          <ToggleBtn active={align === 'right'} label="≡→"  onClick={() => onPatchBlock(block.id, { align: 'right'  })} />
        </div>

        {/* Color swatches */}
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', width: 56, flexShrink: 0 }}>
            {isZh ? '颜色' : 'Color'}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => onPatchBlock(block.id, { color: c })}
                style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: c,
                  border: color === c ? '2px solid #1a1a1a' : '1.5px solid rgba(26,26,26,0.15)',
                  cursor: 'pointer', flexShrink: 0,
                  outline: color === c ? '2px solid rgba(26,26,26,0.2)' : 'none',
                  outlineOffset: 1,
                }}
              />
            ))}
            {/* Custom color picker */}
            <label style={{ position: 'relative', width: 24, height: 24, cursor: 'pointer', flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                border: '1.5px solid rgba(26,26,26,0.15)',
              }} />
              <input type="color" value={color} onChange={e => onPatchBlock(block.id, { color: e.target.value })}
                style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </label>
          </div>
        </div>
      </>
    )
  }

  // ── Image properties section ───────────────────────────────────────────
  const ImageProps = () => {
    if (!isImageBlock || !onPatchBlock || !block) return null
    const opacity      = block.opacity      ?? 1
    const borderRadius = block.borderRadius ?? 0

    return (
      <>
        <Divider />
        <SectionLabel text={isZh ? '图片设置' : 'Image'} />

        {/* Opacity */}
        <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', width: 56, flexShrink: 0 }}>
            {isZh ? '透明度' : 'Opacity'}
          </span>
          <input
            type="range" min={0} max={1} step={0.05} value={opacity}
            onChange={e => onPatchBlock(block.id, { opacity: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: '#1a1a1a' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Space Mono, monospace', width: 36, textAlign: 'right' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Border radius */}
        <div style={{ padding: '0 20px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', width: 56, flexShrink: 0 }}>
            {isZh ? '圆角' : 'Radius'}
          </span>
          <input
            type="range" min={0} max={48} step={2} value={borderRadius}
            onChange={e => onPatchBlock(block.id, { borderRadius: parseInt(e.target.value) })}
            style={{ flex: 1, accentColor: '#1a1a1a' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Space Mono, monospace', width: 36, textAlign: 'right' }}>
            {borderRadius}px
          </span>
        </div>
      </>
    )
  }

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────
          CRITICAL: touchAction:'none' + pointerEvents only 'auto' when visible.
          Without this, the backdrop intercepts all touch events even when
          transparent, completely blocking canvas pan/pinch underneath. */}
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: isVisible ? 'rgba(0,0,0,0.3)' : 'transparent',
          backdropFilter: isVisible ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: isVisible ? 'blur(2px)' : 'none',
          transition: 'background 0.28s ease, backdrop-filter 0.28s ease',
          // KEY FIX: only intercept touches when sheet is actually open
          pointerEvents: isVisible ? 'auto' : 'none',
          touchAction: isVisible ? 'none' : 'auto',
        }}
      />

      {/* ── Sheet ─────────────────────────────────────────────────────────
          Structure: fixed outer (no overflow) → handle (touchAction:none) →
          scrollable inner (data-sheet-scroll, touchAction:pan-y).
          This way the handle drag always works and the content scrolls normally. */}
      <div
        ref={sheetRef}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1201,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
          transform: sheetTransform,
          transition: isDragging.current ? 'none' : 'transform 0.36s cubic-bezier(0.34,1.05,0.64,1)',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          // KEY FIX: no overflow here — overflow lives on the inner scroll div only
          overflow: 'hidden',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle — touchAction:none so native drag listener fires cleanly */}
        <SheetHandle handleRef={handleRef} />

        {/* Header — fixed, never scrolls */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px', flexShrink: 0,
          borderBottom: '1px solid rgba(26,26,26,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>{typeIcon}</span>
            <div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif' }}>{typeLabel}</div>
              {block.content && (
                <div style={{ fontSize: '0.68rem', color: '#aaa', marginTop: 1, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.content}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(26,26,26,0.07)', border: 'none', fontSize: 16, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >×</button>
        </div>

        {/* Scrollable body — KEY: data-sheet-scroll + touchAction:pan-y */}
        <div
          data-sheet-scroll
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            // pan-y: browser handles vertical scroll, our drag handle
            // lives on a separate element above so there's no conflict
            touchAction: 'pan-y',
          }}
        >
          {/* Image-specific */}
          {isImageBlock && onReplaceImage && (
            <>
              <Row icon="🔄" label={isZh ? '替换图片' : 'Replace image'} sub={isZh ? '从相册或文件选择' : 'From photos or files'} onClick={() => onReplaceImage(block.id)} />
              {onEditImage  && <Row icon="✂️" label={isZh ? '编辑图片' : 'Edit image'}          sub={isZh ? '裁剪 · 滤镜' : 'Crop · Filters'} onClick={() => onEditImage(block.id)} />}
              {onRemoveBg   && <Row icon="⊡"  label={isZh ? 'AI 智能抠图' : 'Remove background'} sub={isZh ? 'AI 去除背景' : 'AI-powered'}     onClick={() => onRemoveBg(block.id, block.content || '')} />}
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

          {/* Inline properties */}
          <TextProps />
          <ImageProps />

          {/* Universal */}
          <Divider />
          <Row icon="⎘" label={isZh ? '复制元素' : 'Duplicate'} onClick={() => onDuplicate(block.id)} />

          <Divider />

          {/* Layer controls */}
          <SectionLabel text={isZh ? '层级' : 'Layer order'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {[
              { icon: '⇑', label: isZh ? '置顶'  : 'To front',  onClick: () => onBringToFront(block.id)  },
              { icon: '↑',  label: isZh ? '上移'  : 'Forward',   onClick: () => onBringForward(block.id)  },
              { icon: '↓',  label: isZh ? '下移'  : 'Backward',  onClick: () => onSendBackward(block.id)  },
              { icon: '⇓', label: isZh ? '置底'  : 'To back',   onClick: () => onSendToBack(block.id)    },
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
                onTouchEnd={e =>   { (e.currentTarget.style.background = 'transparent') }}
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

          <div style={{ height: 8 }} />
        </div>
      </div>
    </>
  )
}

// ── MobileAddSheet ─────────────────────────────────────────────────────────
interface MobileAddSheetProps {
  isOpen: boolean
  isZh: boolean
  onClose: () => void
  onAddText: () => void
  onAddTitle: () => void
  onAddImage: () => void
}

export function MobileAddSheet({
  isOpen, isZh, onClose, onAddText, onAddTitle, onAddImage,
}: MobileAddSheetProps) {
  const { handleRef, sheetRef, dragOffset, isDragging } = useDragToDismiss(onClose)

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  const Item = ({ icon, label, sub, onClick }: { icon: string; label: string; sub: string; onClick: () => void }) => (
    <button
      onClick={() => { onClick(); onClose() }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 6, padding: '16px 8px',
        border: '1.5px solid rgba(26,26,26,0.1)', borderRadius: 14,
        background: 'transparent', cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        transition: 'background 0.1s, border-color 0.1s',
        flex: 1,
      }}
      onTouchStart={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.04)'; e.currentTarget.style.borderColor = 'rgba(26,26,26,0.25)' }}
      onTouchEnd={e =>   { e.currentTarget.style.background = 'transparent';          e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)'  }}
    >
      <span style={{ fontSize: 28 }}>{icon}</span>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif' }}>{label}</div>
        <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )

  return (
    <>
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: isOpen ? 'rgba(0,0,0,0.25)' : 'transparent',
          backdropFilter: isOpen ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: isOpen ? 'blur(2px)' : 'none',
          transition: 'background 0.24s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          touchAction: isOpen ? 'none' : 'auto',
        }}
      />

      <div
        ref={sheetRef}
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1201,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
          transform: isOpen ? `translateY(${dragOffset}px)` : 'translateY(100%)',
          transition: isDragging.current ? 'none' : 'transform 0.32s cubic-bezier(0.34,1.05,0.64,1)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          overflow: 'hidden',
        }}
      >
        <SheetHandle handleRef={handleRef} />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 20px 16px',
        }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif' }}>
            {isZh ? '添加元素' : 'Add element'}
          </div>
          <button
            onClick={onClose}
            style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(26,26,26,0.07)', border: 'none', fontSize: 16, color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '0 20px 20px' }}>
          <Item icon="✦" label={isZh ? '标题' : 'Title'} sub={isZh ? '大标题文字' : 'Heading text'} onClick={onAddTitle} />
          <Item icon="✎" label={isZh ? '文字' : 'Text'}  sub={isZh ? '正文段落'   : 'Body text'}    onClick={onAddText}  />
          <Item icon="🖼" label={isZh ? '图片' : 'Image'} sub={isZh ? '从相册选择' : 'From photos'}  onClick={onAddImage} />
        </div>
      </div>
    </>
  )
}

// ── MobileBottomBar ────────────────────────────────────────────────────────
interface MobileBottomBarProps {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomFit: () => void
  currentPage: number
  totalPages: number
  isZh: boolean
  onAdd: () => void
}

export function MobileBottomBar({
  zoom, onZoomIn, onZoomOut, onZoomFit,
  currentPage, totalPages, isZh,
  onAdd,
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
      onTouchEnd={e =>   { (e.currentTarget.style.background = 'rgba(255,255,255,0.85)') }}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Btn label="−"                            onPress={onZoomOut} />
        <Btn label={`${Math.round(zoom * 100)}%`} onPress={onZoomFit} wide />
        <Btn label="+"                            onPress={onZoomIn} />
      </div>

      <div style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'Space Mono, monospace', letterSpacing: '0.05em' }}>
        {isZh ? `第 ${currentPage} / ${totalPages} 页` : `${currentPage} / ${totalPages}`}
      </div>

      <button
        onClick={onAdd}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          background: '#1a1a1a', border: 'none',
          color: '#fff', fontSize: '1.4rem', lineHeight: 1,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
          WebkitTapHighlightColor: 'transparent',
          flexShrink: 0,
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.92)' }}
        onTouchEnd={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
      >＋</button>
    </div>
  )
}
