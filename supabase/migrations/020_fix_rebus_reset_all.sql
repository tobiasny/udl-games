-- Supabase blocks UPDATE without a WHERE clause; use WHERE id IS NOT NULL to match all rows
CREATE OR REPLACE FUNCTION rebus_reset_all(token_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks SET status = 'locked', submitted_answer = NULL WHERE id IS NOT NULL;
  UPDATE rebus_tasks SET status = 'active'
    WHERE sort_order = (SELECT MIN(sort_order) FROM rebus_tasks);
END;
$$;
