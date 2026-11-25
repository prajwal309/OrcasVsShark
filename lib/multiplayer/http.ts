import { sessionAccount, requireSameOrigin } from "@/lib/auth/session";
import { ZodError } from "zod";
import {
  DatabaseUnavailableError,
  transaction,
} from "@/lib/database/connection";
import { rateLimit } from "./store";
import { RoomError } from "./protocol";

export function requireRegisteredAccount(isGuest: boolean) {
  if (isGuest)
    throw new RoomError(
      403,
      "REGISTERED_ACCOUNT_REQUIRED",
      "Create an account to use this feature.",
    );
}

export async function actorFor(
  request: Request,
  bucket: string,
  limit: number,
  { allowGuest = false }: { allowGuest?: boolean } = {},
): Promise<string> {
  if (request.method !== "GET") requireSameOrigin(request);
  const account = await sessionAccount();
  if (!account) throw new RoomError(401, "UNAUTHENTICATED", "Sign in to play.");
  if (!allowGuest) requireRegisteredAccount(account.is_guest);
  // Failed game actions still count against the limit.
  await transaction((db) => rateLimit(db, account.id, bucket, limit));
  return account.id;
}

export async function readJson(
  request: Request,
  maximumBytes = 4096,
): Promise<unknown> {
  const mime = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mime !== "application/json")
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
    if (length > maximumBytes) {
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
    const invalid = error instanceof ZodError;
    if (!known && !unavailable && !invalid)
      console.error(
        "Unexpected game API error",
        error instanceof Error ? error.name : "unknown",
      );
    return Response.json(
      {
        error:
          known || unavailable
            ? error.message
            : invalid
              ? "Invalid request."
              : "The game service is unavailable. Please reconnect.",
        code: known
          ? error.code
          : unavailable
            ? "DATABASE_UNAVAILABLE"
            : "INVALID_OR_UNAVAILABLE",
      },
      {
        status: known ? error.status : invalid ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
