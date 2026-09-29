"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Game from "./game";
import { browserAuth, accessToken } from "@/lib/auth/browser";
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
  send: (action: RoomAction) => Promise<void>;
}

export function OnlineRoom({ code }: { code: string }) {
  const [room, setRoom] = useState<RoomView | null>(null);
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [message, setMessage] = useState("Connecting to your room…");
  const [retry, setRetry] = useState<RoomRequest | null>(null);
  const latest = useRef<RoomView | null>(null);
  const pending = useRef<RoomRequest | null>(null);
  const submitting = useRef(false);

  const accept = useCallback((next: RoomView) => {
    if (latest.current && next.revision < latest.current.revision) return;
    latest.current = next;
    setRoom(next);
    setConnected(true);
    setNeedsJoin(false);
    setMessage("");
  }, []);

  const refresh = useCallback(async () => {
    try {
      accept(await roomApi(`/${code}`));
    } catch (error) {
      setConnected(false);
      if (error instanceof ApiError && error.code === "NOT_SEATED") {
        setNeedsJoin(true);
        setMessage("Join this room as Sharks.");
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : "Connection lost. Reconnecting…",
        );
    }
  }, [accept, code]);

  useEffect(() => {
    let disposed = false;
    let channel:
      ReturnType<ReturnType<typeof browserAuth>["channel"]> | undefined;
    const initial = window.setTimeout(() => void refresh(), 0);
    void (async () => {
      try {
        const token = await accessToken();
        if (disposed) return;
        const client = browserAuth();
        await client.realtime.setAuth(token);
        if (disposed) return;
        channel = client
          .channel(`room:${code}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "games",
              filter: `code=eq.${code}`,
            },
            (payload) => {
              // Ignore heartbeat-only updates to avoid a fetch/update feedback loop.
              if (
                Number(payload.new.revision) > (latest.current?.revision ?? -1)
              )
                void refresh();
            },
          )
          .subscribe((status) => {
            if (disposed) return;
            if (status === "SUBSCRIBED") void refresh();
            if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
              setMessage(
                "Live connection interrupted. Checking for updates every 5 seconds.",
              );
          });
      } catch (error) {
        if (!disposed)
          setMessage(
            error instanceof Error ? error.message : "Could not connect.",
          );
      }
    })();
    // Recovery and presence heartbeat; always hydrate from the authoritative API.
    const interval = window.setInterval(() => void refresh(), 5000);
    const offline = () => {
      setConnected(false);
      setMessage("You are offline. Reconnecting…");
    };
    const resume = () => void refresh();
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", resume);
    return () => {
      disposed = true;
      window.clearInterval(interval);
      window.clearTimeout(initial);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", resume);
      if (channel) void browserAuth().removeChannel(channel);
    };
  }, [code, refresh]);

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
      accept(await roomApi(`/${code}`, request));
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
          <Link href="/online">Back to online lobby</Link>
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
        online={{ room, busy: busy || !!retry, connected, message, send }}
      />
    </>
  );
}
