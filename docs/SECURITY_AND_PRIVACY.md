# Security and Privacy

Agata is a private app. The default assumption is that user reading data is personal and should stay private.

## Current privacy model

Current runtime data is local-first:

- books,
- notes,
- quotes,
- reading sessions,
- ratings,
- favourites,
- progress,
- drafts,
- handwriting preferences.

This data lives in the browser localStorage unless the user explicitly exports/imports or future cloud sync is safely enabled.

## Protected data

Treat the following as private:

- book library,
- notes and quotes,
- reading progress,
- ratings/opinions,
- page photos,
- handwriting/drawing data,
- auth identifiers,
- future Gigi conversation memory.

## Secrets rule

Never commit:

- Supabase service role keys,
- API keys,
- OpenAI keys,
- paid book API keys,
- OAuth client secrets,
- personal tokens.

Frontend code must not contain secrets.

## Auth rule

The app must remain usable without login until the owner explicitly decides otherwise.

Do not enforce auth for:

- local book library,
- local notes,
- local reading sessions,
- local backup/export.

## Cloud rule

Cloud sync must remain disabled until safety verification is complete.

Before enabling sync:

- verify RLS as a real authenticated user,
- verify owner gate,
- verify media storage,
- verify local/cloud id mapping,
- verify backup and restore,
- verify non-destructive conflict behavior.

## Local data deletion rule

Do not delete or overwrite localStorage automatically.

Dangerous operations must require explicit confirmation and should recommend backup first.

## Gigi privacy rule

Gigi is not connected yet.

When Gigi is built later:

- do not send full private library/notes without explicit design,
- minimize data sent to models,
- avoid raw secret tokens in frontend,
- document exactly what is sent and why,
- provide a user-visible privacy explanation.

## Error logging rule

Do not log private note text, quotes, full book opinions, or page photos to console in normal operation.

Temporary diagnostics are allowed only during debugging and should be removed or minimized.

## Backup rule

Backup files may contain private reading data. Treat exported backup files as sensitive.

UI should make this clear if backup sharing is added later.
