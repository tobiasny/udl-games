-- Update contestant avatar
CREATE OR REPLACE FUNCTION update_contestant_avatar(token_input text, contestant_id_input uuid, avatar_url_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE contestants SET avatar_url = avatar_url_input WHERE id = contestant_id_input;
END;
$$;
