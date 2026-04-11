'use client'
import React, { useRef, useCallback, useEffect, useState } from 'react'

export interface TableCell {
  text: string
  align: 'left' | 'center' | 'right'
  bold?: boolean
  color?: string
}

export interface TableData {
  rows: TableCell[][]
  colWidths: number[]
  headerRow?: boolean
  headerCol?: boolean
  borderColor?: string
  fontSize?: number
  fontFamily?: string
  cellPadding?: number
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

interface TableBlockProps {
  tableData: TableData
  isEditing: boolean
  isSelected: boolean
  blockWidth: number
  onChange: (data: TableData) => void
  onHeightChange: (h: number) => void
}

export function TableBlock({
  tableData,
  isEditing,
  isSelected,
  blockWidth,
  onChange,
  onHeightChange,
}: TableBlockProps) {
  const tableRef    = useRef<HTMLTableElement>(null)
  const resizingCol = useRef<{ colIdx: number; startX: number; startWidths: number[] } | null>(null)
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null)

  // 退出编辑模式时清除激活格子
  useEffect(() => {
    if (!isEditing) setActiveCell(null)
  }, [isEditing])

  // 自动上报高度
  useEffect(() => {
    if (!tableRef.current) return
    const ro = new ResizeObserver(() => {
      if (tableRef.current) onHeightChange(tableRef.current.offsetHeight)
    })
    ro.observe(tableRef.current)
    return () => ro.disconnect()
  }, [onHeightChange])

  // 单元格文字更新
  const updateCell = useCallback((ri: number, ci: number, text: string) => {
    const newRows = tableData.rows.map((row, r) =>
      row.map((cell, c) => r === ri && c === ci ? { ...cell, text } : cell)
    )
    onChange({ ...tableData, rows: newRows })
  }, [tableData, onChange])

  // 列宽拖拽
  const onColResizeStart = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault()
    e.stopPropagation()
    resizingCol.current = { colIdx, startX: e.clientX, startWidths: [...tableData.colWidths] }
    const onMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return
      const { colIdx: ci, startX, startWidths } = resizingCol.current
      const dx         = ev.clientX - startX
      const deltaRatio = dx / blockWidth
      const newWidths  = [...startWidths]
      const minRatio   = 40 / blockWidth
      const left       = Math.max(minRatio, newWidths[ci]     + deltaRatio)
      const right      = Math.max(minRatio, newWidths[ci + 1] - deltaRatio)
      const diff       = (newWidths[ci] + newWidths[ci + 1]) - (left + right)
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
        style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontFamily: ff, fontSize: fs }}
      >
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
                  const isHeaderCol  = headerCol && ci === 0
                  const isHeader     = isHeaderRow || isHeaderCol
                  const isLastCol    = ci === row.length - 1
                  const isCellActive = isEditing && activeCell?.[0] === ri && activeCell?.[1] === ci

                  return (
                    <td
                      key={ci}
                      style={{
                        border,
                        padding: 0,
                        position: 'relative',
                        background: isHeader ? 'rgba(26,26,26,0.04)' : 'transparent',
                        verticalAlign: 'top',
                        boxShadow: isCellActive ? 'inset 0 0 0 2px rgba(66,133,244,0.6)' : undefined,
                      }}
                      onClick={() => { if (isEditing) setActiveCell([ri, ci]) }}
                    >
                      {isCellActive ? (
                        <textarea
                          className="no-drag"
                          autoFocus
                          defaultValue={cell.text}
                          onBlur={e => {
                            updateCell(ri, ci, e.target.value)
                            setTimeout(() => {
                              if (!tableRef.current?.contains(document.activeElement)) {
                                setActiveCell(null)
                              }
                            }, 0)
                          }}
                          onChange={e => updateCell(ri, ci, e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Tab') {
                              e.preventDefault()
                              const totalCols = row.length
                              const totalRows = rows.length
                              let nri = ri, nci = ci + (e.shiftKey ? -1 : 1)
                              if (nci >= totalCols) { nci = 0; nri++ }
                              if (nci < 0)          { nci = totalCols - 1; nri-- }
                              if (nri >= 0 && nri < totalRows) setActiveCell([nri, nci])
                              else setActiveCell(null)
                            }
                            if (e.key === 'Escape') { e.preventDefault(); setActiveCell(null) }
                            if ((e.metaKey || e.ctrlKey) && e.key === 'z') e.stopPropagation()
                          }}
                          style={{
                            display:    'block',
                            width:      '100%',
                            minHeight:  `${fs * 1.6 + pad * 2}px`,
                            padding:    `${pad}px`,
                            border:     'none',
                            outline:    'none',
                            resize:     'none',
                            overflow:   'hidden',
                            background: 'transparent',
                            fontFamily: ff,
                            fontSize:   fs,
                            fontWeight: isHeader || cell.bold ? 700 : 400,
                            color:      cell.color ?? '#1a1a1a',
                            lineHeight: 1.6,
                            textAlign:  cell.align,
                            boxSizing:  'border-box',
                            cursor:     'text',
                          }}
                          ref={el => {
                            if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
                          }}
                          onInput={e => {
                            const el = e.target as HTMLTextAreaElement
                            el.style.height = 'auto'
                            el.style.height = el.scrollHeight + 'px'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            display:    'block',
                            minHeight:  `${fs * 1.6 + pad * 2}px`,
                            padding:    `${pad}px`,
                            textAlign:  cell.align,
                            fontWeight: isHeader || cell.bold ? 700 : 400,
                            color:      cell.color ?? '#1a1a1a',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak:  'break-word',
                            cursor:     isEditing ? 'text' : 'default',
                            userSelect: 'none',
                          }}
                        >
                          {cell.text}
                        </div>
                      )}

                      {isEditing && !isLastCol && (
                        <div
                          className="no-drag"
                          onMouseDown={e => onColResizeStart(e, ci)}
                          style={{
                            position: 'absolute', top: 0, right: -3,
                            width: 6, height: '100%', cursor: 'col-resize', zIndex: 10,
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