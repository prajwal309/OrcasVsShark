"use client";

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
  onPuzzleAttempt,
}: {
  exercise: Exercise;
  kind: ActivityKind;
  next?: Exercise;
  theme: BoardTheme;
  onPuzzleAttempt?: (event: {
    action: "attempt" | "hint";
    answer?: string | number;
    hintsUsed: number;
    seconds: number;
    opening?: string | null;
  }) => void;
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
  } | null>(null);
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
    completion || goal.kind === "choice"
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

  function attempt(answer: string | number, move?: Move) {
    const success = acceptedAnswer(exercise, answer, item.opening);
    const seconds = elapsedSeconds(started);
    record(
      { kind, activityId: id },
      { action: "attempt", answer, opening: item.opening, seconds },
    );
    if (kind === "puzzle")
      onPuzzleAttempt?.({
        action: "attempt",
        answer: success ? answer : undefined,
        hintsUsed: item.hintIndex,
        seconds,
        opening: item.opening,
      });
    if (success) {
      setCompletion({
        state: move ? applyMove(state, move) : state,
        move,
        points:
          kind === "puzzle" && item.completedAt === null
            ? puzzlePoints[exercise.level]
            : 0,
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
    if (!ready || completion) return;
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
    setMessage("The starting position is ready.");
    elapsedSeconds(started);
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
  const displayed = completion?.state ?? state;
  return (
    <article
      className="academy-exercise"
      id="academy-activity"
      aria-labelledby="exercise-heading"
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
          {!completion && (
            <button disabled={!ready} onClick={retry}>
              Try again
            </button>
          )}
          {!completion && kind === "puzzle" && (
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
              {analysis.failed ? "Retry computer analysis" : "Ask the computer"}
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
      <div className="academy-lesson-board">
        <p className="academy-board-caption">
          {completion ? "Exercise complete" : `${side} to play`}
        </p>
        <p className="academy-board-counts">
          {displayed.sharksPlaced}/20 placed · {displayed.sharksCaptured}/5
          captured
        </p>
        <Board
          state={displayed}
          selected={selected}
          moves={visibleMoves}
          lastMove={completion?.move ?? reply ?? undefined}
          flipped={false}
          theme={theme}
          onNode={playNode}
          focusNodes={completion || reply ? [] : exercise.focus}
        />
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
        <p className="academy-hint" role="status">
          {!completion && item.hintIndex > 0 && (
            <>
              <strong>Hint {item.hintIndex}</strong>{" "}
              {text(exercise.hints[item.hintIndex - 1] ?? "")}
            </>
          )}
        </p>
        {completion && (
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
