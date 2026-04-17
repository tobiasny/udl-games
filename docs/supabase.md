# Supabase Setup

Project ref: `zqvhmbkwmfkakvtivsnj` (eu-west-1).

Migrations are applied via the Supabase MCP tool (`mcp__supabase__apply_migration`) rather than the CLI, since the project is managed through the MCP server. Local migration files in `supabase/migrations/` serve as the source of truth for schema history.

```sh
# CLI equivalents if needed:
npx supabase migration list    # see local vs remote state
npx supabase db push           # apply pending migrations
npx supabase migration repair <version> --status reverted   # unstick failed migration
```

## Environment Variables

```
VITE_SUPABASE_URL=https://zqvhmbkwmfkakvtivsnj.supabase.co
VITE_SUPABASE_ANON_KEY=<supabase anon/publishable key>
```

Supabase may label their key `PUBLISHABLE_DEFAULT_KEY` in their dashboard copy-paste — the code expects `VITE_SUPABASE_ANON_KEY`, so rename when creating `.env` or setting Vercel env vars.

## Migration gotchas (learned the hard way)
- **`pgcrypto` lives in the `extensions` schema on Supabase**, not `public`. Always schema-qualify calls: `extensions.crypt(...)`, `extensions.gen_salt(...)`, and create with `CREATE EXTENSION ... WITH SCHEMA extensions`.
- Migration filenames need numeric versions (`001_*.sql` etc.). The Supabase CLI `migration repair` command wants just the version number (`002`), not the full filename.
- Public read access is enabled via RLS `SELECT` policies on all data tables — direct `supabase.from(...).select()` works from the frontend without auth.
- All write operations go through `SECURITY DEFINER` RPCs that call `verify_admin(token_input)` as their first step.

## Migrations Reference

| Version | Name | Description |
|---------|------|-------------|
| 001 | initial_schema | contestants, activities, matches, points, leaderboard view |
| 002 | auth_functions | verify_admin, authenticate_admin RPCs |
| 003 | mutation_functions | add/update/delete RPCs for activities, contestants, matches, points |
| 004 | rebus_tasks | rebus_tasks table + approve/reject/reset RPCs |
| 005 | avatar_support | avatar_url column on contestants |
| 006 | bracket_propagation | double-elimination bracket schema + propagation logic |
| 007 | team_battle_format | team_battle format support |
| 008 | multi_team_and_events | 2v2v2v2 format + event activities |
| 009 | rebus_settings | rebus_settings table (start coords, etc.) |
| 010 | rebus_reject | answer rejection support on rebus tasks |
| 011 | activity_completed_at | completed_at timestamp on activities |
| 012 | clear_match_result | RPC to clear a match result |
| 013 | reorder_activities | `reorder_activities(token, uuid[])` RPC — sets sort_order = index × 10 |
| 014 | drink_log | drink_log table + log_drink / remove_last_drink RPCs |
| 015 | voting | vote_sessions, vote_options, votes + create/close/delete/cast RPCs |

## RLS Policy Pattern
Every data table follows this pattern:
```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read my_table" ON my_table FOR SELECT USING (true);
-- writes go through SECURITY DEFINER RPCs only
```
