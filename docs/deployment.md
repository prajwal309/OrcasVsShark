# Deploy Orcas vs Sharks on Vercel

The application runs as Next.js Node.js functions on Vercel. PostgreSQL holds
accounts, sessions, learning progress, matchmaking, game state, clocks, and
ratings across deployments. A new installation starts with an empty database.

## First deployment

1. In your Vercel project's **Storage** tab, connect a fresh Prisma Postgres
   database to the production environment. If you already provisioned an empty
   database, use that database. Set **PRISMA_DATABASE_URL** to its pooled
   `postgresql://` connection URL. Preserve the provider's TLS settings.
2. Set **PRISMA_MIGRATION_URL** to the same database's direct PostgreSQL URL
   if the provider supplies one. The build uses it for schema changes, falling
   back to `PRISMA_DATABASE_URL`. Use credentials authorized to create and
   alter tables. Runtime connections always use `PRISMA_DATABASE_URL`.
3. Set **APP_ORIGIN** in Production to
   `https://orcas-vs-shark.vercel.app` or your exact canonical HTTPS origin,
   without a trailing slash. Enable **Automatically expose System Environment
   Variables** in Vercel so the build can detect the Production environment.
   If you use a separate URL or database for previews, configure them in the
   Preview environment and migrate the preview database separately.
4. Generate a random secret with `openssl rand -hex 32` and set the result
   as **CRON_SECRET** in Production. Set **REQUIRE_SIGNUP_CODE=true** if you
   want invitation-only password signup. Google sign-in is optional and needs
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and the exact authorized
   redirect URL `APP_ORIGIN/api/account/google/callback`.
5. Select Node.js 22.x and the Next.js framework preset. Use the build command
   in `vercel.json` or set the dashboard override to `npm run vercel-build`.
   Trigger a production deployment of the commit. The build generates Prisma
   Client during installation, compiles the application, then applies pending
   migrations with `prisma migrate deploy` before Vercel serves the new release.
   If migration fails, the build fails. Subsequent deploys reuse the same database.

To migrate manually, first export the connection variables for the intended
environment into your shell. From the release checkout run the following.

```sh
npm ci
npm run db:deploy
```

Prisma applies only migrations that have not been recorded. Keep existing
migration files immutable after release. Use a test database to validate
future migrations and a provider backup or snapshot before production schema
changes. Keep schema changes compatible with the previous deployment during
rollouts. [Prisma production migrations](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)

Hosted `prisma+postgres://accelerate.prisma-data.net` URLs are accepted for
transition. Prisma retires this hosted endpoint on December 1, 2026. If the
integration currently provides that value, replace its value under the same
`PRISMA_DATABASE_URL` name with the provider's pooled PostgreSQL URL before
deploying. [Prisma Postgres connection transition](https://www.prisma.io/docs/postgres/database/switch-from-accelerate)

## Verify the release

- Check `/api/health` for HTTP 200 and `/api/ready` for HTTP 200 from the
  production origin. Readiness queries the migrated schema.
- Register through `/online?account=register#online-account` with a username,
  email, and password. Sign out and back in. A new profile should show 1500
  Elo in each time-control mode.
- Use two separate browser profiles to finish a ranked game. Check the result
  and both players' ratings, then verify the same account and result after
  a subsequent deployment.

## Ranked clock settlement

Room requests settle an expired clock immediately using its persisted deadline.
Returning to the lobby also settles an expired match that would block a new
search. The protected `GET /api/cron/ranked` endpoint settles unattended games
and does not depend on an in-process timer.

The committed Vercel schedule runs daily at 04:00 UTC and works on Hobby. On a
plan that supports minute-level schedules, change the schedule to
`* * * * *` for unattended results within about a minute, subject to invocation
timing. An external scheduler can call the same endpoint with the
`Authorization: Bearer <CRON_SECRET>` header. The deadline stored in the
result is the time the clock expired, independent of when settlement ran.
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)
[Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
