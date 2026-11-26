import type { SqlClient } from "@/lib/database/connection";
import type { Side } from "@/lib/game/types";
import type { Ending } from "./protocol";
import {
  clockAt,
  eloChange,
  startClock,
  type Clock,
  type RankedMode,
  type RankedView,
} from "./ranking";

export type RankedMatch = {
  mode: RankedMode;
  orcas_id: string;
  sharks_id: string;
  orcas_rating: number;
  sharks_rating: number;
  orcas_ms: number;
  sharks_ms: number;
  deadline: number | null;
  orcas_delta: number | null;
  orcas_name: string;
  sharks_name: string;
};

export async function rankedMatch(db: SqlClient, code: string) {
  return (
    await db.query<RankedMatch>(
      `SELECT m.*, o.username AS orcas_name, s.username AS sharks_name
     FROM ranked_matches m JOIN accounts o ON o.id = m.orcas_id
     JOIN accounts s ON s.id = m.sharks_id WHERE m.game_code = $1`,
      [code],
    )
  ).rows[0];
}

export function matchClock(match: RankedMatch): Clock {
  return {
    remaining: { orcas: match.orcas_ms, sharks: match.sharks_ms },
    deadline: match.deadline,
  };
}

export function rankedView(
  match: RankedMatch,
  turn: Side,
  now: number,
): RankedView {
  return {
    mode: match.mode,
    sampledAt: now,
    remaining: clockAt(matchClock(match), turn, now),
    players: {
      orcas: {
        username: match.orcas_name,
        rating: match.orcas_rating,
        change: match.orcas_delta,
      },
      sharks: {
        username: match.sharks_name,
        rating: match.sharks_rating,
        change: match.orcas_delta === null ? null : -match.orcas_delta,
      },
    },
  };
}

export async function activeRankedMatch(db: SqlClient, player: string) {
  return (
    await db.query<{ game_code: string; mode: RankedMode; deadline: number }>(
      `SELECT game_code, mode, deadline FROM ranked_matches
     WHERE ended_at IS NULL AND (orcas_id = $1 OR sharks_id = $1)`,
      [player],
    )
  ).rows[0];
}

export async function startRankedMatch(
  db: SqlClient,
  code: string,
  mode: RankedMode,
  orcas: string,
  sharks: string,
  now: number,
) {
  const clock = startClock(mode, now);
  const match = await db.query(
    `INSERT INTO ranked_matches (game_code, mode, orcas_id, sharks_id, orcas_rating,
        sharks_rating, orcas_ms, sharks_ms, deadline, started_at)
     SELECT $1, $2, $3, $4, o.rating, s.rating, $5, $6, $7, $8
     FROM player_ratings o JOIN player_ratings s ON s.mode = o.mode
     WHERE o.player_id = $3 AND s.player_id = $4 AND o.mode = $2`,
    [
      code,
      mode,
      orcas,
      sharks,
      clock.remaining.orcas,
      clock.remaining.sharks,
      clock.deadline,
      now,
    ],
  );
  if (match.rowCount !== 1)
    throw new Error("Could not initialize ranked ratings.");
}

export async function saveClock(db: SqlClient, code: string, clock: Clock) {
  await db.query(
    "UPDATE ranked_matches SET orcas_ms = $2, sharks_ms = $3, deadline = $4 WHERE game_code = $1",
    [code, clock.remaining.orcas, clock.remaining.sharks, clock.deadline],
  );
}

