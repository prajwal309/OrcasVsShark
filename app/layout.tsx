import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AccountProvider } from "@/components/navigation/account-navigation";
import { pageSessionAccount } from "@/lib/auth/session";
import {
  defaultSiteTheme,
  restoreSiteTheme,
} from "@/lib/presentation/site-themes";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Orcas vs Sharks — An ocean of strategy",
  description:
    "Four Orcas. Twenty Sharks. Play an original ocean-themed adaptation of Nepal’s traditional Bagh Chal strategy game with a friend.",
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [account, requestHeaders] = await Promise.all([
    pageSessionAccount().catch(() => null),
    headers(),
  ]);
  const nonce = requestHeaders.get("x-nonce") ?? undefined;
  return (
    <html lang="en" data-site-theme={defaultSiteTheme} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: restoreSiteTheme }}
        />
      </head>
      {/* Browser extensions (such as Grammarly) add body attributes before hydration.
          Keep suppression on this element only; descendants still get checked. */}
      <body suppressHydrationWarning>
        <AccountProvider
          initialUsername={account?.username ?? null}
          initialIsGuest={account?.is_guest ?? false}
        >
          {children}
        </AccountProvider>
      </body>
    </html>
  );
}
