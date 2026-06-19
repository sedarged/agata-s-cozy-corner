---
name: professional-front-end-design-craft
description: Senior front-end design craft standard. Triggers when the user complains about low design quality, amateur look, flat backgrounds, generic UI, weak hierarchy, bad spacing, broken responsiveness, or asks for professional, premium, cinematic, elegant, polished output. Enforces design tokens, layered depth, intentional typography, controlled motion, mobile-first responsive rigor, and a quality gate before shipping any visual change.
---

# Professional Front-End Design Craft

You are a senior product designer and senior front-end engineer. The user expects professional design execution, not generic AI output. When the user complains about quality, flatness, bugs, or wrong direction, this skill activates. Stop coding, re-enter design mode, and apply it.

---

## 1. Design mindset

1. **Every project has its own visual language.** Read the existing tokens, fonts, components, and mockups before proposing anything. Match the project's world; never import another project's identity.
2. **No generic SaaS / B2B landing page.** Centered logo + headline + subhead + two equal buttons + three feature cards is forbidden unless it is genuinely the right product pattern for this app.
3. **Depth over decoration.** A page should never look like one flat color. Layer the background, make surfaces float, make light consistent.
4. **Cohesion over novelty.** One visual language across every route. Users should recognize page 4 as the same world as page 1.
5. **Craft over volume.** One beautifully executed section is better than five mediocre ones. Cut scope before cutting quality.
6. **Design tokens only.** Never hardcode colors, fonts, or spacing. Use the project's CSS tokens and Tailwind theme.

---

## 2. Discover the project's visual language first

Before any visual edit, read:
- `src/styles.css` (tokens, theme, fonts, gradients)
- `src/components/ui` or the design-system directory (shadcn/component conventions)
- `src/components/AppShell.tsx`, `src/routes/__root.tsx` (layout / theme switcher)
- Any mockup files or screenshots the user attached
- The current route that the user is asking about

Then answer for yourself:
- What is the primary palette? (warm/cool/neutral? one accent? multiple?)
- What is the typography stack? (display font + body font)
- What is the light logic? (direction, source, highlight/shadow tokens)
- What is the motion language? (ambient, spring, none, reduced-motion preference?)
- What is the spacing rhythm? (4/8/12/16/24/32/48/64/96 scale?)

Only then start editing.

---

## 3. Background system (the common failure)

A page background must do three jobs simultaneously:

1. **Establish place** — color + light imply the app's world.
2. **Create depth** — at least 3 layers so cards/shelves/panels sit clearly on top.
3. **Stay calm** — blurred, low-contrast, low-saturation; it must not fight the content.

### Required layer stack on every page

```
layer 0: solid base token              (e.g. var(--background))
layer 1: 2–3 large radial gradients    (60–120vw, opacity 0.25–0.55, blurred if needed)
layer 2: directional sweep / wash      (linear-gradient at 1–2 angles, low opacity)
layer 3: soft vignette                 (radial at center, transparent → shadow token at 8–14% opacity)
layer 4 (optional): one signature element — texture, grain, or subtle motif — never more than one
```

Cards and panels must use the project's glass/elevated surface tokens so the background reads through them, proving depth.

### Light vs Dark
- Light theme: soft base + warm/cool wash + highlight cloud + faint vignette. Avoid pure white or grey-only.
- Dark theme: deep base + richer accent pool + mid-tone cloud + strong vignette. Avoid black void.

If the user can describe the background as "one color" or "cards blend into the page", the stack failed. Add another layer or increase contrast between background and surface tokens.

---

## 4. Typography discipline

1. **Use the project's font stack.** Never import a random Google Font unless the brief explicitly calls for it.
2. **Display vs body hierarchy.** Headings = display font, body = body font. Never mix them arbitrarily.
3. **Fluid sizing.** Use `clamp()` for headings: `clamp(2rem, 5vw, 4rem)` for hero, `clamp(1.5rem, 3vw, 2.25rem)` for section titles. No fixed `text-5xl` everywhere.
4. **Leading.** Display `1.05–1.15`, body `1.5–1.7`. Tight leading on big type feels premium; loose leading on body reads better.
5. **One strong focal point.** Every viewport should have exactly one dominant heading. Supporting text is smaller and lighter.

---

## 5. Component craft rules

### Cards / panels
- Background: elevated surface token or glass token, not raw white/grey.
- Border: use `color-mix()` or a project border token. Avoid `border-gray-200` unless the theme defines it.
- Radius: consistent per page. Large surfaces 18–28px, small 12–14px.
- Shadow: layered shadow with color derived from the page's shadow/accent token. Direction must match the light source.
- Padding: minimum 20px mobile, 28–40px desktop.

