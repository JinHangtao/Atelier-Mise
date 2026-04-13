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
  onDeletePage?: () => void
}

// ── SheetHandle ────────────────────────────────────────────────────────────
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
      const scrollEl = sheetRef.current?.querySelector('[data-sheet-scroll]') as HTMLElement | null
      dragRef.current = {
        startY: e.touches[0].clientY,
        startScrollTop: scrollEl?.scrollTop ?? 0,
      }
      isDraggingRef.current = false
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!dragRef.current) return
      e.preventDefault()
      const dy = e.touches[0].clientY - dragRef.current.startY
      if (Math.abs(dy) > 4) isDraggingRef.current = true
      if (!isDraggingRef.current) return
      if (dy > 0) setDragOffset(dy)
      else setDragOffset(0)
    }

    const onTouchEnd = () => {
      if (!dragRef.current) return
      dragRef.current = null
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { handleRef, sheetRef, dragOffset, isDragging: isDraggingRef }
}

// ── useMountedSheet ────────────────────────────────────────────────────────
// 管理 sheet 的 mount/unmount 状态，让退场动画能跑完再卸载
// phase: 'hidden' → 'entering' → 'visible' → 'leaving' → 'hidden'
function useMountedSheet(isOpen: boolean, leaveDuration = 280) {
  const [phase, setPhase] = React.useState<'hidden' | 'entering' | 'visible' | 'leaving'>(
    isOpen ? 'visible' : 'hidden'
  )
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)

    if (isOpen) {
      if (phase === 'hidden') {
        // 先 mount（hidden），下一帧触发 entering → visible
        setPhase('entering')
        timerRef.current = setTimeout(() => setPhase('visible'), 16)
      } else if (phase === 'leaving') {
        setPhase('visible')
      }
    } else {
      if (phase === 'visible' || phase === 'entering') {
        setPhase('leaving')
        timerRef.current = setTimeout(() => setPhase('hidden'), leaveDuration)
      }
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const mounted = phase !== 'hidden'
  // entering: sheet 在屏幕外，立刻触发 visible 过渡进入
  const translateOut = phase === 'entering' || phase === 'leaving'
  const backdropVisible = phase === 'visible'

  return { mounted, translateOut, backdropVisible, phase }
}

