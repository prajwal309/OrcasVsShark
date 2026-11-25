import { z } from "zod";
import { readIfAvailable } from "@/lib/database/connection";
import { moveSchema } from "@/lib/multiplayer/protocol";
import {
  canonicalPosition,
  openingMoveStatistics,
  replayOpeningLine,
  type OpeningGame,
} from "@/lib/openings/explorer";
import { respond } from "@/lib/multiplayer/http";
import type { Move, Side } from "@/lib/game/types";

export const runtime = "nodejs";

const moveCode = /^(?:\+[a-e][1-5]|[a-e][1-5][-x][a-e][1-5])$/;
const filtersSchema = z.object({
  mode: z.enum(["all", "casual", "ranked"]).default("all"),
  rating: z.enum(["all", "1200-1599", "1600-1999", "2000+"]).default("all"),
});
const dataCache = new Map<string, { until: number; games: OpeningGame[] }>();
const positionCache = new Map<
  string,
  { until: number; result: ReturnType<typeof openingMoveStatistics> }
>();
const cacheDuration = 60_000;

async function loadGames(mode: string, rating: string) {
  const key = `${mode}:${rating}`;
  const cached = dataCache.get(key);
  if (cached && cached.until > Date.now()) return cached.games;
  const rows = await readIfAvailable(async (db) =>
    db.query<{ moves: unknown; winner: string | null }>(
      `WITH completed AS (
         SELECT gr.game_code, gr.data
         FROM game_rounds gr
         WHERE NOT EXISTS (
           SELECT 1 FROM games g WHERE g.code = gr.game_code
             AND g.result IS NOT NULL AND g.result <> 'null'
             AND (g.data::jsonb ->> 'round')::integer = gr.round
         )
         UNION ALL
         SELECT g.code, g.data FROM games g
         WHERE g.result IS NOT NULL AND g.result <> 'null'
       )
       SELECT c.data::jsonb -> 'moves' AS moves,
              c.data::jsonb -> 'ending' ->> 'winner' AS winner
       FROM completed c
       LEFT JOIN ranked_matches rm ON rm.game_code = c.game_code
       WHERE ($1 = 'all'
          OR ($1 = 'casual' AND rm.game_code IS NULL)
          OR ($1 = 'ranked' AND rm.game_code IS NOT NULL AND rm.ended_at IS NOT NULL))
         AND ($2 = 'all'
          OR ($2 = '1200-1599' AND rm.orcas_rating BETWEEN 1200 AND 1599 AND rm.sharks_rating BETWEEN 1200 AND 1599)
          OR ($2 = '1600-1999' AND rm.orcas_rating BETWEEN 1600 AND 1999 AND rm.sharks_rating BETWEEN 1600 AND 1999)
          OR ($2 = '2000+' AND rm.orcas_rating >= 2000 AND rm.sharks_rating >= 2000))`,
      [mode, rating],
    ),
  );
  if (!rows) return null;
  const games: OpeningGame[] = [];
  for (const row of rows.rows) {
    const parsedMoves = z.array(moveSchema).safeParse(row.moves);
    const winner = row.winner;
    if (
      !parsedMoves.success ||
      (winner !== "orcas" && winner !== "sharks" && winner !== "draw")
    )
      continue;
    games.push({
      moves: parsedMoves.data as Move[],
      winner: winner as Side | "draw",
    });
  }
  if (dataCache.size >= 8) dataCache.delete(dataCache.keys().next().value!);
  dataCache.set(key, { games, until: Date.now() + cacheDuration });
  return games;
}

export async function GET(request: Request) {
  return respond(async () => {
    const url = new URL(request.url);
    const filters = filtersSchema.parse({
      mode: url.searchParams.get("mode") ?? undefined,
      rating: url.searchParams.get("rating") ?? undefined,
    });
    const rawLine = url.searchParams.get("line") ?? "";
    const line = rawLine ? rawLine.split(",") : [];
    if (
      line.length > 100 ||
      line.some((move) => !moveCode.test(move))
    )
      return { available: true, games: 0, moves: [], insufficientData: true };
    const state = replayOpeningLine(line);
    const games = await loadGames(filters.mode, filters.rating);
    if (!games)
      return {
        available: false,
        games: 0,
        moves: [],
        message: "Completed-game statistics are unavailable right now.",
      };
    const exactBoard = Object.entries(state.board)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([node, piece]) => `${node}:${piece}`)
      .join(",");
    const positionKey = `${filters.mode}:${filters.rating}:${canonicalPosition(state).key}:${exactBoard}`;
    const cachedPosition = positionCache.get(positionKey);
    let result =
      cachedPosition && cachedPosition.until > Date.now()
        ? cachedPosition.result
        : undefined;
    if (!result) {
      result = openingMoveStatistics(games, state);
      if (positionCache.size >= 256)
        positionCache.delete(positionCache.keys().next().value!);
      positionCache.set(positionKey, {
        result,
        until: Date.now() + cacheDuration,
      });
    }
    return {
      available: true,
      source: "completed-human-games",
      ...result,
      insufficientData: result.games === 0,
    };
  });
}
