import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { usernameSchema } from "./accounts";
import { appOrigin, sqliteDisabled } from "@/lib/deployment";
import { roomCodeSchema, RoomError } from "@/lib/multiplayer/protocol";

export function googleCookie(secure: boolean) {
  return secure ? "__Host-orcas_google" : "orcas_google";
}
export const googleAttemptSchema = z.strictObject({
  state: z.string().regex(/^[a-f0-9]{64}$/),
  verifier: z.string().regex(/^[a-f0-9]{64}$/),
  room: roomCodeSchema.optional(),
  signup: z
    .strictObject({
      username: usernameSchema,
      invitationHash: z.string().regex(/^[a-f0-9]{64}$/),
    })
    .optional(),
});

export function googleConfiguration() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret || sqliteDisabled()) return null;
  let origin: string;
  try {
    origin = appOrigin().origin;
  } catch {
    return null;
  }
  return {
    clientId,
    clientSecret,
    origin,
    redirectUri: new URL("/api/account/google/callback", origin).href,
  };
}

export function beginGoogle(
  config: NonNullable<ReturnType<typeof googleConfiguration>>,
) {
  const state = randomBytes(32).toString("hex");
  const verifier = randomBytes(32).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid",
    prompt: "select_account",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { state, verifier, url: url.href };
}

export async function googleSubject(
  config: NonNullable<ReturnType<typeof googleConfiguration>>,
  code: string,
  verifier: string,
) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      code_verifier: verifier,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!tokenResponse.ok)
    throw new RoomError(401, "GOOGLE_FAILED", "Google sign-in failed.");
  const { access_token } = z
    .object({ access_token: z.string().min(1) })
    .parse(await tokenResponse.json());
  const profile = await fetch(
    "https://openidconnect.googleapis.com/v1/userinfo",
    {
      headers: { Authorization: `Bearer ${access_token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    },
  );
  if (!profile.ok)
    throw new RoomError(401, "GOOGLE_FAILED", "Google sign-in failed.");
  return z
    .object({ sub: z.string().min(1).max(255) })
    .parse(await profile.json()).sub;
}
