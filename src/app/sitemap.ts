import type { MetadataRoute } from 'next'

const SITE = 'https://dabpose.fun'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: `${SITE}/`,            lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE}/leaderboard`, lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE}/login`,       lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/signup`,      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE}/privacy`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE}/terms`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
