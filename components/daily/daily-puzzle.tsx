"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExercisePlayer } from "@/components/learn/exercise-player";
import { ProgressProvider } from "@/components/learn/progress-provider";
import { AccountLink } from "@/components/navigation/account-navigation";
import { GameHeader } from "@/components/navigation/game-header";
import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import { emptyProgress } from "@/lib/learn/progress";
import { applyDailyAction, type DailyAction } from "@/lib/daily/status";
import type { DailyDifficulty } from "@/lib/daily/puzzles";
import type { Puzzle } from "@/lib/learn/exercises";
import {
  defaultGameSettings,
  readGameSettings,
} from "@/lib/presentation/game-settings";
import { useDailyDate, useDailyProgress } from "./daily-status";

export function DailyPuzzle({
  date,
  puzzle,
  registered,
  followToday,
  difficulty,
}: {
  date: string;
  puzzle: Puzzle;
  registered: boolean;
  followToday: boolean;
  difficulty: DailyDifficulty;
}) {
  const router = useRouter();
  const today = useDailyDate();
  const [settings, setSettings] = useState(defaultGameSettings);
  const daily = useDailyProgress(date, !followToday && date !== today);
  const pending = useRef(Promise.resolve());
  const sequence = useRef(0);
  const [syncMessage, setSyncMessage] = useState("");
  const [statsUnavailable, setStatsUnavailable] = useState(false);
  const [summary, setSummary] = useState<{
    attempted: number;
    solved: number;
    attempts: number;
    streak: number;
  } | null>(null);
  const successRate = summary?.attempted
    ? Math.round((summary.solved / summary.attempted) * 100)
    : 0;

  useEffect(() => {
    queueMicrotask(() => setSettings(readGameSettings()));
  }, []);

  useEffect(() => {
    if (followToday && date !== today) router.refresh();
  }, [date, followToday, router, today]);

  useEffect(() => {
    if (!registered) return;
    const controller = new AbortController();
    void fetch("/api/daily-puzzle", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Daily puzzle stats unavailable.");
        setSummary(await response.json());
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatsUnavailable(true);
      });
    return () => controller.abort();
  }, [registered]);

  function recordAttempt(event: DailyAction, correct = false) {
    const next = applyDailyAction(daily.read(), event, correct);
    daily.save(next);
    if (!registered) return;
    const revision = ++sequence.current;
    pending.current = pending.current.then(async () => {
      try {
        const response = await fetch("/api/daily-puzzle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            puzzleId: puzzle.id,
            ...event,
            hintsUsed: next.hintsUsed,
            solutionRevealed: next.status === "revealed",
          }),
        });
        if (!response.ok) throw new Error("Daily puzzle stats could not sync.");
        const receipt = await response.json();
        if (!receipt.recorded)
          throw new Error("Daily puzzle event was rejected.");
        if (revision === sequence.current) daily.save(receipt.progress);
        setSyncMessage("");
        if (receipt.solved) {
          const statsResponse = await fetch("/api/daily-puzzle");
          if (statsResponse.ok) {
            setSummary(await statsResponse.json());
            setStatsUnavailable(false);
          } else
            setSyncMessage("Solved; account statistics could not refresh.");
        }
      } catch {
        setSyncMessage(
          "Your puzzle progress is saved on this device; account statistics could not sync.",
        );
      }
    });
  }

  const activityPuzzle = {
    ...puzzle,
    id: puzzle.id.replace(/^daily-\d{4}-\d{2}-\d{2}-/, ""),
  };

  return (
    <div
      className={`site-shell theme-${settings.theme} ${settings.motion ? "" : "no-motion"}`}
    >
      <GameHeader account={<AccountLink />} onSettingsUpdate={setSettings} />
      <main className="main-content">
        <div className="lobby-intro">
          <div>
            <p className="eyebrow">DAILY TACTICS</p>
            <h1>Daily Puzzle</h1>
            <p>
              {date === today ? "Today’s puzzle" : `Puzzle from ${date}`} ·{" "}
              {difficulty}
            </p>
          </div>
          <SiteThemeSelect />
        </div>
        <div className="daily-puzzle-content">
          {registered && (
            <section
              className="turn-card daily-stats"
              aria-label="Puzzle statistics"
            >
              <h2>Your puzzle progress</h2>
              {summary ? (
                <p>
                  {summary.solved} of {summary.attempted} days solved ·{" "}
                  {successRate}% success rate · {summary.attempts} attempts ·{" "}
                  {summary.streak}-day streak
                </p>
              ) : statsUnavailable ? (
                <p role="status">
                  Your account puzzle statistics are unavailable.
                </p>
              ) : (
                <p>Loading account statistics…</p>
              )}
            </section>
          )}
          <ProgressProvider
            key={daily.key}
            account={null}
            initial={emptyProgress}
            storageKey={`${daily.key}:round`}
            mirrorToParent={daily.progress.status !== "revealed"}
          >
            <ExercisePlayer
              exercise={activityPuzzle}
              kind="puzzle"
              theme={settings.theme}
              dailyPuzzleMode
              dailyPractice={daily.progress.status === "revealed"}
              onPuzzleAttempt={recordAttempt}
            />
          </ProgressProvider>
          {syncMessage && <p role="status">{syncMessage}</p>}
        </div>
      </main>
    </div>
  );
}
