# Ambient Background — Reference Match Pass

The current background reads as flat brown/taupe (light) and warm cocoa (dark). The mockups show a different mood:

- **Light mockup**: warm marble / silk drape — peachy cream with soft folds of light highlight and shadow, very subtle, almost photographic. No greige/taupe anchor.
- **Dark mockup**: deep burgundy/plum nebula — wine red mixed with aubergine and near-black, with soft hazy nebula clouds. Not cocoa/bronze.

This is a token-only adjustment to `src/styles.css`. No layout, route, component, or logic changes. Static background, no animation, no noise texture.

## Light theme — "warm silk / marble"

Re-tune the ambient layer toward a pale peach-cream silk with very soft drape highlights:

- `--bg`: `#f3e6d4` (warmer pearl cream, slightly less yellow than now)
- `--bg-soft`: `#f7ecdb`
- `--bg-deep`: `#e4cdb0` (kept only as a faint corner anchor, no longer dominating)
- Remove the heavy `--bg-taupe` bottom-right anchor that currently creates the brown band.
- Replace it with two diagonal **silk-drape highlights** (very low-contrast white-cream gradients running at ~120deg and ~60deg) and one **soft peach blush** mid-left.
- Vignette: softer, lower opacity (`12%` instead of `28%`), so the edges no longer feel boxed.
- `::before` pearl haze: keep, but pull highlight positions to upper-left + lower-right to mimic light hitting a silk fold.

Net effect: panels (currently `rgba(255, 250, 243, 0.58)`) read as crisp white-ivory cards floating over a peach-cream silk wash. Distinctly different from cards, but not muddy.

## Dark theme — "burgundy nebula"

Replace cocoa/bronze tokens with burgundy/plum/aubergine:

- `--bg`: `#1a0a14` (deep wine-near-black)
- `--bg-soft`: `#241019`
- `--bg-deep`: `#0b0408`
- `--bg-plum`: `#2a0f26` (keep, slightly deeper)
- New `--bg-burgundy`: `#3a0f1f`
- Drop `--bg-cocoa` from ambient use (still defined for any existing reference, but no longer in the gradient stack).

Ambient gradient stack:

1. Soft burgundy/wine wash top-center (replaces amber glow).
2. Deep aubergine pool top-right.
3. Muted plum cloud mid-left (replaces bronze).
4. Warm dusty-rose haze center-bottom at very low opacity (replaces cocoa pool).
5. Cinematic near-black vignette bottom-right.
6. Espresso base wash → near-black corners.

`::before` haze: shift to wine/plum/dusty-rose, blur 90px, opacity 0.55 so it reads as nebula-soft.

Champagne/gold accent tokens (`--champagne`, `--accent-gold`) stay unchanged — the gold text/borders on panels still need to pop against the wine bg the same way they pop in the reference.

## Acceptance

- Light: page reads as warm peach-cream silk; cards sit clearly on top as crisper ivory glass.
- Dark: page reads as deep burgundy/plum nebula (matches reference); cards still read as warm cocoa glass with gold edges.
- No horizontal overflow. No animation added. Tokens only; AppShell unchanged.
- `npm run build` + `tsc --noEmit` clean.

## Files

- `src/styles.css` — only the `:root` and `.dark` `--bg-*` tokens and the `.ambient-bg` / `.ambient-bg::before` / `.dark .ambient-bg` / `.dark .ambient-bg::before` gradient stacks.

## Risks

- Burgundy is more saturated than cocoa; if any panel uses `color-mix` against `--bg` for tinting, it could pick up red. Will spot-check the glass tokens (`--glass`, `--glass-strong`) — those use fixed `rgba`, not `--bg`, so they're safe.
- Light silk highlights must stay low-opacity (≤0.35) or they'll look like reflections instead of fabric.
