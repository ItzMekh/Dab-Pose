'use client'

import { useMemo } from 'react'
import type { CompatResult } from '@/types'

export function useBrowserCompat(): CompatResult {
  return useMemo(() => {
    if (typeof window === 'undefined') return { ok: true, missing: [] }
    const missing: string[] = []
    if (!navigator.mediaDevices?.getUserMedia) missing.push('Camera API (getUserMedia)')
    if (typeof WebAssembly === 'undefined') missing.push('WebAssembly')
    if (!window.performance?.now) missing.push('High-resolution timer')
    return { ok: missing.length === 0, missing }
  }, [])
}
