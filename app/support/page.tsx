import type { Metadata } from "next";
import { AccountLink } from "@/components/navigation/account-navigation";
import { GameHeader } from "@/components/navigation/game-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import styles from "./support.module.css";

export const metadata: Metadata = {
  title: "Support Baghchal",
  description:
    "Support an independent passion project preserving Nepal's traditional Baghchal strategy game and bringing it to players worldwide.",
};

const milestones = [
  {
    amount: "$100",
    title: "Keep the Game Running",
    allocations: [
      "Domain registration and DNS renewal.",
      "Application hosting and database infrastructure.",
      "Ongoing maintenance, reliability, and essential updates.",
    ],
  },
  {
    amount: "$500",
    title: "Improve the Gaming Experience",
    allocations: [
      "Stronger and more challenging computer opponents.",
      "Daily puzzles and opening exploration.",
      "Mobile layout and touch interaction improvements.",
      "Accessibility refinements for keyboard and assistive technology users.",
    ],
  },
  {
    amount: "$1,000",
    title: "Grow the Community",
    allocations: [
      "Online tournaments and organized community play.",
      "Multilingual game interface and learning materials.",
      "Educational resources about Baghchal and how to play.",
      "Community outreach to introduce the game to new players.",
    ],
  },
  {
    amount: "$2,500",
    title: "Bring Baghchal to Mobile",
    allocations: [
      "Dedicated Android and iOS applications.",
      "Advanced game analysis and study tools.",
      "Scalable infrastructure to support a growing player community.",
    ],
  },
];

export default function SupportPage() {
  return (
    <div className="site-shell theme-ocean">
      <GameHeader account={<AccountLink />} />
      <main className={`main-content ${styles.page}`}>
        <section className={styles.hero} aria-labelledby="support-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>AN INDEPENDENT PASSION PROJECT</p>
            <h1 id="support-title">Preserve a Tradition. Build Its Future.</h1>
            <p>
              Love a good strategy game? This independent passion project
              celebrates Nepal&apos;s traditional Baghchal and makes it easy for
              people everywhere to play. Thanks for being part of it.
            </p>
          </div>
          <aside className={styles.supportCard}>
            <p>Help keep the project growing</p>
            <a
              className={`primary-button ${styles.coffeeButton}`}
              href="https://buymeacoffee.com/fznfire"
              target="_blank"
              rel="noopener noreferrer"
            >
              Buy Me a Coffee <span aria-hidden="true">↗</span>
            </a>
            <small>Baghchal will always be free to play.</small>
          </aside>
        </section>

        <p className={styles.promise}>
          Every contribution helps preserve a piece of Nepal&apos;s cultural
          heritage while building a modern gaming experience for future
          generations. Baghchal will remain free to play, regardless of whether
          you contribute.
        </p>

        <section
          className={styles.milestoneSection}
          aria-labelledby="milestones-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>PLANNED ALLOCATIONS</p>
              <h2 id="milestones-title">Funding milestones</h2>
            </div>
            <p>
              Milestones are cumulative: each target includes the planned work
              from earlier milestones.
            </p>
          </div>

          <div className={styles.milestones}>
            {milestones.map(({ amount, title, allocations }) => (
              <details className={styles.milestone} key={amount}>
                <summary>
                  <span className={styles.amount}>{amount}</span>
                  <span className={styles.milestoneTitle}>{title}</span>
                  <span className={styles.toggle} aria-hidden="true" />
                </summary>
                <div className={styles.breakdown}>
                  <p>
                    <strong>Planned use at this cumulative milestone</strong>
                  </p>
                  <ul>
                    {allocations.map((allocation) => (
                      <li key={allocation}>{allocation}</li>
                    ))}
                  </ul>
                </div>
              </details>
            ))}
          </div>
        </section>

        <p className={styles.disclosure}>
          These milestones describe planned allocations, not actual spending or
          confirmed budgets. This page does not display donation totals,
          supporter counts, or funding progress.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
