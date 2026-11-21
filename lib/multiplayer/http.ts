import { sessionAccount, requireSameOrigin } from "@/lib/auth/session";
import { ZodError } from "zod";
import {
  DatabaseUnavailableError,
  transaction,
} from "@/lib/database/connection";
import { rateLimit } from "./store";
import { RoomError } from "./protocol";

export async function actorFor(
  request: Request,
  bucket: string,
  limit: number,
): Promise<string> {
  if (request.method !== "GET") requireSameOrigin(request);
  const account = await sessionAccount();
  if (!account) throw new RoomError(401, "UNAUTHENTICATED", "Sign in to play.");
  // Failed game actions still count against the limit.
  await transaction((db) => rateLimit(db, account.id, bucket, limit));
  return account.id;
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
    const unavailable = error instanceof DatabaseUnavailableError;
    return Response.json(
      {
        error:
          known || unavailable
            ? error.message
            : error instanceof ZodError
              ? "Invalid request."
              : "The game service is unavailable. Please reconnect.",
        code: known
          ? error.code
          : unavailable
            ? "DATABASE_UNAVAILABLE"
            : "INVALID_OR_UNAVAILABLE",
      },
      {
        status: known ? error.status : error instanceof ZodError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
