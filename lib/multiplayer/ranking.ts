import type { Side } from "@/lib/game/types";

export const rankedModes = ["fast", "medium", "classic"] as const;
export type RankedMode = (typeof rankedModes)[number];
export type MatchMode = RankedMode | "casual";

export const timeControls = {
  fast: { name: "Fast", minutes: 3, increment: 5 },
  medium: { name: "Medium", minutes: 5, increment: 5 },
  classic: { name: "Classic", minutes: 10, increment: 10 },
} as const satisfies Record<
  RankedMode,
  { name: string; minutes: number; increment: number }
>;

export const initialRating = 1500;

export function eloChange(
  rating: number,
  opponentRating: number,
  score: 0 | 0.5 | 1,
) {
  const expected = 1 / (1 + 10 ** ((opponentRating - rating) / 400));
  const raw = 32 * (score - expected);
  const rounded = Math.round(Math.abs(raw));
  return raw < 0 && rounded ? -rounded : rounded;
}

export const ratingWindowRules = {
  initial: 100,
  step: 50,
  stepMs: 10_000,
  maximum: 400,
} as const;

export function ratingWindow(waitMs: number) {
  const { initial, step, stepMs, maximum } = ratingWindowRules;
  return Math.min(
    maximum,
    initial + step * Math.floor(Math.max(0, waitMs) / stepMs),
  );
}

export type Clock = {
  remaining: Record<Side, number>;
  deadline: number | null;
};

export function startClock(mode: RankedMode, now: number): Clock {
  const base = timeControls[mode].minutes * 60_000;
  return { remaining: { orcas: base, sharks: base }, deadline: now + base };
}

export function clockAt(clock: Clock, turn: Side, now: number) {
  return clock.deadline === null
    ? clock.remaining
    : {
        ...clock.remaining,
        [turn]: Math.min(
          clock.remaining[turn],
          Math.max(0, clock.deadline - now),
        ),
      };
}

export function advanceClock(
  clock: Clock,
  mode: RankedMode,
  side: Side,
  next: Side,
  now: number,
  finished: boolean,
): Clock {
  const remaining = clockAt(clock, side, now);
  remaining[side] += timeControls[mode].increment * 1000;
  return { remaining, deadline: finished ? null : now + remaining[next] };
}

export type RankedView = {
  mode: RankedMode;
  sampledAt: number;
  remaining: Record<Side, number>;
  players: Record<
    Side,
    { username: string; rating: number; change: number | null }
  >;
};
