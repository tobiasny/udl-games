-- Drink tracking table: one row per drink consumed by a contestant on a given day.
CREATE TABLE drink_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  day text NOT NULL CHECK (day IN ('friday', 'saturday')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drink_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read drink_log" ON drink_log FOR SELECT USING (true);

-- Admin: log a drink for a contestant on a given day
CREATE OR REPLACE FUNCTION log_drink(
  token_input text,
  contestant_id_input uuid,
  day_input text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  INSERT INTO drink_log (contestant_id, day) VALUES (contestant_id_input, day_input);
END;
$$;

-- Admin: remove the most recent drink for a contestant on a given day (undo)
CREATE OR REPLACE FUNCTION remove_last_drink(
  token_input text,
  contestant_id_input uuid,
  day_input text
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
    WHERE contestant_id = contestant_id_input AND day = day_input
    ORDER BY created_at DESC
    LIMIT 1;
  IF target_id IS NOT NULL THEN
    DELETE FROM drink_log WHERE id = target_id;
  END IF;
END;
$$;
