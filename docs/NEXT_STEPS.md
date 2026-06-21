# Agata — następne kroki dla Claude (jedno miejsce)

Ten plik to gotowe brief‑y do realizacji przez **Claude CLI** na VPS. Idź po kolei:
**Krok 0 (postawienie)** → **Faza 1 (dane na VPS / SQLite)** → **Faza 2 (Gigi przez OAuth ChatGPT)**.

Jak używać: odpal Claude CLI w katalogu repo, a potem wklejaj kolejne prompty z
tego pliku (albo po prostu powiedz: *„zrealizuj `docs/NEXT_STEPS.md` Fazę 1"*).
Repo zawiera `CLAUDE.md` + `docs/`, więc Claude ma pełny kontekst.

```bash
cd /opt/agata/agata-s-cozy-corner
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
sudo mkdir -p /opt/agata && sudo chown "$USER" /opt/agata && cd /opt/agata
git clone https://github.com/sedarged/agata-s-cozy-corner.git
cd agata-s-cozy-corner
git checkout claude/agata-reading-app-oe9u3u   # albo main po scaleniu PR-ów

# Build + szybki test (Ctrl+C kończy)
./scripts/vps-setup.sh --run                   # otwórz http://ADRES_VPS:3000
```

Jeśli widać stronę główną — działa. Teraz odpal Claude (`claude`) i wklej prompt 0b.

### 0b. Prompt do Claude — uruchomienie produkcyjne (systemd + HTTPS)

> Postaw Agatę produkcyjnie na tym VPS zgodnie z `docs/VPS_DEPLOY.md`:
> 1. Zbuduj projekt (`./scripts/vps-setup.sh`) i potwierdź, że powstaje `.output/server/index.mjs`.
> 2. Skonfiguruj usługę **systemd** z `deploy/agata.service` (popraw `User`, `WorkingDirectory`, ścieżkę node z `which node`), sekrety w `/etc/agata.env` (z `.env.example`). Włącz i uruchom usługę, pokaż `systemctl status agata`.
> 3. Skonfiguruj **Caddy** z `deploy/Caddyfile` na HTTPS — zapytaj mnie o domenę albo użyj wariantu Tailscale (`*.ts.net`). Reverse proxy na `127.0.0.1:3000`.
> 4. Zweryfikuj: aplikacja otwiera się po HTTPS, fonty ładują się lokalnie (brak żądań do fonts.googleapis.com), dodanie książki działa.
> Nie commituj żadnych sekretów. Na koniec wypisz adres, pod którym aplikacja jest dostępna.

> ⚠️ Zapamiętaj domenę/adres HTTPS — będzie potrzebny jako **redirect URL** w Fazie 2 (OAuth).

---

## Faza 1 — moje dane na VPS (SQLite, multi-device)

Cel: dane (książki, notatki, pismo, sesje) przestają żyć w `localStorage`
przeglądarki, a trafiają do jednej trwałej bazy SQLite na VPS, dostępnej z
każdego urządzenia. **Bez utraty** tego, co już masz.

### Prompt do Claude

> Zrealizuj „server-authoritative SQLite" zgodnie z `docs/local-database-plan.md`. Zakres:
> 1. Dodaj **Drizzle ORM + better-sqlite3** (better-sqlite3 jako natywna zależność, nie bundlowana w Nitro). Tabele: `books, notes, reading_sessions, goals, settings, assets` — odwzoruj kształty z `src/lib/mock-data.ts`. **Zachowaj istniejące id `local-…`** (kolumna text, nie zakładaj UUID). Bez kolumn `user_id`/RLS (jeden właściciel). Migracje przez drizzle-kit.
> 2. Baza w `DATA_DIR` (domyślnie `/var/lib/agata/agata.db`), a okładki/pismo/zdjęcia jako **pliki** w `DATA_DIR/assets/` zamiast base64 w bazie. Dodaj endpoint `/api/db-health`. Dopisz `DATA_DIR` do `deploy/agata.service` i opisz utworzenie `/var/lib/agata` (z właściwymi prawami) w `docs/VPS_DEPLOY.md`.
> 3. **Serwerowe API CRUD** (`createServerFn` i/lub `/api/*`) walidowane **Zod**, dla books/notes/reading_sessions/goals/settings/assets.
> 4. **Przełącz klienta z localStorage na TanStack React Query.** Zachowaj semantykę „effective book" — status, postęp, ocena i ulubione muszą być spójne na Home, w Bibliotece, Statystykach i na szczegółach książki. Stary `localStorage` zostaje tylko jako źródło jednorazowego importu.
> 5. **Import bez utraty danych:** dodaj jednorazowy import mojego eksportu z aplikacji (Ustawienia → Kopia zapasowa → „Pobierz kopię" = JSON) do SQLite. Pokaż liczbę zaimportowanych książek/notatek/sesji do potwierdzenia. Import nie może nadpisywać po cichu.
> 6. Zweryfikuj `npm run build` i `npx tsc --noEmit`, oraz przejdź ręcznie: dodanie książki, notatka odręczna (zapis + ponowne otwarcie z atramentem), sesja czytania, statystyki, kopia zapasowa — wszystko z bazy. Commit + push na gałąź roboczą; zaktualizuj `CLAUDE.md` (oznacz Fazę 2/5 jako done).

### Po Fazie 1 (redeploy)

```bash
sudo mkdir -p /var/lib/agata && sudo chown agata /var/lib/agata
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
cd /opt/agata/agata-s-cozy-corner
git pull
./scripts/vps-setup.sh
sudo systemctl restart agata
```

## Status do odhaczenia

- [ ] Krok 0 — aplikacja działa po HTTPS (systemd + Caddy/Tailscale)
- [ ] Faza 1 — dane w SQLite na VPS, import bez utraty, klient na React Query
- [ ] Faza 2 — Gigi połączona przez OAuth ChatGPT (fallback: klucz API)
