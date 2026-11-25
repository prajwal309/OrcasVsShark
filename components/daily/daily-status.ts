"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAccount } from "@/components/navigation/account-navigation";
import {
  dailySolved,
  newDailyProgress,
  utcDateString,
  type DailyProgress,
} from "@/lib/daily/status";

const changed = "gridlox-daily-progress";
const memory = new Map<string, string>();

function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener("storage", callback);
  };
}

function subscribeToDate(callback: () => void) {
  let timer: number;
  function schedule() {
    const next = new Date();
    next.setUTCHours(24, 0, 0, 0);
    timer = window.setTimeout(
      () => {
        callback();
        schedule();
      },
      Math.max(1, next.getTime() - Date.now()),
    );
  }
  schedule();
  window.addEventListener("focus", callback);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("focus", callback);
  };
}

export function useDailyDate() {
  return useSyncExternalStore(subscribeToDate, utcDateString, utcDateString);
}

function stored(key: string) {
  try {
    return memory.get(key) ?? localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function parse(value: string | null): DailyProgress {
  try {
    const progress = JSON.parse(value ?? "null");
    if (
      progress &&
      ["new", "attempted", "solved", "hinted", "revealed"].includes(
        progress.status,
      ) &&
      Number.isInteger(progress.hintsUsed) &&
      progress.hintsUsed >= 0
    )
      return progress;
  } catch {
    // Discard invalid browser storage.
  }
  return newDailyProgress;
}

function save(key: string, progress: DailyProgress) {
  const snapshot = JSON.stringify(progress);
  try {
    localStorage.setItem(key, snapshot);
    memory.delete(key);
  } catch {
    memory.set(key, snapshot);
  }
  window.dispatchEvent(new Event(changed));
}

export function useDailyProgress(date: string, sync = false) {
  const { username, isGuest } = useAccount();
  const registered = !!username && !isGuest;
  const key = `gridlox-daily-v1:${registered ? username : "guest"}:${date}`;
  const snapshot = useSyncExternalStore(
    subscribe,
    () => stored(key),
    () => null,
  );

  useEffect(() => {
    if (!registered || !sync) return;
    let controller: AbortController | undefined;
    function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      const before = stored(key);
      void fetch(`/api/daily-puzzle?status=${date}`, { signal: request.signal })
        .then(async (response) => {
          if (!response.ok) return;
          const remote: DailyProgress = await response.json();
          if (request.signal.aborted || stored(key) !== before) return;
          const local = parse(before);
          const remoteFinal =
            dailySolved(remote.status) || remote.status === "revealed";
          const status =
            remoteFinal || local.status === "new"
              ? remote.status
              : local.status;
          save(key, {
            status,
            hintsUsed: Math.max(local.hintsUsed, remote.hintsUsed),
          });
        })
        .catch(() => {
          // Keep the device's progress when account status is unavailable.
        });
    }
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller?.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [registered, sync, date, key]);

  return {
    key,
    progress: parse(snapshot),
    read: () => parse(stored(key)),
    save: (progress: DailyProgress) => save(key, progress),
  };
}
