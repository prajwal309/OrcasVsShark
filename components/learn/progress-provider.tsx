"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  applyEvent,
  emptyProgress,
  eventSchema,
  progressSchema,
  type Activity,
  type EventDetails,
  type LearningEvent,
  type Progress,
} from "@/lib/learn/progress";
import { z } from "zod";
import {
  guestProgressImportKey,
  guestProgressKey,
} from "@/lib/learn/guest-progress";

const outboxSchema = z.array(eventSchema);

function readStoredString(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parseStorage(value: string | null) {
  try {
    return JSON.parse(value ?? "null") as unknown;
  } catch {
    return null;
  }
}

function readStorage(key: string) {
  return parseStorage(readStoredString(key));
}

function writeStorage(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* In-memory progress remains available when storage is disabled. */
  }
}

const Context = createContext<{
  progress: Progress;
  ready: boolean;
  record: (activity: Activity, event: EventDetails) => void;
  syncFailed: boolean;
  retrySync: () => void;
} | null>(null);

export function useProgress() {
  const context = useContext(Context);
  if (!context) throw new Error("Learning progress provider is missing.");
  return context;
}

export function ProgressProvider({
  account,
  username,
  initial,
  storageKey = guestProgressKey,
  mirrorToParent = false,
  children,
}: {
  account: string | null;
  username?: string;
  initial: Progress;
  storageKey?: string;
  mirrorToParent?: boolean;
  children: ReactNode;
}) {
  const parentRecord = useContext(Context)?.record;
  const [progress, setProgress] = useState(initial);
  const [ready, setReady] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const current = useRef(initial);
  const initialProgress = useRef(initial);
  const outbox = useRef<LearningEvent[]>([]);
  const syncing = useRef(false);
  const outboxKey = `orcas-academy-outbox-v1:${account}`;
  const guestImportKey = username ? guestProgressImportKey(username) : null;

  const publish = useCallback((next: Progress) => {
    current.current = next;
    setProgress(next);
  }, []);

  const retrySync = useCallback(async () => {
    if (!account || syncing.current) return;
    const snapshot = guestImportKey ? readStoredString(guestImportKey) : null;
    const guest = progressSchema.safeParse(parseStorage(snapshot)).success
      ? snapshot
      : null;
    if (!guest && !outbox.current.length) return;
    syncing.current = true;
    setSyncFailed(false);
    try {
      if (guest && guestImportKey) {
        const response = await fetch("/api/learn/import", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Learning-Player": account,
          },
          body: guest,
        });
        if (!response.ok) throw new Error("Guest progress import failed.");
        const server = progressSchema.parse(await response.json());
        if (readStoredString(guestProgressKey) === guest)
          localStorage.removeItem(guestProgressKey);
        localStorage.removeItem(guestImportKey);
        publish(server);
      }
      while (outbox.current.length) {
        const response = await fetch("/api/learn", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Learning-Player": account,
          },
          body: JSON.stringify(outbox.current[0]),
        });
        if (!response.ok) throw new Error("Learning sync failed.");
        const server = progressSchema.parse(await response.json());
        outbox.current.shift();
        writeStorage(outboxKey, outbox.current);
        publish(
          outbox.current.reduce(
            (snapshot, event) => applyEvent(snapshot, event, Date.now()),
            server,
          ),
        );
      }
    } catch {
      setSyncFailed(true);
    } finally {
      syncing.current = false;
    }
  }, [account, guestImportKey, outboxKey, publish]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (account) {
        const pending = outboxSchema.safeParse(readStorage(outboxKey));
        outbox.current = pending.success ? pending.data : [];
        publish(
          outbox.current.reduce(
            (snapshot, event) => applyEvent(snapshot, event, Date.now()),
            initialProgress.current,
          ),
        );
        void retrySync();
      } else {
        const stored = progressSchema.safeParse(readStorage(storageKey));
        publish(stored.success ? stored.data : emptyProgress);
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [account, outboxKey, publish, retrySync, storageKey]);

  useEffect(() => {
    window.addEventListener("online", retrySync);
    return () => window.removeEventListener("online", retrySync);
  }, [retrySync]);

  const record = useCallback(
    (activity: Activity, details: EventDetails) => {
      const event = { ...activity, ...details, id: crypto.randomUUID() };
      const next = applyEvent(current.current, event, Date.now());
      publish(next);
      if (account) {
        outbox.current.push(event);
        writeStorage(outboxKey, outbox.current);
        void retrySync();
      } else {
        writeStorage(storageKey, next);
      }
      if (mirrorToParent) parentRecord?.(activity, details);
    },
    [
      account,
      mirrorToParent,
      outboxKey,
      parentRecord,
      publish,
      retrySync,
      storageKey,
    ],
  );

  return (
    <Context.Provider
      value={{ progress, record, ready, syncFailed, retrySync }}
    >
      {children}
    </Context.Provider>
  );
}
