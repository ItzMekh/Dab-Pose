'use client'

import { useEffect, useState } from 'react'

export function useCountry(): string {
  const [country, setCountry] = useState('XX')

  useEffect(() => {
    const cached = sessionStorage.getItem('dab_country')
    if (cached) { setCountry(cached); return }
    fetch('/api/country/detect')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const code = (d?.country as string) ?? 'XX'
        sessionStorage.setItem('dab_country', code)
        setCountry(code)
      })
      .catch(() => {})
  }, [])

  return country
}
