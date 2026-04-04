import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, BorderStyle, ShadingType,
  Table, TableRow, TableCell, WidthType,
  ImageRun,
} from 'docx'
import { Project } from '../types'
import { Block, School, ExportOptions, THEMES } from './exportStyles'

// ── helpers ──────────────────────────────────────────────────────────────────

/** hex color WITHOUT '#' → docx wants "1A1A1A" not "#1A1A1A" */
function hex(c: string): string {
  return c.replace(/^#/, '')
}

/** fetch an image URL → ArrayBuffer + detect extension */
async function fetchImage(url: string): Promise<{ buf: ArrayBuffer; ext: 'png' | 'jpg' | 'gif' | 'svg' } | null> {
  try {
    // handle data URIs
    if (url.startsWith('data:')) {
      const m = url.match(/^data:image\/(png|jpeg|gif|svg\+xml);base64,(.+)/)
      if (!m) return null
      const binary = atob(m[2])
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const ext = m[1] === 'jpeg' ? 'jpg' : m[1] === 'svg+xml' ? 'svg' : m[1] as any
      return { buf: bytes.buffer, ext }
    }
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const ct = res.headers.get('content-type') || ''
    const ext = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : ct.includes('svg') ? 'svg' : 'jpg'
    return { buf, ext }
  } catch {
    return null
  }
}

// ── block → paragraphs converter ─────────────────────────────────────────────

async function blockToParagraphs(
  b: Block,
  project: Project,
  schools: School[],
  _opts: ExportOptions,
  isZh: boolean,
  theme: typeof THEMES[string],
): Promise<Paragraph[]> {
  const paras: Paragraph[] = []
  const textColor = hex(theme.text)
  const mutedColor = hex(theme.muted)

  // ── TITLE ──
  if (b.type === 'title') {
    const meta = [project.category, project.status].filter(Boolean).join(' · ')
    if (meta) {
      paras.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: meta, size: 20, color: mutedColor, font: 'Arial' })],
      }))
    }
    paras.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({
        text: project.title,
        size: 48,
        bold: true,
        color: textColor,
        font: b.fontFamily || 'Arial',
      })],
    }))
    if (project.description) {
      paras.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: project.description, size: 22, color: mutedColor, font: 'Arial' })],
      }))
    }
    return paras
  }

  // ── IMAGE ──
  if (b.type === 'image') {
    const img = await fetchImage(b.content)
    if (img) {
      try {
        paras.push(new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [new ImageRun({
            data: img.buf,
            transformation: { width: 500, height: 350 },
            type: img.ext as any,
          })],
        }))
      } catch {
        paras.push(new Paragraph({
          children: [new TextRun({ text: `[Image: ${b.caption || b.content}]`, italics: true, color: mutedColor })],
        }))
      }
    }
    if (b.caption) {
      paras.push(new Paragraph({
        spacing: { after: 200 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: b.caption, size: 18, italics: true, color: mutedColor, font: 'Arial' })],
      }))
    }
    return paras
  }

  // ── IMAGE-ROW ──
  if (b.type === 'image-row') {
    const imgs = b.images || []
    for (let i = 0; i < imgs.length; i++) {
      const img = await fetchImage(imgs[i])
      if (img) {
        try {
          paras.push(new Paragraph({
            spacing: { before: 80, after: 40 },
            children: [new ImageRun({
              data: img.buf,
              transformation: { width: 300, height: 220 },
              type: img.ext as any,
            })],
          }))
        } catch {
          paras.push(new Paragraph({
            children: [new TextRun({ text: `[Image ${i + 1}]`, italics: true, color: mutedColor })],
          }))
        }
      }
      const cap = (b.imageCaptions || [])[i]
      if (cap) {
        paras.push(new Paragraph({
          children: [new TextRun({ text: cap, size: 18, italics: true, color: mutedColor, font: 'Arial' })],
        }))
      }
    }
    if (b.caption) {
      paras.push(new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({ text: b.caption, size: 18, italics: true, color: mutedColor, font: 'Arial' })],
      }))
    }
    return paras
  }

  // ── NOTE ──
  if (b.type === 'note') {
    paras.push(new Paragraph({
      spacing: { before: 120, after: 120 },
      border: { left: { style: BorderStyle.SINGLE, size: 6, color: hex(theme.noteBorder), space: 8 } },
      children: [new TextRun({
        text: b.content,
        size: b.fontSize ? b.fontSize * 2 : 22,
        color: b.color ? hex(b.color) : textColor,
        font: b.fontFamily || 'Arial',
      })],
    }))
    if (b.caption) {
      paras.push(new Paragraph({
        spacing: { after: 160 },
        children: [new TextRun({ text: b.caption, size: 18, italics: true, color: mutedColor, font: 'Arial' })],
      }))
    }
    return paras
  }

  // ── CUSTOM ──
  if (b.type === 'custom') {
    // split by newlines to create separate paragraphs (docx doesn't support \n in TextRun)
    const lines = b.content.split('\n')
    for (const line of lines) {
      paras.push(new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({
          text: line,
          size: b.fontSize ? b.fontSize * 2 : 22,
          color: b.color ? hex(b.color) : textColor,
          font: b.fontFamily || 'Arial',
        })],
      }))
    }
    return paras
  }

  // ── MILESTONE ──
  if (b.type === 'milestone') {
    paras.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
      children: [new TextRun({
        text: isZh ? '进度节点' : 'Milestones',
        size: 28,
        bold: true,
        color: textColor,
        font: 'Arial',
      })],
    }))
    for (const m of project.milestones || []) {
      const icon = m.status === 'done' ? '✓ ' : '○ '
      paras.push(new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: icon, size: 22, color: m.status === 'done' ? hex(theme.accent) : mutedColor }),
          new TextRun({
            text: m.title,
            size: 22,
            color: textColor,
            font: 'Arial',
            strike: m.status === 'done',
          }),
          ...(m.date ? [new TextRun({ text: `  ${m.date}`, size: 18, color: mutedColor, font: 'Arial' })] : []),
        ],
      }))
    }
    return paras
  }

  // ── SCHOOL-PROFILE ──
  if (b.type === 'school-profile') {
    const school = schools.find(s => s.id === b.content)
    if (!school) return paras

    const displayName = isZh ? (school.nameZh || school.name) : school.name
    const displayDept = isZh ? (school.departmentZh || school.department) : school.department

    // country + deadline
    const meta = [school.country, school.deadline ? `${isZh ? '截止' : 'Deadline'}: ${school.deadline}` : ''].filter(Boolean).join(' · ')
    if (meta) {
      paras.push(new Paragraph({
        spacing: { before: 200, after: 40 },
        children: [new TextRun({ text: meta, size: 18, color: mutedColor, font: 'Arial' })],
      }))
    }

    // school name
    paras.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { after: 60 },
      children: [new TextRun({ text: displayName, size: 32, bold: true, color: textColor, font: 'Arial' })],
    }))

    // department
    if (displayDept) {
      paras.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: displayDept, size: 22, color: mutedColor, font: 'Arial' })],
      }))
    }

    // requirements box
    if (school.requirements) {
      const border = { style: BorderStyle.SINGLE, size: 1, color: hex(theme.border.replace(/rgba?\([^)]+\)/, 'DDDDDD')) }
      const borders = { top: border, bottom: border, left: border, right: border }
      paras.push(new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({
          text: isZh ? '申请要求' : 'Requirements',
          size: 20,
          bold: true,
          color: textColor,
          font: 'Arial',
        })],
      }))
      paras.push(new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: school.requirements, size: 22, color: textColor, font: 'Arial' })],
      }))
    }

    // AI statement box
    if (school.aiStatement) {
      paras.push(new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({
          text: isZh ? 'AI 申请文书' : 'Application Statement',
          size: 20,
          bold: true,
          color: hex(theme.accentWarm),
          font: 'Arial',
        })],
      }))
      // split statement into paragraphs
      const lines = school.aiStatement.split('\n').filter(Boolean)
      for (const line of lines) {
        paras.push(new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: line, size: 22, color: textColor, font: 'Arial' })],
        }))
      }
    }

    return paras
  }

  return paras
}

// ── main export ──────────────────────────────────────────────────────────────

export async function exportDOCX(
  project: Project,
  blocks: Block[],
  schools: School[],
  opts: ExportOptions,
  isZh: boolean,
) {
  const theme = THEMES[opts.theme] || THEMES.sensei

  // convert all blocks to paragraphs
  const allParagraphs: Paragraph[] = []
  for (const b of blocks) {
    const ps = await blockToParagraphs(b, project, schools, opts, isZh, theme)
    allParagraphs.push(...ps)
    // add spacing between blocks
    allParagraphs.push(new Paragraph({ spacing: { after: 100 }, children: [] }))
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 24, color: hex(theme.text) },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 48, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 240 } },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 180, after: 180 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: allParagraphs,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.title.replace(/\s+/g, '_')}_${opts.theme}.docx`
  a.click()
  URL.revokeObjectURL(url)
}
