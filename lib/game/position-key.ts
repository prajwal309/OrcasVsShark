import { NODES } from "./graph";
import type { GameState, PositionKey } from "./types";
export function createPositionKey(state: GameState): PositionKey {
  return `${NODES.map((n) => (state.board[n] === "orca" ? "O" : state.board[n] === "shark" ? "S" : ".")).join("")}:${state.turn}:${state.phase}:${state.sharksPlaced}:${state.sharksCaptured}`;
}
