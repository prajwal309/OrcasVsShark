import Link from "next/link";
import { Rules } from "@/components/game/game";
export default function Learn() {
  return (
    <main className="learn-page">
      <Link href="/play">← Back to the ocean table</Link>
      <p className="eyebrow">ROOTED IN NEPAL</p>
      <h1>
        An ancient game.
        <br />A new ocean.
      </h1>
      <Rules />
      <Link className="primary-button" href="/play">
        Play a local game →
      </Link>
    </main>
  );
}
