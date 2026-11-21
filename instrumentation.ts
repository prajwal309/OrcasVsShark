export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const { sqliteDisabled } = await import("./lib/deployment");
    if (sqliteDisabled()) return;

    // This worker runs only on the persistent Node process. Its first database
    // attempt runs after instrumentation returns, and can recover from errors.
    try {
      const { startRankedClockWorker } =
        await import("./lib/multiplayer/clock-worker");
      startRankedClockWorker();
    } catch (error) {
      console.error("Could not start the ranked clock worker", error);
    }
  }
}
