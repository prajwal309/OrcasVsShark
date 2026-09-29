import type { Metadata } from "next";
import "./globals.css";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orcas vs Sharks — An ocean of strategy",
  description:
    "Four Orcas. Twenty Sharks. Play an original ocean-themed adaptation of Nepal’s traditional Bagh-Chal strategy game with a friend.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
