import type { Piece as PieceType } from "@/lib/game/types";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { Piece } from "./piece";

/** Original animal medallions drawn specifically for the forest table. */
function ForestPiece({ kind }: { kind: PieceType }) {
  return kind === "orca" ? (
    <g strokeLinejoin="round" strokeLinecap="round">
      <circle r="25" fill="#412c1f" stroke="#edc887" strokeWidth="1.5" />
      <path
        d="M-17-9Q-25-22-13-20L-7-15M17-9Q25-22 13-20L7-15"
        fill="#e7a447"
        stroke="#1f2019"
        strokeWidth="2"
      />
      <path
        d="M-18-5Q-18-19 0-18Q18-19 18-5L16 9Q10 21 0 21Q-10 21-16 9Z"
        fill="#e7a447"
        stroke="#29241c"
        strokeWidth="1.6"
      />
      <path
        d="M-7 6Q-15 3-13 12Q-10 19 0 18Q10 19 13 12Q15 3 7 6L0 9Z"
        fill="#fff0cd"
      />
      <g fill="#29241c">
        <path d="M-4-18 0-8 4-18M-17-11-7-6-17-6M17-11 7-6 17-6M-18-1-9 3-17 5M18-1 9 3 17 5M-15 9-8 11-11 15M15 9 8 11 11 15" />
        <path d="M-4 8H4L0 12Z" />
      </g>
      <path
        d="M-11-2-6-1M6-1 11-2M0 12V15M-4 15Q0 18 4 15"
        fill="none"
        stroke="#29241c"
        strokeWidth="1.7"
      />
      <g stroke="#fff0cd" strokeWidth=".9">
        <path d="M-9 10-20 8M-9 13-20 14M9 10 20 8M9 13 20 14" />
      </g>
    </g>
  ) : (
    <g strokeLinejoin="round" strokeLinecap="round">
      <circle r="21" fill="#e9e3ca" stroke="#b3b68c" strokeWidth="1.5" />
      <path
        d="M-7-9Q-16-20-8-25Q-10-17-3-12M7-9Q16-20 8-25Q10-17 3-12"
        fill="#b6ab8c"
        stroke="#3c4233"
        strokeWidth="1.5"
      />
      <path
        d="M-8-6Q-21-13-18-3L-10 2M8-6Q21-13 18-3L10 2"
        fill="#f9f6e9"
        stroke="#3c4233"
        strokeWidth="1.5"
      />
      <path
        d="M-10-8Q0-14 10-8L9 4 5 13 0 17-5 13-9 4Z"
        fill="#fffdf1"
        stroke="#3c4233"
        strokeWidth="1.6"
      />
      <path
        d="M-3 15 0 22 3 15"
        fill="#fffdf1"
        stroke="#3c4233"
        strokeWidth="1.2"
      />
      <path
        d="M-6-1H-3M3-1H6M-2 10H2L0 12ZM0 12V14"
        fill="none"
        stroke="#303d32"
        strokeWidth="1.8"
      />
    </g>
  );
}

export function ThemedPiece({
  kind,
  theme = "ocean",
}: {
  kind: PieceType;
  theme?: BoardTheme;
}) {
  return theme === "tigers-goats" ? (
    <ForestPiece kind={kind} />
  ) : (
    <Piece kind={kind} />
  );
}

export function ThemedPieceIcon({
  kind,
  theme = "ocean",
}: {
  kind: PieceType;
  theme?: BoardTheme;
}) {
  return (
    <svg
      viewBox="-30 -30 60 60"
      width="48"
      height="48"
      role="img"
      aria-label={themeLabels(theme).pieces[kind]}
    >
      <ThemedPiece kind={kind} theme={theme} />
    </svg>
  );
}
