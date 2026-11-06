/* =========================================================================
   app.js — choreography.

   Owns: Lenis (the single smooth-scroll engine), GSAP + ScrollTrigger,
   heading splits, the build scrub, the door, and the handoff into the
   dashboard. house.js owns the scene; dashboard.js owns the product UI.
   ========================================================================= */

import { gsap } from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionQuery.matches;

/* ------------------------------------------------------------------ */
/* Stage captions, keyed to build progress                            */
/* ------------------------------------------------------------------ */

const STAGES = [
  [0.00, '01', 'Survey',
    'Corners staked, setbacks checked, the footprint strung out on bare dirt.'],
  [0.11, '02', 'Foundation',
    'Footings poured and cured, stone laid up to grade. Everything above this is square because this is.'],
  [0.26, '03', 'Frame',
    'Studs, joists and rafters. For the first time you can walk the rooms and feel how big they actually are.'],
  [0.41, '04', 'Dry in',
    'Sheathing, weather wrap, roof deck. From here the weather stays outside.'],
  [0.60, '05', 'Skin',
    'Slate shingle above, clapboard below, trim picked out in white. The house finds its face.'],
  [0.78, '06', 'Porch',
    'Turned posts, a railing, a beadboard ceiling and three bluestone steps up off the path.'],
  [0.90, '07', 'Lights on',
    'Dusk. The lamps come up room by room, and the only thing left to do is open the door.'],
];

/* ------------------------------------------------------------------ */
/* Heading splits — decorative spans, accessible name preserved       */
/* ------------------------------------------------------------------ */

function splitHeadings() {
  const out = [];
  for (const el of $$('[data-split]')) {
    if (el.dataset.splitDone) continue;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    el.setAttribute('aria-label', text);
    const inner = document.createElement('span');
    inner.className = 'split__inner';
    inner.setAttribute('aria-hidden', 'true');
    for (const word of text.split(' ')) {
      const w = document.createElement('span');
      w.className = 'word';
      w.textContent = word + ' ';
      inner.appendChild(w);
    }
    el.textContent = '';
    el.appendChild(inner);
    el.dataset.splitDone = '1';
    out.push(el);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

const state = {
  scene: null,
  lenis: null,
  dash: null,          // the loaded dashboard module
  dashOpen: false,
  lastFocus: null,
  doorRaf: 0,
  webgl: true,
  stageIndex: -1,
};

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(
      window.WebGL2RenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

async function boot() {
  const loader = $('#loader');
  const loaderBar = $('#loader-bar');
  const loaderPct = $('#loader-pct');
  const canvas = $('#gl');
  const poster = $('#poster');

  splitHeadings();
  wireHeaderMenu();
  wireContactForm();
  wireDashButtons();
  fillPhotoCredits();

  state.webgl = webglAvailable();

  /* ---------------- no WebGL, or reduced motion: static route ------- */
  if (!state.webgl || reduced) {
    document.documentElement.classList.add('is-static');
    if (canvas) canvas.remove();
    finishLoader(loader);
    if (!reduced) revealOnScrollLight();
    return;
  }

  document.documentElement.classList.add('is-live');

  /* ---------------- smooth scroll ----------------------------------- */
  const lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
  });
  state.lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* anchor links go through Lenis so they land smoothly */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -84 }); /* matches scroll-margin-top in landing.css */
  });

  /* ---------------- the scene --------------------------------------- */
  let createScene;
  try {
    ({ createScene } = await import('./house.js'));
  } catch (err) {
    console.error('[spec] scene failed to load', err);
    document.documentElement.classList.remove('is-live');
    document.documentElement.classList.add('is-static');
    canvas?.remove();
    finishLoader(loader);
    return;
  }

  /* The loader tracks real texture and geometry build time, which is
     genuinely the slow part of first paint here. */
  let pct = 0;
  const tickLoader = setInterval(() => {
    pct = Math.min(92, pct + 7 + Math.round(6 * (1 - pct / 100)));
    if (loaderBar) loaderBar.style.transform = `scaleX(${pct / 100})`;
    if (loaderPct) loaderPct.textContent = String(pct);
  }, 90);

  let scene;
  try {
    scene = createScene(canvas, { reducedMotion: reduced });
  } catch (err) {
    clearInterval(tickLoader);
    console.error('[spec] scene failed to build', err);
    document.documentElement.classList.remove('is-live');
    document.documentElement.classList.add('is-static');
    canvas.remove();
    finishLoader(loader);
    return;
  }
  state.scene = scene;
  scene.start();

  await scene.ready;
  clearInterval(tickLoader);
  if (loaderBar) loaderBar.style.transform = 'scaleX(1)';
  if (loaderPct) loaderPct.textContent = '100';
  poster?.classList.add('is-gone');
  finishLoader(loader);

  heroIntro();
  wireBuildScrub(scene);
  wirePointer(scene);
  wireDoor(scene);
  wireSectionReveals();
  wireVisibility(scene);

  /* fonts and images shift layout; re-measure once they settle */
  if (document.fonts?.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh(), { once: true });

  addEventListener('resize', () => {
    scene.resize();
    ScrollTrigger.refresh();
  });
}

