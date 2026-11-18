-- Run as the migration owner after creating the orcas_app login role.
BEGIN;
GRANT USAGE ON SCHEMA public TO orcas_app;
GRANT SELECT, INSERT, UPDATE ON accounts, account_rate_limits, games, room_rate_limits TO orcas_app;
GRANT SELECT, INSERT, DELETE ON account_invites, account_sessions TO orcas_app;
GRANT SELECT, INSERT ON moves, game_rounds, room_requests TO orcas_app;

-- Only the Next.js service holds this role. The room API checks player seats.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'accounts', 'account_rate_limits', 'account_invites', 'account_sessions',
    'games', 'room_rate_limits', 'moves', 'game_rounds', 'room_requests'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY app_access ON public.%I TO orcas_app USING (true) WITH CHECK (true)',
      table_name
    );
  END LOOP;
END
$$;
COMMIT;
