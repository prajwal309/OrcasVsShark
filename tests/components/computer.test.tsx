import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useComputer } from "@/components/game/use-computer";
import { createInitialState } from "@/lib/game/initial-state";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves } from "@/lib/game/legal-moves";

class TestWorker {
  static instances: TestWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    TestWorker.instances.push(this);
  }
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
beforeEach(() => {
  TestWorker.instances = [];
  vi.stubGlobal("Worker", TestWorker);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("accepts only canonical moves from the worker and terminates after receiving one", () => {
  const state = createInitialState(),
    onMove = vi.fn();
  renderHook(() => useComputer(state, true, "medium", onMove));
  const worker = TestWorker.instances[0];
  expect(worker.postMessage).toHaveBeenCalledWith(
    expect.objectContaining({ difficulty: "medium" }),
  );
  act(() => worker.reply({ kind: "move", move: getLegalMoves(state)[0] }));
  expect(onMove).toHaveBeenCalledExactlyOnceWith(getLegalMoves(state)[0]);
  act(() => worker.reply({ kind: "move", move: getLegalMoves(state)[0] }));
  expect(onMove).toHaveBeenCalledOnce();
  expect(worker.terminate).toHaveBeenCalled();
});

it("rejects illegal results and lets the user retry with a fresh worker", () => {
  const state = createInitialState(),
    onMove = vi.fn();
  const { result } = renderHook(() => useComputer(state, true, "easy", onMove));
  act(() =>
    TestWorker.instances[0].reply({
      kind: "move",
      move: { kind: "place", to: "a1" },
    }),
  );
  expect(result.current.failed).toBe(true);
  expect(onMove).not.toHaveBeenCalled();
  act(() => result.current.retry());
  expect(result.current.failed).toBe(false);
  expect(TestWorker.instances).toHaveLength(2);
  act(() =>
    TestWorker.instances[1].reply({
      kind: "move",
      move: getLegalMoves(state)[0],
    }),
  );
  expect(onMove).toHaveBeenCalledOnce();
});

it("cancels stale results after undo, restart, switching modes, or unmount", () => {
  const state = createInitialState(),
    onMove = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ position, enabled }) => useComputer(position, enabled, "hard", onMove),
    {
      initialProps: { position: state, enabled: true },
    },
  );
  const oldWorker = TestWorker.instances[0];
  const next = applyMove(state, getLegalMoves(state)[0]);
  rerender({ position: next, enabled: true });
  act(() => oldWorker.reply({ kind: "move", move: getLegalMoves(state)[0] }));
  expect(oldWorker.terminate).toHaveBeenCalled();
  expect(onMove).not.toHaveBeenCalled();
  const nextWorker = TestWorker.instances[1];
  rerender({ position: next, enabled: false });
  act(() => nextWorker.reply({ kind: "move", move: getLegalMoves(next)[0] }));
  expect(onMove).not.toHaveBeenCalled();
  rerender({ position: state, enabled: true });
  const lastWorker = TestWorker.instances[2];
  unmount();
  act(() => lastWorker.reply({ kind: "move", move: getLegalMoves(state)[0] }));
  expect(lastWorker.terminate).toHaveBeenCalled();
  expect(onMove).not.toHaveBeenCalled();
});

it("reports a worker failure or timeout without moving for the human", () => {
  vi.useFakeTimers();
  const state = createInitialState(),
    onMove = vi.fn();
  const { result } = renderHook(() =>
    useComputer(state, true, "medium", onMove),
  );
  act(() => TestWorker.instances[0].onerror?.());
  expect(result.current.failed).toBe(true);
  act(() => result.current.retry());
  act(() => vi.advanceTimersByTime(11_000));
  expect(result.current.failed).toBe(true);
  expect(onMove).not.toHaveBeenCalled();
});
