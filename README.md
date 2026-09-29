# Orcas vs Sharks

An original, ocean-themed adaptation of Bagh-Chal, the traditional asymmetric strategy game of Nepal. Four Orcas capture; twenty Sharks surround.

## Current scope

Phase 1: two players sharing a device. Play immediately at `/` or `/play`. Includes an interactive SVG board, both victory conditions, keyboard play, legal destinations and capture paths, undo, move history, restart/rematch, board flip, rules, sound, two themes, motion preferences, draw agreement, resignation, and local refresh recovery.

Private casual online rooms are available at `/online` when Supabase is configured. Create an invite, join from another browser, and play with server-authoritative moves, reconnects, draw offers, resignation and mutually accepted rematches. See [multiplayer setup](docs/multiplayer.md). AI, analysis, named accounts, clocks and rated play remain future work.

## Run

Use Node 22.12 or newer in the Node 22 release line and npm 10.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Local play needs no credentials. Online play requires the three values in `.env.example`, anonymous Supabase sign-in, and the room migration. See [multiplayer setup](docs/multiplayer.md).

## Verify

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
- [Preview and rollback](docs/deployment.md)
- [Online rooms and verification](docs/multiplayer.md)

The framework-independent engine lives in `lib/game`. Board paths are explicit, and SVG coordinates are never used to decide legality. The local session replays moves through the canonical engine before accepting a saved snapshot. Storage is a local convenience, not trusted online state.

## Greenfield provenance

The workspace initially contained only `AGENTS.md`. It was not a Git repository and had no existing commit to record. The bootstrap used the official `create-next-app@16.3.5` App Router / TypeScript / Tailwind template. No legacy repository source or assets were inspected, downloaded, executed, or reused.

All product source, SVG artwork, audio synthesis, copy, tests, and documentation were created here. Product licensing is pending an owner decision; see `LICENSE`.
