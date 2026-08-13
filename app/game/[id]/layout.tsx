import type { Metadata } from "next";

// Per-session game rooms are ephemeral and private — never index or follow.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return children;
}
