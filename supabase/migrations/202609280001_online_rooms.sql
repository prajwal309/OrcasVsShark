-- Apply to a development Supabase project first. No existing tables are removed.
BEGIN;
CREATE TABLE public.games (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z2-9]{8}$'),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  orcas_id uuid NOT NULL REFERENCES auth.users(id),
  sharks_id uuid REFERENCES auth.users(id),
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
  actor uuid NOT NULL REFERENCES auth.users(id),
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
  actor uuid NOT NULL REFERENCES auth.users(id),
  request_id uuid NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_code, actor, request_id)
);
CREATE TABLE public.room_rate_limits (
  actor uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  starts_at timestamptz NOT NULL,
  hits integer NOT NULL,
  PRIMARY KEY (actor, bucket)
);

ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.games, public.moves, public.game_rounds, public.room_requests, public.room_rate_limits FROM anon, authenticated;
GRANT SELECT ON public.games, public.moves, public.game_rounds TO authenticated;
CREATE POLICY seated_games ON public.games FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IN (orcas_id, sharks_id));
CREATE POLICY seated_moves ON public.moves FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.code = game_code AND (SELECT auth.uid()) IN (g.orcas_id, g.sharks_id)));
CREATE POLICY seated_rounds ON public.game_rounds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.games g WHERE g.code = game_code AND (SELECT auth.uid()) IN (g.orcas_id, g.sharks_id)));

-- Even privileged application code cannot rewrite the move audit trail.
CREATE FUNCTION public.reject_move_rewrite() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Moves are append-only';
END;
$$;
CREATE TRIGGER moves_append_only BEFORE UPDATE OR DELETE ON public.moves
  FOR EACH ROW EXECUTE FUNCTION public.reject_move_rewrite();

ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
COMMIT;
