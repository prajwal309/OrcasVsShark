import type { Piece as PieceType } from "@/lib/game/types";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { Piece } from "./piece";

/** Original animal medallions drawn specifically for the forest table. */
function ForestPiece({ kind }: { kind: PieceType }) {
  return kind === "orca" ? (
    <g strokeLinejoin="round" strokeLinecap="round">
      <circle r="25" fill="#35231e" stroke="#edc887" strokeWidth="1.5" />
      <path
        d="M-16-7C-22-10-25-18-20-19C-17-20-12-17-10-14M16-7C22-10 25-18 20-19C17-20 12-17 10-14"
        fill="#cc7028"
        stroke="#291a18"
        strokeWidth="2"
      />
      <path
        d="M-18-11Q-22-16-19-16L-14-13M18-11Q22-16 19-16L14-13"
        fill="#592e25"
      />
      <path
        d="M0-19Q9-20 16-13L19-6L18 3L20 7L15 11Q11 22 0 22Q-11 22-15 11L-20 7L-18 3L-19-6L-16-13Q-9-20 0-19Z"
        fill="#e89031"
        stroke="#2b1b18"
        strokeWidth="1.8"
      />
      <path
        d="M-15 3Q-12 0-6 3L0 6L6 3Q12 0 15 3L17 7L13 12Q10 21 0 21Q-10 21-13 12L-17 7Z"
        fill="#ffebbe"
      />
      <g fill="#301c18">
        <path d="M-6-18-2-19 0-10 2-19 6-18 0-7ZM-16-13Q-10-13-5-9L-8-9-17-10ZM16-13Q10-13 5-9L8-9 17-10ZM-18-3-12 0-18 1ZM18-3 12 0 18 1ZM-18 5-10 7-15 10ZM18 5 10 7 15 10Z" />
        <path d="M-15-8Q-9-8-4-3L-6 0Q-13 0-15-8ZM15-8Q9-8 4-3L6 0Q13 0 15-8Z" />
        <path d="M-5 2Q0 0 5 2L3 6H-3Z" />
        <path d="M-12 6Q-6 5 0 8Q6 5 12 6L10 15Q7 20 0 20Q-7 20-10 15Z" />
      </g>
      <path d="M-12-5-6-3Q-9-1-12-5ZM12-5 6-3Q9-1 12-5Z" fill="#ffdc78" />
      <path d="M-5 17Q0 13 5 17Q0 20-5 17Z" fill="#b84e47" />
      <path
        d="M-10 7-5 8-8 15ZM10 7 5 8 8 15ZM-4 16-6 12-8 15ZM4 16 6 12 8 15Z"
        fill="#fff6df"
      />
      <g fill="none" stroke="#ffebbe" strokeWidth="1.25">
        <path d="M-13 7-21 6M-12 10-20 12M13 7 21 6M12 10 20 12" />
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
