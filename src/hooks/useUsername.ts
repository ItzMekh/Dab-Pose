import { useState, useCallback } from 'react'

const KEY = 'dab_username'

export function useUsername() {
  const [username, setUsernameState] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(KEY) ?? ''
  })

  const setUsername = useCallback((name: string) => {
    setUsernameState(name)
  }, [])

  const saveUsername = useCallback((name: string) => {
    const trimmed = name.trim()
    if (trimmed) localStorage.setItem(KEY, trimmed)
    setUsernameState(trimmed)
  }, [])

  return { username, setUsername, saveUsername }
}
