import { cookies } from "next/headers";
import { z } from "zod";
import { invitationSchema, usernameSchema } from "@/lib/auth/accounts";
import {
  beginGoogle,
  googleConfiguration,
  googleCookie,
} from "@/lib/auth/google";
import { hashToken, requireSameOrigin } from "@/lib/auth/session";
import { readJson, respond } from "@/lib/multiplayer/http";
import { roomCodeSchema, RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";

const input = z.strictObject({
  room: roomCodeSchema.optional(),
  signup: z
    .strictObject({ username: usernameSchema, invitation: invitationSchema })
    .optional(),
});

export function POST(request: Request) {
  return respond(async () => {
    const secure = requireSameOrigin(request);
    const config = googleConfiguration();
    if (!config)
      throw new RoomError(
        503,
        "NOT_CONFIGURED",
        "Google sign-in is not configured.",
      );
    const { room, signup } = input.parse(await readJson(request));
    const { url, state, verifier } = beginGoogle(config);
    const jar = await cookies();
    jar.set(
      googleCookie(secure),
      Buffer.from(
        JSON.stringify({
          state,
          verifier,
          room,
          signup: signup && {
            username: signup.username,
            invitationHash: hashToken(signup.invitation),
          },
        }),
      ).toString("base64url"),
      {
        httpOnly: true,
        secure,
        sameSite: "lax",
        maxAge: 600,
        path: "/",
      },
    );
    return { url };
  });
}
