# Orcas vs Sharks — Greenfield Agent Instructions

## 1. Non-negotiable greenfield rule

Build **Orcas vs Sharks** entirely from scratch.

The existing repository at `https://github.com/prajwal309/Bagchal` is a concept reference only. Agents may use only the broad idea: an online marine-themed adaptation of Bagh-Chal. They must not copy, adapt, refactor, migrate, import, or execute its source code.

Do not reuse its:

- HTML, CSS, or JavaScript;
- DOM structure or application architecture;
- algorithms, state representation, board coordinates, or event handlers;
- images, sounds, filenames, text, or other assets;
- saved-game format or undocumented behavior.

Do not treat the old implementation as a rules specification. Implement the written rules in this file. All production source, tests, documentation, and assets must be new.

If work occurs in the existing Git repository, keep the prototype recoverable in Git history or an archival branch. No new production module may import or depend on a legacy file. Ask the user before deleting legacy files from the active branch.

## 2. Product vision

Create a polished, mobile-first strategy-game website with the immediacy and competitive depth of Lichess, without copying Lichess branding, code, text, icons, or pixel-level layouts.

The game is an ocean-themed adaptation of the traditional Nepali game Bagh-Chal:

- Four **Orcas** replace the four tigers.
- Twenty **Sharks** replace the twenty goats.
- Orcas capture; Sharks surround and immobilize.
- Orcas win after capturing five Sharks.
- Sharks win by immobilizing all four Orcas.

Ship a correct, delightful game before attempting a full chess-platform feature set.

## 3. Product principles

1. Rules correctness precedes visual polish.
2. Online games are server-authoritative.
3. A visitor reaches a playable board within two interactions.
4. Mobile and desktop have equal gameplay capability.
5. Accessibility is a release requirement.
6. The site clearly credits Bagh-Chal as a Nepali game.
7. All software, art, audio, and copy are original or clearly licensed.
8. Complexity is introduced in phases: local play, AI, casual multiplayer, rated play, then community features.

## 4. Required stack

Unless an approved architecture decision supersedes this file, use:

- Next.js with App Router
- React and strict TypeScript
- Tailwind CSS and CSS custom-property design tokens
- An interactive SVG board
- Vitest for engine and unit tests
- React Testing Library for components
- Playwright for critical browser flows
- PostgreSQL and Supabase for authentication, persistence, row-level security, and initial realtime transport
- Vercel for deployment

Keep the rules engine framework-independent. It must not depend on React, Next.js, Supabase, the DOM, audio, or animation libraries.

## 5. Greenfield bootstrap

The first task is to create a clean application, not modify the prototype.

1. Record the existing commit so the prototype remains recoverable.
2. Create a new Next.js application from an official current template.
3. Enable strict TypeScript, linting, formatting, unit tests, browser tests, and CI.
4. Create a fresh `public/` directory containing only new or licensed assets.
5. Add `.env.example`; never commit credentials.
6. Add a README, architecture notes, asset-license manifest, and license or explicit pending-license notice.
7. Verify a clean checkout can install, test, build, and start.

Do not inspect the legacy source while implementing the new application. Traditional board geometry may be recreated from the written graph specification and independent rules research.

## 6. Target structure

```text
app/
  page.tsx
  play/page.tsx
  game/[gameId]/page.tsx
  learn/page.tsx
  analysis/page.tsx
  profile/[username]/page.tsx
  api/health/route.ts
components/
  board/
  game/
  lobby/
  navigation/
  settings/
lib/
  game/
    graph.ts
    types.ts
    initial-state.ts
    legal-moves.ts
    apply-move.ts
    result.ts
    position-key.ts
    notation.ts
    serialization.ts
  multiplayer/
  auth/
  database/
  validation/
public/
  audio/
  icons/
  pieces/
supabase/
  migrations/
  seed.sql
tests/
  engine/
  components/
  e2e/
docs/
  architecture.md
  rules.md
  board-research.md
  asset-licenses.md
```

