# Orcas vs Sharks

An original, ocean-themed adaptation of Bagh-Chal, the traditional asymmetric strategy game of Nepal. Four Orcas capture; twenty Sharks surround.

## Current scope

Phase 1: two players sharing a device. Play immediately at `/` or `/play`. Includes an interactive SVG board, both victory conditions, keyboard play, legal destinations and capture paths, undo, move history, restart/rematch, board flip, rules, sound, two themes, motion preferences, draw agreement, resignation, and local refresh recovery.

AI, analysis, accounts, online games, clocks, and rated play belong to later phases and are not implemented. The UI never presents local play as server-authoritative multiplayer.

## Run

Use Node 22.12 or newer in the Node 22 release line and npm 10.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. No credentials or environment variables are needed for Phase 1. See `.env.example`.

## Verify

```sh
npx playwright install chromium
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
npm start
```

Playwright starts the production server automatically and exercises desktop and narrow mobile layouts. Tests include complete games ending in each board victory, refresh recovery, keyboard play, undo/restart, settings, draw agreement, and resignation. CI installs Chromium and runs the checks on a clean checkout.

`npm run build` and `npm run dev` use Next.js’s supported Webpack compiler because Turbopack’s internal CSS subprocess port binding fails in the development sandbox. This does not change the Next.js/React/Tailwind application architecture.

## Architecture and rules

- [Architecture](docs/architecture.md)
- [Canonical rules](docs/rules.md)
- [Board research and citations](docs/board-research.md)
- [Asset licenses](docs/asset-licenses.md)
- [Preview and rollback](docs/deployment.md)
- [Verification record](docs/verification.md)

The framework-independent engine lives in `lib/game`. Board paths are explicit, and SVG coordinates are never used to decide legality. The local session replays moves through the canonical engine before accepting a saved snapshot. Storage is a local convenience, not trusted online state.

## Greenfield provenance

The workspace initially contained only `AGENTS.md`. It was not a Git repository and had no existing commit to record. The bootstrap used the official `create-next-app@16.3.5` App Router / TypeScript / Tailwind template. No legacy repository source or assets were inspected, downloaded, executed, or reused.

All product source, SVG artwork, audio synthesis, copy, tests, and documentation were created here. Product licensing is pending an owner decision; see `LICENSE`.
