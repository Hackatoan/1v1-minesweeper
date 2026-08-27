import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDictionary, hasLocale, languageAlternates, OG_LOCALE } from '../get-dictionary'
import { LandingClient } from '../components/LandingClient'

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!hasLocale(locale) || locale === 'en') return {}
  const dict = await getDictionary(locale)
  return {
    title: { absolute: dict.meta.title },
    description: dict.meta.description,
    alternates: { canonical: `/${locale}`, languages: languageAlternates() },
    openGraph: { title: dict.meta.title, description: dict.meta.description, url: `/${locale}`, locale: OG_LOCALE[locale] },
  }
}

export default async function LocalizedHome({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  if (!hasLocale(locale) || locale === 'en') notFound()
  const dict = await getDictionary(locale)
  return <LandingClient dict={dict.landing} locale={locale} base={`/${locale}`} />
}
