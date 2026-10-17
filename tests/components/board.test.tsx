import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Board } from "@/components/board/board";
import { createInitialState } from "@/lib/game/initial-state";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves } from "@/lib/game/legal-moves";
import type { Move } from "@/lib/game/types";
import victories from "../fixtures/victories.json";
import {
  themeResultReason,
  isBoardTheme,
} from "@/lib/presentation/board-themes";
afterEach(cleanup);
it("animates only consecutive committed moves, clears effects, and cancels on view changes", () => {
  const initial = createInitialState();
  const move: Move = { kind: "place", to: "c3" };
  const next = applyMove(initial, move);
  const props = { selected: null, moves: [], flipped: false, onNode: vi.fn() };
  const { container, rerender } = render(
    <Board {...props} state={next} lastMove={move} />,
  );
  expect(container.querySelector(".move-effects")).toBeNull();
  rerender(<Board {...props} state={initial} />);
  rerender(<Board {...props} state={next} lastMove={move} />);
  expect(container.querySelector(".piece-place")).not.toBeNull();
  fireEvent.animationEnd(container.querySelector(".ripple-echo")!);
  // jsdom may expose prefixed animation support to React without AnimationEvent.
  if (container.querySelector(".ripple-echo"))
    fireEvent(
      container.querySelector(".ripple-echo")!,
      new Event("webkitAnimationEnd", { bubbles: true }),
    );
  expect(container.querySelector(".move-effects")).toBeNull();
  const step = getLegalMoves(next)[0];
  const third = applyMove(next, step);
  rerender(<Board {...props} state={third} lastMove={step} />);
  expect(container.querySelector(".piece-step")).not.toBeNull();
  rerender(<Board {...props} state={third} lastMove={step} flipped />);
  expect(container.querySelector(".move-effects")).toBeNull();
  expect(screen.getAllByRole("button")).toHaveLength(25);
});

it("uses a decorative capture ghost while the canonical board removes the captured piece immediately", () => {
  let state = createInitialState();
  const replay = victories.orcas as Move[];
  const captureIndex = replay.findIndex((move) => move.kind === "capture");
  for (const move of replay.slice(0, captureIndex))
    state = applyMove(state, move);
  const capture = replay[captureIndex];
  if (capture.kind !== "capture")
    throw new Error("Fixture must contain a capture");
  const props = { selected: null, moves: [], flipped: false, onNode: vi.fn() };
  const { container, rerender } = render(<Board {...props} state={state} />);
  rerender(
    <Board {...props} state={applyMove(state, capture)} lastMove={capture} />,
  );
  expect(container.querySelector(".captured-piece")).not.toBeNull();
  expect(container.querySelector(".piece-capture")).not.toBeNull();
  expect(
    screen.getByRole("button", { name: `${capture.over}, empty` }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: `${capture.to}, orca` }),
  ).toBeVisible();
  expect(container.querySelector(".move-effects")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

it("does not animate disabled motion, undo, skipped plies, or theme changes", () => {
  const initial = createInitialState();
  const placement: Move = { kind: "place", to: "c3" };
  const second = applyMove(initial, placement);
  const step = getLegalMoves(second)[0];
  const third = applyMove(second, step);
  const props = { selected: null, moves: [], flipped: false, onNode: vi.fn() };
  const { container, rerender } = render(<Board {...props} state={initial} />);
  rerender(<Board {...props} state={third} lastMove={step} />);
  expect(container.querySelector(".move-effects")).toBeNull();
  rerender(<Board {...props} state={second} lastMove={placement} />);
  expect(container.querySelector(".move-effects")).toBeNull();
  rerender(
    <Board {...props} state={third} lastMove={step} motionEnabled={false} />,
  );
  expect(container.querySelector(".move-effects")).toBeNull();
  rerender(
    <Board {...props} state={third} lastMove={step} theme="tigers-goats" />,
  );
  expect(container.querySelector(".move-effects")).toBeNull();
});
it("changes animal labels with the theme while preserving positions and node actions", () => {
  const state = applyMove(createInitialState(), { kind: "place", to: "c3" });
  const before = structuredClone(state);
  const onNode = vi.fn();
  const props = { state, selected: null, moves: [], flipped: false, onNode };
  const { rerender } = render(<Board {...props} theme="tigers-goats" />);
  expect(screen.getAllByRole("button")).toHaveLength(25);
  expect(screen.getByRole("button", { name: "a1, tiger" })).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "c3, goat" }));
  expect(onNode).toHaveBeenCalledWith("c3");
  expect(state).toEqual(before);
  rerender(<Board {...props} theme="ocean" />);
  expect(screen.getByRole("button", { name: "a1, orca" })).toBeVisible();
  expect(screen.getByRole("button", { name: "c3, shark" })).toBeVisible();
});
it("validates theme preferences and maps board result reasons without changing application reasons", () => {
  expect(isBoardTheme("tigers-goats")).toBe(true);
  expect(isBoardTheme("unknown")).toBe(false);
  expect(themeResultReason("Five Sharks captured", "tigers-goats")).toBe(
    "Five Goats captured",
  );
  expect(themeResultReason("All four Orcas immobilized", "tigers-goats")).toBe(
    "All four Tigers immobilized",
  );
  expect(themeResultReason("Resignation", "tigers-goats")).toBe("Resignation");
});
it("labels all 25 nodes and supports keyboard activation and navigation", () => {
  const onNode = vi.fn();
  render(
    <Board
      state={createInitialState()}
      selected={null}
      moves={[]}
      flipped={false}
      onNode={onNode}
    />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(25);
  const node = screen.getByRole("button", { name: "c3, empty" });
  node.focus();
  fireEvent.keyDown(node, { key: "Enter" });
  expect(onNode).toHaveBeenCalledWith("c3");
  fireEvent.keyDown(node, { key: "ArrowUp" });
  expect(screen.getByRole("button", { name: "c4, empty" })).toHaveFocus();
});
it("keeps keyboard movement visual when the board is flipped", () => {
  render(
    <Board
      state={createInitialState()}
      selected={null}
      moves={[]}
      flipped
      onNode={() => {}}
    />,
  );
  const node = screen.getByRole("button", { name: "c3, empty" });
  node.focus();
  fireEvent.keyDown(node, { key: "ArrowUp" });
  expect(screen.getByRole("button", { name: "c2, empty" })).toHaveFocus();
});
