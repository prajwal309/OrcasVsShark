import { z } from "zod";
import {
  curriculum,
  getExercise,
  trackedPuzzles,
  type ActivityKind,
} from "./curriculum";
import { acceptedAnswer } from "./exercises";

const activity = z.object({
  kind: z.enum(["lesson", "puzzle", "quiz"]),
  activityId: z.string().max(64),
});
const base = activity.extend({ id: z.uuid() });
const seconds = z.number().int().min(0).max(3600);
export const eventSchema = z.discriminatedUnion("action", [
  base.extend({ action: z.literal("open") }).strict(),
  base.extend({ action: z.literal("hint") }).strict(),
  base.extend({ action: z.literal("retry") }).strict(),
  base
    .extend({ action: z.literal("stage"), opening: z.string().max(5), seconds })
    .strict(),
  base
    .extend({
      action: z.literal("attempt"),
      answer: z.union([z.string().max(5), z.number().int().min(0).max(10)]),
      opening: z.string().max(5).nullable(),
      seconds,
    })
    .strict(),
]);
export type LearningEvent = z.infer<typeof eventSchema>;
export type Activity = z.infer<typeof activity>;
export type EventDetails = LearningEvent extends infer Event
  ? Event extends LearningEvent
    ? Omit<Event, keyof Activity | "id">
    : never
  : never;

const itemSchema = z.object({
  attempts: z.number().int().min(0).max(2_147_483_647),
  successes: z.number().int().min(0).max(2_147_483_647),
  hints: z.number().int().min(0).max(2_147_483_647),
  seconds: z.number().int().min(0).max(2_147_483_647),
  completedAt: z.number().nullable(),
  opening: z.string().nullable(),
  hintIndex: z.number().int().min(0).max(2_147_483_647),
});
const cursorSchema = activity.extend({ at: z.number() });
export const progressSchema = z.object({
  lesson: z.record(z.string(), itemSchema),
  puzzle: z.record(z.string(), itemSchema),
  quiz: z.record(z.string(), itemSchema),
  streak: z.number().int().min(0).max(2_147_483_647),
  current: cursorSchema.nullable(),
});
export type Progress = z.infer<typeof progressSchema>;
export type ActivityProgress = z.infer<typeof itemSchema>;

export const emptyProgress: Progress = {
  lesson: {},
  puzzle: {},
  quiz: {},
  streak: 0,
  current: null,
};

export const emptyActivity: ActivityProgress = {
  attempts: 0,
  successes: 0,
  hints: 0,
  seconds: 0,
  completedAt: null,
  opening: null,
  hintIndex: 0,
};

export function applyEvent(
  progress: Progress,
  event: LearningEvent,
  at: number,
): Progress {
  const { kind, activityId } = event;
  const exercise = getExercise(kind, activityId);
  if (!exercise) return progress;
  const current = { kind, activityId, at };
  if (event.action === "open") return { ...progress, current };
  const item = { ...(progress[kind][activityId] ?? emptyActivity) };
  let streak = progress.streak;
  switch (event.action) {
    case "hint":
      if (item.hintIndex < exercise.hints.length) {
        item.hints++;
        item.hintIndex++;
      }
      break;
    case "retry":
      item.opening = null;
      item.hintIndex = 0;
      break;
    case "stage":
      item.opening = event.opening;
      item.seconds += event.seconds;
      break;
    case "attempt": {
      const success = acceptedAnswer(exercise, event.answer, event.opening);
      item.attempts++;
      item.seconds += event.seconds;
      if (success) {
        item.successes++;
        item.completedAt ??= at;
        item.opening = null;
        item.hintIndex = 0;
      }
      if (kind === "puzzle") streak = success ? streak + 1 : 0;
      break;
    }
  }
  return {
    ...progress,
    [kind]: { ...progress[kind], [activityId]: item },
    streak,
    current,
  };
}

export const puzzlePoints = { Beginner: 10, Intermediate: 20, Advanced: 30 };
export function summarize(progress: Progress) {
  const lessons = curriculum.lesson.filter(
    ({ id }) => progress.lesson[id]?.completedAt != null,
  );
  const puzzles = trackedPuzzles.filter(
    ({ id }) => progress.puzzle[id]?.completedAt != null,
  );
  const categories = new Map<
    string,
    { category: string; attempts: number; successes: number }
  >();
  let attempts = 0;
  let successes = 0;
  for (const puzzle of trackedPuzzles) {
    const item = progress.puzzle[puzzle.id];
    if (!item?.attempts) continue;
    const group = categories.get(puzzle.category) ?? {
      category: puzzle.category,
      attempts: 0,
      successes: 0,
    };
    group.attempts += item.attempts;
    group.successes += item.successes;
    attempts += item.attempts;
    successes += item.successes;
    categories.set(puzzle.category, group);
  }
  const ranking = [...categories.values()]
    .map((entry) => ({
      ...entry,
      accuracy: entry.successes / entry.attempts,
    }))
    .sort((a, b) => b.accuracy - a.accuracy || b.attempts - a.attempts);
  const completed = (kind: ActivityKind, id: string) =>
    progress[kind][id]?.completedAt != null;
  const achievements = [
    { title: "First Lesson", earned: lessons.length > 0 },
    {
      title: "First Capture",
      earned: [...lessons, ...puzzles].some(
        ({ goal, side }) =>
          goal.kind === "capture" ||
          (goal.kind === "move" &&
            goal.moves.every((move) => move.includes("x"))) ||
          (side === "orcas" &&
            (goal.kind === "win" || goal.kind === "win-in-two")),
      ),
    },
    { title: "Five Puzzles Solved", earned: puzzles.length >= 5 },
    {
      title: "Shark Defender",
      earned:
        completed("puzzle", "close-the-landing") ||
        completed("puzzle", "defuse-the-win"),
    },
    {
      title: "Orca Hunter",
      earned:
        completed("puzzle", "fifth-capture") ||
        completed("puzzle", "force-the-fifth"),
    },
    {
      title: "Beginner Course Completed",
      earned: curriculum.lesson
        .filter(({ level }) => level === "Beginner")
        .every(({ id }) => completed("lesson", id)),
    },
  ];
  const recent = (Object.keys(curriculum) as ActivityKind[])
    .flatMap((kind) =>
      (kind === "puzzle" ? trackedPuzzles : curriculum[kind]).flatMap(
        (exercise) => {
          const at = progress[kind][exercise.id]?.completedAt;
          return at != null ? [{ kind, exercise, at }] : [];
        },
      ),
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, 5);
  return {
    lessons: lessons.length,
    puzzles: puzzles.length,
    accuracy: attempts ? successes / attempts : null,
    ranking,
    points: puzzles.reduce(
      (total, puzzle) => total + puzzlePoints[puzzle.level],
      0,
    ),
    nextLesson: curriculum.lesson.find(({ id }) => !completed("lesson", id)),
    nextPuzzle:
      curriculum.puzzle.find(
        ({ id, category }) =>
          !completed("puzzle", id) && category === ranking.at(-1)?.category,
      ) ?? curriculum.puzzle.find(({ id }) => !completed("puzzle", id)),
    recent,
    achievements,
  };
}
