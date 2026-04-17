-- RPC to reorder activities by updating sort_order based on the supplied
-- ordered array of IDs. Each position gets sort_order = index * 10 so there
-- is room to insert between items in future without a full renumber.
CREATE OR REPLACE FUNCTION reorder_activities(
  token_input text,
  ordered_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  FOR i IN 1..array_length(ordered_ids, 1) LOOP
    UPDATE activities SET sort_order = i * 10 WHERE id = ordered_ids[i];
  END LOOP;
END;
$$;
