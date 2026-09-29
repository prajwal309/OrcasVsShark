import { randomInt } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { SqlClient } from "@/lib/database/connection";
import { createInitialState } from "@/lib/game/initial-state";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import {
  RoomError,
  sideOf,
  type Room,
  type RoomRequest,
  type RoomView,
} from "./protocol";
import { transition } from "./transition";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type Row = { data: Room; orcas_seen: Date | null; sharks_seen: Date | null };

// Database-backed counters work across server instances. Expired buckets are reused.
export async function rateLimit(
  db: SqlClient,
  actor: string,
  bucket: string,
  limit: number,
) {
  const { rows } = await db.query<{ hits: number }>(
    `
    INSERT INTO public.room_rate_limits (actor, bucket, starts_at, hits)
    VALUES ($1, $2, now(), 1)
    ON CONFLICT (actor, bucket) DO UPDATE SET
      hits = CASE WHEN room_rate_limits.starts_at < now() - interval '1 minute' THEN 1 ELSE room_rate_limits.hits + 1 END,
      starts_at = CASE WHEN room_rate_limits.starts_at < now() - interval '1 minute' THEN now() ELSE room_rate_limits.starts_at END
    RETURNING hits`,
    [actor, bucket],
  );
  if (rows[0].hits > limit)
    throw new RoomError(
      429,
      "RATE_LIMIT",
      "Too many requests. Please wait a minute.",
    );
}

export async function createRoom(
  db: SqlClient,
  actor: string,
  requestId: string,
): Promise<RoomView> {
  // Serialize creation for an actor to make retries safe even across server instances.
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))", [actor]);
  const previous = await db.query<{ code: string }>(
    "SELECT code FROM public.games WHERE created_by = $1 AND create_request_id = $2",
    [actor, requestId],
  );
  if (previous.rows[0]) return readRoom(db, previous.rows[0].code, actor);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = Array.from(
      { length: 8 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
    const room: Room = {
      code,
      orcas: actor,
      sharks: null,
      state: createInitialState(),
      moves: [],
      ending: null,
      revision: 0,
      round: 1,
      drawOffer: null,
      rematchOffer: null,
    };
    const inserted = await db.query(
      `INSERT INTO public.games (code, orcas_id, created_by, data, create_request_id, orcas_seen)
      VALUES ($1, $2, $2, $3, $4, now()) ON CONFLICT (code) DO NOTHING RETURNING code`,
      [code, actor, JSON.stringify(room), requestId],
    );
    if (inserted.rowCount) return view(room, actor, null);
  }
  throw new RoomError(
    503,
    "CODE_BUSY",
    "Could not create a room. Please try again.",
  );
}

function view(room: Room, actor: string, seen: Date | null): RoomView {
  const side = sideOf(room, actor);
  if (!side) throw new RoomError(403, "NOT_SEATED", "Join this room to play.");
  const { orcas: _orcas, sharks: _sharks, ...publicRoom } = room;
  void _orcas;
  void _sharks;
  return {
    ...publicRoom,
    side,
    waiting: !room.sharks,
    opponentOnline: !!seen && Date.now() - new Date(seen).getTime() < 35000,
  };
}

async function load(db: SqlClient, code: string, lock = false): Promise<Row> {
  const { rows } = await db.query<Row>(
    `SELECT data, orcas_seen, sharks_seen FROM public.games WHERE code = $1${lock ? " FOR UPDATE" : ""}`,
    [code],
  );
  if (!rows[0])
    throw new RoomError(
      404,
      "NOT_FOUND",
      "Room not found. Check the room code.",
    );
  const row = rows[0];
  // Validate persisted engine state before using it for authority.
  row.data.state = deserializeState(
    JSON.stringify({ version: 1, state: row.data.state }),
  );
  return row;
}

export async function readRoom(
  db: SqlClient,
  code: string,
  actor: string,
): Promise<RoomView> {
  const row = await load(db, code);
  const side = sideOf(row.data, actor);
  if (!side) throw new RoomError(403, "NOT_SEATED", "Join this room to play.");
  await db.query(
    `UPDATE public.games SET ${side === "orcas" ? "orcas_seen" : "sharks_seen"} = now() WHERE code = $1`,
    [code],
  );
  return view(
    row.data,
    actor,
    side === "orcas" ? row.sharks_seen : row.orcas_seen,
  );
}

export async function changeRoom(
  db: SqlClient,
  code: string,
  actor: string,
  request: RoomRequest,
): Promise<RoomView> {
  const row = await load(db, code, true);
  const room = row.data;
  const previous = await db.query<{ payload: RoomRequest }>(
    "SELECT payload FROM public.room_requests WHERE game_code = $1 AND actor = $2 AND request_id = $3",
    [code, actor, request.requestId],
  );
  if (previous.rows[0]) {
    if (!isDeepStrictEqual(previous.rows[0].payload, request))
      throw new RoomError(
        409,
        "REQUEST_REUSED",
        "This request ID was already used for another action.",
      );
    return view(
      room,
      actor,
      sideOf(room, actor) === "orcas" ? row.sharks_seen : row.orcas_seen,
    );
  }
  const next = transition(room, actor, request);
  serializeState(next.state);
  if (request.action.kind === "move") {
    await db.query(
      `INSERT INTO public.moves (game_code, round, ply, actor, move, request_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        code,
        next.round,
        next.state.ply,
        actor,
        JSON.stringify(request.action.move),
        request.requestId,
      ],
    );
  }
  const rematched = next.round !== room.round;
  if (next.ending && !room.ending) {
    await db.query(
      "INSERT INTO public.game_rounds (game_code, round, data) VALUES ($1,$2,$3)",
      [code, next.round, JSON.stringify(next)],
    );
  }
  await db.query(
    `UPDATE public.games SET data=$2, orcas_id=$3, sharks_id=$4, revision=$5, current_ply=$6,
    result=$7, updated_at=now(), orcas_seen=$8, sharks_seen=$9 WHERE code=$1`,
    [
      code,
      JSON.stringify(next),
      next.orcas,
      next.sharks,
      next.revision,
      next.state.ply,
      JSON.stringify(next.ending),
      next.orcas === actor
        ? new Date()
        : rematched
          ? row.sharks_seen
          : row.orcas_seen,
      next.sharks === actor
        ? new Date()
        : rematched
          ? row.orcas_seen
          : row.sharks_seen,
    ],
  );
  await db.query(
    "INSERT INTO public.room_requests (game_code, actor, request_id, payload) VALUES ($1,$2,$3,$4)",
    [code, actor, request.requestId, JSON.stringify(request)],
  );
  return view(
    next,
    actor,
    sideOf(room, actor) === "orcas" ? row.sharks_seen : row.orcas_seen,
  );
}
