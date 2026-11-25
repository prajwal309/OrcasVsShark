import { progressSchema } from "@/lib/learn/progress";
import { mergeProgressSnapshot } from "@/lib/learn/store";
import { transaction } from "@/lib/database/connection";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";

export function POST(request: Request) {
  return respond(async () => {
    const player = await actorFor(request, "learning-import", 6);
    if (request.headers.get("X-Learning-Player") !== player)
      throw new RoomError(
        409,
        "ACCOUNT_CHANGED",
        "Reopen the Academy with the account used to start this activity.",
      );
    const snapshot = progressSchema.parse(await readJson(request, 128 * 1024));
    return transaction((db) => mergeProgressSnapshot(db, player, snapshot));
  });
}
