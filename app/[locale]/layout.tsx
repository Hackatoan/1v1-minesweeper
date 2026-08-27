import { notFound } from 'next/navigation'
import { hasLocale, PREFIXED_LOCALES } from '../get-dictionary'

// Only the prefixed locales are valid; anything else 404s.
export const dynamicParams = false

export async function generateStaticParams() {
  return PREFIXED_LOCALES.map((locale) => ({ locale }))
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!hasLocale(locale) || locale === 'en') notFound()
  return children
}
