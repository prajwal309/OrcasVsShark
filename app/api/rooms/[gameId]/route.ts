import { transaction } from "@/lib/database/connection";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { roomCodeSchema, requestSchema } from "@/lib/multiplayer/protocol";
import { readRoom, changeRoom } from "@/lib/multiplayer/store";
export const runtime = "nodejs";
type Context = { params: Promise<{ gameId: string }> };
export async function GET(request: Request, context: Context) {
  return respond(async () => {
    const actor = await actorFor(request, "read", 120);
    const code = roomCodeSchema.parse((await context.params).gameId);
    return transaction((db) => readRoom(db, code, actor));
  });
}
export async function POST(request: Request, context: Context) {
  return respond(async () => {
    const actor = await actorFor(request, "action", 90);
    const code = roomCodeSchema.parse((await context.params).gameId);
    const action = requestSchema.parse(await readJson(request));
    return transaction((db) => changeRoom(db, code, actor, action));
  });
}
