import { isLegalMove } from "./legal-moves";
import { createPositionKey } from "./position-key";
import { getGameResult } from "./result";
import { GameError, type GameState, type Move } from "./types";
export function applyMove(state: GameState, move: Move): GameState {
  if (!isLegalMove(state, move))
    throw new GameError(
      "ILLEGAL_MOVE",
      "That move is not legal in this position.",
    );
  const next: GameState = {
    ...state,
    board: { ...state.board },
    turn: state.turn === "sharks" ? "orcas" : "sharks",
    ply: state.ply + 1,
  };
  if (move.kind === "place") {
    next.board[move.to] = "shark";
    next.sharksPlaced++;
    if (next.sharksPlaced === 20) next.phase = "shark-movement";
  } else {
    next.board[move.to] = next.board[move.from];
    delete next.board[move.from];
    if (move.kind === "capture") {
      delete next.board[move.over];
      next.sharksCaptured++;
    }
  }
  next.result = getGameResult(next);
  next.history = [...state.history, createPositionKey(next)];
  return next;
}
