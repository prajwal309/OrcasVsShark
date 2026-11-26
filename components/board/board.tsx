"use client";
import { useId, useRef, useState, type CSSProperties } from "react";
import { COORDINATES, EDGES, NODES } from "@/lib/game/graph";
import type { GameState, Move, NodeId } from "@/lib/game/types";
import { ThemedPiece as Piece } from "./themed-piece";
import { CapeCodBackground } from "./cape-cod-background";
import { ForestBackground } from "./forest-background";
import { SandBackground } from "./sand-background";
import { themeLabels, type BoardTheme } from "@/lib/presentation/board-themes";

export function Board({
  state,
  selected,
  moves,
  lastMove,
  flipped,
  onNode,
  theme = "ocean",
  motionEnabled = true,
  finished = false,
  focusNodes = [],
  guideMove,
  interactive = true,
}: {
  state: GameState;
  selected: NodeId | null;
  moves: Move[];
  lastMove?: Move;
  flipped: boolean;
  onNode: (node: NodeId) => void;
  theme?: BoardTheme;
  motionEnabled?: boolean;
  finished?: boolean;
  focusNodes?: readonly NodeId[];
  guideMove?: Move;
  interactive?: boolean;
}) {
  const refs = useRef<Partial<Record<NodeId, SVGGElement | null>>>({});
  const guideArrowId = useId().replace(/:/g, "");
  const [frame, setFrame] = useState<{
    position: GameState;
    flipped: boolean;
    theme: BoardTheme;
    enabled: boolean;
    sequence: number;
    effect: { id: number; move: Move } | null;
  }>({
    position: state,
    flipped,
    theme,
    enabled: motionEnabled,
    sequence: 0,
    effect: null,
  });
  if (
    frame.position !== state ||
    frame.flipped !== flipped ||
    frame.theme !== theme ||
    frame.enabled !== motionEnabled
  ) {
    // Animate only a newly committed, consecutive move, never hydration, undo,
    // reconnect catch-up, or a change to the board's orientation or theme.
    const consecutive =
      motionEnabled &&
      frame.enabled &&
      frame.flipped === flipped &&
      frame.theme === theme &&
      state.ply === frame.position.ply + 1 &&
      state.history.at(-2) === frame.position.history.at(-1);
    const sequence = frame.sequence + 1;
    setFrame({
      position: state,
      flipped,
      theme,
      enabled: motionEnabled,
      sequence,
      effect: consecutive && lastMove ? { id: sequence, move: lastMove } : null,
    });
  }
  const effect = frame.effect;
  const clearEffect = (id: number) =>
    setFrame((current) =>
      current.effect?.id === id ? { ...current, effect: null } : current,
    );
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
      className={`game-board${finished || state.result ? " is-finished" : ""}`}
      data-board-theme={theme}
      viewBox="0 0 520 520"
      aria-label={
        interactive
          ? "Baghchal game board. Use arrow keys to navigate, Enter or Space to play."
          : "Orcas vs Sharks board preview."
      }
      role={interactive ? "group" : "img"}
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
        <marker
          id={guideArrowId}
          markerWidth="8"
          markerHeight="8"
          refX="6"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0 0 6 3 0 6z" fill="var(--board-accent)" />
        </marker>
      </defs>
      {theme === "sand" ? (
        <SandBackground />
      ) : (
        <>
          {theme === "tigers-goats" ? (
            <ForestBackground />
          ) : (
            <CapeCodBackground />
          )}
          <rect
            x="18"
            y="18"
            width="484"
            height="484"
            rx="20"
            fill="url(#board-glow)"
          />
        </>
      )}
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
      {guideMove && guideMove.kind !== "place" && (
        <g
          className="tutorial-guide-arrow"
          aria-hidden="true"
          pointerEvents="none"
        >
          <line
            x1={point(guideMove.from).x}
            y1={point(guideMove.from).y}
            x2={point(guideMove.to).x}
            y2={point(guideMove.to).y}
            markerEnd={`url(#${guideArrowId})`}
          />
        </g>
      )}
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
      {effect && (
        <g
          key={effect.id}
          className="move-effects"
          aria-hidden="true"
          pointerEvents="none"
        >
          {effect.move.kind !== "place" && (
            <line
              className="move-trail"
              x1={point(effect.move.from).x}
              y1={point(effect.move.from).y}
              x2={point(effect.move.to).x}
              y2={point(effect.move.to).y}
            />
          )}
          <g
            transform={`translate(${point(effect.move.to).x} ${point(effect.move.to).y})`}
          >
            <circle r="27" className="arrival-ripple" />
            <circle
              r="27"
              className="arrival-ripple ripple-echo"
              onAnimationEnd={() => clearEffect(effect.id)}
            />
          </g>
          {effect.move.kind === "capture" && (
            <g
              transform={`translate(${point(effect.move.over).x} ${point(effect.move.over).y})`}
            >
              <g className="captured-piece">
                <Piece kind="shark" theme={theme} />
              </g>
              <circle r="18" className="capture-burst" />
            </g>
          )}
        </g>
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
      <g className="board-pieces" aria-hidden="true" pointerEvents="none">
        {NODES.map((node) => {
          const piece = state.board[node];
          if (!piece) return null;
          const p = point(node);
          const arriving = effect?.move.to === node ? effect : null;
          const origin =
            arriving && arriving.move.kind !== "place"
              ? point(arriving.move.from)
              : p;
          return (
            <g key={node} transform={`translate(${p.x} ${p.y})`}>
              <g
                key={arriving?.id ?? "still"}
                className={
                  arriving
                    ? `piece-arrival piece-${arriving.move.kind}`
                    : "board-piece"
                }
                style={
                  {
                    "--from-x": `${origin.x - p.x}px`,
                    "--from-y": `${origin.y - p.y}px`,
                  } as CSSProperties
                }
              >
                <Piece kind={piece} theme={theme} />
              </g>
            </g>
          );
        })}
      </g>
      {NODES.map((node) => {
        const p = point(node),
          piece = state.board[node],
          legal = moves.some((m) => m.to === node),
          active = selected === node,
          marked = focusNodes.includes(node);
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
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={
              interactive
                ? `${node}, ${piece ? themeLabels(theme).pieces[piece] : "empty"}${legal ? ", legal destination" : ""}${marked ? ", marked for the exercise" : ""}`
                : undefined
            }
            aria-pressed={interactive ? active : undefined}
            className={`board-node ${active ? "selected" : ""}`}
            transform={`translate(${p.x} ${p.y})`}
            onClick={interactive ? () => onNode(node) : undefined}
            onKeyDown={
              interactive
                ? (e) => {
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
                  }
                : undefined
            }
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
            {!piece && <circle r="3.5" className="intersection" />}
            {marked && !active && (
              <circle r="33" className="academy-focus-ring" />
            )}
            {active && (
              <circle
                r="31"
                fill="none"
                stroke="var(--board-accent)"
                strokeWidth="2.5"
                strokeDasharray="5 4"
                className="selection-ring"
              />
            )}
            {legal && !piece && (
              <>
                <circle r="13" className="legal-halo" />
                <circle r="5" fill="var(--board-accent)" />
              </>
            )}
          </g>
        );
      })}
      {(finished || state.result) && (
        <rect
          className="result-glow"
          x="22"
          y="22"
          width="476"
          height="476"
          rx="18"
          aria-hidden="true"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
