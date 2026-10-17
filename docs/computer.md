# Play against the computer

At `/` or `/play`, choose **Play against computer**, select your side and difficulty, then **Start game**. This starts a fresh game and replaces the local game on this device. Sharks always place first, so the computer opens if you choose Orcas. No account, server configuration or external AI service is needed.

| Difficulty | Search budget per move | Maximum search depth | Selection                                                               |
| ---------- | ---------------------- | -------------------- | ----------------------------------------------------------------------- |
| Easy       | 120 ms                 | 2 plies              | Random choice among close evaluations from the last completed iteration |
| Medium     | 450 ms                 | 5 plies              | Best evaluation from the last completed iteration                       |
| Hard       | 1,400 ms               | 8 plies              | Best evaluation from the last completed iteration                       |

Depths are limits rather than guarantees. Search checks the deadline between nodes, so browser scheduling and the final node evaluation can add a little time. A Web Worker keeps gameplay controls responsive. An incomplete iteration is discarded; an immediate timeout still returns a legal fallback. Difficulty names describe search settings, not measured ratings or a guarantee of optimal play.

The search uses iterative-deepening minimax with alpha-beta pruning and a transposition table capped at 40,000 entries per move. Terminal victories dominate evaluation. Other factors include captures, Shark threats, Orca mobility and immobilization, Shark connections, control of high-degree intersections, and placement opportunities. The root slightly discourages revisiting positions; this preference does not introduce a repetition draw or change the rules.

Undo returns to just before your last move, removing the computer's reply if one has arrived. If the computer opened as Sharks, that opening remains until you restart. Undoing a resignation reopens the position. Restart and Play again retain your side and difficulty. **Computer game setup** can start a game with different settings or return to **Friend on this device**. Draw offers are unavailable against the computer; resignation always resigns your chosen side, including while the computer is thinking.

Local saving includes the human seat and difficulty along with the validated move replay. Refresh during a computer turn resumes search from the saved position. Worker failures provide a retry button. Starting another game, undoing, or leaving the page cancels pending work; late responses cannot move in the replacement game. Online play remains server-authoritative and does not use this computer opponent.

Engine tests cover legal choices for both sides at all strengths, immediate wins for either side, deadlines, terminal positions, determinism, variety and input immutability. Component tests cover worker response validation, cancellation, failures and retry. Browser tests exercise both human seats, replies, full-turn undo, restart, saved-mode restoration, pending turns and resignation on desktop and mobile.
