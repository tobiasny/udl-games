-- Add contestant
CREATE OR REPLACE FUNCTION add_contestant(token_input text, name_input text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
BEGIN
  PERFORM verify_admin(token_input);
  INSERT INTO contestants (name) VALUES (name_input) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- Update contestant
CREATE OR REPLACE FUNCTION update_contestant(token_input text, contestant_id_input uuid, name_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE contestants SET name = name_input WHERE id = contestant_id_input;
END;
$$;

-- Delete contestant
CREATE OR REPLACE FUNCTION delete_contestant(token_input text, contestant_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  DELETE FROM contestants WHERE id = contestant_id_input;
END;
$$;

-- Add activity with contestants
CREATE OR REPLACE FUNCTION add_activity(
  token_input text,
  name_input text,
  type_input text,
  format_input text,
  contestant_ids uuid[],
  num_rounds_input integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  max_order integer;
  cid uuid;
BEGIN
  PERFORM verify_admin(token_input);

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO max_order FROM activities;

  INSERT INTO activities (name, type, format, sort_order, num_rounds)
  VALUES (name_input, type_input, format_input, max_order, num_rounds_input)
  RETURNING id INTO new_id;

  FOREACH cid IN ARRAY contestant_ids LOOP
    INSERT INTO activity_contestants (activity_id, contestant_id)
    VALUES (new_id, cid);
  END LOOP;

  RETURN new_id;
END;
$$;

-- Update activity status
CREATE OR REPLACE FUNCTION update_activity_status(token_input text, activity_id_input uuid, status_input text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE activities SET status = status_input WHERE id = activity_id_input;
END;
$$;

-- Delete activity
CREATE OR REPLACE FUNCTION delete_activity(token_input text, activity_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  DELETE FROM activities WHERE id = activity_id_input;
END;
$$;

-- Save points (upsert)
CREATE OR REPLACE FUNCTION save_points(
  token_input text,
  activity_id_input uuid,
  points_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  point_entry jsonb;
BEGIN
  PERFORM verify_admin(token_input);

  FOR point_entry IN SELECT * FROM jsonb_array_elements(points_data) LOOP
    INSERT INTO points (activity_id, contestant_id, amount)
    VALUES (
      activity_id_input,
      (point_entry->>'contestant_id')::uuid,
      (point_entry->>'amount')::integer
    )
    ON CONFLICT (activity_id, contestant_id)
    DO UPDATE SET amount = (point_entry->>'amount')::integer;
  END LOOP;
END;
$$;

-- Set match result
CREATE OR REPLACE FUNCTION set_match_result(token_input text, match_id_input uuid, winning_team_input integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE matches
  SET winning_team = winning_team_input, status = 'completed'
  WHERE id = match_id_input;
END;
$$;

-- Delete match
CREATE OR REPLACE FUNCTION delete_match(token_input text, match_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  DELETE FROM matches WHERE id = match_id_input;
END;
$$;

-- Create round robin matches
CREATE OR REPLACE FUNCTION create_round_robin_matches(
  token_input text,
  activity_id_input uuid,
  matches_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  match_entry jsonb;
  new_match_id uuid;
  player_id text;
BEGIN
  PERFORM verify_admin(token_input);

  -- Delete existing matches for this activity
  DELETE FROM matches WHERE activity_id = activity_id_input;

  FOR match_entry IN SELECT * FROM jsonb_array_elements(matches_data) LOOP
    INSERT INTO matches (activity_id, round, status)
    VALUES (activity_id_input, (match_entry->>'round')::integer, 'pending')
    RETURNING id INTO new_match_id;

    -- Add team 1 players
    FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team1') LOOP
      INSERT INTO match_players (match_id, contestant_id, team)
      VALUES (new_match_id, player_id::uuid, 1);
    END LOOP;

    -- Add team 2 players
    FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team2') LOOP
      INSERT INTO match_players (match_id, contestant_id, team)
      VALUES (new_match_id, player_id::uuid, 2);
    END LOOP;
  END LOOP;
END;
$$;

-- Create bracket matches (double elimination)
CREATE OR REPLACE FUNCTION create_bracket_matches(
  token_input text,
  activity_id_input uuid,
  matches_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  match_entry jsonb;
  new_match_id uuid;
  player_id text;
  temp_id_map jsonb := '{}'::jsonb;
  temp_id text;
  source_winner_temp text;
  source_loser_temp text;
BEGIN
  PERFORM verify_admin(token_input);

  -- Delete existing matches for this activity
  DELETE FROM matches WHERE activity_id = activity_id_input;

  -- First pass: create all matches and build temp_id -> real_id map
  FOR match_entry IN SELECT * FROM jsonb_array_elements(matches_data) LOOP
    temp_id := match_entry->>'temp_id';

    INSERT INTO matches (activity_id, bracket, bracket_round, bracket_position, status)
    VALUES (
      activity_id_input,
      match_entry->>'bracket',
      (match_entry->>'bracket_round')::integer,
      (match_entry->>'bracket_position')::integer,
      'pending'
    )
    RETURNING id INTO new_match_id;

    temp_id_map := temp_id_map || jsonb_build_object(temp_id, new_match_id::text);

    -- Add team 1 players if present
    IF match_entry->'team1' IS NOT NULL AND match_entry->>'team1' != 'null' THEN
      FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team1') LOOP
        INSERT INTO match_players (match_id, contestant_id, team)
        VALUES (new_match_id, player_id::uuid, 1);
      END LOOP;
    END IF;

    -- Add team 2 players if present
    IF match_entry->'team2' IS NOT NULL AND match_entry->>'team2' != 'null' THEN
      FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team2') LOOP
        INSERT INTO match_players (match_id, contestant_id, team)
        VALUES (new_match_id, player_id::uuid, 2);
      END LOOP;
    END IF;
  END LOOP;

  -- Second pass: update source match references
  FOR match_entry IN SELECT * FROM jsonb_array_elements(matches_data) LOOP
    temp_id := match_entry->>'temp_id';
    source_winner_temp := match_entry->>'source_match_winner';
    source_loser_temp := match_entry->>'source_match_loser';

    IF source_winner_temp IS NOT NULL OR source_loser_temp IS NOT NULL THEN
      UPDATE matches SET
        source_match_winner = CASE
          WHEN source_winner_temp IS NOT NULL THEN (temp_id_map->>source_winner_temp)::uuid
          ELSE NULL
        END,
        source_match_loser = CASE
          WHEN source_loser_temp IS NOT NULL THEN (temp_id_map->>source_loser_temp)::uuid
          ELSE NULL
        END
      WHERE id = (temp_id_map->>temp_id)::uuid;
    END IF;
  END LOOP;
END;
$$;
