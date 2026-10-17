import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves } from "@/lib/game/legal-moves";
import { createPositionKey } from "@/lib/game/position-key";
import type { GameState, Move } from "@/lib/game/types";
import { evaluatePosition } from "./evaluate";
import { SEARCH_LIMITS, type Difficulty } from "./types";

type Entry = {
  depth: number;
  score: number;
  bound: "exact" | "lower" | "upper";
  best?: Move;
};
type Ranked = { move: Move; score: number };
export interface SearchResult {
  move: Move | null;
  depth: number;
  nodes: number;
}
const same = (a: Move, b?: Move) => JSON.stringify(a) === JSON.stringify(b);
const TIMEOUT = Symbol("search deadline");

/** Iterative-deepening minimax with alpha-beta bounds and a per-search table. */
export function findComputerMove(
  state: GameState,
  difficulty: Difficulty,
  options: { now?: () => number; random?: () => number } = {},
): SearchResult {
  const limits = SEARCH_LIMITS[difficulty];
  const now = options.now ?? (() => performance.now());
  const deadline = now() + limits.timeMs;
  const table = new Map<string, Entry>();
  let nodes = 0;
  const checkTime = () => {
    if (now() >= deadline) throw TIMEOUT;
  };
  const initial = getLegalMoves(state);
  if (!initial.length) return { move: null, depth: 0, nodes: 0 };
  const direction = state.turn === "orcas" ? 1 : -1;

  function ordered(moves: Move[], best?: Move) {
    return [...moves].sort(
      (a, b) =>
        Number(same(b, best)) * 10 +
        Number(b.kind === "capture") -
        Number(same(a, best)) * 10 -
        Number(a.kind === "capture"),
    );
  }

  function search(
    position: GameState,
    depth: number,
    alpha: number,
    beta: number,
  ): number {
    checkTime();
    nodes++;
    if (position.result || depth === 0) return evaluatePosition(position);
    const key = createPositionKey(position);
    const cached = table.get(key);
    const originalAlpha = alpha,
      originalBeta = beta;
    if (cached && cached.depth >= depth) {
      if (cached.bound === "exact") return cached.score;
      if (cached.bound === "lower") alpha = Math.max(alpha, cached.score);
      else beta = Math.min(beta, cached.score);
      if (alpha >= beta) return cached.score;
    }
    const moves = ordered(getLegalMoves(position), cached?.best);
    if (!moves.length) return evaluatePosition(position);
    const maximizing = position.turn === "orcas";
    let score = maximizing ? -Infinity : Infinity;
    let best: Move | undefined;
    for (const move of moves) {
      const value = search(applyMove(position, move), depth - 1, alpha, beta);
      if (best === undefined || (maximizing ? value > score : value < score)) {
        score = value;
        best = move;
      }
      if (maximizing) alpha = Math.max(alpha, score);
      else beta = Math.min(beta, score);
      if (alpha >= beta) break;
    }
    if (table.size < 40_000)
      table.set(key, {
        depth,
        score,
        best,
        bound:
          score <= originalAlpha
            ? "upper"
            : score >= originalBeta
              ? "lower"
              : "exact",
      });
    return score;
  }

  // A legal fallback is available even if the first search iteration times out.
  let completed: Ranked[] = [{ move: initial[0], score: 0 }];
  let completedDepth = 0;
  for (let depth = 1; depth <= limits.maxDepth; depth++) {
    try {
      const iteration: Ranked[] = [];
      for (const move of ordered(initial, completed[0]?.move)) {
        checkTime();
        const child = applyMove(state, move);
        const key = createPositionKey(child);
        // Prefer fresh positions when scores are otherwise close, without inventing a draw rule.
        const repetitions = state.history.filter((k) => k === key).length;
        const score =
          direction * search(child, depth - 1, -Infinity, Infinity) -
          repetitions * 18;
        iteration.push({ move, score });
      }
      iteration.sort((a, b) => b.score - a.score);
      completed = iteration;
      completedDepth = depth;
      if (completed[0].score >= 90_000) break;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  const candidates = completed.filter(
    (entry) => entry.score >= completed[0].score - limits.variety,
  );
  const random = Math.max(
    0,
    Math.min(0.999999, options.random?.() ?? Math.random()),
  );
  const chosen = limits.variety
    ? candidates[Math.floor(random * candidates.length)]
    : completed[0];
  return { move: chosen.move, depth: completedDepth, nodes };
}
