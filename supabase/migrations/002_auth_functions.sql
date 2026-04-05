-- Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Authenticate admin: verify password, return session token
CREATE OR REPLACE FUNCTION authenticate_admin(password_input text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  stored_hash text;
  new_token text;
BEGIN
  SELECT admin_password_hash INTO stored_hash FROM app_settings WHERE id = 1;
  IF stored_hash IS NULL THEN
    RAISE EXCEPTION 'Admin not configured';
  END IF;

  IF stored_hash != crypt(password_input, stored_hash) THEN
    RETURN NULL;
  END IF;

  -- Generate session token
  new_token := encode(gen_random_bytes(32), 'hex');

  -- Clean expired sessions
  DELETE FROM admin_sessions WHERE expires_at < now();

  -- Insert new session (24 hour expiry)
  INSERT INTO admin_sessions (token, expires_at)
  VALUES (new_token, now() + interval '24 hours');

  RETURN new_token;
END;
$$;

-- Validate session token
CREATE OR REPLACE FUNCTION is_valid_session(token_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_sessions
    WHERE token = token_input AND expires_at > now()
  );
END;
$$;

-- Helper: verify token or raise
CREATE OR REPLACE FUNCTION verify_admin(token_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_valid_session(token_input) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
END;
$$;

-- Insert default admin password (change this!)
-- Default password: "admin123"
INSERT INTO app_settings (id, admin_password_hash)
VALUES (1, crypt('admin123', gen_salt('bf')))
ON CONFLICT (id) DO NOTHING;
