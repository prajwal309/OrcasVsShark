import type { SqlClient } from "@/lib/database/connection";
import {
  applyEvent,
  emptyProgress,
  summarize,
  type Activity,
  type ActivityProgress,
  type LearningEvent,
  type Progress,
} from "./progress";
import { getExercise, type ActivityKind } from "./curriculum";

const projection = `attempts, successes, hints_used AS hints, time_spent AS seconds,
  completed_at AS "completedAt", opening, hint_index AS "hintIndex"`;

export async function loadProgress(
  db: SqlClient,
  player: string,
): Promise<Progress> {
  const progress: Progress = {
    ...emptyProgress,
    lesson: {},
    puzzle: {},
    quiz: {},
  };
  const lessons = (
    await db.query<ActivityProgress & { id: string; kind: "lesson" | "quiz" }>(
      `SELECT lesson_id AS id, kind, ${projection} FROM lesson_progress WHERE player_id = $1`,
      [player],
    )
  ).rows;
  for (const { id, kind, ...item } of lessons) progress[kind][id] = item;
  const puzzles = (
    await db.query<ActivityProgress & { id: string }>(
      `SELECT puzzle_id AS id, ${projection} FROM puzzle_attempts WHERE player_id = $1`,
      [player],
    )
  ).rows;
  for (const { id, ...item } of puzzles) progress.puzzle[id] = item;
  const stats = (
    await db.query<Activity & { streak: number; at: number }>(
      `SELECT current_streak AS streak, current_kind AS kind, current_activity_id AS "activityId",
     last_activity AS at FROM learning_stats WHERE player_id = $1`,
      [player],
    )
  ).rows[0];
  if (stats) {
    const { streak, ...current } = stats;
    progress.streak = streak;
    progress.current = current;
  }
  return progress;
}

export async function saveLearningEvent(
  db: SqlClient,
  player: string,
  event: LearningEvent,
  at = Date.now(),
) {
  const before = await loadProgress(db, player);
  const receipt = await db.query(
    "INSERT INTO learning_events (player_id, event_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [player, event.id],
  );
  if (!receipt.rowCount) return before;
  const progress = applyEvent(before, event, at);
  const item = progress[event.kind][event.activityId];
  if (event.action !== "open" && item) {
    const puzzle = event.kind === "puzzle";
    const table = puzzle ? "puzzle_attempts" : "lesson_progress";
    const key = puzzle ? "puzzle_id" : "kind, lesson_id";
    await db.query(
      `INSERT INTO ${table} (player_id, ${key}, attempts, successes, hints_used, time_spent,
        completed_at, opening, hint_index)
       VALUES ($1, ${puzzle ? "$2" : "$10, $2"}, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (player_id, ${key}) DO UPDATE SET attempts = excluded.attempts,
         successes = excluded.successes, hints_used = excluded.hints_used, time_spent = excluded.time_spent,
         completed_at = excluded.completed_at, opening = excluded.opening, hint_index = excluded.hint_index`,
      [
        player,
        event.activityId,
        item.attempts,
        item.successes,
        item.hints,
        item.seconds,
        item.completedAt,
        item.opening,
        item.hintIndex,
        ...(puzzle ? [] : [event.kind]),
      ],
    );
  }
  const stats = summarize(progress);
  await db.query(
    `INSERT INTO learning_stats VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (player_id) DO UPDATE SET lessons_completed = excluded.lessons_completed,
       puzzles_solved = excluded.puzzles_solved, puzzle_accuracy = excluded.puzzle_accuracy,
       current_streak = excluded.current_streak, current_kind = excluded.current_kind,
       current_activity_id = excluded.current_activity_id, last_activity = excluded.last_activity`,
    [
      player,
      stats.lessons,
      stats.puzzles,
      stats.accuracy,
      progress.streak,
      event.kind,
      event.activityId,
      at,
    ],
  );
  return progress;
}

