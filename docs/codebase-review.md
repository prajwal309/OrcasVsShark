# Orcas vs Sharks codebase review

## Current features

| Area                       | Working today                                                                                                                                                                                                                                         | Gap or limit observed in the code                                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules and local play       | One rules engine drives local and online games. Local two-player play, computer difficulty, undo, saves, and board themes are implemented.                                                                                                            | Online move history is persisted, but there is no standalone finished-game replay or shareable analysis view.                                                                                                   |
| Lobby and matching         | Casual queues, invite rooms, and Fast 3+5, Medium 5+5, and Classic 10+10. Ranked pairing requires both Elo windows to accept the match, then prefers the nearest rating.                                                                              | The lobby resumes active ranked play through matchmaking status. There is no explicit ongoing-games list or search-time history. Population and wait times have not been measured.                              |
| Ratings and profiles       | Separate 1500 starting Elo per ranked mode, fixed K-factor, wins, losses, draws, and total games. Ranked results, archived rounds, and rating changes are transactional. Profiles show 30 recent games and each leaderboard returns up to 50 players. | Progression has no chart or mode filter on profiles. There is no provisional rating label or moderation workflow for corrections.                                                                               |
| Multiplayer and clocks     | Server-authoritative moves, revision and ply checks, retry receipts, stored deadlines, automatic timeout on access, and scheduled settlement. Clients poll, recover state on reconnect, and retain their seat.                                        | Active ranked rooms poll every second. The displayed clock estimates latency and the server decides the result. There is no push transport or server-side lag allowance.                                        |
| Accounts and persistence   | PostgreSQL stores Argon2id hashes, hashed session tokens, account data, rooms, ratings, and learning progress. Same-origin checks, seat checks, and rate limits protect mutations.                                                                    | Password authentication actions share a global per-minute bucket. Gameplay validation prevents illegal and duplicate actions. Detecting collusion or external assistance needs separate tools and human review. |
| Learning and accessibility | Academy lessons, puzzles, hints, guided practice, guest progress, and signed-in sync. Desktop and mobile tests cover keyboard moves, theme contrast, and reduced motion.                                                                              | Screen-reader testing with assistive technology remains to be done.                                                                                                                                             |

The app separates the rules engine from Next.js routes, uses PostgreSQL as the
authority for online state, and keeps computer search in a browser worker.
That separation supports incremental work on transport and UI. It also lets
the same rules and server authorization continue to govern play if delivery
changes.

## Changes made in this review

