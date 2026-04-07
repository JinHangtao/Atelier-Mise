import { useCallback, useRef, useState } from 'react'
import { importCanvasFile } from './canvasFormat'
import { Project } from '../types'
import { PageData } from './exportStyles'

export interface CanvasPendingImport {
  title: string
  project: Project
  pages: PageData[]
  loadAsset: (id: string) => Promise<string>
}

export function useCanvasImport(
  onSave: (data: CanvasPendingImport) => void,
) {
  const [pending, setPending] = useState<CanvasPendingImport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.canvas')) {
      setError('请选择 .canvas 文件')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await importCanvasFile(file)
      setPending({
        title: result.project.title,
        project: result.project,
        pages: result.pages,
        loadAsset: result.loadAsset,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件解析失败')
    } finally {
      setLoading(false)
    }
  }, [])

  // 拖拽事件处理，挂到任意容器上
  const dragProps = {
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
  }

  // 文件选择器触发
  const openFilePicker = () => inputRef.current?.click()

  const confirmSave = useCallback(() => {
    if (!pending) return
    onSave(pending)
    setPending(null)
  }, [pending, onSave])

  const dismiss = useCallback(() => {
    setPending(null)
    setError(null)
  }, [])

  return {
    pending,
    error,
    loading,
    dragProps,
    openFilePicker,
    confirmSave,
    dismiss,
    inputRef,
    handleFile,
  }
}
