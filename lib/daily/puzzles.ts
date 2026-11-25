import { utcDateString } from "./status";
import { puzzles } from "@/lib/learn/puzzle-data";
import { prepareExercise, type Puzzle } from "@/lib/learn/exercises";

const dailyPuzzleIds = [
  "opening-jump",
  "close-the-landing",
  "quiet-opening",
  "last-gap",
  "corner-squeeze",
  "edge-escape",
  "fifth-capture",
  "force-the-fifth",
  "defuse-the-win",
  "two-directions",
  "final-surround",
  "occupied-landing",
] as const;

const dailyPuzzles = dailyPuzzleIds.map((id) => {
  const puzzle = puzzles.find((candidate) => candidate.id === id);
  if (!puzzle) throw new Error(`Unknown daily puzzle: ${id}`);
  prepareExercise(puzzle);
  return puzzle;
});

export type DailyDifficulty = "Easy" | "Medium" | "Hard";

export function dailyPuzzleDifficulty(puzzle: Puzzle): DailyDifficulty {
  return puzzle.level === "Beginner"
    ? "Easy"
    : puzzle.level === "Intermediate"
      ? "Medium"
      : "Hard";
}

export { utcDateString } from "./status";

export function dailyPuzzleForDate(date: string): Puzzle {
  const timestamp = Date.parse(`${date}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== date ||
    date > utcDateString()
  )
    throw new Error("Choose a valid daily puzzle date.");

  const day = Math.floor(timestamp / 86_400_000);
  const index =
    ((day % dailyPuzzles.length) + dailyPuzzles.length) % dailyPuzzles.length;
  return {
    ...dailyPuzzles[index],
    id: `daily-${date}-${dailyPuzzles[index].id}`,
  };
}

export function dailyPuzzleArchive(today = new Date(), days = 30) {
  return Array.from({ length: days }, (_, offset) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - offset);
    return utcDateString(date);
  });
}

export function dailyPuzzleStreak(
  solvedDates: readonly string[],
  today = utcDateString(),
) {
  const dates = new Set(solvedDates);
  const cursor = new Date(`${today}T00:00:00.000Z`);
  if (!dates.has(cursor.toISOString().slice(0, 10)))
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (dates.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
