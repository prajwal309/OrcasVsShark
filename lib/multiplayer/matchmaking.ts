import { randomUUID } from "node:crypto";
import type { SqlClient } from "@/lib/database/connection";
import { changeRoom, createRoom } from "./store";

export type QueueAction = "enter" | "status" | "cancel";
export type QueueState =
  { status: "idle" | "waiting" } | { status: "matched"; code: string };

export async function updateQueue(
  db: SqlClient,
  actor: string,
  action: QueueAction,
): Promise<QueueState> {
  // Keep selection and seating atomic across app instances. This two-key lock
  // occupies a separate namespace from the per-player room creation lock.
  await db.query("SELECT pg_advisory_xact_lock(825014, 1)");
  await db.query(
    "DELETE FROM public.matchmaking_queue WHERE expires_at <= clock_timestamp()",
  );
  const {
    rows: [current],
  } = await db.query<{ room_code: string | null }>(
    "SELECT room_code FROM public.matchmaking_queue WHERE account_id = $1",
    [actor],
  );
  if (current?.room_code) return { status: "matched", code: current.room_code };
  if (action === "cancel") {
    await db.query(
      "DELETE FROM public.matchmaking_queue WHERE account_id = $1",
      [actor],
    );
    return { status: "idle" };
  }
  if (!current && action === "status") return { status: "idle" };

  await db.query(
    `INSERT INTO public.matchmaking_queue (account_id, expires_at)
     VALUES ($1, clock_timestamp() + interval '20 seconds')
     ON CONFLICT (account_id) DO UPDATE SET expires_at = excluded.expires_at`,
    [actor],
  );
  const {
    rows: [opponent],
  } = await db.query<{ account_id: string }>(
    `SELECT account_id FROM public.matchmaking_queue
     WHERE account_id <> $1 AND room_code IS NULL AND expires_at > clock_timestamp()
     ORDER BY joined_at, account_id LIMIT 1`,
    [actor],
  );
  if (!opponent) return { status: "waiting" };

  const room = await createRoom(db, opponent.account_id, randomUUID());
  await changeRoom(db, room.code, actor, {
    requestId: randomUUID(),
    expectedPly: room.state.ply,
    expectedRevision: room.revision,
    action: { kind: "join" },
  });
  await db.query(
    `UPDATE public.matchmaking_queue
     SET room_code = $1, expires_at = clock_timestamp() + interval '10 minutes'
     WHERE account_id IN ($2, $3)`,
    [room.code, actor, opponent.account_id],
  );
  return { status: "matched", code: room.code };
}

export async function acknowledgeMatch(
  db: SqlClient,
  actor: string,
  code: string,
) {
  await db.query(
    "DELETE FROM public.matchmaking_queue WHERE account_id = $1 AND room_code = $2",
    [actor, code],
  );
}
