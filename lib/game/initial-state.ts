import { createPositionKey } from "./position-key";
import type { GameState } from "./types";
export function createInitialState(): GameState {
  const state: GameState = {
    board: { a1: "orca", e1: "orca", a5: "orca", e5: "orca" },
    turn: "sharks",
    phase: "shark-placement",
    sharksPlaced: 0,
    sharksCaptured: 0,
    ply: 0,
    history: [],
    result: null,
  };
  return { ...state, history: [createPositionKey(state)] };
}
