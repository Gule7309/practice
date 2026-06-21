import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Playabl Game Loop Evaluator",
  description:
    "A browser-based game loop evaluator for public Playabl games. Captures early player-facing states, analyzes visible loops with vision models, and produces creator-facing scorecards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
