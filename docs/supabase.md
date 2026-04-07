# Supabase Setup

Project is linked via `npx supabase link --project-ref <ref>`. Migrations live in `supabase/migrations/`.

```sh
npx supabase migration list    # see local vs remote state
npx supabase db push           # apply pending migrations
npx supabase migration repair <version> --status reverted   # unstick failed migration
```

## Environment Variables

```
VITE_SUPABASE_URL=<supabase project url>
VITE_SUPABASE_ANON_KEY=<supabase anon/publishable key>
```

Supabase may label their key `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` in their dashboard copy-paste — the code expects `VITE_SUPABASE_ANON_KEY`, so rename when creating `.env`.

## Migration gotchas (learned the hard way)
- **`pgcrypto` lives in the `extensions` schema on Supabase**, not `public`. Always schema-qualify calls: `extensions.crypt(...)`, `extensions.gen_salt(...)`, and create with `CREATE EXTENSION ... WITH SCHEMA extensions`.
- Migration filenames need numeric versions (`001_*.sql` etc.). The Supabase CLI `migration repair` command wants just the version number (`002`), not the full filename.
- Public read access is enabled via RLS `SELECT` policies on all data tables — direct `supabase.from(...).select()` works from the frontend without auth.
