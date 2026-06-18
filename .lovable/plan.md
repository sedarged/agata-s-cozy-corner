# Premium Glass + Living Background Polish

Scope: `src/styles.css` only (tokens, utilities, keyframes) plus a single decorative `<div>` layer added to `src/components/AppShell.tsx` for the animated background. No route, content, structure, or logic changes.

## 1. Tiles — true raised frosted glass

Apply to `.agata-inline-card`, `.agata-reco-card`, `.agata-gigi-panel`, `.agata-stats-chart`, `.agata-stat-box`, `.agata-cta-row`, `.agata-mini-button`.

**Layered surface** (per tile, light + dark variants):
- Base: `linear-gradient(155deg, var(--glass-top) 0%, var(--glass-bottom) 100%)`
- `backdrop-filter: blur(22px) saturate(180%) brightness(1.04)` — stronger than parent panel so inner tiles re-refract
- Border: `1px solid transparent` with `background-clip: padding-box` + a second `border-image` gilded gradient (champagne 45% → transparent → champagne 25%) so the rim catches light asymmetrically
- Box-shadow stack (6 layers):
  1. `inset 0 1px 0 rgba(255,255,255,.95)` — top highlight (light) / `rgba(255,235,200,.18)` (dark)
  2. `inset 0 -1px 0 rgba(120,80,30,.18)` — bottom shadowline
  3. `inset 0 0 0 1px rgba(201,168,106,.22)` — gilded inner ring
  4. `inset 0 24px 40px -28px rgba(255,255,255,.7)` — internal glow dome
  5. `0 1px 0 rgba(255,255,255,.55)` — outer rim highlight (sits tile on surface)
  6. `0 20px 40px -22px rgba(40,20,5,.45), 0 6px 14px -10px rgba(40,20,5,.35)` — drop + contact shadow

**Specular sheen** — `::before` pseudo (pointer-events:none, mix-blend:screen):
- Diagonal gradient streak `from -20deg, transparent 35%, rgba(255,255,255,.55) 50%, transparent 65%`
- Static placement at ~30% width offset for a still highlight
- `::after` adds a soft top-left bloom `radial-gradient(120% 80% at 18% 0%, rgba(255,255,255,.35), transparent 55%)`

**Motion**:
- Sheen sweeps on hover: `@keyframes tile-sheen` translates the `::before` from `-60%` → `140%` over 1.4s ease-out, triggered by `:hover` / `:focus-visible`
- Tile lift on hover/active: `transform: translateY(-2px)` + shadow intensifies; press state `translateY(0)` with reduced shadow (tactile)
- Respect `@media (prefers-reduced-motion: reduce)` — disable sheen sweep and lift

**Dark mode tokens**:
- `--glass-top: rgba(72,52,34,.72)`, `--glass-bottom: rgba(28,20,14,.62)`
- Highlight `rgba(255,225,180,.22)`, gilded ring `rgba(201,168,106,.34)` (warmer, more visible)
- Sheen opacity reduced to `.28` so it reads as moonlight, not flash

## 2. Background — living ambient layer

New element in `AppShell.tsx`: `<div className="agata-ambient" aria-hidden />` placed once, fixed, behind all content (`z-index:-1`, `pointer-events:none`).

**Static depth** (in `.agata-ambient`):
- Base radial blooms (5): champagne top-left, cream top-right, muted-gold mid, espresso bottom-right, soft halo top-center
- Subtle noise texture via inline SVG `url(...)` data-URI at 4% opacity for grain (kills banding)
- Diagonal sheen streak across the whole viewport at 6% opacity

**Motion layer** — two pseudo-elements:
- `::before` — large soft champagne blob `radial-gradient(closest-side, rgba(201,168,106,.22), transparent 70%)`, 70vmax square, animated with `@keyframes drift-a` (32s, ease-in-out infinite alternate): translates between `(-10%,-5%)` and `(15%,10%)`, scales 1 ↔ 1.15
- `::after` — second cream blob, 55vmax, `@keyframes drift-b` (44s, opposite direction, scale 1.1 ↔ 0.95)
- Optional third faint blob on body in dark mode (deep amber) for warmth

**Performance**:
- `will-change: transform`, `transform: translate3d` to stay on GPU
- Animations paused under `prefers-reduced-motion`
- `contain: strict` on `.agata-ambient`

## 3. Verification

- Light @ 390/440px: tiles read as raised frosted glass, gilded rim visible, hover sweeps a clear sheen, background blobs slowly drift behind blooms
- Dark @ 390px: tiles glow with warm champagne rim, sheen reads as muted moonlight, background has subtle drifting warmth
- Reduced motion: no sweep, no drift, static frosted look intact
- Build passes

## Files

- `src/styles.css` — token additions, tile surface rewrite, sheen + lift keyframes, ambient layer + drift keyframes, reduced-motion guard
- `src/components/AppShell.tsx` — add single `<div className="agata-ambient" aria-hidden />` inside the shell root, before existing content

Out of scope: routes, content, header/drawer structure, bottom nav, components, deps.
