-- Rebus run tasks
CREATE TABLE rebus_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sort_order integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('answer', 'activity')),
  correct_answer text,
  destination_coords text,
  destination_name text,
  status text NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'active', 'submitted', 'approved', 'completed')),
  submitted_answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE rebus_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read rebus_tasks" ON rebus_tasks FOR SELECT USING (true);

-- Submit answer (bachelor)
CREATE OR REPLACE FUNCTION rebus_submit_answer(task_id_input uuid, answer_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE rebus_tasks
  SET submitted_answer = answer_input, status = 'submitted'
  WHERE id = task_id_input AND status = 'active' AND task_type = 'answer';
END;
$$;

-- Admin: approve task (answer verified or activity done)
CREATE OR REPLACE FUNCTION rebus_approve_task(token_input text, task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks
  SET status = 'approved'
  WHERE id = task_id_input AND status IN ('active', 'submitted');
END;
$$;

-- Admin: mark arrived at destination -> complete current, activate next
CREATE OR REPLACE FUNCTION rebus_mark_arrived(token_input text, task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_order integer;
BEGIN
  PERFORM verify_admin(token_input);

  SELECT sort_order INTO current_order FROM rebus_tasks WHERE id = task_id_input;

  UPDATE rebus_tasks SET status = 'completed' WHERE id = task_id_input AND status = 'approved';

  -- Activate next task
  UPDATE rebus_tasks SET status = 'active'
  WHERE sort_order = (SELECT MIN(sort_order) FROM rebus_tasks WHERE sort_order > current_order)
    AND status = 'locked';
END;
$$;

-- Admin: add rebus task
CREATE OR REPLACE FUNCTION rebus_add_task(
  token_input text,
  title_input text,
  description_input text,
  task_type_input text,
  correct_answer_input text DEFAULT NULL,
  destination_coords_input text DEFAULT NULL,
  destination_name_input text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  max_order integer;
  task_count integer;
BEGIN
  PERFORM verify_admin(token_input);

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO max_order FROM rebus_tasks;
  SELECT COUNT(*) INTO task_count FROM rebus_tasks;

  INSERT INTO rebus_tasks (title, description, task_type, correct_answer, destination_coords, destination_name, sort_order, status)
  VALUES (
    title_input, description_input, task_type_input,
    correct_answer_input, destination_coords_input, destination_name_input,
    max_order,
    CASE WHEN task_count = 0 THEN 'active' ELSE 'locked' END
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Admin: delete rebus task
CREATE OR REPLACE FUNCTION rebus_delete_task(token_input text, task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  DELETE FROM rebus_tasks WHERE id = task_id_input;
END;
$$;

-- Admin: reset all tasks to initial state (first = active, rest = locked)
CREATE OR REPLACE FUNCTION rebus_reset_all(token_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks SET status = 'locked', submitted_answer = NULL;
  UPDATE rebus_tasks SET status = 'active'
  WHERE sort_order = (SELECT MIN(sort_order) FROM rebus_tasks);
END;
$$;

-- Admin: reset single task back to active
CREATE OR REPLACE FUNCTION rebus_reset_task(token_input text, task_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks SET status = 'active', submitted_answer = NULL WHERE id = task_id_input;
END;
$$;

-- Admin: update rebus task
CREATE OR REPLACE FUNCTION rebus_update_task(
  token_input text,
  task_id_input uuid,
  title_input text,
  description_input text,
  task_type_input text,
  correct_answer_input text DEFAULT NULL,
  destination_coords_input text DEFAULT NULL,
  destination_name_input text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE rebus_tasks SET
    title = title_input,
    description = description_input,
    task_type = task_type_input,
    correct_answer = correct_answer_input,
    destination_coords = destination_coords_input,
    destination_name = destination_name_input
  WHERE id = task_id_input;
END;
$$;
