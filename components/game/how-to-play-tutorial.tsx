"use client";

import { useEffect, useState } from "react";
import { Board } from "@/components/board/board";
import { applyMove } from "@/lib/game/apply-move";
import {
  getLegalMoves,
  getLegalMovesFrom,
  isLegalMove,
} from "@/lib/game/legal-moves";
import type { Move, NodeId } from "@/lib/game/types";
import {
  tutorialMoveIsCorrect,
  tutorialSteps,
  type TutorialStep,
} from "@/lib/game/tutorial-scenarios";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { Rules } from "./rules";

function tutorialText(text: string, theme: BoardTheme) {
  if (theme !== "tigers-goats") return text;
  const { sides, hunter, defender } = themeLabels(theme);
  return text
    .replace(/\bAn Orca\b/g, `A ${hunter}`)
    .replace(/\ban Orca\b/g, `a ${hunter}`)
    .replace(/\bOrcas\b/g, sides.orcas)
    .replace(/\bSharks\b/g, sides.sharks)
    .replace(/\bOrca\b/g, hunter)
    .replace(/\bShark\b/g, defender);
}

function TutorialBoard({
  step,
  theme,
  motion,
  onSolved,
  onReset,
}: {
  step: TutorialStep;
  theme: BoardTheme;
  motion: boolean;
  onSolved: () => void;
  onReset: () => void;
}) {
  const [position, setPosition] = useState(step.start);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [lastMove, setLastMove] = useState<Move | undefined>();
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [practiceComplete, setPracticeComplete] = useState(false);
  const [feedback, setFeedback] = useState(
    "Watch the example, then try the highlighted idea.",
  );
  const labels = themeLabels(theme);
  const legalMoves =
    demoPlaying || practiceComplete
      ? []
      : selected
        ? getLegalMovesFrom(position, selected)
        : position.turn === "sharks" && position.phase === "shark-placement"
          ? getLegalMoves(position)
          : [];

  useEffect(() => {
    if (!demoPlaying) return;
    const reducedMotion =
      !motion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => {
        if (demoIndex < step.demoMoves.length) {
          setPosition(step.demoStates[demoIndex + 1]);
          setLastMove(step.demoMoves[demoIndex]);
          setDemoIndex(demoIndex + 1);
        } else {
          setPosition(step.start);
          setLastMove(undefined);
          setDemoIndex(0);
          setDemoPlaying(false);
          setFeedback("Your turn. Try the move on the board.");
        }
      },
      reducedMotion ? 0 : 680,
    );
    return () => window.clearTimeout(timer);
  }, [demoIndex, demoPlaying, motion, step]);

  function makeMove(move: Move) {
    if (!isLegalMove(position, move)) {
      setFeedback("That move is not legal here. Choose a marked destination.");
      return;
    }
    if (!tutorialMoveIsCorrect(step, move)) {
      setFeedback(step.retry);
      return;
    }
    setPosition(applyMove(position, move));
    setLastMove(move);
    setSelected(null);
    setPracticeComplete(true);
    setFeedback(step.success);
    onSolved();
  }

  function onNode(node: NodeId) {
    if (demoPlaying || practiceComplete) return;
    const piece = position.turn === "orcas" ? "orca" : "shark";
    const placing =
      position.turn === "sharks" && position.phase === "shark-placement";

    if (placing) {
      const move = legalMoves.find((candidate) => candidate.to === node);
      if (move) makeMove(move);
      else
        setFeedback(
          position.board[node]
            ? "That intersection is occupied. Choose an empty point."
            : "Choose one of the marked legal placements.",
        );
      return;
    }

    if (position.board[node] === piece) {
      setSelected(node);
      setFeedback("Choose a marked legal destination.");
      return;
    }
    if (!selected) {
      setFeedback(`Select one of the ${labels.sides[position.turn]} first.`);
      return;
    }
    const move = legalMoves.find((candidate) => candidate.to === node);
    if (move) makeMove(move);
    else setFeedback("That destination is not legal for the selected piece.");
  }

  function replay() {
    setPosition(step.start);
    setSelected(null);
    setLastMove(undefined);
    setDemoIndex(0);
    setDemoPlaying(true);
    setPracticeComplete(false);
    setFeedback("Watch the example, then try the highlighted idea.");
    onReset();
  }

  return (
    <section
      className="tutorial-board-panel turn-card"
      aria-label="Tutorial board"
    >
      <p className="tutorial-board-caption">
        {demoPlaying
          ? "Watch the example"
          : `${labels.sides[position.turn]} to play`}
      </p>
      <Board
        state={position}
        selected={selected}
        moves={legalMoves}
        lastMove={lastMove}
        flipped={false}
        theme={theme}
        motionEnabled={motion}
        onNode={onNode}
        focusNodes={step.focusNodes}
        guideMove={
          demoPlaying
            ? step.demoMoves[demoIndex]
            : practiceComplete
              ? lastMove
              : step.demoMoves[0]
        }
      />
      <div className="tutorial-board-status" role="status" aria-live="polite">
        <strong>{tutorialText(feedback, theme)}</strong>
      </div>
      <button
        className="tutorial-replay"
        disabled={demoPlaying}
        onClick={replay}
      >
        Replay Animation
      </button>
    </section>
  );
}

