import type { Piece as PieceType } from "@/lib/game/types";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { Piece } from "./piece";

function ForestPiece({ kind }: { kind: PieceType }) {
  return kind === "orca" ? (
    <image href="/icons/tiger.webp" x="-25" y="-25" width="50" height="50" />
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