Add modules when they have a clear responsibility. Do not create generic dumping grounds such as a large `utils.ts`.

## 7. Board model

Represent the board as an explicit graph of 25 intersections. Never infer legal movement from SVG pixels or ad hoc coordinate arithmetic.

```ts
type File = "a" | "b" | "c" | "d" | "e";
type Rank = 1 | 2 | 3 | 4 | 5;
type NodeId = `${File}${Rank}`;
type Side = "orcas" | "sharks";
type Piece = "orca" | "shark";
type Phase = "shark-placement" | "shark-movement";
```

In `graph.ts`, explicitly define and test:

- every legal adjacent edge;
- every legal straight two-edge capture path;
- normalized SVG coordinates used only for rendering;
- stable iteration order for deterministic tests and notation.

Graph data contains no UI colors, animations, database IDs, or React elements. Rendering coordinates never decide legality.

## 8. State and moves

```ts
interface GameState {
  board: Partial<Record<NodeId, Piece>>;
  turn: Side;
  phase: Phase;
  sharksPlaced: number;
  sharksCaptured: number;
  ply: number;
  history: readonly PositionKey[];
  result: GameResult | null;
}

type Move =
  | { kind: "place"; to: NodeId }
  | { kind: "step"; from: NodeId; to: NodeId }
  | { kind: "capture"; from: NodeId; over: NodeId; to: NodeId };
```

The engine exposes pure functions:

- `createInitialState()`
- `getLegalMoves(state)`
- `getLegalMovesFrom(state, node)`
- `isLegalMove(state, move)`
- `applyMove(state, move)`
- `getGameResult(state)`
- `createPositionKey(state)`
- `serializeState(state)` and `deserializeState(payload)`

Never mutate inputs. Invalid input produces typed errors. Legal move ordering is stable. React components call the engine and never implement a second rules system.

## 9. Canonical rules

Implement these rules, not behavior from the old repository:

1. Orcas begin on the four corner intersections; the other 21 intersections are empty.
2. Sharks move first.
3. During placement, a Shark turn places one of the 20 Sharks on an empty intersection.
4. A placed Shark cannot move during placement.
5. Orcas may move and capture from the start, including during Shark placement.
6. After all 20 Sharks have been introduced—whether still present or already captured—the Sharks enter movement phase.
7. In movement phase, one Shark moves along one board edge to an adjacent empty intersection.
8. An Orca moves along one board edge to an adjacent empty intersection.
9. An Orca captures by jumping over one adjacent Shark and landing on the immediately following empty intersection along one continuous straight board path.
10. Orcas cannot jump over Orcas, land on occupied nodes, turn during a jump, or cross missing board segments.
11. A move captures at most one Shark. There are no chained captures in the default ruleset.
12. Capturing is optional in the default ruleset.
13. Orcas win immediately upon the fifth capture.
14. Sharks win only when all four Orcas have no legal step or capture.
15. Resignation, timeout, draw agreement, and abandonment are application results, not board moves.

Before rated play, document and implement repetition and no-progress draw policies. Casual games may initially support draw by agreement.

## 10. Visual and interaction direction

The identity is a sophisticated deep-ocean strategy table, not a cartoon aquarium:

- midnight navy and deep teal surfaces;
- pale sea-glass, foam, or weathered-stone lines;
- large black-and-white Orca pieces;
- smaller blue-gray Shark pieces;
- distinct shapes and markings that work without color;
- restrained ripple, glide, and wake animation;
- reduced-motion alternatives.

Create all illustrations and icons from scratch or use assets whose licenses are recorded in `docs/asset-licenses.md`.

Desktop may place the board beside a game panel. Mobile places the board above controls and history. Click/tap is mandatory; drag-and-drop is optional.

The game screen includes:

