# PUTSOMESPECONIT — landing page

A landing page for **Noah Salvador's** residential real-estate dashboard.

Scroll and a Victorian house assembles itself from survey stakes to lamplight.
When the last light comes on, the front door is the only thing left to press —
and it opens into the product.

## Run it

Any static server works. There is no build step.

```bash
cd "03 Projects/SWE Projects/real-estate-client/site" && python3 -m http.server 4610
```

Then open <http://localhost:4610>. It must be served over HTTP — ES modules do
not load from `file://`.

## Deploy

The `site/` folder *is* the deployable artifact. Drag it into Netlify, point
Vercel at it, or push it to GitHub Pages. Nothing to compile, nothing to install.

## Files

```
site/
  index.html          page shell, hero, the 3D act, dashboard container
  css/tokens.css      every colour, type and spacing token — change the look here
  css/stage.css       canvas, loader, hero, stage captions, the door
  css/landing.css     the content sections below the build
  css/dashboard.css   the product UI (all scoped under .pl-dash)
  js/house.js         the three.js scene: geometry, textures, lighting, camera
  js/app.js           Lenis + GSAP choreography, the door, the handoff
  js/dashboard.js     the dashboard, vanilla DOM (mount / destroy / focus)
  js/data.js          demo data + verified photo and icon manifest
  partials/sections.html   source fragment for the sections already inlined
                           into index.html — edit both, or re-splice
CONTRACT.md           the spec the whole build was written against
```

## Stack

| Piece | What it does |
|---|---|
| [three.js](https://threejs.org) 0.169 | the house, the sky, the lighting, the door |
| [GSAP](https://gsap.com) 3.12 + ScrollTrigger | hero intro, the scrubbed build, the door sequence |
| [Lenis](https://lenis.darkroom.engineering) 1.1 | smooth scroll — the only engine, on purpose |

All three load as pinned ES modules from jsDelivr. Fonts are Fraunces,
Instrument Sans and IBM Plex Mono from Google Fonts. Icons are the
[Solar](https://icon-sets.iconify.design/solar/) set through the Iconify API.

## How the scene works

`js/house.js` builds everything procedurally — no model files, no image
textures. Siding, shingle, stone and sheathing are drawn to canvases at load
time, so the whole page is a few hundred KB of code and nothing else.

The build itself is **clipping planes**. Every material belongs to a layer in
`SCHEDULE`, and each layer has a plane that rises through the geometry as you
scroll, so the house genuinely grows out of the ground instead of fading in.
Shingle carries a second, fixed plane that holds it above the belt course, so
it can never creep down over the clapboard.

To re-time the build, edit `SCHEDULE` (start, end, top, optional floor).
To re-shoot it, edit `SHOTS` — `[progress, cameraPosition, lookAt]`.
To rewrite the captions, edit `STAGES` in `js/app.js`.

The camera holds a constant **horizontal** field of view, so a narrow window
widens the vertical one instead of cropping the house.

## Things that are deliberately true

- **Everything in the dashboard is sample data.** It says so on screen, and
  `DEMO_NOTICE` in `data.js` is the single source of that wording.
- **There are no testimonials, logos, customer counts, ratings or press.**
  None exist, so none are shown.
- **The six people on the demo roster are invented**, wearing licensed
  Unsplash portraits with the photographer credited in the footer.
- **Noah is not wearing a stranger's face.** His account chip shows his real
  name and role with a monogram, not a stock headshot. When there is a real
  photograph of him:

  ```js
  mountDashboard(root, { account: { photo: '/img/noah.jpg', alt: 'Noah Salvador' } })
  ```

## Before this goes live

1. **Point the contact form somewhere.** `#contact-form` has `action="#"`.
   Formspree, Basin or Netlify Forms all work — the comment above the form in
   `index.html` says how.
2. **Swap in a real photo of Noah** (see above).
3. **Replace the demo listings** if he would rather show his own, in
   `js/data.js`. Keep the "sample data" notice unless the numbers become real.
4. Optional: self-host the three CDN dependencies if you want the page to
   survive jsDelivr being unreachable.

## Accessibility and fallbacks

- One `<h1>`, headings in order, real landmarks, visible focus everywhere.
- Split headings keep their accessible name; the animated word spans are
  `aria-hidden`.
- `prefers-reduced-motion: reduce` **replaces** the experience rather than
  speeding it up: no smooth scroll, no scrubbing, no canvas. The hero gets a
  static dusk gradient and copy that does not promise a house that is not
  there.
- Same route if WebGL is missing or the context is lost.
- With JavaScript off, every section still reads, the FAQ still opens, the
  menu still works, and the photo credits are listed statically.
- Checked at 375px and 1440px: no horizontal scroll at either.

## Known limits

- Solar has no door icon (checked against all 8,979 names), so the
  "step inside" mark in the band section is `login-3-bold-duotone`.
- The `<noscript>` photo-credit list is hard-coded. If `PHOTOS` in `data.js`
  changes, regenerate it by hand — the JS-filled list cannot drift, that one can.
- `partials/sections.html` is already inlined into `index.html`. It is kept as
  the readable source; if you edit it, re-splice or edit `index.html` directly.
