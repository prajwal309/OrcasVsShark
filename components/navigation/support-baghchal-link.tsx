import { useId } from "react";
import Link from "next/link";

export function SupportBaghchalLink({
  className = "",
  goalId,
}: {
  className?: string;
  goalId?: string;
}) {
  const generatedId = useId();
  const tooltipId = goalId ?? `support-goal-${generatedId}`;

  return (
    <Link
      className={`lobby-secondary-button lobby-support-cta ${className}`.trim()}
      href="/support"
      aria-label="Support Baghchal"
      aria-describedby={tooltipId}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 13.2c-1.4-1.1-4.8-3.5-4.8-6.1a2.8 2.8 0 0 1 4.8-1.9 2.8 2.8 0 0 1 4.8 1.9c0 2.6-3.4 5-4.8 6.1Z" />
        <path d="m3 13.4 2.6-.1 4.2 2.5c.8.5 1.8.6 2.7.2l7.2-3.3a1.4 1.4 0 0 1 1.2 2.5l-7.5 4a4.7 4.7 0 0 1-4.5-.1l-5.9-3.4" />
      </svg>
      <span>Support Baghchal</span>
      <span className="lobby-support-tooltip" id={tooltipId} role="tooltip">
        Our next goal is to help cover the server rental.
      </span>
    </Link>
  );
}
