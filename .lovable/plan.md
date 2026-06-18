Premium glass polish pass for the home screen in both light and dark mode. Same content, same routes — only visual execution.

## Diagnosis

Current panels read as flat tinted rectangles, not glass:
- Backgrounds use `--glass` over an ambient background that has very little contrast → blur has nothing to refract, so the "glass" disappears.
- Borders are single flat 1px lines without the dual highlight/shadow edge a real glass pane has.
- Inset highlights are too subtle and only on top; no bottom shadow line, no edge sheen, no specular streak.
- Shelf, panels, cards, drawer and topbar each have their own slightly different recipe → no unified glass language.
- Dark mode panels collapse to near-flat brown because `--glass` alpha is too high and there's no champagne rim light.

## Fix — one unified glass recipe

Define a single glass token set used by every surface (topbar, title pill, section title, section panel, inline card, reco card, gigi panel, stats chart, stat box, CTA row, drawer, plus button, mini button):

```
background:
  linear-gradient(180deg, var(--glass-top), var(--glass-bottom));
border: 1px solid var(--glass-edge);
box-shadow:
  inset 0 1px 0 var(--glass-highlight),         /* top sheen */
  inset 0 -1px 0 var(--glass-shadowline),       /* bottom inner shadow */
  inset 0 0 0 1px var(--glass-inner-ring),      /* faint inner ring */
  0 1px 0 var(--glass-outer-highlight),         /* outer top hairline */
  0 18px 50px -22px var(--glass-drop);          /* soft drop */
backdrop-filter: blur(30px) saturate(170%);
```

Tokens (light):
- glass-top `rgba(255,250,243,0.72)`
- glass-bottom `rgba(255,245,230,0.42)`
- glass-edge `rgba(255,255,255,0.85)`
- glass-highlight `rgba(255,255,255,0.95)`
- glass-shadowline `rgba(140,100,60,0.10)`
- glass-inner-ring `rgba(201,168,106,0.14)`
- glass-outer-highlight `rgba(255,255,255,0.6)`
- glass-drop `rgba(110,80,50,0.22)`

Tokens (dark):
- glass-top `rgba(58,42,28,0.62)`
- glass-bottom `rgba(28,20,14,0.48)`
- glass-edge `rgba(210,170,108,0.40)`
- glass-highlight `rgba(255,225,170,0.18)`
- glass-shadowline `rgba(0,0,0,0.55)`
- glass-inner-ring `rgba(210,170,108,0.10)`
- glass-outer-highlight `rgba(210,170,108,0.18)`
- glass-drop `rgba(0,0,0,0.55)`

Add a diagonal specular sheen on larger surfaces (section panel, shelf, drawer) via a `::before` overlay:
```
background: linear-gradient(118deg,
  transparent 0%,
  rgba(255,255,255,0.18) 26%,
  transparent 42%);
mix-blend-mode: screen; opacity: .55;
```
Dark uses champagne tint instead of white, lower opacity (.18 → .12).

## Ambient backdrop boost (so blur has something to refract)

Make ambient layers more present so glass actually shows:
- Stronger radial bloom at top-left (champagne) and top-right (cream) — raise color-mix percentages ~10pp.
- Add a third bloom at 50% / 50% in muted gold for mid-page warmth.
- Slightly brighter diagonal streak.
- Dark: add a top-center champagne halo so panels at the top get rim-lit.

## Edge polish

- Title pills + section title bars: add a 1px champagne hairline inside the top edge (champagne 30%) for a "gilded rim".
- Plus button: keep current treatment but raise outer glow to `0 0 36px rgba(201,168,106,.55)` and add a faint white specular at 28% / 22%.
- Book covers: lift `book-shadow` second layer to `0 16px 30px -10px rgba(40,20,5,.5)` and add a faint right-edge highlight (`inset -1px 0 0 rgba(255,255,255,.18)`) for a printed-page feel.
- Snap rows: increase peek to ~36px so the next card edge is unmistakable, not clipped.

## Drawer parity

Drawer adopts identical glass recipe + diagonal sheen so the mobile menu matches the home surfaces (currently slightly heavier and less translucent).

## Files

- `src/styles.css` — token rewrite (glass-*), unified `.agata-*` rule, `::before` sheen utility class `.agata-sheen`, ambient bloom tweak, plus/cover shadow tweak.
- `src/routes/index.tsx` — add `agata-sheen` class on `.agata-section-panel`, shelf, title pill (no structural change).
- `src/components/AppShell.tsx` — add `agata-sheen` on drawer panel and topbar (no structural change).

Out of scope: routes, backend, content, header/drawer structure, bottom nav, other pages, new deps.

## Verification

- Light @ 390px, 440px, 1024px — panels show frosted refraction over ambient blooms, gilded rim on pills, diagonal sheen visible on shelf and section panels.
- Dark @ 390px, 1024px — espresso panels show champagne rim + soft inner light, not flat brown blocks.
- Plus button reads as glassy gold, attached to shelf.
- Build passes.