import Link from "next/link";
import { GridLoxLogo } from "./gridlox-logo";

export function SiteBrand() {
  return (
    <Link className="brand" href="/" aria-label="GridLox Games home">
      <GridLoxLogo variant="header" />
      <span className="brand-wordmark" aria-hidden="true">
        <strong>GridLox</strong>
        <span>Games</span>
      </span>
    </Link>
  );
}
