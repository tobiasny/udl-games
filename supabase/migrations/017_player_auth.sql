-- supabase/migrations/017_player_auth.sql
-- Player auth: per-player PIN + sessions for self-serve drink logging.
-- Admin auth (admin_sessions, verify_admin) is completely unchanged.

-- Add PIN hash to contestants (nullable — no PIN until admin sets one)
ALTER TABLE contestants ADD COLUMN pin_hash text;

-- Player sessions (separate from admin_sessions)
CREATE TABLE player_sessions (
  token         text PRIMARY KEY,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  expires_at    timestamptz NOT NULL
);

ALTER TABLE player_sessions ENABLE ROW LEVEL SECURITY;
-- No public read policy — sessions are private

-- Authenticate a player: verify bcrypt PIN, create 48h session, return token.
-- Returns NULL on bad PIN or missing PIN.
CREATE OR REPLACE FUNCTION authenticate_player(
  contestant_id_input uuid,
  pin_input           text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash text;
  new_token   text;
BEGIN
  SELECT pin_hash INTO stored_hash
    FROM contestants
    WHERE id = contestant_id_input;

  IF stored_hash IS NULL THEN
    RETURN NULL;
  END IF;

  IF stored_hash != extensions.crypt(pin_input, stored_hash) THEN
    RETURN NULL;
  END IF;

  new_token := encode(gen_random_bytes(32), 'hex');

  -- Clean up expired player sessions
  DELETE FROM player_sessions WHERE expires_at < now();

  INSERT INTO player_sessions (token, contestant_id, expires_at)
  VALUES (new_token, contestant_id_input, now() + interval '48 hours');

  RETURN new_token;
END;
$$;

-- Log a drink for the player identified by the session token.
-- Contestant id is derived from the token — player can only log for themselves.
CREATE OR REPLACE FUNCTION log_drink_self(
  player_token_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT contestant_id INTO cid
    FROM player_sessions
    WHERE token = player_token_input AND expires_at > now();

  IF cid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO drink_log (contestant_id) VALUES (cid);
END;
$$;

-- Return contestant_id for a valid player token (used to hydrate UI on page reload).
-- Returns NULL if token is invalid or expired.
CREATE OR REPLACE FUNCTION get_player_session(
  player_token_input text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cid uuid;
BEGIN
  SELECT contestant_id INTO cid
    FROM player_sessions
    WHERE token = player_token_input AND expires_at > now();
  RETURN cid;
END;
$$;

-- Admin: set a contestant's PIN (bcrypt-hashed, same pattern as admin password).
CREATE OR REPLACE FUNCTION set_player_pin(
  token_input         text,
  contestant_id_input uuid,
  pin_input           text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE contestants
    SET pin_hash = extensions.crypt(pin_input, extensions.gen_salt('bf'))
    WHERE id = contestant_id_input;
END;
$$;