// ── Spring easing constants ────────────────────────────────────────────────
// 入场 spring：轻微超调，像 iOS sheet
const SPRING_IN  = 'cubic-bezier(0.34, 1.08, 0.64, 1)'
// 退场：快速 ease-in，不需要弹
const EASE_OUT   = 'cubic-bezier(0.4, 0, 1, 1)'
// 按钮弹回 spring
const SPRING_BTN = 'cubic-bezier(0.34, 1.56, 0.64, 1)'

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
  onDeletePage,
}: MobileBottomSheetProps) {
  const isOpen = !!block
  const { mounted, translateOut, backdropVisible, phase } = useMountedSheet(isOpen, 260)
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

  if (!mounted || !block) return null

  const [typeIcon, typeLabel] = blockTypeLabel(block.type)

  // Sheet transform：拖拽中直接跟手，否则用 spring/ease
  const sheetTranslateY = translateOut ? '100%' : `${dragOffset}px`
  const sheetTransition = isDragging.current
    ? 'none'
    : translateOut
      ? `transform 0.26s ${EASE_OUT}, opacity 0.22s ease`
      : `transform 0.42s ${SPRING_IN}, opacity 0.28s ease`

  // ── Row ──────────────────────────────────────────────────────────────────
  // press: scale(0.97) + bg — 给人"按下去"的物理感
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
        // scale + bg 同时过渡，80ms 即时响应
        transition: 'background 0.08s ease, transform 0.08s ease',
        borderRadius: 0,
        transformOrigin: 'center',
      }}
      onTouchStart={e => {
        if (!disabled) {
          e.currentTarget.style.background = danger ? 'rgba(220,60,60,0.07)' : 'rgba(26,26,26,0.05)'
          e.currentTarget.style.transform = 'scale(0.98)'
        }
      }}
      onTouchEnd={e => {
        e.currentTarget.style.background = 'transparent'
        // spring 弹回
        e.currentTarget.style.transition = `background 0.12s ease, transform 0.3s ${SPRING_BTN}`
        e.currentTarget.style.transform = 'scale(1)'
        // 恢复默认 transition
        setTimeout(() => {
          if (e.currentTarget) e.currentTarget.style.transition = 'background 0.08s ease, transform 0.08s ease'
        }, 320)
      }}
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

    // toggle 按钮：active/inactive 颜色平滑过渡
    const ToggleBtn = ({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) => (
      <button
        onClick={onClick}
        style={{
          flex: 1, height: 36,
          border: `1.5px solid ${active ? '#1a1a1a' : 'rgba(26,26,26,0.12)'}`,
          borderRadius: 8,
          background: active ? '#1a1a1a' : 'transparent',
          color: active ? '#fff' : '#888',
          fontSize: '0.82rem', fontWeight: 600,
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          fontFamily: 'Inter, DM Sans, sans-serif',
          // 颜色/背景平滑过渡，toggle 切换不再突变
          transition: `background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.12s ease`,
          transformOrigin: 'center',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.93)' }}
        onTouchEnd={e => {
          e.currentTarget.style.transition = `background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.28s ${SPRING_BTN}`
          e.currentTarget.style.transform = 'scale(1)'
          setTimeout(() => {
            if (e.currentTarget) e.currentTarget.style.transition = `background 0.18s ease, color 0.18s ease, border-color 0.18s ease, transform 0.12s ease`
          }, 300)
        }}
      >{label}</button>
    )

    const COLORS = ['#1a1a1a', '#ffffff', '#c03030', '#2563eb', '#16a34a', '#b45309', '#7c3aed', '#888888']

    // 字号 +/- 按钮：同 Row 的 scale press
    const StepBtn = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
      <button
        onClick={onClick}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: '1px solid rgba(26,26,26,0.12)', background: 'transparent',
          fontSize: '1rem', color: '#555', cursor: 'pointer',
          transition: `background 0.08s ease, transform 0.08s ease`,
          WebkitTapHighlightColor: 'transparent',
        }}
        onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.88)'; e.currentTarget.style.background = 'rgba(26,26,26,0.06)' }}
        onTouchEnd={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.transition = `background 0.12s ease, transform 0.3s ${SPRING_BTN}`
          e.currentTarget.style.transform = 'scale(1)'
          setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.08s ease, transform 0.08s ease' }, 320)
        }}
      >{children}</button>
    )

    return (
      <>
        <Divider />
        <SectionLabel text={isZh ? '文字设置' : 'Text'} />

        {/* Font size */}
        <div style={{ padding: '6px 20px 10px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.75rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif', width: 56, flexShrink: 0 }}>
            {isZh ? '字号' : 'Size'}
          </span>
          <StepBtn onClick={() => onPatchBlock(block.id, { fontSize: Math.max(8, fontSize - 2) })}>−</StepBtn>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', minWidth: 28, textAlign: 'center', fontFamily: 'Space Mono, monospace' }}>
            {fontSize}
          </span>
          <StepBtn onClick={() => onPatchBlock(block.id, { fontSize: Math.min(120, fontSize + 2) })}>+</StepBtn>
        </div>

        {/* Bold / Italic / Align */}
        <div style={{ padding: '0 20px 10px', display: 'flex', gap: 6 }}>
          <ToggleBtn active={isBold}            label="B"   onClick={() => onPatchBlock(block.id, { fontWeight: isBold  ? 'normal' : 'bold'   })} />
          <ToggleBtn active={isItalic}          label="I"   onClick={() => onPatchBlock(block.id, { fontStyle: isItalic ? 'normal' : 'italic' })} />
          <ToggleBtn active={align === 'left'}  label="≡←"  onClick={() => onPatchBlock(block.id, { align: 'left'   })} />
          <ToggleBtn active={align === 'center'}label="≡"   onClick={() => onPatchBlock(block.id, { align: 'center' })} />
          <ToggleBtn active={align === 'right'} label="≡→"  onClick={() => onPatchBlock(block.id, { align: 'right'  })} />
        </div>

        {/* Color swatches — 选中时 scale(1.22) 弹出，给明确的选中反馈 */}
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
                  // 选中时放大弹出，提供清晰的选中态反馈
                  transform: color === c ? 'scale(1.22)' : 'scale(1)',
                  transition: `transform 0.28s ${SPRING_BTN}, border 0.15s ease, outline 0.15s ease`,
                  WebkitTapHighlightColor: 'transparent',
                }}
                onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.85)' }}
                onTouchEnd={e => {
                  // 松手后由 React 重新渲染决定 scale（选中/未选中）
                  e.currentTarget.style.transform = color === c ? 'scale(1.22)' : 'scale(1.08)'
                  setTimeout(() => {
                    if (e.currentTarget) e.currentTarget.style.transform = ''
                  }, 300)
                }}
              />
            ))}
            {/* Custom color picker */}
            <label style={{ position: 'relative', width: 24, height: 24, cursor: 'pointer', flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%',
                background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                border: '1.5px solid rgba(26,26,26,0.15)',
                transition: `transform 0.28s ${SPRING_BTN}`,
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
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            style={{ flex: 1, accentColor: '#1a1a1a', touchAction: 'none' }}
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
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
            style={{ flex: 1, accentColor: '#1a1a1a', touchAction: 'none' }}
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
      {/* ── Backdrop ── */}
      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: backdropVisible ? 'rgba(0,0,0,0.3)' : 'transparent',
          backdropFilter: backdropVisible ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: backdropVisible ? 'blur(2px)' : 'none',
          transition: 'background 0.28s ease, backdrop-filter 0.28s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
          touchAction: isOpen ? 'none' : 'auto',
        }}
      />

      {/* ── Sheet ── */}
      <div
        ref={sheetRef}
        data-fixed-overlay
        style={{
          position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1201,
          background: '#fff',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.18)',
          transform: `translateY(${sheetTranslateY})`,
          // 退场时同时 fade out，让消失不那么硬
          opacity: phase === 'leaving' ? 0 : 1,
          transition: sheetTransition,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          overscrollBehavior: 'none',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <SheetHandle handleRef={handleRef} />

        {/* Header */}
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
          {/* 关闭按钮：press 时 scale(0.82) + rotate，松手 spring 弹回 */}
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(26,26,26,0.07)', border: 'none',
              fontSize: 16, color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              transition: `transform 0.12s ease, background 0.12s ease`,
              WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={e => {
              e.currentTarget.style.transform = 'scale(0.82) rotate(15deg)'
              e.currentTarget.style.background = 'rgba(26,26,26,0.13)'
            }}
            onTouchEnd={e => {
              e.currentTarget.style.background = 'rgba(26,26,26,0.07)'
              e.currentTarget.style.transition = `transform 0.32s ${SPRING_BTN}, background 0.12s ease`
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
              setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'transform 0.12s ease, background 0.12s ease' }, 350)
            }}
          >×</button>
        </div>

        {/* Scrollable body */}
        <div
          data-sheet-scroll
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
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

          <TextProps />
          <ImageProps />

          <Divider />
          <Row icon="⎘" label={isZh ? '复制元素' : 'Duplicate'} onClick={() => onDuplicate(block.id)} />

          <Divider />

          {/* Layer controls — grid 按钮也加 scale press */}
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
                  transition: `background 0.08s ease, transform 0.08s ease`,
                }}
                onTouchStart={e => {
                  e.currentTarget.style.background = 'rgba(26,26,26,0.04)'
                  e.currentTarget.style.transform = 'scale(0.94)'
                }}
                onTouchEnd={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transition = `background 0.12s ease, transform 0.3s ${SPRING_BTN}`
                  e.currentTarget.style.transform = 'scale(1)'
                  setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.08s ease, transform 0.08s ease' }, 320)
                }}
              >
                <span style={{ fontSize: 18, color: '#555' }}>{item.icon}</span>
                <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'Inter, DM Sans, sans-serif' }}>{item.label}</span>
              </button>
            ))}
          </div>

          <Divider />

          {/* Delete element */}
          <Row
            icon="🗑"
            label={isZh ? '删除元素' : 'Delete element'}
            sub={isZh ? '此操作不可撤销' : 'Cannot be undone'}
            onClick={() => onDelete(block.id)}
            danger
          />

          {/* Delete page */}
          {onDeletePage && (
            <>
              <Divider />
              <Row
                icon="📄"
                label={isZh ? '删除当前页面' : 'Delete this page'}
                sub={isZh ? '页面及所有内容将被删除' : 'Page and all content will be removed'}
                onClick={() => {
                  if (window.confirm(isZh ? '确定删除当前页面？此操作不可撤销。' : 'Delete this page? This cannot be undone.')) {
                    onDeletePage()
                  }
                }}
                danger
              />
            </>
          )}

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
  onAddPage?: () => void
}

