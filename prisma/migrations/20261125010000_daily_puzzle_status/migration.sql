ALTER TABLE daily_puzzle_attempts
  ADD COLUMN status TEXT CHECK (status IN ('new', 'attempted', 'solved', 'hinted', 'revealed'));
