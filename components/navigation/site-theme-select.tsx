"use client";

import { useSyncExternalStore } from "react";
import {
  defaultSiteTheme,
  isSiteTheme,
  siteThemeKey,
  siteThemes,
  type SiteTheme,
} from "@/lib/presentation/site-themes";

const changeEvent = "orcas-site-theme-change";

function currentTheme() {
  const value = document.documentElement.dataset.siteTheme;
  return isSiteTheme(value) ? value : defaultSiteTheme;
}

function setTheme(value: SiteTheme) {
  document.documentElement.dataset.siteTheme = value;
  window.dispatchEvent(new Event(changeEvent));
}

function subscribe(onChange: () => void) {
  function sync(event: StorageEvent) {
    if (event.key === siteThemeKey || event.key === null) {
      setTheme(isSiteTheme(event.newValue) ? event.newValue : defaultSiteTheme);
    }
  }

  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", sync);
  };
}

export function SiteThemeSelect() {
  const theme = useSyncExternalStore(
    subscribe,
    currentTheme,
    () => defaultSiteTheme,
  );
  return (
    <label className="site-theme-select">
      <span>Site appearance</span>
      <select
        value={theme}
        onChange={({ currentTarget }) => {
          const value = currentTarget.value;
          if (!isSiteTheme(value)) return;
          setTheme(value);
          try {
            localStorage.setItem(siteThemeKey, value);
          } catch {
            // The selection still applies in this tab if storage is disabled.
          }
        }}
      >
        {Object.entries(siteThemes).map(([value, name]) => (
          <option key={value} value={value}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}
