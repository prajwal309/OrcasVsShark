import { createClient } from "@supabase/supabase-js";
import { ZodError } from "zod";
import { transaction } from "@/lib/database/connection";
import { rateLimit } from "./store";
import { RoomError } from "./protocol";

export async function actorFor(
  request: Request,
  bucket: string,
  limit: number,
): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !process.env.DATABASE_URL)
    throw new RoomError(
      503,
      "NOT_CONFIGURED",
      "Online play is not configured. Local play is available.",
    );
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([^\s]+)$/)?.[1];
  if (!token || token.length > 8192)
    throw new RoomError(401, "UNAUTHENTICATED", "Sign in to play.");
  const auth = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user)
    throw new RoomError(
      401,
      "UNAUTHENTICATED",
      "Your player session expired. Reload to reconnect.",
    );
  // Separate transaction: failed game actions still count against the limit.
  await transaction((db) => rateLimit(db, data.user.id, bucket, limit));
  return data.user.id;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new RoomError(415, "JSON_REQUIRED", "Send JSON.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new RoomError(400, "INVALID_BODY", "A JSON body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) {
      await reader.cancel();
      throw new RoomError(413, "BODY_TOO_LARGE", "The request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RoomError(400, "INVALID_BODY", "Invalid JSON.");
  }
}

export async function respond(work: () => Promise<unknown>): Promise<Response> {
  try {
    return Response.json(await work(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const known = error instanceof RoomError;
    return Response.json(
      {
        error: known
          ? error.message
          : error instanceof ZodError
            ? "Invalid request."
            : "The game service is unavailable. Please reconnect.",
        code: known ? error.code : "INVALID_OR_UNAVAILABLE",
      },
      {
        status: known ? error.status : error instanceof ZodError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
