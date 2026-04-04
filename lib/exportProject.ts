import { Project } from '../types'
import { Block, School, ExportOptions, THEMES, FONTS, buildExportHTML, buildExportCSS } from './exportStyles'

export type { Block, School, ExportOptions }

// ── 工具：把单页 blocks 转成完整 HTML（保留 absolute 定位，不走线性）──────────
function buildPageHTML(
  blocks: Block[],
  project: Project,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
  canvasW: number,
  canvasH: number,
): string {
  const css = buildExportCSS(opts, isZh)
  const t = THEMES[opts.theme] || THEMES.sensei

  // 直接用 pixelPos 的 absolute 坐标，100% 还原画布
  const innerBlocks = blocks.map(b => {
    if (!b.pixelPos) return ''
    const { x, y, w, h } = b.pixelPos
    // 复用 exportStyles 里的单 block 渲染（需要导出 renderBlockHTML，见下方说明）
    const inner = renderBlockHTMLForExport(b, project, schools, opts, isZh)
    return inner.replace(
      /^<div class="block([^"]*)"([^>]*)>/,
      `<div class="block$1"$2 style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;">`
    )
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>${project.title}</title>
  <style>
    ${css}
    body {
      margin: 0;
      padding: 0;
      width: ${canvasW}px;
      height: ${canvasH}px;
      overflow: hidden;
      background: ${t.bg};
    }
  </style>
</head>
<body>
  <div style="position:relative;width:${canvasW}px;height:${canvasH}px;">
    ${innerBlocks}
  </div>
</body>
</html>`
}

// ── PDF（Playwright 服务端路线）────────────────────────────────────────────────
export async function exportPDF(
  project: Project,
  pages: Array<{ blocks: Block[]; width: number; height: number }>,
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
) {
  const payload = {
    filename: `${project.title.replace(/\s+/g, '_')}_${opts.theme}`,
    pages: pages.map(p => ({
      html: buildPageHTML(p.blocks, project, schools, opts, isZh, p.width, p.height),
      width: p.width,
      height: p.height,
    })),
  }

  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) throw new Error(`PDF export failed: ${res.statusText}`)

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = payload.filename + '.pdf'
  a.click()
  URL.revokeObjectURL(url)
}

// ── WORD (docx) ───────────────────────────────────────────────────────────────
// （保持原来的 exportDOCX 不变，直接粘贴你原有的实现即可）
export { exportDOCX } from './exportProjectDocx'

// ── 内部：单 block HTML 渲染（从 exportStyles 抽出或直接 import）─────────────
// 注意：需要把 exportStyles.ts 里的 renderBlockHTML 改为 export function
// 然后这里直接 import { renderBlockHTML as renderBlockHTMLForExport } from './exportStyles'
// 临时 shim（删掉这行，替换成上面的 import）:
import { renderBlockHTML as renderBlockHTMLForExport } from './exportStyles'
