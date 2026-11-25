import { GameHeader } from "@/components/navigation/game-header";
import { AccountLink } from "@/components/navigation/account-navigation";
import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import { DailyPuzzle } from "@/components/daily/daily-puzzle";
import "../learn/academy.css";
import {
  dailyPuzzleDifficulty,
  dailyPuzzleForDate,
  utcDateString,
} from "@/lib/daily/puzzles";
import { pageSessionAccount } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily Puzzle" };

export default async function DailyPuzzlePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = utcDateString();
  const dateParam = (await searchParams).date;
  const requested = dateParam ?? today;
  let date = today;
  let puzzle;
  try {
    puzzle = dailyPuzzleForDate(requested);
    date = requested;
  } catch {
    puzzle = dailyPuzzleForDate(today);
  }
  const account = await pageSessionAccount();
  return (
    <div className="site-shell theme-ocean">
      <GameHeader account={<AccountLink />} />
      <main className="main-content">
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
          followToday={!dateParam || date !== requested}
          puzzle={puzzle}
          registered={!!account && !account.is_guest}
          theme="ocean"
        />
      </main>
    </div>
  );
}
