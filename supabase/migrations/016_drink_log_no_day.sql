-- Migration 016: Remove explicit day column from drink_log.
-- Day is now derived from the created_at timestamp.

DROP FUNCTION IF EXISTS log_drink(text, uuid, text);
DROP FUNCTION IF EXISTS remove_last_drink(text, uuid, text);

ALTER TABLE drink_log DROP COLUMN day;

-- Log a drink — timestamp is recorded automatically via now()
CREATE OR REPLACE FUNCTION log_drink(
  token_input text,
  contestant_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  INSERT INTO drink_log (contestant_id) VALUES (contestant_id_input);
END;
$$;

-- Remove the most recent drink for a contestant (by created_at DESC)
CREATE OR REPLACE FUNCTION remove_last_drink(
  token_input text,
  contestant_id_input uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_id uuid;
BEGIN
  PERFORM verify_admin(token_input);
  SELECT id INTO target_id
    FROM drink_log
    WHERE contestant_id = contestant_id_input
    ORDER BY created_at DESC
    LIMIT 1;
  IF target_id IS NOT NULL THEN
    DELETE FROM drink_log WHERE id = target_id;
  END IF;
END;
$$;
