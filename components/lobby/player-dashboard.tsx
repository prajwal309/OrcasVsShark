import { Suspense } from "react";
import Link from "next/link";
import { readIfAvailable } from "@/lib/database/connection";
import { playerProfile } from "@/lib/multiplayer/ratings-store";
import { rankedModes, timeControls } from "@/lib/multiplayer/ranking";

function PlayerDashboardLoading() {
  return (
    <section
      className="player-dashboard player-dashboard-message"
      aria-busy="true"
      aria-label="Player statistics"
    >
      <p role="status">Loading player statistics…</p>
    </section>
  );
}

async function PlayerDashboardContent({ username }: { username: string }) {
  const player = await readIfAvailable((db) => playerProfile(db, username));

  if (player === null) return null;
  if (!player) {
    return (
      <section className="player-dashboard player-dashboard-message">
        <p role="status">Player statistics are temporarily unavailable.</p>
      </section>
    );
  }

  const totals = player.ratings.reduce(
    (result, rating) => ({
      games:
        result.games +
        (rating.total_games ?? rating.wins + rating.losses + rating.draws),
      wins: result.wins + rating.wins,
      losses: result.losses + rating.losses,
      draws: result.draws + rating.draws,
    }),
    { games: 0, wins: 0, losses: 0, draws: 0 },
  );

  return (
    <section
      className="player-dashboard turn-card"
      aria-labelledby="player-dashboard-title"
    >
      <div className="player-dashboard-heading">
        <div>
          <p className="eyebrow">YOUR RANKED DASHBOARD</p>
          <h2 id="player-dashboard-title">{player.username}</h2>
        </div>
        <nav aria-label="Player statistics links">
          <Link href={`/players/${player.username}`}>View profile</Link>
          <Link href="/leaderboards">Leaderboards</Link>
        </nav>
      </div>

      {player.ratings.length > 0 && (
        <dl className="player-stat-row" aria-label="Ranked record">
          <div>
            <dt>Ranked games</dt>
            <dd>{totals.games}</dd>
          </div>
          <div data-result="win">
            <dt>Wins</dt>
            <dd>{totals.wins}</dd>
          </div>
          <div data-result="loss">
            <dt>Losses</dt>
            <dd>{totals.losses}</dd>
          </div>
          <div data-result="draw">
            <dt>Draws</dt>
            <dd>{totals.draws}</dd>
          </div>
          {totals.games > 0 && (
            <div>
              <dt>Win rate</dt>
              <dd>{Math.round((totals.wins / totals.games) * 100)}%</dd>
            </div>
          )}
        </dl>
      )}

      {player.ratings.length > 0 && (
        <div
          className="player-rating-list"
          aria-label="Ratings by time control"
        >
          {rankedModes.map((mode) => {
            const rating = player.ratings.find((entry) => entry.mode === mode);
            if (!rating) return null;
            const rank = player.ranks.find((entry) => entry.mode === mode);
            return (
              <Link
                key={mode}
                href={`/leaderboards?mode=${mode}`}
                aria-label={`${timeControls[mode].name}: ${rating.rating} Elo${rank ? `, rank ${rank.rank}` : ""}`}
              >
                <span>{timeControls[mode].name}</span>
                <strong>{rating.rating} Elo</strong>
                {rank && (
                  <span className="player-rating-rank">#{rank.rank}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <div className="player-recent-games">
        <h3>Recent ranked games</h3>
        {player.history.length > 0 ? (
          <div className="ranked-table-scroll">
            <table className="ranked-table">
              <thead>
                <tr>
                  <th scope="col">Date (UTC)</th>
                  <th scope="col">Opponent</th>
                  <th scope="col">Time control</th>
                  <th scope="col">Result</th>
                  <th scope="col">Rating change</th>
                </tr>
              </thead>
              <tbody>
                {player.history.slice(0, 5).map((game, index) => {
                  const date = new Date(game.ended_at).toISOString();
                  return (
                    <tr key={`${game.ended_at}-${index}`}>
                      <td>
                        <time dateTime={date}>{date.slice(0, 10)}</time>
                      </td>
                      <th scope="row">
                        <Link href={`/players/${game.opponent}`}>
                          {game.opponent}
                        </Link>
                      </th>
                      <td>{timeControls[game.mode].name}</td>
                      <td>
                        <span
                          className="player-game-result"
                          data-result={game.result.toLowerCase()}
                        >
                          {game.result}
                        </span>
                      </td>
                      <td
                        className="player-rating-change"
                        data-loss={game.delta < 0 || undefined}
                        data-draw={game.delta === 0 || undefined}
                      >
                        {game.delta > 0 ? "+" : ""}
                        {game.delta}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="player-dashboard-empty">No ranked games played yet.</p>
        )}
      </div>
    </section>
  );
}

export function PlayerDashboard({ username }: { username: string }) {
  return (
    <Suspense fallback={<PlayerDashboardLoading />}>
      <PlayerDashboardContent username={username} />
    </Suspense>
  );
}
