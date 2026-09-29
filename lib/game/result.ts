import { getLegalMoves } from "./legal-moves";
import type { GameResult, GameState } from "./types";
export function getGameResult(state: GameState): GameResult | null {
  if (state.sharksCaptured >= 5)
    return { winner: "orcas", reason: "five-captures" };
  if (getLegalMoves({ ...state, turn: "orcas", result: null }).length === 0)
    return { winner: "sharks", reason: "immobilization" };
  return null;
}
