"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="learn-page">
      <h1>A ripple in the water.</h1>
      <p>The game couldn’t load. Try again to restore your saved local game.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
