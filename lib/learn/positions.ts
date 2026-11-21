// Two complete, reachable reference games. Exercises take prefixes and may
// branch from them. Every prefix goes through the canonical move validator.
const hunt =
  "+c3 a5-a4 +d2 a4-a5 +e3 a1-b2 +a3 b2-a2 +e2 a5-b4 +d3 b4-b3 +e4 b3-b4 +c5 a2-b2 +c4 b2-b3 +a4 e5-d5 +d4 d5xb5 +d1 b5-a5 +d5 b3-b2 +a1 b2-a2 +c2 b4-b3 +e5 b3-b2 +b4 b2-b3 +b2 e1xc1 +b5 c1-b1 +e1 a5xc5 a4-a5 a2xa4 d2-d1 c5-b5 c3-d2 b3-c3 b2-a3 b5-c5 a1-a2 b1-b2 b4-b3 a4-b4 a5-a4 b4-b5 a3-b4 b2-b1 b4-a5 b1-c1 b3-b2 c1-b1 a2-a1 b1xb3".split(
    " ",
  );
const block =
  "+c1 a1-b2 +a3 b2-a2 +a4 a5-b5 +a5 b5-b4 +d1 b4-c5 +d5 e5-d4 +e5 d4-d3 +b4 a2-b2 +b3 e1-e2 +a2 e2-e3 +d2 d3-d4 +e4 d4-c4 +d4 e3-e2 +c2 b2-b1 +e3 c4-c3 +e1 c5-c4 +d3 c3-b2 +c3 b2-a1 +b2 c4-c5 +c4 c5-b5 d4-c5".split(
    " ",
  );

export const huntingPosition = (ply: number) => hunt.slice(0, ply).join(" ");
export const blockingPosition = (ply: number) => block.slice(0, ply).join(" ");
