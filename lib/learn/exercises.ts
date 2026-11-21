import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { getLegalMoves } from "@/lib/game/legal-moves";
import type { GameState, Move, NodeId, Side } from "@/lib/game/types";

export const levels = ["Beginner", "Intermediate", "Advanced"] as const;
export type Level = (typeof levels)[number];

export type Goal =
  | { kind: "move"; moves: readonly string[] }
  | { kind: "capture" | "safe" | "win" | "win-in-two" }
  | { kind: "mobility"; maximum: number }
  | {
      kind: "choice";
      choices: readonly string[];
      answer: number;
      example?: { move: string; legal: boolean };
    };

export type Exercise = {
  id: string;
  title: string;
  level: Level;
  intro: string;
  objective: string;
  position: string;
  side: Side;
  goal: Goal;
  hints: readonly string[];
  explanation: string;
  focus?: readonly NodeId[];
};
export type Puzzle = Exercise & { category: string };

export function moveCode(move: Move) {
  return move.kind === "place"
    ? `+${move.to}`
    : `${move.from}${move.kind === "capture" ? "x" : "-"}${move.to}`;
}

export const replay = (line: string) =>
  line
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .reduce((state, code) => {
      const move = getLegalMoves(state).find(
        (candidate) => moveCode(candidate) === code,
      );
      if (!move)
        throw new Error(
          `Illegal authored move ${code} at ply ${state.ply + 1}.`,
        );
      return applyMove(state, move);
    }, createInitialState());

export type Reply = { move: Move; answers: Move[] };
export type Solution = { move: Move; replies: Reply[] };

function winMoves(state: GameState, side: Side) {
  return getLegalMoves(state).filter(
    (move) => applyMove(state, move).result?.winner === side,
  );
}

export function solutions(state: GameState, goal: Goal): Solution[] {
  if (goal.kind === "choice") return [];
  const side = state.turn;
  const accepted: Solution[] = [];
  for (const move of getLegalMoves(state)) {
    const next = applyMove(state, move);
    const replies = getLegalMoves(next);
    let correct = false;
    let responses: Reply[] = [];
    switch (goal.kind) {
      case "move":
        correct = goal.moves.includes(moveCode(move));
        break;
      case "capture":
        correct = move.kind === "capture";
        break;
      case "safe":
        correct =
          next.result?.winner === side ||
          (!next.result && replies.every((reply) => reply.kind !== "capture"));
        break;
      case "mobility":
        correct =
          (!next.result || next.result.winner === side) &&
          replies.length <= goal.maximum;
        break;
      case "win":
        correct = next.result?.winner === side;
        break;
      case "win-in-two":
        responses = replies
          .map((reply) => ({
            move: reply,
            answers: winMoves(applyMove(next, reply), side),
          }))
          .sort((a, b) => a.answers.length - b.answers.length);
        correct =
          responses.length > 0 &&
          responses.every(({ answers }) => answers.length > 0);
        break;
    }
    if (correct) accepted.push({ move, replies: responses });
  }
  return accepted;
}

const prepared = new WeakMap<
  Exercise,
  { start: GameState; answers: Solution[] }
>();

export function prepareExercise(exercise: Exercise) {
  const cached = prepared.get(exercise);
  if (cached) return cached;
  const start = replay(exercise.position);
  if (start.result || start.turn !== exercise.side)
    throw new Error(`Invalid starting turn for ${exercise.id}.`);
  const answers = solutions(start, exercise.goal);
  const goal = exercise.goal;
  if (goal.kind === "choice") {
    if (
      !goal.choices[goal.answer] ||
      new Set(goal.choices).size !== goal.choices.length
    )
      throw new Error(`Invalid choices for ${exercise.id}.`);
    if (
      goal.example &&
      getLegalMoves(start).some(
        (move) => moveCode(move) === goal.example?.move,
      ) !== goal.example.legal
    )
      throw new Error(`Incorrect legality example for ${exercise.id}.`);
  } else if (
    !answers.length ||
    (goal.kind === "move" && answers.length !== goal.moves.length)
  ) {
    throw new Error(`Invalid solution for ${exercise.id}.`);
  }
  const result = { start, answers };
  prepared.set(exercise, result);
  return result;
}

export function exerciseRound(
  exercise: Exercise,
  opening: string | null = null,
) {
  const { start, answers } = prepareExercise(exercise);
  const branch =
    opening && answers.find(({ move }) => moveCode(move) === opening);
  const reply = branch ? branch.replies[0] : null;
  if (branch && reply) {
    return {
      state: applyMove(applyMove(start, branch.move), reply.move),
      answers: reply.answers,
      reply: reply.move,
    };
  }
  return {
    state: start,
    answers: answers.map(({ move }) => move),
    reply: null,
  };
}

export function acceptedAnswer(
  exercise: Exercise,
  answer: number | string,
  opening: string | null,
) {
  if (exercise.goal.kind === "choice") return exercise.goal.answer === answer;
  if (exercise.goal.kind === "win-in-two" && !opening) return false;
  const round = exerciseRound(exercise, opening);
  return (
    (exercise.goal.kind !== "win-in-two" || round.reply !== null) &&
    round.answers.some((move) => moveCode(move) === answer)
  );
}

export function compareMoves(state: GameState) {
  return getLegalMoves(state).map((move) => {
    const next = applyMove(state, move);
    const replies = getLegalMoves(next);
    return {
      move,
      replies: replies.length,
      captures: replies.filter((reply) => reply.kind === "capture").length,
    };
  });
}
