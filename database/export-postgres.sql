\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT '"orcas-postgres-v1"';
SELECT json_build_array('accounts', row_to_json(t))::text FROM public.accounts t;
SELECT json_build_array('account_invites', row_to_json(t))::text FROM public.account_invites t;
SELECT json_build_array('account_sessions', row_to_json(t))::text FROM public.account_sessions t;
SELECT json_build_array('account_rate_limits', row_to_json(t))::text FROM public.account_rate_limits t;
SELECT json_build_array('games', row_to_json(t))::text FROM public.games t;
SELECT json_build_array('moves', row_to_json(t))::text FROM public.moves t;
SELECT json_build_array('game_rounds', row_to_json(t))::text FROM public.game_rounds t;
SELECT json_build_array('room_requests', row_to_json(t))::text FROM public.room_requests t;
SELECT json_build_array('room_rate_limits', row_to_json(t))::text FROM public.room_rate_limits t;
SELECT json_build_array('matchmaking_queue', row_to_json(t))::text FROM public.matchmaking_queue t;
COMMIT;
SELECT '"end"';
