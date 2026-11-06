# real-estate-client — Handoff
**Session note:** [[Claude Chats/2026-11-05 — PUTSOMESPECONIT Landing Page for Noah Salvador]]
**Last updated:** 2026-11-05

## What Was Done
- Built the whole site from scratch at `03 Projects/SWE Projects/real-estate-client/site/`. No build step, no npm, deployable as a folder.
- `js/house.js` — a procedural Victorian house in three.js: cross-gabled main block, octagonal bay with a conical cap, steep-hipped right wing, chimney, wraparound porch with turned posts and railing, balcony on the porch roof, lit sash windows, working front door. Every texture is drawn to a canvas at load time; no model or image files.
- Scroll-scrubbed build in seven stages (survey → foundation → frame → dry in → skin → porch → lights on) driven by clipping planes that rise through each material layer, so the house grows out of the ground.
- Sky and lighting run late afternoon → blue hour → night, matched to the reference photo Carlos supplied.
- Door interaction: a real focusable `<button>` parked over the doorway in screen space, plus canvas raycast. Pressing it swings the door, pushes the camera through, wipes amber, and mounts the dashboard.
- `js/dashboard.js` + `css/dashboard.css` — the product: rail nav, Cmd/Ctrl+K command palette with focus trap, KPI tiles with count-up, commission chart with 3/6/9-month control, office-mix donut, review queue with working approve/reject and a live region, finance, activity feed, and honest "not in this demo" pages for the rest.
- `partials/sections.html` + `css/landing.css` — header, product section, a timed "day on PUTSOMESPECONIT" timeline, demo-workspace figures, a second CTA band, 5-question FAQ, a real contact form with validation, and a footer with photographer credits.
- `js/data.js` — demo data plus a manifest of 16 Unsplash photos and 57 Solar icons, every URL HTTP-verified.
- README.md written. CONTRACT.md is the spec the build was held to.

## Current State
Working end to end and verified in a browser at 375px, 1280px and 1440px: scroll builds the house, the door opens the dashboard, Esc closes it and returns focus. Zero console errors. One `<h1>`, no heading-level skips, every image has alt text and explicit dimensions, no unlabelled icon-only controls, Lenis is the only smooth-scroll engine. Reduced-motion and no-WebGL both fall back to a static dusk gradient with copy that does not promise a house that is not there; with JavaScript off every section still reads. Nothing is deployed and nothing is in git yet.

## Decisions Made
- **Lenis, not Locomotive.** One engine, wired to ScrollTrigger the documented way, destroyed on pagehide.
- **Clipping planes rather than opacity fades** for the build — it is the difference between a house assembling and a house appearing.
- **Constant horizontal FOV.** A fixed vertical FOV cropped the house badly on narrow windows; the camera now widens vertically instead.
- **Noah does not get a stock headshot.** Putting a real client's name on a stranger's face misrepresents a real person. His chip is a monogram until there is a real photo; `mountDashboard(root, { account: { photo, alt } })` takes it.
- **The demo roster is invented and says so**, with real Unsplash photographers credited in the footer. No testimonials, logos, customer counts, ratings or press anywhere — none exist.
- **The dashboard's unbuilt sections say "not in this demo"** instead of pretending.
- Built with a three-agent workflow (asset verification → dashboard + landing sections in parallel) against a written contract; the three.js scene and all choreography were written by hand.

## Blockers
- **Contact form posts nowhere.** `action="#"`. Needs a Formspree / Basin / Netlify endpoint from Noah before launch.
- **No real photograph of Noah.**
- Not in git, not deployed, and Noah has not seen it.

## Exact Next Steps
1. Show it to Noah and get his read on the name "PUTSOMESPECONIT", the copy, and whether he wants his own listings in place of the demo ones.
2. Get a headshot and the form endpoint from him.
3. `git init` in `real-estate-client/`, push, deploy `site/` to Netlify or Vercel.
4. Optional: self-host the three CDN dependencies so the page survives jsDelivr being down.
5. Optional: add it to the portfolio repo with the `portfolio` GitHub topic so it syncs into [[03 Projects/SWE Projects/Personal Website/CLAUDE|the personal site]].

## Files Changed
- `site/index.html` — shell, hero, the 3D act, sections inlined, no-JS fallback
- `site/css/tokens.css` — palette sampled from the dusk house photo, type, spacing
- `site/css/stage.css` — canvas, loader, hero, captions, door, static route
- `site/css/landing.css` — the content sections
- `site/css/dashboard.css` — the product UI
- `site/js/house.js` — the three.js scene
- `site/js/app.js` — Lenis + GSAP, the door, the dashboard handoff
- `site/js/dashboard.js` — the dashboard module
- `site/js/data.js` — demo data and the verified asset manifest
- `site/partials/sections.html` — section source fragment
- `README.md`, `CONTRACT.md`
- `.claude/launch.json` (vault root) — added a `real-estate-client` preview entry on port 4610
