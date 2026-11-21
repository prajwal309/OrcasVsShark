// @vitest-environment node
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sqlClient } from "@/lib/database/connection";
import { openDatabase } from "@/lib/database/sqlite.mjs";
import {
  applyEvent,
  emptyProgress,
  summarize,
  type Activity,
  type EventDetails,
  type LearningEvent,
} from "@/lib/learn/progress";
import { loadProgress, saveLearningEvent } from "@/lib/learn/store";
import { curriculum } from "@/lib/learn/curriculum";
import {
  exerciseRound,
  moveCode,
  prepareExercise,
} from "@/lib/learn/exercises";

const lesson: Activity = { kind: "lesson", activityId: "meet-the-sides" };
const puzzle: Activity = { kind: "puzzle", activityId: "opening-jump" };
const event = (activity: Activity, details: EventDetails): LearningEvent => ({
  ...activity,
  ...details,
  id: randomUUID(),
});
const attempt = (
  activity: Activity,
  answer: string,
  opening: string | null = null,
) => event(activity, { action: "attempt", answer, seconds: 3, opening });

describe("Academy progress", () => {
  it("counts incorrect attempts, hints and retries without awarding completion", () => {
    let progress = applyEvent(emptyProgress, attempt(puzzle, "b2-b3"), 100);
    progress = applyEvent(progress, event(puzzle, { action: "hint" }), 102);
    expect(progress.puzzle[puzzle.activityId]).toMatchObject({
      attempts: 1,
      hints: 1,
      hintIndex: 1,
      completedAt: null,
    });
    progress = applyEvent(progress, event(puzzle, { action: "retry" }), 103);
    expect(progress.puzzle[puzzle.activityId]).toMatchObject({
      hints: 1,
      hintIndex: 0,
    });
    progress = applyEvent(progress, attempt(puzzle, "b2xd4"), 104);
    expect(summarize(progress)).toMatchObject({
      puzzles: 1,
      accuracy: 0.5,
      points: 10,
    });
    expect(progress.streak).toBe(1);
    progress = applyEvent(progress, attempt(puzzle, "b2xd4"), 105);
    expect(summarize(progress).points).toBe(10);
    expect(progress.puzzle[puzzle.activityId].completedAt).toBe(104);
  });

  it("restores a verified two-move checkpoint across snapshots and requires the finishing move", () => {
    const challenge = curriculum.puzzle.find(
      ({ id }) => id === "force-the-fifth",
    )!;
    const activity: Activity = { kind: "puzzle", activityId: challenge.id };
    const first = moveCode(prepareExercise(challenge).answers[0].move);
    const opened = applyEvent(
      emptyProgress,
      event(activity, { action: "stage", opening: first, seconds: 9 }),
      100,
    );
    expect(opened.puzzle[challenge.id].completedAt).toBeNull();
    const final = moveCode(
      exerciseRound(challenge, opened.puzzle[challenge.id].opening).answers[0],
    );
    const restored = applyEvent(opened, attempt(activity, final, first), 200);
    expect(restored.puzzle[challenge.id]).toMatchObject({
      opening: null,
      completedAt: 200,
      seconds: 12,
    });
  });

  it("awards First Capture for a successful capture in any qualifying activity", () => {
    const progress = applyEvent(
      emptyProgress,
      attempt({ kind: "puzzle", activityId: "two-directions" }, "b4xd4"),
      100,
    );
    expect(summarize(progress).achievements).toContainEqual({
      title: "First Capture",
      earned: true,
    });
  });

  it("persists validated progress in SQLite without double counting retried requests or mixing users", () => {
    const dir = mkdtempSync(join(tmpdir(), "orcas-academy-"));
    const filename = join(dir, "progress.db");
    const player = randomUUID();
    const another = randomUUID();
    try {
      const first = openDatabase(filename);
      try {
        const db = sqlClient(first);
        for (const [id, username] of [
          [player, "learner"],
          [another, "another"],
        ])
          db.query(
            "INSERT INTO accounts (id, username, password_hash) VALUES ($1, $2, 'fixture')",
            [id, username],
          );
        const save = (input: LearningEvent) =>
          first
            .transaction(() => saveLearningEvent(db, player, input, 100))
            .immediate();
        const finish = attempt(lesson, "+c3");
        save(finish);
        save(finish);
        save(attempt(puzzle, "b2-b3"));
        save(event(puzzle, { action: "hint" }));
        save(attempt(puzzle, "b2xd4"));
        expect(
          db.query(
            "SELECT lessons_completed, puzzles_solved, puzzle_accuracy FROM learning_stats WHERE player_id = $1",
            [player],
          ).rows[0],
        ).toEqual({
          lessons_completed: 1,
          puzzles_solved: 1,
          puzzle_accuracy: 0.5,
        });
      } finally {
        first.close();
      }
      const reopened = openDatabase(filename);
      try {
        const db = sqlClient(reopened);
        const saved = loadProgress(db, player);
        expect(saved.lesson[lesson.activityId]).toMatchObject({
          attempts: 1,
          completedAt: 100,
        });
        expect(saved.puzzle[puzzle.activityId]).toMatchObject({
          attempts: 2,
          successes: 1,
          hints: 1,
          seconds: 6,
          completedAt: 100,
        });
        expect(loadProgress(db, another)).toEqual(emptyProgress);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
