# Self-hosted multiplayer

## Run locally

Use Node.js 22 from the repository root.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000`. Select **Create an account** and enter a unique
username, a password of at least eight characters, and the same password again.
Sign in and choose **Find opponent** for matchmaking or **Create Game** for a
private room. Share its link or eight-character code with a second player.
Use a different browser or browser profile for that player on the same device.
Local and computer games are available without signing in.

The server opens `data/orcas.db` and applies the numbered migrations in
`database/sqlite/` at startup. Set `SQLITE_PATH` in `.env.local` to override the
path. Relative paths resolve from the repository root. The app uses foreign keys,
WAL mode, and a five-second busy timeout. A native build toolchain may be needed
when the SQLite driver has no prebuilt binary for the platform.

## Run on a server

Use a single self-hosted Node.js instance and a persistent local volume.
Set `SQLITE_PATH` to a private location on that volume. Put the app behind an
HTTPS reverse proxy and set `APP_ORIGIN` to the exact public origin, without a
trailing slash. Both devices should use that address. HTTP origin fallback is
limited to loopback addresses for development.

```sh
npm run build
npm start
```

SQLite is unsuitable for distributed or multi-instance serverless hosting,
ephemeral filesystems, and network filesystems shared between replicas. All
online players use the same server. Keep the database and backups outside
`public/` and grant filesystem access only to the server and its operator.

## Accounts and recovery

Password signup is open by default. Set `REQUIRE_SIGNUP_CODE=true` to require a
single-use signup code. Codes issued with the command below expire after 24 hours.

```sh
npm run account:code -- invite
npm run account:code -- reset PLAYER_USERNAME
```

Share reset codes privately. The player chooses **Use a reset code** at
`/online` and sets a new password. The code expires after 30 minutes, can be used
once, and revokes all of the player's previous sessions while keeping their
account ID and room seats.

Google sign-in is enabled only when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are set. Register the exact `APP_ORIGIN` plus
`/api/account/google/callback` as the authorized redirect URI for the Google OAuth
web client. A first-time Google account always requires a signup code. Existing
Google accounts are identified by their provider subject.

Passwords use salted scrypt. SQLite keeps only the SHA-256 hash of each random
session token. Cookies are HttpOnly and SameSite=Lax, with Secure enabled on
HTTPS. Sessions expire after 14 days and the browser receives a fresh token when
it authenticates. Authentication and room requests are rate-limited, and
mutation requests require a matching browser origin.

## Rooms and storage

Room actions use an immediate SQLite write transaction. The server checks the
player's seat, turn, revision, and ply, then validates moves with the rules engine.
The snapshot, move history, and request receipt commit together. Replaying a
request ID returns the current view without applying the action again. Browsers
poll for updates and refresh on focus or reconnect. A disconnect does not forfeit
the game.

The schema keeps accounts, sessions, signup and reset codes, and rate-limit
buckets. Games store player IDs, state, derived status, and timestamps. Moves
are append-only, completed rounds are archived before rematches, and matchmaking
entries and request receipts are persisted separately.

## Backups and restore

Back up before upgrading or applying new migrations. Use SQLite's online backup
command, or stop the server before copying a database file and keep its WAL
and SHM sidecars together if they are present. Copying the main file alone while
the app is running can miss committed transactions. Run the following with the
SQLite CLI against your configured path, and protect the resulting file like the
live database.

```sh
sqlite3 data/orcas.db ".backup data/orcas-backup.db"
```

To restore, stop the server, move the current database and its sidecars to a
safe location, and restore the backup at the configured path. Restart to apply
any pending migrations.

## Import an existing PostgreSQL database

The original SQL migrations remain in `database/migrations/`. The optional
export/import supports a PostgreSQL source with those three migrations applied.
Stop the old app to prevent writes after the snapshot. Run the export with a
`psql` account allowed to read all app tables. Start with an empty SQLite
database and keep the export private.

```sh
mkdir -p data
umask 077
psql -XqAt -f database/export-postgres.sql > data/postgres.ndjson
node --env-file-if-exists=.env.local scripts/import-postgres.mjs data/postgres.ndjson
```

The export uses standard PostgreSQL client connection settings and reads a
consistent snapshot. The importer reads the export into memory and imports it
in one SQLite transaction. It preserves account IDs, password hashes, Google
subjects, session hashes and expirations, room and move history, rate-limit
records, and matchmaking data. Existing session cookies can resume when the
browser still sends them to the app. The PostgreSQL schema had no creation time
for accounts or sessions, so those rows receive the import time. Timestamps
convert to Unix seconds with millisecond precision. PostgreSQL roles and row-level
security are replaced by server-side authorization and filesystem permissions.
Older schemas such as the anonymous Supabase prototype require a separate export.

## Verify

`npm run test:online` builds and starts the production app using an isolated
temporary SQLite database, then runs the multiplayer and account suite in
desktop and mobile Chromium. The suite covers both game victories, concurrent
moves, replay protection, reconnects, draws, resignation, rematches, private-room
access, matchmaking, and account session lifecycle.
