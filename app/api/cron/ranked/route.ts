import { timingSafeEqual } from "node:crypto";
import { respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";
import { settleDueGames } from "@/lib/multiplayer/clock-worker";

export const runtime = "nodejs";
export const maxDuration = 60;

export function GET(request: Request) {
  return respond(async () => {
    const secret = process.env.CRON_SECRET;
    const actual = Buffer.from(request.headers.get("authorization") ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    if (
      !secret ||
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    )
      throw new RoomError(401, "UNAUTHORIZED", "Unauthorized.");
    const result = await settleDueGames();
    if (result.failures)
      throw new RoomError(
        503,
        "SETTLEMENT_FAILED",
        "Some ranked games could not be settled.",
      );
    return result;
  });
}
