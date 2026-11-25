import { describe, expect, it } from "vitest";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves, isLegalMove } from "@/lib/game/legal-moves";
import { moveCode } from "@/lib/learn/exercises";
import {
  tutorialMoveIsCorrect,
  tutorialSteps,
} from "@/lib/game/tutorial-scenarios";

describe("How to Play tutorial scenarios", () => {
  it("uses legal, accepted moves for every demonstration and practice answer", () => {
    for (const step of tutorialSteps) {
      expect(step.demoStates).toHaveLength(step.demoMoves.length + 1);
      let state = step.start;
      for (const [index, move] of step.demoMoves.entries()) {
        expect(isLegalMove(state, move), `${step.id}: ${moveCode(move)}`).toBe(
          true,
        );
        expect(tutorialMoveIsCorrect(step, move)).toBe(true);
        state = applyMove(state, move);
        expect(state).toEqual(step.demoStates[index + 1]);
      }

      const legalCodes = getLegalMoves(step.start).map(moveCode);
      expect(step.acceptedMoveCodes.length, step.id).toBeGreaterThan(0);
      for (const answer of step.acceptedMoveCodes)
        expect(legalCodes, `${step.id}: ${answer}`).toContain(answer);
    }
  });

  it("covers both victory conditions with reachable positions", () => {
    const immobilization = tutorialSteps.find(
      (step) => step.id === "final-surround",
    )!;
    expect(immobilization.start.phase).toBe("shark-movement");
    expect(immobilization.start.sharksPlaced).toBe(20);
    expect(immobilization.demoStates.at(-1)?.result?.winner).toBe("sharks");

    const fifthCapture = tutorialSteps.find(
      (step) => step.id === "fifth-capture",
    )!;
    expect(fifthCapture.start.sharksCaptured).toBe(4);
    const finalState = fifthCapture.demoStates.at(-1)!;
    expect(finalState.result?.winner).toBe("orcas");
  });
});
