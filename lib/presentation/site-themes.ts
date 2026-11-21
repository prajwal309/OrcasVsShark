export const siteThemes = {
  royal: "Royal Navy & Gold",
  ivory: "Ivory & Navy",
} as const;

export type SiteTheme = keyof typeof siteThemes;
export const defaultSiteTheme: SiteTheme = "royal";
export const siteThemeKey = "orcas-sharks.appearance.v1";

export function isSiteTheme(value: unknown): value is SiteTheme {
  return value === "royal" || value === "ivory";
}

// Restore the saved palette before the page paints. The script uses the
// existing per-request CSP nonce and only accepts the supported light palette.
export const restoreSiteTheme = `try {
  if (localStorage.getItem(${JSON.stringify(siteThemeKey)}) === "ivory") {
    document.documentElement.dataset.siteTheme = "ivory";
  }
} catch {}`;
