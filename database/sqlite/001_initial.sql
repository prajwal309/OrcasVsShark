CREATE TABLE accounts (
  id TEXT PRIMARY KEY NOT NULL,
  username text NOT NULL UNIQUE CHECK (length(username) BETWEEN 3 AND 24 AND username NOT GLOB '*[^a-z0-9_]*'),
  password_hash text,
  google_subject text UNIQUE,
  created_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL)
);
CREATE TABLE account_invites (
  token_hash text PRIMARY KEY NOT NULL,
  expires_at REAL NOT NULL,
  reset_account TEXT REFERENCES accounts(id)
);
CREATE TABLE account_sessions (
  token_hash text PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  expires_at REAL NOT NULL
);
CREATE INDEX account_sessions_account ON account_sessions(account_id);
CREATE TABLE account_rate_limits (
  bucket text PRIMARY KEY NOT NULL,
  starts_at REAL NOT NULL,
  hits integer NOT NULL
);
CREATE TABLE games (
  code text PRIMARY KEY NOT NULL CHECK (length(code) = 8 AND code NOT GLOB '*[^A-Z2-9]*'),
  created_by TEXT NOT NULL REFERENCES accounts(id),
  orcas_id TEXT NOT NULL REFERENCES accounts(id),
  sharks_id TEXT REFERENCES accounts(id),
  create_request_id TEXT NOT NULL,
  ruleset_version text NOT NULL DEFAULT 'bagh-chal-classic-v1',
  engine_version text NOT NULL DEFAULT '1',
  rated INTEGER NOT NULL DEFAULT 0 CHECK (rated = 0),
  time_control text NOT NULL DEFAULT 'none' CHECK (time_control = 'none'),
  current_ply integer NOT NULL DEFAULT 0 CHECK (current_ply >= 0),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  data TEXT NOT NULL CHECK (json_valid(data)),
  result TEXT CHECK (result IS NULL OR json_valid(result)),
  status TEXT GENERATED ALWAYS AS (CASE
    WHEN result IS NOT NULL AND result <> 'null' THEN 'finished'
    WHEN sharks_id IS NULL THEN 'waiting'
    ELSE 'active'
  END) VIRTUAL,
  orcas_seen REAL,
  sharks_seen REAL,
  created_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  updated_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  UNIQUE (created_by, create_request_id),
  CHECK (sharks_id IS NULL OR sharks_id <> orcas_id)
);
CREATE TABLE moves (
  game_code text NOT NULL REFERENCES games(code),
  round integer NOT NULL,
  ply integer NOT NULL,
  actor TEXT NOT NULL REFERENCES accounts(id),
  move TEXT NOT NULL CHECK (json_valid(move)),
  request_id TEXT NOT NULL,
  created_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  PRIMARY KEY (game_code, round, ply),
  UNIQUE (game_code, actor, request_id)
);
CREATE TABLE game_rounds (
  game_code text NOT NULL REFERENCES games(code),
  round integer NOT NULL,
  data TEXT NOT NULL CHECK (json_valid(data)),
  completed_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  PRIMARY KEY (game_code, round)
);
CREATE TABLE room_requests (
  game_code text NOT NULL REFERENCES games(code),
  actor TEXT NOT NULL REFERENCES accounts(id),
  request_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (json_valid(payload)),
  created_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  PRIMARY KEY (game_code, actor, request_id)
);
CREATE TABLE room_rate_limits (
  actor TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  starts_at REAL NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (actor, bucket)
);

CREATE TRIGGER moves_no_update BEFORE UPDATE ON moves
BEGIN
  SELECT RAISE(ABORT, 'Moves are append-only');
END;
CREATE TRIGGER moves_no_delete BEFORE DELETE ON moves
BEGIN
  SELECT RAISE(ABORT, 'Moves are append-only');
END;

CREATE TABLE matchmaking_queue (
  account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  joined_at REAL NOT NULL DEFAULT (unixepoch('subsec')),
  expires_at REAL NOT NULL,
  room_code TEXT REFERENCES games(code)
);
CREATE INDEX matchmaking_waiting_order ON matchmaking_queue (joined_at, account_id)
  WHERE room_code IS NULL;
CREATE INDEX matchmaking_expiration ON matchmaking_queue (expires_at);
