import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AccountProvider } from "@/components/navigation/account-navigation";
import { gridLoxLogo } from "@/components/navigation/gridlox-logo";
import { pageSessionAccount } from "@/lib/auth/session";
import { appOrigin } from "@/lib/deployment";
import {
  defaultSiteTheme,
  restoreSiteTheme,
} from "@/lib/presentation/site-themes";
export const dynamic = "force-dynamic";
const platform = "GridLox Games";
const description =
  "Play Orcas vs Sharks, an ocean-themed adaptation of Nepal’s traditional Baghchal strategy game. Challenge a friend or the computer, learn the rules, and solve daily puzzles.";
export const metadata: Metadata = {
  metadataBase: appOrigin(),
  title: { default: platform, template: `%s | ${platform}` },
  applicationName: platform,
  description,
  openGraph: {
    type: "website",
    siteName: platform,
    title: platform,
    description,
    images: [gridLoxLogo],
  },
  twitter: {
    card: "summary",
    title: platform,
    description,
    images: [gridLoxLogo],
  },
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
