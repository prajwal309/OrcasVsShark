import { lessons } from "./lesson-data";
import { puzzles } from "./puzzle-data";
import type { Exercise } from "./exercises";
import { dailyPuzzles } from "@/lib/daily/puzzle-data";

type Question = readonly [
  id: string,
  prompt: string,
  choices: readonly string[],
  answer: number,
  explanation: string,
];

const questions: readonly Question[] = [
  [
    "first-turn",
    "Which side moves first?",
    ["{orcas}", "{sharks}"],
    1,
    "{sharks} make the opening placement.",
  ],
  [
    "piece-count",
    "How many {sharks} are introduced?",
    ["Ten", "Sixteen", "Twenty"],
    2,
    "All twenty pieces are introduced one per placement turn.",
  ],
  [
    "movement-phase",
    "When do {sharks} start stepping?",
    [
      "After five placements",
      "After twenty placements",
      "After the first capture",
    ],
    1,
    "The twentieth placement changes the phase, even when pieces have been captured.",
  ],
  [
    "winning-count",
    "How many captures win for {orcas}?",
    ["Four", "Five", "Six"],
    1,
    "The fifth capture ends the game immediately.",
  ],
  [
    "single-jump",
    "Can {orcas} chain two jumps in one turn?",
    ["Yes", "No"],
    1,
    "A single jump ends the turn. {orcas} can also choose an ordinary step when a capture is available.",
  ],
  [
    "legal-step",
    "Which step follows a marked line from a1 in this position?",
    ["a1 to b2", "a1 to c2", "a1 to a3"],
    0,
    "a1 and b2 are adjacent on a drawn diagonal.",
  ],
];

export const quizzes: readonly Exercise[] = questions.map(
  ([id, objective, choices, answer, explanation]) => ({
    id,
    title: objective,
    objective,
    level: "Beginner",
    intro: "Check what you remember about the rules.",
    position: id === "legal-step" ? "+c3" : "",
    side: id === "legal-step" ? "orcas" : "sharks",
    focus: id === "legal-step" ? ["a1", "b2", "c2", "a3"] : undefined,
    goal: { kind: "choice", choices, answer },
    hints: [],
    explanation,
  }),
);

export const curriculum = {
  lesson: lessons,
  puzzle: puzzles,
  quiz: quizzes,
} as const;
export type ActivityKind = keyof typeof curriculum;
export const trackedPuzzles = [...puzzles, ...dailyPuzzles];

export function getExercise(
  kind: ActivityKind,
  id: string,
): Exercise | undefined {
  const exercises = kind === "puzzle" ? trackedPuzzles : curriculum[kind];
  return exercises.find((exercise) => exercise.id === id);
}
