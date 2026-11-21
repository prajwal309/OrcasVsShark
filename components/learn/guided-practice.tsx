"use client";

import { useState } from "react";
import { Board } from "@/components/board/board";
import { useComputer } from "@/components/game/use-computer";
import type { Difficulty } from "@/lib/ai/types";
import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { getLegalMoves, getLegalMovesFrom } from "@/lib/game/legal-moves";
import { formatMove } from "@/lib/game/notation";
import type { GameState, Move, NodeId, Side } from "@/lib/game/types";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";
import { learningText } from "./presentation";
import { useProgress } from "./progress-provider";

type Entry = {
  state: GameState;
  move?: Move;
  note?: string;
  concern?: boolean;
};
const fresh = (): Entry[] => [{ state: createInitialState() }];

function analyzeDecision(before: GameState, next: GameState) {
  if (next.result?.winner === before.turn)
    return { note: "This move ends the game in your favor." };
  const replies = getLegalMoves(next);
  const winning = replies.find(
    (reply) => applyMove(next, reply).result?.winner === next.turn,
  );
  if (winning)
    return {
      note: `The opponent can win immediately with ${formatMove(winning)}. Try to take away that reply.`,
      concern: true,
    };
  if (before.turn === "sharks") {
    const jump = replies.find(({ kind }) => kind === "capture");
    return jump
      ? {
          note: `This position allows the capture ${formatMove(jump)}. Can you find a move that closes the landing point?`,
          concern: true,
        }
      : { note: "{orcas} have no legal capture after this move." };
  }
  if (next.sharksCaptured > before.sharksCaptured)
    return {
      note: "This capture moves you one closer to the five you need to win.",
    };
  if (getLegalMoves(before).some(({ kind }) => kind === "capture"))
    return {
      note: "A capture was available. A quiet move can still be useful. Compare what each move leaves open.",
    };
  return {
    note: `This move gives the opponent ${replies.length} legal ${replies.length === 1 ? "reply" : "replies"}.`,
  };
}

