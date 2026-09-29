// Developer fixture generator. Compile lib/game to a temporary CommonJS directory first.
// Not part of the application or an AI opponent.
const { createInitialState } = await import(
  process.argv[2] + "/initial-state.js"
);
const { applyMove } = await import(process.argv[2] + "/apply-move.js");
const { getLegalMoves } = await import(process.argv[2] + "/legal-moves.js");
import fs from "node:fs";
let seed = 731;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
const found = {};
for (let game = 0; game < 5000 && Object.keys(found).length < 2; game++) {
  let state = createInitialState();
  const moves = [];
  for (let ply = 0; ply < 200 && !state.result; ply++) {
    const legal = getLegalMoves(state);
    if (!legal.length) break;
    let move;
    if (game === 0 || state.turn === "orcas")
      move = legal[Math.floor(random() * legal.length)];
    else {
      const scored = legal
        .map((m) => {
          const next = applyMove(state, m),
            orcas = getLegalMoves({ ...next, turn: "orcas", result: null });
          return {
            m,
            score:
              (next.result?.winner === "sharks" ? -1000 : 0) +
              orcas.filter((m) => m.kind === "capture").length * 12 +
              orcas.length +
              random() * 5,
          };
        })
        .sort((a, b) => a.score - b.score);
      move = scored[0].m;
    }
    state = applyMove(state, move);
    moves.push(move);
  }
  if (state.result && !found[state.result.winner]) {
    found[state.result.winner] = moves;
    console.log(state.result.winner, moves.length, "plies; game", game);
  }
}
if (Object.keys(found).length !== 2) throw Error("Did not find both victories");
fs.writeFileSync(
  "tests/fixtures/victories.json",
  JSON.stringify(found, null, 2) + "\n",
);
