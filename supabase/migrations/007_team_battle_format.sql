-- 4v4 activities are now a "team battle": players are split into two random
-- teams and the teams play a configurable number of matches against each
-- other. This is structurally identical to a round-robin (matches table +
-- match_players) so we just need to allow the new format value.
ALTER TABLE activities DROP CONSTRAINT activities_format_check;
ALTER TABLE activities ADD CONSTRAINT activities_format_check
  CHECK (format IN ('free_for_all', 'round_robin', 'double_elimination', 'team_battle'));
