export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export type DailyStatus =
  "new" | "attempted" | "solved" | "hinted" | "revealed";
export type DailyProgress = { status: DailyStatus; hintsUsed: number };

export type DailyAction = {
  action: "attempt" | "hint" | "stage" | "reveal";
  answer?: string | number;
  opening?: string | null;
  hintsUsed: number;
  seconds: number;
};

export const newDailyProgress: DailyProgress = { status: "new", hintsUsed: 0 };

export function dailySolved(status: DailyStatus) {
  return status === "solved" || status === "hinted";
}

export function applyDailyAction(
  current: DailyProgress,
  event: DailyAction,
  correct: boolean,
): DailyProgress {
  const hintsUsed = Math.max(current.hintsUsed, event.hintsUsed);
  const { status } = current;
  if (dailySolved(status) || status === "revealed")
    return { status, hintsUsed };
  if (event.action === "reveal") return { status: "revealed", hintsUsed };
  if (event.action === "attempt" && correct)
    return { status: hintsUsed > 0 ? "hinted" : "solved", hintsUsed };
  if (event.action === "hint") return { status, hintsUsed };
  return { status: "attempted", hintsUsed };
}
