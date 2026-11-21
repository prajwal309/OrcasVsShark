export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return;
    const value = process.env.APP_ORIGIN ?? "http://localhost:3000";
    const origin = new URL(value);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
      origin.hostname,
    );
    if (
      origin.origin !== value ||
      (origin.protocol !== "https:" &&
        !(origin.protocol === "http:" && loopback))
    )
      throw new Error(
        "APP_ORIGIN must be an HTTPS origin or a local HTTP origin, without a trailing slash.",
      );

    const { database } = await import("./lib/database/connection");
    database();
  }
}