export async function finishRankedMatch(
  db: SqlClient,
  code: string,
  match: RankedMatch,
  clock: Clock,
  ending: Ending,
  now: number,
) {
  const delta = eloChange(
    match.orcas_rating,
    match.sharks_rating,
    ending.winner === "draw" ? 0.5 : ending.winner === "orcas" ? 1 : 0,
  );
  const updated = await db.query(
    `UPDATE ranked_matches SET orcas_ms = $2, sharks_ms = $3, deadline = NULL,
       ended_at = $4, winner = $5, reason = $6, orcas_delta = $7
     WHERE game_code = $1 AND ended_at IS NULL`,
    [
      code,
      clock.remaining.orcas,
      clock.remaining.sharks,
      now,
      ending.winner,
      ending.reason,
      delta,
    ],
  );
  if (!updated.rowCount) return;
  for (const side of ["orcas", "sharks"] as const) {
    await db.query(
      `UPDATE player_ratings SET rating = rating + $3,
         wins = wins + $4, losses = losses + $5, draws = draws + $6
       WHERE player_id = $1 AND mode = $2`,
      [
        match[`${side}_id`],
        match.mode,
        side === "orcas" ? delta : -delta,
        Number(ending.winner === side),
        Number(ending.winner !== "draw" && ending.winner !== side),
        Number(ending.winner === "draw"),
      ],
    );
  }
}

type Rating = {
  mode: RankedMode;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_games: number;
};
type History = {
  mode: RankedMode;
  opponent: string;
  result: "Win" | "Loss" | "Draw";
  reason: string | null;
  rating: number;
  delta: number;
  ended_at: number;
};

export async function playerProfile(db: SqlClient, username: string) {
  const account = (
    await db.query<{ id: string; username: string }>(
      "SELECT id, username FROM accounts WHERE username = $1",
      [username],
    )
  ).rows[0];
  if (!account) return null;
  const ratings = (
    await db.query<Rating>(
      "SELECT mode, rating, wins, losses, draws, total_games FROM player_ratings WHERE player_id = $1",
      [account.id],
    )
  ).rows;
  const ranks = (
    await db.query<{ mode: RankedMode; rank: number }>(
      `SELECT mode, rank FROM (
       SELECT r.mode, r.player_id,
         ROW_NUMBER() OVER (PARTITION BY r.mode ORDER BY r.rating DESC, a.username ASC)::int AS rank
       FROM player_ratings r JOIN accounts a ON a.id = r.player_id
       WHERE r.mode IN ('fast', 'medium', 'classic') AND r.total_games > 0
     ) ranked WHERE player_id = $1`,
      [account.id],
    )
  ).rows;
  const history = (
    await db.query<History>(
      `SELECT m.mode,
       CASE WHEN m.orcas_id = $1 THEN s.username ELSE o.username END AS opponent,
       CASE WHEN m.winner = 'draw' THEN 'Draw'
         WHEN (m.orcas_id = $1 AND m.winner = 'orcas') OR (m.sharks_id = $1 AND m.winner = 'sharks') THEN 'Win'
         ELSE 'Loss' END AS result,
       m.reason,
       CASE WHEN m.orcas_id = $1 THEN m.orcas_rating ELSE m.sharks_rating END AS rating,
       CASE WHEN m.orcas_id = $1 THEN m.orcas_delta ELSE -m.orcas_delta END AS delta,
       m.ended_at
     FROM ranked_matches m JOIN accounts o ON o.id = m.orcas_id
       JOIN accounts s ON s.id = m.sharks_id
     WHERE m.ended_at IS NOT NULL AND (m.orcas_id = $1 OR m.sharks_id = $1)
     ORDER BY m.ended_at DESC, m.game_code LIMIT 30`,
      [account.id],
    )
  ).rows;
  return { username: account.username, ratings, ranks, history };
}

export async function leaderboard(db: SqlClient, mode: RankedMode) {
  return (
    await db.query<Rating & { username: string }>(
      `SELECT r.mode, a.username, r.rating, r.wins, r.losses, r.draws, r.total_games
     FROM player_ratings r JOIN accounts a ON a.id = r.player_id
     WHERE r.mode = $1 AND r.total_games > 0
     ORDER BY r.rating DESC, a.username LIMIT 50`,
      [mode],
    )
  ).rows;
}
