import { ADJACENCY, CAPTURE_PATHS, NODES } from "./graph";
import type { GameState, Move, NodeId } from "./types";

export function getLegalMovesFrom(state: GameState, node: NodeId): Move[] {
  if (state.result || !NODES.includes(node)) return [];
  const piece = state.board[node];
  if (piece !== (state.turn === "orcas" ? "orca" : "shark")) return [];
  if (piece === "shark" && state.phase === "shark-placement") return [];
  const moves: Move[] = ADJACENCY[node]
    .filter((to) => !state.board[to])
    .map((to) => ({ kind: "step", from: node, to }));
  if (piece === "orca") {
    for (const [from, over, to] of CAPTURE_PATHS) {
      if (from === node && state.board[over] === "shark" && !state.board[to])
        moves.push({ kind: "capture", from, over, to });
    }
  }
  return moves;
}
export function getLegalMoves(state: GameState): Move[] {
  if (state.result) return [];
  if (state.turn === "sharks" && state.phase === "shark-placement") {
    return state.sharksPlaced < 20
      ? NODES.filter((to) => !state.board[to]).map((to) => ({
          kind: "place",
          to,
        }))
      : [];
  }
  return NODES.flatMap((node) => getLegalMovesFrom(state, node));
}
export function isLegalMove(state: GameState, move: Move): boolean {
  if (!move || typeof move !== "object") return false;
  return getLegalMoves(state).some(
    (legal) =>
      legal.kind === move.kind &&
      legal.to === move.to &&
      (legal.kind === "place" ||
        (move.kind !== "place" && legal.from === move.from)) &&
      (legal.kind !== "capture" ||
        (move.kind === "capture" && legal.over === move.over)),
  );
}
