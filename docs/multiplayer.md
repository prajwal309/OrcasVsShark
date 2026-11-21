# Multiplayer

## Run locally

Use Node.js 22 from the repository root.

```sh
npm ci
cp .env.example .env.local
# Set PRISMA_DATABASE_URL in .env.local to an empty PostgreSQL database.
npm run db:deploy
npm run dev
```

Open `http://localhost:3000`. Select **Create an account** and enter a unique
username, email address, a password of at least eight characters, and the same password again.
Sign in and choose **Find opponent** for matchmaking or **Create Game** for a
private room. Share its link or eight-character code with a second player.
Use a different browser or browser profile for that player on the same device.
Local and computer games are available without signing in.

Use PostgreSQL 16 or newer for local multiplayer. See the [deployment runbook](deployment.md) for production environment variables and migration steps.

## Accounts and recovery

Password signup is open by default. Set `REQUIRE_SIGNUP_CODE=true` to require a
single-use signup code. Codes issued with the command below expire after 24 hours.

```sh
npm run account:code -- invite
npm run account:code -- reset PLAYER_USERNAME
```

Share reset codes privately. The player chooses **Forgot your password?** at
`/online` and sets a new password. The code expires after 30 minutes, can be used
once, and revokes all of the player's previous sessions while keeping their
account ID and room seats.

Google sign-in is enabled only when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set. Register the exact `APP_ORIGIN` plus
`/api/account/google/callback` as the authorized redirect URI for the Google OAuth
web client. A first-time Google account always requires a signup code. Existing
Google accounts are identified by their provider subject.

Passwords use salted Argon2id. PostgreSQL keeps only the SHA-256 hash of each random
session token. Cookies are HttpOnly and SameSite=Lax, with Secure enabled on
HTTPS. Sessions expire after 14 days and the browser receives a fresh token when
it authenticates. Authentication and room requests are rate-limited, and
mutation requests require a matching browser origin.

## Rooms and storage

Room actions use a serializable PostgreSQL transaction. The server checks the
player's seat, turn, revision, and ply, then validates moves with the rules engine.
The snapshot, move history, and request receipt commit together. Replaying a
request ID returns the current view without applying the action again. Browsers
poll for updates and refresh on focus or reconnect. A disconnect does not forfeit
the game.

The schema keeps accounts, sessions, signup and reset codes, and rate-limit
buckets. Games store player IDs, state, derived status, and timestamps. Moves
are append-only, completed rounds are archived before rematches, and matchmaking
entries and request receipts are persisted separately.

## Ranked play

Choose **Fast**, **Medium**, or **Classic** in the Ranked lobby to start
searching. Each preset has its own Elo pool and clock.

| Mode    | Starting time per player | Increment per legal move |
| ------- | ------------------------ | ------------------------ |
| Fast    | 3 minutes                | 5 seconds                |
| Medium  | 5 minutes                | 5 seconds                |
| Classic | 10 minutes               | 10 seconds               |

Matchmaking pairs eligible players within 100 Elo to start. Each player's
search window grows by 50 points every ten seconds, up to 400. Casual matching
and private rooms are untimed. Ranked games start as soon as a match is found,
with the Sharks clock running first. The clock continues on disconnect and
the opponent wins when time expires. Reopening the game or lobby restores the
same ranked seat. Persisted deadlines also allow the server to settle expired
games after a restart. To play another ranked match after a result, return to the
lobby.

Each rating starts at 1500. The server applies Elo with a fixed K-factor of 32
after a ranked win, loss, or draw. Match outcomes and both rating changes are
saved together in PostgreSQL. Profiles show per-mode records, total games, and recent finished
games. A player enters a mode's public leaderboard after the first finished
ranked game in that mode.

## Verify

Set `TEST_POSTGRES_URL` to a disposable PostgreSQL database with permission to create schemas. `npm run test:online` builds and starts the production app using an isolated
temporary PostgreSQL schema, then runs the multiplayer and account suite in
desktop and mobile Chromium. The suite covers both game victories, concurrent
moves, replay protection, reconnects, draws, resignation, rematches, private-room
access, matchmaking, and account session lifecycle.
