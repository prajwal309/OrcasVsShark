import Link from "next/link";
import { AccountLink } from "@/components/navigation/account-navigation";
import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import { OpeningExplorer } from "@/components/openings/opening-explorer";

export default function OpeningExplorerPage() {
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
            <p className="eyebrow">COMPLETED-GAME DATA</p>
            <h1>Opening Explorer</h1>
            <p>Explore legal move sequences from the standard position.</p>
          </div>
          <SiteThemeSelect />
        </div>
        <OpeningExplorer />
      </main>
    </div>
  );
}
