import { describe, expect, it, vi } from "vitest";
import { applyDailyAction, newDailyProgress } from "@/lib/daily/status";
import {
  dailyPuzzleArchive,
  dailyPuzzleDifficulty,
  dailyPuzzleForDate,
  dailyPuzzleStreak,
} from "@/lib/daily/puzzles";
import { getLegalMoves } from "@/lib/game/legal-moves";
import { createPositionKey } from "@/lib/game/position-key";
import { moveCode, prepareExercise } from "@/lib/learn/exercises";
import { applyEvent, emptyProgress, summarize } from "@/lib/learn/progress";

describe("daily puzzles", () => {
  it("rotates 20 different reachable board puzzles every 20 UTC days", () => {
    vi.setSystemTime(new Date("2027-01-05T00:00:00Z"));
    try {
      const puzzles = Array.from({ length: 40 }, (_, day) =>
        dailyPuzzleForDate(
          new Date(Date.UTC(2026, 10, 26 + day)).toISOString().slice(0, 10),
        ),
      );
      const ids = puzzles.map(({ id }) => id.slice("daily-2026-11-26-".length));
      expect(new Set(ids.slice(0, 20)).size).toBe(20);
      expect(ids.slice(20)).toEqual(ids.slice(0, 20));

      const positions = new Set<string>();
      const sides = new Set<string>();
      const phases = new Set<string>();
      const difficulties = new Set<string>();
      for (const puzzle of puzzles.slice(0, 20)) {
        const { start, answers } = prepareExercise(puzzle);
        expect(start.ply).toBeGreaterThan(0);
        expect(start.result).toBeNull();
        expect(start.turn).toBe(puzzle.side);
        expect(answers.length).toBeGreaterThan(0);
        expect(answers.length).toBeLessThan(getLegalMoves(start).length);
        positions.add(createPositionKey(start));
        sides.add(puzzle.side);
        phases.add(start.phase);
        difficulties.add(dailyPuzzleDifficulty(puzzle));
      }
      expect(positions.size).toBe(20);
      expect(sides).toEqual(new Set(["orcas", "sharks"]));
      expect(phases).toEqual(new Set(["shark-placement", "shark-movement"]));
      expect(difficulties).toEqual(new Set(["Easy", "Medium", "Hard"]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the puzzle IDs and rules for earlier dates", () => {
    expect(dailyPuzzleForDate("2026-11-14")).toMatchObject({
      id: "daily-2026-11-14-occupied-landing",
      goal: { kind: "choice", answer: 1 },
    });
  });

  it("tracks a new daily puzzle through a hint and both moves of its solution", () => {
    vi.setSystemTime(new Date("2026-11-29T00:00:00Z"));
    try {
      const puzzle = dailyPuzzleForDate("2026-11-29");
      const activity = {
        kind: "puzzle",
        activityId: puzzle.id.slice("daily-2026-11-29-".length),
        id: "6ee0de4c-eed7-431d-8938-8179aa8d8b54",
      } as const;
      const { move, replies } = prepareExercise(puzzle).answers[0];
      const opening = moveCode(move);
      const at = Date.now();
      const hinted = applyEvent(
        emptyProgress,
        { ...activity, action: "hint" },
        at,
      );
      expect(hinted.puzzle[activity.activityId]?.hintIndex).toBe(1);
      const staged = applyEvent(
        hinted,
        { ...activity, action: "stage", opening, seconds: 1 },
        at,
      );
      expect(staged.puzzle[activity.activityId]?.opening).toBe(opening);
      const solved = applyEvent(
        staged,
        {
          ...activity,
          action: "attempt",
          opening,
          answer: moveCode(replies[0].answers[0]),
          seconds: 1,
        },
        at,
      );
      expect(summarize(solved)).toMatchObject({ puzzles: 1, points: 30 });
    } finally {
      vi.useRealTimers();
    }
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

  it("counts a consecutive solved-day streak, allowing today to be unsolved", () => {
    expect(
      dailyPuzzleStreak(
        ["2026-11-24", "2026-11-23", "2026-11-21"],
        "2026-11-25",
      ),
    ).toBe(2);
    expect(dailyPuzzleStreak(["2026-11-25", "2026-11-24"], "2026-11-25")).toBe(
      2,
    );
  });
});

describe("daily navigation status", () => {
  it("tracks attempts and first solve quality without treating reveals as solves", () => {
    const attempt = { action: "attempt", seconds: 1, hintsUsed: 0 } as const;
    const hint = { ...attempt, action: "hint", hintsUsed: 1 } as const;
    const reveal = { ...attempt, action: "reveal" } as const;
    const readHint = applyDailyAction(newDailyProgress, hint, false);
    expect(readHint.status).toBe("new");
    expect(applyDailyAction(readHint, attempt, false).status).toBe("attempted");
    expect(applyDailyAction(readHint, attempt, true).status).toBe("hinted");
    expect(applyDailyAction(newDailyProgress, attempt, true).status).toBe(
      "solved",
    );

    const revealed = applyDailyAction(newDailyProgress, reveal, false);
    expect(applyDailyAction(revealed, attempt, true).status).toBe("revealed");
    const solved = applyDailyAction(newDailyProgress, attempt, true);
    expect(applyDailyAction(solved, hint, false).status).toBe("solved");
  });
});
