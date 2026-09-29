import type { NodeId } from "./types";

export const NODES: readonly NodeId[] = [
  "a1",
  "b1",
  "c1",
  "d1",
  "e1",
  "a2",
  "b2",
  "c2",
  "d2",
  "e2",
  "a3",
  "b3",
  "c3",
  "d3",
  "e3",
  "a4",
  "b4",
  "c4",
  "d4",
  "e4",
  "a5",
  "b5",
  "c5",
  "d5",
  "e5",
];

// Explicit continuous straight paths are the topology. Coordinates never determine legality.
export const LINES: readonly (readonly NodeId[])[] = [
  ["a1", "b1", "c1", "d1", "e1"],
  ["a2", "b2", "c2", "d2", "e2"],
  ["a3", "b3", "c3", "d3", "e3"],
  ["a4", "b4", "c4", "d4", "e4"],
  ["a5", "b5", "c5", "d5", "e5"],
  ["a1", "a2", "a3", "a4", "a5"],
  ["b1", "b2", "b3", "b4", "b5"],
  ["c1", "c2", "c3", "c4", "c5"],
  ["d1", "d2", "d3", "d4", "d5"],
  ["e1", "e2", "e3", "e4", "e5"],
  ["a1", "b2", "c3", "d4", "e5"],
  ["a5", "b4", "c3", "d2", "e1"],
  ["a3", "b2", "c1"],
  ["c1", "d2", "e3"],
  ["a3", "b4", "c5"],
  ["c5", "d4", "e3"],
];
export const EDGES: readonly (readonly [NodeId, NodeId])[] = LINES.flatMap(
  (line) => line.slice(1).map((node, i) => [line[i], node] as const),
);
export const CAPTURE_PATHS: readonly (readonly [NodeId, NodeId, NodeId])[] =
  LINES.flatMap((line) =>
    line
      .slice(2)
      .flatMap((node, i) => [
        [line[i], line[i + 1], node] as const,
        [node, line[i + 1], line[i]] as const,
      ]),
  );
export const ADJACENCY = Object.fromEntries(
  NODES.map((node) => [
    node,
    NODES.filter((other) =>
      EDGES.some(
        ([a, b]) => (a === node && b === other) || (b === node && a === other),
      ),
    ),
  ]),
) as Record<NodeId, NodeId[]>;
export const COORDINATES = Object.fromEntries(
  NODES.map((node, i) => [
    node,
    { x: (i % 5) / 4, y: 1 - Math.floor(i / 5) / 4 },
  ]),
) as Record<NodeId, { x: number; y: number }>;
