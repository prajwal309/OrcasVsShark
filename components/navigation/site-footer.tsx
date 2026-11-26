import Link from "next/link";
import { GridLoxLogo } from "./gridlox-logo";
import { SupportBaghchalLink } from "./support-baghchal-link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <GridLoxLogo variant="footer" />
          <p>© {new Date().getUTCFullYear()} GridLox Games</p>
        </div>
        <nav className="site-footer-links" aria-label="Footer">
          <Link href="/about">About</Link>
          <Link href="/about#project">The Project</Link>
          <SupportBaghchalLink className="site-footer-support" />
          <Link href="/about#contact">Contact &amp; Feedback</Link>
        </nav>
      </div>
    </footer>
  );
}
