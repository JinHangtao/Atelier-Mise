'use client'
import { useEffect, useRef } from 'react'
import { useCanvasImport, CanvasPendingImport } from './useCanvasImport'
import { Project } from '../types'
import { PageData } from './exportStyles'

interface Props {
  // 调用方决定"保存"具体做什么——写 localStorage、触发 store、跳转页面都行
  onSave: (data: CanvasPendingImport) => void
  // 可选：把拖拽区域绑到外层容器而不是整个 window
  dragTarget?: 'window' | 'none'
}

export function CanvasImportToast({ onSave, dragTarget = 'window' }: Props) {
  const {
    pending,
    error,
    loading,
    dragProps,
    openFilePicker,
    confirmSave,
    dismiss,
    inputRef,
    handleFile,
  } = useCanvasImport(onSave)

  // 把拖拽挂到 window（默认），这样整个页面都能拖入
  useEffect(() => {
    if (dragTarget !== 'window') return
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files[0]
      if (file) handleFile(file)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [dragTarget, handleFile])

  return (
    <>
      {/* 隐藏的文件选择器，供外部调用 openFilePicker() 触发 */}
      <input
        ref={inputRef}
        type="file"
        accept=".canvas"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {/* 加载中提示 */}
      {loading && (
        <div style={styles.toast}>
          <div style={styles.iconRow}>
            <Spinner />
            <span style={styles.title}>正在读取文件…</span>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && !loading && (
        <div style={{ ...styles.toast, ...styles.errorToast }}>
          <div style={styles.iconRow}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={styles.title}>{error}</span>
          </div>
          <button onClick={dismiss} style={styles.dismissBtn}>关闭</button>
        </div>
      )}

      {/* 核心：检测到 .canvas 文件后的保存询问 */}
      {pending && !loading && !error && (
        <div style={styles.toast}>
          <div style={styles.header}>
            <FileIcon />
            <div>
              <div style={styles.title}>检测到项目文件</div>
              <div style={styles.subtitle}>「{pending.title}」</div>
            </div>
          </div>
          <div style={styles.meta}>
            {pending.pages.length} 个页面 · 拖入或选择打开
          </div>
          <div style={styles.actions}>
            <button onClick={dismiss} style={styles.cancelBtn}>取消</button>
            <button onClick={confirmSave} style={styles.saveBtn}>保存到本地 →</button>
          </div>
        </div>
      )}
    </>
  )
}

// ── 给外部用的文件选择按钮（可选） ────────────────────────────────────────────
// 用法：<OpenCanvasButton onSave={...} />
export function OpenCanvasButton({ onSave }: { onSave: (data: CanvasPendingImport) => void }) {
  const { openFilePicker, inputRef, handleFile, pending, confirmSave, dismiss, loading, error } = useCanvasImport(onSave)
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".canvas"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      <button onClick={openFilePicker} style={styles.openBtn}>
        打开 .canvas 文件
      </button>
    </>
  )
}

// ── 样式 ──────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 9999,
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 16,
    padding: '16px 18px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.06)',
    minWidth: 260,
    maxWidth: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    fontFamily: '"DM Sans","PingFang SC",sans-serif',
    animation: 'canvas-toast-in 0.22s cubic-bezier(0.34,1.56,0.64,1)',
  },
  errorToast: {
    borderColor: 'rgba(220,60,60,0.2)',
    background: '#fff8f8',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1a1a1a',
    lineHeight: 1.4,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    lineHeight: 1.4,
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 11,
    color: '#aaa',
    letterSpacing: '0.04em',
  },
  actions: {
    display: 'flex',
    gap: 8,
    marginTop: 2,
  },
  cancelBtn: {
    flex: 1,
    padding: '7px 0',
    background: 'transparent',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: 8,
    fontSize: 12,
    color: '#888',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  saveBtn: {
    flex: 2,
    padding: '7px 0',
    background: '#1a1a1a',
    border: 'none',
    borderRadius: 8,
    fontSize: 12,
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
    fontFamily: 'inherit',
  },
  dismissBtn: {
    alignSelf: 'flex-end',
    padding: '5px 12px',
    background: 'transparent',
    border: '1px solid rgba(220,60,60,0.2)',
    borderRadius: 6,
    fontSize: 11,
    color: '#c04040',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  openBtn: {
    padding: '8px 16px',
    background: '#1a1a1a',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}

// ── 小图标组件 ────────────────────────────────────────────────────────────────
function FileIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ flexShrink: 0 }}>
      <rect width="32" height="32" rx="8" fill="#f4f2ee"/>
      <path d="M10 8h8l4 4v12a1 1 0 01-1 1H11a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
      <path d="M18 8v4h4" stroke="#1a1a1a" strokeWidth="1.2" fill="none" strokeLinejoin="round"/>
      <text x="16" y="20" textAnchor="middle" fontSize="5" fontWeight="700"
        fill="#1a1a1a" fontFamily="DM Sans,sans-serif" letterSpacing="0.5">.canvas</text>
    </svg>
  )
}

function Spinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ animation: 'canvas-spin 0.8s linear infinite' }}>
      <circle cx="8" cy="8" r="6" stroke="#ddd" strokeWidth="2" fill="none"/>
      <path d="M8 2a6 6 0 016 6" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )
}

// 注入 keyframes（只注入一次）
if (typeof document !== 'undefined') {
  const id = '__canvas_toast_styles'
  if (!document.getElementById(id)) {
    const s = document.createElement('style')
    s.id = id
    s.textContent = `
      @keyframes canvas-toast-in {
        from { opacity: 0; transform: translateY(12px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes canvas-spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(s)
  }
}
