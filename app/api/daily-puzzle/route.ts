import { z } from "zod";
import { transaction } from "@/lib/database/connection";
import { acceptedAnswer } from "@/lib/learn/exercises";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { dailyPuzzleForDate } from "@/lib/daily/puzzles";

export const runtime = "nodejs";

const inputSchema = z
  .strictObject({
    date: z.iso.date(),
    puzzleId: z.string().min(1).max(100),
    action: z.enum(["attempt", "hint"]),
    answer: z.union([z.string().max(20), z.number().int()]).optional(),
    opening: z.string().max(20).nullable().optional(),
    hintsUsed: z.number().int().min(0).max(20),
    seconds: z.number().int().min(0).max(3600),
  });

export async function POST(request: Request) {
  return respond(async () => {
    const player = await actorFor(request, "daily-puzzle", 90);
    const input = inputSchema.parse(await readJson(request));
    const puzzle = dailyPuzzleForDate(input.date);
    if (puzzle.id !== input.puzzleId)
      return { recorded: false, solved: false };

    const solved =
      input.action === "attempt" &&
      input.answer !== undefined &&
      acceptedAnswer(puzzle, input.answer, input.opening ?? null);
    await transaction((db) =>
      db.query(
        `INSERT INTO daily_puzzle_attempts
          (player_id, puzzle_date, puzzle_id, attempts, hints_used, time_spent, completed_at)
         VALUES ($1, $2::date, $3, CASE WHEN $6 = 'attempt' THEN 1 ELSE 0 END, $4, $5,
           CASE WHEN $7::boolean THEN EXTRACT(EPOCH FROM clock_timestamp()) ELSE NULL END)
         ON CONFLICT (player_id, puzzle_date) DO UPDATE SET
           attempts = daily_puzzle_attempts.attempts +
             CASE WHEN $6 = 'attempt' THEN 1 ELSE 0 END,
           hints_used = GREATEST(daily_puzzle_attempts.hints_used, EXCLUDED.hints_used),
           time_spent = daily_puzzle_attempts.time_spent + EXCLUDED.time_spent,
           completed_at = COALESCE(daily_puzzle_attempts.completed_at, EXCLUDED.completed_at)`,
        [
          player,
          input.date,
          puzzle.id,
          input.hintsUsed,
          input.seconds,
          input.action,
          solved ? "true" : "false",
        ],
      ),
    );
    return { recorded: true, solved };
  });
}

export async function GET(request: Request) {
  return respond(async () => {
    const player = await actorFor(request, "daily-puzzle-stats", 30);
    const result = await transaction(async (db) => {
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
    const dates = new Set(
      result.filter((attempt) => attempt.solved).map((attempt) => attempt.puzzle_date),
    );
    let streak = 0;
    const cursor = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    if (!dates.has(cursor.toISOString().slice(0, 10)))
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return {
      attempted: result.length,
      solved: result.filter((attempt) => attempt.solved).length,
      attempts: result.reduce((sum, attempt) => sum + attempt.attempts, 0),
      streak,
    };
  });
}
