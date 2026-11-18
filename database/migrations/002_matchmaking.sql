BEGIN;
CREATE TABLE public.matchmaking_queue (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL,
  room_code text REFERENCES public.games(code)
);
CREATE INDEX matchmaking_waiting_order ON public.matchmaking_queue (joined_at, account_id)
  WHERE room_code IS NULL;
CREATE INDEX matchmaking_expiration ON public.matchmaking_queue (expires_at);

ALTER TABLE public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.matchmaking_queue FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matchmaking_queue TO orcas_app;
CREATE POLICY app_access ON public.matchmaking_queue TO orcas_app USING (true) WITH CHECK (true);
COMMIT;
