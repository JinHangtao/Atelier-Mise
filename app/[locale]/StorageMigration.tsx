'use client'
import { useEffect } from 'react'
import { migrateLocalStorageToIDB } from '@/hooks/useLocalStorage'

/**
 * 挂在 layout 里，只跑一次迁移（localStorage → IndexedDB）。
 * 纯副作用，不渲染任何 UI。
 */
export default function StorageMigration() {
  useEffect(() => {
    migrateLocalStorageToIDB(['ps-projects'])
  }, [])
  return null
}
