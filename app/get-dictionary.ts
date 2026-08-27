import 'server-only'

// Lazy-loaded per-locale dictionaries (server-only; not shipped to the client bundle).
const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  es: () => import('./dictionaries/es.json').then((m) => m.default),
  'pt-br': () => import('./dictionaries/pt-br.json').then((m) => m.default),
  fr: () => import('./dictionaries/fr.json').then((m) => m.default),
  de: () => import('./dictionaries/de.json').then((m) => m.default),
  vi: () => import('./dictionaries/vi.json').then((m) => m.default),
  th: () => import('./dictionaries/th.json').then((m) => m.default),
} as const

export type Locale = keyof typeof dictionaries
export const LOCALES = Object.keys(dictionaries) as Locale[]
// Locales that get a /<locale> URL prefix (English is served at the root "/").
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== 'en')

export const hasLocale = (locale: string): locale is Locale => locale in dictionaries
export const getDictionary = async (locale: Locale) => dictionaries[locale]()

// hreflang code for each locale (region-qualified where needed).
export const HREFLANG: Record<Locale, string> = {
  en: 'en', es: 'es', 'pt-br': 'pt-BR', fr: 'fr', de: 'de', vi: 'vi', th: 'th',
}
export const OG_LOCALE: Record<Locale, string> = {
  en: 'en_US', es: 'es_ES', 'pt-br': 'pt_BR', fr: 'fr_FR', de: 'de_DE', vi: 'vi_VN', th: 'th_TH',
}
// { hreflang: url } map for Metadata.alternates.languages (+ x-default).
export function languageAlternates(): Record<string, string> {
  const map: Record<string, string> = {}
  for (const l of LOCALES) map[HREFLANG[l]] = l === 'en' ? '/' : `/${l}`
  map['x-default'] = '/'
  return map
}
