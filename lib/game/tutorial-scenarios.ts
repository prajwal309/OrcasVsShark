import { applyMove } from "./apply-move";
import { getLegalMoves, isLegalMove } from "./legal-moves";
import type { GameState, Move, NodeId } from "./types";
import { puzzles } from "@/lib/learn/puzzle-data";
import { moveCode, prepareExercise, replay } from "@/lib/learn/exercises";

export type TutorialStep = {
  id: string;
  title: string;
  instruction: string;
  objective: string;
  success: string;
  retry: string;
  start: GameState;
  demoMoves: readonly Move[];
  demoStates: readonly GameState[];
  acceptedMoveCodes: readonly string[];
  focusNodes: readonly NodeId[];
};

function makeStep(
  step: Omit<TutorialStep, "demoStates" | "focusNodes">,
): TutorialStep {
  const demoStates = [step.start];
  let state = step.start;
  for (const move of step.demoMoves) {
    if (!isLegalMove(state, move))
      throw new Error(`Illegal tutorial move in ${step.id}.`);
    state = applyMove(state, move);
    demoStates.push(state);
  }
  if (
    !step.demoMoves.length ||
    !step.demoMoves.every((move) =>
      step.acceptedMoveCodes.includes(moveCode(move)),
    )
  )
    throw new Error(`Invalid tutorial solution in ${step.id}.`);
  const firstMove = step.demoMoves[0];
  return {
    ...step,
    demoStates,
    focusNodes:
      firstMove.kind === "place"
        ? [firstMove.to]
        : [firstMove.from, firstMove.to],
  };
}

function puzzleScenario(
  id: string,
  title: string,
  instruction: string,
  objective: string,
  success: string,
  retry: string,
): TutorialStep {
  const puzzle = puzzles.find((candidate) => candidate.id === id);
  if (!puzzle) throw new Error(`Unknown tutorial puzzle: ${id}.`);
  const { start, answers } = prepareExercise(puzzle);
  const solution = answers[0];
  if (!solution) throw new Error(`Missing tutorial solution: ${id}.`);
  return makeStep({
    id,
    title,
    instruction,
    objective,
    success,
    retry,
    start,
    demoMoves: [solution.move],
    acceptedMoveCodes: answers.map(({ move }) => moveCode(move)),
  });
}

function movementScenario(): TutorialStep {
  const start = replay("+c3");
  const moves = getLegalMoves(start).filter((move) => move.kind === "step");
  if (!moves.length)
    throw new Error("Missing legal Orca movement tutorial move.");
  return makeStep({
    id: "orca-movement",
    title: "Orcas move during placement",
    instruction:
      "Orcas can move after every Shark placement, even before all twenty are on the board.",
    objective: "Select an Orca, then move it one connected step.",
    success: "Legal move: Orcas can reposition while Sharks are still placing.",
    retry: "Choose an adjacent, connected empty point for an Orca.",
    start,
    demoMoves: [moves[0]],
    acceptedMoveCodes: moves.map(moveCode),
  });
}

const sharkMovement = puzzleScenario(
  "final-surround",
  "Move after all twenty",
  "Once all twenty Sharks have been introduced, they move one connected step to an adjacent empty point.",
  "Trap all four Orcas to win for the Sharks.",
  "All four Orcas are immobilized. The engine confirms a Sharks victory.",
  "Choose a legal Shark move that leaves the Orcas with no legal moves.",
);
if (
  sharkMovement.start.phase !== "shark-movement" ||
  sharkMovement.start.sharksPlaced !== 20
)
  throw new Error("Shark movement tutorial must start after all placements.");

const orcaVictory = puzzleScenario(
  "fifth-capture",
  "Win with five captures",
  "Orcas win by capturing five Sharks. The captured pieces leave the board.",
  "Find the winning fifth capture.",
  "That is the fifth capture. The engine confirms an Orcas victory.",
  "Choose a legal capture that reaches five captured Sharks.",
);
if (orcaVictory.start.sharksCaptured !== 4)
  throw new Error("Orca victory tutorial must start at four captures.");

export const tutorialSteps: readonly TutorialStep[] = [
  puzzleScenario(
    "quiet-opening",
    "Sharks place first",
    "Sharks begin by placing one piece on an empty intersection. Orcas reply after each placement.",
    "Place a Shark where it cannot be captured immediately.",
    "Good placement. Every highlighted answer is legal and safe.",
    "That placement is legal, but it leaves a Shark open to capture. Try another.",
  ),
  movementScenario(),
  puzzleScenario(
    "opening-jump",
    "Capture along a line",
    "An Orca may jump one adjacent Shark and land on the empty point immediately beyond it along a connected line.",
    "Make one capture. Captures are optional, but each turn allows only one jump.",
    "Capture confirmed. The Shark is removed, and the engine updates the count.",
    "Choose a legal capture that jumps one Shark along a connected line.",
  ),
  sharkMovement,
  orcaVictory,
  puzzleScenario(
    "last-gap",
    "Practice challenge",
    "Use the board, legal-move markers, and what you have learned to close the last route.",
    "Leave the Orcas with at most one legal move.",
    "Challenge complete. You used the actual move rules to secure the position.",
    "That move is legal, but it leaves too many Orca replies. Try another.",
  ),
];

export function tutorialMoveIsCorrect(step: TutorialStep, move: Move) {
  return step.acceptedMoveCodes.includes(moveCode(move));
}
