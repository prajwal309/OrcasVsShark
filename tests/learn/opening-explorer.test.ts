import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/game/initial-state";
import type { GameState, Move, NodeId } from "@/lib/game/types";
import {
  canonicalPosition,
  openingMoveStatistics,
  replayOpeningLine,
  transformNode,
  type OpeningGame,
} from "@/lib/openings/explorer";

describe("opening explorer statistics", () => {
  it("treats reflected positions as the same board position", () => {
    const state = replayOpeningLine(["+b2"]);
    const board: GameState["board"] = {};
    for (const [node, piece] of Object.entries(state.board))
      if (piece)
        board[transformNode(node as NodeId, 4)] = piece;
    expect(canonicalPosition({ ...state, board }).key).toBe(
      canonicalPosition(state).key,
    );
  });

  it("aggregates move frequency and game outcomes across equivalent moves", () => {
    const place = (to: string): Move => ({
      kind: "place",
      to: to as NodeId,
    });
    const games: OpeningGame[] = [
      { moves: [place("b2")], winner: "orcas" },
      { moves: [place("b2")], winner: "sharks" },
      { moves: [place("d4")], winner: "draw" },
    ];
    const result = openingMoveStatistics(games, createInitialState());
    const center = result.moves.find(
      (row) => row.move.kind === "place" && row.move.to === "b2",
    );
    expect(result.games).toBe(3);
    expect(center?.games).toBe(3);
    expect(center?.frequency).toBe(1);
    expect(center?.orcaWinRate).toBeCloseTo(100 / 3);
    expect(center?.sharkWinRate).toBeCloseTo(100 / 3);
    expect(center?.drawRate).toBeCloseTo(100 / 3);
  });

  it("replays only legal move sequences", () => {
    expect(() => replayOpeningLine(["+a1"])).toThrow("Illegal opening move");
  });
});