export async function mergeProgressSnapshot(
  db: SqlClient,
  player: string,
  snapshot: Progress,
) {
  const kinds: ActivityKind[] = ["lesson", "puzzle", "quiz"];
  for (const kind of kinds) {
    for (const [id, item] of Object.entries(snapshot[kind])) {
      if (!getExercise(kind, id)) continue;
      if (kind === "puzzle") {
        await db.query(
          `INSERT INTO puzzle_attempts
            (player_id, puzzle_id, attempts, successes, hints_used, time_spent, completed_at, opening, hint_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (player_id, puzzle_id) DO UPDATE SET
             attempts = GREATEST(puzzle_attempts.attempts, EXCLUDED.attempts),
             successes = GREATEST(puzzle_attempts.successes, EXCLUDED.successes),
             hints_used = GREATEST(puzzle_attempts.hints_used, EXCLUDED.hints_used),
             time_spent = GREATEST(puzzle_attempts.time_spent, EXCLUDED.time_spent),
             completed_at = COALESCE(puzzle_attempts.completed_at, EXCLUDED.completed_at),
             opening = COALESCE(puzzle_attempts.opening, EXCLUDED.opening),
             hint_index = GREATEST(puzzle_attempts.hint_index, EXCLUDED.hint_index)`,
          [
            player,
            id,
            item.attempts,
            item.successes,
            item.hints,
            item.seconds,
            item.completedAt,
            item.opening,
            item.hintIndex,
          ],
        );
      } else {
        await db.query(
          `INSERT INTO lesson_progress
            (player_id, lesson_id, kind, attempts, successes, hints_used, time_spent, completed_at, opening, hint_index)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (player_id, kind, lesson_id) DO UPDATE SET
             attempts = GREATEST(lesson_progress.attempts, EXCLUDED.attempts),
             successes = GREATEST(lesson_progress.successes, EXCLUDED.successes),
             hints_used = GREATEST(lesson_progress.hints_used, EXCLUDED.hints_used),
             time_spent = GREATEST(lesson_progress.time_spent, EXCLUDED.time_spent),
             completed_at = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
             opening = COALESCE(lesson_progress.opening, EXCLUDED.opening),
             hint_index = GREATEST(lesson_progress.hint_index, EXCLUDED.hint_index)`,
          [
            player,
            id,
            kind,
            item.attempts,
            item.successes,
            item.hints,
            item.seconds,
            item.completedAt,
            item.opening,
            item.hintIndex,
          ],
        );
      }
    }
  }

  const progress = await loadProgress(db, player);
  const summary = summarize(progress);
  const current =
    progress.current ??
    ({
      kind: "puzzle",
      activityId: Object.keys(progress.puzzle)[0] ?? "daily-import",
      at: Date.now(),
    } satisfies NonNullable<Progress["current"]>);
  await db.query(
    `INSERT INTO learning_stats
       (player_id, lessons_completed, puzzles_solved, puzzle_accuracy, current_streak,
        current_kind, current_activity_id, last_activity)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (player_id) DO UPDATE SET
       lessons_completed = GREATEST(learning_stats.lessons_completed, EXCLUDED.lessons_completed),
       puzzles_solved = GREATEST(learning_stats.puzzles_solved, EXCLUDED.puzzles_solved),
       puzzle_accuracy = EXCLUDED.puzzle_accuracy,
       current_streak = GREATEST(learning_stats.current_streak, EXCLUDED.current_streak),
       current_kind = CASE WHEN EXCLUDED.last_activity > learning_stats.last_activity
         THEN EXCLUDED.current_kind ELSE learning_stats.current_kind END,
       current_activity_id = CASE WHEN EXCLUDED.last_activity > learning_stats.last_activity
         THEN EXCLUDED.current_activity_id ELSE learning_stats.current_activity_id END,
       last_activity = GREATEST(learning_stats.last_activity, EXCLUDED.last_activity)`,
    [
      player,
      summary.lessons,
      summary.puzzles,
      summary.accuracy,
      progress.streak,
      current.kind,
      current.activityId,
      current.at,
    ],
  );
  return progress;
}
