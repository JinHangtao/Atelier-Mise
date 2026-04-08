/**
 * mediaLibraryDB.ts
 * 把媒体库图片存进 IndexedDB，避免 base64 塞满 localStorage（5MB 上限）。
 * 每张图用 key = `${projectId}:${imageId}` 存储。
 * project 里只保留 id 列表（mediaIds），不再存 base64。
 */

const DB_NAME    = 'ps-media-library'
const DB_VERSION = 1
const STORE      = 'images'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

/** 存一张图，返回分配的 imageId */
export async function saveMediaImage(projectId: string, dataUrl: string): Promise<string> {
  const imageId = `img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const key     = `${projectId}:${imageId}`
  const db      = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).put(dataUrl, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
  db.close()
  return imageId
}

/** 读取一个项目的所有图片，返回 { imageId → dataUrl } */
export async function loadMediaImages(projectId: string): Promise<Record<string, string>> {
  const db     = await openDB()
  const prefix = `${projectId}:`
  const result: Record<string, string> = {}

  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req   = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { resolve(); return }
      const key = cursor.key as string
      if (key.startsWith(prefix)) {
        const imageId = key.slice(prefix.length)
        result[imageId] = cursor.value as string
      }
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })

  db.close()
  return result
}

/** 删除一张图 */
export async function deleteMediaImage(projectId: string, imageId: string): Promise<void> {
  const db  = await openDB()
  const key = `${projectId}:${imageId}`
  await new Promise<void>((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readwrite')
    const req = tx.objectStore(STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
  db.close()
}

/** 删除一个项目的所有图片（项目删除时调用） */
export async function deleteProjectMedia(projectId: string): Promise<void> {
  const db     = await openDB()
  const prefix = `${projectId}:`
  const keys: string[] = []

  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readonly')
    const req   = tx.objectStore(STORE).openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) { resolve(); return }
      if ((cursor.key as string).startsWith(prefix)) keys.push(cursor.key as string)
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })

  if (keys.length === 0) { db.close(); return }

  await new Promise<void>((resolve, reject) => {
    const tx    = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    let done = 0
    for (const k of keys) {
      const req = store.delete(k)
      req.onsuccess = () => { if (++done === keys.length) resolve() }
      req.onerror   = () => reject(req.error)
    }
  })

  db.close()
}
