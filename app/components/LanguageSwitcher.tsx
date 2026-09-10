'use client'

import { useState, useEffect, useRef } from 'react'

// Collapsed globe in the top-right that pops the language list. English is at "/",
// other locales at "/<locale>".
const LOCALES: { code: string; label: string; name: string; href: string }[] = [
  { code: 'en', label: 'EN', name: 'English', href: '/' },
  { code: 'es', label: 'ES', name: 'Español', href: '/es' },
  { code: 'pt-br', label: 'PT', name: 'Português', href: '/pt-br' },
  { code: 'fr', label: 'FR', name: 'Français', href: '/fr' },
  { code: 'de', label: 'DE', name: 'Deutsch', href: '/de' },
  { code: 'vi', label: 'VI', name: 'Tiếng Việt', href: '/vi' },
  { code: 'th', label: 'TH', name: 'ไทย', href: '/th' },
]

export function LanguageSwitcher({ current }: { current: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [])
  return (
    <div ref={ref} className="fixed top-3 right-3 z-50">
      <button
        type="button"
        aria-label="Language"
        aria-haspopup="true"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-brown-600/60 bg-brown-800/90 text-pink-300/80 shadow-lg backdrop-blur transition-colors hover:text-pink-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <ellipse cx="12" cy="12" rx="4" ry="9" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 flex flex-col gap-1.5 whitespace-nowrap rounded-xl border border-brown-600/60 bg-brown-800/95 px-3 py-2 text-xs font-semibold shadow-xl backdrop-blur"
        >
          {LOCALES.map((l) => (
            <a
              key={l.code}
              href={l.href}
              aria-current={l.code === current ? 'true' : undefined}
              className={l.code === current ? 'text-pink-100' : 'text-pink-300/60 hover:text-pink-200'}
            >
              {l.label} · {l.name}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
