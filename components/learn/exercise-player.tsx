"use client";

import type { DailyAction } from "@/lib/daily/status";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/board";
import { useComputer } from "@/components/game/use-computer";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves, getLegalMovesFrom } from "@/lib/game/legal-moves";
import { formatMove } from "@/lib/game/notation";
import type { GameState, Move, NodeId } from "@/lib/game/types";
import type { ActivityKind } from "@/lib/learn/curriculum";
import {
  acceptedAnswer,
  compareMoves,
  exerciseRound,
  moveCode,
  prepareExercise,
  type Exercise,
} from "@/lib/learn/exercises";
import { emptyActivity, puzzlePoints } from "@/lib/learn/progress";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { activityHref, learningText } from "./presentation";
import { useProgress } from "./progress-provider";

function elapsedSeconds(timer: { current: number }) {
  const now = performance.now();
  const elapsed = Math.min(
    3600,
    Math.max(0, Math.round((now - timer.current) / 1000)),
  );
  timer.current = now;
  return elapsed;
}

export function ExercisePlayer({
  exercise,
  kind,
  next,
  theme,
  dailyPuzzleMode = false,
  dailyPractice = false,
  onPuzzleAttempt,
}: {
  exercise: Exercise;
  kind: ActivityKind;
  next?: Exercise;
  theme: BoardTheme;
  dailyPuzzleMode?: boolean;
  dailyPractice?: boolean;
  onPuzzleAttempt?: (event: DailyAction, correct?: boolean) => void;
}) {
  const { progress, ready, record } = useProgress();
  const { id, goal } = exercise;
  const item = progress[kind][id] ?? emptyActivity;
  const { state, answers, reply } = useMemo(
    () => exerciseRound(exercise, item.opening),
    [exercise, item.opening],
  );
  const [selected, setSelected] = useState<NodeId | null>(() =>
    kind === "lesson" && goal.kind !== "choice" && !reply
      ? (exercise.focus?.find(
          (node) => getLegalMovesFrom(state, node).length > 0,
        ) ?? null)
      : null,
  );
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  const [comparison, setComparison] = useState(false);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [suggestion, setSuggestion] = useState<Move | null>(null);
  const [completion, setCompletion] = useState<{
    state: GameState;
    move?: Move;
    points: number;
    practice: boolean;
  } | null>(null);
  const [solutionShown, setSolutionShown] = useState(false);
  const [solutionStep, setSolutionStep] = useState(0);
  const [solutionPlaying, setSolutionPlaying] = useState(false);
  const solutionLine = useMemo(() => {
    if (!dailyPuzzleMode) return null;
    const { start, answers: solutions } = prepareExercise(exercise);
    const states = [start];
    const moves: Move[] = [];
    const first = solutions[0];
    if (!first) return { states, moves };

    let current = applyMove(start, first.move);
    states.push(current);
    moves.push(first.move);
    if (goal.kind === "win-in-two") {
      const response = first.replies[0];
      if (response) {
        current = applyMove(current, response.move);
        states.push(current);
        moves.push(response.move);
        const finish = response.answers[0];
        if (finish) {
          current = applyMove(current, finish);
          states.push(current);
          moves.push(finish);
        }
      }
    }
    return { states, moves };
  }, [dailyPuzzleMode, exercise, goal.kind]);
  const analysis = useComputer(
    state,
    analysisRequested && !completion,
    "medium",
    (move) => {
      setSuggestion(move);
      setAnalysisRequested(false);
    },
  );
  const started = useRef(0);
  const opened = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const text = (value: string) => learningText(value, theme);
  const side = themeLabels(theme).sides[state.turn];
  const visibleMoves =
    completion || solutionShown || goal.kind === "choice"
      ? []
      : selected
        ? getLegalMovesFrom(state, selected)
        : state.turn === "sharks" && state.phase === "shark-placement"
          ? getLegalMoves(state)
          : [];

  useEffect(() => {
    if (!ready || opened.current) return;
    opened.current = true;
    elapsedSeconds(started);
    record({ kind, activityId: id }, { action: "open" });
    heading.current?.focus({ preventScroll: true });
  }, [ready, record, kind, id]);

  useEffect(() => {
    if (!solutionPlaying || !solutionLine) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const nextStep = solutionStep + 1;
    const timer = window.setTimeout(
      () => {
        setSolutionStep(nextStep);
        if (nextStep >= solutionLine.states.length - 1)
          setSolutionPlaying(false);
      },
      reducedMotion ? 0 : 650,
    );
    return () => window.clearTimeout(timer);
  }, [solutionLine, solutionPlaying, solutionStep]);

  function attempt(answer: string | number, move?: Move) {
    const success = acceptedAnswer(exercise, answer, item.opening);
    const seconds = elapsedSeconds(started);
    record(
      { kind, activityId: id },
      { action: "attempt", answer, opening: item.opening, seconds },
    );
    if (kind === "puzzle")
      onPuzzleAttempt?.(
        {
          action: "attempt",
          answer: success ? answer : undefined,
          hintsUsed: item.hintIndex,
          seconds,
          opening: item.opening,
        },
        success,
      );
    if (success) {
      setCompletion({
        state: move ? applyMove(state, move) : state,
        move,
        points:
          kind === "puzzle" && !dailyPractice && item.completedAt === null
            ? puzzlePoints[exercise.level]
            : 0,
        practice: dailyPractice,
      });
      setSelected(null);
      setMessage("");
    } else {
      setMessage(
        goal.kind === "choice"
          ? "Try again and check the rule shown above."
          : move
            ? "That move is legal, but it doesn’t meet the objective. Try another."
            : "That move is illegal in this position. Choose a marked legal destination.",
      );
    }
  }

  function playNode(node: NodeId) {
    if (!ready || completion || solutionShown) return;
    if (goal.kind === "choice") {
      if (!goal.example) return;
      const [from, to] = goal.example.move.split(/[x-]/);
      if (node === from) {
        setSelected(node);
        setMessage("Now select the marked landing point.");
      } else if (selected === from && node === to) {
        const legal = getLegalMoves(state).some(
          (move) => moveCode(move) === goal.example?.move,
        );
        setMessage(
          legal
            ? "The engine accepts that move. Choose the matching answer."
            : "The engine rejects that move. Choose the matching answer.",
        );
      } else {
        setMessage("Select the marked starting point first.");
      }
      return;
    }

    const ownPiece = state.turn === "orcas" ? "orca" : "shark";
    const placement =
      state.turn === "sharks" && state.phase === "shark-placement";
    if (!placement && state.board[node] === ownPiece) {
      setSelected(node);
      setMessage(
        getLegalMovesFrom(state, node).length
          ? "Choose a destination."
          : "This piece has no legal moves. Select another piece.",
      );
      return;
    }
    if (!placement && !selected) {
      setMessage(`Select one of the ${side} to see its legal moves.`);
      return;
    }
    const move = visibleMoves.find(({ to }) => to === node);
    if (
      move &&
      goal.kind === "win-in-two" &&
      !reply &&
      answers.some((answer) => moveCode(answer) === moveCode(move))
    ) {
      record(
        { kind, activityId: id },
        {
          action: "stage",
          opening: moveCode(move),
          seconds: elapsedSeconds(started),
        },
      );
      onPuzzleAttempt?.({
        action: "stage",
        hintsUsed: item.hintIndex,
        seconds: 0,
      });
      setSelected(null);
      setMessage("Good opening. The defender replied. Find the winning move.");
      setReview(false);
      return;
    }
    attempt(
      move ? moveCode(move) : placement ? `+${node}` : `${selected}-${node}`,
      move,
    );
  }

  function retry() {
    record({ kind, activityId: id }, { action: "retry" });
    setCompletion(null);
    setReview(false);
    setSelected(null);
    setSuggestion(null);
    setAnalysisRequested(false);
    setSolutionShown(false);
    setSolutionStep(0);
    setSolutionPlaying(false);
    setMessage("The starting position is ready.");
    elapsedSeconds(started);
  }

  function showSolution() {
    if (!solutionLine) return;
    onPuzzleAttempt?.({
      action: "reveal",
      hintsUsed: item.hintIndex,
      seconds: 0,
    });
    setSolutionShown(true);
    setSolutionStep(0);
    setSolutionPlaying(solutionLine.states.length > 1);
  }

  function replaySolution() {
    if (!solutionLine) return;
    setSolutionStep(0);
    setSolutionPlaying(solutionLine.states.length > 1);
  }

  const comparisonRows = useMemo(
    () =>
      comparison
        ? compareMoves(state).sort((a, b) => a.replies - b.replies)
        : [],
    [state, comparison],
  );

  const sample =
    review && goal.kind === "win-in-two" && !reply
      ? prepareExercise(exercise).answers[0]
      : undefined;
  const sampleReply = sample?.replies[0];
  const displayed =
    solutionShown && solutionLine
      ? solutionLine.states[solutionStep]
      : (completion?.state ?? state);
  const solutionMove =
    solutionShown && solutionStep > 0
      ? solutionLine?.moves[solutionStep - 1]
      : undefined;
  const displayedSide = themeLabels(theme).sides[displayed.turn];
  return (
    <article
      className={`academy-exercise${dailyPuzzleMode ? " daily-puzzle-exercise" : ""}`}
      id="academy-activity"
      aria-labelledby="exercise-heading"
    >
      <div
        className={
          dailyPuzzleMode ? "daily-puzzle-sidebar" : "academy-exercise-sidebar"
        }
      >
        <div className="academy-instructions turn-card">
          <p className="academy-meta">
            {kind === "quiz" ? "Knowledge check" : `${exercise.level} ${kind}`}
          </p>
          <h2 id="exercise-heading" ref={heading} tabIndex={-1}>
            {text(exercise.title)}
          </h2>
          <p>{text(exercise.intro)}</p>
          <p className="academy-objective">{text(exercise.objective)}</p>
          {reply && !completion && (
            <p>
              Defender’s reply <strong>{formatMove(reply)}</strong>
            </p>
          )}
          {goal.kind === "choice" && !completion && (
            <div className="academy-options">
              {goal.choices.map((choice, index) => (
                <button
                  key={choice}
                  disabled={!ready}
                  onClick={() => attempt(index)}
                >
                  {text(choice)}
                </button>
              ))}
            </div>
          )}
          <div className="academy-actions">
            {!completion && item.hintIndex < exercise.hints.length && (
              <button
                disabled={!ready}
                onClick={() => {
                  record({ kind, activityId: id }, { action: "hint" });
                  if (kind === "puzzle")
                    onPuzzleAttempt?.({
                      action: "hint",
                      hintsUsed: item.hintIndex + 1,
                      seconds: elapsedSeconds(started),
                    });
                }}
              >
                Show hint
              </button>
            )}
            {!completion && !dailyPuzzleMode && (
              <button disabled={!ready} onClick={retry}>
                Try again
              </button>
            )}
            {!completion && kind === "puzzle" && !dailyPuzzleMode && (
              <button aria-expanded={review} onClick={() => setReview(!review)}>
                {review ? "Hide solution" : "Review solution"}
              </button>
            )}
            {exercise.id === "compare-candidates" && !completion && (
              <button
                aria-expanded={comparison}
                onClick={() => setComparison(!comparison)}
              >
                Compare moves
              </button>
            )}
            {comparison && !completion && (
              <button
                disabled={analysisRequested && !analysis.failed}
                onClick={() => {
                  if (analysis.failed) analysis.retry();
                  setAnalysisRequested(true);
                }}
              >
                {analysis.failed
                  ? "Retry computer analysis"
                  : "Ask the computer"}
              </button>
            )}
          </div>
          {review && !completion && (
            <div className="academy-hint">
              <h3>Solution</h3>
              <p>
                {goal.kind === "choice"
                  ? text(goal.choices[goal.answer])
                  : answers.map(formatMove).join(", ")}
              </p>
              {sample && sampleReply && (
                <p>
                  One line is {formatMove(sample.move)},{" "}
                  {formatMove(sampleReply.move)}, then{" "}
                  {formatMove(sampleReply.answers[0])} to win.
                </p>
              )}
              <p>{text(exercise.explanation)}</p>
            </div>
          )}
          {comparison && !completion && suggestion && (
            <p role="status">
              Computer suggestion {formatMove(suggestion)}. This is a search
              candidate.
            </p>
          )}
          {comparison && !completion && (
            <table className="academy-comparison">
              <caption>Legal replies after each candidate</caption>
              <thead>
                <tr>
                  <th scope="col">Move</th>
                  <th scope="col">Replies</th>
                  <th scope="col">Captures</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ move, replies, captures }) => (
                  <tr key={moveCode(move)}>
                    <th scope="row">{formatMove(move)}</th>
                    <td>{replies}</td>
                    <td>{captures}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {kind === "lesson" && !completion && item.completedAt != null && (
            <p>Previously completed.</p>
          )}
          {kind === "puzzle" && !completion && item.completedAt != null && (
            <p>Previously solved.</p>
          )}
        </div>
        {dailyPuzzleMode && completion && (
          <>
            <div className="turn-card daily-completion-panel">
              <div role="status" aria-live="polite">
                <strong>
                  {completion.practice
                    ? "Practice complete."
                    : "Solution verified."}
                </strong>
                <p>{text(exercise.explanation)}</p>
                {completion.points > 0 && (
                  <p>+{completion.points} puzzle points</p>
                )}
              </div>
            </div>
            <div className="academy-actions daily-completion-actions">
              <button onClick={retry}>Play again</button>
              <Link className="primary-button" href="/learn?section=progress">
                View progress
              </Link>
            </div>
          </>
        )}
      </div>
      <div className="academy-lesson-board">
        <p className="academy-board-caption">
          {solutionShown
            ? solutionPlaying
              ? "Solution replay"
              : "Solution shown"
            : completion
              ? "Exercise complete"
              : `${displayedSide} to play`}
        </p>
        <p className="academy-board-counts">
          {displayed.sharksPlaced}/20 placed · {displayed.sharksCaptured}/5
          captured
        </p>
        {dailyPuzzleMode && (
          <div className="daily-celebration-slot">
            {completion && !completion.practice && (
              <div
                className="daily-celebration"
                role="status"
                aria-live="polite"
              >
                <svg
                  className="daily-trophy"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M9 5h14v6a7 7 0 0 1-5 6.7V22h5v3H9v-3h5v-4.3A7 7 0 0 1 9 11V5Zm-3 3H3v3a6 6 0 0 0 6 6v-3a3 3 0 0 1-3-3V8Zm20 0v6a3 3 0 0 1-3 3v3a6 6 0 0 0 6-6V8h-3Z" />
                </svg>
                <strong>Puzzle Solved!</strong>
                {Array.from({ length: 12 }, (_, index) => (
                  <span
                    className={`daily-confetti confetti-${index % 8}`}
                    key={index}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
          </div>
        )}
        <Board
          state={displayed}
          selected={selected}
          moves={visibleMoves}
          lastMove={solutionMove ?? completion?.move ?? reply ?? undefined}
          flipped={false}
          theme={theme}
          onNode={playNode}
          focusNodes={
            completion || solutionShown || reply ? [] : exercise.focus
          }
        />
        {dailyPuzzleMode && !completion && (
          <div className="daily-solution-controls turn-card">
            {!solutionShown ? (
              <button
                className="primary-button"
                disabled={!ready}
                onClick={showSolution}
              >
                Show Solution
              </button>
            ) : solutionLine?.moves.length === 0 && goal.kind === "choice" ? (
              <>
                <p className="daily-solution-answer">
                  <strong>Answer:</strong> {text(goal.choices[goal.answer])}{" "}
                  {text(exercise.explanation)}
                </p>
                <button onClick={retry}>Retry puzzle</button>
              </>
            ) : (
              <>
                <button
                  className="primary-button"
                  disabled={solutionPlaying}
                  onClick={replaySolution}
                >
                  Replay solution
                </button>
                <button onClick={retry}>Retry puzzle</button>
                <span role="status" aria-live="polite">
                  {solutionPlaying
                    ? "Demonstrating the solution."
                    : "Solution revealed. Retry to solve it yourself."}
                </span>
              </>
            )}
          </div>
        )}
        {(!dailyPuzzleMode || !completion) && (
          <div className="academy-feedback" role="status" aria-live="polite">
            {completion ? (
              <div className="academy-success">
                <strong>
                  {kind === "puzzle"
                    ? "Puzzle solved!"
                    : kind === "lesson"
                      ? "Lesson complete!"
                      : "Correct!"}
                </strong>
                <p>{text(exercise.explanation)}</p>
                {completion.points > 0 && (
                  <p>+{completion.points} puzzle points</p>
                )}
              </div>
            ) : (
              message || (reply ? "Find the winning continuation." : "")
            )}
          </div>
        )}
        <p className="academy-hint" role="status">
          {!completion && item.hintIndex > 0 && (
            <>
              <strong>Hint {item.hintIndex}</strong>{" "}
              {text(exercise.hints[item.hintIndex - 1] ?? "")}
            </>
          )}
        </p>
        {completion && !dailyPuzzleMode && (
          <div className="academy-actions">
            <button onClick={retry}>Play again</button>
            {completion && next && (
              <Link
                className="primary-button"
                href={activityHref(kind, next.id)}
              >
                {kind === "lesson"
                  ? "Next lesson"
                  : kind === "puzzle"
                    ? "Next puzzle"
                    : "Next question"}
              </Link>
            )}
            {completion && !next && (
              <Link className="primary-button" href="/learn?section=progress">
                View progress
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
