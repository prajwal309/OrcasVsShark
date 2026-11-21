export function appOrigin() {
  const vercelHost =
    (process.env.VERCEL_ENV === "production" &&
      process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    process.env.VERCEL_URL;
  const configured =
    process.env.APP_ORIGIN ||
    (vercelHost ? `https://${vercelHost}` : "http://localhost:3000");
  const origin = URL.parse(configured);
  const loopback =
    origin && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (
    !origin ||
    origin.origin !== configured ||
    (origin.protocol !== "https:" && !(origin.protocol === "http:" && loopback))
  )
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin or a local HTTP origin, without a trailing slash.",
    );

  return origin;
}
