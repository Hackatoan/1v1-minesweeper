import type { Metadata } from 'next'
import { getDictionary, languageAlternates } from './get-dictionary'
import { LandingClient } from './components/LandingClient'
import { SeoAbout } from './components/SeoAbout'

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary('en')
  return {
    title: { absolute: dict.meta.title },
    description: dict.meta.description,
    alternates: { canonical: '/', languages: languageAlternates() },
  }
}

export default async function Home() {
  const dict = await getDictionary('en')
  return (
    <>
      <LandingClient dict={dict.landing} locale="en" base="" />
      <SeoAbout about={dict.about} />
    </>
  )
}
