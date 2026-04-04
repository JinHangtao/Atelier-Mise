// ─── 集成示例：如何把网格系统接入你现有的页面 ─────────────────────────────────
//
// 你的顶层组件（page.tsx 或 DrawPanel）里：

import { useGridSystem } from './useGridSystem'
import { GridOverlay }   from './GridOverlay'
import { GridToolbar }   from './GridToolbar'

// ── 1. 在顶层或 page 组件里初始化 hook ──────────────────────────────────────
export function DrawPanel() {
  const gridHook = useGridSystem()

  // ...其他 hooks (useImageEditor, useSegmentation, 等)

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>
      {/* CanvasArea 接收 gridState */}
      <CanvasArea gridHook={gridHook} />

      {/* RightPanel 接收 gridHook 用于控制 */}
      <RightPanel gridHook={gridHook} />
    </div>
  )
}

// ── 2. CanvasArea：把 GridOverlay 叠加在画布上 ───────────────────────────────
import { GridOverlay } from './GridOverlay'

interface CanvasAreaProps {
  gridHook: ReturnType<typeof useGridSystem>
  // ...你现有的 props
}

function CanvasArea({ gridHook }: CanvasAreaProps) {
  const canvasRef = useRef<HTMLDivElement>(null)

  // 从你现有的 useImageEditor 或 state 拿到 scale、canvasSize
  const { scale, canvasSize } = useImageEditor()  // 你已有的 hook

  return (
    <div
      ref={canvasRef}
      style={{ position: 'relative', flex: 1, overflow: 'hidden' }}
    >
      {/* 你现有的画布内容 */}
      <canvas id="main-canvas" />

      {/* ⬇ 叠加网格 —— 就这一行 */}
      <GridOverlay
        gridState={gridHook.gridState}
        width={canvasSize.width}
        height={canvasSize.height}
        scale={scale}
      />
    </div>
  )
}

// ── 3. RightPanel：渲染工具栏 ────────────────────────────────────────────────
import { GridToolbar } from './GridToolbar'

function RightPanel({ gridHook }: { gridHook: ReturnType<typeof useGridSystem> }) {
  return (
    <aside style={{ width: 200, borderLeft: '1px solid var(--border)' }}>
      {/* 你现有的 RightPanel 内容 */}

      {/* ⬇ 在合适位置插入 GridToolbar */}
      <GridToolbar hook={gridHook} />
    </aside>
  )
}


// ── 可选：键盘快捷键 ─────────────────────────────────────────────────────────
// 在 DrawPanel 或 page 组件里加：
useEffect(() => {
  const handleKey = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === "'") {          // Ctrl+' 切换列网格
      gridHook.setActiveGrid('column')
    }
    if (e.ctrlKey && e.altKey && e.key === "'") { // Ctrl+Alt+' 切换基线网格
      gridHook.setActiveGrid('baseline')
    }
    if (e.key === 'Escape') {
      gridHook.hideGrid()
    }
  }
  window.addEventListener('keydown', handleKey)
  return () => window.removeEventListener('keydown', handleKey)
}, [gridHook])
