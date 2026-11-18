import { z } from "zod";
import { transaction } from "@/lib/database/connection";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { updateQueue } from "@/lib/multiplayer/matchmaking";

export const runtime = "nodejs";

export function POST(request: Request) {
  return respond(async () => {
    const actor = await actorFor(request, "matchmaking", 90);
    const { action } = z
      .strictObject({
        action: z.enum(["enter", "status", "cancel"]),
      })
      .parse(await readJson(request));
    return transaction((db) => updateQueue(db, actor, action));
  });
}