- side-to-move and phase;
- Sharks remaining to place and Sharks captured;
- selected origin, legal destinations, capture path, and last move;
- numbered move history;
- new game, resign, draw, flip board, sound, and theme controls;
- clocks when enabled;
- connection and reconnection state;
- rules without abandoning the game;
- final result, reason, and rematch action.

## 11. Accessibility

- Support complete keyboard play.
- Label each node, such as `c3, empty` or `a1, orca`.
- Announce selection, move, capture, invalid action, turn, clock warning, reconnect, and result through live regions.
- Never communicate state through color alone.
- Maintain visible focus and WCAG AA contrast in every theme.
- Respect `prefers-reduced-motion` and persist an animation preference.
- Use touch targets of at least 44 by 44 CSS pixels.
- Ensure browser zoom to 200% does not hide gameplay controls.
- Do not autoplay audio; persist the user’s sound choice locally.

## 12. Server-authoritative multiplayer

The client proposes moves; the server decides and records them.

```ts
interface MoveRequest {
  gameId: string;
  expectedPly: number;
  move: Move;
  requestId: string;
}
```

In one transaction the server must authenticate the actor, verify the seat and turn, confirm the game is active, compare the expected ply, validate through the canonical engine, update server clocks, append the move, update the snapshot and result, make retries idempotent, and publish the committed state.

Reconnects always hydrate from the server. Local storage is never authoritative. Spectators are read-only. Privileged database credentials never enter client bundles.

## 13. Data model

Use versioned, reviewed migrations. Minimum tables:

- `profiles`
- `games`
- `moves`
- `challenges`
- `ratings`
- `rating_events`
- `blocks`
- `reports`

Each game records the ruleset and engine versions, seats, time control, rated flag, current ply, snapshot, result, and UTC timestamps. Moves are an append-only audit trail. Enforce row-level security for every user-facing table.

## 14. Delivery phases

### Phase 1 — Local game

- Bootstrap the clean project and CI.
- Build the graph and pure engine from this document.
- Add exhaustive engine tests.
- Create the responsive SVG board and original pieces.
- Add local two-player play, undo, history, restart, board flip, rules, settings, and sound.
- Deploy a preview.

Exit only when a clean checkout passes installation, typecheck, lint, tests, browser smoke tests, and production build, and repeated complete games produce no illegal state or console error.

### Phase 2 — AI and analysis

- Run AI search in a Web Worker.
- Use iterative-deepening minimax or negamax with alpha-beta pruning, a transposition table, and a time budget.
- Evaluate captures, threatened Sharks, Orca mobility, trapped Orcas, Shark connectivity, central control, and placement tempo.
- Offer several strengths using search budgets and controlled move selection.
- Add history navigation, position setup, shareable notation, and optional suggestions.

Do not advertise an AI rating without a documented test pool.

### Phase 3 — Casual online play

- Add accounts, profiles, challenges, invite links, reconnects, spectators, clocks, resignation, draw offers, rematches, and archives.
- Validate every action on the server.
- Add privacy, block, and report functions before public communication.

### Phase 4 — Rated competition

- Add a documented rating system such as Glicko-2, provisional ratings, and immutable rating events.
- Add open seeks, lobby filters, leaderboards, moderation, rate limits, abandonment policy, and exports.
- Launch rated games only after clocks and result reconciliation are load-tested.

### Phase 5 — Learning and community

Add puzzles, studies, tournaments, teams, opening statistics, and social features only when usage justifies their moderation and operational costs.

## 15. Required tests

Engine tests cover:

- exact initial state;
- every edge, non-edge, capture path, and forbidden bent path;
- placement on empty nodes and rejection on occupied nodes;
- prohibition of Shark movement during placement;
- phase transition after 20 Sharks have been introduced, including captured Sharks;
- every legal and illegal step and jump direction;
- occupied landings, missing segments, Orca obstruction, and chained-capture rejection;
- optional capture behavior;
- fifth-capture victory;
- full immobilization and non-victory for partial immobilization;
- immutable inputs and deterministic move order;
- stable position keys;
- serialization round trips and malformed-input rejection.

