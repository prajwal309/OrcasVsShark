import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { transaction } from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";

export const sessionCookie = "orcas_session";
export const sessionSeconds = 60 * 60 * 24 * 14;
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export function requireSameOrigin(request: Request) {
  const origin = process.env.APP_ORIGIN ?? "http://localhost:3000";
  if (request.headers.get("origin") !== origin)
    throw new RoomError(
      403,
      "INVALID_ORIGIN",
      "Open the game at its configured address.",
    );
  return origin.startsWith("https://");
}

export async function currentToken() {
  return (await cookies()).get(sessionCookie)?.value;
}

export async function sessionAccount() {
  if (!process.env.DATABASE_URL)
    throw new RoomError(
      503,
      "NOT_CONFIGURED",
      "Online play is unavailable. Local play is available.",
    );
  const token = await currentToken();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return transaction(async (db) => {
    const { rows } = await db.query<{ id: string; username: string }>(
      `SELECT a.id, a.username FROM account_sessions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = $1 AND s.expires_at > now()`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  });
}
