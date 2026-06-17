## Cel

Przekształcam istniejący wizualny prototyp Agaty w prawdziwą, prywatną aplikację jednego użytkownika z backendem (Lovable Cloud), Open Library + Google Books, oraz Gigi opartą o Lovable AI Gateway (Gemini). Zachowuję obecny design system, motywy i layouty iPhone/iPad.

## Zakres tej tury (Etap 1 MVP)

Buduję pełny, działający fundament: auth, baza, storage, wyszukiwarka książek, biblioteka, szczegóły książki, notatki (cytaty / rozdziały / zdjęcia / inne), edytor notatek iPhone/iPad, Gigi (prawdziwy chat z kontekstem). Tryb Czytaj, statystyki, pen-canvas i polecane zostawiam na kolejne tury w ramach planu Agaty.

## Architektura

- Stack: TanStack Start (już jest), Lovable Cloud (Supabase) — auth, Postgres, Storage; Lovable AI Gateway dla Gigi.
- Konto: prywatne. Wyłączam publiczną rejestrację — pierwsza osoba która się zarejestruje staje się właścicielem; potem signup zamknięty (flaga w tabeli `app_config`). Ekran logowania = email + hasło.
- Wszystkie tabele user-data pod RLS scoped do `auth.uid()`.
- Storage bucket `book-assets` (private) na zdjęcia stron i okładki przesyłane ręcznie.

## Schemat bazy (migracja)

Tabele zgodne z planem Agaty, z dodatkami pod RLS i GRANT:

- `books` — id, user_id, title, author, isbn, cover_url, description, page_count, published_date, category, status (enum: queue / reading / paused / abandoned / finished / favourite), current_page, rating (1–5 nullable), is_favourite, source ('openlibrary'|'google'|'manual'), external_id, created_at, updated_at
- `notes` — id, user_id, book_id (nullable dla notatek bez książki), type (enum: quote / text / photo / chapter / other / summary), title, content, quote_text, comment, page_number, chapter_number, image_path (storage), is_favourite, created_at, updated_at
- `tags` — id, user_id, name, color
- `note_tags` — note_id, tag_id
- `reading_sessions` — id, user_id, book_id, started_at, ended_at, duration_minutes, start_page, end_page, pages_read
- `ratings` — id, user_id, book_id (unique), overall, writing_style, emotional_impact, usefulness, would_read_again, summary
- `gigi_conversations` — id, user_id, title, context_book_id nullable, created_at
- `gigi_messages` — id, conversation_id, user_id, role (user/assistant), content, created_at
- `user_settings` — user_id PK, theme, gigi_privacy_level, font, density

Każda tabela: GRANT na `authenticated` + `service_role`, RLS, polityki `auth.uid() = user_id`.

## Server functions (TanStack)

W `src/lib/`:
- `books.functions.ts` — list/get/upsert/updateStatus/delete, searchOpenLibrary, searchGoogleBooks, importFromExternal
- `notes.functions.ts` — list (z filtrami: typ, książka, ulubione, tag), upsert, delete, uploadPhoto (signed URL)
- `sessions.functions.ts` — start/stop/list (pod Fazę 2; minimalny CRUD już teraz)
- `gigi.functions.ts` — listConversations, getMessages, sendMessage (stream przez `streamText` + Gemini, system prompt = Gigi persona, kontekst: aktywna książka + ostatnie notatki + ulubione cytaty, filtrowane wg `gigi_privacy_level`)
- `settings.functions.ts` — get/update

Wszystkie z `requireSupabaseAuth`.

## Routing

Obecne trasy przenoszę pod `_authenticated/`:
- `/auth` — logowanie (publiczne)
- `/_authenticated/` — For You, library, book/$id, notes, quotes, chapters, other-notes, add-book, search, read, gigi, statistics, recommendations, settings, themes, notebook, note/$id

## Integracje zewnętrzne

- Open Library: `https://openlibrary.org/search.json?q=…` i `…/isbn/{isbn}.json` + okładki `covers.openlibrary.org`. Bez klucza.
- Google Books fallback: `https://www.googleapis.com/books/v1/volumes?q=…`. Bez klucza dla podstawowego użycia.
- Wywołania z `createServerFn` (nie z klienta) → kontrola błędów i deduplikacja wyników po ISBN.

## Gigi (AI od razu)

- Provider helper `src/lib/ai-gateway.server.ts` używający `LOVABLE_API_KEY` i `google/gemini-3-flash-preview`.
- Server route `src/routes/api/chat.ts` ze `streamText`, kontekst budowany w handlerze (pobiera książki, notatki, ulubione cytaty użytkownika, respektując `gigi_privacy_level`: off / books-only / books+notes / full).
- Frontend: AI SDK `useChat` z `DefaultChatTransport`, renderowanie `message.parts`, markdown.
- W szczegółach książki: przycisk „Zapytaj Gigi o tę książkę" tworzy nową konwersację z `context_book_id`.

## UI / zachowanie prototypu

- Cały obecny design system, motywy (Cream, Coffee, Burgundy, Rose, Dark, Minimal), iPad sidebar i iPhone bottom nav zostają.
- Mock data zastępuję realnymi zapytaniami (TanStack Query + `useSuspenseQuery`) + skeleton states + empty states po polsku.
- Dodawanie książki: search (Open Library/Google) → wybór z listy z okładkami → zapis; alternatywa "Dodaj ręcznie".
- Edytor notatki iPhone: szybki formularz (typ, książka, treść, strona, tagi, zdjęcie, ulubione).
- Edytor notatki iPad: większy layout z panelami; pełny pen-canvas (Konva/tldraw) deklaruję jako Faza 3 — w tej turze zostawiam tylko szkielet workspace + upload zdjęć.

## Czego NIE robię w tej turze

- Tryb Czytaj z timerem, statystyki z wykresami, pen/drawing canvas, polecane przez Gigi, PWA install, Capacitor.
  Te punkty są zaplanowane (Etap 2–5 wg planu Agaty) i zrealizuję je w następnych turach na zatwierdzenie.

## Akceptacja Etapu 1

1. Logowanie działa, drugi user nie może się zarejestrować.
2. Mogę wyszukać „Tokarczuk" → dodać książkę z okładką → zmienić status → zobaczyć w Bibliotece.
3. Mogę dodać cytat z poziomu książki i widzę go zarówno w książce, jak i w globalnych Cytatach.
4. Mogę wgrać zdjęcie strony i zobaczyć je w notatce.
5. Otwieram Gigi, pytam o aktualną książkę, dostaję streamowaną odpowiedź po polsku z kontekstem moich notatek.
6. Motywy nadal działają, iPhone (440px) i iPad layout poprawne.

Po akceptacji włączam Lovable Cloud, zakładam migrację, podpinam ekrany i Gigi.
