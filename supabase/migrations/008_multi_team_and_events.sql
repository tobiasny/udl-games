-- Two related additions, bundled in one migration so the type/format check
-- constraints only bounce once:
--   1. 2v2v2v2 "multi-team battle": 4 fixed teams of ~2 players playing N
--      rounds. Each round records a 1..4 placement per team (stored as a
--      jsonb map on matches.team_placements). Reuses the match_players table
--      with team values 1..4.
--   2. "Event" pseudo-activity: title + single contestant + flat points award.
--      Stored as an activity with type='event' / format='event' / status
--      always = 'completed'. Appears in the public activity list; managed via
--      a dedicated /admin/events page (not /admin/activities).

ALTER TABLE activities DROP CONSTRAINT activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN ('free_for_all', '1v1', '2v2', '3v3', '4v4', '2v2v2v2', 'event'));

ALTER TABLE activities DROP CONSTRAINT activities_format_check;
ALTER TABLE activities ADD CONSTRAINT activities_format_check
  CHECK (format IN (
    'free_for_all', 'round_robin', 'double_elimination',
    'team_battle', 'multi_team_battle', 'event'
  ));

-- Per-team placements for multi-team matches. Shape:
--   {"1": 3, "2": 1, "3": 4, "4": 2}   (team -> 1..4 placement, 1 = best)
-- Nullable: regular 2-team matches keep using winning_team.
ALTER TABLE matches ADD COLUMN team_placements jsonb;

-- Create the N matches for a multi-team-battle activity. Every match shares
-- the same 4-team split, just like create_round_robin_matches for team_battle.
-- `teams` must be a jsonb array of 4 arrays of contestant uuids.
CREATE OR REPLACE FUNCTION create_multi_team_matches(
  token_input text,
  activity_id_input uuid,
  teams jsonb,
  num_rounds integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_match_id uuid;
  r integer;
  t integer;
  player_id text;
BEGIN
  PERFORM verify_admin(token_input);

  DELETE FROM matches WHERE activity_id = activity_id_input;

  FOR r IN 1..num_rounds LOOP
    INSERT INTO matches (activity_id, round, status)
    VALUES (activity_id_input, r, 'pending')
    RETURNING id INTO new_match_id;

    FOR t IN 1..4 LOOP
      FOR player_id IN SELECT * FROM jsonb_array_elements_text(teams->(t-1)) LOOP
        INSERT INTO match_players (match_id, contestant_id, team)
        VALUES (new_match_id, player_id::uuid, t);
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- Record a full set of placements for a multi-team match. The placements map
-- should cover all 4 teams (1..4) with unique values 1..4. We store the map
-- as-is and mark the match completed. Intentionally no uniqueness check here
-- -- the UI enforces it and we want the RPC to be forgiving during edits.
CREATE OR REPLACE FUNCTION set_match_placements(
  token_input text,
  match_id_input uuid,
  placements_input jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);
  UPDATE matches
  SET team_placements = placements_input, status = 'completed'
  WHERE id = match_id_input;
END;
$$;

-- Create a flat point-award "event". Internally just an activity row with
-- type='event', the single contestant participant, and a points row already
-- written, all marked completed so it surfaces in the leaderboard immediately.
CREATE OR REPLACE FUNCTION add_event(
  token_input text,
  title_input text,
  contestant_id_input uuid,
  points_input integer
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_id uuid;
  max_order integer;
BEGIN
  PERFORM verify_admin(token_input);

  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO max_order FROM activities;

  INSERT INTO activities (name, type, format, status, sort_order, num_rounds)
  VALUES (title_input, 'event', 'event', 'completed', max_order, 1)
  RETURNING id INTO new_id;

  INSERT INTO activity_contestants (activity_id, contestant_id)
  VALUES (new_id, contestant_id_input);

  INSERT INTO points (activity_id, contestant_id, amount)
  VALUES (new_id, contestant_id_input, points_input);

  RETURN new_id;
END;
$$;

-- Update an existing event. Rewrites the participant and points rows in full
-- so changing the recipient is straightforward.
CREATE OR REPLACE FUNCTION update_event(
  token_input text,
  event_id_input uuid,
  title_input text,
  contestant_id_input uuid,
  points_input integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM verify_admin(token_input);

  UPDATE activities SET name = title_input WHERE id = event_id_input;

  DELETE FROM activity_contestants WHERE activity_id = event_id_input;
  DELETE FROM points WHERE activity_id = event_id_input;

  INSERT INTO activity_contestants (activity_id, contestant_id)
  VALUES (event_id_input, contestant_id_input);

  INSERT INTO points (activity_id, contestant_id, amount)
  VALUES (event_id_input, contestant_id_input, points_input);
END;
$$;
