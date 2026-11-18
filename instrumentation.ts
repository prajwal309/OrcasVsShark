export function register() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return;
  const database = parseUrl(databaseUrl);
  if (!["postgres:", "postgresql:"].includes(database.protocol))
    throw new Error("DATABASE_URL must be a PostgreSQL connection string.");

  const value = process.env.APP_ORIGIN ?? "http://localhost:3000";
  const origin = parseUrl(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(
    origin.hostname,
  );
  if (
    origin.origin !== value ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback))
  )
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin or a local HTTP origin, without a trailing slash.",
    );
}

function parseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error("Invalid database or application origin configuration.");
  }
}
