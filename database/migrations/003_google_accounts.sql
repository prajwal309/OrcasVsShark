BEGIN;
ALTER TABLE public.accounts
  ALTER COLUMN password_hash DROP NOT NULL,
  ADD COLUMN google_subject text UNIQUE,
  ADD CONSTRAINT account_has_credential
    CHECK (password_hash IS NOT NULL OR google_subject IS NOT NULL);
COMMIT;
