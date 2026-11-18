# Self-hosted casual multiplayer

The home page opens the play lobby. Next.js handles sign-in, casual matchmaking, and private rooms at `/` and `/online`. PostgreSQL stores
accounts, sessions, games, and moves. Players can sign in from another browser
or device and reclaim their seat with the same account.

## Start on localhost

Use Node.js 22 and a running local PostgreSQL instance with the `psql` client.
Run the setup from the repository root. The PostgreSQL administrator account
is often `postgres` or the local operating system username.

1. Open `psql -d postgres` as your PostgreSQL administrator. Create a dedicated
   database and application login. The password command prompts without
   embedding the password in the SQL.

   ```sql
   CREATE ROLE orcas_app LOGIN;
   \password orcas_app
   CREATE DATABASE orcas_dev;
   ```

   Enter `\q` to exit. Apply the migration and grants once as the database
   owner or administrator.

   ```sh
   psql -d orcas_dev -v ON_ERROR_STOP=1 -f database/migrations/001_multiplayer.sql
   psql -d orcas_dev -v ON_ERROR_STOP=1 -f database/grant-local-app.sql
   psql -d orcas_dev -v ON_ERROR_STOP=1 -f database/migrations/002_matchmaking.sql
   psql -d orcas_dev -v ON_ERROR_STOP=1 -f database/migrations/003_google_accounts.sql
   ```

2. Copy `.env.example` to `.env.local` and set the connection string. Replace
   `replace-me` with the application role password. URL-encode special
   characters in the password.

   ```dotenv
   DATABASE_URL=postgresql://orcas_app:replace-me@127.0.0.1:5432/orcas_dev
   APP_ORIGIN=http://localhost:3000
   ```

3. Install dependencies, issue one signup code per player, and start the app.

   ```sh
   npm ci
   npm run account:code -- invite
   npm run account:code -- invite
   npm run dev
   ```

4. Open <http://localhost:3000/> in two browser profiles or a regular and
   a private window. Select **Login** next to the logo, then choose
   **Use a signup code** in each. Enter a distinct
   username, a password of at least 12 characters, and one of the codes.
   Select **Find opponent** in both profiles to pair through the lobby. To
   play privately instead, select **Create Game** in the first browser and
   open the room link in the second. Sharks move first in both modes.

After sign-in, your username appears next to the logo. Select it to return to
the online lobby or sign out.

Local two-player and computer play at `/play` need no account or database.
`localhost` reaches only the machine running the browser. For another device,
serve Next.js behind HTTPS on a reachable address and set `APP_ORIGIN` to
that exact origin with no trailing slash. Keep PostgreSQL private.

## Matchmaking

For an existing self-hosted database, apply only
`database/migrations/002_matchmaking.sql` as the database owner before updating the
app. It adds the queue and grants access to the existing `orcas_app` role.

The queue matches the oldest active opponent. The first player takes Orcas
and the second takes Sharks. The lobby checks for a match about once per second
and opens the shared room automatically. Canceling removes an unmatched entry.
Waiting entries expire after 20 seconds without a heartbeat. Reloading before
expiry resumes the search. If a room was created while a player was briefly
offline, the lobby retains their assignment for up to 10 minutes or until
they open the room.

## Optional Google sign-in

For an existing database, apply `database/migrations/003_google_accounts.sql`
after the matchmaking migration. Username and password signup also uses the
updated schema.

Create a **Web application** OAuth client in Google Cloud. Register
`http://localhost:3000/api/account/google/callback` as an authorized redirect URI,
or use the exact HTTPS `APP_ORIGIN` followed by `/api/account/google/callback`
for a hosted environment. If the OAuth app is in testing mode, add the Google
accounts you plan to use as test users. Put the client ID and secret in
`.env.local` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart
Next.js. [Google OAuth web server setup](https://developers.google.com/identity/protocols/oauth2/web-server)

Choose **Create account with Google** the first time and supply an available
username and a single-use signup code. Choose **Sign in with Google** on
subsequent visits. The app stores Google's stable account identifier. Existing
password accounts keep their usernames and credentials. Google sign-in cannot
claim a password account by matching names. A duplicate username leaves the
signup code usable with a different username.

## Accounts and rooms

Signup codes expire after 24 hours and can be used once. To help a player
recover access, issue a reset code and share it privately.

```sh
npm run account:code -- reset PLAYER_USERNAME
```

The player chooses **Use a reset code** at `/online` and enters a new password.
The code expires after 30 minutes and using it revokes the account's existing
sessions. The player keeps their account ID and room seats.

Passwords use salted scrypt hashes. Session tokens are stored as hashes in
PostgreSQL and sent to the browser in HTTP-only cookies that expire after
14 days. HTTPS origins use Secure cookies. Account endpoints rate-limit
credential attempts and mutation endpoints check the browser's origin.

The app resolves the player from the session before reading or changing a
room. A move transaction checks the seat, turn, revision, and ply, validates the
move with the rules engine, and commits the move and snapshot together. Request
IDs make retries idempotent. Browsers poll every two seconds and refresh
on focus or reconnect. A disconnect updates presence and does not forfeit
the game.

The first migration initializes a fresh database. If you have an older Supabase
database with games to preserve, keep a backup. Transferring games or claiming
anonymous seats under named accounts requires a separate migration.

## Verify

`npm run test:online` runs the production Next.js API with an isolated
PostgreSQL-compatible PGlite test database. It exercises account signup,
sign-in from another browser, seat recovery, reset and revocation, matchmaking and room sync,
both game victories, draws, resignation, and rematches. Use the localhost setup
above to verify your own PostgreSQL instance and application-role credentials.
