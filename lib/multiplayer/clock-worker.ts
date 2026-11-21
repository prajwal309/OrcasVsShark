import {
  DatabaseUnavailableError,
  read,
  transaction,
} from "@/lib/database/connection";
import { expireRankedRoom } from "./store";

const runtime = globalThis as typeof globalThis & {
  orcasClockWorker?: ReturnType<typeof setInterval>;
};

export function startRankedClockWorker() {
  if (runtime.orcasClockWorker) return;
  let reported = false;
  const failedGames = new Set<string>();

  function settleDueGames() {
    try {
      const now = Date.now();
      const due = read(
        (db) =>
          db.query<{ game_code: string }>(
            "SELECT game_code FROM ranked_matches WHERE deadline <= $1 ORDER BY deadline LIMIT 64",
            [now],
          ).rows,
      );
      for (const { game_code } of due) {
        try {
          // expireRankedRoom checks the persisted deadline again inside this
          // transaction in case a move or another request won the race.
          transaction((db) => expireRankedRoom(db, game_code, now));
          failedGames.delete(game_code);
        } catch (error) {
          if (!failedGames.has(game_code)) {
            console.error(
              "Ranked clock settlement failed for room",
              game_code,
              error,
            );
            failedGames.add(game_code);
          }
        }
      }
      reported = false;
    } catch (error) {
      if (!(error instanceof DatabaseUnavailableError) && !reported)
        console.error("Ranked clock settlement failed", error);
      reported = true;
    }
  }

  runtime.orcasClockWorker = setInterval(settleDueGames, 1000);
  runtime.orcasClockWorker.unref();
  setTimeout(settleDueGames, 0).unref();
}
