# Architecture — Local play and casual online rooms

## Decisions

`lib/presentation/board-themes.ts` maps the canonical engine sides and pieces to display labels. The Tigers & Goats theme uses original woodland SVG scenery and animal medallions, with matching accessible node labels, player names, rules, results and computer setup. The existing `orcas`/`sharks` state identifiers, notation, topology, saved games and online requests remain canonical and theme-independent. Theme selection is a per-device preference, so online opponents may use different themes. Changing a theme neither restarts a game nor cancels a computer search.

The game table includes an original decorative SVG interpretation of Cape Cod, Massachusetts, with islands, water contours, and a nautical compass. It is a stylized illustration rather than a navigational map. A translucent glaze separates the coastline from the canonical board paths. Decoration ignores pointer events and is hidden from assistive technology; both existing surface themes and all node interactions remain available.

Next.js App Router, React, strict TypeScript, Tailwind CSS with custom-property design tokens, and an interactive SVG board. Vitest and React Testing Library verify the engine and board; Playwright verifies complete local games on desktop and mobile. System fonts avoid font downloads and third-party requests.

The root layout suppresses hydration warnings only on `body`, where browser extensions such as Grammarly inject attributes before React loads. Descendant hydration checks remain enabled. Regression tests exercise extension attributes during hydration and verify that play and refresh recovery still work.

`lib/game/graph.ts` declares 16 continuous straight lines: five rows, five columns, two full diagonals, and four shorter diagonals. Consecutive pairs expand to 56 undirected edges; consecutive triples in both directions expand to 80 capture paths. This is an explicit topology, not pixel-derived connectivity. A separate coordinate map serves rendering only. Tests compare every pair and every triple to an independent geometric oracle.

The pure engine modules own legal moves, application, victory detection, position keys, notation, and versioned serialization. Immutable application copies the board and history. The UI selects a legal move returned by the engine; it never calculates movement rules itself. Serialization uses an explicit Zod schema plus cross-field invariants. External moves are checked by the canonical legal-move list.

`components/game/game.tsx` owns local session history, selections, preferences, and application outcomes. Resignation and draw agreement are outside the board result and do not alter board history. Undo restores immutable snapshots. Persistence stores the move list, final versioned snapshot, and application outcome. Hydration replays every move from the initial state and compares the snapshot. Invalid saves reset safely and announce the recovery. Storage errors leave the game playable in memory. No cross-tab synchronization is promised; use one active tab per game.

The board exposes 25 labeled, focusable SVG buttons. Arrow navigation follows visual coordinates even when flipped. Enter/Space activates. Selection uses a dashed ring, destinations use dots, last moves use square highlights, and capture paths use dashed lines. Status changes use a live region. Native modal dialogs trap focus and restore it on close. User settings persist, while reduced-motion system preferences always take precedence.

Board motion is presentation-only CSS applied to artwork in a separate SVG layer behind stationary interactive nodes. The board observes consecutive committed plies with matching position history, then animates a placement, glide or capture leap with a decorative wake and ripple. A captured piece is a temporary, noninteractive illustration hidden from assistive technology; the authoritative board removes it immediately. The last ripple's animation event clears the transient effect, and stale callbacks cannot clear a newer move. Hydration, undo, skipped-ply reconnects, theme changes and board flips clear move effects rather than replaying them. All feedback is finite and respects both `.no-motion` and `prefers-reduced-motion`; reduced-motion decorations default to invisible and pieces render directly at their final positions.

Sound is an original short Web Audio tone generated only after a move when explicitly enabled. No sound file, autoplay, external artwork, tracking, account data, or secret is involved.

`victory-banner.tsx` presents wins, including resignation, as a nonmodal result card over the board. It names the themed winner, runs a finite CSS entrance and spark effect, and exposes the existing restart/rematch action. Board review collapses it into a persistent result strip, preserving keyboard access to replay. The winner is announced only once as a heading; the side panel retains the canonical result reason. Replay resets local play while keeping computer settings, and online replay uses the existing mutual rematch protocol. Draws keep their existing result panel. Reduced-motion settings disable decoration while keeping the result and actions visible.

## Online rooms and security boundary

The home lobby offers casual matchmaking, private invite rooms, and computer setup. `components/game/game.tsx` accepts an optional online controller and reuses the local SVG table and controls. Online state comes from the server; local saves and undo remain local-only. `components/game/online-room.tsx` owns connection recovery and requests, while `components/lobby/online-lobby.tsx` creates and joins rooms. A PostgreSQL transaction serializes queue updates, expires inactive searches, and seats both players in the existing room protocol.

`lib/multiplayer/transition.ts` checks application actions and calls the same pure engine. `store.ts` persists actions in PostgreSQL transactions using row locks, revision/ply checks and idempotency receipts. The Next room routes verify PostgreSQL-backed sessions and check room membership before serving game data. Only the application database role has access to room tables. Moves are append-only, and completed rounds are archived before rematches. See [the online protocol, setup and test boundaries](multiplayer.md).

The browser polls the room API every two seconds to fetch committed state and update presence. No WebSocket server or in-process room map is deployed with Next/Vercel. `proxy.ts` supplies per-request script nonces and a restrictive CSP. Pages render dynamically to use those nonces. Styles still allow inline properties for board/progress rendering.

## Computer opponent

Phase 2 computer play uses the existing local session and canonical engine. `lib/ai/search.ts` provides iterative-deepening minimax, alpha-beta pruning, a bounded transposition table and per-difficulty time budgets. `evaluate.ts` scores captures, threatened Sharks, Orca mobility, trapped Orcas, Shark connectivity, junction control and placement tempo. `computer.worker.ts` validates requests and searches outside the main thread; the UI validates the returned move through the canonical engine again before applying it.

`use-computer.ts` creates a worker per computer turn and terminates it on completion, undo, restart, resignation, mode changes or unmount. It ignores stale and duplicate responses. Failure and watchdog expiry leave the human seat unchanged and provide an explicit retry. The CSP permits workers only from the app's own origin. Computer settings are stored together with the local replay; old two-player saves still load. Online sessions never start a computer worker. See [computer behavior and limitations](computer.md).

## Remaining phases

Phase 2 analysis tools remain deferred. Casual matchmaking and private rooms use invite-only player accounts. Clocks, public profiles, chat, and spectators remain deferred. Future public features require the relevant privacy, moderation and data-model work before exposure. Ratings, repetition/no-progress policies, clocks and abandonment reconciliation remain separate work. Nothing in this increment authorizes a public production deployment.
