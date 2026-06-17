
# Polish pass — match final mockups (refined)

Treat the attached light (cream glass) and dark (espresso/champagne) mockups as the visual source of truth. No backend, no route changes, no new deps. Home screen + shared shell only.

## 1. Ambient background (`src/styles.css`)

- **Light:** cream base `#f5ede2 → #ece2d3`, 3 low-opacity radial gradients (warm beige top-left, soft taupe right, faint blush bottom), one diagonal light streak (~6%), tiny SVG fabric-noise data-URL at opacity 0.04. No animation, no repeating motif.
- **Dark:** espresso `#1a120c → #0e0805` (never pure black), champagne radial glow top-center (≤8%), warm vignette bottom.
- New tokens: `--champagne: #c9a86a`, `--champagne-soft`, `--shelf-warmlight`, `--glass-light-bg`, `--glass-dark-bg`, `--glass-border-light`, `--glass-border-dark`.

## 2. Unified glass language (`src/styles.css`)

One coherent system reused by title pills, section panels, inline cards, drawer, theme toggle, plus button:

- `backdrop-filter: blur(28px) saturate(160%)` — standard property only (Lightning CSS prefixes).
- Light: `rgba(255,250,243,0.55)` bg, top border `rgba(255,255,255,0.7)` + bottom border `rgba(180,160,130,0.18)` via gradient border, `inset 0 1px 0 rgba(255,255,255,0.8)`, outer `0 12px 40px -12px rgba(120,90,60,0.18)`.
- Dark: `rgba(40,28,20,0.55)` bg, champagne border `rgba(201,168,106,0.28)`, `inset 0 1px 0 rgba(201,168,106,0.18)`, outer `0 16px 50px -10px rgba(0,0,0,0.55)`.
- Title pill (`.agata-title-pill`): full-rounded capsule, same recipe, gold ornamental glyphs (`˜⚜˜`) flanking the title via pseudo-elements.

## 3. Hero shelf — "Moja biblioteka" (`src/routes/index.tsx`)

- Title pill visually attached to top of shelf via `-translate-y-1/2`, shelf `rounded-3xl` with the pill overlapping its top edge.
- Taller shelf: covers ~190px mobile / ~220px sm / ~250px md+. Container `min-h-[260px] sm:min-h-[290px] md:min-h-[320px]`.
- Wood plank `.agata-shelf-plank`: warm cream/walnut gradient, 1px champagne top edge highlight, subtle wood-grain striping at low opacity, front-face shadow lip.
- **Warm under-cornice lamp:** pseudo `::before` inside shelf — radial gradient from top center, warm amber 22% light / 14% dark, fades down ~70% of shelf height.
- **Cover counts (horizontal snap scroll):**
  - 390/440px mobile: ~3 full covers + clear peek of next
  - 640–767px (sm): 4 covers
  - 768px+ (md/tablet): 5 covers
  - 1024px+ (desktop/iPad): 5+ covers
- Plus button: 56px circle, glass recipe, champagne border, gold "+" icon, soft glow `0 0 24px rgba(201,168,106,0.35)`. Absolutely positioned attached to right edge of shelf (`absolute right-3 top-1/2 -translate-y-1/2`). Links to `/add-book`.
- Cover taps → `/book/$id`.

## 4. Ulubione

- Horizontal `snap-x snap-mandatory`, `scroll-padding-inline: 16px`.
- Card `min-w-[260px]` mobile, `[280px]` sm+. First fully visible, second peeks ~24px.
- Glass inline card recipe; cover left, title/author/stars right, heart icon top-right.

## 5. Statystyki

- Two-column inside panel: chart (left ~55%) | 3 stat cells `grid-cols-3` (right). Each stat = small glass inline card.
- "Zobacz wszystkie statystyki →" as full-width glass pill at the bottom; links to `/statistics`.

## 6. Polecane

- Single glass panel: Gigi line-avatar + intro (~35% width) on the left, 2 recommendation cards on the right.
- Each rec card: cover, title, author, 4-star rating, small rounded glass "Zobacz" pill (champagne border) → `/book/$id`.
- Copy locked: "Polecane przez Gigi ♡" + "Książki dobrane specjalnie dla Ciebie, na podstawie Twoich preferencji."

## 7. W kolejce

- Same horizontal snap-scroll pattern as Ulubione.
- Each card: small cover, title, author, "📅 Planowana" row.
- Page container bottom padding: `padding-bottom: max(6rem, env(safe-area-inset-bottom) + 4rem)` so the last section never clips behind viewport / Safari bar / Lovable preview bar.
- Queue covers → `/book/$id`.

## 8. Header & drawer (`src/components/AppShell.tsx`)

**Header (clean, mockup-faithful):**
- Left: profile icon glass circle — this is the drawer trigger (no visible hamburger).
- Center: "Agata" in Parisienne + botanical SVG accent.
- Right: bell glass circle. On `md+` only, a small glass sun/moon toggle pill next to the bell. Mobile keeps the toggle drawer-only.

**Drawer redesign:** glass panel (same recipe), rounded on open edge, warm cream / espresso per theme, champagne hairline. Compact, gold Lucide icons, Cormorant section headers, Inter items. Sections (Polish-only):
- **Nawigacja:** Biblioteka, Notatki, Cytaty, Polecane, Statystyki, Gigi
- **Szybkie akcje:** Dodaj książkę, Dodaj cytat, Dodaj notatkę, Zdjęcie strony, Sesja czytania, Notes iPad
- **Ustawienia:** Motyw (inline sun/moon toggle row), Ustawienia

## 9. Theme toggle

- Inline sun/moon toggle in drawer "Motyw" row (always available).
- Additional small glass pill toggle in header at `md+` only.
- Persists via existing `theme-context` localStorage key.

## 10. Polish-only label audit

Sweep home + drawer + cards + buttons. Replacements:
- "Rekomendacje" → "Polecane"
- "Notes (iPad)" → "Notes iPad"
- Ensure: "Dodaj książkę", "Dodaj cytat", "Dodaj notatkę", "Zdjęcie strony", "Sesja czytania", "Zobacz", "Planowana", "Zobacz wszystkie statystyki" all present, no English fallback, no "prototype" placeholder text anywhere.

## 11. Cleanup

- Remove any remaining bottom-nav code paths from `AppShell.tsx`.
- Verify all interaction targets: profile→drawer, cover→`/book/$id`, plus→`/add-book`, stats CTA→`/statistics`, Polecane "Zobacz"→`/book/$id`, queue cards→`/book/$id`, theme toggle switches and persists across reload.

## Files touched

- `src/styles.css` — tokens, ambient bg, glass system, shelf, plus glow, drawer glass
- `src/routes/index.tsx` — shelf hero, snap rows, polecane layout, safe-area padding
- `src/components/AppShell.tsx` — drawer redesign, profile-as-trigger, header md+ toggle, label fixes
- `src/components/BookCover.tsx` — only if size props need adjustment
- (no new deps, no routes, no backend)

## Verification

`browser--view_preview` + `browser--screenshot` at:
- 390×844 light + dark
- 440×799 light + dark
- 768×1024 light + dark
- 1024×768 light + dark

Compare 440×799 light/dark screenshots directly to the two attached mockups. Confirm: shelf hero with depth + warm light, attached title pill, glowing plus button, glass cards translucent (not flat white/grey), drawer matches glass language, last section not clipped, no bottom nav, all labels Polish.
