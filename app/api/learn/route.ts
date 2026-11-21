import { transaction } from "@/lib/database/connection";
import { getExercise } from "@/lib/learn/curriculum";
import { moveCode, prepareExercise } from "@/lib/learn/exercises";
import { eventSchema } from "@/lib/learn/progress";
import { saveLearningEvent } from "@/lib/learn/store";
import { actorFor, readJson, respond } from "@/lib/multiplayer/http";
import { RoomError } from "@/lib/multiplayer/protocol";

export const runtime = "nodejs";

export function POST(request: Request) {
  return respond(async () => {
    const player = await actorFor(request, "learning", 120);
    if (request.headers.get("X-Learning-Player") !== player)
      throw new RoomError(
        409,
        "ACCOUNT_CHANGED",
        "Reopen the Academy with the account used to start this activity.",
      );
    const event = eventSchema.parse(await readJson(request));
    const exercise = getExercise(event.kind, event.activityId);
    if (
      !exercise ||
      (event.action === "stage" &&
        !prepareExercise(exercise).answers.some(
          ({ move, replies }) =>
            replies.length > 0 && moveCode(move) === event.opening,
        ))
    )
      throw new RoomError(
        400,
        "INVALID_ACTIVITY",
        "That learning activity is unavailable.",
      );
    return transaction((db) => saveLearningEvent(db, player, event));
  });
}
