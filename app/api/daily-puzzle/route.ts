import { z } from "zod";
import { read, transaction, type SqlClient } from "@/lib/database/connection";
import { acceptedAnswer } from "@/lib/learn/exercises";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { dailyPuzzleForDate, dailyPuzzleStreak } from "@/lib/daily/puzzles";
import {
  applyDailyAction,
  dailySolved,
  newDailyProgress,
  utcDateString,
  type DailyProgress,
  type DailyStatus,
} from "@/lib/daily/status";

export const runtime = "nodejs";

const inputSchema = z.strictObject({
  date: z.iso.date(),
  puzzleId: z.string().min(1).max(100),
  action: z.enum(["attempt", "hint", "stage", "reveal"]),
  answer: z.union([z.string().max(20), z.number().int()]).optional(),
  opening: z.string().max(20).nullable().optional(),
  hintsUsed: z.number().int().min(0).max(20),
  solutionRevealed: z.boolean().optional(),
  seconds: z.number().int().min(0).max(3600),
});

async function progressFor(
  db: SqlClient,
  player: string,
  date: string,
): Promise<DailyProgress> {
  const {
    rows: [row],
  } = await db.query<{
    status: DailyStatus | null;
    hints_used: number;
    attempts: number;
    solved: boolean;
  }>(
    `SELECT status, hints_used, attempts, completed_at IS NOT NULL AS solved
     FROM daily_puzzle_attempts WHERE player_id = $1 AND puzzle_date = $2::date`,
    [player, date],
  );
  if (!row) return newDailyProgress;
  return {
    status:
      row.status ??
      (row.solved
        ? row.hints_used > 0
          ? "hinted"
          : "solved"
        : row.attempts
          ? "attempted"
          : "new"),
    hintsUsed: row.hints_used,
  };
}

export async function POST(request: Request) {
  return respond(async () => {
    const player = await actorFor(request, "daily-puzzle", 90);
    const input = inputSchema.parse(await readJson(request));
    const puzzle = dailyPuzzleForDate(input.date);
    if (puzzle.id !== input.puzzleId) return { recorded: false, solved: false };

    const correct =
      input.action === "attempt" &&
      input.answer !== undefined &&
      acceptedAnswer(puzzle, input.answer, input.opening ?? null);
    const progress = await transaction(async (db) => {
      const previous = await progressFor(db, player, input.date);
      const before = input.solutionRevealed
        ? applyDailyAction(previous, { ...input, action: "reveal" }, false)
        : previous;
      const next = applyDailyAction(before, input, correct);
      await db.query(
        `INSERT INTO daily_puzzle_attempts
          (player_id, puzzle_date, puzzle_id, attempts, hints_used, time_spent, status, completed_at)
         VALUES ($1, $2::date, $3, $4, $5, $6, $7,
           CASE WHEN $8::boolean THEN EXTRACT(EPOCH FROM clock_timestamp()) ELSE NULL END)
         ON CONFLICT (player_id, puzzle_date) DO UPDATE SET
           attempts = daily_puzzle_attempts.attempts + EXCLUDED.attempts,
           hints_used = EXCLUDED.hints_used,
           time_spent = daily_puzzle_attempts.time_spent + EXCLUDED.time_spent,
           status = EXCLUDED.status,
           completed_at = COALESCE(daily_puzzle_attempts.completed_at, EXCLUDED.completed_at)`,
        [
          player,
          input.date,
          puzzle.id,
          input.action === "attempt" ? 1 : 0,
          next.hintsUsed,
          input.seconds,
          next.status,
          dailySolved(next.status) ? "true" : "false",
        ],
      );
      return next;
    });
    return {
      recorded: true,
      solved: correct && dailySolved(progress.status),
      progress,
    };
  });
}

export async function GET(request: Request) {
  return respond(async () => {
    const date = new URL(request.url).searchParams.get("status");
    if (date !== null) {
      const player = await actorFor(request, "daily-puzzle-status", 60);
      return read((db) => progressFor(db, player, z.iso.date().parse(date)));
    }
    const player = await actorFor(request, "daily-puzzle-stats", 30);
    const result = await read(async (db) => {
      const { rows } = await db.query<{
        puzzle_date: string;
        attempts: number;
        solved: boolean;
      }>(
        `SELECT puzzle_date::text AS puzzle_date, attempts, completed_at IS NOT NULL AS solved
         FROM daily_puzzle_attempts WHERE player_id = $1 ORDER BY puzzle_date DESC LIMIT 400`,
        [player],
      );
      return rows;
    });
    const solvedDates = result
      .filter((attempt) => attempt.solved)
      .map((attempt) => attempt.puzzle_date);
    return {
      attempted: result.filter(({ attempts }) => attempts > 0).length,
      solved: result.filter((attempt) => attempt.solved).length,
      attempts: result.reduce((sum, attempt) => sum + attempt.attempts, 0),
      streak: dailyPuzzleStreak(solvedDates, utcDateString()),
    };
  });
}
