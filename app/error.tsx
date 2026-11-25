"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="learn-page">
      <h1>A ripple in the water.</h1>
      <p>
        GridLox Games couldn’t load this page. Try again to get back to your
        game.
      </p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
