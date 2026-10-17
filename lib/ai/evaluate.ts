import { ADJACENCY, NODES } from "@/lib/game/graph";
import { getLegalMovesFrom } from "@/lib/game/legal-moves";
import type { GameState } from "@/lib/game/types";

// Positive scores favor Orcas. Evaluation never decides move legality.
export function evaluatePosition(state: GameState): number {
  if (state.result) return state.result.winner === "orcas" ? 100_000 : -100_000;
  const orcaTurn = { ...state, turn: "orcas" as const };
  let mobility = 0,
    trapped = 0,
    connectivity = 0,
    centralControl = 0,
    tempo = 0;
  const threatened = new Set<string>();
  for (const node of NODES) {
    if (state.board[node] === "orca") {
      const moves = getLegalMovesFrom(orcaTurn, node);
      mobility += moves.length;
      if (!moves.length) trapped++;
      for (const move of moves)
        if (move.kind === "capture") threatened.add(move.over);
    } else if (state.board[node] === "shark") {
      connectivity += ADJACENCY[node].filter(
        (n) => state.board[n] === "shark",
      ).length;
      // Graph degree measures useful junction control without rendering coordinates.
      centralControl += ADJACENCY[node].length;
    } else {
      const neighbors = ADJACENCY[node];
      if (neighbors.some((n) => state.board[n] === "orca")) tempo++;
    }
  }
  const placementPressure =
    state.phase === "shark-placement"
      ? (tempo * (20 - state.sharksPlaced)) / 20
      : 0;
  return (
    state.sharksCaptured * 300 +
    mobility * 12 -
    trapped * 150 +
    threatened.size * 48 -
    connectivity * 3 -
    centralControl * 2 -
    placementPressure * (state.turn === "sharks" ? 4 : 2)
  );
}
