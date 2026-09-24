'use client'

// Client-side i18n for the interactive surfaces (solo + the shared multiplayer
// game room). Unlike the SSR-localized landing (/[locale]), these are locale-less
// URLs so two players in different languages can share one room and each see it
// in their own language. The locale is resolved per-player from localStorage
// 'hk_lang' (set by the localized landing) with a navigator.language fallback.

import { useCallback, useEffect, useState } from 'react'
import en from '../dictionaries/en.json'
import es from '../dictionaries/es.json'
import ptbr from '../dictionaries/pt-br.json'
import fr from '../dictionaries/fr.json'
import de from '../dictionaries/de.json'
import vi from '../dictionaries/vi.json'
import th from '../dictionaries/th.json'

type Dict = typeof en
const DICTS: Record<string, Dict> = { en, es, 'pt-br': ptbr, fr, de, vi, th }

export function resolveLocale(): string {
  if (typeof window === 'undefined') return 'en'
  let l = ''
  try { l = localStorage.getItem('hk_lang') || '' } catch { /* ignore */ }
  if (DICTS[l]) return l
  const nav = (navigator.language || 'en').toLowerCase()
  if (nav.startsWith('pt')) return 'pt-br'
  const two = nav.slice(0, 2)
  return DICTS[two] ? two : 'en'
}

function lookup(dict: Dict, path: string): string | undefined {
  const v = path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), dict)
  return typeof v === 'string' ? v : undefined
}

export type TFunc = (path: string, params?: Record<string, string | number>) => string

// Resolves the player's locale on mount (SSR renders English, then swaps in on
// hydration — matching initial render, so no hydration mismatch) and sets
// <html lang>. Returns a t() that falls back to English then to the key itself.
export function useT(): { t: TFunc; locale: string } {
  const [locale, setLocale] = useState('en')
  // Resolving the real locale needs localStorage/navigator, both
  // server-unavailable — this has to run post-mount to avoid an SSR
  // hydration mismatch (render 'en' first, then swap in), which is exactly
  // what an effect is for here; there's no derived-from-render-inputs
  // alternative since the value depends on browser-only APIs, not props/state.
  useEffect(() => {
    const l = resolveLocale()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(l)
    try { document.documentElement.lang = l } catch { /* ignore */ }
  }, [])
  const dict = DICTS[locale] || en
  // Memoized so consumers can safely list `t` in their own effect deps
  // without it changing identity (and re-triggering those effects) on
  // every render — only changes when the resolved dictionary does.
  const t = useCallback<TFunc>((path, params) => {
    let s = lookup(dict, path) ?? lookup(en, path) ?? path
    if (params) for (const k in params) s = s.split('{' + k + '}').join(String(params[k]))
    return s
  }, [dict])
  return { t, locale }
}
