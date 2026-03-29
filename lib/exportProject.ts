import { Project } from '../types'
import { Block, School, ExportOptions, THEMES, FONTS, buildExportHTML } from './exportStyles'

export type { Block, School, ExportOptions }

// ── PDF ──────────────────────────────────────────────────────────────────────
export async function exportPDF(
  project: Project,
  blocks: Block[],
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
) {
  const win = window.open('', '_blank')
  if (!win) return

  const html = buildExportHTML(blocks, project, schools, opts, isZh)
  // Inject print-trigger script before closing </body>
  const printable = html.replace(
    '</body>',
    `<script>window.onload=()=>{window.print();}<\/script></body>`,
  )

  win.document.write(printable)
  win.document.close()
}

// ── WORD (docx) ───────────────────────────────────────────────────────────────
export async function exportDOCX(
  project: Project,
  blocks: Block[],
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
) {
  const { Document, Paragraph, TextRun, HeadingLevel, Packer, BorderStyle } = await import('docx')
  const { saveAs } = await import('file-saver')

  const t = THEMES[opts.theme] || THEMES.sensei
  const f = FONTS[opts.font] || FONTS.mixed

  // Strip rgba/hex alpha for docx (needs 6-char hex)
  const hex = (color: string): string => {
    // already 6-char hex
    if (/^#[0-9a-fA-F]{6}$/.test(color)) return color.replace('#', '')
    // 3-char hex
    if (/^#[0-9a-fA-F]{3}$/.test(color)) {
      const [, r, g, b] = color
      return `${r}${r}${g}${g}${b}${b}`
    }
    // rgba — strip alpha, take rgb
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (m) return [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('')
    return '1a1a1a'
  }

  const textColor   = hex(t.text)
  const mutedColor  = hex(t.muted)
  const accentColor = hex(t.accent)
  const subtleColor = hex(t.subtle)

  // Font stacks → first font name only (docx doesn't do CSS stacks)
  const bodyFont    = f.bodyStack.replace(/^["']?([^"',]+)["']?.*/, '$1').trim()
  const headingFont = f.headingStack.replace(/^["']?([^"',]+)["']?.*/, '$1').trim()

  const para = (
    text: string,
    pOpts?: {
      bold?: boolean
      size?: number
      color?: string
      font?: string
      heading?: typeof HeadingLevel[keyof typeof HeadingLevel]
      italic?: boolean
      strike?: boolean
    },
  ) =>
    new Paragraph({
      heading: pOpts?.heading,
      children: [
        new TextRun({
          text,
          bold: pOpts?.bold,
          italics: pOpts?.italic,
          strike: pOpts?.strike,
          size: pOpts?.size ?? 22,
          color: pOpts?.color ?? textColor,
          font: pOpts?.font ?? bodyFont,
        }),
      ],
    })

  const divider = () =>
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 1, color: hex(t.border) || 'DCDCDA' } },
      children: [],
    })

  const gap = () => new Paragraph({ children: [] })

  const children: InstanceType<typeof Paragraph>[] = []

  for (const b of blocks) {
    if (b.type === 'title') {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: project.title, bold: true, size: 56, color: textColor, font: headingFont })],
        }),
        para(`${project.category ?? ''}  ·  ${project.status ?? ''}`, { size: 18, color: mutedColor }),
        gap(),
        ...(project.description ? [para(project.description, { size: 20, color: mutedColor }), gap()] : []),
        divider(),
      )
      continue
    }

    if (b.type === 'note') {
      children.push(
        para(b.content, { size: 20, italic: true }),
        ...(b.caption ? [para(b.caption, { size: 18, color: mutedColor, italic: true })] : []),
        gap(),
      )
      continue
    }

    if (b.type === 'custom') {
      children.push(
        para(b.content, { size: 20 }),
        gap(),
      )
      continue
    }

    if (b.type === 'milestone') {
      children.push(
        para(isZh ? '进度节点' : 'Milestones', { bold: true, size: 24, font: headingFont }),
      )
      for (const m of project.milestones) {
        const check = m.status === 'done' ? '✓' : '○'
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${check}  ${m.title}`, size: 20, color: m.status === 'done' ? subtleColor : textColor, strike: m.status === 'done', font: bodyFont }),
              ...(m.date ? [new TextRun({ text: `  —  ${m.date}`, size: 18, color: mutedColor, font: bodyFont })] : []),
            ],
          }),
        )
        if ((m as any).note) children.push(para(`    ${(m as any).note}`, { size: 18, color: mutedColor }))
      }
      children.push(gap(), divider())
      continue
    }

    if (b.type === 'image' || b.type === 'image-row') {
      // docx image embedding requires ArrayBuffer from URL — skip silently or add note
      children.push(
        para(`[${isZh ? '图片' : 'Image'}${b.caption ? `: ${b.caption}` : ''}]`, { size: 18, color: mutedColor, italic: true }),
        gap(),
      )
      continue
    }

    if (b.type === 'school-profile') {
      const school = schools.find(s => s.id === b.content)
      if (!school) continue
      const displayName = isZh ? (school.nameZh || school.name) : school.name
      const displayDept = isZh ? (school.departmentZh || school.department) : school.department

      children.push(
        para(`${school.country}${school.deadline ? `  ·  ${isZh ? '截止' : 'Deadline'}: ${school.deadline}` : ''}`, { size: 18, color: mutedColor }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: displayName, bold: true, size: 36, color: textColor, font: headingFont })],
        }),
        ...(displayDept ? [para(displayDept, { size: 20, color: mutedColor })] : []),
        ...(school.requirements ? [
          gap(),
          para(isZh ? '申请要求' : 'Requirements', { bold: true, size: 20, color: hex(t.accentWarm) }),
          para(school.requirements, { size: 20 }),
        ] : []),
        ...(school.aiStatement ? [
          gap(),
          para(isZh ? 'AI 申请文书' : 'Application Statement', { bold: true, size: 20, color: accentColor }),
          para(school.aiStatement, { size: 20 }),
        ] : []),
        gap(),
        divider(),
      )
      continue
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${project.title.replace(/\s+/g, '_')}_${opts.theme}.docx`)
}