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

// ── IndexedDB helpers（与 useLocalStorage.ts 共用同一个 DB）────────────────
const _DB_NAME    = 'ps-storage'
const _DB_VERSION = 1
const _STORE      = 'kv'

function _openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_DB_NAME, _DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function idbGetPages(key: string): Promise<unknown> {
  const db = await _openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_STORE, 'readonly')
    const req = tx.objectStore(_STORE).get(key)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function idbSetPages(key: string, value: unknown): Promise<void> {
  const db = await _openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(_STORE, 'readwrite')
    const req = tx.objectStore(_STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/**
 * 从 IndexedDB 加载页面数据。
 * 同时兼容旧 localStorage 数据（一次性迁移后删除）。
 */
export async function migrateOrLoad(projectId: string): Promise<Page[]> {
  if (typeof window === 'undefined') return defaultPages()
  try {
    // 优先从 IndexedDB 读
    const fromIDB = await idbGetPages(pagesKey(projectId))
    if (fromIDB) return fromIDB as Page[]

    // 降级：尝试从旧 localStorage 迁移
    const raw = localStorage.getItem(pagesKey(projectId))
    if (raw) {
      const pages = JSON.parse(raw) as Page[]
      await idbSetPages(pagesKey(projectId), pages)
      localStorage.removeItem(pagesKey(projectId))
      return pages
    }

    const legacy = localStorage.getItem(draftKey(projectId))
    if (legacy) {
      const blocks = JSON.parse(legacy)
      if (blocks.length > 0) {
        const migrated: Page[] = [
          makeCoverPage(),
          { id: generateId(), label: 'Page 1', aspect: 'free', blocks },
        ]
        await idbSetPages(pagesKey(projectId), migrated)
        localStorage.removeItem(draftKey(projectId))
        return migrated
      }
    }
  } catch {}
  return defaultPages()
}