'use client'

// Fixed top-right language switcher. English is at "/", other locales at "/<locale>".
const LOCALES: { code: string; label: string; href: string }[] = [
  { code: 'en', label: 'EN', href: '/' },
  { code: 'es', label: 'ES', href: '/es' },
  { code: 'pt-br', label: 'PT', href: '/pt-br' },
  { code: 'fr', label: 'FR', href: '/fr' },
  { code: 'de', label: 'DE', href: '/de' },
  { code: 'vi', label: 'VI', href: '/vi' },
  { code: 'th', label: 'TH', href: '/th' },
]

export function LanguageSwitcher({ current }: { current: string }) {
  return (
    <nav aria-label="Language" className="fixed top-3 right-3 z-50 flex gap-2 rounded-full border border-brown-600/60 bg-brown-800/90 px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur">
      {LOCALES.map((l) => (
        <a
          key={l.code}
          href={l.href}
          aria-current={l.code === current ? 'true' : undefined}
          className={l.code === current ? 'text-pink-100' : 'text-pink-300/60 hover:text-pink-200'}
        >
          {l.label}
        </a>
      ))}
    </nav>
  )
}
