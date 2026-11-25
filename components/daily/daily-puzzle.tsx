"use client";

import { useEffect, useState } from "react";
import { ExercisePlayer } from "@/components/learn/exercise-player";
import type { Puzzle } from "@/lib/learn/exercises";
import type { BoardTheme } from "@/lib/presentation/board-themes";

export function DailyPuzzle({
  date,
  puzzle,
  registered,
  theme,
}: {
  date: string;
  puzzle: Puzzle;
  registered: boolean;
  theme: BoardTheme;
}) {
  const [syncMessage, setSyncMessage] = useState("");
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
    if (!registered) return;
    const controller = new AbortController();
    void fetch("/api/daily-puzzle", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Daily puzzle stats unavailable.");
        setSummary(await response.json());
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setSyncMessage("Your account puzzle statistics are unavailable.");
      });
    return () => controller.abort();
  }, [registered]);

  async function recordAttempt(event: {
    action: "attempt" | "hint";
    answer?: string | number;
    hintsUsed: number;
    seconds: number;
    opening?: string | null;
  }) {
    if (!registered) return;
    try {
      const response = await fetch("/api/daily-puzzle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          puzzleId: puzzle.id,
          ...event,
        }),
      });
      if (!response.ok) throw new Error("Daily puzzle stats could not sync.");
      const statsResponse = await fetch("/api/daily-puzzle");
      if (statsResponse.ok) setSummary(await statsResponse.json());
      setSyncMessage("");
    } catch {
      setSyncMessage(
        "Your puzzle progress is saved on this device; account statistics could not sync.",
      );
    }
  }

  const activityPuzzle = {
    ...puzzle,
    id: puzzle.id.replace(/^daily-\d{4}-\d{2}-\d{2}-/, ""),
  };

  return (
    <>
      {registered && (
        <section className="turn-card daily-stats" aria-label="Puzzle statistics">
          <h2>Your puzzle progress</h2>
          {summary ? (
            <p>
              {summary.solved} of {summary.attempted} days solved ·{" "}
              {successRate}% success rate · {summary.attempts} attempts ·{" "}
              {summary.streak}-day streak
            </p>
          ) : (
            <p>Loading account statistics…</p>
          )}
        </section>
      )}
      <ExercisePlayer
        exercise={activityPuzzle}
        kind="puzzle"
        theme={theme}
        onPuzzleAttempt={(event) => void recordAttempt(event)}
      />
      {syncMessage && <p role="status">{syncMessage}</p>}
    </>
  );
}
