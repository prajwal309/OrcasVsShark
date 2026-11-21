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

const projection = `attempts, successes, hints_used AS hints, time_spent AS seconds,
  completed_at AS completedAt, opening, hint_index AS hintIndex`;

export function loadProgress(db: SqlClient, player: string): Progress {
  const progress: Progress = {
    ...emptyProgress,
    lesson: {},
    puzzle: {},
    quiz: {},
  };
  const lessons = db.query<
    ActivityProgress & { id: string; kind: "lesson" | "quiz" }
  >(
    `SELECT lesson_id AS id, kind, ${projection} FROM lesson_progress WHERE player_id = $1`,
    [player],
  ).rows;
  for (const { id, kind, ...item } of lessons) progress[kind][id] = item;
  const puzzles = db.query<ActivityProgress & { id: string }>(
    `SELECT puzzle_id AS id, ${projection} FROM puzzle_attempts WHERE player_id = $1`,
    [player],
  ).rows;
  for (const { id, ...item } of puzzles) progress.puzzle[id] = item;
  const stats = db.query<Activity & { streak: number; at: number }>(
    `SELECT current_streak AS streak, current_kind AS kind, current_activity_id AS activityId,
     last_activity AS at FROM learning_stats WHERE player_id = $1`,
    [player],
  ).rows[0];
  if (stats) {
    const { streak, ...current } = stats;
    progress.streak = streak;
    progress.current = current;
  }
  return progress;
}

export function saveLearningEvent(
  db: SqlClient,
  player: string,
  event: LearningEvent,
  at = Date.now(),
) {
  const before = loadProgress(db, player);
  const receipt = db.query(
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
    db.query(
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
  db.query(
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
