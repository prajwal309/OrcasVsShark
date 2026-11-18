BEGIN;
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$'),
  password_hash text NOT NULL
);
CREATE TABLE public.account_invites (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  reset_account uuid REFERENCES public.accounts(id)
);
CREATE TABLE public.account_sessions (
  token_hash text PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX account_sessions_account ON public.account_sessions(account_id);
CREATE TABLE public.account_rate_limits (
  bucket text PRIMARY KEY,
  starts_at timestamptz NOT NULL,
  hits integer NOT NULL
);
CREATE TABLE public.games (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z2-9]{8}$'),
  created_by uuid NOT NULL REFERENCES public.accounts(id),
  orcas_id uuid NOT NULL REFERENCES public.accounts(id),
  sharks_id uuid REFERENCES public.accounts(id),
  create_request_id uuid NOT NULL,
  ruleset_version text NOT NULL DEFAULT 'bagh-chal-classic-v1',
  engine_version text NOT NULL DEFAULT '1',
  rated boolean NOT NULL DEFAULT false CHECK (rated = false),
  time_control text NOT NULL DEFAULT 'none' CHECK (time_control = 'none'),
  current_ply integer NOT NULL DEFAULT 0 CHECK (current_ply >= 0),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  data jsonb NOT NULL,
  result jsonb,
  orcas_seen timestamptz,
  sharks_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (created_by, create_request_id),
  CHECK (sharks_id IS NULL OR sharks_id <> orcas_id)
);
CREATE TABLE public.moves (
  game_code text NOT NULL REFERENCES public.games(code),
  round integer NOT NULL,
  ply integer NOT NULL,
  actor uuid NOT NULL REFERENCES public.accounts(id),
  move jsonb NOT NULL,
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_code, round, ply),
  UNIQUE (game_code, actor, request_id)
);
CREATE TABLE public.game_rounds (
  game_code text NOT NULL REFERENCES public.games(code),
  round integer NOT NULL,
  data jsonb NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_code, round)
);
CREATE TABLE public.room_requests (
  game_code text NOT NULL REFERENCES public.games(code),
  actor uuid NOT NULL REFERENCES public.accounts(id),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_code, actor, request_id)
);
CREATE TABLE public.room_rate_limits (
  actor uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  starts_at timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (actor, bucket)
);

-- Even privileged application code cannot rewrite the move audit trail.
CREATE FUNCTION public.reject_move_rewrite() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Moves are append-only';
END;
$$;
CREATE TRIGGER moves_append_only BEFORE UPDATE OR DELETE ON public.moves
  FOR EACH ROW EXECUTE FUNCTION public.reject_move_rewrite();

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accounts, account_invites, account_sessions, account_rate_limits,
  games, moves, game_rounds, room_requests, room_rate_limits FROM PUBLIC;
COMMIT;
