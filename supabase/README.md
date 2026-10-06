# KarigarGo backend backup

Snapshot of everything that lives in Supabase (project `epekjmfmbgwfonjyhklm`), kept here so it is not only stored in the Supabase dashboard.

Restore order on a fresh project (SQL Editor, run in this order):

1. `01_schema.sql`   enums, tables, constraints, indexes, RLS enabled
2. `02_functions.sql` functions and their execute grants
3. `03_triggers.sql`  triggers (including the one on `auth.users`)
4. `04_policies.sql`  row level security policies (public + storage)
5. `05_storage.sql`   storage buckets and realtime publication

Edge functions are in `functions/`. Deploy each with the Supabase CLI:
`supabase functions deploy karigar-mailer` and
`supabase functions deploy signup-upload-url --no-verify-jwt`.

Secrets (never commit them) are set in Supabase, Edge Functions, Secrets:
`GMAIL_APP_PASSWORD` (and optional `GMAIL_USER`), or `RESEND_API_KEY` with optional `MAIL_FROM`.
