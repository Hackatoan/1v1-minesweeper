// Builds the brag text for the "Share Result" button on the match result
// screen. Links to the site root (the finished game room itself is useless to
// whoever receives it). Pure so it can be unit-tested without a DOM.

import type { TFunc } from './i18n-client'

export function buildResultShareText(t: TFunc, won: boolean, origin: string): string {
  const url = origin.replace(/\/+$/, '') || 'https://1v1sw.hackatoa.com'
  return t(won ? 'game.shareWin' : 'game.shareLoss', { url })
}
