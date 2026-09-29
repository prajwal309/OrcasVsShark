"use client";
import { useRef } from "react";
import { COORDINATES, EDGES, NODES } from "@/lib/game/graph";
import type { GameState, Move, NodeId } from "@/lib/game/types";
import { Piece } from "./piece";

export function Board({
  state,
  selected,
  moves,
  lastMove,
  flipped,
  onNode,
}: {
  state: GameState;
  selected: NodeId | null;
  moves: Move[];
  lastMove?: Move;
  flipped: boolean;
  onNode: (node: NodeId) => void;
}) {
  const refs = useRef<Partial<Record<NodeId, SVGGElement | null>>>({});
  const point = (node: NodeId) => {
    const { x, y } = COORDINATES[node];
    return {
      x: 60 + (flipped ? 1 - x : x) * 400,
      y: 60 + (flipped ? 1 - y : y) * 400,
    };
  };
  const captures = moves.filter((m) => m.kind === "capture");
  return (
    <svg
      className="game-board"
      viewBox="0 0 520 520"
      aria-label="Bagh-Chal game board. Use arrow keys to navigate, Enter or Space to play."
      role="group"
    >
      <defs>
        <radialGradient id="orca-disc" cx="35%" cy="20%">
          <stop stopColor="#344d5c" />
          <stop offset="1" stopColor="#0a1622" />
        </radialGradient>
        <radialGradient id="shark-disc" cx="30%" cy="20%">
          <stop stopColor="#d2e9df" />
          <stop offset="1" stopColor="#77aeb3" />
        </radialGradient>
        <radialGradient id="board-glow">
          <stop stopColor="#19515a" stopOpacity=".3" />
          <stop offset="1" stopColor="#092a35" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect
        x="18"
        y="18"
        width="484"
        height="484"
        rx="20"
        fill="url(#board-glow)"
      />
      <rect
        x="43"
        y="43"
        width="434"
        height="434"
        rx="4"
        className="board-border"
      />
      {EDGES.map(([a, b]) => (
        <line
          key={a + b}
          x1={point(a).x}
          y1={point(a).y}
          x2={point(b).x}
          y2={point(b).y}
          className="board-line"
        />
      ))}
      {captures.map(
        (m) =>
          m.kind === "capture" && (
            <line
              key={m.to}
              x1={point(m.from).x}
              y1={point(m.from).y}
              x2={point(m.to).x}
              y2={point(m.to).y}
              className="capture-path"
            />
          ),
      )}
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} className="coordinates">
          <text x={60 + i * 100} y="507" textAnchor="middle">
            {"abcde"[flipped ? 4 - i : i]}
          </text>
          <text x="13" y={65 + i * 100} textAnchor="middle">
            {flipped ? i + 1 : 5 - i}
          </text>
        </g>
      ))}
      {NODES.map((node) => {
        const p = point(node),
          piece = state.board[node],
          legal = moves.some((m) => m.to === node),
          active = selected === node;
        const last =
          lastMove &&
          (lastMove.to === node ||
            (lastMove.kind !== "place" && lastMove.from === node));
        return (
          <g
            key={node}
            ref={(el) => {
              refs.current[node] = el;
            }}
            role="button"
            tabIndex={0}
            aria-label={`${node}, ${piece ?? "empty"}${legal ? ", legal destination" : ""}`}
            aria-pressed={active}
            className={`board-node ${active ? "selected" : ""}`}
            transform={`translate(${p.x} ${p.y})`}
            onClick={() => onNode(node)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onNode(node);
              }
              const direction: Record<string, [number, number]> = {
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
              };
              if (direction[e.key]) {
                e.preventDefault();
                const [dx, dy] = direction[e.key];
                const target = NODES.find(
                  (n) =>
                    point(n).x === p.x + dx * 100 &&
                    point(n).y === p.y + dy * 100,
                );
                if (target) refs.current[target]?.focus();
              }
            }}
          >
            <circle r="38" fill="transparent" />
            <circle r="30" className="focus-ring" />
            {last && (
              <rect
                x="-29"
                y="-29"
                width="58"
                height="58"
                rx="14"
                className="last-move"
              />
            )}
            <circle r="3.5" className="intersection" />
            {active && (
              <circle
                r="31"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeDasharray="5 4"
              />
            )}
            {legal && !piece && (
              <>
                <circle r="13" className="legal-halo" />
                <circle r="5" fill="var(--accent)" />
              </>
            )}
            {piece && <Piece kind={piece} />}
          </g>
        );
      })}
    </svg>
  );
}
