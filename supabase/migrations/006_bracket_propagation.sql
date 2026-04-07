-- Per-team source columns: each team slot can be filled from another match's
-- winner OR loser, so we need explicit per-slot semantics. The old
-- source_match_winner / source_match_loser columns had inconsistent meanings
-- across bracket types and are no longer used by the application.
ALTER TABLE matches
  ADD COLUMN team1_source_match uuid REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN team1_source_from text CHECK (team1_source_from IN ('winner', 'loser')),
  ADD COLUMN team2_source_match uuid REFERENCES matches(id) ON DELETE SET NULL,
  ADD COLUMN team2_source_from text CHECK (team2_source_from IN ('winner', 'loser'));

-- Replace create_bracket_matches to persist the new per-slot source fields.
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
  t1_src text;
  t2_src text;
BEGIN
  PERFORM verify_admin(token_input);

  DELETE FROM matches WHERE activity_id = activity_id_input;

  -- First pass: create all matches and remember temp_id -> real id.
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

    IF match_entry->'team1' IS NOT NULL AND match_entry->>'team1' != 'null' THEN
      FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team1') LOOP
        INSERT INTO match_players (match_id, contestant_id, team)
        VALUES (new_match_id, player_id::uuid, 1);
      END LOOP;
    END IF;

    IF match_entry->'team2' IS NOT NULL AND match_entry->>'team2' != 'null' THEN
      FOR player_id IN SELECT * FROM jsonb_array_elements_text(match_entry->'team2') LOOP
        INSERT INTO match_players (match_id, contestant_id, team)
        VALUES (new_match_id, player_id::uuid, 2);
      END LOOP;
    END IF;
  END LOOP;

  -- Second pass: now that every match has a real id, fill in source pointers.
  FOR match_entry IN SELECT * FROM jsonb_array_elements(matches_data) LOOP
    temp_id := match_entry->>'temp_id';
    t1_src := match_entry->>'team1_source_temp';
    t2_src := match_entry->>'team2_source_temp';

    UPDATE matches SET
      team1_source_match = CASE
        WHEN t1_src IS NOT NULL AND t1_src != 'null' THEN (temp_id_map->>t1_src)::uuid
        ELSE NULL
      END,
      team1_source_from = NULLIF(match_entry->>'team1_source_from', ''),
      team2_source_match = CASE
        WHEN t2_src IS NOT NULL AND t2_src != 'null' THEN (temp_id_map->>t2_src)::uuid
        ELSE NULL
      END,
      team2_source_from = NULLIF(match_entry->>'team2_source_from', '')
    WHERE id = (temp_id_map->>temp_id)::uuid;
  END LOOP;
END;
$$;

-- Replace set_match_result to propagate winners/losers down the bracket.
-- When a match completes, any downstream match whose team1/team2 slot points
-- to this match has the matching players inserted (or replaced, in case the
-- result is being changed).
CREATE OR REPLACE FUNCTION set_match_result(
  token_input text,
  match_id_input uuid,
  winning_team_input integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  losing_team_value integer;
  this_activity uuid;
  this_bracket text;
  this_round integer;
  downstream record;
BEGIN
  PERFORM verify_admin(token_input);

  UPDATE matches
  SET winning_team = winning_team_input, status = 'completed'
  WHERE id = match_id_input
  RETURNING activity_id, bracket, bracket_round
  INTO this_activity, this_bracket, this_round;

  losing_team_value := CASE WHEN winning_team_input = 1 THEN 2 ELSE 1 END;

  -- Propagate to any downstream slots that reference this match.
  FOR downstream IN
    SELECT id, team1_source_match, team1_source_from, team2_source_match, team2_source_from
    FROM matches
    WHERE team1_source_match = match_id_input
       OR team2_source_match = match_id_input
  LOOP
    IF downstream.team1_source_match = match_id_input THEN
      DELETE FROM match_players WHERE match_id = downstream.id AND team = 1;
      INSERT INTO match_players (match_id, contestant_id, team)
      SELECT downstream.id, contestant_id, 1
      FROM match_players
      WHERE match_id = match_id_input
        AND team = CASE
          WHEN downstream.team1_source_from = 'winner' THEN winning_team_input
          ELSE losing_team_value
        END;
    END IF;

    IF downstream.team2_source_match = match_id_input THEN
      DELETE FROM match_players WHERE match_id = downstream.id AND team = 2;
      INSERT INTO match_players (match_id, contestant_id, team)
      SELECT downstream.id, contestant_id, 2
      FROM match_players
      WHERE match_id = match_id_input
        AND team = CASE
          WHEN downstream.team2_source_from = 'winner' THEN winning_team_input
          ELSE losing_team_value
        END;
    END IF;
  END LOOP;

  -- Grand final reset is only needed if the losers-bracket champion (team2 of
  -- grand final round 1) wins. If the winners-bracket champion (team1) wins,
  -- the tournament is over -- drop the reset match so the UI is clean.
  IF this_bracket = 'grand_final' AND this_round = 1 AND winning_team_input = 1 THEN
    DELETE FROM matches
    WHERE activity_id = this_activity
      AND bracket = 'grand_final'
      AND bracket_round = 2;
  END IF;
END;
$$;
