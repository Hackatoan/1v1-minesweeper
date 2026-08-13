import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Play vs AI",
  description: "Play 1v1 Minesweeper against the computer. Pick easy, medium, or hard difficulty, place your mines, and race the AI to clear the board first.",
  alternates: { canonical: "https://1v1sw.hackatoa.com/solo" },
  openGraph: {
    title: "Play vs AI | 1v1 Minesweeper",
    description: "Play 1v1 Minesweeper against the computer — three difficulty levels, race to clear the board first.",
    url: "https://1v1sw.hackatoa.com/solo",
  },
};

export default function SoloLayout({ children }: { children: React.ReactNode }) {
  return children;
}
