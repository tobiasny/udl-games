-- Store plain PIN alongside hash so admin can view and share it with players
ALTER TABLE contestants ADD COLUMN pin_plain text;

-- Update set_player_pin to also persist the plain PIN
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
  IF pin_input !~ '^\d{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  PERFORM verify_admin(token_input);
  UPDATE contestants
    SET pin_hash  = extensions.crypt(pin_input, extensions.gen_salt('bf')),
        pin_plain = pin_input
    WHERE id = contestant_id_input;
END;
$$;
