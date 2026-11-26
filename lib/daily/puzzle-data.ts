import type { Puzzle } from "@/lib/learn/exercises";

// Each position is a prefix of a separate simulated game from the standard start.
export const dailyPuzzles: readonly Puzzle[] = [
  {
    id: "diagonal-from-the-corner",
    title: "Diagonal from the corner",
    category: "Capture",
    level: "Beginner",
    intro: "The board is still open, but only one jump takes a piece.",
    objective: "Make a capture.",
    position: "+a3 a5-b4 +a4 b4-c3 +b2 e5-d4 +a2 c3-d2 +b5",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Check the diagonal out of a1."],
    explanation: "a1 jumps over b2 and lands on the empty c3.",
  },
  {
    id: "plug-the-edge",
    title: "Plug the edge",
    category: "Prevent a capture",
    level: "Beginner",
    intro:
      "Two pieces have already been captured. There is a third jump down the right edge.",
    objective: "Place a piece so the hunters have no immediate capture.",
    position:
      "+e3 e5-d5 +c3 a5-b4 +d2 a1-b2 +a2 b2xd4 +d1 e1xc3 +b5 c3-d2 +a5 d4-e4",
    side: "sharks",
    goal: {
      kind: "safe",
    },
    hints: ["Trace the line from e4 through e3."],
    explanation:
      "Placing on e2 blocks the landing behind e3 and leaves no other capture.",
  },
  {
    id: "back-up-the-edge",
    title: "Back up the edge",
    category: "Capture",
    level: "Intermediate",
    intro:
      "All twenty pieces have been placed. The last move offered a jump along the left edge.",
    objective: "Make a capture.",
    position:
      "+c2 e5-d4 +e3 e1-d2 +e2 d2xb2 +c5 a5-b4 +b5 b2-a3 +d1 a1-b2 +c1 b2-c2 +d5 a3-b3 +e5 d4-e4 +d2 c2-b2 +d3 b4-a3 +c2 b3-c3 +e1 a3-b4 +b1 b2-a3 +a1 e4-d4 +b2 b4-a4 +e4 a4-a5 +b4 a5-a4 +a5 a4xc4 +a2 c4-b4 a5-a4",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Look from a3 toward a5."],
    explanation:
      "a3 jumps over a4 to a5, the corner the opponent just vacated.",
  },
  {
    id: "one-placement-left",
    title: "One placement left",
    category: "Win in two",
    level: "Advanced",
    intro:
      "There are two pieces left to place. You can shut the board on your next turn.",
    objective:
      "Force a win on your next turn, then play the winning placement.",
    position:
      "+e3 a5-b4 +a4 e5-d4 +d5 a1-b2 +a5 d4-c5 +e5 e1-d2 +c1 b2-b1 +d1 c5-d4 +e2 d4-c3 +a3 b1-b2 +a2 b2-a1 +b1 c3-b3 +e4 b4-c4 +b5 a1-b2 +c2 c4-d4 +b4 d4-d3 +d4 d2-e1 +c3 b2xd2 +b2 d2-c2",
    side: "sharks",
    goal: {
      kind: "win-in-two",
    },
    hints: [
      "Stop the jump from c2 without filling d2.",
      "After the reply, fill the point the hunter just left.",
    ],
    explanation:
      "Placing on c4 blocks the jump and leaves d2 as the only destination. Fill the vacated point after the reply and all four hunters are trapped.",
  },
  {
    id: "jump-up-the-file",
    title: "Jump up the file",
    category: "Capture",
    level: "Beginner",
    intro: "The placements along the left edge have left a gap one file over.",
    objective: "Make a capture.",
    position:
      "+c5 e5-d4 +b5 a1-b2 +a3 e1-e2 +a2 e2-d2 +c1 a5-a4 +d1 a4-b4 +b3 b4-a5 +a4",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Look along the b-file from b2."],
    explanation: "b2 jumps the piece on b3 and lands on b4.",
  },
  {
    id: "cover-the-right-edge",
    title: "Cover the right edge",
    category: "Prevent a capture",
    level: "Intermediate",
    intro:
      "The hunter on c2 can jump toward the right edge if its landing stays empty.",
    objective: "Move a piece so the hunters have no immediate capture.",
    position:
      "+c5 e1-d2 +e1 a1-b2 +c1 e5-d4 +e3 b2-a3 +d1 a3-a2 +b5 a5-b4 +a5 b4-b3 +b1 d2-c3 +e5 d4-e4 +e2 c3-d2 +b4 b3-c3 +a4 a2-b2 +a1 c3-b3 +c4 e4-d4 +a3 b3-c3 +a2 d4-d5 +b3 d5-d4 +e4 d4-d5 +c2 c3-d3 +d4 d3-c3 d4-d3 d2xd4 e2-d2 c3-d3 c2-c3 b2-c2 b1-b2 c2xe2 a1-b1 d3-d2 b1-a1 d2-d3 c1-c2 d3-d2 e3-d3 d2-c1 d3-e3 e2-d2 c3-d3 c1xc3 d1-c1 d2-d1 c1-d2 d1-c1 b2-b1 c3-c2",
    side: "sharks",
    goal: {
      kind: "safe",
    },
    hints: ["Look for a neighbor of e2 that can slide into the gap."],
    explanation:
      "e1–e2 fills the landing behind d2 without opening another jump.",
  },
  {
    id: "last-piece-of-the-net",
    title: "Last piece of the net",
    category: "Win in one",
    level: "Intermediate",
    intro:
      "No pieces have been captured. Your final placement can end the game.",
    objective: "Immobilize all four hunters with your last placement.",
    position:
      "+c5 a1-b2 +b5 e1-d1 +e2 a5-b4 +e3 d1-d2 +d1 e5-e4 +a3 e4-d4 +e1 d4-d5 +c1 d5-d4 +a2 d2-c2 +d2 d4-e4 +a5 e4-d4 +d5 b2-b1 +e4 b1-b2 +d3 b2-a1 +e5 a1-b1 +c4 b1-a1 +b1 b4-b3 +b4 a1-b2 +a1 d4-c3",
    side: "sharks",
    goal: {
      kind: "win",
    },
    hints: ["Which empty point can the hunter on c3 actually reach?"],
    explanation:
      "c3–d4 is the only remaining escape. Placing on d4 closes it and ends the game.",
  },
  {
    id: "two-captures-to-go",
    title: "Two captures to go",
    category: "Win in two",
    level: "Advanced",
    intro:
      "Three pieces have been captured, and your opponent is still placing pieces.",
    objective: "Force a win on your next turn, then make the fifth capture.",
    position:
      "+e3 e1-d2 +e2 e5-d4 +d3 d4-c4 +e4 d2xd4 +e1 c4-b4 +c4 b4-c3 +d1 c3xc5 +d2 a1-b2 +b1 b2-c3 +a1 c3-b2 +d3 b2-a3 +a2 d4-e5 +c2 a3-a4 +c3 a4-a3 +b4 e5-d4 +a4 d4xb2 +c3",
    side: "orcas",
    goal: {
      kind: "win-in-two",
    },
    hints: [
      "Start with the jump over c3.",
      "If c3 stays open, check the diagonal from a5.",
    ],
    explanation:
      "b2×d4 is capture number four. If the opponent leaves c3 empty, a5×c3 wins. If they fill c3, d4×b2 wins instead.",
  },
  {
    id: "across-the-fourth-rank",
    title: "Across the fourth rank",
    category: "Capture",
    level: "Beginner",
    intro:
      "One of the hunters has a clear horizontal jump through the center file.",
    objective: "Make a capture.",
    position:
      "+a3 a1-b2 +c1 a5-a4 +d1 a4xa2 +b5 a2-a3 +c4 e1-d2 +c5 a3-a4 +a5 a4-b4 +c2",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Scan the fourth rank from b4."],
    explanation: "b4 jumps over c4 and lands on d4.",
  },
  {
    id: "hold-the-bottom-row",
    title: "Hold the bottom row",
    category: "Prevent a capture",
    level: "Beginner",
    intro: "The hunter at b1 threatens the piece on c1.",
    objective: "Place a piece so the hunters have no immediate capture.",
    position:
      "+b3 a1-b2 +c5 b2xb4 +a1 e1-d2 +e2 b4-a3 +e3 a3-b2 +a2 e5-d4 +c2 b2-c3 +c1 d2xb2 +d5 b2-b1",
    side: "sharks",
    goal: {
      kind: "safe",
    },
    hints: ["Follow the bottom row past c1."],
    explanation:
      "Placing on d1 takes away the landing for b1×d1 without allowing a jump elsewhere.",
  },
  {
    id: "fifth-on-the-second-rank",
    title: "Fifth on the second rank",
    category: "Win in one",
    level: "Intermediate",
    intro:
      "The last piece has just been placed. You already have four captures.",
    objective: "Win with a fifth capture.",
    position:
      "+c2 e5-d4 +c1 a5-b4 +d5 d4-c3 +e5 b4-b5 +d4 b5-b4 +d1 c3-d2 +b1 d2xb2 +c4 b4-c5 +a5 c5xe3 +b4 b2-c3 +c5 e3-e4 +b5 e4-e3 +d2 e1-e2 +e4 e3-d3 +d4 c3xe1 +a4 d3-c3 +d3 c3xe3 +a3 e3-d3 +c2 e1-d2 +b3",
    side: "orcas",
    goal: {
      kind: "win",
    },
    hints: ["Look from d2 across c2."],
    explanation: "d2×b2 takes the piece on c2 for the fifth capture.",
  },
  {
    id: "close-both-jumps",
    title: "Close both jumps",
    category: "Prevent a capture",
    level: "Advanced",
    intro:
      "The hunter on b2 has two jumps. Either one would be its fifth capture.",
    objective: "Stop both captures with a single move.",
    position:
      "+c5 e1-d2 +e1 a1-a2 +b5 a5-a4 +a1 a4-a5 +e3 a5-a4 +c4 a2-b2 +e4 d2-d1 +b4 d1-c1 +b1 c1-d2 +d5 b2-c2 +b3 c2-b2 +c1 a4-a3 +c3 b2xd4 +b2 d4-d3 +a5 a3-a2 +c3 a2xc2 +e2 e5-d4 +d1 d4xb2 +a3 b2-a2 +c3 d3-d4 a5-a4 d4xb2 b5-a5 d2-d3 e1-d2 b2-c3 d2-e1 a2-b2 a1-a2 c2-d2 d5-e5 d2-c2 e5-d5 c3-d4 a2-a1 d4-e5 a1-a2 b2-a1 b4-c3 a1-b2",
    side: "sharks",
    goal: {
      kind: "safe",
    },
    hints: ["Can the piece on c3 move onto the other jump’s landing?"],
    explanation:
      "c3–b4 removes the piece that b2 could jump toward d4 and fills the landing behind b3. No immediate capture remains.",
  },
  {
    id: "back-through-the-center",
    title: "Back through the center",
    category: "Capture",
    level: "Intermediate",
    intro:
      "The first move after placement has brought a piece into the middle.",
    objective: "Make a capture.",
    position:
      "+c1 e1-d2 +a3 e5-d4 +d3 d4-e3 +e5 e3xc3 +e4 a1-a2 +a4 a2-b2 +b4 a5-b5 +c2 c3xa5 +d1 b2-a1 +e1 d2xb2 +a2 b2-b3 +d2 b5-c5 +b1 a5-b4 +a5 c5-d4 +e3 a1-b2 +e2 b4-c4 +c2 b2-a1 +d5 c4-c5 +d3 c5-b5 +b4 b5-c5 b4-c3",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Check the diagonal from d4 through c3."],
    explanation: "d4 jumps the piece on c3 and lands on b2.",
  },
  {
    id: "funnel-to-the-top",
    title: "Funnel to the top",
    category: "Win in two",
    level: "Advanced",
    intro:
      "Two gaps are keeping the hunters mobile. One move leaves them with a single reply.",
    objective: "Force a win on your next turn, then complete the surround.",
    position:
      "+d3 e1-d2 +c2 d2xd4 +e1 a5-b5 +d2 a1-b2 +e3 d4-c4 +d1 e5-d4 +a3 c4-c3 +c1 d4-e4 +e2 c3-b4 +a4 b5-c5 +e5 c5-b5 +a2 e4-d4 +e4 b2-a1 +d3 a1-b1 +a5 b4-c4 +a1 c4-b4 +d5 b5-c5 +b5 d4-c3 +d4 c3-b2 +c3 b2-b3 c2-b2 b4-c4 c3-b4 c4-c3 d2-c2 c3-d2 c2-c3 d2-c2 d4-c4 c5-d4",
    side: "sharks",
    goal: {
      kind: "win-in-two",
    },
    hints: [
      "Close d2 without leaving another escape.",
      "After the reply, fill the point vacated by the last mobile hunter.",
    ],
    explanation:
      "e1–d2 leaves only d4–c5. Then e4–d4 closes the last route and traps all four hunters.",
  },
  {
    id: "survive-the-fourth-capture",
    title: "Survive the fourth capture",
    category: "Prevent a capture",
    level: "Intermediate",
    intro:
      "Four pieces have already been lost. The hunter on b4 is threatening to finish the game.",
    objective: "Prevent the fifth capture with a placement.",
    position:
      "+e3 e5-e4 +e2 a5-b4 +a4 b4-b5 +c4 e1-d1 +c3 e4-e5 +b2 d1-d2 +e4 d2xb4 +d4 a1xc3 +a5 c3-b3 +d2 e5xc3 +a3 c3xe1",
    side: "sharks",
    goal: {
      kind: "safe",
    },
    hints: ["Trace the fourth rank from b4 through c4."],
    explanation: "Placing on d4 shuts down b4×d4, the only immediate capture.",
  },
  {
    id: "down-the-center-file",
    title: "Down the center file",
    category: "Capture",
    level: "Intermediate",
    intro: "The opponent just moved a piece from c1 to c2.",
    objective: "Capture the piece that just moved.",
    position:
      "+e3 a5-b4 +a4 a1-b1 +c5 b1-c1 +e2 e5-d4 +e4 e1-d2 +b5 b4-c3 +a5 c1-b2 +e1 d4-d5 +a3 d5-e5 +a2 e5-d5 +a1 c3-c4 +b4 b2-c1 +d1 d5-e5 +d5 d2-c2 +b3 c1-b2 +c1 c2-d2 +b1 e5-d4 +c2 d4-e5 +d4 e5xc3 +e5 c4-d4 e3-d3 c3xe3 c2-c3 d4-c4 c3-d4 c4-c3 d4-c4 c3-d4 c4-c3 b2-c2 c3-b2 c2-c3 c1-c2",
    side: "orcas",
    goal: {
      kind: "capture",
    },
    hints: ["Check the center file from c3 down toward c1."],
    explanation: "c3 jumps over c2 to c1, the point the opponent just vacated.",
  },
  {
    id: "seal-the-left-flank",
    title: "Seal the left flank",
    category: "Win in one",
    level: "Intermediate",
    intro: "Two hunters can step to b4. The other two are already boxed in.",
    objective: "Finish the surround in one move.",
    position:
      "+c1 a1-b2 +d3 b2-b3 +e3 e5-d4 +e4 d4xd2 +d1 d2-c3 +d2 c3-d4 +c5 e1xc3 +e5 a5-b5 +c2 d4-d5 +d3 d5-d4 +d5 b5-b4 +b2 b4-a5 +b5 c3xa1 +d2 b3-c3 +e1 a1-a2 +b1 d4-c4 +d4 a2-a1 +b2 a5-b4 +a5 b4-b3 +a4 a1-a2 b2-a3 c3-b2 e1-e2 a2-a1 c5-b4 b2-c3 d2-e1 c3-b2 d1-d2 b2-a2 d2-c3 b3-b2 e1-d2 b2-b3 d5-c5 a2-b2 e2-e1 a1-a2 e3-e2 a2-a1 e2-e3 b2-a2 e1-e2 a2-b2 e5-d5 b2-a2 a3-b2 a2-a3 d2-e1 a3-a2 b4-a3 c4-b4 e1-d2 b4-c4",
    side: "sharks",
    goal: {
      kind: "win",
    },
    hints: ["Fill b4 from a point the hunters cannot reach."],
    explanation:
      "a5–b4 blocks the routes from b3 and c4 without opening a new step or capture.",
  },
  {
    id: "jump-up-the-d-file",
    title: "Jump up the d-file",
    category: "Win in one",
    level: "Intermediate",
    intro: "The latest move put a piece on d3. One capture will win the game.",
    objective: "Win with a fifth capture.",
    position:
      "+e3 a5-b4 +a4 a1-b1 +e2 b1-c1 +a1 b4-c5 +e4 e1-d2 +a5 c1-b2 +d1 b2-c2 +a3 d2-c3 +b5 c5-b4 +c1 c2-b2 +b3 b2-c2 +b1 b4xb2 +b4 c3-d2 +e1 c2-c3 +a2 c3-c4 +c5 e5-d5 +c2 d2-d3 +d2 c4-c3 +b3 d5-e5 +c4 d3-d4 c5-d5 e5xc5 e4-e5 d4-d3 e5-e4 c5-d5 c4-c5 c3-c4 e4-d4 c4xe4 c5-c4 d5-c5 d2-c3 b2xd2 b1-b2 e4-e5 c1-b1 d2-c1 e2-d2 e5-e4 d2-e2 d3-d2 e3-d3",
    side: "orcas",
    goal: {
      kind: "win",
    },
    hints: ["Check the landing on the other side of d3."],
    explanation: "d2×d4 takes the piece on d3 for the fifth capture.",
  },
  {
    id: "block-step-and-jump",
    title: "Block the step and the jump",
    category: "Win in one",
    level: "Advanced",
    intro: "One empty point is both a stepping point and a capture landing.",
    objective: "Immobilize all four hunters with a single move.",
    position:
      "+c1 e5-d4 +e3 a1-b2 +e4 e1-d2 +b1 a5-a4 +a2 a4-b4 +c5 b2-c3 +a3 b4-a4 +a1 d4-e5 +d1 d2-e1 +d5 c3-d3 +b2 e5-d4 +b5 a4-b4 +c2 e1-d2 +e2 d3-c3 +e5 c3-d3 +b3 d3-c3 +a5 b4-a4 +e1 c3-d3 +c4 d4xb4 +c3 d3-d4 e3-d3 b4-c4 b5-b4 d2-e3",
    side: "sharks",
    goal: {
      kind: "win",
    },
    hints: ["Check both e3–d2 and d4×d2."],
    explanation:
      "d1–d2 blocks the step from e3 and the jump from d4 without opening another route.",
  },
  {
    id: "build-a-bottom-row-threat",
    title: "Build a bottom-row threat",
    category: "Win in two",
    level: "Advanced",
    intro:
      "You have four captures but no immediate jump. The opponent is running out of safe moves.",
    objective: "Force a win on your next turn, then make the fifth capture.",
    position:
      "+e3 e1-d1 +e4 a5-b4 +a4 d1-d2 +a5 e5-d4 +c1 a1-b2 +c4 d4-e5 +d3 d2xd4 +b1 b4-b3 +a2 d4xb4 +b5 b3-c3 +c5 c3-d2 +e1 e5-d4 +a1 d2-c3 +d1 c3-d3 +a3 d3-d2 +d5 b4-c4 +b4 d4-e5 +b3 e5-d4 +e5 d2-e2 +c2 b2xd2 c1-b2 d2-c1 e3-d2 c1xe3 d1-c1 e2-d2 c1-c2 d4-d3 c2-c1 e3-d4 e1-e2 d4-e3 e2-e1 e3-d4 e4-e3 d2-e2 e3-e4 d3-d2 c1-d1",
    side: "orcas",
    goal: {
      kind: "win-in-two",
    },
    hints: [
      "Look for a step from d2 to the bottom row.",
      "Check which new jump the opponent’s move has opened.",
    ],
    explanation:
      "d2–c1 puts a hunter at the foot of the c-file. Every legal reply opens a winning jump. For example, b2–c2 allows c1×c3.",
  },
];
