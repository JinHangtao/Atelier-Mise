/**
 * useLocalStorage — IndexedDB 版（API 与原 localStorage 版完全一致）
 *
 * 替换原因：localStorage 上限 5-10 MB，IndexedDB 上限约等于磁盘剩余空间。
 * 用法与原版相同：
 *   const [value, setValue] = useLocalStorage('ps-projects', defaultValue)
 */

'use client'
import { useState, useEffect, useRef } from 'react'

// ── IndexedDB helpers ──────────────────────────────────────────────────────

const DB_NAME    = 'ps-storage'
const DB_VERSION = 1
const STORE_NAME = 'kv'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror   = () => reject(req.error)
  })
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readwrite')
    const req = tx.objectStore(STORE_NAME).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

// ── Hook ──────────────────────────────────────────────────────────────────

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue)
  const readyRef = useRef(false)  // true once we've loaded from IDB

  // Load from IndexedDB on mount
  useEffect(() => {
    idbGet<T>(key)
      .then(val => {
        if (val !== undefined) setStoredValue(val)
      })
      .catch(console.error)
      .finally(() => { readyRef.current = true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Persist to IndexedDB whenever value changes (skip the very first render
  // before we've loaded from IDB, to avoid overwriting stored data with the
  // initialValue placeholder)
  useEffect(() => {
    if (!readyRef.current) return
    idbSet(key, storedValue).catch(console.error)
  }, [key, storedValue])

  const setValue = (value: T | ((prev: T) => T)) => {
    setStoredValue(prev =>
      typeof value === 'function' ? (value as (p: T) => T)(prev) : value
    )
  }

  return [storedValue, setValue]
}

// ── One-time migration: localStorage → IndexedDB ─────────────────────────
// Call this once at app startup (e.g. in _app.tsx / layout.tsx).
// After migration completes it removes the localStorage key to free space.

export async function migrateLocalStorageToIDB(keys: string[]): Promise<void> {
  if (typeof window === 'undefined') return
  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw === null) continue
      const existing = await idbGet(key)
      if (existing !== undefined) {
        // IDB already has data — just clean up localStorage
        window.localStorage.removeItem(key)
        continue
      }
      await idbSet(key, JSON.parse(raw))
      window.localStorage.removeItem(key)
      console.info(`[storage] migrated "${key}" localStorage → IndexedDB`)
    } catch (e) {
      console.warn(`[storage] migration failed for "${key}"`, e)
    }
  }
}