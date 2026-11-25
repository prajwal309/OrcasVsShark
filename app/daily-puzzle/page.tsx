import Link from "next/link";
import { AccountLink } from "@/components/navigation/account-navigation";
import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import { DailyPuzzle } from "@/components/daily/daily-puzzle";
import {
  dailyPuzzleArchive,
  dailyPuzzleDifficulty,
  dailyPuzzleForDate,
  utcDateString,
} from "@/lib/daily/puzzles";
import { pageSessionAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function DailyPuzzlePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = utcDateString();
  const requested = (await searchParams).date ?? today;
  let date = today;
  let puzzle;
  try {
    puzzle = dailyPuzzleForDate(requested);
    date = requested;
  } catch {
    puzzle = dailyPuzzleForDate(today);
  }
  const account = await pageSessionAccount();
  const archive = dailyPuzzleArchive(new Date(`${today}T00:00:00.000Z`));
  return (
    <div className="site-shell theme-ocean">
      <header className="site-header">
        <div className="header-identity">
          <Link className="brand" href="/" aria-label="Orcas vs Sharks home">
            <span className="brand-mark">◈</span>
            <span>
              ORCAS <span className="brand-vs">vs</span> SHARKS
            </span>
          </Link>
          <AccountLink />
        </div>
      </header>
      <main className="main-content">
        <nav className="lobby-links" aria-label="Explore">
          <Link href="/play">Play</Link>
          <Link href="/daily-puzzle">Daily Puzzle</Link>
          <Link href="/opening-explorer">Opening Explorer</Link>
        </nav>
        <div className="lobby-intro">
          <div>
            <p className="eyebrow">DAILY TACTICS</p>
            <h1>Daily Puzzle</h1>
            <p>
              {date === today ? "Today’s puzzle" : `Puzzle from ${date}`} ·{" "}
              {dailyPuzzleDifficulty(puzzle)}
            </p>
          </div>
          <SiteThemeSelect />
        </div>
        <DailyPuzzle
          date={date}
          puzzle={puzzle}
          registered={!!account && !account.is_guest}
          theme="ocean"
        />
        <section className="turn-card daily-archive">
          <h2>Puzzle archive</h2>
          <div className="lobby-links">
            {archive.map((archiveDate) => (
              <Link
                key={archiveDate}
                href={`/daily-puzzle?date=${archiveDate}`}
                aria-current={archiveDate === date ? "page" : undefined}
              >
                {archiveDate}
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
