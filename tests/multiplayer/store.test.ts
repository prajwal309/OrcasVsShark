// @vitest-environment node
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { SqlClient } from "@/lib/database/connection";
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

const database = new PGlite();
const host = randomUUID(),
  guest = randomUUID(),
  stranger = randomUUID();
async function tx<T>(work: (db: SqlClient) => Promise<T>) {
  return database.transaction(async (client) =>
    work({
      async query<T>(sql: string, values?: unknown[]) {
        const result = await client.query(sql, values);
        return {
          rows: result.rows as T[],
          rowCount: result.affectedRows ?? result.rows.length,
        };
      },
    }),
  );
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
  await database.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE PUBLICATION supabase_realtime;`);
  await database.exec(
    readFileSync("supabase/migrations/202609280001_online_rooms.sql", "utf8"),
  );
  for (const actor of [host, guest, stranger])
    await database.query("INSERT INTO auth.users VALUES ($1)", [actor]);
}, 30000);
afterAll(async () => {
  await database.close();
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
    const rows = await database.query(
      "SELECT * FROM moves WHERE game_code=$1",
      [room.code],
    );
    expect(rows.rows).toHaveLength(1);
    await expect(
      database.query("UPDATE moves SET ply=3 WHERE game_code=$1", [room.code]),
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
          await database.query("SELECT * FROM game_rounds WHERE game_code=$1", [
            room.code,
          ])
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await database.query("SELECT * FROM moves WHERE game_code=$1", [
            room.code,
          ])
        ).rows,
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

  it("enforces RLS for nonparticipants and denies all direct browser writes", async () => {
    const room = await joined();
    await database.transaction(async (db) => {
      await db.exec("SET LOCAL ROLE authenticated");
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
        stranger,
      ]);
      expect(
        (await db.query("SELECT * FROM games WHERE code=$1", [room.code])).rows,
      ).toHaveLength(0);
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
        host,
      ]);
      expect(
        (await db.query("SELECT * FROM games WHERE code=$1", [room.code])).rows,
      ).toHaveLength(1);
    });
    await expect(
      database.transaction(async (db) => {
        await db.exec("SET LOCAL ROLE authenticated");
        await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [
          host,
        ]);
        await db.query("UPDATE games SET current_ply=999 WHERE code=$1", [
          room.code,
        ]);
      }),
    ).rejects.toThrow("permission denied");
  });

  it("reports disconnected opponents and restores presence without changing the game", async () => {
    const room = await joined();
    await database.query(
      "UPDATE games SET sharks_seen = now() - interval '1 minute' WHERE code=$1",
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
