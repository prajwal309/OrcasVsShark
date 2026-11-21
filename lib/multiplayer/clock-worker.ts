import { read, transaction } from "@/lib/database/connection";
import { expireRankedRoom } from "./store";

const runtime = globalThis as typeof globalThis & {
  orcasClockWorker?: ReturnType<typeof setInterval>;
};

export function startRankedClockWorker() {
  if (runtime.orcasClockWorker) return;
  let reported = false;

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
      for (const { game_code } of due)
        transaction((db) => expireRankedRoom(db, game_code, now));
      reported = false;
    } catch (error) {
      if (!reported) console.error("Ranked clock settlement failed", error);
      reported = true;
    }
  }

  settleDueGames();
  runtime.orcasClockWorker = setInterval(settleDueGames, 1000);
  runtime.orcasClockWorker.unref();
}
