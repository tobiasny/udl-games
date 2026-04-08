-- Rebus run settings: a single-row table holding the starting coordinates
-- for the whole run. The "from" point of the very first leg of the route
-- (before any task has been completed) comes from here.
CREATE TABLE rebus_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  start_coords text,
  start_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO rebus_settings (id) VALUES (1);

ALTER TABLE rebus_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rebus_settings" ON rebus_settings FOR SELECT USING (true);

-- Admin: set start coordinates
CREATE OR REPLACE FUNCTION rebus_set_start(
  token_input text,
  start_coords_input text,
  start_name_input text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_settings
  SET start_coords = start_coords_input,
      start_name = start_name_input,
      updated_at = now()
  WHERE id = 1;
END;
$$;
