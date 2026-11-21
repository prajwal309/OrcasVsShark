"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Link from "next/link";
import { CapeCodCompass } from "@/components/board/cape-cod-background";
import { Board } from "@/components/board/board";
import { ThemedPieceIcon as PieceIcon } from "@/components/board/themed-piece";
import {
  isBoardTheme,
  themeLabels,
  themeResultReason,
  type BoardTheme,
} from "@/lib/presentation/board-themes";
import { createInitialState } from "@/lib/game/initial-state";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves, getLegalMovesFrom } from "@/lib/game/legal-moves";
import { formatMove } from "@/lib/game/notation";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import { computerSettingsSchema, type ComputerSettings } from "@/lib/ai/types";
import { useComputer } from "./use-computer";
import { VictoryBanner } from "./victory-banner";
import { RankedClocks } from "./ranked-clocks";
import { timeControls } from "@/lib/multiplayer/ranking";
import { AccountLink } from "@/components/navigation/account-navigation";
import type { OnlineController } from "./online-room";
import type { GameState, Move, NodeId, Side } from "@/lib/game/types";

type Ending = { winner: Side | "draw"; reason: string };
type Session = {
  states: GameState[];
  moves: Move[];
  ending: Ending | null;
  computer: ComputerSettings | null;
};
type Settings = { sound: boolean; motion: boolean; theme: BoardTheme };
const fresh = (computer: ComputerSettings | null = null): Session => ({
  states: [createInitialState()],
  moves: [],
  ending: null,
  computer,
});
const SAVE_KEY = "orcas-sharks.local.v1";
const SETTINGS_KEY = "orcas-sharks.settings.v1";

export function Rules({
  online = false,
  computer = false,
  theme = "ocean",
}: {
  online?: boolean;
  computer?: boolean;
  theme?: BoardTheme;
}) {
  const labels = themeLabels(theme);
  return (
    <div className="rules-copy">
      <p>Four hunters. Twenty defenders. One {labels.landscape}.</p>
      <h3>{labels.sides.sharks} surround</h3>
      <p>
        {labels.sides.sharks} play first. Place one {labels.defender} on any
        empty intersection each turn. Once all 20 have been introduced, move one{" "}
        {labels.defender} along a line to an adjacent empty point. Trap all four{" "}
        {labels.sides.orcas} to win.
      </p>
      <h3>{labels.sides.orcas} capture</h3>
      <p>
        Move one {labels.hunter} to an adjacent empty point, or jump over one{" "}
        {labels.defender} onto the empty point immediately beyond it. Follow a
        straight, connected line. Capture five {labels.sides.sharks} to win.
      </p>
      <h3>A few things to remember</h3>
      <p>
        Captures are optional. No chained jumps. {labels.sides.orcas} can move
        and capture during placement. Captured {labels.sides.sharks} still count
        toward the 20 introduced.
      </p>
      <h3>Play your way</h3>
      <p>
        {online
          ? "Each player controls their own side. "
          : computer
            ? "Play your chosen side against the computer. "
            : "Share this device with a friend. "}
        Tap or click to play. With a keyboard, Tab to the board, use arrow keys
        to navigate, and Enter or Space to select or move.{" "}
        {online
          ? "Online moves cannot be undone. "
          : computer
            ? "Undo takes back your last move and the computer’s reply. "
            : "Undo is available to both players. "}
        {computer
          ? "Draw offers are unavailable against the computer. "
          : "Draws require both players’ agreement. "}
        There is no automatic repetition draw.
      </p>
      <p className="heritage">
        An original digital adaptation of Bagh Chal, the traditional asymmetric
        strategy game of Nepal.
      </p>
    </div>
  );
}

