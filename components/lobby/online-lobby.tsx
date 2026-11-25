"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import Link from "next/link";
import { GameHeader } from "@/components/navigation/game-header";
import { GridLoxLogo } from "@/components/navigation/gridlox-logo";
import { SiteFooter } from "@/components/navigation/site-footer";
import { useRouter } from "next/navigation";
import { Board } from "@/components/board/board";
import { createInitialState } from "@/lib/game/initial-state";
import {
  AccountLink,
  useAccount,
} from "@/components/navigation/account-navigation";
import { roomApi } from "@/lib/multiplayer/client";
import {
  guestProgressImportKey,
  guestProgressKey,
} from "@/lib/learn/guest-progress";
import { SiteThemeSelect } from "@/components/navigation/site-theme-select";
import {
  defaultGameSettings,
  readGameSettings,
} from "@/lib/presentation/game-settings";
import type { BoardTheme } from "@/lib/presentation/board-themes";
import type { QueueAction, QueueState } from "@/lib/multiplayer/matchmaking";
import { roomCodeSchema } from "@/lib/multiplayer/protocol";
import {
  rankedModes,
  timeControls,
  type MatchMode,
} from "@/lib/multiplayer/ranking";

const previewState = createInitialState();

function ignorePreviewInput() {}

function subscribeToGameSettings(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function googleErrorMessage(error?: string) {
  switch (error) {
    case undefined:
      return "";
    case "USERNAME_TAKEN":
      return "An account already uses that username. Sign in or choose a different username.";
    case "EMAIL_TAKEN":
      return "Could not create an account with that email address.";
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
  onlineUnavailable,
  register = false,
  requireSignupCode = false,
  isHome = false,
}: {
  returnRoom?: string;
  googleEnabled?: boolean;
  googleError?: string;
  onlineUnavailable: boolean;
  register?: boolean;
  requireSignupCode?: boolean;
  isHome?: boolean;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(() => googleErrorMessage(googleError));
  const requestId = useRef<string | null>(null);
  const {
    username: account,
    setUsername: setAccount,
    isGuest,
    setIsGuest,
  } = useAccount();
  const [mode, setMode] = useState<
    "login" | "register" | "reset" | "google-register"
  >(register ? "register" : "login");
  const savedBoardTheme = useSyncExternalStore(
    subscribeToGameSettings,
    () => readGameSettings().theme,
    () => defaultGameSettings.theme,
  );
  const [previewThemeOverride, setPreviewThemeOverride] =
    useState<BoardTheme | null>(null);
  const previewTheme = previewThemeOverride ?? savedBoardTheme;
  const upgradingGuest = isGuest && mode === "register";
  const loginLink = returnRoom ? `/online?room=${returnRoom}` : "/online";
  const registerLink = `/online?account=register${returnRoom ? `&room=${returnRoom}` : ""}#online-account`;

  const [searching, setSearching] = useState<MatchMode | null>(null);
  const [queueBusy, setQueueBusy] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");
  const queueRequest = useRef<AbortController | null>(null);
  const queue = useCallback(
    async (action: QueueAction, signal?: AbortSignal, mode?: MatchMode) => {
      if (action === "status" && queueRequest.current) return;
      queueRequest.current?.abort();
      const controller = new AbortController();
      queueRequest.current = controller;
      if (action !== "status") setQueueBusy(true);
      try {
        const response = await fetch("/api/matchmaking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, mode }),
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
        setSearching(state.status === "idle" ? null : (state.mode ?? "casual"));
        setQueueMessage(
          state.status === "matched"
            ? "Opponent found. Opening your game…"
            : state.status === "waiting"
              ? state.mode
                ? `Looking for a ${timeControls[state.mode].name} opponent…`
                : "Looking for an opponent…"
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
    if (onlineUnavailable || !account) return;
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
  }, [account, onlineUnavailable, queue, searching]);

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

  async function startGuestSession() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAccount(data.username);
      setIsGuest(true);
      setQueueMessage("");
      setMessage(
        "Your GridLox Games guest session is ready and saved on this device.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not start guest play.",
      );
    } finally {
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
      if (event && upgradingGuest) {
        try {
          const snapshot = localStorage.getItem(guestProgressKey);
          if (snapshot)
            localStorage.setItem(
              guestProgressImportKey(data.username),
              snapshot,
            );
        } catch {
          /* The account upgrade still succeeds when storage is unavailable. */
        }
      }
      setAccount(data.username);
      setIsGuest(data.isGuest ?? false);
      if (!data.username) {
        setSearching(null);
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
      <GameHeader
        account={
          isHome ? (
            <AccountLink />
          ) : onlineUnavailable ? null : (
            <AccountLink inLobby />
          )
        }
        onSettingsUpdate={
          isHome
            ? (settings) => setPreviewThemeOverride(settings.theme)
            : undefined
        }
      />
      <main className="main-content online-lobby play-lobby">
        {isHome ? (
          <section className="lobby-hero" aria-labelledby="home-title">
            <div className="lobby-hero-copy">
              <p className="eyebrow">A BAGHCHAL STRATEGY GAME</p>
              <h1 id="home-title">Orcas vs Sharks</h1>
              <p className="lobby-tagline">
                Master the hunt. Perfect the surround. Outsmart your opponent.
              </p>
              <div className="lobby-hero-actions">
                <Link className="primary-button" href="/play">
                  Play Now
                </Link>
                <Link className="lobby-secondary-button" href="/learn">
                  Learn to Play
                </Link>
              </div>
            </div>
            <div className={`lobby-board-preview theme-${previewTheme}`}>
              <Board
                state={previewState}
                selected={null}
                moves={[]}
                flipped={false}
                theme={previewTheme}
                interactive={false}
                onNode={ignorePreviewInput}
              />
            </div>
          </section>
        ) : (
          <div className="lobby-intro">
            <div>
              <p className="eyebrow">A BAGHCHAL STRATEGY GAME</p>
              <h1>Orcas vs Sharks</h1>
              <p className="lobby-tagline">
                Four Orcas hunt. Twenty Sharks close in.
              </p>
              <Link className="primary-button lobby-learn-link" href="/learn">
                Learn to Play
              </Link>
            </div>
            <div className="lobby-intro-brand">
              <SiteThemeSelect />
            </div>
          </div>
        )}
        {isHome ? (
          <>
            <section
              className="home-mode-cards"
              aria-label="Choose a game mode"
            >
              <article className="turn-card home-mode-card">
                <svg
                  className="home-mode-icon"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="10" r="4" />
                  <circle cx="23" cy="12" r="3" />
                  <path d="M3.5 27c.5-5.3 3.1-8 7.5-8s7 2.7 7.5 8M20 20c4.8-.9 7.5 1.5 8.3 5.5" />
                </svg>
                <h2>Play Online</h2>
                <p>
                  {onlineUnavailable
                    ? "Online matches are unavailable on this deployment."
                    : "Find a casual opponent, invite a friend, or explore ranked play."}
                </p>
                {onlineUnavailable ? (
                  <button className="home-mode-unavailable" disabled>
                    Currently unavailable
                  </button>
                ) : (
                  <Link className="primary-button" href="/online">
                    Open online lobby
                  </Link>
                )}
              </article>
              <article className="turn-card home-mode-card">
                <svg
                  className="home-mode-icon"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <rect x="8" y="8" width="16" height="16" rx="3" />
                  <path d="M13 3v5m6-5v5M13 24v5m6-5v5M3 13h5m-5 6h5m16-6h5m-5 6h5" />
                  <path d="M13 14h6m-3-3v6" />
                </svg>
                <h2>Play vs Computer</h2>
                <p>
                  Choose your side and challenge the computer at your preferred
                  difficulty.
                </p>
                <Link className="primary-button" href="/play?opponent=computer">
                  Set up a computer game
                </Link>
              </article>
              <article className="turn-card home-mode-card">
                <svg
                  className="home-mode-icon"
                  viewBox="0 0 32 32"
                  aria-hidden="true"
                >
                  <path d="M9 11h14c3 0 5 2 5.8 5.3l1.1 4.5c.6 2.4-2.2 4.1-4 2.3l-3.5-3.3H9.6l-3.5 3.3c-1.8 1.8-4.6.1-4-2.3l1.1-4.5C4 13 6 11 9 11Z" />
                  <path d="M10 14v6m-3-3h6m8-1h.1m3 3h.1" />
                </svg>
                <h2>Local Play</h2>
                <p>
                  Play both sides on one device. No account or online service
                  required.
                </p>
                <Link className="primary-button" href="/play">
                  Play locally
                </Link>
              </article>
            </section>
            <section
              className="turn-card daily-challenge-card"
              aria-labelledby="daily-challenge-title"
            >
              <div>
                <p className="eyebrow">DAILY CHALLENGE</p>
                <h2 id="daily-challenge-title">A new puzzle every day</h2>
                <p>Solve a tactical position and keep your streak going.</p>
              </div>
              <Link className="primary-button" href="/daily-puzzle">
                Solve today’s puzzle
              </Link>
            </section>
          </>
        ) : (
          <div className="play-modes">
            <section
              className="turn-card play-mode"
              aria-labelledby="online-mode"
            >
              <h2 id="online-mode">Play online</h2>
              <p>
                {onlineUnavailable
                  ? "Online accounts and matches are unavailable on this deployment."
                  : "Find an opponent for an untimed, casual match or invite a friend."}
              </p>
              {onlineUnavailable ? null : account ? (
                <div className="play-mode-actions">
                  {searching === "casual" ? (
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
                      disabled={queueBusy || busy || !!searching}
                      onClick={() => void queue("enter")}
                    >
                      Find opponent
                    </button>
                  )}
                  <button
                    disabled={busy || !!searching || queueBusy}
                    onClick={() => void create()}
                  >
                    Create Game
                  </button>
                </div>
              ) : (
                <div className="play-mode-actions">
                  <a className="primary-button" href="#online-account">
                    Sign in to play online
                  </a>
                  <button
                    disabled={busy}
                    onClick={() => void startGuestSession()}
                  >
                    Play as guest
                  </button>
                </div>
              )}
            </section>
            <section
              className="turn-card play-mode"
              aria-labelledby="computer-mode"
            >
              <h2 id="computer-mode">Play against computer</h2>
              <p>
                Choose Orcas or Sharks and set the difficulty to Easy, Medium,
                or Hard.
              </p>
              <Link className="primary-button" href="/play?opponent=computer">
                Set up a computer game
              </Link>
            </section>
          </div>
        )}
        {!isHome && !onlineUnavailable && (
          <section
            className="turn-card ranked-lobby"
            id="ranked-lobby"
            aria-labelledby="ranked-lobby-title"
          >
            <div className="ranked-section-heading">
              <h2 id="ranked-lobby-title">Ranked lobby</h2>
              <Link href="/leaderboards">Leaderboards</Link>
            </div>
            <p>Choose a time control to find a player near your rating.</p>
            <div className="ranked-quick-pair">
              {rankedModes.map((mode) => {
                const control = timeControls[mode];
                const description = (
                  <>
                    <strong>{control.name}</strong>
                    <span>
                      {control.minutes} + {control.increment}
                    </span>
                  </>
                );
                return account && !isGuest ? (
                  <button
                    key={mode}
                    type="button"
                    disabled={busy || queueBusy || !!searching}
                    data-searching={searching === mode || undefined}
                    onClick={() => void queue("enter", undefined, mode)}
                  >
                    {description}
                  </button>
                ) : (
                  <a
                    key={mode}
                    href="#online-account"
                    aria-label={`Sign in for ${control.name} ranked play`}
                  >
                    {description}
                  </a>
                );
              })}
            </div>
            {searching && searching !== "casual" && (
              <button
                type="button"
                disabled={queueBusy}
                onClick={() => void queue("cancel")}
              >
                Cancel search
              </button>
            )}
            <p role="status">{queueMessage}</p>
          </section>
        )}
        {!isHome && (
          <>
            <section className="turn-card lobby-account" id="online-account">
              <h2>
                {onlineUnavailable
                  ? "Your GridLox Games account"
                  : account && !upgradingGuest
                    ? "Account and private rooms"
                    : mode === "register"
                      ? "Create a player account"
                      : mode === "reset"
                        ? "Reset your password"
                        : "Your GridLox Games account"}
              </h2>
              {onlineUnavailable ? (
                <p>Sign-in and registration are currently unavailable.</p>
              ) : account && !upgradingGuest ? (
                <>
                  <p>
                    {isGuest ? "Playing as guest" : "Signed in as"} {account}
                  </p>
                  {isGuest ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMode("register");
                        setMessage("");
                      }}
                    >
                      Create account and keep progress
                    </button>
                  ) : (
                    <Link
                      className="ranked-text-link"
                      href={`/players/${account}`}
                    >
                      View player profile
                    </Link>
                  )}
                  <button
                    disabled={busy || !!searching || queueBusy}
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
                    <button
                      type="submit"
                      disabled={busy || !!searching || queueBusy}
                    >
                      Join Game
                    </button>
                  </form>
                </>
              ) : (
                <>
                  {mode === "reset" && (
                    <p>
                      Enter the reset code from your server administrator and
                      choose a new password.
                    </p>
                  )}
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
                    {mode === "register" && (
                      <>
                        <label htmlFor="account-email">Email address</label>
                        <input
                          id="account-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          maxLength={254}
                          required
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
                            mode === "login"
                              ? "current-password"
                              : "new-password"
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
                  {upgradingGuest ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode("login");
                        setMessage("");
                      }}
                    >
                      Cancel account creation
                    </button>
                  ) : mode === "register" ? (
                    <Link href={`${loginLink}#online-account`}>
                      Back to sign in
                    </Link>
                  ) : null}
                  {mode !== "login" && mode !== "register" && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMessage("");
                        setMode("login");
                      }}
                    >
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
                      <div className="account-options">
                        <Link href={registerLink}>Create an account</Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setMessage("");
                            setMode("reset");
                          }}
                        >
                          Forgot your password?
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
              <p role="status">{message}</p>
            </section>
            <div className="lobby-links">
              <Link href="/play">Play locally on one device</Link>
            </div>
          </>
        )}
        {!isHome && (
          <footer>
            <GridLoxLogo variant="footer" />
          </footer>
        )}
      </main>
      {isHome && <SiteFooter />}
    </div>
  );
}
