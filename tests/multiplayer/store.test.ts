// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { acknowledgeMatch, updateQueue } from "@/lib/multiplayer/matchmaking";
import { createAccount, googleAccount } from "@/lib/auth/accounts";
import { read, transaction } from "@/lib/database/connection";
import {
  createRoom,
  changeRoom,
  readRoom,
  rateLimit,
} from "@/lib/multiplayer/store";
import {
  requestSchema,
  type RoomRequest,
  type RoomView,
  type RoomAction,
} from "@/lib/multiplayer/protocol";
import type { Move } from "@/lib/game/types";
import victories from "../fixtures/victories.json";
import { setupPostgres } from "../fixtures/postgres";

setupPostgres();
const host = randomUUID(),
  guest = randomUUID(),
  stranger = randomUUID();
const tx = transaction;
async function query(sql: string, values?: (string | number | null)[]) {
  return read((db) => db.query(sql, values));
}
const request = (room: RoomView, action: RoomAction): RoomRequest => ({
  requestId: randomUUID(),
  expectedPly: room.state.ply,
  expectedRevision: room.revision,
  action,
});
async function joined() {
  const room = await tx((db) => createRoom(db, host, randomUUID()));
  return tx((db) =>
    changeRoom(db, room.code, guest, request(room, { kind: "join" })),
  );
}
beforeAll(async () => {
  for (const [index, actor] of [host, guest, stranger].entries())
    await query(
      "INSERT INTO accounts (id, username, email, password_hash) VALUES ($1, $2, $2 || '@example.test', 'fixture')",
      [actor, `player_${index}`],
    );
});
describe("authoritative PostgreSQL room operations", () => {
  it("creates a retry-safe room, reserves opposite seats and rejects a third player", async () => {
    const id = randomUUID();
    const first = await tx((db) => createRoom(db, host, id));
    expect(first.side).toBe("orcas");
    expect(first.waiting).toBe(true);
    expect((await tx((db) => createRoom(db, host, id))).code).toBe(first.code);
    await expect(
      tx((db) =>
        changeRoom(
          db,
          first.code,
          host,
          request(first, {
            kind: "move",
            move: { kind: "step", from: "a1", to: "a2" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "WAITING" });
    const second = await tx((db) =>
      changeRoom(db, first.code, guest, request(first, { kind: "join" })),
    );
    expect(second.side).toBe("sharks");
    expect(second.waiting).toBe(false);
    await expect(
      tx((db) =>
        changeRoom(db, first.code, stranger, request(second, { kind: "join" })),
      ),
    ).rejects.toMatchObject({ code: "ROOM_FULL" });
    await expect(
      tx((db) => readRoom(db, first.code, stranger)),
    ).rejects.toMatchObject({ code: "NOT_SEATED" });
  });

  it("validates turns, ownership, legality, stale ply and malformed requests", async () => {
    const room = await joined();
    const place = request(room, {
      kind: "move",
      move: { kind: "place", to: "c3" },
    });
    await expect(
      tx((db) => changeRoom(db, room.code, host, place)),
    ).rejects.toMatchObject({ code: "OUT_OF_TURN" });
    await expect(
      tx((db) => changeRoom(db, room.code, stranger, place)),
    ).rejects.toMatchObject({ code: "NOT_SEATED" });
    await expect(
      tx((db) =>
        changeRoom(
          db,
          room.code,
          guest,
          request(room, {
            kind: "move",
            move: { kind: "step", from: "a1", to: "a2" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "ILLEGAL_MOVE" });
    await expect(
      tx((db) =>
        changeRoom(
          db,
          room.code,
          guest,
          request(room, { kind: "move", move: { kind: "place", to: "a1" } }),
        ),
      ),
    ).rejects.toMatchObject({ code: "ILLEGAL_MOVE" });
    const next = await tx((db) => changeRoom(db, room.code, guest, place));
    expect(next.state.board.c3).toBe("shark");
    await expect(
      tx((db) =>
        changeRoom(
          db,
          room.code,
          host,
          request(room, {
            kind: "move",
            move: { kind: "step", from: "a1", to: "a2" },
          }),
        ),
      ),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
    expect(
      requestSchema.safeParse({
        ...place,
        action: { kind: "move", move: { kind: "place", to: "z9" } },
      }).success,
    ).toBe(false);
    expect(requestSchema.safeParse({ ...place, actor: host }).success).toBe(
      false,
    );
  });

  it("deduplicates retries without replaying a move and rejects ID reuse", async () => {
    const room = await joined();
    const action = request(room, {
      kind: "move",
      move: { kind: "place", to: "c3" },
    });
    const first = await tx((db) => changeRoom(db, room.code, guest, action));
    const retry = await tx((db) => changeRoom(db, room.code, guest, action));
    expect(retry.state).toEqual(first.state);
    expect(retry.state.ply).toBe(1);
    await expect(
      tx((db) =>
        changeRoom(db, room.code, guest, {
          ...action,
          action: { kind: "resign" },
        }),
      ),
    ).rejects.toMatchObject({ code: "REQUEST_REUSED" });
    const rows = await query("SELECT * FROM moves WHERE game_code=$1", [
      room.code,
    ]);
    expect(rows.rows).toHaveLength(1);
    await expect(
      query("UPDATE moves SET ply=3 WHERE game_code=$1", [room.code]),
    ).rejects.toThrow("append-only");
  });

  it("only accepts one of two actions against the same revision", async () => {
    const room = await joined();
    const results = await Promise.allSettled([
      tx((db) =>
        changeRoom(
          db,
          room.code,
          guest,
          request(room, { kind: "move", move: { kind: "place", to: "c3" } }),
        ),
      ),
      tx((db) =>
        changeRoom(
          db,
          room.code,
          guest,
          request(room, { kind: "move", move: { kind: "place", to: "b2" } }),
        ),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { code: "STALE_STATE" },
    });
    expect((await tx((db) => readRoom(db, room.code, host))).state.ply).toBe(1);
  });

  for (const side of ["orcas", "sharks"] as const)
    it(`persists complete ${side} victory for both players and archives rematches`, async () => {
      let room = await joined();
      for (const move of victories[side]) {
        const action = requestSchema.parse(
          request(room, { kind: "move", move: move as Move }),
        );
        room = await tx((db) =>
          changeRoom(
            db,
            room.code,
            room.state.turn === "sharks" ? guest : host,
            action,
          ),
        );
      }
      const restored = await tx((db) => readRoom(db, room.code, host));
      expect(restored.state).toEqual(room.state);
      expect(restored.ending?.winner).toBe(side);
      await expect(
        tx((db) =>
          changeRoom(
            db,
            room.code,
            guest,
            request(room, { kind: "move", move: { kind: "place", to: "c3" } }),
          ),
        ),
      ).rejects.toMatchObject({ code: "GAME_OVER" });
      room = await tx((db) =>
        changeRoom(db, room.code, host, request(room, { kind: "rematch" })),
      );
      expect(room.round).toBe(1);
      room = await tx((db) =>
        changeRoom(db, room.code, guest, request(room, { kind: "rematch" })),
      );
      expect(room.round).toBe(2);
      expect(room.side).toBe("orcas");
      expect(room.state.ply).toBe(0);
      expect(room.ending).toBeNull();
      expect(
        (
          await query("SELECT * FROM game_rounds WHERE game_code=$1", [
            room.code,
          ])
        ).rows,
      ).toHaveLength(1);
      expect(
        (await query("SELECT * FROM moves WHERE game_code=$1", [room.code]))
          .rows,
      ).toHaveLength(victories[side].length);
    });

  it("requires the opponent's draw agreement and allows either side to resign", async () => {
    let room = await joined();
    room = await tx((db) =>
      changeRoom(db, room.code, host, request(room, { kind: "offer-draw" })),
    );
    await expect(
      tx((db) =>
        changeRoom(db, room.code, host, request(room, { kind: "accept-draw" })),
      ),
    ).rejects.toMatchObject({ code: "NO_OFFER" });
    room = await tx((db) =>
      changeRoom(db, room.code, guest, request(room, { kind: "decline-draw" })),
    );
    expect(room.drawOffer).toBeNull();
    room = await tx((db) =>
      changeRoom(db, room.code, guest, request(room, { kind: "offer-draw" })),
    );
    room = await tx((db) =>
      changeRoom(db, room.code, host, request(room, { kind: "accept-draw" })),
    );
    expect(room.ending).toEqual({
      winner: "draw",
      reason: "Draw by agreement",
    });
    room = await joined();
    room = await tx((db) =>
      changeRoom(db, room.code, host, request(room, { kind: "resign" })),
    );
    expect(room.ending).toEqual({ winner: "sharks", reason: "Resignation" });
  });

  it("enforces foreign keys for accounts", async () => {
    await expect(
      query(
        "INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, $3)",
        ["invalid-session", randomUUID(), Date.now() / 1000 + 60],
      ),
    ).rejects.toThrow(/foreign key/i);
  });

  it("reports disconnected opponents and restores presence without changing the game", async () => {
    const room = await joined();
    await query(
      "UPDATE games SET sharks_seen = EXTRACT(EPOCH FROM clock_timestamp()) - 60 WHERE code=$1",
      [room.code],
    );
    const disconnected = await tx((db) => readRoom(db, room.code, host));
    expect(disconnected.opponentOnline).toBe(false);
    expect(disconnected.state).toEqual(room.state);
    await tx((db) => readRoom(db, room.code, guest));
    const restored = await tx((db) => readRoom(db, room.code, host));
    expect(restored.opponentOnline).toBe(true);
    expect(restored.state).toEqual(room.state);
  });

  it("rate limits actors in persistent database buckets", async () => {
    await tx((db) => rateLimit(db, host, "test", 1));
    await expect(
      tx((db) => rateLimit(db, host, "test", 1)),
    ).rejects.toMatchObject({ status: 429 });
  });
});

it("expires inactive queue entries and reuses one durable match for repeated requests", async () => {
  expect(await tx((db) => updateQueue(db, host, "enter"))).toEqual({
    status: "waiting",
  });
  await query(
    "UPDATE matchmaking_queue SET expires_at = EXTRACT(EPOCH FROM clock_timestamp()) - 1 WHERE account_id = $1",
    [host],
  );
  expect(await tx((db) => updateQueue(db, guest, "enter"))).toEqual({
    status: "waiting",
  });
  expect(await tx((db) => updateQueue(db, guest, "status"))).toEqual({
    status: "waiting",
  });
  const match = await tx((db) => updateQueue(db, stranger, "enter"));
  expect(match.status).toBe("matched");
  if (match.status !== "matched") return;
  expect(await tx((db) => updateQueue(db, guest, "cancel"))).toEqual(match);
  expect(await tx((db) => updateQueue(db, stranger, "enter"))).toEqual(match);
  const guestRoom = await tx((db) => readRoom(db, match.code, guest));
  expect(guestRoom.waiting).toBe(false);
  expect(guestRoom.side).toBe("orcas");
  expect((await tx((db) => readRoom(db, match.code, stranger))).side).toBe(
    "sharks",
  );
  await tx((db) => acknowledgeMatch(db, guest, match.code));
  expect(await tx((db) => updateQueue(db, guest, "status"))).toEqual({
    status: "idle",
  });
  expect(await tx((db) => updateQueue(db, stranger, "status"))).toEqual(match);
});

it("requires an invitation for the first Google sign-in and never links by username", async () => {
  const subject = "google-test-subject";
  const invitationHash = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO account_invites VALUES ($1, EXTRACT(EPOCH FROM clock_timestamp()) + 3600, NULL)",
    [invitationHash],
  );
  await expect(
    tx((db) => googleAccount(db, subject, "google@example.test")),
  ).rejects.toMatchObject({
    code: "GOOGLE_SIGNUP_REQUIRED",
  });
  await expect(
    tx((db) =>
      googleAccount(db, subject, "google@example.test", {
        username: "player_0",
        invitationHash,
      }),
    ),
  ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
  const id = await tx((db) =>
    googleAccount(db, subject, "google@example.test", {
      username: "google_player",
      invitationHash,
    }),
  );
  expect(id).not.toBe(host);
  expect(
    await tx((db) => googleAccount(db, subject, "google@example.test")),
  ).toBe(id);
  await expect(
    tx((db) =>
      createAccount(
        db,
        "different_player",
        "different@example.test",
        invitationHash,
        {
          passwordHash: "fixture",
        },
      ),
    ),
  ).rejects.toMatchObject({ code: "INVALID_INVITE" });

  const passwordInvite = randomBytes(32).toString("hex");
  await query(
    "INSERT INTO account_invites VALUES ($1, EXTRACT(EPOCH FROM clock_timestamp()) + 3600, NULL)",
    [passwordInvite],
  );
  await expect(
    tx((db) =>
      createAccount(
        db,
        "google_player",
        "another@example.test",
        passwordInvite,
        {
          passwordHash: "fixture",
        },
      ),
    ),
  ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
  expect(
    await tx((db) =>
      createAccount(
        db,
        "different_player",
        "different@example.test",
        passwordInvite,
        {
          passwordHash: "fixture",
        },
      ),
    ),
  ).toBeTruthy();
});
