# Architecture — Local play and casual online rooms

## Decisions

Next.js App Router, React, strict TypeScript, Tailwind CSS with custom-property design tokens, and an interactive SVG board. Vitest and React Testing Library verify the engine and board; Playwright verifies complete local games on desktop and mobile. System fonts avoid font downloads and third-party requests.

`lib/game/graph.ts` declares 16 continuous straight lines: five rows, five columns, two full diagonals, and four shorter diagonals. Consecutive pairs expand to 56 undirected edges; consecutive triples in both directions expand to 80 capture paths. This is an explicit topology, not pixel-derived connectivity. A separate coordinate map serves rendering only. Tests compare every pair and every triple to an independent geometric oracle.

The pure engine modules own legal moves, application, victory detection, position keys, notation, and versioned serialization. Immutable application copies the board and history. The UI selects a legal move returned by the engine; it never calculates movement rules itself. Serialization uses an explicit Zod schema plus cross-field invariants. External moves are checked by the canonical legal-move list.

`components/game/game.tsx` owns local session history, selections, preferences, and application outcomes. Resignation and draw agreement are outside the board result and do not alter board history. Undo restores immutable snapshots. Persistence stores the move list, final versioned snapshot, and application outcome. Hydration replays every move from the initial state and compares the snapshot. Invalid saves reset safely and announce the recovery. Storage errors leave the game playable in memory. No cross-tab synchronization is promised; use one active tab per game.

The board exposes 25 labeled, focusable SVG buttons. Arrow navigation follows visual coordinates even when flipped. Enter/Space activates. Selection uses a dashed ring, destinations use dots, last moves use square highlights, and capture paths use dashed lines. Status changes use a live region. Native modal dialogs trap focus and restore it on close. User settings persist, while reduced-motion system preferences always take precedence.

Sound is an original short Web Audio tone generated only after a move when explicitly enabled. No sound file, autoplay, external artwork, tracking, account data, or secret is involved.

## Online rooms and security boundary

The first scoped Phase 3 increment adds private invite rooms at `/online` and `/game/[gameId]`. `components/game/game.tsx` accepts an optional online controller and reuses the local SVG table and controls. Online state comes from the server; local saves and undo remain local-only. `components/game/online-room.tsx` owns connection recovery and requests, while `components/lobby/online-lobby.tsx` creates and joins rooms.

`lib/multiplayer/transition.ts` checks application actions and calls the same pure engine. `store.ts` persists actions in PostgreSQL transactions using row locks, revision/ply checks and idempotency receipts. The Next room routes verify Supabase anonymous identities. RLS permits only seated reads; browser writes are revoked. Moves are append-only, and completed rounds are archived before rematches. See [the online protocol, setup and test boundaries](multiplayer.md).

Supabase Realtime reports new committed revisions, followed by an API hydration. Five-second polling recovers missed notifications and updates presence. No WebSocket server or in-process room map is deployed with Next/Vercel. `proxy.ts` supplies per-request script nonces and a restrictive CSP. Pages render dynamically to use those nonces; the configured Supabase HTTP and WebSocket origins are permitted. Styles still allow inline properties for board/progress rendering.

## Remaining phases

Phase 2 AI/analysis remains deferred. This request implements only private casual rooms from Phase 3, with anonymous accounts and no clocks, public profiles, chat, or spectators. Future public features require the relevant privacy, moderation and data-model work before exposure. Ratings, repetition/no-progress policies, clocks and abandonment reconciliation remain separate work. Nothing in this increment authorizes a public production deployment.
