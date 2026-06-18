
# Plan: animacje wejścia + żywa półka + ożywione tło

Skupiamy się wyłącznie na stronie głównej (`/`) i ambient backgroundzie (dotyczy całej apki, ale wizualnie pracuje głównie na home). Reszta route'ów bez zmian. Brak nowych zależności — wszystko CSS + minimum JS.

## Trzy cele

1. Sekcje home wjeżdżają z gracją (staggered fade-in) zamiast pojawiać się statycznie.
2. Książki na półce żyją: tilt 3D na hover, parallax światła przy scrollu, „wyjmowanie z półki" przy kliknięciu, drobne pyłki.
3. Tło przestaje być jednolite — dwie warstwy żywych elementów: dryfujące orby/aurora + delikatne unoszące się cząsteczki/iskierki + bardzo lekki film grain w ruchu.

## 1. Staggered entrance na home

Pliki: `src/routes/index.tsx`, `src/styles.css`.

- Każda sekcja (`BookShelfPreview`, `FavouritesSection`, `StatsSection`, `RecommendationsSection`, `QueueSection`) dostaje klasę `agata-enter` z `animation-delay` (0 / 90 / 180 / 270 / 360 ms).
- Keyframe `agata-rise`: opacity 0→1, translateY 14px→0, blur 6px→0, 620 ms, `cubic-bezier(.22,.9,.3,1)`, `forwards`, `backwards`.
- Książki na półce: dodatkowo `agata-book-rise` z opóźnieniem `i * 70ms`, scale .94→1 + translateY 20px→0 (wsuwają się od dołu).
- Tytuł pill „Moja biblioteka": jednorazowy sheen-wipe po fade-in (3 s, ease-out, raz).
- Plus-button: scale 0→1 z lekkim overshoot `cubic-bezier(.34,1.56,.64,1)`, opóźnienie 540 ms.

## 2. Półka książek — fizyczna i żywa

Pliki: `src/styles.css`, lekko `src/routes/index.tsx`.

**Hover na książce:**
- Wrapper z `perspective: 800px`, `transform-origin: bottom center`.
- Hover: `translateY(-8px) rotateX(4deg) rotateY(-3deg) scale(1.04)`.
- Cień `::after` rośnie i przesuwa się pod książką (opacity + translateY).

**Klik:**
- `:active`: `translateY(-12px) scale(1.06)` w 120 ms — „wyjmowanie".

**Idle micro-life:**
- `agata-shelf-breathe` na półce (8 s alternate): scale 1.004, warmlight pulsuje 0.85↔1.
- 3 statyczne „pyłki" w półce z `agata-mote` keyframe (drift w górę 12 s).

**Parallax warmlight przy scrollu:**
- `useEffect` w `BookShelfPreview` z `passive scroll` + `requestAnimationFrame` na ref snap-row.
- Aktualizuje CSS custom property `--shelf-light-x` na półce (światło z góry przesuwa się po grzbietach).

## 3. Ożywione tło (kluczowy nowy element)

Pliki: `src/styles.css`, `src/components/AppShell.tsx`.

Trzy współpracujące warstwy:

**A. Aurora / dryfujące plamy światła (ulepszenie istniejących `.ambient-orbs`)**
- Teraz są dwie wolne plamy — dokładamy trzecią warstwę z innym tempem i kierunkiem ruchu, żeby tło nigdy nie wyglądało statycznie.
- Każda warstwa: inny rozmiar (60/55/45 vmax), inny czas (28 / 36 / 44 s), inny kierunek i path translate3d.
- W ciemnym motywie: champagne + głęboki burgund/espresso dla głębi; w jasnym: kremowo-złoty + bardzo bladoróżowy ciepły akcent.
- `mix-blend-mode: soft-light` w light, `screen` w dark — dodaje świetlistości bez bielenia.

**B. Unoszące się cząsteczki/iskierki (`<div className="ambient-particles">` w AppShell)**
- ~14 statycznych `::before/::after` + pseudo-elementy w 1 wrapperze, każde z innym `animation-delay`, `animation-duration` (18–34 s), pozycją startową.
- Keyframe `particle-float`: translateY(0 → -110vh), translateX driftem ±20 px (sinusoidalne via dwie nakładane animacje), opacity 0 → .6 → 0, scale .8 → 1.1.
- Bardzo małe (1–3 px), kolor `var(--champagne)` z `box-shadow: 0 0 6px var(--champagne)` — dają wrażenie kurzu książkowego unoszącego się w słońcu.
- Implementacja: 1 wrapper `position: fixed; inset: 0; pointer-events: none; z-index: 0;` + 14 dzieci `<i className="mote" style={{--i: n}} />` (CSS używa `--i` do generowania pozycji/opóźnienia bez JS).

**C. Subtelny ruchomy film grain**
- Istniejący `.ambient-bg::after` ma statyczny SVG noise — dorzucamy `animation: grain-shift 6s steps(8) infinite` (8 dyskretnych pozycji `background-position`), opacity 0.04–0.06.
- Daje efekt analogowego filmu, bez performance hit (tylko background-position).

**Performance / dostępność:**
- Wszystko czysto CSS, brak JS na cząsteczki, brak Canvas.
- Wrapper cząsteczek ma `will-change: transform` tylko na elementach `.mote` (nie na kontenerze).
- `@media (prefers-reduced-motion: reduce)`: ukrywa `.ambient-particles`, zatrzymuje grain-shift, zwalnia/pauzuje orby do statycznych pozycji.
- Mobile (≤640 px): redukcja liczby cząsteczek do 7 przez `nth-child` `display: none` na połowie.

## Pliki do edycji

- `src/routes/index.tsx` — klasy `agata-enter`, inline `animation-delay`, `useEffect` parallax warmlight, perspective na wrapperze książki.
- `src/components/AppShell.tsx` — dodanie `<div className="ambient-particles">` z 14 dziećmi obok istniejących `.ambient-bg` i `.ambient-orbs`.
- `src/styles.css` — keyframes (`agata-rise`, `agata-book-rise`, `agata-shelf-breathe`, `agata-mote`, `agata-title-sheen`, `particle-float`, `grain-shift`), trzecia warstwa orb, style `.ambient-particles .mote`, hover/active książek, reduced-motion guard.

## Co zostaje nietknięte

- Pozostałe route'y (`/library`, `/book/$id`, `/notes`, `/gigi`, `/statistics`, `/settings`, `/search`, `/add-book`).
- AppShell layout (drawer, topbar, sidebar) — dodajemy tylko wrapper cząsteczek.
- Logika, dane, routing, BookCover.

## Weryfikacja

- Mobile 375 px: brak horizontal scroll, animacje płynne, cząsteczki widoczne ale nie nachalne.
- Desktop: hover 3D na książkach, parallax światła, tło wyraźnie się rusza ale nie odciąga uwagi od treści.
- Reduced motion: statyczne tło bez cząsteczek i grain shift, sekcje pojawiają się bez fade.
- Kontrast tekstu na sekcjach niezmieniony (warstwy tła pod `z-index: 0`, content na `z-index: 10`).
