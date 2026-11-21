// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sqlClient } from "@/lib/database/connection";
import { openDatabase } from "@/lib/database/sqlite.mjs";
import { acknowledgeMatch, updateQueue } from "@/lib/multiplayer/matchmaking";
import {
  leaderboard,
  playerProfile,
  rankedMatch,
} from "@/lib/multiplayer/ratings-store";
import {
  advanceClock,
  clockAt,
  eloChange,
  ratingWindow,
  startClock,
  rankedModes,
} from "@/lib/multiplayer/ranking";
import {
  changeRoom,
  expireRankedRoom,
  readRoom,
} from "@/lib/multiplayer/store";
import type { RoomAction, RoomView } from "@/lib/multiplayer/protocol";
import victories from "../fixtures/victories.json";
import type { Move } from "@/lib/game/types";

const base = 1_000_000;
const action = (room: RoomView, value: RoomAction) => ({
  requestId: randomUUID(),
  expectedPly: room.state.ply,
  expectedRevision: room.revision,
  action: value,
});

it("applies symmetric Elo changes for wins, losses, and draws at different ratings", () => {
  expect(eloChange(1500, 1500, 1)).toBe(16);
  expect(eloChange(1500, 1500, 0)).toBe(-16);
  expect(eloChange(1500, 1500, 0.5)).toBe(0);
  expect(eloChange(1700, 1500, 1)).toBe(8);
  expect(eloChange(1700, 1500, 0)).toBe(-24);
  expect(eloChange(1700, 1500, 0.5)).toBe(-8);
  expect(eloChange(1500, 1700, 0.5)).toBe(8);
});

it("implements all three time controls, increments, and an absolute deadline", () => {
  for (const [mode, minutes, seconds] of [
    ["fast", 3, 5],
    ["medium", 5, 5],
    ["classic", 10, 10],
  ] as const) {
    const initial = startClock(mode, base);
    const initialMs = minutes * 60_000;
    expect(initial).toEqual({
      deadline: base + initialMs,
      remaining: { orcas: initialMs, sharks: initialMs },
    });
    expect(clockAt(initial, "sharks", base - 100)).toEqual(initial.remaining);
    expect(clockAt(initial, "sharks", base + initialMs).sharks).toBe(0);
    const moved = advanceClock(
      initial,
      mode,
      "sharks",
      "orcas",
      base + 2500,
      false,
    );
    expect(moved).toEqual({
      deadline: base + 2500 + initialMs,
      remaining: {
        orcas: initialMs,
        sharks: initialMs - 2500 + seconds * 1000,
      },
    });
    expect(clockAt(moved, "orcas", base + 7500)).toEqual({
      orcas: initialMs - 5000,
      sharks: moved.remaining.sharks,
    });
  }
  expect([0, 9999, 10_000, 60_000, 300_000].map(ratingWindow)).toEqual([
    100, 100, 150, 400, 400,
  ]);
});

