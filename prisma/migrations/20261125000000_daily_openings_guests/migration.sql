BEGIN;

ALTER TABLE accounts ADD COLUMN is_guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE accounts DROP CONSTRAINT accounts_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_auth_method_check
  CHECK (is_guest OR password_hash IS NOT NULL OR google_subject IS NOT NULL);

CREATE TABLE daily_puzzle_attempts (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  puzzle_date DATE NOT NULL,
  puzzle_id TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  completed_at DOUBLE PRECISION,
  PRIMARY KEY (player_id, puzzle_date)
);
CREATE INDEX daily_puzzle_archive ON daily_puzzle_attempts(puzzle_date);
CREATE INDEX games_completed_openings ON games(created_at DESC)
  WHERE result IS NOT NULL AND result <> 'null';
CREATE INDEX game_rounds_openings ON game_rounds(completed_at DESC);

COMMIT;
