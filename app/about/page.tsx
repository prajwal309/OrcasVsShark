import type { Metadata } from "next";
import Link from "next/link";
import { AccountLink } from "@/components/navigation/account-navigation";
import { GameHeader } from "@/components/navigation/game-header";
import { GridLoxLogo } from "@/components/navigation/gridlox-logo";
import { SiteFooter } from "@/components/navigation/site-footer";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About",
  description:
    "Meet Prajwal Niraula, the developer behind GridLox Games, and learn how the project brings computer opponents, competitive play, and strategy training together.",
};

const repository = "https://github.com/prajwal309/OrcasVsShark";
const developerLinks = [
  { label: "GitHub repository", href: repository },
  // Add verified LinkedIn and personal website URLs here when available.
];

const features = [
  {
    title: "Intelligent computer opponents",
    description:
      "Play either side against a computer opponent at three difficulty levels.",
    href: "/play?opponent=computer",
  },
  {
    title: "Online and competitive play",
    description:
      "Invite a friend to a private room or compete in timed, ranked matches with Elo ratings.",
    href: "/online",
  },
  {
    title: "Daily puzzles and progressive hints",
    description:
      "Work through a daily tactical challenge, reveal hints as needed, and replay the solution.",
    href: "/daily-puzzle",
  },
  {
    title: "Algorithm and gameplay development",
    description:
      "Refine the search algorithms and gameplay through testing and player feedback.",
  },
];

export default function AboutPage() {
  return (
    <div className="site-shell theme-ocean">
      <GameHeader account={<AccountLink />} />
      <main className={`main-content ${styles.content}`}>
        <div className={styles.hero}>
          <div>
            <h1>About GridLox Games</h1>
            <p>
              A strategy gaming project that brings together human opponents,
              computer search, and hands-on learning. Its first game,{" "}
              <em>Orcas vs Sharks</em>, adapts Nepal’s traditional game of Bagh
              Chal for the web.
            </p>
          </div>
          <GridLoxLogo variant="landing" />
        </div>

        <section
          className={styles.section}
          id="developer"
          aria-labelledby="developer-title"
        >
          <h2 id="developer-title">About the Developer</h2>
          <div className={styles.copy}>
            <h3>Prajwal Niraula</h3>
            <p>
              Prajwal is an astrophysicist, computational scientist, and
              MIT-trained researcher. His interests include artificial
              intelligence, mathematical modeling, algorithms, and
              entrepreneurship.
            </p>
            <p>
              He is interested in building applications where computational
              intelligence supports strategic thinking. GridLox Games gives
              players an interactive way to try that idea by making decisions on
              a board, testing them against an opponent, and learning from the
              result.
            </p>
            <ul
              className={styles.links}
              aria-label="Project and developer links"
            >
              {developerLinks.map(({ label, href }) => (
                <li key={href}>
                  <a href={href}>{label}</a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className={styles.section}
          id="project"
          aria-labelledby="project-title"
        >
          <h2 id="project-title">About the Project</h2>
          <div className={styles.copy}>
            <p>
              GridLox makes strategy games easy to start and rewarding to study.
              In Orcas vs Sharks, new players can learn the basics one move at a
              time, while experienced players can study tactical positions,
              solve challenges, and compete online.
            </p>
            <ul className={styles.features} aria-label="Project features">
              {features.map(({ title, description, href }) => (
                <li key={title}>
                  <h3>{href ? <Link href={href}>{title}</Link> : title}</h3>
                  <p>{description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className={styles.section}
          id="contact"
          aria-labelledby="contact-title"
        >
          <h2 id="contact-title">Contact &amp; Feedback</h2>
          <div className={styles.copy}>
            <p>
              Found a bug or have an idea for the game, puzzles, or learning
              tools? Share it in the project’s GitHub issue tracker.
            </p>
            <a className={styles.feedback} href={`${repository}/issues`}>
              Share feedback on GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
