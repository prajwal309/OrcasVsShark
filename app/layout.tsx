import type { Metadata } from "next";
import "./globals.css";
import { AccountProvider } from "@/components/navigation/account-navigation";
import { sessionAccount } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orcas vs Sharks — An ocean of strategy",
  description:
    "Four Orcas. Twenty Sharks. Play an original ocean-themed adaptation of Nepal’s traditional Bagh Chal strategy game with a friend.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const account = await sessionAccount().catch(() => null);
  return (
    <html lang="en">
      {/* Browser extensions (such as Grammarly) add body attributes before hydration.
          Keep suppression on this element only; descendants still get checked. */}
      <body suppressHydrationWarning>
        <AccountProvider initialUsername={account?.username ?? null}>
          {children}
        </AccountProvider>
      </body>
    </html>
  );
}
