import { MetadataRoute } from 'next'
import { LOCALES, HREFLANG } from './get-dictionary'

const BASE = 'https://1v1sw.hackatoa.com'
const localePath = (l: string) => (l === 'en' ? '' : `/${l}`)

// hreflang alternates for the landing page across every locale (+ x-default).
function landingAlternates(): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const l of LOCALES) languages[HREFLANG[l]] = `${BASE}${localePath(l)}`
  languages['x-default'] = BASE
  return languages
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const landings = LOCALES.map((l) => ({
    url: `${BASE}${localePath(l)}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority: l === 'en' ? 1.0 : 0.9,
    alternates: { languages: landingAlternates() },
  }))
  return [
    ...landings,
    { url: `${BASE}/solo`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ]
}
