import { describe, expect, it } from "vitest";
import {
  ADJACENCY,
  CAPTURE_PATHS,
  COORDINATES,
  EDGES,
  NODES,
} from "@/lib/game/graph";
import { applyMove } from "@/lib/game/apply-move";
import { createInitialState } from "@/lib/game/initial-state";
import {
  getLegalMoves,
  getLegalMovesFrom,
  isLegalMove,
} from "@/lib/game/legal-moves";
import { createPositionKey } from "@/lib/game/position-key";
import { getGameResult } from "@/lib/game/result";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import { GameError, type GameState, type NodeId } from "@/lib/game/types";

// Independent geometric oracle used only in tests, never in production rules.
const xy = (n: NodeId) => [n.charCodeAt(0) - 97, Number(n[1]) - 1];
function adjacent(a: NodeId, b: NodeId) {
  const [x, y] = xy(a),
    [u, v] = xy(b),
    dx = Math.abs(x - u),
    dy = Math.abs(y - v);
  return dx + dy === 1 || (dx === 1 && dy === 1 && (x + y) % 2 === 0);
}
function straight(a: NodeId, b: NodeId, c: NodeId) {
  const [x, y] = xy(a),
    [u, v] = xy(b),
    [p, q] = xy(c);
  return adjacent(a, b) && adjacent(b, c) && u - x === p - u && v - y === q - v;
}
const position = (patch: Partial<GameState>): GameState => ({
  ...createInitialState(),
  ...patch,
});

