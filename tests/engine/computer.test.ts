import { describe, expect, it } from "vitest";
import { findComputerMove } from "@/lib/ai/search";
import { evaluatePosition } from "@/lib/ai/evaluate";
import { computerSettingsSchema, workerRequestSchema } from "@/lib/ai/types";
import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { isLegalMove } from "@/lib/game/legal-moves";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import type { Move } from "@/lib/game/types";
import victories from "../fixtures/victories.json";

describe("computer search", () => {
  for (const winner of ["orcas", "sharks"] as const) {
    it(`finds an immediate ${winner} victory without mutating the position`, () => {
      let state = createInitialState();
      for (const move of (victories[winner] as Move[]).slice(0, -1))
        state = applyMove(state, move);
      const before = structuredClone(state);
      const result = findComputerMove(state, "easy", {
        now: () => 0,
        random: () => 0,
      });
      expect(result.move).not.toBeNull();
      expect(applyMove(state, result.move!).result?.winner).toBe(winner);
      expect(state).toEqual(before);
      expect(result.depth).toBeGreaterThan(0);
    });
  }

  for (const difficulty of ["easy", "medium", "hard"] as const) {
    it(`returns canonical legal moves as both sides at ${difficulty} difficulty`, () => {
      let state = createInitialState();
      for (let ply = 0; ply < 8 && !state.result; ply++) {
        let time = 0;
        const result = findComputerMove(state, difficulty, {
          now: () => time++,
          random: () => 0.5,
        });
        expect(isLegalMove(state, result.move!)).toBe(true);
        state = applyMove(state, result.move!);
        expect(deserializeState(serializeState(state))).toEqual(state);
      }
    });
  }

  it("returns a legal fallback on timeout, including before the first completed depth", () => {
    const state = createInitialState();
    let time = 0;
    const result = findComputerMove(state, "hard", {
      now: () => (time += 2000),
    });
    expect(result.depth).toBe(0);
    expect(isLegalMove(state, result.move!)).toBe(true);
  });

  it("plays legal Shark steps and Orca moves after placement ends", () => {
    let state = createInitialState();
    let checked = 0;
    for (const move of victories.sharks as Move[]) {
      state = applyMove(state, move);
      if (state.phase === "shark-movement" && !state.result) {
        for (const difficulty of ["easy", "medium", "hard"] as const) {
          let time = 0;
          const result = findComputerMove(state, difficulty, {
            now: () => time++,
          });
          expect(result.move?.kind).not.toBe("place");
          expect(isLegalMove(state, result.move!)).toBe(true);
        }
        checked++;
        if (checked === 2) break;
      }
    }
    expect(checked).toBe(2);
  });

  it("does not propose a move after either board result", () => {
    for (const winner of ["orcas", "sharks"] as const) {
      let state = createInitialState();
      for (const move of victories[winner] as Move[])
        state = applyMove(state, move);
      expect(findComputerMove(state, "hard").move).toBeNull();
      expect(Math.sign(evaluatePosition(state))).toBe(
        winner === "orcas" ? 1 : -1,
      );
    }
  });

  it("keeps easy move variety within legal options and harder searches deterministic", () => {
    const state = createInitialState();
    const first = findComputerMove(state, "easy", {
      now: () => 0,
      random: () => 0,
    });
    const last = findComputerMove(state, "easy", {
      now: () => 0,
      random: () => 0.999,
    });
    expect(isLegalMove(state, first.move!)).toBe(true);
    expect(isLegalMove(state, last.move!)).toBe(true);
    expect(first.move).not.toEqual(last.move);
    const run = () => {
      let time = 0;
      return findComputerMove(state, "medium", { now: () => time++ }).move;
    };
    expect(run()).toEqual(run());
  });

  it("rejects malformed computer settings and worker requests", () => {
    expect(
      computerSettingsSchema.safeParse({
        humanSide: "orca",
        difficulty: "expert",
      }).success,
    ).toBe(false);
    expect(
      workerRequestSchema.safeParse({
        snapshot: "{}",
        difficulty: "easy",
        timeMs: 999999,
      }).success,
    ).toBe(false);
  });
});
