import type { Move } from "./types";
export function formatMove(move: Move): string {
  return move.kind === "place"
    ? `+${move.to}`
    : `${move.from}${move.kind === "capture" ? "×" : "–"}${move.to}`;
}
