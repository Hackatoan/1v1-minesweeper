import { useEffect } from 'react'

// Press "F" to toggle between Dig and Flag mode. Ignored while typing in a
// field or when a modifier is held, so Ctrl+F / Cmd+F still open find.
export default function useFlagHotkey(setFlagMode: (fn: (prev: boolean) => boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return
      e.preventDefault()
      setFlagMode(prev => !prev)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setFlagMode])
}
