import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Project } from '../types'
import { Block, PageData } from './exportStyles'

// ── 导出：把当前项目打包成 .canvas 文件 ──────────────────────────────────────
export async function exportCanvasFile(
  project: Project,
  pages: PageData[],
  filename?: string,
) {
  const zip = new JSZip()
  const assetMap: Record<string, string> = {}

  // 1. 处理每一页，把图片从 blocks 里抽出来单独存
  const pagesStripped = await Promise.all(pages.map(async (page, i) => {
    const strippedBlocks = await Promise.all(page.blocks.map(async (block) => {
      const b = { ...block }

      // 处理单图
      if (b.images?.length) {
        b.images = await Promise.all(b.images.map(async (img) => {
          if (!img.startsWith('data:')) return img // 已是 URL，直接保留
          const id = `img_${Math.random().toString(36).slice(2, 10)}`
          const blob = base64ToBlob(img)
          zip.file(`assets/${id}.webp`, blob)
          assetMap[id] = `assets/${id}.webp`
          return `asset:${id}` // 替换成引用
        }))
      }

      return b
    }))

    zip.file(`pages/page_${i}.json`, JSON.stringify({ ...page, blocks: strippedBlocks }, null, 2))
    return i
  }))

  // 2. 写 project.json
  zip.file('project.json', JSON.stringify(project, null, 2))

  // 3. 写 manifest.json
  const manifest = {
    format: 'canvas',
    version: '1',
    title: project.title,
    pageCount: pages.length,
    exportedAt: new Date().toISOString(),
    assets: assetMap,
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  // 4. 打包下载
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  saveAs(blob, `${filename ?? project.title}.canvas`)
}

// ── 导入：读取 .canvas 文件，懒加载资源 ──────────────────────────────────────
export async function importCanvasFile(file: File): Promise<{
  project: Project
  pages: PageData[]
  loadAsset: (id: string) => Promise<string> // 按需加载图片，返回 base64
}> {
  const zip = await JSZip.loadAsync(file)

  // 1. 读 manifest
  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  if (manifest.format !== 'canvas') throw new Error('不是有效的 .canvas 文件')

  // 2. 读 project
  const project: Project = JSON.parse(await zip.file('project.json')!.async('string'))

  // 3. 读所有页（只读 JSON，不加载图片）
  const pages: PageData[] = await Promise.all(
    Array.from({ length: manifest.pageCount }, async (_, i) => {
      const raw = await zip.file(`pages/page_${i}.json`)!.async('string')
      return JSON.parse(raw) as PageData
    })
  )

  // 4. 懒加载函数：用到时才从 ZIP 里读图片
  const assetCache: Record<string, string> = {}
  async function loadAsset(id: string): Promise<string> {
    if (assetCache[id]) return assetCache[id]
    const path = manifest.assets[id]
    if (!path) throw new Error(`Asset not found: ${id}`)
    const blob = await zip.file(path)!.async('blob')
    const url = URL.createObjectURL(blob)
    assetCache[id] = url
    return url
  }

  return { project, pages, loadAsset }
}

// ── 工具函数 ──────────────────────────────────────────────────────────────────
function base64ToBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/webp'
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}