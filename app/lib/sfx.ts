// Thin wrapper around the shared synthesized-sound script (public/sfx.js).
// The script is injected lazily on the client so SSR never touches WebAudio.
type SfxWindow = Window & { SFX?: { play: (name: string) => void } }

export function initSfx() {
  if (typeof document === 'undefined') return
  if (document.getElementById('sfx-script')) return
  const s = document.createElement('script')
  s.id = 'sfx-script'
  s.src = '/sfx.js'
  s.async = true
  document.head.appendChild(s)
}

export function sfx(name: string) {
  if (typeof window === 'undefined') return
  initSfx()
  ;(window as SfxWindow).SFX?.play(name)
}
