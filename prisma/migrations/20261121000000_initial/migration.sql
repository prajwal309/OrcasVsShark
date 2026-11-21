BEGIN;

CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 24 AND username ~ '^[a-z0-9_]+$'),
  email TEXT NOT NULL UNIQUE CHECK (email = lower(email)),
  password_hash text,
  google_subject text UNIQUE,
  created_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL)
);
CREATE TABLE account_invites (
  token_hash text PRIMARY KEY NOT NULL,
  expires_at DOUBLE PRECISION NOT NULL,
  reset_account TEXT REFERENCES accounts(id)
);
CREATE TABLE account_sessions (
  token_hash text PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  expires_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX account_sessions_account ON account_sessions(account_id);
CREATE TABLE account_rate_limits (
  bucket text PRIMARY KEY NOT NULL,
  starts_at DOUBLE PRECISION NOT NULL,
  hits integer NOT NULL
);
CREATE TABLE games (
  code text PRIMARY KEY NOT NULL CHECK (length(code) = 8 AND code ~ '^[A-Z2-9]+$'),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  orcas_id TEXT NOT NULL REFERENCES accounts(id),
  sharks_id TEXT REFERENCES accounts(id),
  create_request_id TEXT NOT NULL,
  ruleset_version text NOT NULL DEFAULT 'bagh-chal-classic-v1',
  engine_version text NOT NULL DEFAULT '1',
  current_ply integer NOT NULL DEFAULT 0 CHECK (current_ply >= 0),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  data TEXT NOT NULL CHECK (data IS JSON),
  result TEXT CHECK (result IS NULL OR result IS JSON),
  status TEXT GENERATED ALWAYS AS (CASE
    WHEN result IS NOT NULL AND result <> 'null' THEN 'finished'
    WHEN sharks_id IS NULL THEN 'waiting'
    ELSE 'active'
  END) STORED,
  orcas_seen DOUBLE PRECISION,
  sharks_seen DOUBLE PRECISION,
  created_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  updated_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  UNIQUE (created_by, create_request_id),
  CHECK (sharks_id IS NULL OR sharks_id <> orcas_id)
);
CREATE TABLE moves (
  game_code text NOT NULL REFERENCES games(code),
  round integer NOT NULL,
  ply integer NOT NULL,
  actor TEXT NOT NULL REFERENCES accounts(id),
  move TEXT NOT NULL CHECK (move IS JSON),
  request_id TEXT NOT NULL,
  created_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  PRIMARY KEY (game_code, round, ply),
  UNIQUE (game_code, actor, request_id)
);
CREATE TABLE game_rounds (
  game_code text NOT NULL REFERENCES games(code),
  round integer NOT NULL,
  data TEXT NOT NULL CHECK (data IS JSON),
  completed_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  PRIMARY KEY (game_code, round)
);
CREATE TABLE room_requests (
  game_code text NOT NULL REFERENCES games(code),
  actor TEXT NOT NULL REFERENCES accounts(id),
  request_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (payload IS JSON),
  created_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  PRIMARY KEY (game_code, actor, request_id)
);
CREATE TABLE room_rate_limits (
  actor TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  starts_at DOUBLE PRECISION NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (actor, bucket)
);

CREATE FUNCTION reject_move_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Moves are append-only';
END;
$$;
CREATE TRIGGER moves_append_only BEFORE UPDATE OR DELETE ON moves
FOR EACH ROW EXECUTE FUNCTION reject_move_mutation();

CREATE TABLE matchmaking_queue (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  joined_at DOUBLE PRECISION NOT NULL DEFAULT (EXTRACT(EPOCH FROM clock_timestamp())),
  expires_at DOUBLE PRECISION NOT NULL,
  room_code TEXT REFERENCES games(code)
);
CREATE INDEX matchmaking_waiting_order ON matchmaking_queue (joined_at, account_id)
  WHERE room_code IS NULL;
CREATE INDEX matchmaking_expiration ON matchmaking_queue (expires_at);

CREATE TABLE lesson_progress (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('lesson', 'quiz')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK (successes BETWEEN 0 AND attempts),
  hints_used INTEGER NOT NULL DEFAULT 0 CHECK (hints_used >= 0),
  time_spent INTEGER NOT NULL DEFAULT 0 CHECK (time_spent >= 0),
  completed_at DOUBLE PRECISION,
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
  completed_at DOUBLE PRECISION,
  opening TEXT,
  hint_index INTEGER NOT NULL DEFAULT 0 CHECK (hint_index >= 0),
  PRIMARY KEY (player_id, puzzle_id)
);

CREATE TABLE learning_stats (
  player_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lessons_completed INTEGER NOT NULL,
  puzzles_solved INTEGER NOT NULL,
  puzzle_accuracy DOUBLE PRECISION CHECK (puzzle_accuracy BETWEEN 0 AND 1),
  current_streak INTEGER NOT NULL,
  current_kind TEXT NOT NULL CHECK (current_kind IN ('lesson', 'puzzle', 'quiz')),
  current_activity_id TEXT NOT NULL,
  last_activity DOUBLE PRECISION NOT NULL
);

CREATE TABLE learning_events (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  PRIMARY KEY (player_id, event_id)
);

ALTER TABLE matchmaking_queue ADD COLUMN mode TEXT NOT NULL DEFAULT 'casual'
  CHECK (mode IN ('casual', 'fast', 'medium', 'classic'));

CREATE INDEX matchmaking_mode_waiting ON matchmaking_queue (mode, joined_at, account_id)
  WHERE room_code IS NULL;

CREATE TABLE player_ratings (
  player_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'medium', 'classic')),
  rating INTEGER NOT NULL DEFAULT 1500,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
  total_games INTEGER GENERATED ALWAYS AS (wins + losses + draws) STORED,
  PRIMARY KEY (player_id, mode)
);
CREATE INDEX player_ratings_leaders ON player_ratings (mode, rating DESC, player_id);

