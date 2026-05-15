'use client'

import { useCallback, useEffect, useState } from 'react'

export function useCountry(): [string, (code: string) => void] {
  const [country, setCountryState] = useState('XX')

  useEffect(() => {
    const cached = sessionStorage.getItem('dab_country')
    if (cached) { setCountryState(cached); return }
    fetch('/api/country/detect')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const code = (d?.country as string) ?? 'XX'
        sessionStorage.setItem('dab_country', code)
        setCountryState(code)
      })
      .catch(() => {})
  }, [])

  const setCountry = useCallback((code: string) => {
    sessionStorage.setItem('dab_country', code)
    setCountryState(code)
  }, [])

  return [country, setCountry]
}