| Files                                                                                     | Change                                                                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`, `package-lock.json`                                                       | Updated Next.js and its ESLint config to 16.4.6, Zod to 4.6.6, and dependencies covered by a compatible npm audit fix. The Prisma CLI remains on version 7.                                                                                         |
| `lib/multiplayer/matchmaking.ts`, `lib/multiplayer/ranking.ts`                            | Idle status checks skip the queue-wide expiry deletion. PostgreSQL applies both rating windows and returns one eligible opponent, retaining distance, wait-time, and account-ID ordering.                                                           |
| `lib/auth/session.ts`, `app/layout.tsx`, `app/learn/layout.tsx`                           | Server components share the same session lookup during a render. API authentication keeps its separate checks.                                                                                                                                      |
| `components/game/online-room.tsx`, `lib/multiplayer/client.ts`, `lib/multiplayer/http.ts` | Ignore an older poll failure after a newer response has been accepted. Preserve HTTP status through HTML error responses. Accept the JSON media type with standard parameters and report unexpected server errors without logging request payloads. |
| `lib/game/serialization.ts`, `README.md`                                                  | Removed a board check already enforced by Zod and stale instructions for a nonexistent Windows script.                                                                                                                                              |
| `tests/multiplayer/client.test.ts`, `tests/online/rooms.spec.ts`                          | Added coverage for a hosting error, a delayed failed poll, and invalid request media types. Existing tests exercise mutual rating windows and nearest-opponent selection in PostgreSQL.                                                             |

The audit dropped from 18 reported entries to three high-severity entries,
all related to one Effect advisory in the Prisma CLI/config dependency chain.
`npm audit --omit=dev` still lists that chain. The audit tool offers a breaking
Prisma downgrade. Its suggested change would require compatibility testing
against the generated client and production migration workflow. No
application exploitability was established during this review.
[Next.js 16.4.6](https://github.com/vercel/next.js/releases/tag/v16.4.6) ·
[Zod 4.6.6](https://github.com/colinhacks/zod/releases/tag/v4.6.6) ·
[Effect advisory](https://github.com/Effect-TS/effect/security/advisories/GHSA-7589-6fvf-x4pw)

## What to adapt from Lichess

- **Lobby and pairing.** Lichess separates quick pairing pools, lobby games,
  friend challenges, and computer play. Orcas vs Sharks already has equivalents
  for the core actions. An explicit **Resume game** entry and a clearer search
  status would improve the existing flow. Keep the three presets while player
  numbers are small. Adding pools can increase waits by splitting the player
  base. [Lichess lobby](https://lichess.org/) ·
  [Lichess pool module](https://github.com/lichess-org/lila/tree/master/modules/pool)
- **Ratings and replay.** Lichess uses Glicko-2 and organizes profiles by speed.
  Orcas vs Sharks can add filters, a progression chart, and a finished-game
  replay from recorded results. A change to the rating algorithm would require
  a transition policy and analysis of how well ratings predict game results.
  [Lichess rating systems](https://lichess.org/page/rating-systems) ·
  [Lichess profile](https://lichess.org/@/lichess) ·
  [Lichess analysis board](https://lichess.org/analysis)
- **Transport and clocks.** Lichess has a separate WebSocket service. A smaller
  step here is to measure polling and database demand, then deliver revision
  notifications while retaining the authoritative snapshot and HTTP writes.
  Vercel's native WebSocket support is in public beta. A transport pilot would
  need to check reconnects, fan-out across instances, invocation limits, and
  pricing. [Lichess WebSocket service](https://github.com/lichess-org/lila-ws) ·
  [Vercel WebSocket beta](https://vercel.com/changelog/websocket-support-is-now-in-public-beta)
- **Accessibility and fair play.** Lichess documents keyboard and screen-reader
  play, and publishes explicit rules on external assistance. Add a short
  keyboard guide, test the game with screen readers, and start with fair-play
  rules and a report flow. Human review should precede sanctions based on
  repeated opponents, resignations, or similar signals.
  [Lichess accessibility tutorial](https://lichess.org/page/blind-mode-tutorial) ·
  [Lichess fair play](https://lichess.org/page/fair-play)

The Lichess source was used as a design reference. This review incorporated no
Lichess code, designs, or assets. Review the applicable upstream license before
reusing anything in a future change.
[Lichess source and license](https://github.com/lichess-org/lila)

## Prioritized development roadmap

| Priority | Improvement                                                                                                                                                                                                        | Impact                               | Effort        | Stage       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | ------------- | ----------- |
| 1        | Measure room request latency, serialization retries, queue wait times, and overdue ranked matches. Surface scheduled settlement failures.                                                                          | High                                 | Low to medium | Immediate   |
| 2        | Bound authentication by a verified client signal and identifier, retaining a broader abuse ceiling. The current shared 30-attempt bucket can affect unrelated sign-ins. Add monitoring before changing thresholds. | High                                 | Medium        | Immediate   |
| 3        | Add **Resume game** and explicit idle, searching, reconnecting, and matched states. Use keyboard and screen-reader checks for the lobby and online board.                                                          | High                                 | Low to medium | Immediate   |
| 4        | Reduce polling writes and payload size with revision-aware responses and less frequent presence writes. Keep a timeout fallback and verify reconnect and concurrent-move behavior.                                 | High if measured traffic warrants it | Medium        | Medium term |
| 5        | Add mode filters, a rating chart, and finished-game replay using existing archives. Define who can read private-room history before adding share links.                                                            | Medium to high                       | Medium        | Medium term |
| 6        | Publish fair-play rules and build a reporting and review workflow. Treat repeat-pairing and unusual-result signals as review inputs.                                                                               | Medium to high                       | Medium        | Medium term |
| 7        | Pilot push transport if polling misses latency or load targets. Revisit provisional ratings or a new algorithm once enough match data exists to validate it.                                                       | Depends on measured scale            | High          | Longer term |

## Operational findings and limits of verification

- **Polling load.** A room GET updates the rate-limit bucket and loads the
  game under a row lock. It also writes presence and returns the full
  snapshot. The code shows opportunities to reduce work, but no production
  bottleneck was measured. Sample SQL duration, pool usage, retry count, and
  response size before introducing a new service.
- **Timeout backlog.** The production default runs once daily and considers
  up to 64 overdue games per invocation. Active room requests settle expiry
  immediately, and an expired match can be settled from matchmaking.
  If unattended backlog grows, use a supported faster schedule and bounded
  batches with backlog monitoring. Review retention for expired sessions and
  old request receipts separately from match history.
- **Dependency and asset scope.** The legacy Prisma Accelerate adapter still
  serves a supported configuration path in this app. Its eventual removal
  depends on the deployed connection URL. The tracked logo and ocean icon
  have no in-repo consumers found by search. Their use as direct public URLs
  is unknown, so they were retained.
- **Environment coverage.** Verification uses production-mode Next.js on
  loopback and isolated PostgreSQL schemas. Live Vercel queue load, cron
  timing, Google sign-in with a real provider account, and assistive
  technology behavior remain unverified.

## Verification

- Type checks, lint, formatting, and production builds passed.
- All 87 unit and PostgreSQL integration tests, 48 local browser tests,
  and 34 online browser tests passed. Browser coverage included desktop and
  mobile. The first local browser launch timed out on port 3000. The suite
  passed on port 3200.
- The Vercel production build command applied the existing migration to a
  fresh test schema. No schema or production data changes were made.
- PostgreSQL logged retryable serialization conflicts during concurrent play.
  The browser assertions passed, including the delayed-poll regression.
  A few generic API errors in the test logs were not classified.
