import type { Exercise } from "./exercises";
import {
  blockingPosition as block,
  huntingPosition as hunt,
} from "./positions";

export const lessons: readonly Exercise[] = [
  {
    id: "meet-the-sides",
    title: "Meet the two sides",
    level: "Beginner",
    intro:
      "Four {orcas} start in the corners. {sharks} play first and introduce their pieces one at a time.",
    objective: "Place the first {shark} on the marked intersection at c3.",
    position: "",
    side: "sharks",
    goal: { kind: "move", moves: ["+c3"] },
    focus: ["a1", "e1", "a5", "e5", "c3"],
    hints: ["Try the marked intersection in the middle, c3."],
    explanation:
      "The first {shark} is on the board. In a full game you can start on any empty intersection.",
  },
  {
    id: "follow-the-lines",
    title: "Follow the lines",
    level: "Beginner",
    intro:
      "The board has 25 intersections. A step follows a drawn line to the next point. Some intersections have diagonals and some do not.",
    objective: "Follow the diagonal from a1 to b2.",
    position: "+c3",
    side: "orcas",
    goal: { kind: "move", moves: ["a1-b2"] },
    focus: ["a1", "b2"],
    hints: ["Select the {orca} at a1, then look diagonally up and right."],
    explanation:
      "The diagonal directly connects a1 and b2. A nearby point without a connecting line cannot be reached by a step.",
  },
  {
    id: "place-a-piece",
    title: "Place a piece",
    level: "Beginner",
    intro:
      "On each placement turn, put one new {shark} on an empty point. Pieces already on the board stay put.",
    objective: "Place the next {shark} at d2.",
    position: hunt(2),
    side: "sharks",
    goal: { kind: "move", moves: ["+d2"] },
    focus: ["c3", "d2"],
    hints: ["Leave the piece on c3 and select the empty d2 point."],
    explanation:
      "A placement introduces a new piece. It does not move a piece you placed earlier.",
  },
  {
    id: "orca-step",
    title: "Step with {orcas}",
    level: "Beginner",
    intro:
      "{orcas} can step during either phase. A normal step moves exactly one link to an empty intersection.",
    objective: "Move the {orca} on a5 one step down the left edge.",
    position: "+c3",
    side: "orcas",
    goal: { kind: "move", moves: ["a5-a4"] },
    focus: ["a5"],
    hints: ["Select a5, then choose the neighboring point on the left edge."],
    explanation:
      "The edge from a5 to a4 is one link. Moving farther along that edge requires another turn unless a legal capture is available.",
  },
  {
    id: "shark-step",
    title: "Move after placement",
    level: "Beginner",
    intro:
      "All twenty {sharks} have been introduced, including any that were captured. The remaining {sharks} now step along one line to an empty point.",
    objective: "Step from a4 to a5.",
    position: hunt(40),
    side: "sharks",
    goal: { kind: "move", moves: ["a4-a5"] },
    focus: ["a4", "a5"],
    hints: [
      "Select the {shark} at a4. The empty point immediately above it is a5.",
    ],
    explanation:
      "After placement, {sharks} move pieces already on the board. They never jump or capture.",
  },
  {
    id: "first-jump",
    title: "Make a capture",
    level: "Beginner",
    intro:
      "{orcas} capture by jumping over an adjacent {shark} and landing on the next empty point along the same straight line.",
    objective: "Capture the piece at c3.",
    position: "+c3 a1-b2 +c2",
    side: "orcas",
    goal: { kind: "move", moves: ["b2xd4"] },
    focus: ["b2", "c3"],
    hints: ["Follow b2, c3, d4 along one diagonal. Land past the piece at c3."],
    explanation:
      "Landing on d4 removes the piece on c3. A capture is optional and ends the turn.",
  },
  {
    id: "check-legality",
    title: "Spot an illegal move",
    level: "Beginner",
    intro:
      "A jump requires an opposing piece in the middle, a straight marked path, and an empty landing point.",
    objective: "Try the marked jump from a1 to c3.",
    position: "+c3",
    side: "orcas",
    goal: {
      kind: "choice",
      choices: ["The jump is legal", "The jump is illegal"],
      answer: 1,
      example: { move: "a1xc3", legal: false },
    },
    focus: ["a1", "b2", "c3"],
    hints: ["Check both b2 and the landing point c3."],
    explanation:
      "b2 is empty and c3 is occupied. The jump fails both requirements.",
  },
  {
    id: "win-the-game",
    title: "Know how both sides win",
    level: "Beginner",
    intro:
      "{orcas} win at five captures. {sharks} win when all four {orcas} have no legal step or capture.",
    objective: "Make the fifth capture to win immediately.",
    position: hunt(43),
    side: "orcas",
    goal: { kind: "win" },
    focus: ["b3", "c5"],
    hints: ["Look for a jump from b3 or c5. Either can finish the game."],
    explanation:
      "A fifth capture ends the game immediately. The other side wins by taking away every legal move from all four hunters.",
  },
  {
    id: "scan-for-jumps",
    title: "Scan for capture opportunities",
    level: "Intermediate",
    intro:
      "A single group of {sharks} can offer jumps to more than one {orca}. Scan each hunter before deciding.",
    objective: "Find either available capture.",
    position: hunt(17),
    side: "orcas",
    goal: { kind: "capture" },
    hints: ["Two hunters can land on the same empty intersection, d4."],
    explanation:
      "Both b2 and b4 can reach d4 by jumping a different piece on a connected line.",
  },
  {
    id: "cover-the-landing",
    title: "Protect a threatened piece",
    level: "Intermediate",
    intro:
      "Blocking the landing point breaks a capture, even when the threatened piece stays beside an opponent.",
    objective: "Place a piece so {orcas} have no immediate capture.",
    position: hunt(6),
    side: "sharks",
    goal: { kind: "safe" },
    hints: ["Look past c3 from b2. Which point could the hunter land on?"],
    explanation:
      "Filling d4 closes the diagonal jump over c3 without creating a new immediate capture.",
  },
  {
    id: "control-intersections",
    title: "Control an important intersection",
    level: "Intermediate",
    intro:
      "Near the end of placement, one open intersection may serve as both a landing point and an escape route.",
    objective: "Place a piece so {orcas} have at most one legal move.",
    position: hunt(38),
    side: "sharks",
    goal: { kind: "mobility", maximum: 1 },
    hints: ["Look along the top edge from a5 to c5."],
    explanation:
      "Covering c5 removes the top-edge jump. Only the step from b1 to c1 remains.",
  },
  {
    id: "close-the-net",
    title: "Surround all four hunters",
    level: "Intermediate",
    intro:
      "Before claiming a trap, check every remaining hunter for both steps and jumps.",
    objective: "End the game by removing every legal move from {orcas}.",
    position: block(40),
    side: "sharks",
    goal: { kind: "win" },
    hints: [
      "c5 is the gap. Check what each piece leaves behind when it moves there.",
    ],
    explanation:
      "Moving c4 or d4 to c5 leaves no legal reply. Other moves to c5 vacate a point the hunter can still reach.",
  },
  {
    id: "jump-out",
    title: "Escape a tight position",
    level: "Intermediate",
    intro:
      "A crowded edge can still offer an escape. An open landing point beyond a neighbor is just as important as an empty point beside you.",
    objective: "Escape from a5 by capturing on the top edge.",
    position: hunt(39),
    side: "orcas",
    goal: { kind: "capture" },
    hints: ["Read the top row from a5 through b5 to c5."],
    explanation:
      "The jump to c5 clears the adjacent piece and takes the hunter out of the corner.",
  },
  {
    id: "last-placement",
    title: "Watch the phase change",
    level: "Intermediate",
    intro:
      "The placement phase counts how many pieces have entered the game, not how many remain. Nineteen have been introduced here.",
    objective: "Place the twentieth piece at c4.",
    position: block(38),
    side: "sharks",
    goal: { kind: "move", moves: ["+c4"] },
    hints: ["c4 was just vacated by the hunter now at c5."],
    explanation:
      "The phase changes as soon as the twentieth piece enters. The opponent moves next as usual, then {sharks} step instead of placing.",
  },
  {
    id: "count-replies",
    title: "Plan through an opponent reply",
    level: "Advanced",
    intro:
      "With four captures already made, a quiet move can threaten a fifth capture on the next turn. Check every defense before committing.",
    objective:
      "Play a quiet move that guarantees a win on your following turn, then finish the exercise line.",
    position: hunt(45),
    side: "orcas",
    goal: { kind: "win-in-two" },
    hints: [
      "Compare the three moves into the third rank. Ask whether one reply can remove all next-turn captures.",
    ],
    explanation:
      "Each accepted opening leaves a winning capture after every legal response. The exercise shows one of the most restrictive defenses.",
  },
  {
    id: "squeeze-the-corner",
    title: "Build a tactical trap",
    level: "Advanced",
    intro:
      "A trapping move can take away almost every reply without winning immediately. Look for a move the opponent is forced to answer.",
    objective: "Leave exactly one legal reply for {orcas}.",
    position: block(36),
    side: "sharks",
    goal: { kind: "mobility", maximum: 1 },
    hints: ["b2 sits beside both a1 and b1. Does filling it allow a jump?"],
    explanation:
      "Filling b2 leaves only c4–c5. The hunters near the lower corner cannot exploit the new piece as a stepping stone.",
  },
  {
    id: "count-mobility",
    title: "Reduce opponent mobility",
    level: "Advanced",
    intro:
      "Counting only empty neighbors misses jump escapes. Count both steps and captures after your proposed placement.",
    objective: "Leave {orcas} no more than two legal moves.",
    position: block(36),
    side: "sharks",
    goal: { kind: "mobility", maximum: 2 },
    hints: [
      "Compare b2, c5, and b5. Check the corner hunters after each placement.",
    ],
    explanation:
      "Both b2 and c5 meet the target. b2 is more restrictive in this position, leaving one reply instead of two.",
  },
  {
    id: "finish-a-winning-position",
    title: "Finish a winning endgame",
    level: "Advanced",
    intro:
      "When one capture wins, take stock of every jump before considering a positional move.",
    objective: "Find any immediate winning capture.",
    position: hunt(51),
    side: "orcas",
    goal: { kind: "win" },
    hints: ["Check the files through b2 and c3."],
    explanation:
      "Either winning jump reaches the fifth-capture threshold immediately.",
  },
  {
    id: "defend-the-fifth",
    title: "Avoid a costly exposure",
    level: "Advanced",
    intro:
      "The opponent has four captures. Your next move must avoid giving them any immediate jump.",
    objective: "Make a move that concedes no immediate capture.",
    position: hunt(50),
    side: "sharks",
    goal: { kind: "safe" },
    hints: [
      "The open c1 landing point is the danger. More than one piece can cover it.",
    ],
    explanation:
      "A step from d1 or c2 to c1 takes away the immediate winning jump without opening another.",
  },
  {
    id: "compare-candidates",
    title: "Compare candidate moves",
    level: "Advanced",
    intro:
      "Computer analysis can count exact replies and suggest moves by search. A suggested move is a candidate, and counts answer a specific tactical question.",
    objective:
      "Use Compare moves to find the placement that leaves the fewest replies, then play it.",
    position: hunt(38),
    side: "sharks",
    goal: { kind: "mobility", maximum: 1 },
    hints: [
      "Sort the candidates by the number of replies. Recheck what happens to the top-edge jump.",
    ],
    explanation:
      "c5 is the only placement with one legal reply. This comparison proves the immediate reply count, regardless of which move a longer search might prefer.",
  },
];
