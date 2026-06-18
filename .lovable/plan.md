Polish the Agata home only. No new plans, no scope expansion.

## Files
- `src/styles.css` — refine light/dark tokens, ambient bg, unified glass system (`.agata-section-panel`, `.agata-inline-card`, `.agata-title-pill`, `.agata-glass-button`, `.agata-bookshelf` + lip/back/floor, `.agata-plus-button`), hide horizontal scrollbars, `html/body/#root` overflow-x hidden, safe-bottom util.
- `src/routes/index.tsx` — keep section order (Moja biblioteka, Ulubione, Statystyki, Polecane, W kolejce). Rework bookshelf hero (title pill overlapping shelf, back panel + floor + front lip, warm top light, attached gold plus button, snap scroll showing 3 covers + peek on mobile). Compact Ulubione/W kolejce snap rows (~260px cards, peek next). Shorten Statystyki (chart ≤120px, glass pill CTA). Collapse Polecane into one compact glass panel with 2 cards + small "Zobacz" pills. Polish-only labels.
- `src/components/BookCover.tsx` — render real `coverUrl` image when present with realistic shadow/radius, gradient fallback only when missing.
- mock data — add `coverUrl` to entries missing it (Open Library covers).

## Visual system
- Light: cream #f5ede2 base, depth #ece2d3, text #4a3728, champagne #c9a86a, warm shadow rgba(110,80,50,.22).
- Dark: espresso #1a120c, depth #0e0805, text #ead6b8, gold #d2aa6c, bronze #8b6846.
- Glass: `backdrop-filter: blur(24px) saturate(150%)`, thin border, inset top highlight, soft outer shadow.
- Ambient: layered radial + diagonal streak, low contrast.

## Out of scope
Header/drawer structure, routes, backend, auth, other pages, dependencies, bottom nav.

## Checks
Build passes; visual check at 390/440/768 in both themes; no right-side strip; all existing links intact.