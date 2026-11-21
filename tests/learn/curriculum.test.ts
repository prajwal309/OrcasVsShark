// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves, isLegalMove } from "@/lib/game/legal-moves";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import { curriculum } from "@/lib/learn/curriculum";
import {
  acceptedAnswer,
  exerciseRound,
  moveCode,
  prepareExercise,
  replay,
} from "@/lib/learn/exercises";
import { blockingPosition, huntingPosition } from "@/lib/learn/positions";

const expected: Record<string, string[]> = {
  "opening-jump": ["b2xd4"],
  "close-the-landing": ["+d4"],
  "quiet-opening": [
    "+c1",
    "+c2",
    "+a3",
    "+b3",
    "+c3",
    "+d3",
    "+e3",
    "+c4",
    "+c5",
  ],
  "last-gap": ["+c5"],
  "corner-squeeze": ["+b2"],
  "edge-escape": ["a5xc5"],
  "fifth-capture": ["b3xb5", "c5xa3"],
  "occupied-landing": [],
  "force-the-fifth": ["a4-a3", "b3-a3", "b3-c3"],
  "defuse-the-win": ["c2-c1", "d1-c1"],
  "two-directions": ["b2xd4", "b4xd4"],
  "final-surround": ["c4-c5", "d4-c5"],
};

describe("authored Academy activities", () => {
  it("ships a complete beginner course and enough verified puzzles", () => {
    expect(
      curriculum.lesson.filter(({ level }) => level === "Beginner"),
    ).toHaveLength(8);
    expect(curriculum.lesson).toHaveLength(20);
    expect(curriculum.puzzle).toHaveLength(12);
    expect(curriculum.quiz).toHaveLength(6);
    expect(replay(huntingPosition(Infinity)).result?.reason).toBe(
      "five-captures",
    );
    expect(replay(blockingPosition(Infinity)).result?.reason).toBe(
      "immobilization",
    );
  });
  for (const [kind, exercises] of Object.entries(curriculum)) {
    it(`replays every ${kind} and rejects unsupported answers`, () => {
      expect(new Set(exercises.map(({ id }) => id)).size).toBe(
        exercises.length,
      );
      for (const exercise of exercises) {
        const { start, answers } = prepareExercise(exercise);
        expect(deserializeState(serializeState(start))).toEqual(start);
        expect(start.history.length).toBe(start.ply + 1);
        expect(start.turn).toBe(exercise.side);
        expect(start.result).toBeNull();
        if (exercise.goal.kind === "choice") {
          const correct = exercise.goal.answer;
          exercise.goal.choices.forEach((_, index) => {
            expect(acceptedAnswer(exercise, index, null)).toBe(
              index === correct,
            );
          });
        } else {
          const accepted = new Set(answers.map(({ move }) => moveCode(move)));
          for (const move of getLegalMoves(start)) {
            if (exercise.goal.kind === "win-in-two") {
              expect(acceptedAnswer(exercise, moveCode(move), null)).toBe(
                false,
              );
              continue;
            }
            expect(acceptedAnswer(exercise, moveCode(move), null)).toBe(
              accepted.has(moveCode(move)),
            );
          }
          expect(acceptedAnswer(exercise, "a1-e5", null)).toBe(false);
        }
      }
    });
  }
  for (const puzzle of curriculum.puzzle) {
    it(`validates the complete solution set for ${puzzle.id}`, () => {
      const { start, answers } = prepareExercise(puzzle);
      expect(answers.map(({ move }) => moveCode(move)).sort()).toEqual(
        [...expected[puzzle.id]].sort(),
      );
      for (const solution of answers) {
        const next = applyMove(start, solution.move);
        if (puzzle.goal.kind === "win")
          expect(next.result?.winner).toBe(puzzle.side);
        if (puzzle.goal.kind === "safe")
          expect(
            getLegalMoves(next).every(({ kind }) => kind !== "capture"),
          ).toBe(true);
        if (puzzle.goal.kind === "mobility")
          expect(getLegalMoves(next).length).toBeLessThanOrEqual(
            puzzle.goal.maximum,
          );
        if (puzzle.goal.kind !== "win-in-two") continue;
        expect(solution.replies.length).toBeGreaterThan(0);
        expect(
          solution.replies.map(({ move }) => moveCode(move)).sort(),
        ).toEqual(getLegalMoves(next).map(moveCode).sort());
        for (const reply of solution.replies) {
          expect(reply.answers.length).toBeGreaterThan(0);
          expect(isLegalMove(next, reply.move)).toBe(true);
          const continuation = applyMove(next, reply.move);
          for (const answer of reply.answers)
            expect(applyMove(continuation, answer).result?.winner).toBe(
              puzzle.side,
            );
        }
        const played = exerciseRound(puzzle, moveCode(solution.move));
        expect(played.state.ply).toBe(start.ply + 2);
        for (const answer of played.answers)
          expect(
            acceptedAnswer(puzzle, moveCode(answer), moveCode(solution.move)),
          ).toBe(true);
      }
    });
  }
});
