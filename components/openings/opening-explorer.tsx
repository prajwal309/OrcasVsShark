"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Board } from "@/components/board/board";
import { useComputer } from "@/components/game/use-computer";
import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { getLegalMoves, getLegalMovesFrom } from "@/lib/game/legal-moves";
import { formatMove } from "@/lib/game/notation";
import type { GameState, Move, NodeId } from "@/lib/game/types";

type Filters = { mode: "all" | "casual" | "ranked"; rating: string };
type MoveStat = {
  move: Move;
  games: number;
  frequency: number;
  orcaWinRate: number;
  sharkWinRate: number;
  drawRate: number;
};
type Stats = {
  available: boolean;
  games: number;
  moves: MoveStat[];
  insufficientData?: boolean;
  message?: string;
};

const initialStats: Stats = {
  available: true,
  games: 0,
  moves: [],
};

export function OpeningExplorer() {
  const [states, setStates] = useState<GameState[]>([createInitialState()]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [filters, setFilters] = useState<Filters>({
    mode: "all",
    rating: "all",
  });
  const [stats, setStats] = useState<Stats>(initialStats);
  const [analysisRequested, setAnalysisRequested] = useState(false);
  const [suggestion, setSuggestion] = useState<Move | null>(null);
  const state = states.at(-1)!;
  const legalMoves = selected ? getLegalMovesFrom(state, selected) : [];
  const visibleMoves =
    state.turn === "sharks" && state.phase === "shark-placement"
      ? getLegalMoves(state)
      : legalMoves;
  const search = useComputer(
    state,
    analysisRequested,
    "medium",
    (move) => {
      setSuggestion(move);
      setAnalysisRequested(false);
    },
  );

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      line: moves
        .map((move) =>
          move.kind === "place"
            ? `+${move.to}`
            : `${move.from}${move.kind === "capture" ? "x" : "-"}${move.to}`,
        )
        .join(","),
      mode: filters.mode,
      rating: filters.rating,
    });
    void fetch(`/api/opening-explorer?${query}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Opening statistics could not load.");
        setStats((await response.json()) as Stats);
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setStats({
          available: false,
          games: 0,
          moves: [],
          message: "Completed-game statistics could not load.",
        });
      });
    return () => controller.abort();
  }, [moves, filters]);

  const statsByMove = useMemo(
    () =>
      new Map(
        stats.moves.map((row) => [
          row.move.kind === "place"
            ? `+${row.move.to}`
            : `${row.move.from}${row.move.kind === "capture" ? "x" : "-"}${row.move.to}`,
          row,
        ]),
      ),
    [stats.moves],
  );

  function playNode(node: NodeId) {
    if (state.turn === "sharks" && state.phase === "shark-placement") {
      const move = getLegalMoves(state).find(
        (candidate) => candidate.kind === "place" && candidate.to === node,
      );
      if (move) {
        setStates([...states, applyMove(state, move)]);
        setMoves([...moves, move]);
        setSelected(null);
      }
      return;
    }
    if (state.board[node] === (state.turn === "orcas" ? "orca" : "shark")) {
      setSelected(node);
      return;
    }
    const move = legalMoves.find((candidate) => candidate.to === node);
    if (move) {
      setStates([...states, applyMove(state, move)]);
      setMoves([...moves, move]);
      setSelected(null);
    }
  }

  function navigateBack() {
    if (states.length < 2) return;
    setStates(states.slice(0, -1));
    setMoves(moves.slice(0, -1));
    setSelected(null);
  }

  function restart() {
    setStates([createInitialState()]);
    setMoves([]);
    setSelected(null);
  }

  return (
    <section className="opening-explorer">
      <div className="opening-board turn-card">
        <p className="eyebrow">POSITION · {state.ply}</p>
        <Board
          state={state}
          selected={selected}
          moves={visibleMoves}
          flipped={false}
          onNode={playNode}
        />
        <div className="play-mode-actions">
          <button onClick={navigateBack} disabled={moves.length === 0}>
            Back
          </button>
          <button onClick={restart} disabled={moves.length === 0}>
            Start over
          </button>
        </div>
        <p>Click a legal point to explore the next move.</p>
      </div>
      <aside className="opening-details turn-card">
        <h2>Opening statistics</h2>
        <p>Statistics use completed human games only.</p>
        <label>
          Game mode
          <select
            value={filters.mode}
            onChange={(event) =>
              setFilters({ ...filters, mode: event.target.value as Filters["mode"] })
            }
          >
            <option value="all">All games</option>
            <option value="casual">Casual</option>
            <option value="ranked">Ranked</option>
          </select>
        </label>
        <label>
          Player rating
          <select
            value={filters.rating}
            onChange={(event) =>
              setFilters({ ...filters, rating: event.target.value })
            }
          >
            <option value="all">Any rating</option>
            <option value="1200-1599">1200–1599</option>
            <option value="1600-1999">1600–1999</option>
            <option value="2000+">2000+</option>
          </select>
        </label>
        {!stats.available ? (
          <p role="status">{stats.message}</p>
        ) : stats.games === 0 ? (
          <p role="status">
            No completed games are available for this position and filter.
          </p>
        ) : (
          <>
            <p>{stats.games} completed games reached this position.</p>
            <div className="opening-table-scroll">
              <table className="academy-comparison">
                <thead>
                  <tr>
                    <th>Move</th>
                    <th>Games</th>
                    <th>Frequency</th>
                    <th>Orca W</th>
                    <th>Shark W</th>
                    <th>Draw</th>
                  </tr>
                </thead>
                <tbody>
                  {getLegalMoves(state).map((move) => {
                    const code =
                      move.kind === "place"
                        ? `+${move.to}`
                        : `${move.from}${move.kind === "capture" ? "x" : "-"}${move.to}`;
                    const row = statsByMove.get(code);
                    return (
                      <tr key={code}>
                        <th>{formatMove(move)}</th>
                        <td>{row?.games ?? 0}</td>
                        <td>{Math.round((row?.frequency ?? 0) * 100)}%</td>
                        <td>{Math.round(row?.orcaWinRate ?? 0)}%</td>
                        <td>{Math.round(row?.sharkWinRate ?? 0)}%</td>
                        <td>{Math.round(row?.drawRate ?? 0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        <hr />
        <h3>Computer analysis</h3>
        <p>Separate from human-game statistics; this is a search suggestion.</p>
        <button
          disabled={analysisRequested && !search.failed}
          onClick={() => {
            if (search.failed) search.retry();
            setSuggestion(null);
            setAnalysisRequested(true);
          }}
        >
          {search.failed ? "Retry analysis" : "Suggest a move"}
        </button>
        {suggestion && <p>Search suggestion: {formatMove(suggestion)}</p>}
        <Link href="/daily-puzzle">Try today’s Daily Puzzle</Link>
      </aside>
    </section>
  );
}
