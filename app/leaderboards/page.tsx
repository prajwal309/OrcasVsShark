import Link from "next/link";
import { SiteFooter } from "@/components/navigation/site-footer";
import { readIfAvailable } from "@/lib/database/connection";
import { leaderboard } from "@/lib/multiplayer/ratings-store";
import { rankedModes, timeControls } from "@/lib/multiplayer/ranking";

export const metadata = { title: "Ranked Leaderboards" };

export default async function Leaderboards({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const { mode: requested } = await searchParams;
  const mode = rankedModes.find((choice) => choice === requested) ?? "fast";
  const leaders = await readIfAvailable((db) => leaderboard(db, mode));

  return (
    <div className="site-shell theme-ocean">
      <main className="main-content ranked-page">
        <Link
          className="ranked-text-link"
          href={leaders ? "/#ranked-lobby" : "/"}
        >
          ← Ranked lobby
        </Link>
        <h1>Leaderboards</h1>
        <nav className="ranked-tabs" aria-label="Time controls">
          {rankedModes.map((choice) => (
            <Link
              key={choice}
              href={`/leaderboards?mode=${choice}`}
              aria-current={mode === choice ? "page" : undefined}
            >
              {timeControls[choice].name}
            </Link>
          ))}
        </nav>
        <section
          className="turn-card"
          aria-label={`${timeControls[mode].name} leaderboard`}
        >
          {!leaders ? (
            <p>Ranked leaderboards are temporarily unavailable.</p>
          ) : leaders.length ? (
            <div className="ranked-table-scroll">
              <table className="ranked-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Player</th>
                    <th scope="col">Elo</th>
                    <th scope="col">Games</th>
                    <th scope="col">Wins</th>
                    <th scope="col">Draws</th>
                  </tr>
                </thead>
                <tbody>
                  {leaders.map(
                    ({ username, rating, wins, losses, draws }, index) => (
                      <tr key={username}>
                        <td>{index + 1}</td>
                        <th scope="row">
                          <Link href={`/players/${username}`}>{username}</Link>
                        </th>
                        <td>{rating}</td>
                        <td>{wins + losses + draws}</td>
                        <td>{wins}</td>
                        <td>{draws}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p>
              Players appear here after finishing a ranked{" "}
              {timeControls[mode].name} game.
            </p>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
