import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of service for 1v1 Minesweeper.',
  alternates: { canonical: 'https://1v1sw.hackatoa.com/terms' },
  robots: { index: false, follow: false },
}

export default function TermsPage() {
  return (
    <main className="flex flex-1 w-full flex-col items-center p-6 sm:p-12 pb-28">
      <div className="z-10 max-w-2xl w-full bg-brown-800 border border-brown-700 p-8 sm:p-12 rounded-3xl shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-pink-100 tracking-tight text-center">Terms of Service</h1>
        <p className="text-center text-xs text-pink-300/50 mt-2 mb-6">Last updated: September 30, 2026</p>

        <p className="text-pink-200/80 leading-relaxed mb-6">By playing, you agree to these terms.</p>

        <ul className="list-disc list-inside space-y-2 text-pink-200/80 leading-relaxed">
          <li>This game is provided free, as-is, with no warranty of any kind. We&apos;re not liable for any damages arising from using it.</li>
          <li>Don&apos;t use it to harass, abuse, or impersonate other players. Keep nicknames and any user-submitted text appropriate.</li>
          <li>We may change, suspend, or shut down the game at any time, without notice.</li>
          <li>If you sign in with Google, you&apos;re also subject to Google&apos;s own terms for that sign-in.</li>
          <li>We may update these terms from time to time; continued use means you accept the changes.</li>
        </ul>

        <p className="text-pink-200/80 leading-relaxed mt-6">
          See also our{' '}
          <Link href="/privacy" className="text-pink-400 hover:text-pink-300 underline">
            Privacy Policy
          </Link>
          .
        </p>

        <p className="text-pink-200/80 leading-relaxed mt-2">
          Questions?{' '}
          <a href="mailto:preston@hackatoa.com" className="text-pink-400 hover:text-pink-300 underline">
            preston@hackatoa.com
          </a>
        </p>

        <div className="pt-6 mt-6 border-t border-brown-700/50 text-center">
          <Link href="/" className="text-pink-400 hover:text-pink-300 font-semibold hover:underline transition-colors">
            ← Back to the game
          </Link>
        </div>
      </div>
    </main>
  )
}
