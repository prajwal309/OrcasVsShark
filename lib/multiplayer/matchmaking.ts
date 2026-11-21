import { randomInt, randomUUID } from "node:crypto";
import type { SqlClient } from "@/lib/database/connection";
import { changeRoom, createRoom } from "./store";
import { activeRankedMatch, startRankedMatch } from "./ratings-store";
import { ratingWindow, type MatchMode, type RankedMode } from "./ranking";

export type QueueAction = "enter" | "status" | "cancel";
export type QueueState =
  | { status: "idle" }
  | { status: "waiting"; mode?: RankedMode }
  | { status: "matched"; code: string; mode?: RankedMode };

type QueueEntry = {
  mode: MatchMode;
  joined_at: number;
  room_code: string | null;
};

function modeField(mode: MatchMode) {
  return mode === "casual" ? {} : { mode };
}

export function updateQueue(
  db: SqlClient,
  actor: string,
  action: QueueAction,
  requested?: MatchMode,
  now = Date.now(),
): QueueState {
  const seconds = now / 1000;
  db.query("DELETE FROM matchmaking_queue WHERE expires_at <= $1", [seconds]);
  const current = db.query<QueueEntry>(
    "SELECT mode, joined_at, room_code FROM matchmaking_queue WHERE account_id = $1",
    [actor],
  ).rows[0];
  if (current?.room_code)
    return {
      status: "matched",
      code: current.room_code,
      ...modeField(current.mode),
    };
  const ranked = activeRankedMatch(db, actor);
  if (ranked)
    return { status: "matched", code: ranked.game_code, mode: ranked.mode };
  if (action === "cancel") {
    db.query("DELETE FROM matchmaking_queue WHERE account_id = $1", [actor]);
    return { status: "idle" };
  }
  if (!current && action === "status") return { status: "idle" };

  const mode = action === "enter" ? (requested ?? "casual") : current.mode;
  const joined = current?.mode === mode ? current.joined_at : seconds;
  db.query(
    `INSERT INTO matchmaking_queue (account_id, mode, joined_at, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (account_id) DO UPDATE SET mode = excluded.mode,
       joined_at = excluded.joined_at, expires_at = excluded.expires_at`,
    [actor, mode, joined, seconds + 20],
  );

  const opponent =
    mode === "casual"
      ? db.query<{ account_id: string }>(
          `SELECT account_id FROM matchmaking_queue
         WHERE account_id <> $1 AND mode = 'casual' AND room_code IS NULL
         ORDER BY joined_at, account_id LIMIT 1`,
          [actor],
        ).rows[0]
      : db
          .query<{ account_id: string; joined_at: number; distance: number }>(
            `SELECT q.account_id, q.joined_at, abs(candidate.rating - own.rating) AS distance
         FROM matchmaking_queue q
           JOIN player_ratings candidate ON candidate.player_id = q.account_id AND candidate.mode = q.mode
           JOIN player_ratings own ON own.player_id = $1 AND own.mode = q.mode
         WHERE q.account_id <> $1 AND q.mode = $2 AND q.room_code IS NULL
           AND abs(candidate.rating - own.rating) <= $3
           AND NOT EXISTS (
             SELECT 1 FROM ranked_matches m WHERE m.ended_at IS NULL
               AND (m.orcas_id = q.account_id OR m.sharks_id = q.account_id)
           )
         ORDER BY distance, q.joined_at, q.account_id`,
            [actor, mode, ratingWindow(now - Math.round(joined * 1000))],
          )
          .rows.find(
            ({ joined_at, distance }) =>
              distance <= ratingWindow(now - Math.round(joined_at * 1000)),
          );
  if (!opponent) return { status: "waiting", ...modeField(mode) };

  const [orcas, sharks] =
    mode !== "casual" && randomInt(2) === 0
      ? [actor, opponent.account_id]
      : [opponent.account_id, actor];
  const room = createRoom(db, orcas, randomUUID(), now);
  changeRoom(
    db,
    room.code,
    sharks,
    {
      requestId: randomUUID(),
      expectedPly: room.state.ply,
      expectedRevision: room.revision,
      action: { kind: "join" },
    },
    now,
  );
  if (mode !== "casual")
    startRankedMatch(db, room.code, mode, orcas, sharks, now);
  db.query(
    `UPDATE matchmaking_queue SET room_code = $1, expires_at = $4
     WHERE account_id IN ($2, $3)`,
    [room.code, actor, opponent.account_id, seconds + 600],
  );
  return { status: "matched", code: room.code, ...modeField(mode) };
}

export function acknowledgeMatch(db: SqlClient, actor: string, code: string) {
  db.query(
    "DELETE FROM matchmaking_queue WHERE account_id = $1 AND room_code = $2",
    [actor, code],
  );
}