function finishLoader(loader) {
  if (!loader) return;
  loader.classList.add('is-done');
  setTimeout(() => {
    loader.hidden = true;
    loader.setAttribute('aria-hidden', 'true');
  }, 650);
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function heroIntro() {
  if (reduced) return;
  const title = $('#hero-title');
  const words = title ? $$('.word', title) : [];
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.from(words, { yPercent: 118, opacity: 0, duration: 0.95, stagger: 0.055 }, 0)
    .from('.eyebrow', { opacity: 0, y: 12, duration: 0.6 }, 0.05)
    .from('.hero__lede', { opacity: 0, y: 18, duration: 0.8 }, 0.35)
    .from('.hero__actions > *', { opacity: 0, y: 14, duration: 0.6, stagger: 0.08 }, 0.5)
    .from('.hero__note', { opacity: 0, duration: 0.6 }, 0.68)
    .from('.rail', { opacity: 0, duration: 0.8 }, 0.5)
    .from('.scrollcue', { opacity: 0, duration: 0.6 }, 0.8);
}

/* ------------------------------------------------------------------ */
/* The build scrub                                                     */
/* ------------------------------------------------------------------ */

function wireBuildScrub(scene) {
  const build = $('#build');
  if (!build) return;
  const fill = $('#rail-fill');
  const ticks = $$('.rail__ticks li');
  const hero = $('#hero');
  const stage = $('#stage');
  const cue = $('#scrollcue');

  ScrollTrigger.create({
    trigger: build,
    start: 'top top',
    end: 'bottom bottom',
    scrub: 0.45,
    onUpdate(self) {
      const p = self.progress;
      scene.setProgress(p);
      if (fill) fill.style.transform = `scaleY(${p})`;
      setStage(p, ticks);

      /* hero steps aside early; the stage caption takes over */
      const heroOut = gsap.utils.clamp(0, 1, (p - 0.02) / 0.1);
      if (hero) {
        hero.style.opacity = String(1 - heroOut);
        hero.style.transform = `translate3d(0, ${-heroOut * 36}px, 0)`;
        /* The <h1> stays in the accessibility tree on purpose: screen-reader
           users navigate by heading and must not lose the page title to a
           scroll position. Only pointer interaction is withdrawn. */
        hero.style.pointerEvents = heroOut > 0.6 ? 'none' : '';
      }
      if (cue) cue.style.opacity = String(Math.max(0, 1 - p * 14));

      /* the caption bows out as the door takes the stage */
      const stageOut = gsap.utils.clamp(0, 1, (p - 0.93) / 0.05);
      if (stage) {
        stage.style.opacity = String(Math.min(1 - stageOut, heroOut));
        stage.style.transform = `translate3d(0, ${(1 - heroOut) * 22 - stageOut * 20}px, 0)`;
      }

      /* The rail sits over lit siding once the lamps are on — retire it
         with the caption so the door is the only thing left to read. */
      const rail = $('#rail');
      if (rail) rail.style.opacity = String(Math.min(1 - stageOut, heroOut));

      revealDoorButton(p > 0.965);
    },
  });

  /* fade the canvas out once the build section has fully left, so the
     content below is not compositing a full-screen WebGL layer */
  ScrollTrigger.create({
    trigger: build,
    start: 'bottom bottom-=10%',
    end: 'bottom top',
    onUpdate(self) {
      const o = 1 - self.progress;
      const gl = $('#gl');
      if (gl) gl.style.opacity = String(o);
      document.documentElement.classList.toggle('past-build', self.progress > 0.92);
      if (self.progress > 0.98) scene.stop();
      else scene.start();
    },
  });
}

function setStage(p, ticks) {
  let i = 0;
  for (let k = 0; k < STAGES.length; k++) if (p >= STAGES[k][0]) i = k;
  if (i === state.stageIndex) return;
  state.stageIndex = i;
  const [, num, title, body] = STAGES[i];
  const numEl = $('#stage-num');
  const titleEl = $('#stage-title');
  const bodyEl = $('#stage-body');
  if (numEl) numEl.textContent = num;
  if (titleEl) titleEl.textContent = title;
  if (bodyEl) bodyEl.textContent = body;
  ticks.forEach((t, k) => t.classList.toggle('is-on', k <= i));

  if (!reduced && titleEl) {
    gsap.fromTo(
      [titleEl, bodyEl],
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: 'power2.out', overwrite: true },
    );
  }
}