CREATE FUNCTION seed_player_ratings() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO player_ratings (player_id, mode)
    VALUES (NEW.id, 'fast'), (NEW.id, 'medium'), (NEW.id, 'classic');
  RETURN NEW;
END;
$$;
CREATE TRIGGER accounts_seed_ratings AFTER INSERT ON accounts
FOR EACH ROW EXECUTE FUNCTION seed_player_ratings();

CREATE TABLE ranked_matches (
  game_code TEXT PRIMARY KEY NOT NULL REFERENCES games(code),
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'medium', 'classic')),
  orcas_id TEXT NOT NULL REFERENCES accounts(id),
  sharks_id TEXT NOT NULL REFERENCES accounts(id),
  orcas_rating INTEGER NOT NULL,
  sharks_rating INTEGER NOT NULL,
  orcas_ms INTEGER NOT NULL CHECK (orcas_ms >= 0),
  sharks_ms INTEGER NOT NULL CHECK (sharks_ms >= 0),
  deadline DOUBLE PRECISION,
  started_at DOUBLE PRECISION NOT NULL,
  ended_at DOUBLE PRECISION,
  winner TEXT CHECK (winner IN ('orcas', 'sharks', 'draw')),
  reason TEXT,
  orcas_delta INTEGER,
  CHECK (orcas_id <> sharks_id),
  CHECK (
    (deadline IS NOT NULL AND ended_at IS NULL AND winner IS NULL AND reason IS NULL AND orcas_delta IS NULL)
    OR (deadline IS NULL AND ended_at IS NOT NULL AND winner IS NOT NULL AND reason IS NOT NULL AND orcas_delta IS NOT NULL)
  )
);
CREATE INDEX ranked_matches_expiring ON ranked_matches (deadline) WHERE deadline IS NOT NULL;
CREATE INDEX ranked_matches_orcas ON ranked_matches (orcas_id, ended_at DESC);
CREATE INDEX ranked_matches_sharks ON ranked_matches (sharks_id, ended_at DESC);


CREATE INDEX ranked_matches_sharks_active ON ranked_matches (sharks_id) WHERE ended_at IS NULL;
CREATE INDEX ranked_matches_orcas_active ON ranked_matches (orcas_id) WHERE ended_at IS NULL;

COMMIT;
