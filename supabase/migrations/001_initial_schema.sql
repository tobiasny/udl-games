-- Contestants
CREATE TABLE contestants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activities
CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('free_for_all', '1v1', '2v2', '3v3', '4v4')),
  format text NOT NULL CHECK (format IN ('free_for_all', 'round_robin', 'double_elimination')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed')),
  sort_order integer NOT NULL DEFAULT 0,
  num_rounds integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Activity contestants (who participates)
CREATE TABLE activity_contestants (
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  PRIMARY KEY (activity_id, contestant_id)
);

-- Matches
CREATE TABLE matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  round integer,
  bracket text CHECK (bracket IN ('winners', 'losers', 'grand_final')),
  bracket_round integer,
  bracket_position integer,
  source_match_winner uuid REFERENCES matches(id) ON DELETE SET NULL,
  source_match_loser uuid REFERENCES matches(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  winning_team integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Match players
CREATE TABLE match_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  team integer NOT NULL,
  UNIQUE (match_id, contestant_id)
);

-- Points
CREATE TABLE points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  contestant_id uuid NOT NULL REFERENCES contestants(id) ON DELETE CASCADE,
  amount integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (activity_id, contestant_id)
);

-- Leaderboard view
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  c.id,
  c.name,
  c.avatar_url,
  COALESCE(SUM(p.amount), 0)::integer AS total_points,
  RANK() OVER (ORDER BY COALESCE(SUM(p.amount), 0) DESC)::integer AS rank
FROM contestants c
LEFT JOIN points p ON p.contestant_id = c.id
GROUP BY c.id, c.name, c.avatar_url;

-- Admin settings
CREATE TABLE app_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_password_hash text NOT NULL
);

-- Admin sessions
CREATE TABLE admin_sessions (
  token text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

-- Enable RLS
ALTER TABLE contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_contestants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE points ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read contestants" ON contestants FOR SELECT USING (true);
CREATE POLICY "Public read activities" ON activities FOR SELECT USING (true);
CREATE POLICY "Public read activity_contestants" ON activity_contestants FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read match_players" ON match_players FOR SELECT USING (true);
CREATE POLICY "Public read points" ON points FOR SELECT USING (true);
