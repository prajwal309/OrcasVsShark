"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AccountLink,
  useAccount,
} from "@/components/navigation/account-navigation";
import { roomApi } from "@/lib/multiplayer/client";
import type { QueueAction, QueueState } from "@/lib/multiplayer/matchmaking";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";

function googleErrorMessage(error?: string) {
  switch (error) {
    case undefined:
      return "";
    case "USERNAME_TAKEN":
      return "An account already uses that username. Sign in or choose a different username.";
    case "INVALID_INVITE":
      return "This signup code is invalid or expired.";
    case "GOOGLE_SIGNUP_REQUIRED":
      return "This Google account needs a signup code. Choose Create account with Google.";
    default:
      return "Google sign-in did not finish. Please try again.";
  }
}

export function OnlineLobby({
  returnRoom,
  googleEnabled = false,
  googleError,
  register = false,
  requireSignupCode = false,
}: {
  returnRoom?: string;
  googleEnabled?: boolean;
  googleError?: string;
  register?: boolean;
  requireSignupCode?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => googleErrorMessage(googleError));
  const requestId = useRef<string | null>(null);
  const { username: account, setUsername: setAccount } = useAccount();
  const [mode, setMode] = useState<
    "login" | "register" | "reset" | "google-register"
  >(register ? "register" : "login");
  const loginLink = returnRoom ? `/online?room=${returnRoom}` : "/online";
  const registerLink = `/online?account=register${returnRoom ? `&room=${returnRoom}` : ""}#online-account`;

  const [searching, setSearching] = useState(false);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");
  const queueRequest = useRef<AbortController | null>(null);
  const queue = useCallback(
    async (action: QueueAction, signal?: AbortSignal) => {
      if (action === "status" && queueRequest.current) return;
      queueRequest.current?.abort();
      const controller = new AbortController();
      queueRequest.current = controller;
      if (action !== "status") setQueueBusy(true);
      try {
        const response = await fetch("/api/matchmaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(5000),
            ...(signal ? [signal] : []),
          ]),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        if (signal?.aborted || controller.signal.aborted) return;
        const state = result as QueueState;
        setSearching(state.status !== "idle");
        setQueueMessage(
          state.status === "matched"
            ? "Opponent found. Opening your game…"
            : state.status === "waiting"
              ? "Looking for an opponent…"
              : "",
        );
        if (state.status === "matched") router.push(`/game/${state.code}`);
      } catch (error) {
        if (!signal?.aborted && !controller.signal.aborted) {
          setQueueMessage(
            error instanceof Error &&
              error.name !== "TimeoutError" &&
              error.name !== "TypeError"
              ? error.message
              : "Connection interrupted. Check your connection and try again.",
          );
        }
      } finally {
        if (queueRequest.current === controller) {
          queueRequest.current = null;
          if (action !== "status") setQueueBusy(false);
        }
      }
    },
    [router],
  );

  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    const check = () => void queue("status", controller.signal);
    const timer = searching
      ? window.setInterval(check, 1200)
      : window.setTimeout(check, 0);
    window.addEventListener("online", check);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.clearTimeout(timer);
      window.removeEventListener("online", check);
    };
  }, [account, queue, searching]);

  async function signInWithGoogle(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const signup = event
      ? Object.fromEntries(new FormData(event.currentTarget))
      : undefined;
    try {
      const response = await fetch("/api/account/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: returnRoom, signup }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not start Google sign-in.",
      );
      setBusy(false);
    }
  }

  async function authenticate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    const fields = event
      ? Object.fromEntries(new FormData(event.currentTarget))
      : {};
    try {
      const response = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: event ? mode : "logout", ...fields }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccount(data.username);
      if (!data.username) {
        setSearching(false);
        setQueueMessage("");
      }
      requestId.current = null;
      if (data.username && returnRoom) router.push(`/game/${returnRoom}`);
      else if (data.username && register) router.replace("/online");
      if (!data.username) setMode("login");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Account request failed.",
      );
    } finally {
      setBusy(false);
    }
  }
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
      <header className="site-header">
        <div className="header-identity">
          <Link className="brand" href="/" aria-label="Orcas vs Sharks home">
            <span className="brand-mark">◈</span>
            <span>
              ORCAS <span className="brand-vs">vs</span> SHARKS
            </span>
          </Link>
          <AccountLink inLobby />
        </div>
      </header>
      <main className="main-content online-lobby play-lobby">
        <div>
          <p className="eyebrow">A BAGH-CHAL STRATEGY GAME</p>
          <h1>Orcas vs Sharks</h1>
          <p>Four Orcas hunt. Twenty Sharks close in.</p>
        </div>
        <div className="play-modes">
          <section
            className="turn-card play-mode"
            aria-labelledby="online-mode"
          >
            <h2 id="online-mode">Play online</h2>
            <p>
              Find an opponent for an untimed, casual match or invite a friend.
            </p>
            {account ? (
              <div className="play-mode-actions">
                {searching ? (
                  <button
                    className="primary-button"
                    disabled={queueBusy}
                    onClick={() => void queue("cancel")}
                  >
                    Cancel search
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={queueBusy || busy}
                    onClick={() => void queue("enter")}
                  >
                    Find opponent
                  </button>
                )}
                <button
                  disabled={busy || searching || queueBusy}
                  onClick={() => void create()}
                >
                  Create Game
                </button>
              </div>
            ) : (
              <a className="primary-button" href="#online-account">
                Sign in to play online
              </a>
            )}
            <p role="status">{queueMessage}</p>
          </section>
          <section
            className="turn-card play-mode"
            aria-labelledby="computer-mode"
          >
            <h2 id="computer-mode">Play against computer</h2>
            <p>
              Choose Orcas or Sharks and set the difficulty to Easy, Medium, or
              Hard.
            </p>
            <Link className="primary-button" href="/play?opponent=computer">
              Set up a computer game
            </Link>
          </section>
        </div>
        <section className="turn-card lobby-account" id="online-account">
          <h2>
            {account
              ? "Account and private rooms"
              : mode === "register"
                ? "Create a player account"
                : "Your player account"}
          </h2>
          {account ? (
            <>
              <p>Signed in as {account}</p>
              <button
                disabled={busy || searching || queueBusy}
                onClick={() => void authenticate()}
              >
                Sign out
              </button>
              {returnRoom && (
                <Link href={`/game/${returnRoom}`}>Return to room</Link>
              )}
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
                <button type="submit" disabled={busy || searching || queueBusy}>
                  Join Game
                </button>
              </form>
            </>
          ) : (
            <>
              <form
                key={mode}
                method="post"
                onSubmit={(event) =>
                  void (mode === "google-register"
                    ? signInWithGoogle(event)
                    : authenticate(event))
                }
              >
                {mode !== "reset" && (
                  <>
                    <label htmlFor="account-username">Username</label>
                    <input
                      id="account-username"
                      name="username"
                      autoComplete="username"
                      pattern="[A-Za-z0-9_]{3,24}"
                      title="Use 3–24 letters, digits, or underscores."
                      required
                      maxLength={24}
                    />
                  </>
                )}
                {mode !== "google-register" && (
                  <>
                    <label htmlFor="account-password">Password</label>
                    <input
                      id="account-password"
                      name="password"
                      type="password"
                      minLength={mode === "login" ? undefined : 8}
                      maxLength={128}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                    />
                  </>
                )}
                {mode === "register" && (
                  <>
                    <label htmlFor="account-confirm-password">
                      Confirm password
                    </label>
                    <input
                      id="account-confirm-password"
                      name="confirmPassword"
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </>
                )}
                {(mode === "reset" ||
                  mode === "google-register" ||
                  (mode === "register" && requireSignupCode)) && (
                  <>
                    <label htmlFor="account-invitation">
                      {mode === "reset" ? "Reset code" : "Signup code"}
                    </label>
                    <input
                      id="account-invitation"
                      name="invitation"
                      autoComplete="off"
                      required
                      minLength={64}
                      maxLength={64}
                    />
                  </>
                )}
                <button
                  className="primary-button"
                  disabled={busy}
                  type="submit"
                >
                  {mode === "login"
                    ? "Sign in"
                    : mode === "register"
                      ? "Create account"
                      : mode === "google-register"
                        ? "Continue with Google"
                        : "Reset password"}
                </button>
              </form>
              {mode === "register" && (
                <Link href={`${loginLink}#online-account`}>
                  Back to sign in
                </Link>
              )}
              {mode !== "login" && mode !== "register" && (
                <button disabled={busy} onClick={() => setMode("login")}>
                  Back to sign in
                </button>
              )}
              {mode === "login" && (
                <>
                  {googleEnabled && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => void signInWithGoogle()}
                      >
                        Sign in with Google
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => setMode("google-register")}
                      >
                        Create account with Google
                      </button>
                    </>
                  )}
                  <Link href={registerLink}>Create an account</Link>
                  <button disabled={busy} onClick={() => setMode("reset")}>
                    Use a reset code
                  </button>
                </>
              )}
            </>
          )}
          <p role="status">{message}</p>
        </section>
        <div className="lobby-links">
          <Link href="/play">Play locally on one device</Link>
          <Link href="/learn">Learn the rules</Link>
        </div>
      </main>
    </div>
  );
}