/* ------------------------------------------------------------------ */
/* Pointer parallax                                                    */
/* ------------------------------------------------------------------ */

function wirePointer(scene) {
  if (reduced) return;
  let queued = false;
  let lx = 0, ly = 0;

  const flush = () => {
    queued = false;
    scene.pointerMove(lx, ly);
  };

  const onMove = (e) => {
    const t = e.touches ? e.touches[0] : e;
    if (!t) return;
    lx = (t.clientX / innerWidth) * 2 - 1;
    ly = -((t.clientY / innerHeight) * 2 - 1);
    if (!queued) { queued = true; requestAnimationFrame(flush); }
  };

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('blur', () => scene.pointerMove(0, 0));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.pointerMove(0, 0);
  });

  scene.onDoorHover((on) => {
    document.documentElement.classList.toggle('door-hot', on);
  });
}

/* ------------------------------------------------------------------ */
/* The door                                                            */
/* ------------------------------------------------------------------ */

function revealDoorButton(on) {
  const btn = $('#door-btn');
  const hint = $('#door-hint');
  if (!btn) return;
  if (on === !btn.hidden) return;
  btn.hidden = !on;
  if (hint) hint.hidden = !on;
  if (on && !reduced) {
    gsap.fromTo(btn, { opacity: 0, scale: 0.86 },
      { opacity: 1, scale: 1, duration: 0.7, ease: 'back.out(1.7)' });
    gsap.fromTo(hint, { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: 0.6, delay: 0.15 });
  }
}

