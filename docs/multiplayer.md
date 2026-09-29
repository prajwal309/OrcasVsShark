# Casual online rooms

This is the first, scoped Phase 3 increment: private invite rooms for two anonymous players, no rating, no clock, no chat, and no spectators. Local two-player play remains available at `/play` and needs no services. The existing canonical engine decides every online move.

## Start locally with Supabase

1. Create a dedicated development Supabase project. Do not use production credentials or player data.
2. In Supabase Authentication settings, enable anonymous sign-ins. The browser receives a unique authenticated player identity without collecting an email or password. Supabase Auth rate limits apply; configure abuse protection/CAPTCHA before a public launch.
3. Review and run `supabase/migrations/202609280001_online_rooms.sql` with the SQL editor or the Supabase migration workflow. It creates the room tables, read policies, append-only move protection, and adds `games` to the `supabase_realtime` publication. Apply it once. No existing tables are deleted.
4. Copy `.env.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`: project URL.
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable key (the legacy public anon key also works).
   - `DATABASE_URL`: server-only PostgreSQL connection URI from Supabase's Connect panel. Use the transaction pooler (port 6543) for Vercel. URL-encode password special characters and follow Supabase's TLS/certificate instructions. Do not disable certificate verification.
5. Run `npm ci`, then `npm run dev`. Open `http://localhost:3000/online`.
6. Click **Create Game**. The host is Orcas. Copy the displayed link or room code. In a separate browser profile/private window, open the link and click **Join Game**. That player is Sharks and moves first. Two tabs in the same browser profile share one identity and therefore one seat.

Anonymous authentication is stored by the Supabase client in browser storage. Refreshing or reopening the room in that browser restores the seat and fetches the committed state. Clearing site data, changing browser profiles, or changing the site's origin loses access to that identity. The invite URL identifies a room; it does not grant access to an occupied seat. Never share an access token.

## Play over the internet

Deploy a Vercel **preview** using the normal Next.js preset and Node 22, with all three environment variables configured for the preview environment before building. Use a development Supabase project. Both players open the same preview origin and share its `/game/XXXXXXXX` URL. `localhost` URLs are only usable on the same computer. A room created on one app origin may be inaccessible from another because the browser identity is stored per origin.

Verify the checklist below on the actual preview. Production deployment still requires approval and the broader release checklist in `AGENTS.md`.

## Authority and persistence

- The browser authenticates anonymously with Supabase and sends its bearer token to the Next API. The server verifies it using `auth.getUser(token)` on every request. The actor is never accepted from the request body.
- Creating a room reserves Orcas; joining atomically claims the remaining Sharks seat. A third player cannot read or change the match.
- A transaction locks the game row, checks request deduplication, verifies seat, revision, ply, game status and turn, and calls `applyMove`. It inserts the move audit record and updates the snapshot/result before commit. A competing stale action fails with HTTP 409.
- Retries use the same UUID and body. A successful retry returns the current committed room without repeating the action; reusing an ID with another body fails. The UI retains uncertain requests for explicit retry and disables other actions in the meantime.
- Supabase Postgres Changes informs seated clients of a new revision. Each client then fetches the authoritative snapshot; realtime payloads and local storage do not decide game state. A five-second heartbeat/poll recovers missed events, reconnects, and updates presence. Reads also resume on focus and network recovery.
- A player is shown as disconnected after 35 seconds without a successful heartbeat. This is a presence hint, not a forfeit. Sleeping/backgrounded tabs can appear disconnected. Seats remain reserved, and no timeout or abandonment result is inferred.
- Online undo is disabled. Resignation always applies to the authenticated player's own side, even on the other player's turn. Draw offers need the opponent's acceptance. A move clears a pending draw offer.
- A rematch requires both players, swaps sides, increments the round, and retains prior moves and completed rounds in the database. Revision numbers never reset, so delayed requests from a prior round fail.

API endpoints: `POST /api/rooms` takes `{ requestId }`; `GET /api/rooms/[code]` restores a seated player; `POST /api/rooms/[code]` takes `{ requestId, expectedPly, expectedRevision, action }`. Action kinds are `join`, `move`, `resign`, `offer-draw`, `accept-draw`, `decline-draw`, and `rematch`. Request schemas reject unknown fields and malformed moves. Bodies are capped at 4 KiB. Authenticated database rate limits are 6 creates, 90 actions, and 120 reads per actor per minute, shared across app instances. Rate-limit transactions commit independently of failed game actions.

Browser database roles have SELECT-only access to their seated games/moves/rounds and no write grants. Internal request and rate-limit tables have RLS and no browser policies. Privileged database credentials stay in server modules. Pages use nonce-based script CSP; connections are limited to the configured Supabase origin and its WebSocket counterpart. Local storage contains settings and the anonymous auth session, but never an authoritative online snapshot.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:online
```

Database tests execute the migration and production store against PGlite (PostgreSQL in WebAssembly), including RLS, both complete victories, idempotency, stale moves, seat authorization, draws, rematches and append-only audit records.

`test:online` builds into the ignored `.next-online` directory and runs two isolated browser contexts through the real Next API and PostgreSQL connection/transaction code. It supplies **test-only** Auth/Realtime protocol fixtures and a fresh PGlite database on loopback ports 54321 and 55432; the app runs on 3100. These fixtures are never imported by production code. They test application integration and recovery but do not certify the hosted Supabase Auth/Realtime service or multi-connection PostgreSQL lock behavior under production load. No test bypass flags or mock identities exist in application code.

Before handing a real invite link to players, verify with a development Supabase project and two separate browsers/devices:

- Create and join; both boards agree after each move and captures arrive immediately.
- Wrong-seat, out-of-turn, malformed, stale, duplicate and unauthenticated requests behave as tested.
- Refresh and disconnect/reconnect restore the same seat, current turn and committed state.
- Both victory results, resignation, draw agreement and rematch appear on both screens and survive refresh.
- Authenticated clients cannot directly update tables or read another room via the Supabase API.
- Mobile keyboard/touch play has no hidden controls or browser errors.

## Operations and scope limits

There is no production deployment or migration application in this change. Keep separate databases and credentials for preview and production. Back up the database before applying future migrations. Roll back the app to a compatible deployment; leave these additive tables intact. Do not delete move history as part of rollback. Configure secret-free error monitoring and database alerts before launch.

No email, profile name, chat text, or analytics is collected by the game. Supabase still stores anonymous user identifiers and authentication metadata. Establish a retention and account-deletion/anonymization procedure before public production use; do not cascade-delete the immutable game audit. Profiles, public challenges, ratings, blocks, reports and their migrations remain deferred until those features are introduced. This increment is not the full Phase 3 or rated-play release.

References: [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [node-postgres transactions](https://node-postgres.com/features/transactions), [PGlite socket test service](https://pglite.dev/docs/pglite-socket).

## Verification record — 2026-09-28

Typecheck, lint, formatting, production builds, and all engine/component/database tests passed. The local Playwright suite passed all 12 desktop/mobile cases; the online suite passed all 10 desktop/mobile cases with two isolated browser identities and the test services described above. A further database test verified expired opponent presence and recovery without changing the game. No hosted Supabase migration, live-service verification, or deployment was performed.