export default function Game({
  online,
  openComputerSetup = false,
}: {
  online?: OnlineController;
  openComputerSetup?: boolean;
}) {
  const [localSession, setSession] = useState<Session>(() => fresh());
  const session: Session = online
    ? {
        states: [online.room.state],
        moves: online.room.moves,
        ending: online.room.ending,
        computer: null,
      }
    : localSession;
  const isOnline = !!online;
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    sound: false,
    motion: true,
    theme: "ocean",
  });
  const [modal, setModal] = useState<
    "rules" | "settings" | "restart" | "resign" | "draw" | "computer" | null
  >(openComputerSetup ? "computer" : null);
  const [setup, setSetup] = useState<ComputerSettings>({
    humanSide: "sharks",
    difficulty: "medium",
  });
  const [setupOpponent, setSetupOpponent] = useState<"computer" | "friend">(
    "computer",
  );
  const [announcement, setAnnouncement] = useState(
    online
      ? "Online game connected."
      : "Sharks move first. Place a Shark on an empty point.",
  );
  const [storageMessage, setStorageMessage] = useState("Saved on this device");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const state = session.states[session.states.length - 1];
  const labels = themeLabels(settings.theme);
  const title = (side: Side) => labels.sides[side];
  const rawEnding: Ending | null =
    session.ending ??
    (state.result
      ? {
          winner: state.result.winner,
          reason:
            state.result.reason === "five-captures"
              ? "Five Sharks captured"
              : "All four Orcas immobilized",
        }
      : null);
  const ending = rawEnding
    ? {
        ...rawEnding,
        reason: themeResultReason(rawEnding.reason, settings.theme),
      }
    : null;
  const computer = session.computer;
  const computerTurn =
    !!computer && state.turn !== computer.humanSide && !ending;
  const computerController = useComputer(
    state,
    !isOnline && ready && computerTurn,
    computer?.difficulty ?? "medium",
    commitLocalMove,
  );
  const lastHumanMove = computer
    ? session.moves.findLastIndex(
        (_, index) => session.states[index].turn === computer.humanSide,
      )
    : session.moves.length - 1;
  const moves =
    ending || computerTurn || (online && online.room.side !== state.turn)
      ? []
      : selected
        ? getLegalMovesFrom(state, selected)
        : [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = isOnline ? null : localStorage.getItem(SAVE_KEY);
        if (saved) {
          const value = JSON.parse(saved);
          if (!Array.isArray(value.moves) || value.moves.length > 10000)
            throw new Error();
          const restored = fresh(
            value.computer == null
              ? null
              : computerSettingsSchema.parse(value.computer),
          );
          for (const move of value.moves) {
            restored.states.push(applyMove(restored.states.at(-1)!, move));
            restored.moves.push(move);
          }
          if (
            serializeState(restored.states.at(-1)!) !==
            serializeState(deserializeState(value.snapshot))
          )
            throw new Error();
          if (value.ending !== null) {
            if (
              !value.ending ||
              !["orcas", "sharks", "draw"].includes(value.ending.winner) ||
              !["Resignation", "Draw by agreement"].includes(
                value.ending.reason,
              )
            )
              throw new Error();
            restored.ending = value.ending;
          }
          setSession(restored);
          setAnnouncement("Your local game has been restored.");
        }
      } catch {
        setStorageMessage("Saved game unavailable · started a new game");
      }
      try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
        if (
          saved &&
          typeof saved.sound === "boolean" &&
          typeof saved.motion === "boolean" &&
          isBoardTheme(saved.theme)
        ) {
          setSettings(saved);
          setAnnouncement((message) =>
            message === "Sharks move first. Place a Shark on an empty point."
              ? `${themeLabels(saved.theme).sides.sharks} move first. Place a ${themeLabels(saved.theme).defender} on an empty point.`
              : message,
          );
        }
      } catch {
        /* Defaults remain available if browser storage is disabled. */
      }
      setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      void audio.current?.close();
    };
  }, [isOnline]);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        if (!isOnline)
          localStorage.setItem(
            SAVE_KEY,
            JSON.stringify({
              moves: localSession.moves,
              snapshot: serializeState(state),
              ending: localSession.ending,
              computer: localSession.computer,
            }),
          );
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        setStorageMessage("Storage unavailable · keep this tab open");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [localSession, state, settings, ready, isOnline]);

  useEffect(() => {
    if (modal) dialog.current?.showModal();
    else dialog.current?.close();
  }, [modal]);

  function sound(capture: boolean) {
    if (!settings.sound) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const ctx = audio.current,
        tone = ctx.createOscillator(),
        gain = ctx.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(capture ? 220 : 440, ctx.currentTime);
      tone.frequency.exponentialRampToValueAtTime(
        capture ? 110 : 660,
        ctx.currentTime + 0.12,
      );
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      tone.connect(gain);
      gain.connect(ctx.destination);
      tone.start();
      tone.stop(ctx.currentTime + 0.23);
    } catch {
      setAnnouncement(
        "Audio is unavailable in this browser. You can continue playing.",
      );
    }
  }

  const previousOnlinePly = useRef(state.ply);
  const onlineSound = useEffectEvent(() =>
    sound(session.moves.at(-1)?.kind === "capture"),
  );
  useEffect(() => {
    if (isOnline && state.ply > previousOnlinePly.current) onlineSound();
    previousOnlinePly.current = state.ply;
  }, [isOnline, state.ply]);

  function onNode(node: NodeId) {
    if (!ready || ending) return;
    if (computerTurn) {
      setAnnouncement("The computer is thinking. Please wait for your turn.");
      return;
    }
    if (
      online &&
      (online.busy ||
        !online.connected ||
        online.room.waiting ||
        online.room.side !== state.turn)
    ) {
      setAnnouncement(
        online.room.waiting
          ? "Waiting for opponent."
          : "Wait for your turn and a connection to the server.",
      );
      return;
    }
    const candidate = getLegalMoves(state).find(
      (m) => m.to === node && (m.kind === "place" || m.from === selected),
    );
    if (candidate) {
      if (online) {
        void online.send({ kind: "move", move: candidate });
        setSelected(null);
        return;
      }
      commitLocalMove(candidate);
    } else if (
      state.board[node] === (state.turn === "orcas" ? "orca" : "shark") &&
      !(state.turn === "sharks" && state.phase === "shark-placement")
    ) {
      setSelected(selected === node ? null : node);
      setAnnouncement(
        selected === node
          ? "Selection cleared."
          : `${node} selected. ${
              getLegalMovesFrom(state, node)
                .map((m) => m.to)
                .join(", ") || "No legal destinations"
            }.`,
      );
    } else {
      setAnnouncement(
        `Invalid action at ${node}. ${state.turn === "sharks" && state.phase === "shark-placement" ? `Place a ${labels.defender} on an empty point.` : "Select your piece, then a marked destination."}`,
      );
    }
  }

  function commitLocalMove(candidate: Move) {
    const next = applyMove(state, candidate);
    setSession({
      ...session,
      states: [...session.states, next],
      moves: [...session.moves, candidate],
      ending: null,
    });
    setSelected(null);
    setAnnouncement(
      `${computerTurn ? "Computer: " : ""}${title(state.turn)} ${candidate.kind === "place" ? "placed at" : candidate.kind === "capture" ? `captured a ${labels.defender} at ` + candidate.over + " and moved to" : "moved to"} ${candidate.to}. ${next.result ? title(next.result.winner) + " win." : title(next.turn) + " to play."}`,
    );
    sound(candidate.kind === "capture");
  }

  function reset() {
    setSession(fresh(computer));
    setSelected(null);
    setModal(null);
    setAnnouncement(`New game. ${labels.sides.sharks} place first.`);
  }
  function undo() {
    if (session.ending) setSession({ ...session, ending: null });
    else if (lastHumanMove >= 0)
      setSession({
        ...session,
        states: session.states.slice(0, lastHumanMove + 1),
        moves: session.moves.slice(0, lastHumanMove),
        ending: null,
      });
    setSelected(null);
    setAnnouncement("Last action undone.");
  }
  const pairs = Array.from(
    { length: Math.ceil(session.moves.length / 2) },
    (_, i) => session.moves.slice(i * 2, i * 2 + 2),
  );
  const ranked = online?.room.ranked;
  const replayLabel = ranked
    ? "Back to ranked lobby"
    : online
      ? online.room.rematchOffer &&
        online.room.rematchOffer !== online.room.side
        ? "Accept rematch"
        : "Rematch"
      : ending
        ? "Play again"
        : "New game";
  const replayDisabled =
    !ready ||
    !!(
      online &&
      !ranked &&
      (!ending ||
        online.busy ||
        !online.connected ||
        online.room.rematchOffer === online.room.side)
    );
  function requestNewGame() {
    if (ranked) online.returnToLobby();
    else if (online) void online.send({ kind: "rematch" });
    else if (ending || state.ply === 0) reset();
    else setModal("restart");
  }

  return (
    <div
      className={`site-shell theme-${settings.theme} ${settings.motion ? "" : "no-motion"}`}
    >
      <header className="site-header">
        <div className="header-identity">
          <Link className="brand" href="/" aria-label="Orcas vs Sharks home">
            <span className="brand-mark">◈</span>
            <span>
              ORCAS <span className="brand-vs">vs</span> SHARKS
            </span>
          </Link>
          <AccountLink room={online?.room.code} />
        </div>
        <nav aria-label="Main navigation">
          <Link href="/play" className="nav-active">
            Play
          </Link>
          <button onClick={() => setModal("rules")}>How to play</button>
          <button
            onClick={() => setModal("settings")}
            aria-label="Open settings"
            className="settings-button"
          >
            ⚙
          </button>
        </nav>
      </header>
      <main className="main-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">
              <span className="status-dot" /> THE{" "}
              {labels.landscape.toUpperCase()} IS YOUR ARENA
            </p>
            <h1>Instinct meets strategy.</h1>
            <p className="intro">
              Four {labels.sides.orcas}. Twenty {labels.sides.sharks}.{" "}
              {settings.theme === "tigers-goats"
                ? "Every move shapes the hunt."
                : "Every move changes the tide."}
            </p>
          </div>
          <div className="mode-badge">
            <span>♧</span>
            <div>
              {online
                ? ranked
                  ? `Ranked ${timeControls[ranked.mode].name}`
                  : "Online two-player"
                : computer
                  ? "Against the computer"
                  : "Local two-player"}
              <small>
                {online
                  ? `You are ${title(online.room.side)}`
                  : computer
                    ? `You are ${title(computer.humanSide)} · ${computer.difficulty}`
                    : "One device. Two minds."}
              </small>
            </div>
          </div>
        </div>
        {!online && (
          <div className="online-entry">
            <button
              className="computer-entry"
              disabled={!ready}
              onClick={() => {
                setSetup(
                  computer ?? { humanSide: "sharks", difficulty: "medium" },
                );
                setSetupOpponent("computer");
                setModal("computer");
              }}
            >
              {computer ? "Computer game setup" : "Play against computer"}
            </button>
            <Link href="/online">Play online with a friend ↗</Link>
          </div>
        )}
        {online && (
          <section className="online-status turn-card" aria-label="Online room">
            <div>
              <strong>Room {online.room.code}</strong> · Round{" "}
              {online.room.round} · You are {title(online.room.side)}
            </div>
            {ranked ? (
              <RankedClocks
                ranking={ranked}
                anchor={online.clockAnchor}
                turn={ending ? null : state.turn}
                labels={labels.sides}
              />
            ) : (
              <>
                <label htmlFor="invite-link">Share this room link</label>
                <input
                  id="invite-link"
                  readOnly
                  value={
                    typeof window === "undefined"
                      ? `/game/${online.room.code}`
                      : `${window.location.origin}/game/${online.room.code}`
                  }
                  onFocus={(event) => event.target.select()}
                />
              </>
            )}
            <p role="status">
              {!online.connected
                ? "Connection lost. Reconnecting…"
                : online.room.waiting
                  ? "Waiting for opponent"
                  : ending
                    ? `Game over. ${ending.winner === "draw" ? "Draw" : title(ending.winner) + " win"}. ${ending.reason}.`
                    : `${online.room.side === state.turn ? "Your turn" : "Opponent’s turn"}. ${title(state.turn)} to play. ${state.ply ? `Last move: ${formatMove(session.moves.at(-1)!)}` : ""}`}
              {!online.room.waiting &&
              online.connected &&
              !online.room.opponentOnline &&
              !ending
                ? ranked
                  ? " · Opponent disconnected. The clock is still running."
                  : " · Opponent disconnected. Their seat is reserved."
                : ""}
            </p>
            {online.message && <p role="alert">{online.message}</p>}
            {online.room.drawOffer && (
              <div>
                <p>
                  {online.room.drawOffer === online.room.side
                    ? "Draw offered. Waiting for your opponent."
                    : "Your opponent offers a draw."}
                </p>
                {online.room.drawOffer !== online.room.side && (
                  <button
                    disabled={online.busy}
                    onClick={() => void online.send({ kind: "accept-draw" })}
                  >
                    Accept draw
                  </button>
                )}
                <button
                  disabled={online.busy}
                  onClick={() => void online.send({ kind: "decline-draw" })}
                >
                  {online.room.drawOffer === online.room.side
                    ? "Cancel draw offer"
                    : "Decline draw"}
                </button>
              </div>
            )}
            {online.room.rematchOffer && (
              <p>
                {online.room.rematchOffer === online.room.side
                  ? "Rematch offered. Waiting for your opponent."
                  : "Your opponent wants a rematch. Accept to swap sides and play again."}
              </p>
            )}
          </section>
        )}
        <div className="game-layout">
          <section className="board-column" aria-label="Game table">
            <div
              className={`player-strip ${state.turn === "orcas" && !ending ? "current-player" : ""}`}
            >
              <div className="player-identity">
                <div className="piece-avatar orca-avatar">
                  <PieceIcon kind="orca" theme={settings.theme} />
                </div>
                <div>
                  <h2>
                    {labels.sides.orcas} <span>THE HUNTERS</span>
                  </h2>
                  <p>Capture 5 {labels.sides.sharks} to win</p>
                </div>
              </div>
              <div
                className="capture-score"
                aria-label={`${state.sharksCaptured} of 5 ${labels.sides.sharks} captured`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <span
                    className={i < state.sharksCaptured ? "caught" : ""}
                    key={i}
                  >
                    ◇
                  </span>
                ))}
                <b>
                  {state.sharksCaptured}
                  <small> / 5</small>
                </b>
              </div>
            </div>
            <div className="board-surface">
              <div className="board-corner top-left" />
              <div className="board-corner bottom-right" />
              <Board
                state={state}
                selected={selected}
                moves={moves}
                lastMove={session.moves.at(-1)}
                flipped={flipped}
                onNode={onNode}
                theme={settings.theme}
                motionEnabled={ready && settings.motion}
                finished={!!ending}
              />
              {ending && ending.winner !== "draw" && (
                <VictoryBanner
                  winner={ending.winner}
                  theme={settings.theme}
                  actionLabel={replayLabel}
                  disabled={replayDisabled}
                  onPlay={requestNewGame}
                  note={
                    online?.room.rematchOffer === online?.room.side && online
                      ? "Rematch offered. Waiting for your opponent."
                      : undefined
                  }
                />
              )}
              <div className="board-caption">
                <span>{labels.caption}</span>
                {settings.theme === "tigers-goats" ? (
                  <span>01 — CLASSIC</span>
                ) : (
                  <CapeCodCompass />
                )}
              </div>
            </div>
            <div
              className={`player-strip sharks-strip ${state.turn === "sharks" && !ending ? "current-player" : ""}`}
            >
              <div className="player-identity">
                <div className="piece-avatar shark-avatar">
                  <PieceIcon kind="shark" theme={settings.theme} />
                </div>
                <div>
                  <h2>
                    {labels.sides.sharks} <span>THE DEFENDERS</span>
                  </h2>
                  <p>Surround all 4 {labels.sides.orcas} to win</p>
                </div>
              </div>
              <div className="reserve-count">
                <b>{20 - state.sharksPlaced}</b>
                <small>TO PLACE</small>
              </div>
            </div>
            <div className="board-tools">
              <button
                onClick={undo}
                disabled={
                  !!online || !ready || (lastHumanMove < 0 && !session.ending)
                }
              >
                <span>↶</span> Undo
              </button>
              <button onClick={() => setFlipped(!flipped)}>
                <span>⇅</span> Flip board
              </button>
              <button
                onClick={() =>
                  setSettings({ ...settings, sound: !settings.sound })
                }
                aria-pressed={settings.sound}
              >
                <span>♫</span> Sound {settings.sound ? "on" : "off"}
              </button>
              <button onClick={() => setModal("settings")}>
                <span>☷</span> Settings
              </button>
            </div>
          </section>
          <aside className="game-panel" aria-label="Game information">
            <section className={`turn-card${ending ? " game-complete" : ""}`}>
              <div className="section-label">
                {ending ? "GAME COMPLETE" : "THE NEXT MOVE"}
                <span>{ending ? "FINISHED" : `TURN ${state.ply + 1}`}</span>
              </div>
              <div className="turn-title">
                <span className="turn-symbol">{ending ? "✧" : "◎"}</span>
                <h2>
                  {ending
                    ? ending.winner === "draw"
                      ? "A shared tide."
                      : "Game complete"
                    : `${title(state.turn)} to play`}
                </h2>
              </div>
              <p>
                {ending
                  ? ending.reason
                  : computerTurn
                    ? computerController.failed
                      ? "The computer could not choose a move. Retry or start a new game."
                      : "The computer is thinking…"
                    : selected
                      ? `Choose a marked destination for ${selected}.`
                      : state.turn === "sharks" &&
                          state.phase === "shark-placement"
                        ? `Place a ${labels.defender} on an empty intersection.`
                        : `Select one ${state.turn === "orcas" ? labels.hunter : labels.defender} to see its legal moves.`}
              </p>
              {computer && !ending && (
                <div className="computer-status" role="status">
                  {computerController.failed ? (
                    <button onClick={computerController.retry}>
                      Retry computer move
                    </button>
                  ) : computerTurn ? (
                    `Computer playing ${title(state.turn)}.`
                  ) : (
                    `Your turn · You are ${title(computer.humanSide)}.`
                  )}
                </div>
              )}
              <div className="phase-row">
                <span>{state.phase === "shark-placement" ? "01" : "02"}</span>
                <div>
                  {state.phase === "shark-placement"
                    ? "Placement phase"
                    : "Movement phase"}
                  <small>
                    {state.sharksPlaced} of 20 {labels.sides.sharks} introduced
                  </small>
                </div>
              </div>
              <div className="progress-track">
                <div style={{ width: `${state.sharksPlaced * 5}%` }} />
              </div>
            </section>
            <section className="history-card">
              <div className="section-label">
                MOVE HISTORY<span>{session.moves.length} PLIES</span>
              </div>
              <div className="history-head">
                <span>#</span>
                <span>{labels.sides.sharks.toUpperCase()}</span>
                <span>{labels.sides.orcas.toUpperCase()}</span>
              </div>
              <div
                className="history-body"
                role="log"
                aria-label="Move history"
              >
                {pairs.length ? (
                  pairs.map((pair, i) => (
                    <div className="history-row" key={i}>
                      <span>{i + 1}.</span>
                      <span>{formatMove(pair[0])}</span>
                      <span>{pair[1] ? formatMove(pair[1]) : "—"}</span>
                    </div>
                  ))
                ) : (
                  <div className="history-empty">
                    <span>≈</span>
                    <p>A quiet ocean. For now.</p>
                    <small>Your moves will appear here.</small>
                  </div>
                )}
              </div>
              <div className="session-status">
                <span className="status-dot" />{" "}
                {online
                  ? "Server-authoritative · " +
                    (online.connected ? "Connected" : "Reconnecting")
                  : ready
                    ? storageMessage
                    : "Loading local game…"}
              </div>
            </section>
            <div className="game-actions">
              {(!ranked || ending) && (!ending || ending.winner === "draw") && (
                <button
                  aria-label={replayLabel}
                  className="primary-button"
                  onClick={requestNewGame}
                  disabled={replayDisabled}
                >
                  <span>＋</span> {replayLabel}
                </button>
              )}
              <div>
                <button
                  disabled={
                    !!computer ||
                    !!ending ||
                    !ready ||
                    (online
                      ? online.busy || !online.connected || online.room.waiting
                      : false)
                  }
                  onClick={() => setModal("draw")}
                >
                  ½ <span>{online ? "Offer draw" : "Agree draw"}</span>
                </button>
                <button
                  disabled={
                    !!ending ||
                    !ready ||
                    (online
                      ? online.busy || !online.connected || online.room.waiting
                      : false)
                  }
                  aria-label="Resign"
                  onClick={() => setModal("resign")}
                >
                  ⚑ <span>Resign</span>
                </button>
              </div>
            </div>
            <div className="tide-tip">
              <span>✧</span>
              <div>
                <h3>Strength in numbers.</h3>
                <p>
                  {labels.sides.sharks} win together. Close escape routes and
                  leave no room for a leap.
                </p>
                <button onClick={() => setModal("rules")}>
                  Explore the rules <span>↗</span>
                </button>
              </div>
            </div>
          </aside>
        </div>
        <footer>
          <div>
            <span className="footer-mark">◈</span> A new tide. An ancient game.
          </div>
          <p>
            Inspired by <Link href="/learn">Bagh Chal</Link>, the traditional
            strategy game of Nepal.
          </p>
          <span className="local-note">
            UNRATED · NO CLOCK · {online ? "ONLINE PLAY" : "LOCAL PLAY"}
          </span>
        </footer>
      </main>
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setModal(null);
        }}
      >
        <div className="dialog-heading">
          <h2>
            {modal === "rules"
              ? "Learn the currents"
              : modal === "settings"
                ? "Your ocean table"
                : modal === "computer"
                  ? "Choose your opponent"
                  : modal === "restart"
                    ? "Start a fresh game?"
                    : modal === "draw"
                      ? "Call it a draw?"
                      : "Resign this game?"}
          </h2>
          <button aria-label="Close dialog" onClick={() => setModal(null)}>
            ×
          </button>
        </div>
        {modal === "rules" ? (
          <Rules
            online={isOnline}
            computer={!!computer}
            theme={settings.theme}
          />
        ) : modal === "computer" ? (
          <div className="settings-content">
            <p>
              Start a new game here. This replaces the current local game and
              its history.
            </p>
            <label>
              Opponent
              <select
                value={setupOpponent}
                onChange={(e) =>
                  setSetupOpponent(e.target.value as "computer" | "friend")
                }
              >
                <option value="computer">Computer</option>
                <option value="friend">Friend on this device</option>
              </select>
            </label>
            {setupOpponent === "computer" && (
              <>
                <label>
                  Your side
                  <select
                    value={setup.humanSide}
                    onChange={(e) =>
                      setSetup({ ...setup, humanSide: e.target.value as Side })
                    }
                  >
                    <option value="sharks">
                      {labels.sides.sharks} · Place first
                    </option>
                    <option value="orcas">
                      {labels.sides.orcas} · Capture {labels.sides.sharks}
                    </option>
                  </select>
                </label>
                <label>
                  Difficulty
                  <select
                    value={setup.difficulty}
                    onChange={(e) =>
                      setSetup({
                        ...setup,
                        difficulty: e.target
                          .value as ComputerSettings["difficulty"],
                      })
                    }
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </label>
                <p>
                  {labels.sides.sharks} always play first. You can undo your
                  last turn to try another move.
                </p>
              </>
            )}
            <div className="dialog-actions">
              <button onClick={() => setModal(null)}>Keep playing</button>
              <button
                className="primary-button"
                onClick={() => {
                  setSession(
                    fresh(setupOpponent === "computer" ? setup : null),
                  );
                  setSelected(null);
                  setModal(null);
                  setAnnouncement(
                    setupOpponent === "computer"
                      ? `Computer game started. You are ${title(setup.humanSide)}. ${labels.sides.sharks} place first.`
                      : `Local two-player game started. ${labels.sides.sharks} place first.`,
                  );
                }}
              >
                Start game
              </button>
            </div>
          </div>
        ) : modal === "settings" ? (
          <div className="settings-content">
            <label>
              Board theme
              <select
                value={settings.theme}
                onChange={(e) => {
                  const theme = e.target.value as BoardTheme;
                  setSettings({
                    ...settings,
                    theme,
                  });
                  setAnnouncement(
                    `Board theme changed. ${themeLabels(theme).sides[state.turn]} to play.`,
                  );
                }}
              >
                <option value="ocean">Deep ocean</option>
                <option value="sand">Sand table</option>
                <option value="tigers-goats">Tigers &amp; Goats</option>
              </select>
            </label>
            <label>
              Move sounds
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) =>
                  setSettings({ ...settings, sound: e.target.checked })
                }
              />
            </label>
            <label>
              Animations
              <input
                type="checkbox"
                checked={settings.motion}
                onChange={(e) =>
                  setSettings({ ...settings, motion: e.target.checked })
                }
              />
            </label>
            <p>
              Your preferences are saved on this device. Reduced-motion system
              preferences are always respected.
            </p>
          </div>
        ) : (
          <>
            <p>
              {modal === "restart"
                ? "This replaces the current local game and its move history."
                : modal === "draw"
                  ? online
                    ? "Send a draw offer to your opponent. They must accept it to end the game."
                    : "Pass the device to your opponent. Both players must agree to end the game as a draw."
                  : `${title(online?.room.side ?? computer?.humanSide ?? state.turn)} will resign. ${title((online?.room.side ?? computer?.humanSide ?? state.turn) === "sharks" ? "orcas" : "sharks")} will win.`}
            </p>
            <div className="dialog-actions">
              <button onClick={() => setModal(null)}>Keep playing</button>
              <button
                className="primary-button"
                onClick={() => {
                  if (online) {
                    void online.send({
                      kind: modal === "draw" ? "offer-draw" : "resign",
                    });
                    setModal(null);
                    setSelected(null);
                    return;
                  }
                  if (modal === "restart") reset();
                  else {
                    const result: Ending =
                      modal === "draw"
                        ? { winner: "draw", reason: "Draw by agreement" }
                        : {
                            winner:
                              (computer?.humanSide ?? state.turn) === "sharks"
                                ? "orcas"
                                : "sharks",
                            reason: "Resignation",
                          };
                    setSession({ ...session, ending: result });
                    setSelected(null);
                    setModal(null);
                    setAnnouncement(
                      result.winner === "draw"
                        ? "Game drawn by agreement."
                        : `${title(result.winner)} win by resignation.`,
                    );
                  }
                }}
              >
                {modal === "restart"
                  ? "Start new game"
                  : modal === "draw"
                    ? online
                      ? "Send draw offer"
                      : "Opponent: accept draw"
                    : "Confirm resignation"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
