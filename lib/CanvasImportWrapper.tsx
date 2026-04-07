'use client'
import { CanvasImportToast } from './CanvasImportToast'

export function CanvasImportWrapper() {
  return (
    <CanvasImportToast onSave={({ project, pages }) => {
      localStorage.setItem('canvas_draft', JSON.stringify({ project, pages }))
    }} />
  )
}