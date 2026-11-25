import { randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import {
  hashToken,
  currentToken,
  replaceSession,
  sessionCookie,
  sessionSeconds,
  requireSameOrigin,
} from "@/lib/auth/session";
import { transaction } from "@/lib/database/connection";
import { readJson, respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return respond(async () => {
    const secure = requireSameOrigin(request);
    const body = await readJson(request);
    if (!body || typeof body !== "object" || Object.keys(body).length !== 0)
      throw new RoomError(400, "INVALID_BODY", "Invalid guest request.");

    const forwarded = request.headers.get("x-forwarded-for");
    const address =
      request.headers.get("x-real-ip") ??
      forwarded?.split(",").at(-1)?.trim() ??
      "unknown";
    const bucket = `guest:${hashToken(address).slice(0, 40)}`;
    const previous = await currentToken();
    const token = randomBytes(32).toString("hex");
    const account = await transaction(async (db) => {
      await db.query(
        `DELETE FROM account_rate_limits
         WHERE bucket LIKE 'guest:%'
           AND starts_at < EXTRACT(EPOCH FROM clock_timestamp()) - 86400`,
      );
      const { rows: limits } = await db.query<{ hits: number }>(
        `INSERT INTO account_rate_limits (bucket, starts_at, hits)
         VALUES ($1, EXTRACT(EPOCH FROM clock_timestamp()), 1)
         ON CONFLICT (bucket) DO UPDATE SET
           hits = CASE WHEN account_rate_limits.starts_at <= EXTRACT(EPOCH FROM clock_timestamp()) - 60
             THEN 1 ELSE account_rate_limits.hits + 1 END,
           starts_at = CASE WHEN account_rate_limits.starts_at <= EXTRACT(EPOCH FROM clock_timestamp()) - 60
             THEN EXTRACT(EPOCH FROM clock_timestamp()) ELSE account_rate_limits.starts_at END
         RETURNING hits`,
        [bucket],
      );
      if (limits[0].hits > 8)
        throw new RoomError(
          429,
          "GUEST_RATE_LIMIT",
          "Too many guest sessions. Try again in a minute.",
        );

      for (let attempt = 0; attempt < 5; attempt++) {
        const id = randomUUID();
        const username = `guest_${randomBytes(6).toString("hex")}`;
        const email = `${id}@guest.invalid`;
        const inserted = await db.query(
          `INSERT INTO accounts (id, username, email, is_guest)
           VALUES ($1, $2, $3, TRUE) ON CONFLICT DO NOTHING`,
          [id, username, email],
        );
        if (!inserted.rowCount) continue;
        await replaceSession(db, id, token, previous);
        return { id, username };
      }
      throw new RoomError(
        503,
        "GUEST_UNAVAILABLE",
        "Could not create a guest session. Please try again.",
      );
    });

    const jar = await cookies();
    jar.set(sessionCookie, token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: sessionSeconds,
    });
    return { username: account.username, isGuest: true };
  });
}
