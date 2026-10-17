"use client";

import { useId, useState, type CSSProperties } from "react";
import { ThemedPieceIcon } from "@/components/board/themed-piece";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import type { Side } from "@/lib/game/types";

export function VictoryBanner({
  winner,
  theme,
  actionLabel,
  disabled,
  onPlay,
  note,
}: {
  winner: Side;
  theme: BoardTheme;
  actionLabel: string;
  disabled: boolean;
  onPlay: () => void;
  note?: string;
}) {
  const [compact, setCompact] = useState(false);
  const headingId = useId();
  const labels = themeLabels(theme);
  return (
    <section
      className={`victory-banner${compact ? " is-compact" : ""}`}
      aria-labelledby={headingId}
    >
      <div className="victory-sparks" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
          <i
            key={i}
            style={
              {
                "--spark-angle": `${i * 30}deg`,
                "--spark-delay": `${(i % 3) * 60}ms`,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="victory-medallion" aria-hidden="true">
        <ThemedPieceIcon
          kind={winner === "orcas" ? "orca" : "shark"}
          theme={theme}
        />
      </div>
      <p className="victory-eyebrow">VICTORY</p>
      <h2 id={headingId}>{labels.sides[winner]} win!</h2>
      <p className="victory-copy">
        {winner === "orcas"
          ? "A decisive hunt. Well played."
          : "Strength in numbers. Well played."}
      </p>
      {note && (
        <p className="victory-note" role="status">
          {note}
        </p>
      )}
      <div className="victory-actions">
        <button className="primary-button" onClick={onPlay} disabled={disabled}>
          {actionLabel}
        </button>
        <button
          className="victory-review"
          onClick={() => setCompact((value) => !value)}
          aria-expanded={!compact}
        >
          {compact ? "Show celebration" : "View board"}
        </button>
      </div>
    </section>
  );
}