export function GuidedPractice({ theme }: { theme: BoardTheme }) {
  const labels = themeLabels(theme);
  const { ready } = useProgress();
  const [side, setSide] = useState<Side>("sharks");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [activeSettings, setActiveSettings] = useState({ side, difficulty });
  const humanSide = activeSettings.side;
  const [timeline, setTimeline] = useState<Entry[]>(fresh);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [hintRequested, setHintRequested] = useState(false);
  const [hint, setHint] = useState<Move | null>(null);
  const [showLegal, setShowLegal] = useState(true);
  const [reviewPly, setReviewPly] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const state = timeline[timeline.length - 1].state;
  const finished = ended || !!state.result;
  const ourTurn = started && !finished && state.turn === humanSide;
  const placement =
    state.turn === "sharks" && state.phase === "shark-placement";

  function commit(move: Move, human: boolean) {
    const next = applyMove(state, move);
    const analysis = human ? analyzeDecision(state, next) : {};
    setTimeline([...timeline, { state: next, move, ...analysis }]);
    setSelected(null);
    setHint(null);
    setHintRequested(false);
    setStatus(human ? "" : `Computer played ${formatMove(move)}.`);
  }

  const computer = useComputer(
    state,
    started && !finished && !ourTurn,
    activeSettings.difficulty,
    (move) => commit(move, false),
  );
  const suggestion = useComputer(
    state,
    ourTurn && hintRequested,
    activeSettings.difficulty,
    (move) => {
      setHint(move);
      if (move.kind !== "place") setSelected(move.from);
      setHintRequested(false);
      setStatus(`The search suggests ${formatMove(move)}.`);
    },
  );

  const candidates = !ourTurn
    ? []
    : placement
      ? getLegalMoves(state)
      : selected
        ? getLegalMovesFrom(state, selected)
        : [];
  const highlights = hint ? [hint] : showLegal ? candidates : [];
  const lastHuman = timeline.findLastIndex(({ note }) => !!note);
  const displayed = timeline[reviewPly ?? timeline.length - 1];

  function play(node: NodeId) {
    if (!ourTurn) {
      setStatus(
        started && !finished
          ? "Wait for the computer’s reply."
          : "Start a practice game to make a move.",
      );
      return;
    }
    if (
      !placement &&
      state.board[node] === (humanSide === "sharks" ? "shark" : "orca")
    ) {
      setSelected(node);
      setHint(null);
      setStatus(
        getLegalMovesFrom(state, node).length
          ? "Choose a destination."
          : "That piece has no legal moves.",
      );
      return;
    }
    const move = candidates.find(({ to }) => to === node);
    if (move) commit(move, true);
    else
      setStatus(
        !placement && !selected
          ? "Select one of your pieces first."
          : "That move is illegal.",
      );
  }

  function undo() {
    if (lastHuman < 1) return;
    setTimeline(timeline.slice(0, lastHuman));
    setEnded(false);
    setReviewPly(null);
    setSelected(null);
    setHint(null);
    setHintRequested(false);
    setStatus("Your last move and any computer reply were undone.");
  }

  function start() {
    setActiveSettings({ side, difficulty });
    setTimeline(fresh());
    setStarted(true);
    setEnded(false);
    setReviewPly(null);
    setSelected(null);
    setHint(null);
    setHintRequested(false);
    setStatus("Practice started.");
  }

  const review = timeline.flatMap((entry, ply) =>
    entry.note && entry.move ? [{ entry, ply, move: entry.move }] : [],
  );
  const important = review.filter(({ entry }) => entry.concern);
  const decisions = [
    ...new Map(
      [...important.slice(-4), ...review.slice(-3)].map((item) => [
        item.ply,
        item,
      ]),
    ).values(),
  ].sort((a, b) => a.ply - b.ply);

  return (
    <section className="academy-exercise" aria-labelledby="practice-title">
      <div className="academy-lesson-board">
        <p className="academy-board-caption">
          {finished
            ? reviewPly
              ? `Review · ply ${reviewPly}`
              : "Practice review"
            : `${labels.sides[state.turn]} to play`}
        </p>
        <Board
          state={displayed.state}
          selected={selected}
          moves={highlights}
          lastMove={displayed.move}
          onNode={play}
          flipped={false}
          theme={theme}
          focusNodes={hint ? [hint.to] : []}
        />
      </div>
      <div className="academy-instructions turn-card">
        <h2 id="practice-title">Guided Practice</h2>
        <p>
          Play the computer with legal moves highlighted. Ask for a suggestion
          and review the replies your decisions allow.
        </p>
        {(!started || finished) && (
          <form
            className="academy-practice-settings"
            onSubmit={(event) => {
              event.preventDefault();
              start();
            }}
          >
            <label>
              Your side
              <select
                value={side}
                onChange={(event) => setSide(event.target.value as Side)}
              >
                <option value="sharks">{labels.sides.sharks}</option>
                <option value="orcas">{labels.sides.orcas}</option>
              </select>
            </label>
            <label>
              Difficulty
              <select
                value={difficulty}
                onChange={(event) =>
                  setDifficulty(event.target.value as Difficulty)
                }
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
            <button className="primary-button" type="submit" disabled={!ready}>
              {started ? "New practice game" : "Start practice"}
            </button>
          </form>
        )}
        {started && !finished && (
          <>
            <p>
              You are {labels.sides[humanSide]} · {activeSettings.difficulty}
            </p>
            <label className="academy-toggle">
              <input
                type="checkbox"
                checked={showLegal}
                onChange={(event) => setShowLegal(event.target.checked)}
              />{" "}
              Highlight legal moves
            </label>
            <div className="academy-actions">
              <button
                disabled={!ourTurn || hintRequested}
                onClick={() => {
                  setStatus("Finding a candidate move…");
                  setHintRequested(true);
                }}
              >
                Ask for a hint
              </button>
              <button disabled={lastHuman < 1} onClick={undo}>
                Undo and retry
              </button>
              <button
                onClick={() => {
                  setEnded(true);
                  setHint(null);
                  setSelected(null);
                  setHintRequested(false);
                }}
              >
                End practice
              </button>
            </div>
          </>
        )}
        {computer.failed && (
          <button onClick={computer.retry}>Retry computer move</button>
        )}
        {suggestion.failed && (
          <button onClick={suggestion.retry}>Retry hint</button>
        )}
        <div role="status" className="academy-feedback">
          <p>
            {finished
              ? state.result
                ? `${labels.sides[state.result.winner]} win.`
                : "Practice ended."
              : status}
          </p>
          {started && !finished && !ourTurn && !computer.failed && (
            <p>The computer is thinking…</p>
          )}
          {hint && (
            <p>
              Use the highlighted move as a candidate. Search suggestions are
              heuristic.
            </p>
          )}
          {!finished && lastHuman > 0 && (
            <p>{learningText(timeline[lastHuman].note ?? "", theme)}</p>
          )}
        </div>
        {finished && (
          <section aria-labelledby="review-heading">
            <h3 id="review-heading">Review your decisions</h3>
            {decisions.length ? (
              <ol className="academy-list">
                {decisions.map(({ entry, ply, move }) => (
                  <li key={ply}>
                    <button
                      aria-pressed={reviewPly === ply}
                      onClick={() => setReviewPly(ply)}
                    >
                      Ply {ply} · {formatMove(move)}
                    </button>
                    <span>{learningText(entry.note ?? "", theme)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>
                Make a move in your next practice game to see feedback here.
              </p>
            )}
            <button disabled={lastHuman < 1} onClick={undo}>
              Undo and retry
            </button>
          </section>
        )}
      </div>
    </section>
  );
}
