-- 021_wager.sql
-- Extends the activities table to support zero-sum 1v1 wagers.

-- 1. Expand the type CHECK to allow 'wager'
ALTER TABLE activities DROP CONSTRAINT activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN (
    'free_for_all', '1v1', '2v2', '3v3', '4v4', '2v2v2v2', 'event', 'wager'
  ));

-- 2. Expand the format CHECK to allow 'heads_up'
ALTER TABLE activities DROP CONSTRAINT activities_format_check;
ALTER TABLE activities ADD CONSTRAINT activities_format_check
  CHECK (format IN (
    'free_for_all', 'round_robin', 'double_elimination',
    'team_battle', 'multi_team_battle', 'event', 'heads_up'
  ));

-- 3. Store the bet amount on the activity row (nullable; only set for wagers)
ALTER TABLE activities ADD COLUMN bet_amount integer;

-- 4. Atomic wager creation RPC
CREATE OR REPLACE FUNCTION create_wager(
  token_input     text,
  player_a_id     uuid,
  player_b_id     uuid,
  bet_amount_input integer,
  winner_id       uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_activity_id uuid;
  new_match_id    uuid;
  loser_id        uuid;
  name_a          text;
  name_b          text;
  balance_a       bigint;
  balance_b       bigint;
BEGIN
  -- Auth
  PERFORM verify_admin(token_input);

  -- Basic validation
  IF player_a_id = player_b_id THEN
    RAISE EXCEPTION 'Spillerne må være forskjellige';
  END IF;

  IF bet_amount_input <= 0 THEN
    RAISE EXCEPTION 'Innsatsen må være minst 1 poeng';
  END IF;

  IF winner_id != player_a_id AND winner_id != player_b_id THEN
    RAISE EXCEPTION 'Vinneren må være en av de to spillerne';
  END IF;

  -- Resolve names (also validates both players exist)
  SELECT name INTO name_a FROM contestants WHERE id = player_a_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiller ikke funnet'; END IF;

  SELECT name INTO name_b FROM contestants WHERE id = player_b_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Spiller ikke funnet'; END IF;

  -- Balance check: both players must be able to afford the bet
  SELECT COALESCE(SUM(p.amount), 0) INTO balance_a
    FROM points p WHERE p.contestant_id = player_a_id;

  IF balance_a < bet_amount_input THEN
    RAISE EXCEPTION '% har ikke nok poeng (trenger %, har %)', name_a, bet_amount_input, balance_a;
  END IF;

  SELECT COALESCE(SUM(p.amount), 0) INTO balance_b
    FROM points p WHERE p.contestant_id = player_b_id;

  IF balance_b < bet_amount_input THEN
    RAISE EXCEPTION '% har ikke nok poeng (trenger %, har %)', name_b, bet_amount_input, balance_b;
  END IF;

  -- Derive loser
  loser_id := CASE WHEN winner_id = player_a_id THEN player_b_id ELSE player_a_id END;

  -- Create activity
  INSERT INTO activities (name, type, format, status, sort_order, num_rounds, bet_amount)
  VALUES (
    'Veddemål: ' || name_a || ' vs ' || name_b,
    'wager', 'heads_up', 'completed',
    (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM activities),
    1,
    bet_amount_input
  )
  RETURNING id INTO new_activity_id;

  -- Link both players as activity contestants
  INSERT INTO activity_contestants (activity_id, contestant_id)
  VALUES (new_activity_id, player_a_id), (new_activity_id, player_b_id);

  -- Create the single match
  INSERT INTO matches (activity_id, round, status, winning_team)
  VALUES (new_activity_id, 1, 'completed', CASE WHEN winner_id = player_a_id THEN 1 ELSE 2 END)
  RETURNING id INTO new_match_id;

  INSERT INTO match_players (match_id, contestant_id, team)
  VALUES (new_match_id, player_a_id, 1), (new_match_id, player_b_id, 2);

  -- Award points: +bet to winner, -bet to loser
  INSERT INTO points (activity_id, contestant_id, amount)
  VALUES
    (new_activity_id, winner_id,  bet_amount_input),
    (new_activity_id, loser_id,  -bet_amount_input);

  RETURN new_activity_id;
END;
$$;
