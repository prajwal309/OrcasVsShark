CREATE TABLE lesson_progress (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lesson', 'quiz')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK (successes BETWEEN 0 AND attempts),
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  completed_at INTEGER,
  opening TEXT,
  hint_index INTEGER NOT NULL DEFAULT 0 CHECK (hint_index >= 0),
  PRIMARY KEY (player_id, kind, lesson_id)
);

CREATE TABLE puzzle_attempts (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  puzzle_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK (successes BETWEEN 0 AND attempts),
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  completed_at INTEGER,
  opening TEXT,
  hint_index INTEGER NOT NULL DEFAULT 0 CHECK (hint_index >= 0),
  PRIMARY KEY (player_id, puzzle_id)
);

CREATE TABLE learning_stats (
  player_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lessons_completed INTEGER NOT NULL,
  puzzles_solved INTEGER NOT NULL,
  puzzle_accuracy REAL CHECK (puzzle_accuracy BETWEEN 0 AND 1),
  current_streak INTEGER NOT NULL,
  current_kind TEXT NOT NULL CHECK (current_kind IN ('lesson', 'puzzle', 'quiz')),
  current_activity_id TEXT NOT NULL,
  last_activity INTEGER NOT NULL
);

CREATE TABLE learning_events (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  PRIMARY KEY (player_id, event_id)
);
