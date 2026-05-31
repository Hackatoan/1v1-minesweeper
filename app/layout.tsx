import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GamesPlayed } from "./components/GamesPlayed";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: '1v1 Minesweeper', template: '%s | 1v1 Minesweeper' },
  description: 'Play competitive 1v1 Minesweeper online. Challenge a friend, place your mines, and race to clear their board first. Free multiplayer browser game.',
  metadataBase: new URL('https://1v1sw.hackatoa.com'),
  keywords: ['minesweeper', '1v1 minesweeper', 'multiplayer minesweeper', 'competitive minesweeper', 'online minesweeper', 'browser game'],
  authors: [{ name: 'Hackatoa', url: 'https://hackatoa.com' }],
  openGraph: {
    title: '1v1 Minesweeper — Competitive Multiplayer',
    description: 'Race your opponent to clear a minefield in this competitive 1v1 take on the classic game.',
    url: 'https://1v1sw.hackatoa.com',
    siteName: '1v1 Minesweeper',
    images: [{ url: '/og-image.svg', width: 1200, height: 630, alt: '1v1 Minesweeper' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: '1v1 Minesweeper', description: 'Competitive multiplayer minesweeper in your browser.' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GamesPlayed />
        {children}
        <footer className="fixed bottom-0 w-full bg-brown-800 border-brown-700/80 backdrop-blur-sm border-t border-brown-700/50 py-3 px-6 flex justify-between items-center z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] text-sm">
          <div className="flex items-center gap-4">
            <div className="text-pink-200/80 font-medium">
              Built by <a href="https://hackatoa.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 hover:underline font-bold transition-colors">hackatoa</a>
            </div>
            <a href="https://games.hackatoa.com" target="_blank" rel="noopener noreferrer" className="text-pink-300/60 hover:text-pink-400 font-semibold transition-colors hover:underline">
              All Games →
            </a>
            <a href="https://github.com/Hackatoan/1v1-minesweeper" target="_blank" rel="noopener noreferrer" className="text-pink-300/40 hover:text-pink-400 font-medium transition-colors hover:underline hidden sm:inline">
              Source
            </a>
          </div>
          <a href="https://buymeacoffee.com/hackatoa" target="_blank" rel="noopener noreferrer" className="bg-pink-200 hover:bg-pink-300 text-pink-900 px-4 py-1.5 rounded-full font-bold shadow-sm border border-pink-300 transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
            <span>☕</span> Buy me a coffee
          </a>
        </footer>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoGame",
            "name": "1v1 Minesweeper",
            "url": "https://1v1sw.hackatoa.com/",
            "description": "Play competitive 1v1 Minesweeper online. Both players place mines on each other's boards, then race to clear the minefield first.",
            "genre": ["Strategy", "Puzzle"],
            "playMode": "MultiPlayer",
            "applicationCategory": "GameApplication",
            "operatingSystem": "Web Browser",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
            "author": { "@type": "Person", "name": "Jacob P Harris", "alternateName": "Hackatoa", "url": "https://hackatoa.com" },
            "isPartOf": { "@type": "WebSite", "name": "Hackatoa Games", "url": "https://games.hackatoa.com" }
          })}}
        />
        {/* Cloudflare Web Analytics */}
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={'{"token": "1fb943269b344332804cfc907bf18ee5"}'}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';