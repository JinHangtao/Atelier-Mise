'use client'
import React, { useRef, useCallback, useEffect } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableCell {
  text: string
  align: 'left' | 'center' | 'right'
  bold?: boolean
  color?: string
}

export interface TableData {
  rows: TableCell[][]       // [行][列]
  colWidths: number[]       // 每列宽度比例（0~1，总和=1）
  headerRow?: boolean       // 首行高亮
  headerCol?: boolean       // 首列高亮
  borderColor?: string      // 边框颜色
  fontSize?: number         // 表格字号
  fontFamily?: string       // 字体
  cellPadding?: number      // 单元格内边距 px
}

export const DEFAULT_TABLE_DATA: TableData = {
  rows: [
    [{ text: '标题 A', align: 'left', bold: true }, { text: '标题 B', align: 'left', bold: true }, { text: '标题 C', align: 'left', bold: true }],
    [{ text: '',       align: 'left' }, { text: '',       align: 'left' }, { text: '',       align: 'left' }],
    [{ text: '',       align: 'left' }, { text: '',       align: 'left' }, { text: '',       align: 'left' }],
  ],
  colWidths: [0.333, 0.333, 0.334],
  headerRow: true,
  headerCol: false,
  borderColor: 'rgba(26,26,26,0.12)',
  fontSize: 13,
  fontFamily: 'Inter, DM Sans, sans-serif',
  cellPadding: 10,
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TableBlockProps {
  tableData: TableData
  isEditing: boolean            // 是否处于编辑模式（双击进入）
  isSelected: boolean
  blockWidth: number            // block 的像素宽度（来自 pixelPos.w）
  onChange: (data: TableData) => void
  onHeightChange: (h: number) => void  // 内容撑高后通知父层更新 pixelPos.h
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TableBlock({
  tableData,
  isEditing,
  isSelected,
  blockWidth,
  onChange,
  onHeightChange,
}: TableBlockProps) {
  const tableRef = useRef<HTMLTableElement>(null)
  const resizingCol = useRef<{ colIdx: number; startX: number; startWidths: number[] } | null>(null)

  // ── 自动上报高度 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!tableRef.current) return
    const ro = new ResizeObserver(() => {
      if (tableRef.current) onHeightChange(tableRef.current.offsetHeight)
    })
    ro.observe(tableRef.current)
    return () => ro.disconnect()
  }, [onHeightChange])

  // ── 单元格文字更新 ────────────────────────────────────────────────────────
  const updateCell = useCallback((ri: number, ci: number, patch: Partial<TableCell>) => {
    const newRows = tableData.rows.map((row, r) =>
      row.map((cell, c) => r === ri && c === ci ? { ...cell, ...patch } : cell)
    )
    onChange({ ...tableData, rows: newRows })
  }, [tableData, onChange])

  // ── 列宽拖拽 ─────────────────────────────────────────────────────────────
  const onColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    resizingCol.current = { colIdx, startX: e.clientX, startWidths: [...tableData.colWidths] }

    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return
      const { colIdx: ci, startX, startWidths } = resizingCol.current
      const dx = ev.clientX - startX
      const totalW = blockWidth
      const deltaRatio = dx / totalW
      const newWidths = [...startWidths]
      const minRatio = 40 / totalW  // 最小列宽 40px

      // 左列变宽右列变窄，两侧约束
      const left  = Math.max(minRatio, newWidths[ci] + deltaRatio)
      const right = Math.max(minRatio, newWidths[ci + 1] - deltaRatio)
      const diff  = (newWidths[ci] + newWidths[ci + 1]) - (left + right)
      if (Math.abs(diff) < 0.001) {
        newWidths[ci]     = left
        newWidths[ci + 1] = right
        onChange({ ...tableData, colWidths: newWidths })
      }
    }
    const onUp = () => {
      resizingCol.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [tableData, onChange, blockWidth])

  const { rows, colWidths, headerRow, headerCol, borderColor, fontSize, fontFamily, cellPadding } = tableData
  const border = `1px solid ${borderColor ?? 'rgba(26,26,26,0.12)'}`
  const pad    = cellPadding ?? 10
  const fs     = fontSize ?? 13
  const ff     = fontFamily ?? 'Inter, DM Sans, sans-serif'

  return (
    <div style={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
      <table
        ref={tableRef}
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          fontFamily: ff,
          fontSize: fs,
        }}
      >
        {/* 列宽定义 */}
        <colgroup>
          {colWidths.map((w, ci) => (
            <col key={ci} style={{ width: `${(w * 100).toFixed(2)}%` }} />
          ))}
        </colgroup>

        <tbody>
          {rows.map((row, ri) => {
            const isHeaderRow = headerRow && ri === 0
            return (
              <tr key={ri}>
                {row.map((cell, ci) => {
                  const isHeaderCol = headerCol && ci === 0
                  const isHeader    = isHeaderRow || isHeaderCol
                  const isLastCol   = ci === row.length - 1

                  return (
                    <td
                      key={ci}
                      style={{
                        border,
                        padding: 0,
                        position: 'relative',
                        background: isHeader ? 'rgba(26,26,26,0.04)' : 'transparent',
                        verticalAlign: 'top',
                      }}
                    >
                      {/* contentEditable 文字区域 */}
                      <div
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        onInput={e => {
                          updateCell(ri, ci, { text: (e.target as HTMLDivElement).innerText })
                        }}
                        onKeyDown={e => {
                          // Tab 跳下一格
                          if (e.key === 'Tab') {
                            e.preventDefault()
                            const allCells = tableRef.current?.querySelectorAll('[contenteditable]')
                            if (!allCells) return
                            const arr    = Array.from(allCells)
                            const curIdx = arr.indexOf(e.currentTarget as HTMLDivElement)
                            const next   = arr[curIdx + (e.shiftKey ? -1 : 1)] as HTMLElement | undefined
                            next?.focus()
                          }
                          // 阻止 undo 冒泡到画布
                          if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation()
                        }}
                        style={{
                          display:      'block',
                          minHeight:    `${fs * 1.6}px`,
                          padding:      `${pad}px`,
                          outline:      'none',
                          textAlign:    cell.align,
                          fontWeight:   isHeader || cell.bold ? 700 : 400,
                          color:        cell.color ?? '#1a1a1a',
                          lineHeight:   1.6,
                          whiteSpace:   'pre-wrap',
                          wordBreak:    'break-word',
                          cursor:       isEditing ? 'text' : 'default',
                          userSelect:   isEditing ? 'text' : 'none',
                          // 让文字不可见地保持值（避免 React 与 contentEditable 冲突）
                        }}
                        // 只在首次 mount 或值变化时同步（避免光标跳位）
                        dangerouslySetInnerHTML={undefined}
                        ref={el => {
                          if (el && el.innerText !== cell.text && document.activeElement !== el) {
                            el.innerText = cell.text
                          }
                        }}
                      />

                      {/* 列宽拖拽手柄（非最后列） */}
                      {isEditing && !isLastCol && (
                        <div
                          onMouseDown={e => onColResizeStart(e, ci)}
                          style={{
                            position: 'absolute',
                            top: 0, right: -3,
                            width: 6, height: '100%',
                            cursor: 'col-resize',
                            zIndex: 10,
                            background: isSelected ? 'rgba(26,26,26,0.08)' : 'transparent',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(26,26,26,0.18)')}
                          onMouseLeave={e => (e.currentTarget.style.background = isSelected ? 'rgba(26,26,26,0.08)' : 'transparent')}
                        />
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
