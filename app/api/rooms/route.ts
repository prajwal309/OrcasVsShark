import { z } from "zod";
import { transaction } from "@/lib/database/connection";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { createRoom } from "@/lib/multiplayer/store";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return respond(async () => {
    const actor = await actorFor(request, "create", 6);
    const { requestId } = z
      .object({ requestId: z.uuid() })
      .strict()
      .parse(await readJson(request));
    return transaction((db) => createRoom(db, actor, requestId));
  });
}
