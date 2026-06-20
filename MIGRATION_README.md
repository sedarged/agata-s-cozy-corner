# Migracja na własny Supabase — kroki do wykonania

Projekt został przełączony na Twój Supabase: **ouzupwvdrzpzvquacjqq**.

## 1. Utwórz schemat bazy

Otwórz swój panel Supabase → SQL Editor → New query, wklej całą zawartość pliku **`MIGRATION_TO_RUN.sql`** (w roocie tego projektu) i uruchom.

## 2. Utwórz bucket `book-assets`

Storage → New bucket → nazwa `book-assets`, **Private**. Polityki dla tego bucketa są już w SQL z kroku 1 (sekcja na końcu pliku).

## 3. Skonfiguruj Auth

Authentication → Providers:

- Włącz **Email** (lub Google, jeśli chcesz OAuth).
- W URL Configuration ustaw **Site URL** = URL Twojego deploya (np. preview Lovable).

## 4. Service Role Key

Lovable poprosi Cię o `SUPABASE_SERVICE_ROLE_KEY` w bezpiecznym formularzu — skopiuj z Project Settings → API → `service_role`.

## 5. Sprawdzenie

Po wszystkim zrestartuj preview. Requesty w DevTools → Network powinny lecieć na `ouzupwvdrzpzvquacjqq.supabase.co`.

## Uwagi

- Narzędzia Lovable (`View Backend`, migracje w czacie) nadal pokazują **stary** Cloud — zignoruj je, używaj swojego panelu Supabase.
- `src/integrations/supabase/types.ts` nie będzie auto-regenerowany — jeśli zmienisz schemat, wygeneruj typy lokalnie (`supabase gen types typescript`).
