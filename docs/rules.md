# Canonical rules: bagh-chal-ocean-v1

Engine version: 1.0.0. The authority is AGENTS.md.

1. Four Orcas start at a1, e1, a5, e5. Sharks move first.
2. Each Shark placement turn introduces one of 20 Sharks on any empty point. Placed Sharks cannot move yet.
3. Orcas can step or capture from their first turn, including during placement.
4. After 20 Sharks have been introduced, including those already captured, Shark turns move one Shark along an edge to an empty neighboring point.
5. Orcas step along an edge, or capture one adjacent Shark by jumping along a continuous straight two-edge path to an empty landing point.
6. Jumps cannot turn, skip a missing segment, cross an Orca, or land on another piece. Captures are optional; there are no chained captures.
7. Orcas win immediately at five captures. Sharks win when all four Orcas have no legal step or capture.
8. Resignation and agreed draws are application results, not board moves. Both players share the device and must agree to a draw. Undo is unrestricted locally, including undoing a result.
9. There is no automatic repetition or no-progress draw in this local ruleset. Online clocks, timeout, abandonment, and rated play are deferred.

Notation: `+c3` is a placement, `a1–a2` is a step, and `a1×c1` is a capture. History pairs a Shark ply followed by an Orca ply. Coordinates are fixed to the position and do not change when the board is visually flipped.