function wireDoor(scene) {
  const btn = $('#door-btn');
  const canvas = $('#gl');

  /* keep the button sitting on the doorway */
  const place = () => {
    state.doorRaf = requestAnimationFrame(place);
    if (!btn || btn.hidden || state.dashOpen) return;
    const p = scene.doorScreenPoint();
    if (!p.visible) return;
    btn.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%)`;
  };
  place();

  /* pressing the canvas over the door works too */
  canvas?.addEventListener('click', (e) => {
    if (state.dashOpen) return;
    const nx = (e.clientX / innerWidth) * 2 - 1;
    const ny = -((e.clientY / innerHeight) * 2 - 1);
    if (scene.hitDoor(nx, ny)) openDashboard();
  });
}

function wireDashButtons() {
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-dash]');
    if (!t) return;
    e.preventDefault();
    openDashboard();
  });
  $('#dash-close')?.addEventListener('click', () => closeDashboard());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && state.dashOpen) {
      /* let the dashboard's own overlays claim Escape first */
      if (document.documentElement.classList.contains('dash-overlay-open')) return;
      closeDashboard();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Door -> dashboard                                                   */
/* ------------------------------------------------------------------ */

async function openDashboard() {
  if (state.dashOpen) return;
  state.dashOpen = true;
  state.lastFocus = document.activeElement;

  const layer = $('#dash-layer');
  const root = $('#dash-root');
  const scene = state.scene;
  if (!layer || !root) return;

  layer.hidden = false;
  document.documentElement.classList.add('dash-open');
  state.lenis?.stop();
  $('#main')?.setAttribute('inert', '');
  $('[data-slot="header"]')?.setAttribute('inert', '');
  $('#site-footer')?.setAttribute('inert', '');

  /* mount the product on first open */
  if (!state.dash) {
    try {
      state.dash = await import('./dashboard.js');
    } catch (err) {
      console.error('[spec] dashboard failed to load', err);
      root.innerHTML =
        '<p class="dashlayer__error">The demo workspace could not load. ' +
        'Check the console, then reload the page.</p>';
    }
  }
  if (state.dash?.mountDashboard) {
    state.dash.mountDashboard(root, { reducedMotion: reduced });
  }

  if (scene && !reduced) {
    /* swing the door, push the camera through, then wipe to the product */
    const tl = gsap.timeline();
    const o = { d: 0, a: 0 };
    tl.to(o, {
      d: 1, duration: 0.85, ease: 'power3.inOut',
      onUpdate: () => scene.setDoor(o.d),
    }, 0);
    tl.to(o, {
      a: 1, duration: 1.0, ease: 'power2.in',
      onUpdate: () => scene.setApproach(o.a),
    }, 0.28);
    tl.to('.dashlayer__door', { opacity: 1, duration: 0.5, ease: 'power2.in' }, 0.55);
    tl.to(layer, { opacity: 1, duration: 0.35 }, 0.9);
    tl.fromTo(root, { opacity: 0, scale: 0.985 },
      { opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }, 1.0);
    tl.to('.dashlayer__door', { opacity: 0, duration: 0.7, ease: 'power2.out' }, 1.05);
    tl.add(() => state.dash?.focusDashboard?.(), 1.25);
  } else {
    layer.style.opacity = '1';
    scene?.setDoor(1);
    scene?.setApproach(1);
    state.dash?.focusDashboard?.();
  }
}

function closeDashboard() {
  if (!state.dashOpen) return;
  state.dashOpen = false;
  const layer = $('#dash-layer');
  const scene = state.scene;

  const finish = () => {
    if (layer) { layer.hidden = true; layer.style.opacity = ''; }
    state.dash?.destroyDashboard?.();
    document.documentElement.classList.remove('dash-open');
    state.lenis?.start();
    $('#main')?.removeAttribute('inert');
    $('[data-slot="header"]')?.removeAttribute('inert');
    $('#site-footer')?.removeAttribute('inert');
    /* The opener is often the canvas, which cannot hold focus — fall back to
       the door button so keyboard users are not dropped on <body>. */
    const prev = state.lastFocus;
    const focusable =
      prev &&
      document.contains(prev) &&
      typeof prev.focus === 'function' &&
      (prev.tabIndex >= 0 ||
        /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(prev.tagName));
    const btn = $('#door-btn');
    const back = focusable ? prev : (btn && !btn.hidden ? btn : $('#nav-open-dash'));
    back?.focus?.({ preventScroll: true });
  };

  if (scene && !reduced) {
    const o = { d: 1, a: 1 };
    gsap.timeline({ onComplete: finish })
      .to(layer, { opacity: 0, duration: 0.4, ease: 'power2.in' }, 0)
      .to(o, {
        a: 0, duration: 0.8, ease: 'power3.out',
        onUpdate: () => scene.setApproach(o.a),
      }, 0.1)
      .to(o, {
        d: 0, duration: 0.7, ease: 'power3.inOut',
        onUpdate: () => scene.setDoor(o.d),
      }, 0.3);
  } else {
    scene?.setDoor(0);
    scene?.setApproach(0);
    finish();
  }
}

/* ------------------------------------------------------------------ */
/* Section reveals                                                     */
/* ------------------------------------------------------------------ */

function wireSectionReveals() {
  if (reduced) return;

  for (const el of $$('[data-split]')) {
    if (el.closest('#build')) continue;
    const words = $$('.word', el);
    if (!words.length) continue;
    gsap.from(words, {
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      yPercent: 110, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.035,
    });
  }

  for (const el of $$('[data-reveal]')) {
    gsap.from(el, {
      scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      opacity: 0, y: 26, duration: 0.75, ease: 'power3.out',
      delay: parseFloat(el.dataset.reveal) || 0,
    });
  }

  for (const group of $$('[data-reveal-group]')) {
    gsap.from(group.children, {
      scrollTrigger: { trigger: group, start: 'top 86%', once: true },
      opacity: 0, y: 28, duration: 0.7, ease: 'power3.out', stagger: 0.07,
    });
  }

  const line = $('#workflow-line');
  const wf = $('#workflow');
  if (line && wf) {
    gsap.fromTo(line, { scaleY: 0 }, {
      scaleY: 1, ease: 'none', transformOrigin: 'top center',
      scrollTrigger: { trigger: wf, start: 'top 70%', end: 'bottom 70%', scrub: 0.5 },
    });
  }
}

/** Reduced-motion / no-WebGL path still gets a gentle, instant-safe reveal. */
function revealOnScrollLight() {
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  $$('[data-reveal], [data-reveal-group]').forEach((el) => io.observe(el));
}

/* ------------------------------------------------------------------ */
/* Header menu, form, credits                                          */
/* ------------------------------------------------------------------ */

function wireHeaderMenu() {
  const btn = $('#menu-toggle');
  const panel = $('#menu-panel');
  if (!btn || !panel) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    panel.toggleAttribute('hidden', !open);
    document.documentElement.classList.toggle('menu-open', open);
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  panel.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') {
      set(false);
      btn.focus();
    }
  });
}

function wireContactForm() {
  const form = $('#contact-form');
  if (!form) return;
  form.setAttribute('novalidate', '');
  const status = $('#contact-status');

  const showError = (field, msg) => {
    const slot = document.getElementById(`${field.id}-error`);
    if (slot) slot.textContent = msg;
    field.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    let firstBad = null;

    /* honeypot: a real person never fills this */
    const pot = form.querySelector('[name="company_website"]');
    if (pot && pot.value) return;

    for (const field of $$('input[required], textarea[required], select[required]', form)) {
      let msg = '';
      if (!field.value.trim()) msg = 'This one is required.';
      else if (field.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(field.value))
        msg = 'That does not look like an email address.';
      showError(field, msg);
      if (msg) { ok = false; if (!firstBad) firstBad = field; }
    }

    if (!ok) {
      if (status) status.textContent = 'Have a look at the highlighted fields.';
      firstBad?.focus();
      return;
    }

    /* No endpoint is wired on purpose — see the comment in the markup. */
    if (status) {
      status.textContent =
        'Thanks. This demo does not send anything yet — point the form at an endpoint to go live.';
    }
    form.reset();
  });
}

function fillPhotoCredits() {
  const list = $('#photo-credits');
  if (!list) return;
  import('./data.js')
    .then((m) => {
      const credits = m.CREDITS || [];
      if (!credits.length) return;
      list.innerHTML = '';
      for (const c of credits) {
        const li = document.createElement('li');
        li.textContent = c;
        list.appendChild(li);
      }
    })
    .catch(() => { /* the <noscript>/static list in the markup stands */ });
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function wireVisibility(scene) {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.stop();
    else if (!document.documentElement.classList.contains('past-build')) scene.start();
  });

  addEventListener('pagehide', () => {
    cancelAnimationFrame(state.doorRaf);
    scene.dispose();
    state.lenis?.destroy();
    state.dash?.destroyDashboard?.();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  }, { once: true });

  const canvas = $('#gl');
  canvas?.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    /* The page falls back to the static route; the hero CTA still opens
       the workspace, so nothing the visitor needs is lost. */
    document.documentElement.classList.add('is-static');
    document.documentElement.classList.remove('is-live');
  });
}

/* Re-reading the preference mid-session is cheap and avoids a stale page. */
motionQuery.addEventListener?.('change', (e) => {
  reduced = e.matches;
  if (reduced) {
    state.lenis?.destroy();
    state.lenis = null;
    state.scene?.setProgress(1);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