export function MobileAddSheet({
  isOpen, isZh, onClose, onAddText, onAddTitle, onAddImage, onAddPage,
}: MobileAddSheetProps) {
  const { mounted, translateOut, backdropVisible } = useMountedSheet(isOpen, 240)
  const { handleRef, sheetRef, dragOffset, isDragging } = useDragToDismiss(onClose)

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!mounted) return null

  // Item 按钮：入场 stagger（第 0/1/2 个分别延迟 0/55/110ms）
  // 入场时从 translateY(12px) opacity(0) 弹入
  const Item = ({
    icon, label, sub, onClick, staggerIndex,
  }: {
    icon: string; label: string; sub: string; onClick: () => void; staggerIndex: number
  }) => {
    const enterDelay = translateOut ? 0 : staggerIndex * 55
    const isEntering = !translateOut

    return (
      <button
        onClick={() => { onClick(); onClose() }}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, padding: '16px 8px',
          border: '1.5px solid rgba(26,26,26,0.1)', borderRadius: 14,
          background: 'transparent', cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          // stagger 入场：用 animation
          animation: isEntering
            ? `mobileItemIn 0.38s ${SPRING_IN} ${enterDelay}ms both`
            : 'none',
          // press scale
          transition: 'background 0.08s ease, border-color 0.08s ease, transform 0.08s ease',
          flex: 1,
        }}
        onTouchStart={e => {
          e.currentTarget.style.background = 'rgba(26,26,26,0.05)'
          e.currentTarget.style.borderColor = 'rgba(26,26,26,0.28)'
          e.currentTarget.style.transform = 'scale(0.94)'
        }}
        onTouchEnd={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'rgba(26,26,26,0.1)'
          e.currentTarget.style.transition = `background 0.12s ease, border-color 0.12s ease, transform 0.32s ${SPRING_BTN}`
          e.currentTarget.style.transform = 'scale(1)'
          setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.08s ease, border-color 0.08s ease, transform 0.08s ease' }, 350)
        }}
      >
        <span style={{ fontSize: 28 }}>{icon}</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a', fontFamily: 'Inter, DM Sans, sans-serif' }}>{label}</div>
          <div style={{ fontSize: '0.65rem', color: '#aaa', marginTop: 2 }}>{sub}</div>
        </div>
      </button>
    )
  }

  const sheetTransition = isDragging.current
    ? 'none'
    : translateOut
      ? `transform 0.24s ${EASE_OUT}, opacity 0.2s ease`
      : `transform 0.4s ${SPRING_IN}, opacity 0.26s ease`

  return (
    <>
      {/* keyframes for item stagger */}
      <style>{`
        @keyframes mobileItemIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      <div
        onClick={handleBackdrop}
        style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: backdropVisible ? 'rgba(0,0,0,0.25)' : 'transparent',
          backdropFilter: backdropVisible ? 'blur(2px)' : 'none',
          WebkitBackdropFilter: backdropVisible ? 'blur(2px)' : 'none',
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
          transform: `translateY(${translateOut ? '100%' : `${dragOffset}px`})`,
          opacity: translateOut ? 0 : 1,
          transition: sheetTransition,
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
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'rgba(26,26,26,0.07)', border: 'none',
              fontSize: 16, color: '#888', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: `transform 0.12s ease, background 0.12s ease`,
              WebkitTapHighlightColor: 'transparent',
            }}
            onTouchStart={e => {
              e.currentTarget.style.transform = 'scale(0.82) rotate(15deg)'
              e.currentTarget.style.background = 'rgba(26,26,26,0.13)'
            }}
            onTouchEnd={e => {
              e.currentTarget.style.background = 'rgba(26,26,26,0.07)'
              e.currentTarget.style.transition = `transform 0.32s ${SPRING_BTN}, background 0.12s ease`
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)'
              setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'transform 0.12s ease, background 0.12s ease' }, 350)
            }}
          >×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '0 20px 20px' }}>
          <Item icon="✦" label={isZh ? '标题' : 'Title'} sub={isZh ? '大标题文字' : 'Heading text'} onClick={onAddTitle} staggerIndex={0} />
          <Item icon="✎" label={isZh ? '文字' : 'Text'}  sub={isZh ? '正文段落'   : 'Body text'}    onClick={onAddText}  staggerIndex={1} />
          <Item icon="🖼" label={isZh ? '图片' : 'Image'} sub={isZh ? '从相册选择' : 'From photos'}  onClick={onAddImage} staggerIndex={2} />
          {onAddPage && (
            <Item icon="📄" label={isZh ? '新页面' : 'New page'} sub={isZh ? '添加一页' : 'Add a page'} onClick={onAddPage} staggerIndex={3} />
          )}
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
  onAddPage?: () => void
  onDeletePage?: () => void
  onGoToPage?: (page: number) => void
}

export function MobileBottomBar({
  zoom, onZoomIn, onZoomOut, onZoomFit,
  currentPage, totalPages, isZh,
  onAdd, onAddPage, onDeletePage, onGoToPage,
}: MobileBottomBarProps) {
  const zoomPct = Math.round(zoom * 100)
  const [displayZoom, setDisplayZoom]   = React.useState(zoomPct)
  const [flipKey, setFlipKey]           = React.useState(0)
  const [pagePopover, setPagePopover]   = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [popLeft, setPopLeft]           = React.useState<number | null>(null)

  // refs
  const pageBtnRef  = React.useRef<HTMLButtonElement>(null)
  const popoverRef  = React.useRef<HTMLDivElement>(null)
  const barRef      = React.useRef<HTMLDivElement>(null)

  // zoom flip
  React.useEffect(() => {
    if (zoomPct !== displayZoom) { setFlipKey(k => k + 1); setDisplayZoom(zoomPct) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomPct])

  // 计算 popover 水平位置：锚定到页码按钮中心，但不超出屏幕边界
  const openPopover = () => {
    if (pageBtnRef.current) {
      const rect = pageBtnRef.current.getBoundingClientRect()
      const popW = 240
      const center = rect.left + rect.width / 2
      const left = Math.max(12, Math.min(center - popW / 2, window.innerWidth - popW - 12))
      setPopLeft(left)
    }
    setPagePopover(true)
    setConfirmDelete(false)
  }

  const closePopover = () => { setPagePopover(false); setConfirmDelete(false) }

  // 点击外部关闭
  React.useEffect(() => {
    if (!pagePopover) return
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        pageBtnRef.current && !pageBtnRef.current.contains(target)
      ) closePopover()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('touchstart', handler) }
  }, [pagePopover])

  // ── sub-components ──────────────────────────────────────────────────────
  const ZoomBtn = ({ label, onPress, wide }: { label: string; onPress: () => void; wide?: boolean }) => (
    <button onClick={onPress} style={{
      height: 36, minWidth: wide ? 64 : 36, padding: '0 10px',
      borderRadius: 10, border: '1px solid rgba(26,26,26,0.12)',
      background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
      fontSize: wide ? '0.7rem' : '1rem', color: '#444', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Space Mono, monospace',
      WebkitTapHighlightColor: 'transparent',
      transition: 'background 0.08s ease, transform 0.08s ease',
      overflow: 'hidden',
    }}
    onTouchStart={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.09)'; e.currentTarget.style.transform = 'scale(0.90)' }}
    onTouchEnd={e => {
      e.currentTarget.style.background = 'rgba(255,255,255,0.85)'
      e.currentTarget.style.transition = `background 0.14s ease, transform 0.32s ${SPRING_BTN}`
      e.currentTarget.style.transform = 'scale(1)'
      setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.08s ease, transform 0.08s ease' }, 350)
    }}>
      {wide ? <span key={flipKey} style={{ animation: flipKey > 0 ? 'zoomFlip 0.22s ease both' : 'none' }}>{label}</span> : label}
    </button>
  )

  // 页面卡片缩略（最多 8 张，超出显示 +N）
  const PAGE_PREVIEW_MAX = 8
  const visiblePages = Math.min(totalPages, PAGE_PREVIEW_MAX)
  const overflow     = totalPages - PAGE_PREVIEW_MAX

  // 底部 bar 高度（用于 popover 定位）
  const barBottom = barRef.current
    ? window.innerHeight - barRef.current.getBoundingClientRect().top + 8
    : 64

  return (
    <>
      <style>{`
        @keyframes zoomFlip {
          0%   { opacity:0.4; transform:translateY(-6px) scale(0.92); }
          60%  { opacity:1;   transform:translateY(1px)  scale(1.04); }
          100% { opacity:1;   transform:translateY(0)    scale(1);    }
        }
        @keyframes pagePopIn {
          0%   { opacity:0; transform:translateY(10px) scale(0.94); }
          65%  { transform:translateY(-3px) scale(1.01); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes confirmIn {
          0%   { opacity:0; max-height:0; }
          100% { opacity:1; max-height:120px; }
        }
        .page-action-btn:active { background: rgba(26,26,26,0.05) !important; }
        .page-action-btn-danger:active { background: rgba(220,60,60,0.07) !important; }
      `}</style>

      {/* ── Page Popover ── */}
      {pagePopover && popLeft !== null && (
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            left: popLeft,
            bottom: barBottom,
            width: 240,
            zIndex: 1100,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 12px 48px rgba(0,0,0,0.16), 0 2px 10px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            animation: `pagePopIn 0.36s ${SPRING_IN} both`,
          }}
        >
          {/* ── Header ── */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid rgba(26,26,26,0.07)',
          }}>
            <div style={{
              fontSize: '0.6rem', letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#bbb', fontWeight: 700, marginBottom: 12,
              fontFamily: 'Inter, DM Sans, sans-serif',
            }}>
              {isZh ? '页面导航' : 'Pages'}
            </div>

            {/* Page thumbnail grid */}
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              {Array.from({ length: visiblePages }).map((_, i) => {
                const pg   = i + 1
                const isAct = pg === currentPage
                return (
                  <button
                    key={pg}
                    onClick={() => { onGoToPage?.(pg); closePopover() }}
                    style={{
                      flex: isAct ? '0 0 44px' : '0 0 28px',
                      height: isAct ? 56 : 40,
                      borderRadius: 6,
                      border: isAct ? '2px solid #1a1a1a' : '1.5px solid rgba(26,26,26,0.14)',
                      background: isAct ? '#1a1a1a' : 'rgba(26,26,26,0.04)',
                      cursor: 'pointer',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'flex-end',
                      padding: '0 0 4px',
                      WebkitTapHighlightColor: 'transparent',
                      transition: `all 0.24s ${SPRING_BTN}`,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onTouchStart={e => { if (!isAct) e.currentTarget.style.transform = 'scale(0.9)' }}
                    onTouchEnd={e => {
                      e.currentTarget.style.transition = `all 0.28s ${SPRING_BTN}`
                      e.currentTarget.style.transform = 'scale(1)'
                    }}
                  >
                    {/* 页面内容线条模拟 */}
                    {[0,1,2].map(j => (
                      <div key={j} style={{
                        position: 'absolute',
                        top: 6 + j * 6, left: '20%', right: '20%',
                        height: 2, borderRadius: 1,
                        background: isAct ? 'rgba(255,255,255,0.25)' : 'rgba(26,26,26,0.1)',
                        width: j === 1 ? '40%' : '60%',
                      }} />
                    ))}
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700,
                      color: isAct ? '#fff' : '#aaa',
                      fontFamily: 'Space Mono, monospace',
                      lineHeight: 1,
                    }}>{pg}</span>
                  </button>
                )
              })}
              {overflow > 0 && (
                <div style={{
                  flex: '0 0 28px', height: 40, borderRadius: 6,
                  border: '1.5px dashed rgba(26,26,26,0.14)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.6rem', color: '#bbb', fontFamily: 'Space Mono, monospace',
                }}>
                  +{overflow}
                </div>
              )}
            </div>

            {/* 当前页 label */}
            <div style={{
              marginTop: 10,
              fontSize: '0.72rem', color: '#999',
              fontFamily: 'Space Mono, monospace', letterSpacing: '0.04em',
            }}>
              {isZh ? `第 ${currentPage} 页 / 共 ${totalPages} 页` : `Page ${currentPage} of ${totalPages}`}
            </div>
          </div>

          {/* ── Actions row ── */}
          <div style={{
            display: 'flex', alignItems: 'stretch',
            borderTop: '1px solid rgba(26,26,26,0.07)',
          }}>
            {/* 添加页面 */}
            {onAddPage && (
              <button
                onClick={() => { onAddPage(); closePopover() }}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '14px 8px',
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  borderRight: onDeletePage ? '1px solid rgba(26,26,26,0.07)' : 'none',
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.1s ease',
                }}
                onTouchStart={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.05)' }}
                onTouchEnd={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transition = `background 0.1s ease, transform 0.28s ${SPRING_BTN}`
                  e.currentTarget.style.transform = 'scale(1)'
                  setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.1s ease' }, 300)
                }}
                onTouchCancel={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(26,26,26,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.1rem', color: '#1a1a1a',
                  transition: `transform 0.28s ${SPRING_BTN}`,
                }}>＋</div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, color: '#1a1a1a',
                  fontFamily: 'Inter, DM Sans, sans-serif',
                }}>{isZh ? '添加页面' : 'Add page'}</span>
              </button>
            )}

            {/* 删除页面 */}
            {onDeletePage && !confirmDelete && (
              <button
                onClick={() => { if (totalPages > 1) setConfirmDelete(true) }}
                disabled={totalPages <= 1}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '14px 8px',
                  border: 'none', background: 'transparent',
                  cursor: totalPages <= 1 ? 'not-allowed' : 'pointer',
                  opacity: totalPages <= 1 ? 0.28 : 1,
                  WebkitTapHighlightColor: 'transparent',
                  transition: 'background 0.1s ease',
                }}
                onTouchStart={e => { if (totalPages > 1) e.currentTarget.style.background = 'rgba(220,60,60,0.06)' }}
                onTouchEnd={e => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.transition = `background 0.1s ease, transform 0.28s ${SPRING_BTN}`
                  e.currentTarget.style.transform = 'scale(1)'
                  setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.1s ease' }, 300)
                }}
                onTouchCancel={e => { e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(220,60,60,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.05rem',
                }}>🗑</div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, color: '#c03030',
                  fontFamily: 'Inter, DM Sans, sans-serif',
                }}>{isZh ? '删除此页' : 'Delete page'}</span>
              </button>
            )}
          </div>{/* end actions row */}

          {/* 二次确认 — 从底部滑入替换操作行 */}
          {onDeletePage && confirmDelete && (
            <div style={{
              borderTop: '1px solid rgba(220,60,60,0.12)',
              background: 'rgba(220,60,60,0.04)',
              animation: 'confirmIn 0.22s ease both',
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px 8px',
                fontSize: '0.78rem', fontWeight: 500, color: '#c03030',
                fontFamily: 'Inter, DM Sans, sans-serif', lineHeight: 1.45,
              }}>
                {isZh ? '删除后无法恢复，确认吗？' : 'This cannot be undone — confirm?'}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px' }}>
                <button
                  onClick={() => setConfirmDelete(false)}
                  style={{
                    flex: 1, height: 36, borderRadius: 9,
                    border: '1px solid rgba(26,26,26,0.14)',
                    background: '#fff', color: '#555',
                    fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer',
                    fontFamily: 'Inter, DM Sans, sans-serif',
                    WebkitTapHighlightColor: 'transparent',
                    transition: `background 0.1s ease, transform 0.1s ease`,
                  }}
                  onTouchStart={e => { e.currentTarget.style.background = 'rgba(26,26,26,0.06)'; e.currentTarget.style.transform = 'scale(0.95)' }}
                  onTouchEnd={e => {
                    e.currentTarget.style.background = '#fff'
                    e.currentTarget.style.transition = `background 0.1s ease, transform 0.28s ${SPRING_BTN}`
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >{isZh ? '取消' : 'Cancel'}</button>
                <button
                  onClick={() => { onDeletePage(); closePopover() }}
                  style={{
                    flex: 1, height: 36, borderRadius: 9,
                    border: 'none',
                    background: '#c03030', color: '#fff',
                    fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
                    fontFamily: 'Inter, DM Sans, sans-serif',
                    WebkitTapHighlightColor: 'transparent',
                    transition: `background 0.1s ease, transform 0.1s ease`,
                    boxShadow: '0 2px 8px rgba(192,48,48,0.28)',
                  }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.95)'; e.currentTarget.style.background = '#a82828' }}
                  onTouchEnd={e => {
                    e.currentTarget.style.background = '#c03030'
                    e.currentTarget.style.transition = `background 0.1s ease, transform 0.28s ${SPRING_BTN}`
                    e.currentTarget.style.transform = 'scale(1)'
                  }}
                >{isZh ? '确认删除' : 'Delete'}</button>
              </div>
            </div>
          )}

          {/* 小三角指向页码按钮 */}
          <div style={{
            position: 'absolute', bottom: -7, left: '50%', transform: 'translateX(-50%)',
            width: 14, height: 8,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}>
            <div style={{
              width: 14, height: 14,
              background: '#fff',
              borderRight: '1px solid rgba(26,26,26,0.06)',
              borderBottom: '1px solid rgba(26,26,26,0.06)',
              transform: 'rotate(45deg) translateY(-8px)',
              boxShadow: '2px 2px 4px rgba(0,0,0,0.06)',
            }} />
          </div>
        </div>
      )}

      {/* ── Bottom Bar ── */}
      <div
        ref={barRef}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          background: 'rgba(247,247,245,0.92)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(26,26,26,0.08)',
        }}
      >
        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ZoomBtn label="−"                 onPress={onZoomOut} />
          <ZoomBtn label={`${displayZoom}%`} onPress={onZoomFit} wide />
          <ZoomBtn label="+"                 onPress={onZoomIn} />
        </div>

        {/* Page pill — 点击弹 popover */}
        <button
          ref={pageBtnRef}
          onClick={() => pagePopover ? closePopover() : openPopover()}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 11px 6px 8px', borderRadius: 20,
            border: pagePopover
              ? '1px solid rgba(26,26,26,0.2)'
              : '1px solid rgba(26,26,26,0.11)',
            background: pagePopover ? 'rgba(26,26,26,0.08)' : 'rgba(26,26,26,0.04)',
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            transition: `background 0.15s ease, border-color 0.15s ease, transform 0.1s ease`,
          }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.94)'; e.currentTarget.style.background = 'rgba(26,26,26,0.11)' }}
          onTouchEnd={e => {
            e.currentTarget.style.background = pagePopover ? 'rgba(26,26,26,0.08)' : 'rgba(26,26,26,0.04)'
            e.currentTarget.style.transition = `background 0.15s ease, border-color 0.15s ease, transform 0.28s ${SPRING_BTN}`
            e.currentTarget.style.transform = 'scale(1)'
            setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'background 0.15s ease, border-color 0.15s ease, transform 0.1s ease' }, 300)
          }}
        >
          {/* Mini page dots */}
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            {Array.from({ length: Math.min(totalPages, 6) }).map((_, i) => {
              const isAct = i + 1 === currentPage
              return (
                <div key={i} style={{
                  width: isAct ? 14 : 4, height: 4, borderRadius: 2,
                  background: isAct ? '#1a1a1a' : 'rgba(26,26,26,0.2)',
                  transition: `width 0.28s ${SPRING_BTN}, background 0.18s ease`,
                  flexShrink: 0,
                }} />
              )
            })}
          </div>
          <span style={{
            fontSize: '0.7rem', color: '#777',
            fontFamily: 'Space Mono, monospace', letterSpacing: '0.04em', lineHeight: 1,
          }}>
            {currentPage} / {totalPages}
          </span>
          <span style={{
            fontSize: '0.55rem', color: '#c0c0c0', lineHeight: 1,
            transform: pagePopover ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            marginLeft: -2,
          }}>▲</span>
        </button>

        {/* + FAB */}
        <button
          onClick={onAdd}
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: '#1a1a1a', border: 'none',
            color: '#fff', fontSize: '1.4rem', lineHeight: 1,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 12px rgba(0,0,0,0.22)',
            WebkitTapHighlightColor: 'transparent', flexShrink: 0,
            transition: 'transform 0.1s ease, box-shadow 0.1s ease',
          }}
          onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.88)'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(0,0,0,0.18)' }}
          onTouchEnd={e => {
            e.currentTarget.style.transition = `transform 0.36s ${SPRING_BTN}, box-shadow 0.2s ease`
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.22)'
            setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transition = 'transform 0.1s ease, box-shadow 0.1s ease' }, 380)
          }}
        >＋</button>
      </div>
    </>
  )
}