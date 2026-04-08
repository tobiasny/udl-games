-- Allow the admin to reject a submitted answer. The bachelor sees a
-- "wrong answer, take a shot" screen and then re-attempts via rebus_retry_task,
-- which flips the row back to active so the answer form re-appears.

-- Extend the status check constraint with the new 'rejected' state.
ALTER TABLE rebus_tasks DROP CONSTRAINT IF EXISTS rebus_tasks_status_check;
ALTER TABLE rebus_tasks
  ADD CONSTRAINT rebus_tasks_status_check
  CHECK (status IN ('locked', 'active', 'submitted', 'approved', 'completed', 'rejected'));

-- Admin: reject a submitted answer. Clears submitted_answer and parks the
-- task in 'rejected' so the bachelor's UI can react.
CREATE OR REPLACE FUNCTION rebus_reject_answer(token_input text, task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks
  SET status = 'rejected', submitted_answer = NULL
  WHERE id = task_id_input AND status = 'submitted' AND task_type = 'answer';
END;
$$;

-- Bachelor: retry a rejected answer task. No auth required -- this is the
-- bachelor flipping their own task back to active after taking the shot.
CREATE OR REPLACE FUNCTION rebus_retry_task(task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE rebus_tasks
  SET status = 'active', submitted_answer = NULL
  WHERE id = task_id_input AND status = 'rejected' AND task_type = 'answer';
END;
$$;

GRANT EXECUTE ON FUNCTION rebus_reject_answer(text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION rebus_retry_task(uuid) TO anon, authenticated;