describe("ranked SQLite games", () => {
  let storage: ReturnType<typeof openDatabase>;
  let db: ReturnType<typeof sqlClient>;
  const tx = <T>(work: () => T) => storage.transaction(work).immediate();
  beforeEach(() => {
    storage = openDatabase(":memory:");
    db = sqlClient(storage);
    for (const player of ["alpha", "bravo", "charlie", "delta"])
      db.query(
        "INSERT INTO accounts (id, username, password_hash) VALUES ($1, $1, 'fixture')",
        [player],
      );
  });
  afterEach(() => storage.close());

  function pair(mode: "fast" | "medium" | "classic" = "fast") {
    tx(() => updateQueue(db, "alpha", "enter", mode, base));
    const search = tx(() => updateQueue(db, "bravo", "enter", mode, base));
    if (search.status !== "matched") throw new Error("Expected a match");
    const match = rankedMatch(db, search.code);
    return {
      code: search.code,
      orcas: match.orcas_id,
      sharks: match.sharks_id,
    };
  }

  it("seeds each mode and pairs only with a nearby player seeking the same mode", () => {
    expect(playerProfile(db, "alpha")?.ratings).toEqual(
      expect.arrayContaining(
        rankedModes.map((mode) => ({
          mode,
          rating: 1500,
          wins: 0,
          losses: 0,
          draws: 0,
        })),
      ),
    );
    db.query(
      "UPDATE player_ratings SET rating = 1650 WHERE player_id = 'bravo' AND mode = 'fast'",
    );
    expect(tx(() => updateQueue(db, "alpha", "enter", "fast", base))).toEqual({
      status: "waiting",
      mode: "fast",
    });
    expect(
      tx(() => updateQueue(db, "charlie", "enter", "classic", base)),
    ).toEqual({ status: "waiting", mode: "classic" });
    expect(
      tx(() => updateQueue(db, "bravo", "enter", "fast", base + 1000)),
    ).toEqual({ status: "waiting", mode: "fast" });
    expect(
      tx(() => updateQueue(db, "bravo", "status", undefined, base + 9000))
        .status,
    ).toBe("waiting");
    expect(
      tx(() => updateQueue(db, "alpha", "status", undefined, base + 10_000))
        .status,
    ).toBe("waiting");
    const found = tx(() =>
      updateQueue(db, "bravo", "status", undefined, base + 11_000),
    );
    expect(found).toMatchObject({ status: "matched", mode: "fast" });
    if (found.status !== "matched") throw new Error("Expected a match");
    tx(() => acknowledgeMatch(db, "alpha", found.code));
    expect(
      tx(() => updateQueue(db, "alpha", "enter", "medium", base + 12_000)),
    ).toEqual(found);
    expect(
      tx(() => updateQueue(db, "charlie", "cancel", undefined, base + 12_000)),
    ).toEqual({ status: "idle" });
    expect(
      db.query("SELECT COUNT(*) AS count FROM ranked_matches").rows[0],
    ).toEqual({ count: 1 });
  });

  it("prefers the nearest eligible rating and ignores expired entries", () => {
    db.query(
      "UPDATE player_ratings SET rating = 1400 WHERE player_id = 'alpha' AND mode = 'fast'",
    );
    db.query(
      "UPDATE player_ratings SET rating = 1550 WHERE player_id = 'bravo' AND mode = 'fast'",
    );
    tx(() => updateQueue(db, "delta", "enter", "fast", base - 30_000));
    tx(() => updateQueue(db, "alpha", "enter", "fast", base));
    tx(() => updateQueue(db, "bravo", "enter", "fast", base + 1000));
    const found = tx(() =>
      updateQueue(db, "charlie", "enter", "fast", base + 1500),
    );
    if (found.status !== "matched")
      throw new Error("Expected the closest match");
    const match = rankedMatch(db, found.code);
    expect([match.orcas_id, match.sharks_id].sort()).toEqual([
      "bravo",
      "charlie",
    ]);
    expect(
      db.query(
        "SELECT account_id FROM matchmaking_queue WHERE account_id = 'delta'",
      ).rowCount,
    ).toBe(0);
  });

  it("increments only a committed move, keeps clocks running through disconnect and settles a draw once", () => {
    const { code, orcas, sharks } = pair();
    const initial = tx(() => readRoom(db, code, sharks, base + 1500));
    expect(() =>
      tx(() =>
        changeRoom(
          db,
          code,
          sharks,
          action(initial, {
            kind: "move",
            move: { kind: "place", to: "a1" },
          }),
          base + 1500,
        ),
      ),
    ).toThrow(/not legal/);
    const first = action(initial, {
      kind: "move",
      move: { kind: "place", to: "c3" },
    });
    const placed = tx(() => changeRoom(db, code, sharks, first, base + 1500));
    expect(placed.ranked?.remaining).toEqual({
      sharks: 183_500,
      orcas: 180_000,
    });
    const returned = tx(() =>
      changeRoom(db, code, sharks, first, base + 10_000),
    );
    expect(returned.ranked?.remaining).toEqual({
      sharks: 183_500,
      orcas: 171_500,
    });
    expect(returned.state.ply).toBe(1);
    expect(returned.opponentOnline).toBe(false);
    const offered = tx(() =>
      changeRoom(
        db,
        code,
        orcas,
        action(returned, { kind: "offer-draw" }),
        base + 14_000,
      ),
    );
    expect(offered.ranked?.remaining.orcas).toBe(167_500);
    const draw = action(offered, { kind: "accept-draw" });
    const finished = tx(() =>
      changeRoom(db, code, sharks, draw, base + 15_000),
    );
    expect(finished.ranked?.remaining.orcas).toBe(166_500);
    expect(finished.ending?.winner).toBe("draw");
    expect(
      tx(() => changeRoom(db, code, sharks, draw, base + 16_000)).ranked
        ?.remaining,
    ).toEqual(finished.ranked?.remaining);
    expect(
      leaderboard(db, "fast").map(({ rating, draws }) => [rating, draws]),
    ).toEqual([
      [1500, 1],
      [1500, 1],
    ]);
    expect(leaderboard(db, "medium")).toEqual([]);
    expect(playerProfile(db, orcas)?.history[0]).toMatchObject({
      opponent: sharks,
      mode: "fast",
      result: "Draw",
      delta: 0,
    });
    expect(() =>
      tx(() =>
        changeRoom(
          db,
          code,
          sharks,
          action(finished, { kind: "rematch" }),
          base + 16_000,
        ),
      ),
    ).toThrow(/Return to the lobby/);
  });

  it("settles an unattended timeout once and rejects a move submitted at the deadline", () => {
    const { code, orcas, sharks } = pair("medium");
    const before = tx(() => readRoom(db, code, sharks, base + 299_999));
    expect(before.ranked?.remaining.sharks).toBe(1);
    expect(() =>
      tx(() =>
        changeRoom(
          db,
          code,
          "charlie",
          action(before, { kind: "join" }),
          base + 300_000,
        ),
      ),
    ).toThrow(/seat/);
    const result = tx(() =>
      changeRoom(
        db,
        code,
        sharks,
        action(before, { kind: "move", move: { kind: "place", to: "c3" } }),
        base + 300_000,
      ),
    );
    expect(result.ending).toEqual({ winner: "orcas", reason: "Time expired" });
    expect(result.state.ply).toBe(0);
    expect(result.ranked?.remaining.sharks).toBe(0);
    tx(() => expireRankedRoom(db, code, base + 301_000));
    expect(
      leaderboard(db, "medium").map(({ username, rating, wins, losses }) => [
        username,
        rating,
        wins,
        losses,
      ]),
    ).toEqual([
      [orcas, 1516, 1, 0],
      [sharks, 1484, 0, 1],
    ]);
    expect(leaderboard(db, "fast")).toEqual([]);
    expect(
      db.query("SELECT code FROM games WHERE status = 'finished'").rows,
    ).toEqual([{ code }]);
    expect(db.query("SELECT game_code FROM game_rounds").rows).toEqual([
      { game_code: code },
    ]);
  });

  it("finalizes a clock without a connected browser and records a separate rules victory", () => {
    const unattended = pair("classic");
    tx(() => expireRankedRoom(db, unattended.code, base + 600_000));
    expect(
      tx(() => readRoom(db, unattended.code, unattended.orcas, base + 600_500))
        .ending?.reason,
    ).toBe("Time expired");
    tx(() => acknowledgeMatch(db, "alpha", unattended.code));
    tx(() => acknowledgeMatch(db, "bravo", unattended.code));
    const ranked = pair("fast");
    let room = tx(() => readRoom(db, ranked.code, ranked.orcas, base + 100));
    for (const [index, move] of (victories.sharks as Move[]).entries()) {
      const player =
        room.state.turn === "sharks" ? ranked.sharks : ranked.orcas;
      room = tx(() =>
        changeRoom(
          db,
          ranked.code,
          player,
          action(room, { kind: "move", move }),
          base + (index + 1) * 100,
        ),
      );
    }
    expect(room.ending?.winner).toBe("sharks");
    expect(leaderboard(db, "fast")[0]).toMatchObject({
      username: ranked.sharks,
      rating: 1516,
      wins: 1,
    });
    expect(leaderboard(db, "classic")[0]).toMatchObject({
      username: unattended.orcas,
      rating: 1516,
      wins: 1,
    });
  });
});
