import { read, transaction } from "@/lib/database/connection";
import { expireRankedRoom } from "./store";

export async function settleDueGames(now = Date.now()) {
  const { rows: due } = await read((db) =>
    db.query<{ game_code: string }>(
      "SELECT game_code FROM ranked_matches WHERE deadline <= $1 ORDER BY deadline LIMIT 64",
      [now],
    ),
  );
  let processed = 0;
  let failures = 0;
  for (const { game_code } of due) {
    try {
      if (await transaction((db) => expireRankedRoom(db, game_code, now)))
        processed++;
    } catch {
      failures++;
      console.error("Ranked clock settlement failed for room", game_code);
    }
  }
  return { processed, failures };
}
