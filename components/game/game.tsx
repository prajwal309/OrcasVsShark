"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Board } from "@/components/board/board";
import { PieceIcon } from "@/components/board/piece";
import { createInitialState } from "@/lib/game/initial-state";
import { applyMove } from "@/lib/game/apply-move";
import { getLegalMoves, getLegalMovesFrom } from "@/lib/game/legal-moves";
import { formatMove } from "@/lib/game/notation";
import { deserializeState, serializeState } from "@/lib/game/serialization";
import type { GameState, Move, NodeId, Side } from "@/lib/game/types";

type Ending = { winner: Side | "draw"; reason: string };
type Session = { states: GameState[]; moves: Move[]; ending: Ending | null };
type Settings = { sound: boolean; motion: boolean; theme: "ocean" | "sand" };
const fresh = (): Session => ({
  states: [createInitialState()],
  moves: [],
  ending: null,
});
const SAVE_KEY = "orcas-sharks.local.v1";
const SETTINGS_KEY = "orcas-sharks.settings.v1";
const title = (side: Side) => (side === "orcas" ? "Orcas" : "Sharks");

export function Rules() {
  return (
    <div className="rules-copy">
      <p>Four hunters. Twenty defenders. One ocean.</p>
      <h3>Sharks surround</h3>
      <p>
        Sharks play first. Place one Shark on any empty intersection each turn.
        Once all 20 have been introduced, move one Shark along a line to an
        adjacent empty point. Trap all four Orcas to win.
      </p>
      <h3>Orcas capture</h3>
      <p>
        Move an Orca to an adjacent empty point, or jump over one Shark onto the
        empty point immediately beyond it. Follow a straight, connected line.
        Capture five Sharks to win.
      </p>
      <h3>A few things to remember</h3>
      <p>
        Captures are optional. No chained jumps. Orcas can move and capture
        during placement. Captured Sharks still count toward the 20 introduced.
      </p>
      <h3>Play your way</h3>
      <p>
        Share this device with a friend. Tap or click to play. With a keyboard,
        Tab to the board, use arrow keys to navigate, and Enter or Space to
        select or move. Undo is available to both players. Draws require both
        players’ agreement; there is no automatic repetition draw.
      </p>
      <p className="heritage">
        An original ocean-themed adaptation of Bagh-Chal, the traditional
        asymmetric strategy game of Nepal.
      </p>
    </div>
  );
}

