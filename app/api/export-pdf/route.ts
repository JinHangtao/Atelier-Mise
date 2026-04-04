// app/api/export-pdf/route.ts
// 安装依赖: npm install playwright-core
// 首次运行: npx playwright install chromium

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright-core'

export const maxDuration = 60 // Vercel Pro / self-host

interface ExportPayload {
  pages: Array<{
    html: string   // 每页完整的 <!DOCTYPE html>...</html>
    width: number  // 画布像素宽度
    height: number // 画布像素高度
  }>
  filename: string
}

export async function POST(req: NextRequest) {
  const { pages, filename }: ExportPayload = await req.json()

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
  })

  try {
    const pdfBuffers: Buffer[] = []

    for (const p of pages) {
      const page = await browser.newPage()

      // 固定视口 = 画布实际尺寸，保证 1:1 还原
      await page.setViewportSize({ width: p.width, height: p.height })
      await page.setContent(p.html, { waitUntil: 'networkidle' })

      // 等待 Google Fonts 等 web font 渲染完成
      await page.evaluate(() => document.fonts.ready)

      const pdf = await page.pdf({
        width: `${p.width}px`,
        height: `${p.height}px`,
        printBackground: true,
        // 不设 margin，让画布内容自己控制间距
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      })

      pdfBuffers.push(Buffer.from(pdf))
      await page.close()
    }

    // 多页合并：用 pdf-lib 拼接
    const { PDFDocument } = await import('pdf-lib')
    const merged = await PDFDocument.create()

    for (const buf of pdfBuffers) {
      const src = await PDFDocument.load(buf)
      const copied = await merged.copyPages(src, src.getPageIndices())
      copied.forEach(p => merged.addPage(p))
    }

    const mergedBytes = await merged.save()

    return new NextResponse(mergedBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}.pdf"`,
      },
    })
  } finally {
    await browser.close()
  }
}
