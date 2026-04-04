// ─────────────────────────────────────────────────────────────────────────────
// Export Editor — Page helpers（纯函数，无 React 依赖）
// 放在 page.tsx 同级目录：
//   app/[locale]/projects/[id]/export/pageHelpers.ts
// ─────────────────────────────────────────────────────────────────────────────

import { Aspect, Page } from './types'

export function draftKey(projectId: string)  { return `ps-export-draft-${projectId}` }
export function optKey(projectId: string)    { return `ps-export-opts-${projectId}` }
export function pagesKey(projectId: string)  { return `ps-export-pages-${projectId}` }

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export const ASPECT_RATIO: Record<Aspect, number> = {
  '16:9': 16 / 9,
  'A4':   1 / 1.4142,
  '1:1':  1,
  '4:3':  4 / 3,
  'free': 0,
}

export function aspectLabel(a: Aspect) {
  if (a === 'A4') return 'A4'
  if (a === 'free') return 'Free'
  return a
}

/** Given a canvas pixel width, return fixed height for a given aspect.
 *  Returns null for 'free' (height grows with content). */
export function pageHeight(aspect: Aspect, widthPx: number): number | null {
  const r = ASPECT_RATIO[aspect]
  return r ? Math.round(widthPx / r) : null
}

export function makeCoverPage(): Page {
  return {
    id: generateId(),
    label: 'Cover',
    aspect: '16:9',
    isCover: true,
    blocks: [],
  }
}

export function makeNewPage(index: number, aspect: Aspect = 'free'): Page {
  return { id: generateId(), label: `Page ${index}`, aspect, blocks: [] }
}

export function defaultPages(): Page[] {
  return [makeCoverPage()]
}

/**
 * One-time migration: if old flat Block[] exists in localStorage, wrap it into
 * a single default Page so no existing draft is lost.
 */
export function migrateOrLoad(projectId: string): Page[] {
  if (typeof window === 'undefined') return defaultPages()
  try {
    const raw = localStorage.getItem(pagesKey(projectId))
    if (raw) return JSON.parse(raw) as Page[]

    const legacy = localStorage.getItem(draftKey(projectId))
    if (legacy) {
      const blocks = JSON.parse(legacy)
      if (blocks.length > 0) {
        const migrated: Page[] = [
          makeCoverPage(),
          { id: generateId(), label: 'Page 1', aspect: 'free', blocks },
        ]
        localStorage.setItem(pagesKey(projectId), JSON.stringify(migrated))
        return migrated
      }
    }
  } catch {}
  return defaultPages()
}
