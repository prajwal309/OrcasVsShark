"use client";

import Link from "next/link";
import { useAccount } from "@/components/navigation/account-navigation";
import { curriculum, getExercise } from "@/lib/learn/curriculum";
import { summarize } from "@/lib/learn/progress";
import type { BoardTheme } from "@/lib/presentation/board-themes";
import { activityHref, learningText } from "./presentation";
import { useProgress } from "./progress-provider";

const percentage = (value: number | null) =>
  value === null ? "—" : `${Math.round(value * 100)}%`;

export function LearningDashboard({ theme }: { theme: BoardTheme }) {
  const { username } = useAccount();
  const { progress, ready } = useProgress();
  if (!ready) return <p role="status">Loading progress…</p>;
  const stats = summarize(progress);
  const active = progress.current;
  const current = active && getExercise(active.kind, active.activityId);
  const best = stats.ranking[0];
  const weakest = [...stats.ranking].sort(
    (a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts,
  )[0];
  const nextLesson = stats.nextLesson;
  const nextPuzzle = stats.nextPuzzle;
  return (
    <section aria-labelledby="progress-title" className="academy-dashboard">
      <div>
        <h2 id="progress-title">My progress</h2>
        {username ? (
          <p>Saved to your account.</p>
        ) : (
          <p>
            Saved in this browser.{" "}
            <Link href="/online#online-account">Sign in</Link> to track account
            progress across devices.
          </p>
        )}
      </div>
      <dl className="academy-stats">
        <div className="turn-card">
          <dt>Lessons completed</dt>
          <dd>
            {stats.lessons} / {curriculum.lesson.length}
          </dd>
        </div>
        <div className="turn-card">
          <dt>Puzzles solved</dt>
          <dd>
            {stats.puzzles} / {curriculum.puzzle.length}
          </dd>
        </div>
        <div className="turn-card">
          <dt>Puzzle success rate</dt>
          <dd>{percentage(stats.accuracy)}</dd>
        </div>
        <div className="turn-card">
          <dt>Current puzzle streak</dt>
          <dd>{progress.streak}</dd>
        </div>
        <div className="turn-card">
          <dt>Puzzle points</dt>
          <dd>{stats.points}</dd>
        </div>
      </dl>
      <div className="academy-columns">
        <section className="turn-card">
          <h3>Continue learning</h3>
          <ul className="academy-list">
            {active && current && (
              <li>
                {active.kind === "lesson" ? "Current lesson" : "Last activity"}{" "}
                <Link href={activityHref(active.kind, current.id)}>
                  {learningText(current.title, theme)}
                </Link>
              </li>
            )}
            <li>
              Recommended lesson{" "}
              {nextLesson ? (
                <Link href={activityHref("lesson", nextLesson.id)}>
                  {learningText(nextLesson.title, theme)}
                </Link>
              ) : (
                <strong>All lessons completed</strong>
              )}
            </li>
            <li>
              Recommended puzzle{" "}
              {nextPuzzle ? (
                <Link href={activityHref("puzzle", nextPuzzle.id)}>
                  {nextPuzzle.title}
                </Link>
              ) : (
                <strong>All puzzles solved</strong>
              )}
            </li>
          </ul>
        </section>
        <section className="turn-card">
          <h3>Tactical strengths</h3>
          {best ? (
            <ul className="academy-list">
              <li>
                Strongest category{" "}
                <strong>
                  {best.category} · {percentage(best.accuracy)}
                </strong>
              </li>
              {weakest && weakest.accuracy !== best.accuracy && (
                <li>
                  Weakest category{" "}
                  <strong>
                    {weakest.category} · {percentage(weakest.accuracy)}
                  </strong>
                </li>
              )}
              {weakest &&
                stats.ranking.length > 1 &&
                weakest.accuracy === best.accuracy && (
                  <li>
                    All attempted categories are tied at{" "}
                    {percentage(best.accuracy)}.
                  </li>
                )}
              {stats.ranking.length === 1 && (
                <li>Try a second category to compare your results.</li>
              )}
            </ul>
          ) : (
            <p>Attempt puzzles to see results by category.</p>
          )}
        </section>
        <section className="turn-card">
          <h3>Achievements</h3>
          <ul className="academy-badges">
            {stats.achievements.map((badge) => (
              <li key={badge.title} data-earned={badge.earned || undefined}>
                <span aria-hidden="true">{badge.earned ? "✓" : "◇"}</span>
                {badge.title}
                <span className="academy-sr-only">
                  {badge.earned ? " (earned)" : " (locked)"}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="turn-card">
          <h3>Recently completed</h3>
          {stats.recent.length ? (
            <ul className="academy-list">
              {stats.recent.map(({ kind, exercise, at }) => (
                <li key={`${kind}:${exercise.id}`}>
                  <Link href={activityHref(kind, exercise.id)}>
                    {learningText(exercise.title, theme)}
                  </Link>
                  <time dateTime={new Date(at).toISOString()}>
                    {new Date(at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p>Completed lessons, puzzles, and knowledge checks appear here.</p>
          )}
        </section>
      </div>
    </section>
  );
}
