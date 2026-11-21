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
  PRIMARY KEY (player_id, mode)
);
CREATE INDEX player_ratings_leaders ON player_ratings (mode, rating DESC, player_id);

INSERT INTO player_ratings (player_id, mode)
  SELECT accounts.id, modes.mode FROM accounts
  CROSS JOIN (SELECT 'fast' AS mode UNION ALL SELECT 'medium' UNION ALL SELECT 'classic') AS modes;

CREATE TRIGGER accounts_seed_ratings AFTER INSERT ON accounts
BEGIN
  INSERT INTO player_ratings (player_id, mode)
    VALUES (NEW.id, 'fast'), (NEW.id, 'medium'), (NEW.id, 'classic');
END;

CREATE TABLE ranked_matches (
  game_code TEXT PRIMARY KEY NOT NULL REFERENCES games(code),
  mode TEXT NOT NULL CHECK (mode IN ('fast', 'medium', 'classic')),
  orcas_id TEXT NOT NULL REFERENCES accounts(id),
  sharks_id TEXT NOT NULL REFERENCES accounts(id),
  orcas_rating INTEGER NOT NULL,
  sharks_rating INTEGER NOT NULL,
  orcas_ms INTEGER NOT NULL CHECK (orcas_ms >= 0),
  sharks_ms INTEGER NOT NULL CHECK (sharks_ms >= 0),
  deadline INTEGER,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
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
