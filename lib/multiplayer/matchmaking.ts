import { randomUUID } from "node:crypto";
import type { SqlClient } from "@/lib/database/connection";
import { changeRoom, createRoom } from "./store";

export type QueueAction = "enter" | "status" | "cancel";
export type QueueState =
  { status: "idle" | "waiting" } | { status: "matched"; code: string };

export function updateQueue(
  db: SqlClient,
  actor: string,
  action: QueueAction,
): QueueState {
  db.query(
    "DELETE FROM matchmaking_queue WHERE expires_at <= unixepoch('subsec')",
  );
  const {
    rows: [current],
  } = db.query<{ room_code: string | null }>(
    "SELECT room_code FROM matchmaking_queue WHERE account_id = $1",
    [actor],
  );
  if (current?.room_code) return { status: "matched", code: current.room_code };
  if (action === "cancel") {
    db.query("DELETE FROM matchmaking_queue WHERE account_id = $1", [actor]);
    return { status: "idle" };
  }
  if (!current && action === "status") return { status: "idle" };

  db.query(
    `INSERT INTO matchmaking_queue (account_id, expires_at)
     VALUES ($1, unixepoch('subsec') + 20)
     ON CONFLICT (account_id) DO UPDATE SET expires_at = excluded.expires_at`,
    [actor],
  );
  const {
    rows: [opponent],
  } = db.query<{ account_id: string }>(
    `SELECT account_id FROM matchmaking_queue
     WHERE account_id <> $1 AND room_code IS NULL AND expires_at > unixepoch('subsec')
     ORDER BY joined_at, account_id LIMIT 1`,
    [actor],
  );
  if (!opponent) return { status: "waiting" };

  const room = createRoom(db, opponent.account_id, randomUUID());
  changeRoom(db, room.code, actor, {
    requestId: randomUUID(),
    expectedPly: room.state.ply,
    expectedRevision: room.revision,
    action: { kind: "join" },
  });
  db.query(
    `UPDATE matchmaking_queue
     SET room_code = $1, expires_at = unixepoch('subsec') + 600
     WHERE account_id IN ($2, $3)`,
    [room.code, actor, opponent.account_id],
  );
  return { status: "matched", code: room.code };
}

export function acknowledgeMatch(db: SqlClient, actor: string, code: string) {
  db.query(
    "DELETE FROM matchmaking_queue WHERE account_id = $1 AND room_code = $2",
    [actor, code],
  );
}
