import type { Piece as PieceType } from "@/lib/game/types";

/** Original silhouettes, drawn for this project. */
export function Piece({ kind }: { kind: PieceType }) {
  return kind === "orca" ? (
    <g>
      <circle
        r="25"
        fill="url(#orca-disc)"
        stroke="#8da9b4"
        strokeWidth="1.4"
      />
      <path
        d="M-17 6C-22-5-9-14 3-10L6-19 11-9C17-7 20-2 21 2L13 4C7 15-9 16-17 6Z"
        fill="#ecf5ef"
      />
      <path
        d="M-18 4C-16-7-6-12 3-9L6-18 10-8C14-6 17-3 19 0L9 1C2-3-4 6-12 7Z"
        fill="#101e28"
      />
      <ellipse
        cx="7"
        cy="-4"
        rx="4.2"
        ry="2.4"
        transform="rotate(-20 7 -4)"
        fill="#f3f7ef"
      />
      <path d="M-15 5L-23 0-21 11-13 9" fill="#eaf3ed" />
    </g>
  ) : (
    <g>
      <circle
        r="20"
        fill="url(#shark-disc)"
        stroke="#b1d7d5"
        strokeWidth="1.2"
      />
      <path
        d="M-14 4Q-9-5 0-5L4-14 8-5 16 0 8 5 3 11 0 6Q-8 9-14 4L-19 10-17 1-20-5Z"
        fill="#173d4a"
      />
      <circle cx="10" cy="0" r="1.2" fill="#d3eee5" />
      <path d="M2-1 0 3M-2-1-4 3" stroke="#9cc7c7" strokeWidth="1" />
    </g>
  );
}
export function PieceIcon({ kind }: { kind: PieceType }) {
  return (
    <svg viewBox="-30 -30 60 60" width="48" height="48" aria-hidden="true">
      <Piece kind={kind} />
    </svg>
  );
}
