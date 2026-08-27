import type { Metadata } from 'next'
import { getDictionary, languageAlternates } from './get-dictionary'
import { LandingClient } from './components/LandingClient'

export const metadata: Metadata = {
  alternates: { canonical: '/', languages: languageAlternates() },
}

export default async function Home() {
  const dict = await getDictionary('en')
  return <LandingClient dict={dict.landing} locale="en" base="" />
}
