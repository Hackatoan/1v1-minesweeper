import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GamesPlayed } from "./components/GamesPlayed";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "1v1 Sweeper",
  description: "Challenge a friend to a game of competitive Minesweeper. Set up your board, then race to clear theirs without hitting a mine! Built by hackatoa.",
  metadataBase: new URL('https://1v1sw.hackatoa.com'),
  openGraph: {
    title: "1v1 Minesweeper",
    description: "Challenge a friend to a game of competitive Minesweeper. Setup your board and race to clear theirs first!",
    url: "https://1v1sw.hackatoa.com",
    siteName: "1v1 Minesweeper",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "1v1 Minesweeper preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "1v1 Minesweeper",
    description: "Challenge a friend to a game of competitive Minesweeper. Setup your board and race to clear theirs first!",
    images: ["/og-image.png"],
  },
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
          <div className="text-pink-200/80 font-medium">
            Built by <a href="https://hackatoa.com" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 hover:underline font-bold transition-colors">hackatoa</a>
          </div>
          <a href="https://buymeacoffee.com/hackatoa" target="_blank" rel="noopener noreferrer" className="bg-pink-200 hover:bg-pink-300 text-pink-900 px-4 py-1.5 rounded-full font-bold shadow-sm border border-pink-300 transition-all transform hover:-translate-y-0.5 flex items-center gap-2">
            <span>☕</span> Buy me a coffee
          </a>
        </footer>
      </body>
    </html>
  );
}

export const dynamic = 'force-dynamic';
