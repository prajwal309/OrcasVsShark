import Link from "next/link";
import { useId } from "react";
import { dailySolved, type DailyStatus } from "@/lib/daily/status";

const statusText: Record<DailyStatus, string> = {
  new: "New daily puzzle available",
  attempted: "Attempted today",
  solved: "Solved independently",
  hinted: "Solved with hints",
  revealed: "Solution revealed",
};

export function PuzzleMarker({ status }: { status: DailyStatus }) {
  if (status === "attempted") return null;
  return (
    <span className="puzzle-marker" data-status={status} aria-hidden="true">
      {dailySolved(status) ? (
        <svg viewBox="0 0 16 16">
          <path d="m4 8 2.5 2.5L12 5" />
        </svg>
      ) : status === "revealed" ? (
        <svg viewBox="0 0 16 16">
          <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4Z" />
          <circle cx="8" cy="8" r="1.25" />
        </svg>
      ) : null}
    </span>
  );
}

export function PuzzleNavigation({
  pathname,
  status,
  onNavigate,
}: {
  pathname: string;
  status: DailyStatus;
  onNavigate: () => void;
}) {
  const description = useId();
  return (
    <>
      <Link
        className="header-control header-feature"
        href="/daily-puzzle"
        aria-current={pathname === "/daily-puzzle" ? "page" : undefined}
        aria-label="Daily Puzzle"
        aria-describedby={description}
        title={statusText[status]}
        onClick={onNavigate}
      >
        <span className="header-puzzle-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 0 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" />
          </svg>
          <PuzzleMarker status={status} />
        </span>
        Daily Puzzle
        <span id={description} className="sr-only">
          {statusText[status]}
        </span>
      </Link>
    </>
  );
}
