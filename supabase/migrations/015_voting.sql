-- Audience voting: sessions, options, and votes
CREATE TABLE vote_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vote_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES vote_sessions(id) ON DELETE CASCADE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

-- One vote per browser session (voter_token = localStorage UUID)
CREATE TABLE votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES vote_sessions(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES vote_options(id) ON DELETE CASCADE,
  voter_token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, voter_token)
);

ALTER TABLE vote_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vote_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read vote_sessions" ON vote_sessions FOR SELECT USING (true);
CREATE POLICY "Public read vote_options" ON vote_options FOR SELECT USING (true);
CREATE POLICY "Public read votes" ON votes FOR SELECT USING (true);

-- Admin: create a vote session with options in one call
CREATE OR REPLACE FUNCTION create_vote_session(
  token_input text,
  question_input text,
  option_labels text[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_session_id uuid;
BEGIN
  PERFORM verify_admin(token_input);
  INSERT INTO vote_sessions (question) VALUES (question_input) RETURNING id INTO new_session_id;
  FOR i IN 1..array_length(option_labels, 1) LOOP
    INSERT INTO vote_options (session_id, label, sort_order)
      VALUES (new_session_id, option_labels[i], i);
  END LOOP;
  RETURN new_session_id;
END;
$$;

-- Admin: close a vote session
CREATE OR REPLACE FUNCTION close_vote_session(
  token_input text,
  session_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE vote_sessions SET status = 'closed' WHERE id = session_id_input;
END;
$$;

-- Admin: delete a vote session
CREATE OR REPLACE FUNCTION delete_vote_session(
  token_input text,
  session_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  DELETE FROM vote_sessions WHERE id = session_id_input;
END;
$$;

-- Public: cast a vote (no admin token required)
-- The UNIQUE constraint on (session_id, voter_token) enforces one vote per browser.
CREATE OR REPLACE FUNCTION cast_vote(
  session_id_input uuid,
  option_id_input uuid,
  voter_token_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  sess_status text;
BEGIN
  SELECT status INTO sess_status FROM vote_sessions WHERE id = session_id_input;
  IF sess_status IS NULL THEN
    RAISE EXCEPTION 'Vote session not found';
  END IF;
  IF sess_status != 'open' THEN
    RAISE EXCEPTION 'Vote session is closed';
  END IF;
  INSERT INTO votes (session_id, option_id, voter_token)
    VALUES (session_id_input, option_id_input, voter_token_input)
    ON CONFLICT (session_id, voter_token) DO NOTHING;
END;
$$;
