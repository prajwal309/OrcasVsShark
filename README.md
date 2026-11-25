# GridLox Games

GridLox Games is home to **Orcas vs Sharks**, an original ocean-themed adaptation of Bagh Chal, the traditional asymmetric strategy game of Nepal. Four Orcas capture and twenty Sharks surround.

## Current scope

The home screen opens the play lobby. Use **Play**, **How to Play**, or the **Settings** gear in the header. Choose **Setup** to pick your opponent. To resume a game on the same device, choose **Play** or **Play locally on one device**. The game includes a keyboard-accessible board, both victory conditions, legal move highlights, undo, move history, restart and rematches, board flip, rules, sound, three themes, animation preferences, draw agreement, resignation, and local refresh recovery.

The site defaults to **Royal Navy & Gold**. Use **Site appearance** in the lobby, Daily Puzzle, or game settings to switch to **Ivory & Navy**. The browser saves your selection separately from the board artwork preset.

Choose **Settings → Board theme → Tigers & Goats** for original Tiger and Goat pieces on a forest table. Names, rules and announcements follow the theme. Deep ocean and Sand table remain available. Theme choices are saved on this device and can be changed during local, computer or online games without restarting.

Moves include piece glides and capture leaps, arrival ripples, capture fades, and brief selection, turn and victory feedback. Animations never delay a move or block controls. Turn them off in **Settings → Animations**; the browser's reduced-motion preference always takes precedence.

A victory card announces the winning side with a short celebration. **Play again** starts a fresh local or computer game with the same computer settings. **View board** collapses the card to inspect the final position. Online games offer **Rematch**, requiring both players to agree before a new round begins.

Choose **Set up a computer game** from the lobby, or **Play against computer** on the local board. Choose your side and difficulty, then select **Start game**. Play either Orcas or Sharks at Easy, Medium or Hard difficulty. Search runs in a Web Worker, and games resume on refresh. Undo takes back your last move and the computer's reply. See [computer play](docs/computer.md).

Sign in to find a ranked opponent, play a casual match, or create a private room. Ranked play offers Fast, Medium, and Classic time controls with separate Elo ratings, public leaderboards, and player profiles. Online moves and clocks are server-authoritative and survive a reconnect. Casual rooms support mutual rematches. See [multiplayer setup](docs/multiplayer.md).

## Learn to Play

Open **Learn to Play** from the lobby or visit `/learn`. The Academy has 20
board lessons, 12 tactical puzzles, six knowledge checks, and guided practice
with the built-in computer opponent. Guests save learning progress in their
browser. Signed-in players save it to PostgreSQL and can resume from another device.
See the [Academy guide](docs/academy.md) for progress and authoring details.

## Daily Puzzle and Guest Play

Visit `/daily-puzzle` for the date-based tactical challenge, hints, retry,
and solution review. Past puzzles are available by UTC date using
`/daily-puzzle?date=YYYY-MM-DD`. The puzzles use the existing legal-move
engine and solver. Registered players get attempt, success-rate, and streak
statistics; guests can solve puzzles with progress saved on their device.

Choose **Play as guest** in the lobby for a temporary identity that persists
across refreshes. Guests can join casual rooms and use local or computer play,
but ranked matches and Elo ratings remain account-only. Converting a guest
identity to a registered account retains its room history and can import
locally saved Academy progress. Apply the additive migration with
`npm run db:deploy` when deploying these features.

## Run

Use the latest Node.js 22.x release and npm 10. Run `nvm use` to select the project’s Node version if you use nvm.

```sh
npm ci
npm run dev
```

On Windows PowerShell, if `npm` fails because `npm.ps1` is blocked by the execution policy, use the installed `.cmd` launcher:

```powershell
npm.cmd ci
npm.cmd run dev
```

This requires no execution-policy change. Use `npm.cmd` in place of `npm` and `npx.cmd` in place of `npx` for the verification commands below as well.

Open http://localhost:3000 to play locally without an account. To enable online
play locally, put a PostgreSQL 16+ connection in `PRISMA_DATABASE_URL` in
`.env.local`, then run `npm run db:deploy` before starting the app. Register
with a unique username, email address, and password. See [multiplayer
setup](docs/multiplayer.md) and [Vercel deployment](docs/deployment.md).

## Verify

Set `TEST_POSTGRES_URL` in your shell to a disposable PostgreSQL database for integration and online browser tests. Each suite applies the Prisma migrations in an isolated schema.

```sh
npx playwright install chromium
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm run test:online
npm start
```

Playwright starts the production server automatically and exercises desktop and narrow mobile layouts. Tests include complete games ending in each board victory, refresh recovery, keyboard play, undo/restart, settings, draw agreement, and resignation. CI installs Chromium and runs the checks on a clean checkout.

To verify while a development server is running, build with `BUILD_OUTPUT_DIR=.next/hydration-verification npm run build`, then run `BUILD_OUTPUT_DIR=.next/hydration-verification PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100 npm run test:e2e`. This keeps the test server and build separate from development.

`npm run build` and `npm run dev` use Next.js’s supported Webpack compiler because Turbopack’s internal CSS subprocess port binding fails in the development sandbox. This does not change the Next.js/React/Tailwind application architecture.

## Architecture and rules

- [Architecture](docs/architecture.md)
- [Canonical rules](docs/rules.md)
- [Board research and citations](docs/board-research.md)
- [Asset licenses](docs/asset-licenses.md)
- [Production deployment, backups, and rollback](docs/deployment.md)
- [Online rooms and verification](docs/multiplayer.md)
- [Codebase review and roadmap](docs/codebase-review.md)

The framework-independent engine lives in `lib/game`. Board paths are explicit, and SVG coordinates are never used to decide legality. The local session replays moves through the canonical engine before accepting a saved snapshot. Storage is a local convenience, not trusted online state.

## Greenfield provenance

The workspace initially contained only `AGENTS.md`. It was not a Git repository and had no existing commit to record. The bootstrap used the official `create-next-app@16.3.5` App Router / TypeScript / Tailwind template. No legacy repository source or assets were inspected, downloaded, executed, or reused.

All product source, SVG artwork, audio synthesis, copy, tests, and documentation were created here. Product licensing is pending an owner decision; see `LICENSE`.
