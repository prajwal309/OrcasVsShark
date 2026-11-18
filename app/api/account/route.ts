import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  currentToken,
  hashToken,
  requireSameOrigin,
  sessionAccount,
  sessionCookie,
  sessionSeconds,
} from "@/lib/auth/session";
import {
  createAccount,
  invalidInvitation,
  invitationSchema as invitation,
  usernameSchema as username,
} from "@/lib/auth/accounts";
import { transaction } from "@/lib/database/connection";
import { readJson, respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";
const password = z.string().min(12).max(128);
const input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("login"), username, password }),
  z.strictObject({
    action: z.literal("register"),
    username,
    password,
    invitation,
  }),
  z.strictObject({ action: z.literal("reset"), password, invitation }),
  z.strictObject({ action: z.literal("logout") }),
]);
const invalid = () =>
  new RoomError(401, "INVALID_LOGIN", "Check your username or password.");

let activeHashes = 0;
async function derive(secret: string, salt: string): Promise<Buffer> {
  if (activeHashes >= 2)
    throw new RoomError(429, "SLOW_DOWN", "Please try again shortly.");
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        secret,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      );
    });
  } finally {
    activeHashes--;
  }
}

async function limit(bucket: string, maximum: number) {
  const hits = await transaction(async (db) => {
    const { rows } = await db.query<{ hits: number }>(
      `INSERT INTO account_rate_limits VALUES ($1, now(), 1)
       ON CONFLICT (bucket) DO UPDATE SET
         hits = CASE WHEN account_rate_limits.starts_at <= now() - interval '1 minute'
           THEN 1 ELSE account_rate_limits.hits + 1 END,
         starts_at = CASE WHEN account_rate_limits.starts_at <= now() - interval '1 minute'
           THEN now() ELSE account_rate_limits.starts_at END
       RETURNING hits`,
      [bucket],
    );
    return rows[0].hits;
  });
  if (hits > maximum)
    throw new RoomError(429, "SLOW_DOWN", "Try again in a minute.");
}

export function GET() {
  return respond(async () => ({
    username: (await sessionAccount())?.username ?? null,
  }));
}

export async function POST(request: Request) {
  return respond(async () => {
    const secure = requireSameOrigin(request);
    const body = input.parse(await readJson(request));
    const previous = await currentToken();
    const jar = await cookies();
    const attributes = {
      httpOnly: true,
      sameSite: "lax" as const,
      secure,
      path: "/",
    };
    if (body.action === "logout") {
      if (previous)
        await transaction((db) =>
          db.query("DELETE FROM account_sessions WHERE token_hash = $1", [
            hashToken(previous),
          ]),
        );
      jar.set(sessionCookie, "", { ...attributes, maxAge: 0 });
      return { username: null };
    }

    await limit("auth", 30);
    const login =
      body.action === "login"
        ? await transaction(async (db) => {
            const { rows } = await db.query<{
              id: string;
              password_hash: string | null;
            }>("SELECT id, password_hash FROM accounts WHERE username = $1", [
              body.username,
            ]);
            return rows[0];
          })
        : undefined;
    const salt =
      login?.password_hash?.split(":")[0] ?? randomBytes(16).toString("hex");
    const key = await derive(body.password, salt);
    const digest = `${salt}:${key.toString("hex")}`;
    if (
      body.action === "login" &&
      (!login?.password_hash ||
        !timingSafeEqual(Buffer.from(login.password_hash), Buffer.from(digest)))
    )
      throw invalid();

    const token = randomBytes(32).toString("hex");
    const name = await transaction(async (db) => {
      if (body.action === "login") {
        const account = await db.query(
          "SELECT id FROM accounts WHERE id = $1 AND password_hash = $2 FOR UPDATE",
          [login!.id, digest],
        );
        if (!account.rowCount) throw invalid();
      }
      let id = login?.id;
      let name = "username" in body ? body.username : "";
      if (body.action === "register") {
        id = await createAccount(db, name, hashToken(body.invitation), {
          passwordHash: digest,
        });
      } else if (body.action === "reset") {
        const invite = await db.query<{ reset_account: string }>(
          `DELETE FROM account_invites WHERE token_hash = $1 AND expires_at > now()
           AND reset_account IS NOT NULL RETURNING reset_account`,
          [hashToken(body.invitation)],
        );
        if (!invite.rowCount) throw invalidInvitation();
        id = invite.rows[0].reset_account;
        const updated = await db.query<{ username: string }>(
          "UPDATE accounts SET password_hash = $2 WHERE id = $1 AND password_hash IS NOT NULL RETURNING username",
          [id, digest],
        );
        if (!updated.rowCount) throw invalidInvitation();
        name = updated.rows[0].username;
        await db.query("DELETE FROM account_sessions WHERE account_id = $1", [
          id,
        ]);
      }
      if (previous)
        await db.query("DELETE FROM account_sessions WHERE token_hash = $1", [
          hashToken(previous),
        ]);
      await db.query(
        "INSERT INTO account_sessions VALUES ($1, $2, now() + $3 * interval '1 second')",
        [hashToken(token), id, sessionSeconds],
      );
      return name;
    });
    jar.set(sessionCookie, token, { ...attributes, maxAge: sessionSeconds });
    return { username: name };
  });
}
