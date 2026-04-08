-- Track when an activity transitions to status='completed' so the public
-- activity history can be ordered by completion time, not creation time.
-- Without this, events (which are inserted as already-completed) would always
-- bunch up at the top regardless of when the surrounding activities finished.

ALTER TABLE activities ADD COLUMN completed_at timestamptz;

-- Backfill: for already-completed rows we don't have a real completion
-- timestamp, so fall back to created_at. This is monotonic enough that the
-- relative order across pre-existing rows stays sensible.
UPDATE activities SET completed_at = created_at WHERE status = 'completed';

-- Stamp completed_at whenever status flips to 'completed'; clear it if it
-- somehow flips back. Keeps the column in sync without trigger machinery.
CREATE OR REPLACE FUNCTION update_activity_status(token_input text, activity_id_input uuid, status_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE activities
  SET status = status_input,
      completed_at = CASE
        WHEN status_input = 'completed' THEN now()
        ELSE NULL
      END
  WHERE id = activity_id_input;
END;
$$;

-- Events are inserted already-completed, so stamp completed_at inline.
CREATE OR REPLACE FUNCTION add_event(
  token_input text,
  title_input text,
  contestant_id_input uuid,
  points_input integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  max_order integer;
BEGIN
  PERFORM verify_admin(token_input);

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO max_order FROM activities;

  INSERT INTO activities (name, type, format, status, sort_order, num_rounds, completed_at)
  VALUES (title_input, 'event', 'event', 'completed', max_order, 1, now())
  RETURNING id INTO new_id;

  INSERT INTO activity_contestants (activity_id, contestant_id)
  VALUES (new_id, contestant_id_input);

  INSERT INTO points (activity_id, contestant_id, amount)
  VALUES (new_id, contestant_id_input, points_input);

  RETURN new_id;
END;
$$;
