import Link from "next/link";
export default function NotFound() {
  return (
    <main className="learn-page">
      <p className="eyebrow">OFF THE CHART</p>
      <h1>Uncharted waters.</h1>
      <p>This page doesn’t exist.</p>
      <Link href="/play">Return to the game →</Link>
    </main>
  );
}
