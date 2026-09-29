"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { roomApi } from "@/lib/multiplayer/client";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";

export function OnlineLobby() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const requestId = useRef<string | null>(null);
  async function create() {
    if (busy) return;
    setBusy(true);
    setMessage("Creating your room…");
    requestId.current ??= crypto.randomUUID();
    try {
      const room = await roomApi("", { requestId: requestId.current });
      router.push(`/game/${room.code}`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not create a room.",
      );
      setBusy(false);
    }
  }
  return (
    <div className="site-shell theme-ocean">
      <main className="main-content online-lobby">
        <Link className="brand" href="/">
          ORCAS vs SHARKS
        </Link>
        <h1>Across the ocean.</h1>
        <p>
          Invite a friend to an unrated, untimed match. The host plays Orcas;
          the joining player plays Sharks.
        </p>
        <section className="turn-card">
          <h2>Play online</h2>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() => void create()}
          >
            Create Game
          </button>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = roomCodeSchema.safeParse(
                code.trim().toUpperCase(),
              );
              if (!parsed.success) {
                setMessage("Enter the 8-character room code.");
                return;
              }
              router.push(`/game/${parsed.data}`);
            }}
          >
            <label htmlFor="room-code">Room code</label>
            <input
              id="room-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              placeholder="ABCDEFGH"
              required
            />
            <button type="submit" disabled={busy}>
              Join Game
            </button>
          </form>
          <p role="status">{message}</p>
        </section>
        <p>
          Your anonymous player session is saved in this browser. Reopen the
          invite link here to reconnect. Clearing browser data loses your seat.
        </p>
        <Link href="/play">Play locally on one device</Link>
      </main>
    </div>
  );
}
