
# Migracja na Twój Supabase

Baza pusta, brak plików w storage, brak edge functions — migracja jest prosta: przenosimy **schemat** i przełączamy **klucze**.

## Co zrobisz Ty (ręcznie — wymagane)

1. **Service role key** — w panelu swojego Supabase (`ouzupwvdrzpzvquacjqq`) → Project Settings → API → skopiuj `service_role` key. Poproszę o niego przez bezpieczny formularz Lovable (`add_secret`) po zatwierdzeniu planu.
2. **Uruchomienie SQL** — wkleisz w SQL Editor Twojego Supabase treść istniejącej migracji `supabase/migrations/20260617221811_*.sql` (przygotuję jeden gotowy blok do skopiowania). To stworzy wszystkie tabele (`books`, `notes`, `reading_sessions`, `ratings`, `user_settings`, `note_tags`, `tags`, `app_config`, `gigi_*`), RLS, GRANT-y i funkcje.
3. **Storage bucket** — w Storage utworzysz bucket `book-assets` (Private). Dam Ci SQL z politykami do wklejenia.
4. **Auth providers** — jeśli będziesz chciał Google/email, skonfigurujesz w swoim panelu Auth (Lovable nie ma już do tego dostępu po przełączeniu).

## Co zrobię ja w kodzie

1. **`.env`** — podmiana wszystkich 6 zmiennych (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` + ich warianty `VITE_`) na Twoje wartości.
2. **`supabase/config.toml`** — `project_id = "ouzupwvdrzpzvquacjqq"`.
3. **Sekrety serwerowe** przez `add_secret`/`update_secret`: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — tak, żeby `createServerFn` używał Twojej bazy.
4. **Plik migracji do wklejenia** — przygotuję `MIGRATION_TO_RUN.sql` w roocie projektu, jeden plik z całym schematem gotowym do wklejenia w SQL Editor.
5. **Krótki README** z kolejnością kroków po Twojej stronie.

## Czego NIE ruszam

- `src/integrations/supabase/client.ts`, `client.server.ts`, `types.ts`, `auth-middleware.ts`, `auth-attacher.ts` — auto-generowane.
- Logika aplikacji, UI, route'y, store'y — bez zmian.

## Ważne ostrzeżenia

- **Lovable Cloud zostaje "podpięty" technicznie** (nie da się go usunąć z projektu), ale aplikacja będzie czytać/zapisywać do **Twojego** Supabase, bo `.env` i sekrety wskażą Twój projekt. Cloud przestanie być używany.
- **`types.ts` nie będzie automatycznie regenerowany** dla Twojego Supabase — jeśli zmienisz schemat poza tą migracją, typy mogą się rozjechać (do rozwiązania później, np. lokalnie `supabase gen types`).
- **Narzędzia Lovable** (`supabase--migration`, `supabase--read_query`, panel "View Backend") nadal pokazują **stary** Cloud, nie Twój. Po migracji wszystkie zmiany schematu robisz w swoim panelu Supabase.
- **AI Gateway (`LOVABLE_API_KEY`)** zostaje — działa niezależnie od bazy.

## Weryfikacja po zmianach

- `bunx tsc --noEmit`
- Restart dev servera, sprawdzenie w konsoli przeglądarki że requesty lecą na `ouzupwvdrzpzvquacjqq.supabase.co`.
- Smoke test: dodanie książki, notatki, sesji czytania.

Po zatwierdzeniu planu poproszę o `SUPABASE_SERVICE_ROLE_KEY` przez bezpieczny formularz i wykonam zmiany w kodzie.
