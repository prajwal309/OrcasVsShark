import type { Piece as PieceType } from "@/lib/game/types";

export function Piece({ kind }: { kind: PieceType }) {
  return (
    <image
      href={kind === "orca" ? "/icons/orca.webp" : "/icons/shark.webp"}
      x="-25"
      y="-25"
      width="50"
      height="50"
    />
  );
}

export function PieceIcon({ kind }: { kind: PieceType }) {
  return (
    <svg
      viewBox="-30 -30 60 60"
      width="48"
      height="48"
      aria-label={kind}
      role="img"
    >
      <Piece kind={kind} />
    </svg>
  );
}
