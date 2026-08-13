import type { Metadata } from "next";
import faviconUrl from "./assets/favicon.svg?inline";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dojo Deckbuilder",
  description:
    "The official companion for Dojo Deckbuilder rules, quick start, cards, rulings, glossary, and house rules.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: faviconUrl,
    shortcut: faviconUrl,
  },
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
