"use client";

import Link from "next/link";
import { GameHeader } from "@/components/navigation/game-header";
import { useEffect, useState } from "react";
import { AccountLink } from "@/components/navigation/account-navigation";
import { Rules } from "@/components/game/rules";
import {
  curriculum,
  getExercise,
  type ActivityKind,
} from "@/lib/learn/curriculum";
import { levels } from "@/lib/learn/exercises";
import { isBoardTheme, type BoardTheme } from "@/lib/presentation/board-themes";
import { ExercisePlayer } from "./exercise-player";
import { LearningDashboard } from "./learning-dashboard";
import { GuidedPractice } from "./guided-practice";
import { activityHref, activitySection, learningText } from "./presentation";
import { useProgress } from "./progress-provider";

const themeKey = "orcas-academy-theme-v1";
export const academySections = {
  lessons: "Interactive Lessons",
  puzzles: "Tactical Puzzles",
  practice: "Guided Practice",
  progress: "My Progress",
} as const;
type Section = keyof typeof academySections;

const descriptions: Record<Section, string> = {
  lessons:
    "Learn the rules on the board, from your first placement to endgames.",
  puzzles: "Find captures, build traps, and work through forced replies.",
  practice: "Play the computer, get a suggestion, and review your decisions.",
  progress:
    "Continue where you left off and see how your tactics are developing.",
};

function Catalog({ kind, theme }: { kind: ActivityKind; theme: BoardTheme }) {
  const { progress } = useProgress();
  const groups = kind === "quiz" ? ["Knowledge checks"] : levels;
  return groups.map((group) => (
    <section className="academy-catalog-group" key={group} aria-label={group}>
      <h3>{group}</h3>
      <ul className="academy-cards">
        {curriculum[kind]
          .filter(({ level }) => kind === "quiz" || level === group)
          .map((exercise) => (
            <li key={exercise.id}>
              <Link
                className="turn-card academy-card"
                href={activityHref(kind, exercise.id)}
              >
                <h4>{learningText(exercise.title, theme)}</h4>
                {"category" in exercise &&
                  typeof exercise.category === "string" && (
                    <p>{exercise.category}</p>
                  )}
                <p>{learningText(exercise.objective, theme)}</p>
                {progress[kind][exercise.id]?.completedAt != null && (
                  <span className="academy-card-status">✓ Completed</span>
                )}
              </Link>
            </li>
          ))}
      </ul>
    </section>
  ));
}

