# Agata na VPS — instalacja, uruchomienie i praca z Claude CLI

Kompletny przewodnik: jak postawić Agatę na własnym VPS, uruchomić ją na stałe
za HTTPS i dalej rozwijać aplikację bezpośrednio na serwerze przez **Claude CLI**.

Polecenia są w terminalu (`$` = zwykły użytkownik, `#` = root/sudo). Dostosuj
ścieżki, nazwę użytkownika i domenę do swojego serwera.

---

## 0. Co warto wiedzieć zanim zaczniesz

- **Dane są w przeglądarce.** Książki, notatki, pismo odręczne, sesje czytania
  i ustawienia trzymane są w `localStorage` **Twojej przeglądarki**, nie na
  serwerze. Serwer jest dziś bezstanowy — serwuje tylko aplikację i dwa API
  (wyszukiwanie książek + Gigi). Wniosek: kopię zapasową robisz **w aplikacji**
  (Ustawienia → Kopia zapasowa → „Pobierz kopię"), a serwer możesz odtworzyć w
  każdej chwili z gita. Baza SQLite na serwerze to dopiero plan (patrz
  [`local-database-plan.md`](./local-database-plan.md)).
- **Wszystkie zmienne środowiskowe są opcjonalne.** Bez żadnego klucza aplikacja
  działa w pełni; Gigi pokazuje wtedy „nie skonfigurowana".
- **To aplikacja prywatna.** Nie ma logowania w samej aplikacji — dostęp
  ograniczasz na poziomie sieci (Tailscale i/lub Caddy basic-auth, patrz §6).

---

## 1. Wymagania

- VPS z Linuksem (przykłady dla **Ubuntu/Debian**).
- **Node.js 20+** (rekomendowany **22**) i `npm`.
- `git`.
- (Produkcyjnie) **Caddy** na HTTPS oraz opcjonalnie **Tailscale** na dostęp prywatny.

---

## 2. Instalacja Node.js

Wariant A — pakiet systemowy (NodeSource, Node 22):

```bash
# Debian/Ubuntu
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git
node -v && npm -v
```

Wariant B — przez `nvm` (bez sudo, łatwe wersjonowanie):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# otwórz nową powłokę albo: source ~/.nvm/nvm.sh
nvm install 22
nvm use 22
```

> Jeśli używasz `nvm`, zapamiętaj pełną ścieżkę do node (`which node`) — przyda
> się w pliku systemd (§5).

---

## 3. Pobranie kodu

```bash
sudo mkdir -p /opt/agata && sudo chown "$USER" /opt/agata
cd /opt/agata
git clone https://github.com/sedarged/agata-s-cozy-corner.git
cd agata-s-cozy-corner

# Gałąź z bieżącą pracą (połączona w PR-ach do main):
git checkout claude/agata-reading-app-oe9u3u
# (Po scaleniu do main wystarczy zostać na main.)
```

---

## 4. Konfiguracja i build (jednym skryptem)

```bash
cp .env.example .env      # opcjonalnie uzupełnij klucze Gigi (patrz §7)
./scripts/vps-setup.sh    # npm ci + npm run build (idempotentny)
```

Skrypt sprawdza wersję Node, instaluje zależności i buduje serwer do
`.output/server/index.mjs`. Po buildzie `.output` jest samowystarczalne —
do uruchomienia **nie** potrzeba już `node_modules`.

Szybki test (Ctrl+C kończy):

```bash
PORT=3000 node .output/server/index.mjs
# albo: ./scripts/vps-setup.sh --run
```

Otwórz `http://ADRES_VPS:3000`. Jeśli widać stronę główną Agaty — działa.
Do uruchomienia „na stałe" przejdź do §5.

---

## 5. Uruchomienie na stałe (systemd)

Serwis auto-startuje aplikację i restartuje ją po awarii/reboocie.

```bash
# (zalecane) dedykowany użytkownik bez logowania
sudo useradd -rm -d /opt/agata -s /usr/sbin/nologin agata || true
sudo chown -R agata /opt/agata

# sekrety/konfiguracja POZA repo:
sudo cp .env.example /etc/agata.env
sudo nano /etc/agata.env          # ustaw PORT/HOST i ewentualnie klucze Gigi
sudo chmod 600 /etc/agata.env

# unit systemd:
sudo cp deploy/agata.service /etc/systemd/system/agata.service
sudo nano /etc/systemd/system/agata.service   # popraw User, WorkingDirectory, ExecStart (which node)

sudo systemctl daemon-reload
sudo systemctl enable --now agata
systemctl status agata
journalctl -u agata -f            # podgląd logów na żywo
```

W `/etc/agata.env` na produkcji ustaw zwykle `HOST=127.0.0.1` (serwer słucha
lokalnie, a na świat wystawia go Caddy).

---

## 6. HTTPS i dostęp (Caddy [+ Tailscale])

### Caddy (publiczna domena, automatyczny certyfikat)

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy

sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile     # wpisz swoją domenę (rekord A/AAAA → VPS)
sudo systemctl reload caddy
```

Wejdź na `https://twoja-domena` — Caddy sam załatwi certyfikat Let's Encrypt.

### Dostęp prywatny (rekomendowane dla aplikacji prywatnej)

- **Tailscale**: zainstaluj (`curl -fsSL https://tailscale.com/install.sh | sh`,
  potem `sudo tailscale up`), a w `Caddyfile` użyj wariantu `*.ts.net` (jest w
  pliku jako komentarz). Aplikacja będzie widoczna tylko w Twojej sieci tailnet,
  z poprawnym TLS i bez wystawiania na publiczny internet.
- **Basic-auth**: alternatywnie dodaj `basic_auth` w `Caddyfile`
  (hash z `caddy hash-password`).

---

## 7. Gigi (asystent AI) — opcjonalnie

Aplikacja działa bez tego. Aby włączyć Gigi, w `/etc/agata.env` ustaw **jedno** z:

```
OPENAI_API_KEY=sk-...     # główny provider, model gpt-5.4-mini (domyślny)
LOVABLE_API_KEY=...        # zapasowy (gateway Lovable), gdy brak OPENAI
AGATA_SECRETS_KEY=...      # AES-256 (openssl rand -base64 32) — wymagany,
                           # żeby paste-on-page klucz z Ustawień działał
GIGI_SECRET=...            # opcjonalnie: wymaga nagłówka X-Gigi-Key do /api/chat
```

Alternatywa: klucz OpenAI można też wkleić w Ustawieniach → „Prywatność i
dostęp Gigi" (szyfrowany AES-256-GCM, klucz z `AGATA_SECRETS_KEY`). Bez
`OPENAI_API_KEY` w env `buildGigiModel` automatycznie użyje klucza z bazy.

Po zmianie: `sudo systemctl restart agata`.

---

## 8. Aktualizacja / ponowny deploy

```bash
cd /opt/agata/agata-s-cozy-corner
git pull
./scripts/vps-setup.sh            # ponowny npm ci + build
sudo systemctl restart agata
```

---

## 9. Praca z Claude CLI na VPS (rozwijanie aplikacji)

Możesz dalej rozwijać Agatę bezpośrednio na serwerze, rozmawiając z Claude w repo.

### Uruchomienie

Jeśli masz już Claude CLI, pomiń instalację. (Tylko gdyby brakowało:
`npm install -g @anthropic-ai/claude-code`.)

### Pierwsze uruchomienie (logowanie)

```bash
cd /opt/agata/agata-s-cozy-corner
claude
```

Przy pierwszym starcie Claude poprosi o zalogowanie (konto Anthropic /
subskrypcja albo klucz API — postępuj zgodnie z instrukcją na ekranie).
Repo zawiera już **`CLAUDE.md`** oraz katalog **`docs/`**, więc Claude od razu
ma pełny kontekst projektu, konwencje i roadmapę.

### Jak używać (przykładowe polecenia w sesji)

```
> zbuduj projekt i napraw ewentualne błędy        (npm run build)
> dokończ Fazę 2 z roadmapy: SQLite (Drizzle + better-sqlite3) wg docs/local-database-plan.md
> dodaj endpoint /api/db-health i pokaż status w Ustawieniach
> zweryfikuj mapowanie pól Biblioteki Narodowej zapytaniem "Wiedźmin" i popraw, jeśli trzeba
```

Wskazówki:

- Pracuj na gałęzi roboczej, nie na `main` (Claude i tak trzyma się gałęzi z `CLAUDE.md`).
- Po zmianach: `git pull` na serwerze produkcyjnym + `./scripts/vps-setup.sh` +
  `sudo systemctl restart agata`. Najwygodniej trzymać osobny katalog do
  developmentu i osobny do produkcji, albo deployować przez `git pull` po scaleniu PR-a.
- Klucz API/sekrety trzymaj w `/etc/agata.env`, nie w repo.

---

## 10. Weryfikacja po wdrożeniu (skrót QA)

- [ ] Strona główna otwiera się (sekcje: Moja biblioteka, Ulubione, Statystyki, Polecane, W kolejce).
- [ ] Dodanie książki ręcznie → otwiera się jej strona, jest w Bibliotece.
- [ ] Wyszukiwarka książek zwraca wyniki (np. „Lalka", „Wiedźmin") — **wymaga
      wyjścia na świat** do Google Books / Open Library / data.bn.org.pl.
- [ ] Notatka odręczna: rysowanie, zapis, ponowne otwarcie z atramentem.
- [ ] Sesja czytania aktualizuje postęp i statystyki.
- [ ] Kopia zapasowa: eksport → import odtwarza dane.
- [ ] Fonty ładują się lokalnie (premium typografia widoczna, brak żądań do fonts.googleapis.com).

---

## 11. Najczęstsze problemy

| Objaw                               | Przyczyna / rozwiązanie                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- |
| `node: command not found` w systemd | Wpisz pełną ścieżkę z `which node` w `ExecStart=` (szczególnie przy `nvm`).                    |
| Port zajęty                         | Zmień `PORT` w `/etc/agata.env` i `reverse_proxy` w `Caddyfile`, potem restart obu usług.      |
| Wyszukiwarka książek zwraca pusto   | Brak wyjścia na świat / limit Google Books. Open Library i BN muszą być osiągalne z VPS.       |
| Gigi: „nie skonfigurowana"          | Ustaw `OPENAI_API_KEY` (lub `LOVABLE_API_KEY`) w `/etc/agata.env` i `systemctl restart agata`. |
| Brak HTTPS                          | Domena musi wskazywać (A/AAAA) na VPS; sprawdź `journalctl -u caddy -f`.                       |
| Build pada na pamięci               | Daj VPS-owi ≥1 GB RAM lub swap; build Vite bywa pamięciożerny.                                 |

---

## 12. Mapa plików wdrożeniowych w repo

- `.env.example` — szablon zmiennych (skopiuj do `.env` / `/etc/agata.env`).
- `scripts/vps-setup.sh` — instalacja zależności + build (`--run` uruchamia serwer).
- `deploy/agata.service` — szablon usługi systemd.
- `deploy/Caddyfile` — szablon reverse proxy (public / Tailscale / basic-auth).
- `CLAUDE.md`, `docs/` — kontekst i konwencje dla Claude CLI.
