"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Game from "./game";
import { ApiError, roomApi } from "@/lib/multiplayer/client";
import type {
  RoomAction,
  RoomRequest,
  RoomView,
} from "@/lib/multiplayer/protocol";

export interface OnlineController {
  room: RoomView;
  busy: boolean;
  connected: boolean;
  message: string;
  clockAnchor: ClockAnchor;
  returnToLobby: () => void;
  send: (action: RoomAction) => Promise<void>;
}

type ClockAnchor = { receivedAt: number; latency: number };

export function OnlineRoom({ code }: { code: string }) {
  const router = useRouter();
  const [clockAnchor, setClockAnchor] = useState<ClockAnchor>({
    receivedAt: 0,
    latency: 0,
  });
  const [room, setRoom] = useState<RoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [message, setMessage] = useState("Connecting to your room…");
  const [retry, setRetry] = useState<RoomRequest | null>(null);
  const latest = useRef<RoomView | null>(null);
  const pending = useRef<RoomRequest | null>(null);
  const submitting = useRef(false);
  const refreshing = useRef(false);

  const accept = useCallback((next: RoomView, requestedAt: number) => {
    const current = latest.current;
    if (
      current &&
      (next.revision < current.revision ||
        (next.revision === current.revision &&
          next.ranked &&
          current.ranked &&
          next.ranked.sampledAt < current.ranked.sampledAt))
    )
      return;
    if (next.ranked) {
      const receivedAt = performance.now();
      setClockAnchor({
        receivedAt,
        latency: Math.min((receivedAt - requestedAt) / 2, 1000),
      });
    }
    latest.current = next;
    setRoom(next);
    setConnected(true);
    setNeedsJoin(false);
    setMessage("");
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    try {
      const started = performance.now();
      accept(await roomApi(`/${code}`), started);
    } catch (error) {
      setConnected(false);
      if (error instanceof ApiError && error.status === 401) {
        latest.current = null;
        pending.current = null;
        setRoom(null);
        setRetry(null);
        setNeedsJoin(false);
        setMessage(error.message);
      } else if (error instanceof ApiError && error.code === "NOT_SEATED") {
        setNeedsJoin(true);
        setMessage("Join this room as Sharks.");
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : "Connection lost. Reconnecting…",
        );
    } finally {
      refreshing.current = false;
    }
  }, [accept, code]);

  const pollingMs = room?.ranked && !room.ending ? 1000 : 2000;
  useEffect(() => {
    const initial = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), pollingMs);
    const offline = () => {
      setConnected(false);
      setMessage("You are offline. Reconnecting…");
    };
    const resume = () => void refresh();
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", resume);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(initial);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", resume);
    };
  }, [code, refresh, pollingMs]);

  async function send(action: RoomAction) {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    const current = latest.current;
    const request: RoomRequest = pending.current ?? {
      requestId: crypto.randomUUID(),
      expectedPly: current?.state.ply ?? 0,
      expectedRevision: current?.revision ?? 0,
      action,
    };
    pending.current = request;
    try {
      const started = performance.now();
      accept(await roomApi(`/${code}`, request), started);
      pending.current = null;
      setRetry(null);
      setMessage("");
    } catch (error) {
      if (error instanceof ApiError && error.status < 500)
        pending.current = null;
      setRetry(pending.current);
      await refresh();
      setMessage(
        error instanceof Error
          ? error.message
          : "Request interrupted. Retry your pending action.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (!room)
    return (
      <div className="site-shell theme-ocean">
        <main className="main-content online-lobby">
          <h1>Room {code}</h1>
          <p role="status">{message}</p>
          {needsJoin ? (
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => void send({ kind: "join" })}
            >
              Join Game
            </button>
          ) : (
            <button disabled={busy} onClick={() => void refresh()}>
              Reconnect
            </button>
          )}
          <Link href={`/online?room=${code}`}>Online lobby and sign-in</Link>
          <Link href="/play">Play locally</Link>
        </main>
      </div>
    );

  return (
    <>
      {retry && !busy && (
        <div className="online-retry" role="alert">
          A request could not be confirmed.{" "}
          <button onClick={() => void send(retry.action)}>
            Retry pending action
          </button>
        </div>
      )}
      <Game
        online={{
          room,
          busy: busy || !!retry,
          connected,
          message,
          send,
          clockAnchor,
          returnToLobby: () => router.push("/#ranked-lobby"),
        }}
      />
    </>
  );
}
