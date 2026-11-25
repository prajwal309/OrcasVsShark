"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  useDailyDate,
  useDailyProgress,
} from "@/components/daily/daily-status";
import { GameDialog } from "@/components/game/game-dialog";
import { GameSettingsPanel } from "@/components/game/game-settings-panel";
import { HowToPlayTutorial } from "@/components/game/how-to-play-tutorial";
import {
  defaultGameSettings,
  readGameSettings,
  saveGameSettings,
  type GameSettings,
} from "@/lib/presentation/game-settings";
import { PuzzleMarker, PuzzleNavigation } from "./puzzle-navigation";
import { SiteBrand } from "./site-brand";

export function GameHeader({
  account,
  onRules,
  onSettings,
  onSettingsUpdate,
}: {
  account?: ReactNode;
  onRules?: () => void;
  onSettings?: () => void;
  onSettingsUpdate?: (settings: GameSettings) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const date = useDailyDate();
  const { progress } = useDailyProgress(date, true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const [dialog, setDialog] = useState<"rules" | "settings" | null>(null);
  const [settings, setSettings] = useState(defaultGameSettings);

  function openPanel(panel: "rules" | "settings") {
    setMenuOpen(false);
    const open = panel === "rules" ? onRules : onSettings;
    if (open) {
      open();
      return;
    }
    setSettings(readGameSettings());
    setDialog(panel);
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <SiteBrand />
          <div className="header-actions">
            <nav
              className="header-nav"
              aria-label="Main navigation"
              onKeyDown={(event) => {
                if (event.key === "Escape" && menuOpen) {
                  setMenuOpen(false);
                  menu.current?.focus();
                }
              }}
            >
              <Link
                href="/play"
                className="header-control header-play"
                aria-current={pathname === "/play" ? "page" : undefined}
                aria-label="Play"
                onClick={() => setMenuOpen(false)}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6 4.5a.75.75 0 0 1 1.15-.63l9 5.5a.75.75 0 0 1 0 1.28l-9 5.5A.75.75 0 0 1 6 15.5z" />
                </svg>
                <span>Play</span>
              </Link>
              <button
                ref={menu}
                type="button"
                className="header-control header-menu"
                aria-label="More navigation"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen(!menuOpen)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 5h12M4 10h12M4 15h12" />
                </svg>
                <PuzzleMarker status={progress.status} />
              </button>
              <div
                className="header-secondary"
                id={menuId}
                data-open={menuOpen}
              >
                <PuzzleNavigation
                  pathname={pathname}
                  status={progress.status}
                  onNavigate={() => setMenuOpen(false)}
                />
              </div>
              <button
                type="button"
                className="header-control header-rules"
                aria-label="How to Play"
                aria-haspopup="dialog"
                onClick={() => openPanel("rules")}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M10 5.5C8.1 4 5.8 3.6 2.75 4.25v11c3.05-.65 5.35-.25 7.25 1.25 1.9-1.5 4.2-1.9 7.25-1.25v-11C14.2 3.6 11.9 4 10 5.5v11" />
                </svg>
                <span>How to Play</span>
              </button>
              <button
                type="button"
                className="header-control header-settings"
                onClick={() => openPanel("settings")}
                aria-label="Open settings"
                aria-haspopup="dialog"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="m8.5 3-.45 1.8-1.25.7-1.8-.5L3.5 7.6 4.8 9v2l-1.3 1.4L5 15l1.8-.5 1.25.7L8.5 17h3l.45-1.8 1.25-.7 1.8.5 1.5-2.6-1.3-1.4V9l1.3-1.4L15 5l-1.8.5-1.25-.7L11.5 3z" />
                  <circle cx="10" cy="10" r="2.25" />
                </svg>
              </button>
            </nav>
            {account}
          </div>
        </div>
      </header>
      <GameDialog
        className={dialog === "rules" ? "how-to-play-dialog" : undefined}
        title={
          dialog === "rules"
            ? "How to Play"
            : dialog === "settings"
              ? "Your ocean table"
              : null
        }
        onClose={() => setDialog(null)}
      >
        {dialog === "rules" && (
          <HowToPlayTutorial
            theme={settings.theme}
            motion={settings.motion}
            onStartPlaying={() => {
              setDialog(null);
              if (pathname !== "/play") router.push("/play");
            }}
          />
        )}
        {dialog === "settings" && (
          <GameSettingsPanel
            settings={settings}
            onChange={(next) => {
              setSettings(next);
              onSettingsUpdate?.(next);
              try {
                saveGameSettings(next);
              } catch {
                // The settings still apply while this panel is open.
              }
            }}
          />
        )}
      </GameDialog>
    </>
  );
}
