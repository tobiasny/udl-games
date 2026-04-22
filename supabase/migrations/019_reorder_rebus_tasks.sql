CREATE OR REPLACE FUNCTION reorder_rebus_tasks(
  token_input  text,
  ordered_ids  uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  FOR i IN 1..array_length(ordered_ids, 1) LOOP
    UPDATE rebus_tasks SET sort_order = i * 10 WHERE id = ordered_ids[i];
  END LOOP;
END;
$$;