export default function Game() {
  const [session, setSession] = useState<Session>(fresh);
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>({
    sound: false,
    motion: true,
    theme: "ocean",
  });
  const [modal, setModal] = useState<
    "rules" | "settings" | "restart" | "resign" | "draw" | null
  >(null);
  const [announcement, setAnnouncement] = useState(
    "Sharks move first. Place a Shark on an empty point.",
  );
  const [storageMessage, setStorageMessage] = useState("Saved on this device");
  const dialog = useRef<HTMLDialogElement>(null);
  const audio = useRef<AudioContext | null>(null);
  const state = session.states[session.states.length - 1];
  const ending: Ending | null =
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
  const moves = ending
    ? []
    : selected
      ? getLegalMovesFrom(state, selected)
      : [];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) {
          const value = JSON.parse(saved);
          if (!Array.isArray(value.moves) || value.moves.length > 10000)
            throw new Error();
          const restored = fresh();
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
          ["ocean", "sand"].includes(saved.theme)
        )
          setSettings(saved);
      } catch {
        /* Defaults remain available if browser storage is disabled. */
      }
      setReady(true);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      void audio.current?.close();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          SAVE_KEY,
          JSON.stringify({
            moves: session.moves,
            snapshot: serializeState(state),
            ending: session.ending,
          }),
        );
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        setStorageMessage("Storage unavailable · keep this tab open");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session, state, settings, ready]);

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

  function onNode(node: NodeId) {
    if (!ready || ending) return;
    const candidate = getLegalMoves(state).find(
      (m) => m.to === node && (m.kind === "place" || m.from === selected),
    );
    if (candidate) {
      const next = applyMove(state, candidate);
      setSession({
        states: [...session.states, next],
        moves: [...session.moves, candidate],
        ending: null,
      });
      setSelected(null);
      setAnnouncement(
        `${title(state.turn)} ${candidate.kind === "place" ? "placed at" : candidate.kind === "capture" ? "captured a Shark at " + candidate.over + " and moved to" : "moved to"} ${node}. ${next.result ? title(next.result.winner) + " win." : title(next.turn) + " to play."}`,
      );
      sound(candidate.kind === "capture");
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
        `Invalid action at ${node}. ${state.turn === "sharks" && state.phase === "shark-placement" ? "Place a Shark on an empty point." : "Select your piece, then a marked destination."}`,
      );
    }
  }

  function reset() {
    setSession(fresh());
    setSelected(null);
    setModal(null);
    setAnnouncement("New game. Sharks place first.");
  }
  function undo() {
    if (session.ending) setSession({ ...session, ending: null });
    else if (session.moves.length)
      setSession({
        states: session.states.slice(0, -1),
        moves: session.moves.slice(0, -1),
        ending: null,
      });
    setSelected(null);
    setAnnouncement("Last action undone.");
  }
  const pairs = Array.from(
    { length: Math.ceil(session.moves.length / 2) },
    (_, i) => session.moves.slice(i * 2, i * 2 + 2),
  );

  return (
    <div
      className={`site-shell theme-${settings.theme} ${settings.motion ? "" : "no-motion"}`}
    >
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Orcas vs Sharks home">
          <span className="brand-mark">◈</span>
          <span>
            ORCAS <span className="brand-vs">vs</span> SHARKS
          </span>
        </Link>
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
              <span className="status-dot" /> THE OCEAN IS YOUR ARENA
            </p>
            <h1>Instinct meets strategy.</h1>
            <p className="intro">
              Four Orcas. Twenty Sharks. Every move changes the tide.
            </p>
          </div>
          <div className="mode-badge">
            <span>♧</span>
            <div>
              Local two-player<small>One device. Two minds.</small>
            </div>
          </div>
        </div>
        <div className="game-layout">
          <section className="board-column" aria-label="Game table">
            <div
              className={`player-strip ${state.turn === "orcas" && !ending ? "current-player" : ""}`}
            >
              <div className="player-identity">
                <div className="piece-avatar orca-avatar">
                  <PieceIcon kind="orca" />
                </div>
                <div>
                  <h2>
                    Orcas <span>THE HUNTERS</span>
                  </h2>
                  <p>Capture 5 Sharks to win</p>
                </div>
              </div>
              <div
                className="capture-score"
                aria-label={`${state.sharksCaptured} of 5 Sharks captured`}
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
              />
              <div className="board-caption">
                <span>OCEAN TABLE</span>
                <span>01 — CLASSIC</span>
              </div>
            </div>
            <div
              className={`player-strip sharks-strip ${state.turn === "sharks" && !ending ? "current-player" : ""}`}
            >
              <div className="player-identity">
                <div className="piece-avatar shark-avatar">
                  <PieceIcon kind="shark" />
                </div>
                <div>
                  <h2>
                    Sharks <span>THE DEFENDERS</span>
                  </h2>
                  <p>Surround all 4 Orcas to win</p>
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
                disabled={!ready || (!session.moves.length && !session.ending)}
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
            <section className="turn-card">
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
                      : `${title(ending.winner)} win!`
                    : `${title(state.turn)} to play`}
                </h2>
              </div>
              <p>
                {ending
                  ? ending.reason
                  : selected
                    ? `Choose a marked destination for ${selected}.`
                    : state.turn === "sharks" &&
                        state.phase === "shark-placement"
                      ? "Place a Shark on an empty intersection."
                      : `Select an ${state.turn === "orcas" ? "Orca" : "available Shark"} to see its legal moves.`}
              </p>
              <div className="phase-row">
                <span>{state.phase === "shark-placement" ? "01" : "02"}</span>
                <div>
                  {state.phase === "shark-placement"
                    ? "Placement phase"
                    : "Movement phase"}
                  <small>{state.sharksPlaced} of 20 Sharks introduced</small>
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
                <span>SHARKS</span>
                <span>ORCAS</span>
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
                {ready ? storageMessage : "Loading local game…"}
              </div>
            </section>
            <div className="game-actions">
              <button
                className="primary-button"
                onClick={() =>
                  ending || state.ply === 0 ? reset() : setModal("restart")
                }
                disabled={!ready}
              >
                <span>＋</span> {ending ? "Play again" : "New game"}
              </button>
              <div>
                <button
                  disabled={!!ending || !ready}
                  onClick={() => setModal("draw")}
                >
                  ½ <span>Agree draw</span>
                </button>
                <button
                  disabled={!!ending || !ready}
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
                  Sharks win together. Close escape routes and leave no room for
                  a leap.
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
            Inspired by <Link href="/learn">Bagh-Chal</Link>, the traditional
            strategy game of Nepal.
          </p>
          <span className="local-note">UNRATED · NO CLOCK · LOCAL PLAY</span>
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
          <Rules />
        ) : modal === "settings" ? (
          <div className="settings-content">
            <label>
              Board theme
              <select
                value={settings.theme}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    theme: e.target.value as Settings["theme"],
                  })
                }
              >
                <option value="ocean">Deep ocean</option>
                <option value="sand">Sand table</option>
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
                  ? "Pass the device to your opponent. Both players must agree to end the game as a draw."
                  : `${title(state.turn)} will resign. ${title(state.turn === "sharks" ? "orcas" : "sharks")} will win.`}
            </p>
            <div className="dialog-actions">
              <button onClick={() => setModal(null)}>Keep playing</button>
              <button
                className="primary-button"
                onClick={() => {
                  if (modal === "restart") reset();
                  else {
                    const result: Ending =
                      modal === "draw"
                        ? { winner: "draw", reason: "Draw by agreement" }
                        : {
                            winner:
                              state.turn === "sharks" ? "orcas" : "sharks",
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
                    ? "Opponent: accept draw"
                    : "Confirm resignation"}
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
