import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: "Privacy policy for 1v1 Minesweeper: what we collect, what we don't, and how to get your data deleted.",
  alternates: { canonical: 'https://1v1sw.hackatoa.com/privacy' },
  robots: { index: false, follow: false },
}

export default function PrivacyPage() {
  return (
    <main className="flex flex-1 w-full flex-col items-center p-6 sm:p-12 pb-28">
      <div className="z-10 max-w-2xl w-full bg-brown-800 border border-brown-700 p-8 sm:p-12 rounded-3xl shadow-xl">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-pink-100 tracking-tight text-center">Privacy Policy</h1>
        <p className="text-center text-xs text-pink-300/50 mt-2 mb-6">Last updated: September 30, 2026</p>

        <p className="text-pink-200/80 leading-relaxed mb-6">
          This is a free, hobby-built browser game. Here&apos;s exactly what it does and doesn&apos;t do with your information.
        </p>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">What we collect</h2>
        <ul className="list-disc list-inside space-y-2 text-pink-200/80 leading-relaxed">
          <li>
            <span className="font-semibold text-pink-100">If you just type a nickname and play:</span> that nickname is stored along with your game results (wins/losses/draws) so the leaderboard works. That&apos;s it — no account, no email, nothing else.
          </li>
          <li>
            <span className="font-semibold text-pink-100">If you choose to sign in with Google:</span> we receive your email address, display name, and a Google account ID (via Firebase Authentication) so your leaderboard stats can follow your account across devices instead of resetting every time you play from somewhere new. Signing in is entirely optional.
          </li>
          <li>
            We use Cloudflare Web Analytics for basic aggregate traffic stats (page views, browser/device type). It&apos;s cookie-free and doesn&apos;t track you across other sites.
          </li>
        </ul>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">What we don&apos;t do</h2>
        <ul className="list-disc list-inside space-y-2 text-pink-200/80 leading-relaxed">
          <li>No ads, no ad trackers, no selling or sharing your data with third parties.</li>
          <li>We never see or store your Google password — sign-in is handled entirely by Google/Firebase.</li>
        </ul>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">Where it&apos;s stored</h2>
        <p className="text-pink-200/80 leading-relaxed">
          Game stats live in a database we run ourselves. Account sign-in is handled by Firebase (Google).
        </p>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">How long we keep it</h2>
        <p className="text-pink-200/80 leading-relaxed">
          Indefinitely, since it&apos;s just a leaderboard with no automatic expiry — unless you ask us to delete it (see below).
        </p>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">Your choices</h2>
        <ul className="list-disc list-inside space-y-2 text-pink-200/80 leading-relaxed">
          <li>Play without signing in, and nothing beyond a nickname is ever collected.</li>
          <li>Sign out at any time — new results stop being tied to your account (past results stay on the leaderboard under your account unless you ask us to delete them).</li>
          <li>
            Email{' '}
            <a href="mailto:preston@hackatoa.com" className="text-pink-400 hover:text-pink-300 underline">
              preston@hackatoa.com
            </a>{' '}
            to have your account&apos;s data deleted.
          </li>
        </ul>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">Children&apos;s privacy</h2>
        <p className="text-pink-200/80 leading-relaxed">
          This game isn&apos;t directed at children under 13, and we don&apos;t knowingly collect personal information from them.
        </p>

        <h2 className="text-pink-300 font-bold uppercase tracking-wider text-sm mt-6 mb-2">Changes</h2>
        <p className="text-pink-200/80 leading-relaxed mb-6">
          If this policy changes in a meaningful way, we&apos;ll update the date above.
        </p>

        <p className="text-pink-200/80 leading-relaxed">
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
