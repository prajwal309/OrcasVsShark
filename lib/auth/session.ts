import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { read, type SqlClient } from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";

export const sessionCookie = "orcas_session";
export const sessionSeconds = 60 * 60 * 24 * 14;
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

function loopbackHttp(address: string) {
  try {
    const url = new URL(address);
    return url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

export function requireSameOrigin(
  request: Request,
  { allowLocalAddress = true } = {},
) {
  const configured = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const origin = request.headers.get("origin");
  if (origin === configured && configured.startsWith("https://")) return true;

  // Next.js may choose another port or normalize the URL's hostname. In local
  // HTTP mode, accept only the browser origin that matches the actual Host.
  const localOrigin = origin && loopbackHttp(origin);
  if (
    (allowLocalAddress || origin === configured) &&
    loopbackHttp(configured) &&
    localOrigin &&
    localOrigin.origin === origin &&
    localOrigin.host === request.headers.get("host") &&
    new URL(request.url).protocol === "http:"
  )
    return false;

  throw new RoomError(
    403,
    "INVALID_ORIGIN",
    `Open the game at ${configured} and try again.`,
  );
}

export function replaceSession(
  db: SqlClient,
  accountId: string,
  token: string,
  previous?: string,
) {
  if (previous)
    db.query("DELETE FROM account_sessions WHERE token_hash = $1", [
      hashToken(previous),
    ]);
  db.query(
    "INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, unixepoch('subsec') + $3)",
    [hashToken(token), accountId, sessionSeconds],
  );
}

export async function currentToken() {
  return (await cookies()).get(sessionCookie)?.value;
}

export async function sessionAccount() {
  const token = await currentToken();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return read((db) => {
    const { rows } = db.query<{ id: string; username: string }>(
      `SELECT a.id, a.username FROM account_sessions s
       JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = $1 AND s.expires_at > unixepoch('subsec')`,
      [hashToken(token)],
    );
    return rows[0] ?? null;
  });
}