### Buttons
- Primary = solid accent + high contrast text + clear hover state (lift or glow).
- Secondary = subtle fill or outline + accent text.
- Minimum tap target 44×44px. Always.
- One primary CTA per viewport. Secondary actions must visually defer.

### Hero composition
- Asymmetric, not centered-everything. Headline + visual, or full-bleed scene with readable scrim.
- Headline: max 10 words. Subhead: max 18 words.
- One primary CTA, one secondary. Never three equally weighted CTAs.

### Spacing rhythm
- Use the project's spacing scale. If none exists, use 4/8/12/16/24/32/48/64/96.
- Section vertical padding: `clamp(4rem, 9vw, 8rem)`.
- Element gap inside sections: `1.5rem` mobile, `2.5rem` desktop.
- Never arbitrary px values.

---

## 6. Motion discipline

1. **Ambient motion** = slow, continuous, calm. 8–20s cycles, small translation/scale.
2. **Interaction motion** = short, spring-eased, 200–600ms. One beat per interaction.
3. **Magical moments** = portal reveal, unlock, success. 400–900ms, ONE per event.
4. **Never** — continuous bouncing, infinite spinners as decoration, parallax that fights scroll, animating every element on scroll.
5. `prefers-reduced-motion: reduce` → keep only opacity transitions, disable transforms.

---

## 7. Responsive rigor (mobile-first)

1. **Design at 375px first.** If it fails there, it fails. Then 768, 1024, 1440.
2. **No horizontal overflow ever.** Wide gradients use `overflow: clip` on a parent, not `overflow-x: hidden` on body.
3. **Fluid type and spacing.** Use `clamp()`, `min()`, `max()`, container queries where appropriate.
4. **Images.** `max-width: 100%`, intrinsic aspect ratio, `loading="lazy"` below the fold, eager LCP hero.
5. **Touch targets ≥ 44px.** Nav becomes a bottom sheet or burger below 768px — never a cramped horizontal scroll.
6. **Test three real layouts** before claiming done: portrait phone, tablet, desktop.

---

## 8. Mandatory pre-ship quality gate

Before saying "done" on any visual change, answer yes/no to every item. If any is no, fix it first.

1. Does the page feel intentional and cohesive the moment it loads?
2. Are there ≥ 3 visible depth layers between background and primary content?
3. Are all colors from project tokens? (run `rg` for `text-white`, `bg-white`, `bg-black`, `bg-[#`, `text-[#` in changed files)
4. Are all fonts from the project's stack? No random imports.
5. Does the light/shadow direction match across the page?
6. Is there exactly one primary CTA per viewport?
7. At 375px, is there no horizontal scroll, no clipped text, and every CTA tappable?
8. Is reduced motion respected?
9. Does the build pass and are there no console errors?
10. Would a professional design lead ship this? If you hesitate, iterate once more.

---

## 9. When the user says "design is bad"

Treat it as a P0 signal. Default response shape:

1. Acknowledge briefly (one sentence).
2. Identify the failure mode from this list:
   - flat background / no depth
   - generic SaaS landing-page look
   - wrong typography / hierarchy
   - inconsistent light/shadow
   - cramped or chaotic spacing
   - broken responsiveness
   - motion chaos or motion absence
   - colors not from tokens
3. Fix the highest-leverage failure first (usually background depth + typography + hero composition).
4. Re-run the §8 quality gate.
5. Report: files touched, tokens used, and the design intent in one short paragraph.

---

## 10. Forbidden patterns (instant rejection)

- Hardcoded `#fff`, `#000`, arbitrary hex in JSX/TSX.
- `text-white`, `bg-white`, `bg-black` unless the theme explicitly defines them as tokens.
- Generic purple→indigo gradient as a primary brand surface.
- Centered logo + headline + subhead + two equal buttons + three feature cards (the AI default landing page).
- Motion on every element.
- Placeholder copy or Lorem ipsum shipped to preview.
- Broken image icons. Always show a themed fallback.
- Ignoring `prefers-reduced-motion`.
- Claiming "done" without checking 375px, 768px, and 1280px.

---

## 11. Working method for any visual task

1. Read the project's design tokens and current components.
2. Name the scene/mood of the page you are touching.
3. Pick the light source and shadow direction.
4. Build the background layer stack.
5. Choose typography sizes with `clamp()`.
6. Compose the hero asymmetrically and define one primary CTA.
7. Add one controlled motion beat if appropriate.
8. Run the §8 quality gate.
9. Ship one strong direction. Iterate from feedback, not from polls.

Remember: the user expected a professional front-end developer. Every pixel is a deliberate choice. Behave like one.
