import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Board } from "@/components/board/board";
import { createInitialState } from "@/lib/game/initial-state";
afterEach(cleanup);
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
