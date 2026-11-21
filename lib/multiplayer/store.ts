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
import { advanceClock, clockAt } from "./ranking";
import {
  finishRankedMatch,
  matchClock,
  rankedMatch,
  rankedView,
  saveClock,
  type RankedMatch,
} from "./ratings-store";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
type Row = {
  data: Room;
  orcas_seen: number | null;
  sharks_seen: number | null;
};

// Expired rate-limit buckets are reused.
export async function rateLimit(
  db: SqlClient,
  actor: string,
  bucket: string,
  limit: number,
) {
  const { rows } = await db.query<{ hits: number }>(
    `
    INSERT INTO room_rate_limits (actor, bucket, starts_at, hits)
    VALUES ($1, $2, EXTRACT(EPOCH FROM clock_timestamp()), 1)
    ON CONFLICT (actor, bucket) DO UPDATE SET
      hits = CASE WHEN room_rate_limits.starts_at < EXTRACT(EPOCH FROM clock_timestamp()) - 60 THEN 1 ELSE room_rate_limits.hits + 1 END,
      starts_at = CASE WHEN room_rate_limits.starts_at < EXTRACT(EPOCH FROM clock_timestamp()) - 60 THEN EXTRACT(EPOCH FROM clock_timestamp()) ELSE room_rate_limits.starts_at END
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
  now = Date.now(),
): Promise<RoomView> {
  const findPrevious = async () =>
    (
      await db.query<{ code: string }>(
        "SELECT code FROM games WHERE created_by = $1 AND create_request_id = $2",
        [actor, requestId],
      )
    ).rows[0];
  const previous = await findPrevious();
  if (previous) return readRoom(db, previous.code, actor, now);
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
      `INSERT INTO games (code, orcas_id, created_by, data, create_request_id, orcas_seen)
      VALUES ($1, $2, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING code`,
      [code, actor, JSON.stringify(room), requestId, now / 1000],
    );
    if (inserted.rowCount) return view(room, actor, null);
    const existing = await findPrevious();
    if (existing) return readRoom(db, existing.code, actor, now);
  }
  throw new RoomError(
    503,
    "CODE_BUSY",
    "Could not create a room. Please try again.",
  );
}

function view(
  room: Room,
  actor: string,
  seen: number | null,
  match?: RankedMatch,
  now = Date.now(),
): RoomView {
  const side = sideOf(room, actor);
  if (!side) throw new RoomError(403, "NOT_SEATED", "Join this room to play.");
  const { orcas: _orcas, sharks: _sharks, ...publicRoom } = room;
  void _orcas;
  void _sharks;
  return {
    ...publicRoom,
    side,
    waiting: !room.sharks,
    opponentOnline:
      seen !== null && now - seen * 1000 < (match ? 6000 : 35_000),
    ...(match && { ranked: rankedView(match, room.state.turn, now) }),
  };
}

async function load(db: SqlClient, code: string): Promise<Row> {
  const { rows } = await db.query<Omit<Row, "data"> & { data: string }>(
    `SELECT data, orcas_seen, sharks_seen FROM games WHERE code = $1 FOR UPDATE`,
    [code],
  );
  if (!rows[0])
    throw new RoomError(
      404,
      "NOT_FOUND",
      "Room not found. Check the room code.",
    );
  const row = { ...rows[0], data: JSON.parse(rows[0].data) as Room };
  // Validate persisted engine state before using it for authority.
  row.data.state = deserializeState(
    JSON.stringify({ version: 1, state: row.data.state }),
  );
  return row;
}

async function saveRoom(
  db: SqlClient,
  room: Room,
  orcasSeen: number | null,
  sharksSeen: number | null,
) {
  await db.query(
    `UPDATE games SET data=$2, orcas_id=$3, sharks_id=$4, revision=$5, current_ply=$6,
     result=$7, updated_at=EXTRACT(EPOCH FROM clock_timestamp()), orcas_seen=$8, sharks_seen=$9 WHERE code=$1`,
    [
      room.code,
      JSON.stringify(room),
      room.orcas,
      room.sharks,
      room.revision,
      room.state.ply,
      JSON.stringify(room.ending),
      orcasSeen,
      sharksSeen,
    ],
  );
}

async function archiveRound(db: SqlClient, room: Room) {
  await db.query(
    "INSERT INTO game_rounds (game_code, round, data) VALUES ($1,$2,$3)",
    [room.code, room.round, JSON.stringify(room)],
  );
}

async function settleTimeout(
  db: SqlClient,
  row: Row,
  match: RankedMatch | undefined,
  now: number,
): Promise<Room | undefined> {
  if (match?.deadline == null || match.deadline > now) return;
  const room = row.data;
  const ending = {
    winner:
      room.state.turn === "orcas" ? ("sharks" as const) : ("orcas" as const),
    reason: "Time expired",
  };
  const finished = {
    ...room,
    ending,
    drawOffer: null,
    revision: room.revision + 1,
  };
  const remaining = clockAt(matchClock(match), room.state.turn, match.deadline);
  await finishRankedMatch(
    db,
    room.code,
    match,
    { remaining, deadline: null },
    ending,
    match.deadline,
  );
  await archiveRound(db, finished);
  await saveRoom(db, finished, row.orcas_seen, row.sharks_seen);
  return finished;
}

export async function expireRankedRoom(
  db: SqlClient,
  code: string,
  now: number,
) {
  const row = await load(db, code);
  const match = await rankedMatch(db, code);
  return (await settleTimeout(db, row, match, now)) !== undefined;
}

export async function readRoom(
  db: SqlClient,
  code: string,
  actor: string,
  now = Date.now(),
): Promise<RoomView> {
  const row = await load(db, code);
  const side = sideOf(row.data, actor);
  const match = await rankedMatch(db, code);
  if (!side)
    throw new RoomError(
      403,
      match ? "RANKED_SEAT_REQUIRED" : "NOT_SEATED",
      match
        ? "Only the matched players can enter this ranked game."
        : "Join this room to play.",
    );
  const finished = await settleTimeout(db, row, match, now);
  await db.query(
    `UPDATE games SET ${side === "orcas" ? "orcas_seen" : "sharks_seen"} = $2 WHERE code = $1`,
    [code, now / 1000],
  );
  return view(
    finished ?? row.data,
    actor,
    side === "orcas" ? row.sharks_seen : row.orcas_seen,
    finished ? await rankedMatch(db, code) : match,
    now,
  );
}

export async function changeRoom(
  db: SqlClient,
  code: string,
  actor: string,
  request: RoomRequest,
  now = Date.now(),
): Promise<RoomView> {
  const row = await load(db, code);
  const room = row.data;
  const side = sideOf(room, actor);
  const match = await rankedMatch(db, code);
  if (match && !side)
    throw new RoomError(
      403,
      "NOT_SEATED",
      "You do not have a seat in this ranked game.",
    );
  const seen = side === "orcas" ? row.sharks_seen : row.orcas_seen;
  const timedOut = await settleTimeout(db, row, match, now);
  if (timedOut)
    return view(timedOut, actor, seen, await rankedMatch(db, code), now);

  const previous = await db.query<{ payload: string }>(
    "SELECT payload FROM room_requests WHERE game_code = $1 AND actor = $2 AND request_id = $3",
    [code, actor, request.requestId],
  );
  if (previous.rows[0]) {
    if (!isDeepStrictEqual(JSON.parse(previous.rows[0].payload), request))
      throw new RoomError(
        409,
        "REQUEST_REUSED",
        "This request ID was already used for another action.",
      );
    return view(room, actor, seen, match, now);
  }
  if (match && request.action.kind === "rematch")
    throw new RoomError(
      409,
      "RANKED_REMATCH",
      "Return to the lobby to find another ranked game.",
    );

  const next = transition(room, actor, request);
  serializeState(next.state);
  const isMove = request.action.kind === "move";
  if (request.action.kind === "move") {
    await db.query(
      "INSERT INTO moves (game_code, round, ply, actor, move, request_id) VALUES ($1,$2,$3,$4,$5,$6)",
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
  const finished = room.ending ? null : next.ending;
  if (finished) await archiveRound(db, next);
  if (match && (isMove || finished)) {
    const clock = matchClock(match);
    const updatedClock = isMove
      ? advanceClock(
          clock,
          match.mode,
          room.state.turn,
          next.state.turn,
          now,
          !!finished,
        )
      : { remaining: clockAt(clock, room.state.turn, now), deadline: null };
    if (finished)
      await finishRankedMatch(db, code, match, updatedClock, finished, now);
    else await saveClock(db, code, updatedClock);
  }
  const rematched = next.round !== room.round;
  await saveRoom(
    db,
    next,
    next.orcas === actor
      ? now / 1000
      : rematched
        ? row.sharks_seen
        : row.orcas_seen,
    next.sharks === actor
      ? now / 1000
      : rematched
        ? row.orcas_seen
        : row.sharks_seen,
  );
  await db.query(
    "INSERT INTO room_requests (game_code, actor, request_id, payload) VALUES ($1,$2,$3,$4)",
    [code, actor, request.requestId, JSON.stringify(request)],
  );
  return view(
    next,
    actor,
    seen,
    match && (isMove || finished) ? await rankedMatch(db, code) : match,
    now,
  );
}
