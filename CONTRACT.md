# PUTSOMESPECONIT — build contract

Shared spec for everyone working on this site. Read it fully before writing code.

## The product

**PUTSOMESPECONIT** is a residential real-estate operations dashboard. **Noah Salvador** is the
founder/principal agent whose brokerage it was built for. The landing page sells PUTSOMESPECONIT.

Voice: plain, confident, specific. Short sentences. No "revolutionize", no "seamless",
no "unlock". Never claim awards, press, partnerships, customer counts or testimonials —
none exist. Numbers shown inside the product UI are clearly a **demo workspace**.

## The concept

The whole page is one scene: a Victorian house at blue hour that **builds itself as you
scroll** — stakes → foundation → frame → sheathing → roof → siding + porch → lights on.
When the last light comes on, the **front door** is the only interactive object left.
Press it and the door swings open into the dashboard. Everything else on the page is
ordinary semantic content below that moment.

## Stack — fixed, do not change

- No build step. Single `index.html`, CDN ES modules via import map, pinned versions.
- `three@0.169.0`, `gsap@3.12.5` (+ ScrollTrigger), `lenis@1.1.13`.
- **Lenis is the one and only smooth-scroll engine.** Locomotive Scroll is forbidden.
- Vanilla DOM. No React, no JSX, no bundler, no Tailwind.
- Icons: **Solar** set via Iconify SVG API (`https://api.iconify.design/solar/<name>.svg?color=%23...`),
  inlined as `<svg>` or used as `background-image`/`<img>`. No other icon set.

## Files

```
site/
  index.html            — shell (owned by lead)
  css/tokens.css        — design tokens (owned by lead, READ ONLY for others)
  css/landing.css       — landing sections
  css/dashboard.css     — dashboard
  js/house.js           — three.js house (owned by lead)
  js/app.js             — lenis + gsap choreography, door → dashboard (owned by lead)
  js/dashboard.js       — dashboard module
  js/data.js            — demo data + asset manifest
  partials/*.html       — markup fragments, injected by the lead into index.html
```

## Token rules

Everything comes from `css/tokens.css`. **Do not write a raw hex value** in
`landing.css` or `dashboard.css` — use `var(--token)`. If you need a shade that
does not exist, use `color-mix(in oklab, var(--x) 70%, var(--y))`.

Key tokens: `--ink-1000..--ink-500`, `--violet-400/300`, `--slate-500..300`,
`--trim-100/200`, `--amber-600..200`, `--glow`, `--surface`, `--surface-hi`,
`--hairline`, `--panel`, `--panel-soft`, `--panel-line`, `--fg`, `--fg-muted`,
`--fg-faint`, `--on-panel`, `--on-panel-muted`, `--ok`, `--warn`, `--risk`,
`--display`, `--sans`, `--mono`, `--t-xs..--t-3xl`, `--gutter`, `--section-y`,
`--r-sm..--r-pill`, `--lift-1/2`, `--lamp`, `--ease-out`, `--ease-io`,
`--dur-fast/--dur/--dur-slow`, `--z-*`.

Fonts already loaded by the shell: Fraunces (display), Instrument Sans (UI),
IBM Plex Mono (data/labels). Use `--display` only for headings and big numerals.

## Non-negotiables (every file)

1. **Accessibility.** Semantic landmarks, one `<h1>` on the page, headings in order,
   real `<button>`/`<a>`, `aria-label` on icon-only controls, visible focus (tokens
   already give it), `aria-live` on anything that updates, `alt` on every image
   (`alt=""` only for pure decoration).
2. **Reduced motion.** Every file ships
   `@media (prefers-reduced-motion: reduce) { ... }` that renders the FINAL state
   immediately — not a faster animation. No infinite loops under reduce.
3. **No JS, no problem.** Content you author must be readable as plain markup.
   Never put copy only inside a JS template string if it belongs to the landing page.
4. **No fake proof.** No invented logos, customer names, testimonials, ratings,
   "trusted by" rows, press badges, or awards. No "Awwwards" claim anywhere.
5. **No model-drawn illustrations.** No hand-authored decorative SVG scenes,
   CSS blobs, or canvas art. Interface icons (Solar), data graphics (charts),
   and a brand wordmark are fine.
6. **Photos for every human face.** Use real licensed photographs. Never initials
   in a circle, never illustrated or generated faces presented as real people.
7. **Performance.** `loading="lazy"` + `decoding="async"` + explicit `width`/`height`
   on every below-fold image. No `backdrop-filter` on more than a handful of
   elements. No animation running offscreen.
8. **Mobile first-class.** Everything must work at 375px wide with no horizontal
   scroll and no clipped controls.

## Image sourcing

Use **Unsplash** via their CDN with explicit sizing, e.g.
`https://images.unsplash.com/photo-<id>?w=800&q=72&auto=format&fit=crop`.
Every image needs a provenance comment in the source:
`<!-- Unsplash photo <id> by <Photographer> — unsplash.com/photos/<slug> -->`
and the photographer credited in the page footer credits block.
**Verify every URL returns HTTP 200 before shipping it.** Provide an `onerror`
fallback to a token-colored block so a dead URL never shows a broken icon.
