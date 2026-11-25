import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  currentToken,
  hashToken,
  requireSameOrigin,
  replaceSession,
  sessionAccount,
  sessionCookie,
  sessionSeconds,
} from "@/lib/auth/session";
import {
  createAccount,
  emailSchema,
  invalidInvitation,
  invitationSchema as invitation,
  registerGuestAccount,
  usernameSchema as username,
  signupCodeRequired,
} from "@/lib/auth/accounts";
import { read, transaction } from "@/lib/database/connection";
import { readJson, respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";
const password = z.string().min(1).max(128);
const input = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("login"), username, password }),
  z.strictObject({
    action: z.literal("register"),
    username,
    email: emailSchema,
    password,
    confirmPassword: password,
    invitation: invitation.optional(),
  }),
  z.strictObject({ action: z.literal("reset"), password, invitation }),
  z.strictObject({ action: z.literal("logout") }),
]);
const invalid = () =>
  new RoomError(401, "INVALID_LOGIN", "Check your username or password.");

const passwordOptions = {
  // Argon2id is the library default.
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
};
const dummyHash =
  "$argon2id$v=19$m=19456,t=2,p=1$WdpYf4hX7ZN76Ot9vyJbmA$m7cTTw9rRow672eXlE5qhNW1BHrnigk9bzQC9kI3Dcg";
let activeHashes = 0;
async function checkPassword(
  secret: string,
  stored: string | null | undefined,
) {
  if (activeHashes >= 2)
    throw new RoomError(429, "SLOW_DOWN", "Please try again shortly.");
  activeHashes++;
  try {
    if (stored === undefined) return await hash(secret, passwordOptions);
    return (await verify(stored ?? dummyHash, secret)) && stored
      ? stored
      : null;
  } finally {
    activeHashes--;
  }
}

async function limit(bucket: string, maximum: number) {
  const hits = await transaction(async (db) => {
    const { rows } = await db.query<{ hits: number }>(
      `INSERT INTO account_rate_limits VALUES ($1, EXTRACT(EPOCH FROM clock_timestamp()), 1)
       ON CONFLICT (bucket) DO UPDATE SET
         hits = CASE WHEN account_rate_limits.starts_at <= EXTRACT(EPOCH FROM clock_timestamp()) - 60
           THEN 1 ELSE account_rate_limits.hits + 1 END,
         starts_at = CASE WHEN account_rate_limits.starts_at <= EXTRACT(EPOCH FROM clock_timestamp()) - 60
           THEN EXTRACT(EPOCH FROM clock_timestamp()) ELSE account_rate_limits.starts_at END
       RETURNING hits`,
      [bucket],
    );
    return rows[0].hits;
  });
  if (hits > maximum)
    throw new RoomError(429, "SLOW_DOWN", "Try again in a minute.");
}

export function GET() {
  return respond(async () => {
    const account = await sessionAccount();
    return {
      username: account?.username ?? null,
      isGuest: account?.is_guest ?? false,
    };
  });
}

export async function POST(request: Request) {
  return respond(async () => {
    const secure = requireSameOrigin(request);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) {
      if (parsed.error.issues.some((issue) => issue.path[0] === "username"))
        throw new RoomError(
          400,
          "INVALID_USERNAME",
          "Use 3–24 letters, digits, or underscores.",
        );
      if (parsed.error.issues.some((issue) => issue.path[0] === "email"))
        throw new RoomError(
          400,
          "INVALID_EMAIL",
          "Enter a valid email address.",
        );
      if (parsed.error.issues.some((issue) => issue.path[0] === "invitation"))
        throw invalidInvitation();
      if (parsed.error.issues.some((issue) => issue.path[0] === "password"))
        throw new RoomError(
          400,
          "INVALID_PASSWORD",
          "Enter a password of up to 128 characters.",
        );
      throw parsed.error;
    }
    const body = parsed.data;
    if (body.action === "register" || body.action === "reset") {
      if (body.password.length < 8)
        throw new RoomError(
          400,
          "INVALID_PASSWORD",
          "Use at least 8 characters for your password.",
        );
      if (body.action === "register") {
        if (body.password !== body.confirmPassword)
          throw new RoomError(
            400,
            "PASSWORD_MISMATCH",
            "Passwords do not match.",
          );
        if (signupCodeRequired() && !body.invitation) throw invalidInvitation();
      }
    }
    const previous = await currentToken();
    const previousAccount =
      body.action === "register" && previous
        ? await read((db) =>
            db.account_sessions.findUnique({
              where: {
                token_hash: hashToken(previous),
                expires_at: { gt: Date.now() / 1000 },
              },
              select: {
                accounts: { select: { id: true, is_guest: true } },
              },
            }),
          )
        : null;
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
        ? await read((db) =>
            db.accounts.findUnique({
              where: { username: body.username },
              select: { id: true, password_hash: true },
            }),
          )
        : null;
    const digest = await checkPassword(
      body.password,
      body.action === "login" ? (login?.password_hash ?? null) : undefined,
    );
    if (!digest) throw invalid();

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
        id = previousAccount?.accounts.is_guest
          ? await registerGuestAccount(
              db,
              previousAccount.accounts.id,
              name,
              body.email,
              body.invitation && hashToken(body.invitation),
              digest,
            )
          : await createAccount(
              db,
              name,
              body.email,
              body.invitation && hashToken(body.invitation),
              { passwordHash: digest },
            );
      } else if (body.action === "reset") {
        const invite = await db.query<{ reset_account: string }>(
          `DELETE FROM account_invites WHERE token_hash = $1 AND expires_at > EXTRACT(EPOCH FROM clock_timestamp())
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
      if (!id) throw invalid();
      await replaceSession(db, id, token, previous);
      return name;
    });
    jar.set(sessionCookie, token, { ...attributes, maxAge: sessionSeconds });
    return { username: name, isGuest: false };
  });
}