export function HowToPlayTutorial({
  theme,
  motion,
  online = false,
  computer = false,
  onStartPlaying,
  onOpenSetup,
}: {
  theme: BoardTheme;
  motion: boolean;
  online?: boolean;
  computer?: boolean;
  onStartPlaying: () => void;
  onOpenSetup: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [stepComplete, setStepComplete] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const step = tutorialSteps[stepIndex];
  const lastStep = stepIndex === tutorialSteps.length - 1;
  const finished = lastStep && stepComplete;

  function changeStep(index: number) {
    setStepIndex(index);
    setStepComplete(false);
    setSkipped(false);
  }

  return (
    <div className="how-to-play-tutorial">
      <div className="tutorial-layout">
        <TutorialBoard
          key={step.id}
          step={step}
          theme={theme}
          motion={motion}
          onSolved={() => setStepComplete(true)}
          onReset={() => {
            setStepComplete(false);
            setSkipped(false);
          }}
        />
        <aside className="tutorial-instructions">
          <label className="tutorial-progress">
            <span>
              Lesson {stepIndex + 1} of {tutorialSteps.length}
            </span>
            <progress
              aria-label="Tutorial progress"
              max={tutorialSteps.length}
              value={stepIndex + 1}
            />
          </label>
          <h3>{tutorialText(step.title, theme)}</h3>
          <p>{tutorialText(step.instruction, theme)}</p>
          <p className="tutorial-objective">
            {tutorialText(step.objective, theme)}
          </p>
          {stepComplete && (
            <p className="tutorial-complete">
              {lastStep
                ? "Tutorial complete. You are ready to play."
                : "Lesson complete. Continue when you’re ready."}
            </p>
          )}
          <div className="tutorial-navigation">
            <button
              disabled={stepIndex === 0}
              onClick={() => changeStep(stepIndex - 1)}
            >
              Previous
            </button>
            <button
              className={finished ? "primary-button" : undefined}
              disabled={lastStep && !finished}
              onClick={finished ? onOpenSetup : () => changeStep(stepIndex + 1)}
            >
              {finished ? "Let’s Play!" : "Next"}
            </button>
            <button onClick={() => setSkipped(true)}>Skip Tutorial</button>
          </div>
          {skipped && (
            <button
              className="primary-button tutorial-start"
              onClick={onStartPlaying}
            >
              Start Playing
            </button>
          )}
          <details className="tutorial-quick-rules">
            <summary>Quick Rules</summary>
            <Rules online={online} computer={computer} theme={theme} />
          </details>
        </aside>
      </div>
    </div>
  );
}
