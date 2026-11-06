# real-estate-client — Project Context

**Status:** Live on GitHub Pages. Client has not seen it yet.
**Live:** https://carami21.github.io/real-estate-client/
**Repo:** https://github.com/carami21/real-estate-client (public)
**Handoff:** [[03 Projects/SWE Projects/real-estate-client/handoff]]
**Started:** 2026-11-05

## What this is

A landing page for **Noah Salvador's** residential real-estate dashboard.
The page is one idea: a Victorian house at blue hour that assembles itself as
you scroll, and a front door that opens into the product.

"PUTSOMESPECONIT" is the name I gave the product. Noah has not signed off on it.

## Where things are

Everything ships from `site/`. It is a static folder — no build step, no npm.

```
site/index.html        shell, hero, the 3D act, sections inlined
site/css/tokens.css    the palette. Change the look here, not anywhere else.
site/css/stage.css     canvas, loader, hero, captions, the door
site/css/landing.css   the sections below the build
site/css/dashboard.css the product UI, all scoped under .pl-dash
site/js/house.js       the three.js scene
site/js/app.js         Lenis + GSAP, the door, the dashboard handoff
site/js/dashboard.js   mountDashboard / destroyDashboard / focusDashboard
site/js/data.js        demo data + verified photo and icon manifest
CONTRACT.md            the spec this was held to — read before changing anything
README.md              how to run, deploy, and what to do before launch
```

## Rules for this project

- **Lenis is the only smooth-scroll engine.** Never add Locomotive.
- **No raw hex outside `tokens.css`.** Use `var(--token)` or `color-mix()`.
- **No invented proof.** No testimonials, logos, customer counts, ratings,
  press or awards. None exist. The dashboard figures are labelled sample data
  on screen and that wording lives in `DEMO_NOTICE`.
- **Noah does not get a stock headshot.** Monogram until a real photo exists.
- **Reduced motion and no-WebGL get the static route**, which must never
  promise the 3D build. Both the CSS media query and the `html.is-static`
  class carry that route — keep them in step.
- Every `[hidden]` element with an explicit `display` needs
  `.thing[hidden] { display: none !important }`.

## Tuning the scene

In `js/house.js`:
- `SCHEDULE` — when each build layer appears: `[start, end, topY, optional floorY]`
- `SHOTS` — the camera: `[progress, [x,y,z], [lookAtX,Y,Z]]`
- `PALETTE` — afternoon / dusk / night sky colours
- Lighting lives in `applyProgress()`. If the house blows out, the knobs are
  `toneMappingExposure`, `bloom.strength`, `porchLight.intensity`.

In `js/app.js`: `STAGES` holds the seven caption blocks.

## The name

**PUTSOMESPECONIT** is Noah's PSN handle, used as the product name so the site
introduces itself to him in his own gamertag. It also reads *put some spec on
it*, and "spec" is already real-estate vocabulary (a spec home), so the pun
works on the product too. The footer says it out loud under the wordmark.

Set as a tracked-out all-caps logotype in `--sans`, **not** the Fraunces
display serif the headings use — 15 capitals in a serif will not survive a
375px header. If you change the name, the four places are `.hdr__markWord`,
`.ftr__mark`, `.loader__mark` and `.pl-rail__name`.

Avoid dropping the name mid-sentence in body copy; it shouts. The existing
prose says "it", "the desk" or "this" in those positions on purpose.

## Before Noah signs off

1. Point `#contact-form` at a real endpoint (Formspree / Basin / Netlify).
2. Real photo of Noah.
3. Decide whether to keep the demo listings or use his own.
4. Confirm he's happy the repo is public — `gh repo edit --visibility private`
   flips it (Pages then needs a paid plan, so move to Netlify if so).

## Links

- [[Claude Chats/2026-11-05 — real-estate-client Page for Noah Salvador]]
- [[03 Projects/SWE Projects/Personal Website/CLAUDE|Personal Website]] — tag
  the repo `portfolio` on GitHub and it syncs into the projects grid there.
