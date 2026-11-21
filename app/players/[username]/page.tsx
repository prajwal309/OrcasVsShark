import Link from "next/link";
import { notFound } from "next/navigation";
import { usernameSchema } from "@/lib/auth/accounts";
import { readIfAvailable } from "@/lib/database/connection";
import { playerProfile } from "@/lib/multiplayer/ratings-store";
import {
  initialRating,
  rankedModes,
  timeControls,
} from "@/lib/multiplayer/ranking";

export const metadata = { title: "Player Profile | Orcas vs Sharks" };

export default async function Player({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const parsed = usernameSchema.safeParse((await params).username);
  if (!parsed.success) notFound();
  const player = await readIfAvailable((db) => playerProfile(db, parsed.data));
  if (player === null) notFound();
  if (!player) {
    return (
      <main className="main-content ranked-page">
        <Link className="ranked-text-link" href="/#ranked-lobby">
          ← Ranked lobby
        </Link>
        <h1>Player profile</h1>
        <p>Ranked player profiles are temporarily unavailable.</p>
      </main>
    );
  }

  return (
    <div className="site-shell theme-ocean">
      <main className="main-content ranked-page">
        <nav className="ranked-tabs" aria-label="Ranked navigation">
          <Link href="/#ranked-lobby">← Ranked lobby</Link>
          <Link href="/leaderboards">Leaderboards</Link>
        </nav>
        <h1>{player.username}</h1>
        <div
          className="ranked-profile-ratings"
          aria-label="Ratings by time control"
        >
          {rankedModes.map((mode) => {
            const record = player.ratings.find((entry) => entry.mode === mode);
            const {
              rating = initialRating,
              wins = 0,
              losses = 0,
              draws = 0,
              total_games: totalGames = 0,
            } = record ?? {};
            return (
              <section
                className="turn-card"
                key={mode}
                aria-label={`${timeControls[mode].name} rating`}
              >
                <h2>{timeControls[mode].name}</h2>
                <p className="ranked-rating">{rating} Elo</p>
                <p>
                  {totalGames} games · {wins} wins · {losses} losses · {draws}{" "}
                  draws
                </p>
              </section>
            );
          })}
        </div>
        <section className="turn-card ranked-history">
          <h2>Recent ranked games</h2>
          {player.history.length ? (
            <div className="ranked-table-scroll">
              <table className="ranked-table">
                <thead>
                  <tr>
                    <th scope="col">Opponent</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Result</th>
                    <th scope="col">Elo</th>
                    <th scope="col">Date (UTC)</th>
                  </tr>
                </thead>
                <tbody>
                  {player.history.map((game, index) => {
                    const date = new Date(game.ended_at).toISOString();
                    return (
                      <tr key={index}>
                        <th scope="row">
                          <Link href={`/players/${game.opponent}`}>
                            {game.opponent}
                          </Link>
                        </th>
                        <td>{timeControls[game.mode].name}</td>
                        <td>
                          {game.result}
                          <small>{game.reason}</small>
                        </td>
                        <td>
                          {game.rating + game.delta}{" "}
                          <span
                            className="ranked-delta"
                            data-loss={game.delta < 0 || undefined}
                          >
                            ({game.delta >= 0 ? "+" : ""}
                            {game.delta})
                          </span>
                        </td>
                        <td>
                          <time dateTime={date}>{date.slice(0, 10)}</time>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No finished ranked games yet.</p>
          )}
        </section>
      </main>
    </div>
  );
}
