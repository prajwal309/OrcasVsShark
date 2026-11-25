import { describe, expect, it } from "vitest";
import {
  dailyPuzzleArchive,
  dailyPuzzleDifficulty,
  dailyPuzzleForDate,
} from "@/lib/daily/puzzles";
import {
  acceptedAnswer,
  prepareExercise,
} from "@/lib/learn/exercises";

describe("daily puzzles", () => {
  it("publishes a validated, reachable puzzle from either side at each difficulty", () => {
    const today = new Date();
    const unique = new Map<string, ReturnType<typeof dailyPuzzleForDate>>();
    for (let offset = 0; offset < 30; offset++) {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() - offset);
      const puzzle = dailyPuzzleForDate(date.toISOString().slice(0, 10));
      unique.set(puzzle.title, puzzle);
    }
    const puzzles = [...unique.values()];
    const difficulties = new Set(
      puzzles.map((puzzle) => dailyPuzzleDifficulty(puzzle)),
    );
    expect(difficulties).toEqual(new Set(["Easy", "Medium", "Hard"]));
    const sides = new Set<string>();
    for (const puzzle of puzzles) {
      const { start, answers } = prepareExercise(puzzle);
      if (puzzle.goal.kind === "choice")
        expect(acceptedAnswer(puzzle, puzzle.goal.answer, null)).toBe(true);
      else expect(answers.length).toBeGreaterThan(0);
      expect(start.turn).toBe(puzzle.side);
      sides.add(puzzle.side);
    }
    expect(sides).toEqual(new Set(["orcas", "sharks"]));
  });

  it("archives dates in descending UTC order and rejects future dates", () => {
    expect(dailyPuzzleArchive(new Date("2026-11-25T00:00:00Z"), 3)).toEqual([
      "2026-11-25",
      "2026-11-24",
      "2026-11-23",
    ]);
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(() =>
      dailyPuzzleForDate(tomorrow.toISOString().slice(0, 10)),
    ).toThrow();
  });
});
