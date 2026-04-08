-- Allow the admin to undo an individual match/round/bracket result. Until now
-- set_match_result and set_match_placements were one-way: once a winner was
-- recorded the only escape was to delete and regenerate. clear_match_result
-- resets a single match back to 'pending' and undoes any bracket propagation
-- it caused, recursively, so downstream matches that inherited players from
-- this one are emptied (and themselves cleared if they were already played).

CREATE OR REPLACE FUNCTION clear_match_result(token_input text, match_id_input uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  this_activity uuid;
  this_bracket text;
  this_round integer;
  downstream record;
BEGIN
  PERFORM verify_admin(token_input);

  -- Reset the match itself. Covers all formats: regular matches use
  -- winning_team, multi-team battle uses team_placements, both flip back to
  -- 'pending' so the UI re-exposes the result picker.
  UPDATE matches
  SET winning_team = NULL,
      team_placements = NULL,
      status = 'pending'
  WHERE id = match_id_input
  RETURNING activity_id, bracket, bracket_round
  INTO this_activity, this_bracket, this_round;

  -- Cascade through bracket propagation: any downstream slot that pulled
  -- players from this match must release them, and if that downstream match
  -- had already been played the recursive call resets it too.
  FOR downstream IN
    SELECT id, team1_source_match, team2_source_match
    FROM matches
    WHERE team1_source_match = match_id_input
       OR team2_source_match = match_id_input
  LOOP
    IF downstream.team1_source_match = match_id_input THEN
      DELETE FROM match_players WHERE match_id = downstream.id AND team = 1;
    END IF;
    IF downstream.team2_source_match = match_id_input THEN
      DELETE FROM match_players WHERE match_id = downstream.id AND team = 2;
    END IF;
    PERFORM clear_match_result(token_input, downstream.id);
  END LOOP;

  -- set_match_result deletes the grand-final reset match when the winners-
  -- bracket champion wins GF1. Undoing that GF1 result has to put the reset
  -- match back, otherwise the bracket would be stuck without a way to play it.
  IF this_bracket = 'grand_final' AND this_round = 1 THEN
    IF NOT EXISTS (
      SELECT 1 FROM matches
      WHERE activity_id = this_activity
        AND bracket = 'grand_final'
        AND bracket_round = 2
    ) THEN
      INSERT INTO matches (
        activity_id, bracket, bracket_round, bracket_position, status,
        team1_source_match, team1_source_from,
        team2_source_match, team2_source_from
      )
      VALUES (
        this_activity, 'grand_final', 2, 1, 'pending',
        match_id_input, 'winner',
        match_id_input, 'loser'
      );
    END IF;
  END IF;
END;
$$;
