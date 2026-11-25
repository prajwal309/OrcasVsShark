import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import { getLegalMoves } from "@/lib/game/legal-moves";
import { NODES } from "@/lib/game/graph";
import type { GameState, Move, NodeId, Side } from "@/lib/game/types";

export type OpeningGame = {
  moves: readonly Move[];
  winner: Side | "draw" | null;
};

export type OpeningMoveStat = {
  move: Move;
  games: number;
  frequency: number;
  orcaWinRate: number;
  sharkWinRate: number;
  drawRate: number;
};

export function transformNode(node: NodeId, symmetry: number): NodeId {
  let x = node.charCodeAt(0) - 97;
  let y = Number(node[1]) - 1;
  if (symmetry >= 4) x = 4 - x;
  for (let turn = 0; turn < symmetry % 4; turn++) [x, y] = [4 - y, x];
  return `${String.fromCharCode(97 + x)}${y + 1}` as NodeId;
}

function transformMove(move: Move, symmetry: number): Move {
  if (move.kind === "place")
    return { kind: "place", to: transformNode(move.to, symmetry) };
  if (move.kind === "step")
    return {
      kind: "step",
      from: transformNode(move.from, symmetry),
      to: transformNode(move.to, symmetry),
    };
  return {
    kind: "capture",
    from: transformNode(move.from, symmetry),
    over: transformNode(move.over, symmetry),
    to: transformNode(move.to, symmetry),
  };
}

function moveCode(move: Move) {
  return move.kind === "place"
    ? `+${move.to}`
    : `${move.from}${move.kind === "capture" ? "x" : "-"}${move.to}`;
}

export function canonicalPosition(state: GameState) {
  let bestKey = "";
  let bestSymmetry = 0;
  for (let symmetry = 0; symmetry < 8; symmetry++) {
    const key = positionKey(state, symmetry);
    if (!bestKey || key < bestKey) {
      bestKey = key;
      bestSymmetry = symmetry;
    }
  }
  return { key: bestKey, symmetry: bestSymmetry };
}

function positionKey(state: GameState, symmetry: number) {
  const board = NODES.flatMap((node) => {
    const piece = state.board[node];
    return piece ? [`${transformNode(node, symmetry)}:${piece}`] : [];
  })
    .sort()
    .join(",");
  return `${state.turn}|${state.phase}|${state.sharksPlaced}|${state.sharksCaptured}|${board}`;
}

function canonicalMoveCode(state: GameState, move: Move) {
  const target = canonicalPosition(state).key;
  return Array.from({ length: 8 }, (_, symmetry) =>
    positionKey(state, symmetry) === target
      ? moveCode(transformMove(move, symmetry))
      : null,
  )
    .filter((code): code is string => code !== null)
    .sort()[0];
}

function sameMove(left: Move, right: Move) {
  return moveCode(left) === moveCode(right);
}

export function replayOpeningLine(line: readonly string[]): GameState {
  let state = createInitialState();
  for (const code of line) {
    const move = getLegalMoves(state).find(
      (candidate) => moveCode(candidate) === code,
    );
    if (!move) throw new Error(`Illegal opening move at ply ${state.ply + 1}.`);
    state = applyMove(state, move);
  }
  return state;
}

export function openingMoveStatistics(
  games: readonly OpeningGame[],
  position: GameState,
): { games: number; moves: OpeningMoveStat[] } {
  const target = canonicalPosition(position).key;
  const positionGames = new Map<
    string,
    { games: number; orcaWins: number; sharkWins: number; draws: number }
  >();
  let gamesAtPosition = 0;

  for (const game of games) {
    let state = createInitialState();
    for (let ply = 0; ply <= game.moves.length; ply++) {
      const canonical = canonicalPosition(state);
      if (canonical.key === target) {
        gamesAtPosition++;
        if (ply < game.moves.length) {
          const move = game.moves[ply];
          const legal = getLegalMoves(state).find((candidate) =>
            sameMove(candidate, move),
          );
          if (legal) {
            const canonicalCode = canonicalMoveCode(state, legal);
            const stats = positionGames.get(canonicalCode) ?? {
              games: 0,
              orcaWins: 0,
              sharkWins: 0,
              draws: 0,
            };
            stats.games++;
            if (game.winner === "orcas") stats.orcaWins++;
            else if (game.winner === "sharks") stats.sharkWins++;
            else stats.draws++;
            positionGames.set(canonicalCode, stats);
          }
        }
        break;
      }
      if (ply === game.moves.length) break;
      const move = getLegalMoves(state).find((candidate) =>
        sameMove(candidate, game.moves[ply]),
      );
      if (!move) break;
      state = applyMove(state, move);
    }
  }

  const moves = getLegalMoves(position).map((move) => {
    const canonicalCode = canonicalMoveCode(position, move);
    const stats = positionGames.get(canonicalCode);
    const count = stats?.games ?? 0;
    return {
      move,
      games: count,
      frequency: gamesAtPosition ? count / gamesAtPosition : 0,
      orcaWinRate: count ? (stats!.orcaWins / count) * 100 : 0,
      sharkWinRate: count ? (stats!.sharkWins / count) * 100 : 0,
      drawRate: count ? (stats!.draws / count) * 100 : 0,
    };
  });
  return { games: gamesAtPosition, moves };
}