End-to-end tests cover:

- a complete local victory for each side;
- keyboard-only and narrow mobile play;
- undo and restart locally;
- create, join, move, reconnect, draw, resign, timeout, and rematch online;
- stale-ply, out-of-turn, malformed, unauthorized, and duplicate requests;
- refresh during an active game;
- final result persistence.

A change cannot merge until affected tests, typecheck, lint, production build, and critical Playwright tests pass.

## 16. Board heritage and themes

The standard game retains the Bagh-Chal 5×5 intersection topology. Its geometry resembles boards in the broader alquerque family, but the game remains a Nepali Bagh-Chal adaptation.

Original themes may include:

- **Ocean Alquerque:** the canonical graph drawn as currents or carved channels;
- **Sand Table:** an original sand-and-stone treatment broadly inspired by Seega boards;
- **North African Geometry:** new ornament broadly inspired by Kharbaga and related boards;
- **Deep Reef:** coral or bioluminescent paths on the canonical graph.

Seega, Kharbaga, Zamma, and alquerque have distinct rules and histories. Never present their rules as Bagh-Chal. Different connectivity creates a separate variant requiring its own identifier, tests, explanation, and user approval.

Put credible citations for historical claims in `docs/board-research.md`. Do not trace or copy photographs, commercial boards, carvings, logos, fonts, or decorative compositions.

Suggested public description:

> Orcas vs Sharks is an original ocean-themed digital adaptation of Bagh-Chal, the traditional asymmetric strategy game of Nepal. Optional visual themes draw inspiration from geometric board-game traditions found across several regions, while the standard rules and board remain those of Bagh-Chal.

## 17. Security and privacy

- Validate external input with explicit schemas.
- Use secure, HTTP-only cookies where applicable.
- Configure restrictive Content Security Policy and standard security headers.
- Rate-limit authentication, challenges, game creation, moves, chat, reports, and search.
- Escape or sanitize user-generated text.
- Collect only necessary personal data and provide account deletion.
- Never log secrets, tokens, or unnecessary personal information.
- Do not enable public chat before blocking, reporting, moderation queues, and abuse response exist.

## 18. Deployment

- Isolate local, preview, and production environments.
- Validate environment variables at startup.
- Never connect preview deployments to production credentials or player data.
- Apply reviewed migrations before promoting an application release.
- Provide health checks, error monitoring, privacy-conscious analytics, backups, and rollback documentation.

Before production, verify reproducible build, all tests, forward database migrations, absence of secrets, accessibility, both victory paths, reconnects and clocks, legal/privacy/reporting pages, asset attribution, domain and HTTPS, metadata, error pages, monitoring, backup, and rollback.

## 19. Agent workflow

For every task:

1. Read this file, the current README, relevant architecture decisions, tests, and target files.
2. Inspect Git status and preserve unrelated user work.
3. Confirm the task belongs to the current phase.
4. Propose the smallest coherent implementation plan.
5. Implement without consulting or reusing legacy source.
6. Add or update tests with behavioral changes.
7. Run focused checks during work and all required checks before handoff.
8. Update documentation, migrations, and `.env.example` when interfaces change.
9. Report what changed, what was tested, and remaining risk or manual work.

Ask before changing canonical rules, adding paid services, replacing the approved stack, enabling rated play or public chat, adding a board with different connectivity, deleting legacy files or user data, deploying to production, or applying destructive migrations.

Never copy or depend on the legacy implementation, commit credentials, trust client-computed results, weaken tests, invent historical claims, copy Lichess or commercial assets, or deploy destructively without approval and rollback.

## 20. Definition of done

A feature is done only when it comes from the greenfield architecture, follows the canonical rules, is tested, accessible, responsive, secure for its threat model, documented where necessary, and verified in a production build. A polished screen backed by legacy code, untested rules, or client-only validation is not done.
