# Architecture — Phase 1

## Decisions

Next.js App Router, React, strict TypeScript, Tailwind CSS with custom-property design tokens, and an interactive SVG board. Vitest and React Testing Library verify the engine and board; Playwright verifies complete local games on desktop and mobile. System fonts avoid font downloads and third-party requests.

`lib/game/graph.ts` declares 16 continuous straight lines: five rows, five columns, two full diagonals, and four shorter diagonals. Consecutive pairs expand to 56 undirected edges; consecutive triples in both directions expand to 80 capture paths. This is an explicit topology, not pixel-derived connectivity. A separate coordinate map serves rendering only. Tests compare every pair and every triple to an independent geometric oracle.

The pure engine modules own legal moves, application, victory detection, position keys, notation, and versioned serialization. Immutable application copies the board and history. The UI selects a legal move returned by the engine; it never calculates movement rules itself. Serialization uses an explicit Zod schema plus cross-field invariants. External moves are checked by the canonical legal-move list.

`components/game/game.tsx` owns local session history, selections, preferences, and application outcomes. Resignation and draw agreement are outside the board result and do not alter board history. Undo restores immutable snapshots. Persistence stores the move list, final versioned snapshot, and application outcome. Hydration replays every move from the initial state and compares the snapshot. Invalid saves reset safely and announce the recovery. Storage errors leave the game playable in memory. No cross-tab synchronization is promised; use one active tab per game.

The board exposes 25 labeled, focusable SVG buttons. Arrow navigation follows visual coordinates even when flipped. Enter/Space activates. Selection uses a dashed ring, destinations use dots, last moves use square highlights, and capture paths use dashed lines. Status changes use a live region. Native modal dialogs trap focus and restore it on close. User settings persist, while reduced-motion system preferences always take precedence.

Sound is an original short Web Audio tone generated only after a move when explicitly enabled. No sound file, autoplay, external artwork, tracking, account data, or secret is involved.

## Security boundary

Phase 1 has no authenticated API, user-generated public content, server game writes, or database connection. `/api/health` is read-only. Headers deny framing, objects, camera, microphone, and geolocation. CSP limits resources to self, with inline scripts/styles for Next.js hydration and dynamic SVG progress styling. Before authenticated online play, move to nonce-based script CSP and implement server action authorization, rate limits, Supabase row-level security, privacy/deletion workflows, and all multiplayer transaction invariants in AGENTS.md.

Saved data is untrusted and validated, but this is intentionally a local game: a user controls their own device and can edit local outcomes. Nothing here establishes a trusted rating or multiplayer result.

## Future phases

Phase 2 adds Web Worker AI and analysis. Phase 3 adds PostgreSQL/Supabase authentication, migrations, persistence, RLS, and initial realtime transport. A server move transaction must enforce identity, seats, turn, expected ply, canonical engine validity, server clocks, idempotency, and append-only audit moves. Only committed snapshots are broadcast; reconnects hydrate from the server. Database tables and placeholder online routes are intentionally not scaffolded without a current responsibility.

Vercel is the target preview/deployment platform. Public production deployment is a separate approval gate. Repetition/no-progress policy must be agreed and documented before rated play; the current local rules support draw agreement only.
