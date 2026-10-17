"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { isLegalMove } from "@/lib/game/legal-moves";
import { serializeState } from "@/lib/game/serialization";
import type { GameState, Move } from "@/lib/game/types";
import {
  SEARCH_LIMITS,
  workerResponseSchema,
  type Difficulty,
} from "@/lib/ai/types";

export function useComputer(
  state: GameState,
  enabled: boolean,
  difficulty: Difficulty,
  onMove: (move: Move) => void,
) {
  const [failure, setFailure] = useState<{
    state: GameState;
    difficulty: Difficulty;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const receive = useEffectEvent((source: GameState, move: Move) => {
    if (enabled && state === source) onMove(move);
  });
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let worker: Worker | undefined;
    const fail = () => {
      if (active) {
        active = false;
        window.clearTimeout(timer);
        worker?.terminate();
        setFailure({ state, difficulty });
      }
    };
    const timer = window.setTimeout(
      fail,
      SEARCH_LIMITS[difficulty].timeMs + 10_000,
    );
    try {
      worker = new Worker(
        new URL("../../lib/ai/computer.worker.ts", import.meta.url),
      );
      worker.onmessage = (event: MessageEvent<unknown>) => {
        if (!active) return;
        window.clearTimeout(timer);
        const response = workerResponseSchema.safeParse(event.data);
        if (
          !response.success ||
          response.data.kind !== "move" ||
          !isLegalMove(state, response.data.move as Move)
        ) {
          fail();
          return;
        }
        active = false;
        worker?.terminate();
        receive(state, response.data.move as Move);
      };
      worker.onerror = fail;
      worker.onmessageerror = fail;
      worker.postMessage({ snapshot: serializeState(state), difficulty });
    } catch {
      fail();
    }
    return () => {
      active = false;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [state, enabled, difficulty, attempt]);
  return {
    failed:
      enabled && failure?.state === state && failure.difficulty === difficulty,
    retry: () => {
      setFailure(null);
      setAttempt((value) => value + 1);
    },
  };
}