describe("canonical topology", () => {
  it("has 25 distinct nodes, 56 unique edges, 80 directed capture paths", () => {
    expect(new Set(NODES).size).toBe(25);
    expect(EDGES).toHaveLength(56);
    expect(CAPTURE_PATHS).toHaveLength(80);
    expect(new Set(EDGES.map((e) => [...e].sort().join())).size).toBe(56);
    expect(new Set(CAPTURE_PATHS.map((p) => p.join())).size).toBe(80);
    for (const p of Object.values(COORDINATES)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });
  it("checks every edge and non-edge against an independent oracle", () => {
    for (const a of NODES)
      for (const b of NODES)
        expect(ADJACENCY[a].includes(b), `${a}-${b}`).toBe(adjacent(a, b));
  });
  it("checks every triple, including bent and missing paths", () => {
    const paths = new Set(CAPTURE_PATHS.map((p) => p.join()));
    for (const a of NODES)
      for (const b of NODES)
        for (const c of NODES)
          expect(paths.has([a, b, c].join()), `${a}/${b}/${c}`).toBe(
            straight(a, b, c),
          );
  });
});

describe("rules", () => {
  it("starts with four corner Orcas and Sharks to place", () => {
    const s = createInitialState();
    expect(s).toEqual({
      board: { a1: "orca", e1: "orca", a5: "orca", e5: "orca" },
      turn: "sharks",
      phase: "shark-placement",
      sharksPlaced: 0,
      sharksCaptured: 0,
      ply: 0,
      history: [createPositionKey(s)],
      result: null,
    });
    expect(getLegalMoves(s)).toHaveLength(21);
  });
  it("allows all empty placements and rejects all occupied points", () => {
    for (const to of NODES) {
      const s = createInitialState();
      expect(isLegalMove(s, { kind: "place", to })).toBe(!s.board[to]);
      if (!s.board[to]) {
        const next = applyMove(s, { kind: "place", to });
        expect(next.board[to]).toBe("shark");
        expect(next.turn).toBe("orcas");
        expect(next.sharksPlaced).toBe(1);
      } else
        expect(() => applyMove(s, { kind: "place", to })).toThrow(GameError);
    }
  });
  it("forbids Shark movement during placement", () => {
    const s = position({ board: { c3: "shark" } });
    expect(getLegalMovesFrom(s, "c3")).toEqual([]);
    expect(isLegalMove(s, { kind: "step", from: "c3", to: "c4" })).toBe(false);
  });
  it("transitions after the twentieth introduction, including captured Sharks", () => {
    const board: GameState["board"] = {
      a1: "orca",
      e1: "orca",
      a5: "orca",
      e5: "orca",
    };
    NODES.filter((n) => !board[n])
      .slice(0, 16)
      .forEach((n) => {
        board[n] = "shark";
      });
    const to = NODES.find((n) => !board[n])!;
    const next = applyMove(
      position({ board, sharksPlaced: 19, sharksCaptured: 3 }),
      { kind: "place", to },
    );
    expect(next.phase).toBe("shark-movement");
    expect(next.sharksPlaced).toBe(20);
    expect(Object.values(next.board).filter((p) => p === "shark")).toHaveLength(
      17,
    );
  });
  it("checks every step for each side and every direction", () => {
    for (const side of ["sharks", "orcas"] as const)
      for (const from of NODES)
        for (const to of NODES) {
          const s = position({
            board: { [from]: side === "orcas" ? "orca" : "shark" },
            turn: side,
            phase: "shark-movement",
            sharksPlaced: 20,
          });
          expect(
            isLegalMove(s, { kind: "step", from, to }),
            `${side} ${from}-${to}`,
          ).toBe(adjacent(from, to));
          if (from !== to) {
            s.board[to] = "shark";
            expect(isLegalMove(s, { kind: "step", from, to })).toBe(false);
          }
        }
  });
  it("checks every legal capture and its obstructions", () => {
    for (const [from, over, to] of CAPTURE_PATHS) {
      const s = position({
        turn: "orcas",
        board: { [from]: "orca", [over]: "shark" },
        sharksPlaced: 1,
      });
      const move = { kind: "capture" as const, from, over, to };
      expect(isLegalMove(s, move)).toBe(true);
      const next = applyMove(s, move);
      expect(next.sharksCaptured).toBe(1);
      expect(next.board[over]).toBeUndefined();
      expect(next.turn).toBe("sharks");
      expect(isLegalMove(next, move)).toBe(false);
      expect(
        isLegalMove({ ...s, board: { ...s.board, [to]: "shark" } }, move),
      ).toBe(false);
      expect(
        isLegalMove({ ...s, board: { ...s.board, [to]: "orca" } }, move),
      ).toBe(false);
      expect(
        isLegalMove({ ...s, board: { ...s.board, [over]: "orca" } }, move),
      ).toBe(false);
      expect(isLegalMove({ ...s, board: { [from]: "orca" } }, move)).toBe(
        false,
      );
    }
  });
  it("rejects every non-straight capture, including bends and missing segments", () => {
    for (const from of NODES)
      for (const over of NODES)
        for (const to of NODES) {
          if (
            from === over ||
            from === to ||
            over === to ||
            straight(from, over, to)
          )
            continue;
          expect(
            isLegalMove(
              position({
                turn: "orcas",
                board: { [from]: "orca", [over]: "shark" },
              }),
              { kind: "capture", from, over, to },
            ),
          ).toBe(false);
        }
  });
  it("captures are optional and never chained", () => {
    const s = position({
      turn: "orcas",
      board: { a1: "orca", b1: "shark", d1: "shark" },
      sharksPlaced: 2,
    });
    expect(isLegalMove(s, { kind: "step", from: "a1", to: "a2" })).toBe(true);
    const next = applyMove(s, {
      kind: "capture",
      from: "a1",
      over: "b1",
      to: "c1",
    });
    expect(
      isLegalMove(next, { kind: "capture", from: "c1", over: "d1", to: "e1" }),
    ).toBe(false);
    expect(next.board.d1).toBe("shark");
  });
  it("ends immediately at five captures", () => {
    const s = position({
      turn: "orcas",
      board: { a1: "orca", b1: "shark" },
      sharksPlaced: 5,
      sharksCaptured: 4,
    });
    const next = applyMove(s, {
      kind: "capture",
      from: "a1",
      over: "b1",
      to: "c1",
    });
    expect(next.result).toEqual({ winner: "orcas", reason: "five-captures" });
    expect(getLegalMoves(next)).toEqual([]);
  });
  it("requires full immobilization, including capture escape routes", () => {
    const board: GameState["board"] = Object.fromEntries(
      NODES.map((n) => [n, "shark"]),
    );
    for (const n of ["a1", "a5", "e1", "e5"] as const) board[n] = "orca";
    delete board.b3;
    expect(getGameResult(position({ board }))).toEqual({
      winner: "sharks",
      reason: "immobilization",
    });
    delete board.b1;
    expect(getGameResult(position({ board }))).toBeNull();
    board.b1 = "shark";
    delete board.c1;
    expect(getGameResult(position({ board }))).toBeNull();
  });
  it("does not mutate input, with deterministic moves and stable position keys", () => {
    const s = createInitialState(),
      before = JSON.stringify(s);
    Object.freeze(s.board);
    Object.freeze(s.history);
    Object.freeze(s);
    const next = applyMove(s, { kind: "place", to: "c3" });
    expect(JSON.stringify(s)).toBe(before);
    expect(getLegalMoves(s)).toEqual(getLegalMoves(s));
    expect(next.history.at(-1)).toBe(createPositionKey(next));
    expect(
      createPositionKey({
        ...s,
        ply: 40,
        board: { e5: "orca", a5: "orca", e1: "orca", a1: "orca" },
      }),
    ).toBe(createPositionKey(s));
    expect(createPositionKey({ ...s, turn: "orcas" })).not.toBe(
      createPositionKey(s),
    );
  });
});

describe("serialization", () => {
  it("round trips a played game", () => {
    let s = createInitialState();
    for (let i = 0; i < 60 && !s.result; i++) {
      s = applyMove(s, getLegalMoves(s)[i % getLegalMoves(s).length]);
      expect(deserializeState(serializeState(s))).toEqual(s);
    }
  });
  it("rejects malformed and inconsistent input with typed errors", () => {
    for (const bad of ["", "null", "{}", "[]", '{"version":2}', "<script>"])
      expect(() => deserializeState(bad)).toThrow(GameError);
    const s = createInitialState();
    for (const patch of [
      { sharksPlaced: 21 },
      { sharksCaptured: -1 },
      { board: { a1: "orca" } },
      { board: { ...s.board, z9: "shark" } },
      { phase: "shark-movement" },
      { turn: "orcas" },
      { ply: 2 },
      { history: [] },
      { result: { winner: "orcas", reason: "five-captures" } },
      { extra: true },
    ]) {
      expect(() =>
        deserializeState(
          JSON.stringify({ version: 1, state: { ...s, ...patch } }),
        ),
      ).toThrow(GameError);
    }
  });
});
