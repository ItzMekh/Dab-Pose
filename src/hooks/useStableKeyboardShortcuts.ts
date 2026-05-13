'use client'

import { useEffect, useRef } from 'react'

interface Shortcuts {
  Enter?: () => void
  Space?: () => void
  Escape?: () => void
}

export function useStableKeyboardShortcuts(shortcuts: Shortcuts) {
  const ref = useRef(shortcuts)
  ref.current = shortcuts

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'Enter' && ref.current.Enter) { e.preventDefault(); ref.current.Enter() }
      if (e.key === ' ' && ref.current.Space) { e.preventDefault(); ref.current.Space() }
      if (e.key === 'Escape' && ref.current.Escape) ref.current.Escape()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
