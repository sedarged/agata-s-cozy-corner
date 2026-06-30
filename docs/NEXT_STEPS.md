# Agata — następne kroki dla Claude (jedno miejsce)

Ten plik to gotowe brief‑y do realizacji przez **Claude CLI** na VPS. Idź po kolei:
**Krok 0 (postawienie)** → **Faza 1 (dane na VPS / SQLite)** → **Faza 2 (Gigi przez OAuth ChatGPT)**.

Jak używać: odpal Claude CLI w katalogu repo, a potem wklejaj kolejne prompty z
tego pliku (albo po prostu powiedz: _„zrealizuj `docs/NEXT_STEPS.md` Fazę 1"_).
Repo zawiera `CLAUDE.md` + `docs/`, więc Claude ma pełny kontekst.

```bash
cd <APP_HOME>/agata-s-cozy-corner
claude
```

**Kolejność jest ważna:** najpierw dane (SQLite), bo token ChatGPT z Fazy 2 też
trafia do tej samej bazy. OAuth z Fazy 2 wymaga działającego **HTTPS** (Caddy/
domena lub tailnet) — więc Krok 0 zrób w całości najpierw.

---

## Krok 0 — postawienie aplikacji na VPS

### 0a. W terminalu (robisz sam, raz)

```bash
# Node 22 (Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs git

# Klon repo
sudo mkdir -p <APP_HOME> && sudo chown "$USER" <APP_HOME> && cd <APP_HOME>
git clone https://github.com/<source-repo>.git
cd agata-s-cozy-corner
git checkout claude/agata-reading-app-oe9u3u   # albo main po scaleniu PR-ów

# Build + szybki test (Ctrl+C kończy)
./scripts/vps-setup.sh --run                   # otwórz http://ADRES_VPS:3000
```

Jeśli widać stronę główną — działa. Teraz odpal Claude (`claude`) i wklej prompt 0b.

### 0b. Prompt do Claude — uruchomienie produkcyjne (systemd + HTTPS)

> Postaw Agatę produkcyjnie na tym VPS zgodnie z `docs/VPS_DEPLOY.md`:
>
> 1. Zbuduj projekt (`./scripts/vps-setup.sh`) i potwierdź, że powstaje `.output/server/index.mjs`.
> 2. Skonfiguruj usługę **systemd** z `deploy/agata.service` (popraw `User`, `WorkingDirectory`, ścieżkę node z `which node`), sekrety w `<ENV_FILE>` (z `.env.example`). Włącz i uruchom usługę, pokaż `systemctl status agata`.
> 3. Skonfiguruj **Caddy** z `deploy/Caddyfile` na HTTPS — zapytaj mnie o domenę albo użyj wariantu Tailscale (`*.ts.net`). Reverse proxy na `127.0.0.1:3000`.
> 4. Zweryfikuj: aplikacja otwiera się po HTTPS, fonty ładują się lokalnie (brak żądań do fonts.googleapis.com), dodanie książki działa.
>    Nie commituj żadnych sekretów. Na koniec wypisz adres, pod którym aplikacja jest dostępna.

> ⚠️ Zapamiętaj domenę/adres HTTPS — będzie potrzebny jako **redirect URL** w Fazie 2 (OAuth).

---

## Faza 1 — moje dane na VPS (SQLite, multi-device)

Cel: dane (książki, notatki, pismo, sesje) przestają żyć w `localStorage`
przeglądarki, a trafiają do jednej trwałej bazy SQLite na VPS, dostępnej z
każdego urządzenia. **Bez utraty** tego, co już masz.

### Prompt do Claude

> Zrealizuj „server-authoritative SQLite" zgodnie z `docs/local-database-plan.md`. Zakres:
>
> 1. Dodaj **Drizzle ORM + better-sqlite3** (better-sqlite3 jako natywna zależność, nie bundlowana w Nitro). Tabele: `books, notes, reading_sessions, goals, settings, assets` — odwzoruj kształty z `src/lib/mock-data.ts`. **Zachowaj istniejące id `local-…`** (kolumna text, nie zakładaj UUID). Bez kolumn `user_id`/RLS (jeden właściciel). Migracje przez drizzle-kit.
> 2. Baza w `DATA_DIR` (domyślnie `<DATA_DIR>/agata.db`), a okładki/pismo/zdjęcia jako **pliki** w `DATA_DIR/assets/` zamiast base64 w bazie. Dodaj endpoint `/api/db-health`. Dopisz `DATA_DIR` do `deploy/agata.service` i opisz utworzenie `<DATA_DIR>` (z właściwymi prawami) w `docs/VPS_DEPLOY.md`.
> 3. **Serwerowe API CRUD** (`createServerFn` i/lub `/api/*`) walidowane **Zod**, dla books/notes/reading_sessions/goals/settings/assets.
> 4. **Przełącz klienta z localStorage na TanStack React Query.** Zachowaj semantykę „effective book" — status, postęp, ocena i ulubione muszą być spójne na Home, w Bibliotece, Statystykach i na szczegółach książki. Stary `localStorage` zostaje tylko jako źródło jednorazowego importu.
> 5. **Import bez utraty danych:** dodaj jednorazowy import mojego eksportu z aplikacji (Ustawienia → Kopia zapasowa → „Pobierz kopię" = JSON) do SQLite. Pokaż liczbę zaimportowanych książek/notatek/sesji do potwierdzenia. Import nie może nadpisywać po cichu.
> 6. Zweryfikuj `npm run build` i `npx tsc --noEmit`, oraz przejdź ręcznie: dodanie książki, notatka odręczna (zapis + ponowne otwarcie z atramentem), sesja czytania, statystyki, kopia zapasowa — wszystko z bazy. Commit + push na gałąź roboczą; zaktualizuj `CLAUDE.md` (oznacz Fazę 2/5 jako done).

### Po Fazie 1 (redeploy)

```bash
sudo mkdir -p <DATA_DIR> && sudo chown agata <DATA_DIR>
git pull && ./scripts/vps-setup.sh && sudo systemctl restart agata
```

Następnie w aplikacji zaimportuj swój eksport (jeśli Claude zrobił to przez UI/endpoint — postępuj wg jego instrukcji) i sprawdź, że wszystkie dane są na miejscu.

---

## Faza 2 — Gigi przez „Sign in with ChatGPT" (OAuth, subskrypcja)

Cel: Gigi działa po zalogowaniu Twoim kontem **ChatGPT** (OAuth 2.0 + PKCE),
rozliczane z subskrypcji — bez ręcznego klucza API. Klucz API zostaje jako
fallback.

> ⚠️ To **nieoficjalna** powierzchnia (reverse-engineered, jak w Zed/opencode),
> z ograniczonym zestawem modeli (Responses/Codex) i może się zmienić. Jeśli
> przestanie działać — używasz `OPENAI_API_KEY`. Wymaga działającego HTTPS z
> Kroku 0 (callback OAuth musi być po HTTPS).

### Prompt do Claude

> Zrealizuj Fazę 4 z `docs/exit-lovable-plan.md`: Gigi przez **„Sign in with ChatGPT" (OAuth 2.0 + PKCE)**, rozliczane z mojej subskrypcji ChatGPT.
>
> 1. Dodaj `src/lib/openai-chatgpt.server.ts`: pełny flow PKCE (`auth.openai.com/oauth/authorize` → token), **auto-refresh** tokenów, oraz `streamChatGPT(messages)` korzystające z `ChatGPT-Account-Id` i powierzchni Responses/Codex z właściwymi nagłówkami i `store:false`. Usuń stary `src/lib/ai-gateway.server.ts`, jeśli zbędny.
> 2. **Token trzymaj zaszyfrowany w SQLite** (`settings`, klucz szyfrowania z env, np. `GIGI_TOKEN_KEY`). Nigdy w repo, nigdy w kliencie.
> 3. Endpointy `/api/chatgpt/login` + callback oraz akcja **„Połącz ChatGPT"** w Ustawieniach (połączenie jednorazowe). Pokaż stan połączenia + „Rozłącz".
> 4. **Fallback:** brak OAuth → użyj `OPENAI_API_KEY`; brak i tego → obecny komunikat „Gigi nie skonfigurowana". Zachowaj działanie `GIGI_SECRET`.
> 5. **Najpierw sprawdź aktualną dokumentację/referencje** (z `docs/exit-lovable-plan.md`: Zed PR #56811, opencode #3281) — to nieoficjalny flow i mógł się zmienić. Jeśli jest niedostępny/zmieniony, **zatrzymaj się i zaproponuj wariant z kluczem API**, nie zgaduj.
> 6. Zweryfikuj build + typecheck, przetestuj realne połączenie i jedną odpowiedź Gigi. Commit + push; zaktualizuj `CLAUDE.md` (oznacz Fazę 4 jako done).

### Po Fazie 2 (redeploy + jednorazowe połączenie)

```bash
git pull && ./scripts/vps-setup.sh && sudo systemctl restart agata
```

Następnie w aplikacji: **Ustawienia → „Połącz ChatGPT"** (raz). Od tej chwili Gigi działa.

---

## Ściąga: redeploy po każdej zmianie

```bash
cd <APP_HOME>/agata-s-cozy-corner
git pull
./scripts/vps-setup.sh
sudo systemctl restart agata
```

## Status do odhaczenia

- [ ] Krok 0 — aplikacja działa po HTTPS (systemd + Caddy/Tailscale)
- [ ] Faza 1 — dane w SQLite na VPS, import bez utraty, klient na React Query
- [ ] Faza 2 — Gigi połączona przez OAuth ChatGPT (fallback: klucz API)

---

## Polish — items shipped (2026-06-30 audit)

Polish audytu z 30.06.2026 zapisany w
[`docs/superpowers/plans/2026-06-30-book-app-polish.md`](./superpowers/plans/2026-06-30-book-app-polish.md).
**Wszystkie 12 tasków weszło** — wcześniejsza sekcja „deferred" była
out-of-date (napisana przed dokończeniem Tasks 6–11 w tej samej sesji).
Co zrobiono:

- **`src/lib/reading-progress.ts`** + `src/components/ReadingProgressWidget.tsx`
  — „ile czasu zostało" do końca książki (percent / pagesLeft / ETA), z
  fallbackiem 30 str./h gdy `hasEnoughHistory === false`.
- **`src/lib/social-proof.server.ts`** +
  `src/routes/api/books/$id.social-proof.ts` +
  `useBookSocialProofQuery` w `src/lib/api/client.ts` — Hardcover
  ratings/highlights z fallbackiem do deterministycznego mocka (FNV-1a).
  Mock oznacza `source: "mock"` i puste `sources`, więc UI nie pomyli
  snippetu z prawdziwą recenzją.
- **Multi‑page handwriting (Tasks 6–9)**:
  - `drizzle/0002_handwriting_pages.sql` + wpis w `drizzle/meta/_journal.json`.
  - `src/lib/db/schema.ts` — tabela `handwriting_pages` + `HandwritingPage`
    typ + indeksy `(note_id)` i `(note_id, page_index)`.
  - `src/lib/db/repositories/handwriting.ts` — CRUD: `listPages`,
    `getPage`, `savePage` (upsert z `ON CONFLICT DO UPDATE`),
    `appendPage`, `deletePage`, `renumberPages`, `maxPageIndex`,
    `countPages`. Cascade przez FK na `note_id`.
  - `src/lib/api/handwriting.ts` — handler-y
    `handleGetPages` / `handlePutPage` / `handleDeletePage` ze strict Zod
    walidacją (IdParam `^[A-Za-z0-9._-]+$`, `pageIndex` ≤ 10 000,
    strokes JSON ≤ 2 MB po serializacji, `BackgroundRequired` enum).
    Strokes przechowywane jako
    `data:application/json;base64,…` w kolumnie `data_url` (reuse z
    legacy single-page bez schema change dla storage).
  - `src/routes/api/notes/$noteId.handwriting.pages[.$pageId].ts` —
    `createFileRoute` mounting powyższych handler-ów.
  - Hooki React Query w `src/lib/api/client.ts`:
    `useHandwritingPagesQuery`, `useSaveHandwritingPageMutation`,
    `useDeleteHandwritingPageMutation` — wszystkie z `defaultOnError`
    i inwalidacją `qk.handwritingPages(noteId)`.
- **HandwritingCanvas rewrite + NoteEditor wiring (Tasks 10–11)**:
  - `src/components/HandwritingCanvas.tsx` — page nav strip (◀ / page N of M / ▶),
    bounded canvas, „Dodaj stronę", integracja z nowymi hookami.
  - `src/components/NoteEditor.tsx` — obsługuje istniejące notatki
    (wczytuje strony z React Query, fallback na legacy `initialDataUrl` dla
    nowych draft-ów).
- **Wikidata enrichment (Goal mention, post‑polish)** — fire‑and‑forget
  helper zapisujący `wikidata_id` / `wikidata_description` /
  `enriched_at` po create/update książki:
  - `drizzle/0003_wikidata_enrichment.sql` — 3 nowe nullable kolumny w
    `books`. Wpis w `drizzle/meta/_journal.json` z `when: 1782434887969`.
  - `src/lib/db/schema.ts` — `wikidataId`, `wikidataDescription`,
    `enrichedAt` w tabeli `books`.
  - `src/lib/db/repositories/books.ts` — nowy
    `applyWikidataEnrichment(id, { wikidataId, wikidataDescription })`
    (reuse `patchBook`, więc `updatedAt` jest prawidłowo stampowany).
    `upsertBook` NIE kładzie enrichment kolumn w `ON CONFLICT DO UPDATE` —
    `patchBook` jest jedyną ścieżką pisania enrichment, więc import
    przez upsert nie wyciera świeżo wzbogaconych danych.
  - `src/lib/wikidata-enrichment.server.ts` — server-only helper:
    `searchWikidata({ title })` → `WikidataHit | null` przez
    `wbsearchentities`, 5 s `AbortSignal.timeout`, brak wyjątków na
    zewnątrz. `enrichBookAsync(bookId, input)` — fire-and-forget,
    wewnętrzny try/catch, `null` na każdą soft‑miss.
    `isWikidataEnrichmentEnabled()` — env gate
    `WIKIDATA_ENRICHMENT_ENABLED=true` (off by default dla prywatności).
  - `src/lib/api/books.functions.ts` — `void enrichBookAsync(...)` po
    `upsertBook` (zawsze); w `patchBook` tylko gdy tytuł/autor się
    zmienił ORAZ `wikidataId` jest jeszcze `null` (idempotencja na
    hot path).
- **`docs/NEXT_STEPS.md`** — ta sekcja.
- **Regresje naprawione w trakcie**: signed-shift w `mockSocialProof`
  (`>>` → `>>>` — ujemne `ratingsCount` dla hash-y z MSB=1),
  polski l. mnoga w `pagesLabel` (`last === 1` → `lastTwo === 1`, żeby
  11/21 nie wracały jako „strona"), brakujący wpis w `_journal.json`
  dla `0002_handwriting_pages`.

Testy: **651/652 zielone.** Nowe: 22 unit testy
`src/lib/wikidata-enrichment.spec.ts` (mock `globalThis.fetch` —
`searchWikidata` shape + timeout + 5xx + puste hits + env gate) + 6
integration testów `src/lib/api/books.enrichment.spec.ts` (DB fixture,
fire-and-forget nie blokuje create, fetch error nie propaguje,
idempotencja patcha) + 3 testy `applyWikidataEnrichment` w
`src/lib/db/db.test.ts`. Jedyny pre-existing fail
(`OpenAIKeyCard.helpers.spec.ts::classifySaveError` — ścieżka
`/etc/app.env` vs `/etc/agata.env`) jest poza scope tej paczki i nie był
ruszany (potwierdzone przez `git stash` → nadal failuje na czystym
branchu).

### Nadal odłożone (nie weszło w tę paczkę)

Żaden plan-task nie jest niezrealizowany. Poza planem są dwa odłożone
przedmioty, oba **nie wynikają z żadnego numbered taska** w
`docs/superpowers/plans/2026-06-30-book-app-polish.md` — zostawiam
je tutaj tylko jako pamiątkę dla przyszłych iteracji:

- **e2e cover-upload regression test** (poza planem polish) — manualnie
  działa, ale brak automatycznego Playwright e2e dla ścieżki uploadu
  cover‑a. Playwright e2e wymaga realnego buildu / `npm install` na
  VPS (poza sandboxem).
- **OpenAIKeyCard test drift** (poza planem polish) — test
  `OpenAIKeyCard.helpers.spec.ts::classifySaveError` sprawdza ścieżkę
  `/etc/agata.env`, ale helper zwraca `/etc/app.env`. Pre-existing
  na branchu, potwierdzone `git stash`, czeka na decyzję operatora.

### Polish pass extras (2026-06-30, on `chore/hiveosagent-mirror`)

Beyond the polish plan's 12 numbered tasks, the following features
were implemented in the same session:

- **§5 Manual cover override** (`books.manual_cover_url` + `manual_cover_set_at`)
  — user uploads a cover image via EditBookModal; it survives the
  next `upsertBook` because the upsert's `onConflictDoUpdate` set
  intentionally excludes manual-cover columns. New "Przywróć okładkę
  z API" button in EditBookModal when a manual cover is set.
- **§9 review_cache + provider_sources** — `drizzle/0006_review_cache.sql`
  - repo helpers + `/api/books/:id/social-proof` now replays a fresh
    cache row instead of calling upstream every time. TTL configurable
    via `BOOK_PROVIDER_CACHE_TTL_DAYS` env (default 7 days). 23 new tests
    across 4 spec files pin the cache invariants.
- **Gigi book linking** — `chat_sessions.book_id` + `chat_messages.book_id`
  (denormalised) via `drizzle/0004_gigi_book_linking.sql`. Book detail
  page now has a "Zapytaj Gigi o tę książkę" button + previous-chats
  list. FK ON DELETE SET NULL keeps chats when the book is removed.

Final tally (sandbox): **695/696 unit tests pass** (1 pre-existing
unrelated fail in `OpenAIKeyCard.helpers.spec.ts`). `npm install`
and Playwright e2e require the VPS.

### Po deployu na VPS

```bash
cd <APP_HOME>/agata-s-cozy-corner
npm install && npm run build && npm test
# spodziewane: 695/696 + (e2e Playwright) testy zielone, prettier + eslint czyste.
# Apply migrations (now includes 0006_review_cache.sql):
npm run db:migrate
# Optional: tune the social-proof cache TTL (default 7 days)
echo 'BOOK_PROVIDER_CACHE_TTL_DAYS=14' | sudo tee -a /etc/agata.env
# Optional: enable remaining providers
echo 'NYT_API_KEY=...' | sudo tee -a /etc/agata.env
echo 'LIBRARYTHING_TOKEN=...' | sudo tee -a /etc/agata.env
sudo systemctl restart agata
```
