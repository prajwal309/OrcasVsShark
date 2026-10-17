import { deserializeState } from "@/lib/game/serialization";
import { findComputerMove } from "./search";
import { workerRequestSchema } from "./types";

self.onmessage = (event: MessageEvent<unknown>) => {
  try {
    const { snapshot, difficulty } = workerRequestSchema.parse(event.data);
    const state = deserializeState(snapshot);
    const { move } = findComputerMove(state, difficulty);
    self.postMessage({ kind: "move", move });
  } catch {
    self.postMessage({ kind: "error" });
  }
};
