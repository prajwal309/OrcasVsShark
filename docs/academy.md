# Learn to Play

Open **Learn to Play** from the lobby. Start with the eight beginner lessons,
then try a puzzle or play **Guided Practice** against the existing computer
opponent. Select a board theme at any time. The markers on the board identify
exercise points, and filled dots mark legal destinations. Use the arrow keys
to move board focus and Enter or Space to activate a point.

**My Progress** shows completions, recent activities, recommendations, puzzle
points and accuracy, and unlocked achievements. Points are awarded once per
puzzle. Accuracy counts submitted answers and streaks count consecutive correct
puzzle attempts. The progress cursor, requested hints, and verified openings
of two-move exercises survive refresh.

Guest progress is stored in browser localStorage. Sign in to use your account
progress, stored in PostgreSQL. The browser and account
have independent progress histories. The account loads its saved progress when
the Academy opens on another device. Pending account events retry safely after
interruption, using a receipt for each event.

## Add an activity

Add a stable, unique ID to `lib/learn/lesson-data.ts` or
`lib/learn/puzzle-data.ts`. Set the level, side to play, objective, hints, and
explanation. Use `{orcas}`, `{sharks}`, `{orca}`, and `{shark}` in text that
should follow the board theme. Use `focus` to mark intersections when a lesson
needs visual guidance.

Build a starting position as a whitespace-separated line of legal moves from
the initial board. Use `+c3` for a placement, `a1-b2` for a step, and `b2xd4`
for a capture. The engine supplies the jumped intersection. Reuse a prefix
from `lib/learn/positions.ts` when an existing reference game reaches a suitable
position.

Use an explicit move list for a directed exercise. Use a predicate goal for
activities that accept every move satisfying a tactical objective. Available
goals include taking a capture, allowing no immediate capture, limiting the
number of replies, winning immediately, and guaranteeing a win on the player’s
second move. A two-move win must hold after **every** opponent reply. The board
plays a verified reply with the fewest remaining winning continuations.
For an illegal-move question, supply the proposed move and expected legality so
the engine can validate the example.

Run `npm test -- tests/learn` before publishing new content. Add the puzzle’s
full expected answer set to `tests/learn/curriculum.test.ts`. The tests replay
all positions, check the side to play, and validate the legal replies and
winning continuations. Review the explanation against the replayed position.
Use the computer’s suggestion to explore options. It is heuristic, and the
engine’s legal moves and results determine which answers solve each exercise.

The production browser tests for lessons, puzzles, and practice run with
`npm run test:e2e`. The account sync test runs with `npm run test:online`.