export function Academy({
  section,
  activity,
}: {
  section?: string;
  activity?: string;
}) {
  const [theme, setTheme] = useState<BoardTheme>("ocean");
  const { progress, syncFailed, retrySync } = useProgress();
  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved =
          localStorage.getItem(themeKey) ??
          JSON.parse(localStorage.getItem("orcas-sharks.settings.v1") ?? "null")
            ?.theme;
        if (isBoardTheme(saved)) setTheme(saved);
      } catch {
        /* The default board is available when storage is disabled. */
      }
    });
  }, []);

  function changeTheme(next: BoardTheme) {
    setTheme(next);
    try {
      localStorage.setItem(themeKey, next);
    } catch {
      /* Apply for this visit. */
    }
  }

  const view =
    section && Object.hasOwn(academySections, section)
      ? (section as Section)
      : undefined;
  const kind: ActivityKind =
    view === "puzzles"
      ? "puzzle"
      : activity && getExercise("quiz", activity)
        ? "quiz"
        : "lesson";
  const exercise =
    activity && view === activitySection[kind]
      ? getExercise(kind, activity)
      : undefined;
  const next =
    exercise &&
    curriculum[kind][
      curriculum[kind].findIndex(({ id }) => id === exercise.id) + 1
    ];
  const active = progress.current;
  const resume =
    active && progress[active.kind][active.activityId]?.completedAt == null
      ? getExercise(active.kind, active.activityId)
      : undefined;
  const nextLesson = curriculum.lesson.find(
    ({ id }) => progress.lesson[id]?.completedAt == null,
  );
  const beginner = curriculum.lesson.filter(
    ({ level }) => level === "Beginner",
  );
  const beginnerComplete = beginner.filter(
    ({ id }) => progress.lesson[id]?.completedAt != null,
  ).length;

  return (
    <div className={`site-shell theme-${theme}`}>
      <GameHeader account={<AccountLink />} />
      <main className="academy main-content">
        <div className="academy-heading">
          <div>
            <h1>Learn to Play</h1>
            <p>Learn Baghchal one move at a time.</p>
          </div>
          <div className="academy-appearance">
            <label>
              Board theme
              <select
                value={theme}
                onChange={(event) => {
                  if (isBoardTheme(event.target.value))
                    changeTheme(event.target.value);
                }}
              >
                <option value="ocean">Orcas &amp; Sharks · Deep ocean</option>
                <option value="sand">Orcas &amp; Sharks · Sand table</option>
                <option value="tigers-goats">Tigers &amp; Goats</option>
              </select>
            </label>
          </div>
        </div>
        <nav className="academy-nav" aria-label="Academy">
          {(Object.keys(academySections) as Section[]).map((tab) => (
            <Link
              key={tab}
              href={`/learn?section=${tab}`}
              aria-current={view === tab ? "page" : undefined}
            >
              {academySections[tab]}
            </Link>
          ))}
        </nav>
        {syncFailed && (
          <div className="academy-hint" role="status">
            Account progress is waiting to sync.{" "}
            <button onClick={retrySync}>Retry sync</button>
          </div>
        )}
        {exercise ? (
          <>
            <Link className="academy-back" href={`/learn?section=${view}`}>
              ← {academySections[view!]}
            </Link>
            <ExercisePlayer
              key={`${kind}:${exercise.id}`}
              exercise={exercise}
              kind={kind}
              next={next}
              theme={theme}
            />
          </>
        ) : view === "practice" ? (
          <GuidedPractice theme={theme} />
        ) : view === "progress" ? (
          <LearningDashboard theme={theme} />
        ) : view ? (
          <section className="academy-catalog">
            <h2>{academySections[view]}</h2>
            <p>{descriptions[view]}</p>
            {activity && (
              <p role="status">
                That activity is unavailable. Choose an activity below.
              </p>
            )}
            <Catalog kind={kind === "quiz" ? "lesson" : kind} theme={theme} />
            {view === "lessons" && <Catalog kind="quiz" theme={theme} />}
          </section>
        ) : (
          <>
            <section
              className="academy-start turn-card"
              aria-label="Beginner course"
            >
              <div>
                <h2>Beginner course</h2>
                <p>
                  {beginnerComplete} of {beginner.length} lessons complete
                </p>
                <progress
                  value={beginnerComplete}
                  max={beginner.length}
                  aria-label="Beginner course progress"
                />
              </div>
              {resume && active ? (
                <Link
                  className="primary-button"
                  href={activityHref(active.kind, resume.id)}
                >
                  Resume {learningText(resume.title, theme)}
                </Link>
              ) : nextLesson ? (
                <Link
                  className="primary-button"
                  href={activityHref("lesson", nextLesson.id)}
                >
                  {beginnerComplete ? "Continue lessons" : "Start first lesson"}
                </Link>
              ) : (
                <Link className="primary-button" href="/learn?section=puzzles">
                  Practice with puzzles
                </Link>
              )}
            </section>
            <ul className="academy-cards">
              {(Object.keys(academySections) as Section[]).map((tab) => (
                <li key={tab}>
                  <Link
                    className="turn-card academy-card"
                    href={`/learn?section=${tab}`}
                  >
                    <h2>{academySections[tab]}</h2>
                    <p>{descriptions[tab]}</p>
                  </Link>
                </li>
              ))}
            </ul>
            <details className="turn-card academy-rules">
              <summary>Full game rules</summary>
              <Rules theme={theme} />
            </details>
          </>
        )}
      </main>
    </div>
  );
}
