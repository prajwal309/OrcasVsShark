import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  read,
  readIfAvailable,
  type SqlClient,
} from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";
import { appOrigin } from "@/lib/deployment";

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
  const configured = appOrigin().origin;
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

export async function replaceSession(
  db: SqlClient,
  accountId: string,
  token: string,
  previous?: string,
) {
  if (previous)
    await db.query("DELETE FROM account_sessions WHERE token_hash = $1", [
      hashToken(previous),
    ]);
  await db.query(
    "INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES ($1, $2, EXTRACT(EPOCH FROM clock_timestamp()) + $3)",
    [hashToken(token), accountId, sessionSeconds],
  );
}

export async function currentToken() {
  return (await cookies()).get(sessionCookie)?.value;
}

export async function sessionAccount({ allowUnavailable = false } = {}) {
  const token = await currentToken();
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const lookup = async (db: SqlClient) => {
    const session = await db.account_sessions.findUnique({
      where: {
        token_hash: hashToken(token),
        expires_at: { gt: Date.now() / 1000 },
      },
      select: {
        accounts: {
          select: { id: true, username: true, is_guest: true },
        },
      },
    });
    return session?.accounts ?? null;
  };
  return (
    (await (allowUnavailable ? readIfAvailable(lookup) : read(lookup))) ?? null
  );
}

// Share one account lookup across server components in the current render.
export const pageSessionAccount = cache(() =>
  sessionAccount({ allowUnavailable: true }),
);
