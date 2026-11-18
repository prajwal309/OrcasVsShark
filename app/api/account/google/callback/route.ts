import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAccount } from "@/lib/auth/accounts";
import {
  googleAttemptSchema,
  googleConfiguration,
  googleCookie,
  googleSubject,
} from "@/lib/auth/google";
import {
  currentToken,
  hashToken,
  sessionCookie,
  sessionSeconds,
} from "@/lib/auth/session";
import { transaction } from "@/lib/database/connection";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const config = googleConfiguration();
  if (!config)
    return NextResponse.json(
      { error: "Google sign-in is not configured." },
      { status: 503 },
    );
  const redirect = new URL("/online", config.origin);
  const result = (target: URL) =>
    NextResponse.redirect(target, {
      status: 303,
      headers: {
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  const jar = await cookies();
  const attributes = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: config.origin.startsWith("https://"),
  };
  try {
    const parameters = new URL(request.url).searchParams;
    const raw = jar.get(googleCookie(attributes.secure))?.value;
    const state = parameters.get("state");
    if (!raw || raw.length > 4096 || !state || !/^[a-f0-9]{64}$/.test(state))
      throw new Error("Invalid Google state.");
    const attempt = googleAttemptSchema.parse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
    if (!timingSafeEqual(Buffer.from(state), Buffer.from(attempt.state)))
      throw new Error("Invalid Google state.");

    jar.set(googleCookie(attributes.secure), "", {
      ...attributes,
      path: "/",
      maxAge: 0,
    });
    if (attempt.room) redirect.searchParams.set("room", attempt.room);
    const code = parameters.get("code");
    if (!code || code.length > 2048)
      throw new Error("Invalid Google authorization code.");
    const subject = await googleSubject(config, code, attempt.verifier);
    const token = randomBytes(32).toString("hex");
    const previous = await currentToken();
    await transaction(async (db) => {
      const id = await googleAccount(db, subject, attempt.signup);
      if (previous)
        await db.query("DELETE FROM account_sessions WHERE token_hash = $1", [
          hashToken(previous),
        ]);
      await db.query(
        "INSERT INTO account_sessions VALUES ($1, $2, now() + $3 * interval '1 second')",
        [hashToken(token), id, sessionSeconds],
      );
    });
    jar.set(sessionCookie, token, {
      ...attributes,
      path: "/",
      maxAge: sessionSeconds,
    });
    return result(
      attempt.room ? new URL(`/game/${attempt.room}`, config.origin) : redirect,
    );
  } catch (error) {
    redirect.searchParams.set(
      "google",
      error instanceof RoomError ? error.code : "GOOGLE_FAILED",
    );
    return result(redirect);
  }
}
