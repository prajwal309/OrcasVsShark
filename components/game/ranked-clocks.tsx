"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Side } from "@/lib/game/types";
import { timeControls, type RankedView } from "@/lib/multiplayer/ranking";

function clockLabel(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function RankedClocks({
  ranking,
  anchor,
  turn,
  labels,
}: {
  ranking: RankedView;
  anchor: { receivedAt: number; latency: number };
  turn: Side | null;
  labels: Record<Side, string>;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!turn) return;
    const timer = window.setInterval(() => setFrame(performance.now()), 100);
    return () => window.clearInterval(timer);
  }, [turn]);

  const control = timeControls[ranking.mode];
  const elapsed = Math.max(0, frame - anchor.receivedAt) + anchor.latency;
  return (
    <section className="ranked-clocks" aria-label="Ranked game clocks">
      <p>
        {control.name} · {control.minutes} min + {control.increment} sec per
        move
      </p>
      <div className="ranked-clock-grid">
        {(["sharks", "orcas"] as const).map((side) => {
          const player = ranking.players[side];
          const running = turn === side;
          const remaining = Math.max(
            0,
            ranking.remaining[side] - (running ? elapsed : 0),
          );
          const change = player.change;
          return (
            <div
              className="ranked-clock"
              key={side}
              data-running={running || undefined}
            >
              <div>
                <Link href={`/players/${player.username}`}>
                  {player.username}
                </Link>
                <div>
                  {labels[side]} · {player.rating + (change ?? 0)} Elo
                  {change !== null && (
                    <span
                      className="ranked-delta"
                      data-loss={change < 0 || undefined}
                    >
                      {" "}
                      ({change >= 0 ? "+" : ""}
                      {change})
                    </span>
                  )}
                </div>
              </div>
              <span
                role="timer"
                aria-label={`${labels[side]} time`}
                data-low={remaining <= 20_000 || undefined}
              >
                {clockLabel(remaining)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
