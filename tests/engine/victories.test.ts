import { expect, it } from "vitest";
import victories from "../fixtures/victories.json";
import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { serializeState, deserializeState } from "@/lib/game/serialization";
import type { Move } from "@/lib/game/types";
for (const side of ["orcas", "sharks"] as const)
  it(`replays a complete ${side} victory with invariants at every ply`, () => {
    let state = createInitialState();
    for (const move of victories[side] as Move[]) {
      const before = structuredClone(state);
      const next = applyMove(state, move);
      expect(state).toEqual(before);
      state = next;
      expect(
        Object.values(state.board).filter((p) => p === "orca"),
      ).toHaveLength(4);
      expect(
        Object.values(state.board).filter((p) => p === "shark"),
      ).toHaveLength(state.sharksPlaced - state.sharksCaptured);
      expect(deserializeState(serializeState(state))).toEqual(state);
    }
    expect(state.result?.winner).toBe(side);
  });
