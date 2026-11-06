/* =========================================================================
   PUTSOMESPECONIT — the demo workspace
   -------------------------------------------------------------------------
   This is the payoff of the landing page: the front door opens and a real
   product appears. It is one vanilla ES module with exactly one dependency,
   ./data.js. No framework, no bundler, no GSAP (the lead owns GSAP).

   PUBLIC API — the lead wires these three up and nothing else.
     mountDashboard(rootEl, opts)  build the whole UI inside rootEl
     destroyDashboard()            remove every listener / rAF / timer / observer
     focusDashboard()              move focus to the first control (door handoff)

   mountDashboard() is safe to call twice: the second call tears the first
   one down before rebuilding. destroyDashboard() is idempotent.

   opts
     reducedMotion : boolean   force the no-motion path (app.js passes this)
     account       : object    override the signed-in account (see ACCOUNT)
     onClose       : function  if given, the command palette offers "Close the
                               workspace" and calls this. Without it the module
                               never touches anything outside rootEl.

   RULES THIS FILE OBEYS
   - Not one raw colour value. Every colour lives in css/tokens.css and is
     reached through a var() in css/dashboard.css, or through OFFICES[].token.
   - Reduced motion renders the FINAL state immediately: no count-up, no view
     transition, no donut draw-on, no card stagger.
   - Charts are authored data graphics (allowed by the contract). Each one
     ships a visually hidden <table> carrying the actual numbers, so the SVG
     itself can stay aria-hidden instead of being read as noise.
   - Every number on screen is either straight out of ./data.js or derived
     from it in view. Nothing is invented here. No testimonials, logos,
     ratings, awards or customer names anywhere.
   - All DOM lives under one root class, .pl-dash, so dashboard.css can never
     leak onto the landing page.

   WHY MASKED SPANS INSTEAD OF data.js's iconSvg():
   iconSvg() emits an <img>, which cannot inherit currentColor — and a raw hex
   in the Iconify URL is forbidden here. So icons are rendered as a <span>
   whose mask-image is the glyph and whose background is currentColor. The
   colour then comes from whatever token the surrounding CSS set, inherits on
   hover/active for free, and no hex is ever emitted. iconSvg() is untouched
   and still available to other surfaces; only the URL helper is imported.
   ========================================================================= */

import {
  AGENTS,
  agentById,
  LISTINGS,
  PIPELINE,
  OFFICES,
  STATS,
  PAYOUTS,
  TASKS,
  ACTIVITY,
  CREDITS,
  DEMO_NOTICE,
  iconUrl,
  formatPrice,
  formatSqft,
  formatStat,
  formatChange,
} from './data.js';

/* ======================================================================
   small utilities
   ====================================================================== */

/** Escape anything interpolated into markup. Demo data is ours, but the
 *  search box is not — treat every string as untrusted. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A Solar glyph as a masked span. Decorative by definition — meaning always
 *  lives in adjacent text or in the aria-label of the control around it. */
function ico(key, size = 18) {
  return (
    `<span class="pl-ico" aria-hidden="true" style="--pl-ico:url('` +
    `${iconUrl(key)}');--pl-ico-size:${Number(size) || 18}px"></span>`
  );
}

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const hasText = (haystack, needle) =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function todayLabel(date = new Date()) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/** Pluralise without a dependency. */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* ======================================================================
   account

   data.js deliberately does NOT carry a person called Noah Salvador: it
   would have meant bolting the real client's name onto a stranger's stock
   headshot. So the chip shows his real name and role with a glyph avatar,
   and the lead swaps in a real photograph the day there is one:

       mountDashboard(root, { account: { photo: '…', alt: '…' } })

   Until then nothing on screen claims to be a photograph of him.
   ====================================================================== */

const ACCOUNT = {
  id: 'noah',
  name: 'Noah Salvador',
  role: 'Founder · managing principal',
  photo: null,
  alt: null,
};

/* ======================================================================
   navigation model

   `built: true`  — a real, working view.
   `built: false` — an honest "not in this demo" page. It says what the
                    section would hold rather than pretending it exists.
   ====================================================================== */

const NAV = [
  {
    section: 'Desk',
    items: [
      {
        id: 'overview',
        label: 'Overview',
        icon: 'overview',
        built: true,
        blurb: 'The numbers, the commission curve and what needs you today.',
      },
      {
        id: 'listings',
        label: 'Review queue',
        icon: 'listings',
        built: true,
        badge: () => countByStatus('review'),
        blurb: 'Approve or reject a listing before it goes live.',
      },
      {
        id: 'activity',
        label: 'Activity',
        icon: 'activity',
        built: true,
        blurb: 'Everything the team did, newest first.',
      },
    ],
  },
  {
    section: 'Money',
    items: [
      {
        id: 'finance',
        label: 'Finance',
        icon: 'payouts',
        built: true,
        badge: () => PAYOUTS.filter((p) => p.status === 'held').length,
        blurb: 'Commission splits and the October payout run.',
      },
      {
        id: 'statements',
        label: 'Statements',
        icon: 'document',
        built: false,
        blurb:
          'Month-end brokerage statements, one per agent, exportable for the ' +
          'accountant. Not part of this demo.',
      },
    ],
  },
  {
    section: 'People',
    items: [
      {
        id: 'team',
        label: 'Team',
        icon: 'team',
        built: false,
        blurb:
          'The roster with licence numbers and renewal dates, plus who is on ' +
          'floor duty this week. Not part of this demo.',
      },
      {
        id: 'access',
        label: 'Roles & access',
        icon: 'shield',
        built: false,
        blurb:
          'Who can publish a listing and who can only draft one. Not part of ' +
          'this demo.',
      },
    ],
  },
  {
    section: 'Workspace',
    items: [
      {
        id: 'offices',
        label: 'Offices',
        icon: 'offices',
        built: false,
        blurb:
          'Inventory, headcount and desk cost for each of the four offices. ' +
          'Not part of this demo.',
      },
      {
        id: 'documents',
        label: 'Documents',
        icon: 'folder',
        built: false,
        blurb:
          'Contracts and disclosures filed against the deal they belong to. ' +
          'Not part of this demo.',
      },
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings',
        built: false,
        blurb:
          'Review rules, the photo minimum, and who gets paged when a check ' +
          'fails. Not part of this demo.',
      },
    ],
  },
];

const NAV_ITEMS = NAV.flatMap((group) =>
  group.items.map((item) => ({ ...item, section: group.section })),
);

const navItem = (id) => NAV_ITEMS.find((item) => item.id === id);

/* ======================================================================
   state — a plain object plus render functions. That is the whole framework.
   ====================================================================== */

const S = {
  mounted: false,
  root: null,
  reduced: false,
  account: ACCOUNT,
  onClose: null,

  view: 'overview',
  query: '', // top-bar search, filters the active view

  listings: [], // working copy: `status` is mutable here, never in data.js
  listStatus: 'review',
  listKind: 'All',

  range: 6, // commission chart window, in months
  office: null, // donut filter, an OFFICES[].name or null

  palette: { open: false, query: '', index: 0, restore: null },
  notif: { open: false, restore: null },
};

/* teardown registry — everything that must be undone lands in here */
const bin = {
  listeners: [],
  rafs: new Set(),
  timers: new Set(),
  observers: [],
  anims: new Set(),
};

function on(target, type, handler, options) {
  if (!target) return;
  target.addEventListener(type, handler, options);
  bin.listeners.push([target, type, handler, options]);
}

function raf(fn) {
  const id = requestAnimationFrame((t) => {
    bin.rafs.delete(id);
    fn(t);
  });
  bin.rafs.add(id);
  return id;
}

function later(fn, ms) {
  const id = setTimeout(() => {
    bin.timers.delete(id);
    fn();
  }, ms);
  bin.timers.add(id);
  return id;
}

/** WAAPI with bookkeeping, so destroy can cancel anything still running. */
function animate(el, frames, options) {
  if (!el || S.reduced || typeof el.animate !== 'function') return null;
  const anim = el.animate(frames, options);
  bin.anims.add(anim);
  anim.addEventListener('finish', () => bin.anims.delete(anim));
  anim.addEventListener('cancel', () => bin.anims.delete(anim));
  return anim;
}

const $ = (sel) => S.root?.querySelector(sel) || null;
const $$ = (sel) => Array.from(S.root?.querySelectorAll(sel) || []);

const countByStatus = (status) =>
  S.listings.filter((l) => l.status === status).length;

/** One live region, used by every view that changes under the user. */
function say(message) {
  const live = $('.pl-live');
  if (live) live.textContent = message;
}

/* ======================================================================
   public API
   ====================================================================== */

export function mountDashboard(rootEl, opts = {}) {
  if (!rootEl) return;
  if (S.mounted) destroyDashboard();

  S.root = rootEl;
  S.reduced =
    opts.reducedMotion === true ||
    (typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches);
  S.account = { ...ACCOUNT, ...(opts.account || {}) };
  S.onClose = typeof opts.onClose === 'function' ? opts.onClose : null;

  S.view = 'overview';
  S.query = '';
  S.listStatus = 'review';
  S.listKind = 'All';
  S.range = 6;
  S.office = null;
  S.palette = { open: false, query: '', index: 0, restore: null };
  S.notif = { open: false, restore: null };
  /* a working copy, so approving something never mutates the data module */
  S.listings = LISTINGS.map((l) => ({ ...l }));

  rootEl.innerHTML = shell();
  rootEl.classList.add('pl-dash-host');
  S.mounted = true;

  wire();
  renderNav();
  renderView({ animateIn: false });
}

export function destroyDashboard() {
  for (const [target, type, handler, options] of bin.listeners) {
    target.removeEventListener(type, handler, options);
  }
  bin.listeners.length = 0;

  bin.rafs.forEach((id) => cancelAnimationFrame(id));
  bin.rafs.clear();
  bin.timers.forEach((id) => clearTimeout(id));
  bin.timers.clear();
  bin.observers.forEach((o) => o.disconnect?.());
  bin.observers.length = 0;
  bin.anims.forEach((a) => a.cancel?.());
  bin.anims.clear();

  document.documentElement.classList.remove('dash-overlay-open');

  if (S.root) {
    S.root.classList.remove('pl-dash-host');
    S.root.innerHTML = '';
  }
  S.root = null;
  S.mounted = false;
}

export function focusDashboard() {
  if (!S.mounted) return;
  const first = $('.pl-nav__btn') || $('.pl-search__input') || $('button');
  first?.focus?.({ preventScroll: true });
}

/* ======================================================================
   shell
   ====================================================================== */

function shell() {
  /* `is-reduced` mirrors the @media (prefers-reduced-motion: reduce) block
     in dashboard.css, so a host that passes { reducedMotion: true } without
     the OS preference being set also gets the final state, not a faster one. */
  return `
<div class="pl-dash${S.reduced ? ' is-reduced' : ''}" data-view="overview">
  <p class="pl-live u-visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>

  <nav class="pl-rail" aria-label="Workspace sections">
    <p class="pl-rail__mark">
      <span class="pl-rail__lamp" aria-hidden="true"></span>
      <span>
        <span class="pl-rail__name">PUTSOMESPECONIT</span>
        <span class="pl-rail__sub">Demo workspace</span>
      </span>
    </p>

    <div class="pl-nav" data-nav></div>

    <div class="pl-rail__foot">
      <button class="pl-kbd-hint" type="button" data-act="palette">
        ${ico('search', 14)}
        <span>Search or jump to</span>
        <kbd class="pl-kbd">⌘K</kbd>
      </button>
      <p class="pl-rail__notice">${esc(DEMO_NOTICE)}</p>
      <details class="pl-credits">
        <summary>Photography credits</summary>
        <ul>${CREDITS.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      </details>
    </div>
  </nav>

  <div class="pl-col">
    <header class="pl-top">
      <div class="pl-search">
        <label class="u-visually-hidden" for="pl-q">Search the current view</label>
        ${ico('search', 16)}
        <input class="pl-search__input" id="pl-q" type="search"
               placeholder="Filter this view…" autocomplete="off" spellcheck="false" />
        <kbd class="pl-kbd pl-search__kbd">⌘K</kbd>
      </div>

      <div class="pl-top__right">
        <button class="pl-iconbtn" type="button" data-act="palette"
                aria-label="Open the command palette">${ico('signpost', 17)}</button>

        <button class="pl-iconbtn pl-bell" type="button" data-act="notif"
                aria-expanded="false" aria-controls="pl-notif"
                aria-label="Notifications">
          ${ico('bell', 17)}
          <span class="pl-bell__dot" aria-hidden="true"></span>
        </button>

        ${accountChip()}
      </div>

      ${notifPopover()}
    </header>

    <section class="pl-panel" aria-label="Workspace">
      <div class="pl-view" data-view-body></div>
    </section>
  </div>

  ${paletteMarkup()}
</div>`;
}

function accountChip() {
  const a = S.account;
  const avatar = a.photo
    ? `<img class="pl-chip__img" src="${esc(a.photo)}" alt="${esc(
        a.alt || `${a.name}, ${a.role}`,
      )}" width="34" height="34" loading="lazy" decoding="async" />`
    : /* No stock face stands in for a real person — see the ACCOUNT note. */
      `<span class="pl-chip__glyph" data-needs-photo="true">${ico('agent', 18)}</span>`;
  return `
<div class="pl-chip">
  ${avatar}
  <span class="pl-chip__text">
    <span class="pl-chip__name">${esc(a.name)}</span>
    <span class="pl-chip__role">${esc(a.role)}</span>
  </span>
</div>`;
}

/* ======================================================================
   notifications popover — real popover behaviour: Esc closes, an outside
   click closes, focus goes in on open and back to the bell on close.
   Content is TASKS due today plus the three newest ACTIVITY rows.
   ====================================================================== */

function notifPopover() {
  const today = TASKS.filter((t) => t.due === 'Today');
  const recent = ACTIVITY.slice(0, 3);

  const taskRows = today
    .map((t) => {
      const who = agentById(t.agentId);
      return `
<li class="pl-pop__row">
  <span class="pl-pop__ico pl-pop__ico--warn">${ico('warn', 16)}</span>
  <span>
    <span class="pl-pop__text">${esc(t.text)}</span>
    <span class="pl-pop__meta">Due today${who ? ` · ${esc(who.name)}` : ''}</span>
  </span>
</li>`;
    })
    .join('');

  const actRows = recent
    .map(
      (a) => `
<li class="pl-pop__row">
  <span class="pl-pop__ico">${ico(a.icon, 16)}</span>
  <span>
    <span class="pl-pop__text">${esc(a.text)}</span>
    <span class="pl-pop__meta">${esc(a.at)}</span>
  </span>
</li>`,
    )
    .join('');

  return `
<div class="pl-pop" id="pl-notif" role="dialog" aria-label="Notifications" hidden>
  <p class="pl-pop__head">
    <span>${plural(today.length, 'item needs', 'items need')} you today</span>
    <button class="pl-pop__close" type="button" data-act="notif-close"
            aria-label="Close notifications">${ico('close', 15)}</button>
  </p>
  <ul class="pl-pop__list">${taskRows}</ul>
  <p class="pl-pop__sep">Just happened</p>
  <ul class="pl-pop__list">${actRows}</ul>
  <button class="pl-btn pl-btn--wide" type="button" data-act="nav" data-id="activity">
    Open the full activity log ${ico('enter', 14)}
  </button>
</div>`;
}

/* ======================================================================
   command palette — the standout interaction.
   Filterable list of every nav destination plus a handful of real actions.
   Arrow keys move, Enter runs, Esc closes, Tab is trapped while open, and
   focus returns to whatever opened it.
   ====================================================================== */

function paletteActions() {
  const rows = NAV_ITEMS.map((item) => ({
    id: `go:${item.id}`,
    label: item.label,
    hint: item.built ? item.section : `${item.section} · not in this demo`,
    icon: item.icon,
    run: () => setView(item.id),
  }));

  rows.push(
    {
      id: 'act:approve-ready',
      label: 'Approve every listing that passes its checks',
      hint: 'Review queue',
      icon: 'pass',
      run: () => approveReady(),
    },
    {
      id: 'act:flagged',
      label: 'Show only the listings with a failing check',
      hint: 'Review queue',
      icon: 'warn',
      run: () => {
        S.listStatus = 'review';
        S.listKind = 'All';
        setView('listings');
      },
    },
    {
      id: 'act:leases',
      label: 'Show leases only',
      hint: 'Review queue',
      icon: 'keys',
      run: () => {
        S.listKind = 'Lease';
        setView('listings');
      },
    },
    {
      id: 'act:range-3',
      label: 'Commission over the last 3 months',
      hint: 'Overview',
      icon: 'pipeline',
      run: () => {
        S.range = 3;
        setView('overview');
      },
    },
    {
      id: 'act:range-9',
      label: 'Commission over the last 9 months',
      hint: 'Overview',
      icon: 'pipeline',
      run: () => {
        S.range = 9;
        setView('overview');
      },
    },
    {
      id: 'act:held',
      label: 'Find the payout on hold',
      hint: 'Finance',
      icon: 'money',
      run: () => {
        setView('finance');
        later(() => $('.pl-row--held')?.scrollIntoView({ block: 'center' }), 60);
      },
    },
    {
      id: 'act:clear',
      label: 'Clear the filter on this view',
      hint: 'Everywhere',
      icon: 'refresh',
      run: () => {
        S.query = '';
        const input = $('.pl-search__input');
        if (input) input.value = '';
        S.office = null;
        renderView({ animateIn: false });
        say('Filter cleared.');
      },
    },
  );

  if (S.onClose) {
    rows.push({
      id: 'act:close',
      label: 'Close the workspace and go back to the porch',
      hint: 'Workspace',
      icon: 'door',
      run: () => S.onClose(),
    });
  }
  return rows;
}

function paletteMarkup() {
  return `
<div class="pl-cmd" hidden>
  <div class="pl-cmd__scrim" data-act="cmd-close"></div>
  <div class="pl-cmd__box" role="dialog" aria-modal="true" aria-label="Command palette">
    <div class="pl-cmd__field">
      ${ico('search', 18)}
      <label class="u-visually-hidden" for="pl-cmd-q">Search commands and sections</label>
      <input class="pl-cmd__input" id="pl-cmd-q" type="text" role="combobox"
             autocomplete="off" spellcheck="false" aria-expanded="true"
             aria-controls="pl-cmd-list" aria-autocomplete="list"
             placeholder="Jump to a section, or run something…" />
      <kbd class="pl-kbd">Esc</kbd>
    </div>
    <ul class="pl-cmd__list" id="pl-cmd-list" role="listbox"
        aria-label="Commands and sections"></ul>
    <p class="pl-cmd__foot">
      <span><kbd class="pl-kbd">↑</kbd><kbd class="pl-kbd">↓</kbd> move</span>
      <span><kbd class="pl-kbd">Enter</kbd> run</span>
      <span><kbd class="pl-kbd">Esc</kbd> close</span>
    </p>
  </div>
</div>`;
}

function paletteMatches() {
  const q = S.palette.query.trim().toLowerCase();
  const all = paletteActions();
  if (!q) return all;
  return all.filter((row) =>
    `${row.label} ${row.hint}`.toLowerCase().includes(q),
  );
}

function renderPalette() {
  const list = $('.pl-cmd__list');
  const input = $('.pl-cmd__input');
  if (!list) return;
  const rows = paletteMatches();
  if (S.palette.index >= rows.length) S.palette.index = Math.max(0, rows.length - 1);

  list.innerHTML = rows.length
    ? rows
        .map((row, i) => {
          const active = i === S.palette.index;
          return `
<li class="pl-cmd__row${active ? ' is-active' : ''}" role="option"
    id="pl-cmd-opt-${i}" aria-selected="${active}" data-act="cmd-run" data-i="${i}">
  <span class="pl-cmd__ico">${ico(row.icon, 17)}</span>
  <span class="pl-cmd__label">${esc(row.label)}</span>
  <span class="pl-cmd__hint">${esc(row.hint)}</span>
</li>`;
        })
        .join('')
    : `<li class="pl-cmd__empty">Nothing matches that. Try “payout”, “lease” or “settings”.</li>`;

  if (input) {
    input.setAttribute(
      'aria-activedescendant',
      rows.length ? `pl-cmd-opt-${S.palette.index}` : '',
    );
  }
  list.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
}

function openPalette() {
  if (S.palette.open) return;
  S.palette.open = true;
  S.palette.query = '';
  S.palette.index = 0;
  S.palette.restore =
    document.activeElement && S.root?.contains(document.activeElement)
      ? document.activeElement
      : null;

  const cmd = $('.pl-cmd');
  const input = $('.pl-cmd__input');
  if (!cmd) return;
  cmd.hidden = false;
  if (input) input.value = '';
  document.documentElement.classList.add('dash-overlay-open');
  renderPalette();
  input?.focus();
  animate(
    $('.pl-cmd__box'),
    [
      { opacity: 0, transform: 'translateY(-10px) scale(0.985)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ],
    { duration: 220, easing: 'cubic-bezier(0.22,1,0.36,1)' },
  );
}

function closePalette() {
  if (!S.palette.open) return;
  S.palette.open = false;
  const cmd = $('.pl-cmd');
  if (cmd) cmd.hidden = true;
  if (!S.notif.open) {
    document.documentElement.classList.remove('dash-overlay-open');
  }
  const back = S.palette.restore;
  S.palette.restore = null;
  if (back && S.root?.contains(back)) back.focus({ preventScroll: true });
  else focusDashboard();
}

function runPaletteRow(i) {
  const rows = paletteMatches();
  const row = rows[i];
  if (!row) return;
  closePalette();
  row.run();
}

/* ======================================================================
   notifications open/close
   ====================================================================== */

function openNotif() {
  if (S.notif.open) return;
  S.notif.open = true;
  S.notif.restore = $('.pl-bell');
  const pop = $('.pl-pop');
  if (pop) pop.hidden = false;
  $('.pl-bell')?.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('dash-overlay-open');
  animate(
    pop,
    [
      { opacity: 0, transform: 'translateY(-8px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ],
    { duration: 180, easing: 'cubic-bezier(0.22,1,0.36,1)' },
  );
  later(() => pop?.querySelector('.pl-pop__close')?.focus(), S.reduced ? 0 : 60);
}

function closeNotif({ restore = true } = {}) {
  if (!S.notif.open) return;
  S.notif.open = false;
  const pop = $('.pl-pop');
  if (pop) pop.hidden = true;
  $('.pl-bell')?.setAttribute('aria-expanded', 'false');
  if (!S.palette.open) {
    document.documentElement.classList.remove('dash-overlay-open');
  }
  const back = S.notif.restore;
  S.notif.restore = null;
  if (restore && back && S.root?.contains(back)) {
    back.focus({ preventScroll: true });
  }
}

/* ======================================================================
   wiring — delegation, so there are only a handful of listeners to remove
   ====================================================================== */

function wire() {
  on(S.root, 'click', onClick);
  on(S.root, 'input', onInput);
  on(S.root, 'keydown', onRootKey);
  on(document, 'keydown', onDocKey, true);
  on(document, 'pointerdown', onDocPointer, true);

  /* chart tooltip: one listener per chart surface, delegated to the bars */
  on(S.root, 'pointerover', onChartHover);
  on(S.root, 'pointerleave', onChartLeave, true);
}

function onClick(e) {
  const hit = e.target.closest('[data-act]');
  if (!hit || !S.root.contains(hit)) return;
  const act = hit.dataset.act;

  switch (act) {
    case 'nav':
      closeNotif({ restore: false });
      setView(hit.dataset.id);
      break;

    case 'palette':
      openPalette();
      break;

    case 'cmd-close':
      closePalette();
      break;

    case 'cmd-run':
      runPaletteRow(Number(hit.dataset.i));
      break;

    case 'notif':
      S.notif.open ? closeNotif() : openNotif();
      break;

    case 'notif-close':
      closeNotif();
      break;

    case 'range':
      S.range = Number(hit.dataset.v);
      renderOverviewChart();
      say(`Commission chart now shows ${S.range} months.`);
      break;

    case 'office': {
      const name = hit.dataset.name;
      S.office = S.office === name ? null : name;
      renderOverviewDonut();
      say(
        S.office
          ? `Filtered to the ${S.office} office.`
          : 'Office filter cleared.',
      );
      break;
    }

    case 'status':
      S.listStatus = hit.dataset.v;
      renderListings();
      break;

    case 'kind':
      S.listKind = hit.dataset.v;
      renderListings();
      break;

    case 'approve':
      moveListing(hit.dataset.id, 'approved');
      break;

    case 'reject':
      moveListing(hit.dataset.id, 'rejected');
      break;

    case 'restore':
      moveListing(hit.dataset.id, 'review');
      break;

    case 'approve-ready':
      approveReady();
      break;

    default:
      break;
  }
}

function onInput(e) {
  if (e.target.matches('.pl-search__input')) {
    S.query = e.target.value;
    refreshFilterables();
    return;
  }
  if (e.target.matches('.pl-cmd__input')) {
    S.palette.query = e.target.value;
    S.palette.index = 0;
    renderPalette();
  }
}

/** Keys that only matter while focus is inside the dashboard. */
function onRootKey(e) {
  if (S.palette.open) {
    paletteKeys(e);
    return;
  }
  if (S.notif.open && e.key === 'Tab') {
    trapTab(e, $('.pl-pop'));
  }
  /* the rail/tab strip is arrow-key operable */
  if (
    (e.key === 'ArrowDown' || e.key === 'ArrowUp' ||
      e.key === 'ArrowRight' || e.key === 'ArrowLeft') &&
    e.target.closest('.pl-nav')
  ) {
    const buttons = $$('.pl-nav__btn');
    const i = buttons.indexOf(e.target);
    if (i === -1) return;
    const forward = e.key === 'ArrowDown' || e.key === 'ArrowRight';
    const next = buttons[(i + (forward ? 1 : -1) + buttons.length) % buttons.length];
    e.preventDefault();
    next?.focus();
  }
}

/** Keys that must work wherever focus is: the palette shortcut and Escape. */
function onDocKey(e) {
  if (!S.mounted) return;

  if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
    e.preventDefault();
    e.stopPropagation();
    S.palette.open ? closePalette() : openPalette();
    return;
  }

  if (e.key === 'Escape') {
    if (S.palette.open) {
      e.preventDefault();
      e.stopPropagation();
      closePalette();
      return;
    }
    if (S.notif.open) {
      e.preventDefault();
      e.stopPropagation();
      closeNotif();
    }
    /* otherwise Escape belongs to app.js, which closes the whole layer */
  }
}

function paletteKeys(e) {
  const rows = paletteMatches();
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    if (!rows.length) return;
    const step = e.key === 'ArrowDown' ? 1 : -1;
    S.palette.index = (S.palette.index + step + rows.length) % rows.length;
    renderPalette();
    return;
  }
  if (e.key === 'Home' || e.key === 'End') {
    e.preventDefault();
    S.palette.index = e.key === 'Home' ? 0 : Math.max(0, rows.length - 1);
    renderPalette();
    return;
  }
  if (e.key === 'Enter') {
    e.preventDefault();
    runPaletteRow(S.palette.index);
    return;
  }
  if (e.key === 'Tab') trapTab(e, $('.pl-cmd__box'));
}

function trapTab(e, container) {
  if (!container) return;
  const focusables = Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function onDocPointer(e) {
  if (!S.mounted) return;
  if (S.notif.open) {
    const pop = $('.pl-pop');
    const bell = $('.pl-bell');
    if (pop && !pop.contains(e.target) && !bell?.contains(e.target)) {
      closeNotif({ restore: false });
    }
  }
}

/* ======================================================================
   views
   ====================================================================== */

function setView(id) {
  const item = navItem(id);
  if (!item || id === S.view) {
    if (item && id === S.view) {
      /* re-entering the same view still re-renders, so palette actions that
         change a filter are visible straight away */
      renderView({ animateIn: false });
      renderNav();
    }
    return;
  }
  S.view = id;
  S.query = '';
  const input = $('.pl-search__input');
  if (input) input.value = '';
  renderNav();
  renderView({ animateIn: true });
  say(`${item.label}. ${item.blurb}`);
}

function renderNav() {
  const host = $('[data-nav]');
  if (!host) return;
  host.innerHTML = NAV.map(
    (group) => `
<div class="pl-nav__group">
  <p class="pl-nav__section">${esc(group.section)}</p>
  <ul class="pl-nav__list">
    ${group.items
      .map((item) => {
        const active = item.id === S.view;
        const n = item.badge ? item.badge() : 0;
        return `
<li>
  <button class="pl-nav__btn${active ? ' is-active' : ''}" type="button"
          data-act="nav" data-id="${esc(item.id)}"
          aria-current="${active ? 'page' : 'false'}">
    ${ico(item.icon, 17)}
    <span class="pl-nav__label">${esc(item.label)}</span>
    ${
      n > 0
        ? `<span class="pl-badge">${n}<span class="u-visually-hidden"> waiting</span></span>`
        : item.built
          ? ''
          : `<span class="pl-nav__soon" aria-hidden="true">·</span>
             <span class="u-visually-hidden">not in this demo</span>`
    }
  </button>
</li>`;
      })
      .join('')}
  </ul>
</div>`,
  ).join('');
}

function renderView({ animateIn = true } = {}) {
  const body = $('[data-view-body]');
  if (!body) return;
  $('.pl-dash')?.setAttribute('data-view', S.view);

  const item = navItem(S.view);
  if (!item) return;

  if (!item.built) body.innerHTML = viewStub(item);
  else if (S.view === 'overview') body.innerHTML = viewOverview();
  else if (S.view === 'listings') body.innerHTML = viewListings();
  else if (S.view === 'finance') body.innerHTML = viewFinance();
  else if (S.view === 'activity') body.innerHTML = viewActivity();

  /* Post-render passes that need real nodes. Every view leaves an empty
     mount point for its list, so the top-bar search can refresh just that
     list later without rebuilding the charts. */
  if (S.view === 'overview') {
    renderOverviewChart();
    renderOverviewDonut();
    renderQueue();
    startCountUps();
  } else if (S.view === 'listings') {
    renderListings();
  } else if (S.view === 'finance') {
    renderPayouts();
    startCountUps();
  } else if (S.view === 'activity') {
    renderFeed();
  }

  if (animateIn && !S.reduced) {
    animate(
      body,
      [
        { opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' },
        { opacity: 1, transform: 'translateY(0)', filter: 'blur(0)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.22,1,0.36,1)' },
    );
  }
  $('.pl-panel')?.scrollTo?.({ top: 0 });
}

/** The top-bar search re-renders only the part of the view it filters. */
function refreshFilterables() {
  if (S.view === 'listings') renderListings();
  else if (S.view === 'overview') renderQueue();
  else if (S.view === 'finance') renderPayouts();
  else if (S.view === 'activity') renderFeed();
  else say('This section has nothing to filter.');
}

function pageHead(title, sub, actions = '') {
  return `
<div class="pl-head">
  <div>
    <h2 class="pl-head__title">${title}</h2>
    <p class="pl-head__sub">${sub}</p>
  </div>
  ${actions ? `<div class="pl-head__actions">${actions}</div>` : ''}
</div>`;
}

/* ----------------------------------------------------------------------
   Overview
   ------------------------------------------------------------------- */

function viewOverview() {
  const need = TASKS.length;
  return `
${pageHead(
  `${esc(greeting())}, ${esc(S.account.name.split(' ')[0])}.`,
  `${esc(todayLabel())} · ${plural(need, 'thing needs', 'things need')} you`,
  `
<button class="pl-btn" type="button" data-act="nav" data-id="activity">
  ${ico('time', 14)} Activity log
</button>
<button class="pl-btn pl-btn--solid" type="button" data-act="nav" data-id="listings">
  ${ico('pass', 14)} Work the queue
</button>`,
)}

<div class="pl-grid pl-grid--kpi">
  ${STATS.map((s, i) => kpiTile(s, i)).join('')}
</div>

<div class="pl-grid pl-grid--charts">
  <section class="pl-card pl-card--chart" aria-labelledby="pl-ch-commission">
    <div class="pl-card__head">
      <div>
        <h3 class="pl-card__title" id="pl-ch-commission">Commission booked</h3>
        <p class="pl-card__sub" data-chart-sub></p>
      </div>
      <div class="pl-seg" role="group" aria-label="Chart window">
        ${[3, 6, 9]
          .map(
            (n) => `
<button class="pl-seg__btn" type="button" data-act="range" data-v="${n}"
        aria-pressed="${S.range === n}">${n} mo</button>`,
          )
          .join('')}
      </div>
    </div>
    <div class="pl-chart" data-chart></div>
  </section>

  <section class="pl-card pl-card--donut" aria-labelledby="pl-ch-offices">
    <h3 class="pl-card__title" id="pl-ch-offices">Office mix</h3>
    <p class="pl-card__sub">Share of the 142 active listings. Pick an office to isolate it.</p>
    <div class="pl-donut" data-donut></div>
  </section>
</div>

<section class="pl-card" aria-labelledby="pl-queue-title">
  <div class="pl-card__head">
    <div>
      <h3 class="pl-card__title" id="pl-queue-title">Needs your attention</h3>
      <p class="pl-card__sub">Six open items across compliance, listings, clients and finance.</p>
    </div>
  </div>
  <div data-queue></div>
</section>`;
}

function kpiTile(stat, i) {
  const up = stat.change > 0;
  return `
<article class="pl-kpi" style="--i:${i}">
  <div class="pl-kpi__top">
    <span class="pl-kpi__ico">${ico(stat.icon, 18)}</span>
    ${
      typeof stat.change === 'number'
        ? `<span class="pl-delta ${up ? 'is-up' : 'is-down'}">
             ${ico(up ? 'up' : 'down', 13)}
             <span>${esc(formatChange(stat.change))}</span>
           </span>`
        : ''
    }
  </div>
  <p class="pl-kpi__value" data-count="${stat.id}">${esc(formatStat(stat))}</p>
  <p class="pl-kpi__label">${esc(stat.label)}</p>
  <p class="pl-kpi__sub">${esc(stat.sub)}</p>
</article>`;
}

/** Count-up. Under reduced motion the markup already holds the final number,
 *  so this does nothing at all — no faster animation, no animation. */
function startCountUps() {
  if (S.reduced) return;
  $$('[data-count]').forEach((el, i) => {
    const stat = statFor(el.dataset.count);
    if (!stat) return;
    const target = Number(stat.value);
    const duration = 900 + i * 55;
    const t0 = performance.now();
    el.classList.add('is-counting');
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatStat(stat, target * eased);
      if (p < 1) raf(tick);
      else {
        el.textContent = formatStat(stat);
        el.classList.remove('is-counting');
      }
    };
    el.textContent = formatStat(stat, 0);
    raf(tick);
  });
}

/** KPI tiles come from STATS on the overview and from FINANCE_TILES on the
 *  finance page; both carry the same prefix/suffix/decimals shape. */
function statFor(id) {
  return (
    STATS.find((s) => s.id === id) || financeTiles().find((s) => s.id === id)
  );
}

/* --- commission bar chart ------------------------------------------- */

function renderOverviewChart() {
  const host = $('[data-chart]');
  if (!host) return;
  $$('.pl-seg__btn').forEach((b) => {
    if (b.dataset.act === 'range') {
      b.setAttribute('aria-pressed', String(Number(b.dataset.v) === S.range));
    }
  });

  const data = PIPELINE.slice(-S.range);
  const total = data.reduce((sum, d) => sum + d.v, 0);
  const peak = Math.max(...data.map((d) => d.v));
  const top = Math.ceil(peak / 20) * 20; // axis tops out on a round number
  const ticks = [];
  for (let v = 0; v <= top; v += 20) ticks.push(v);

  const sub = $('[data-chart-sub]');
  if (sub) {
    sub.textContent =
      `$${total.toFixed(1)}K over ${plural(data.length, 'month', 'months')}` +
      ` · ${data[0].m} to ${data[data.length - 1].m}`;
  }

  /* viewBox coordinates. The SVG scales with the card, so the type scales
     with it too and nothing needs a resize observer. */
  const W = 720;
  const H = 260;
  const padL = 54;
  const padR = 10;
  const padT = 18;
  const padB = 34;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const slot = plotW / data.length;
  const barW = Math.min(46, slot * 0.54);

  const y = (v) => padT + plotH - (v / top) * plotH;

  const gridline = ticks
    .map(
      (v) => `
<line class="pl-chart__grid" x1="${padL}" x2="${W - padR}" y1="${y(v).toFixed(1)}"
      y2="${y(v).toFixed(1)}" />
<text class="pl-chart__ytick" x="${padL - 10}" y="${(y(v) + 4).toFixed(1)}"
      text-anchor="end">$${v}K</text>`,
    )
    .join('');

  const bars = data
    .map((d, i) => {
      const cx = padL + slot * i + slot / 2;
      const h = Math.max(2, (d.v / top) * plotH);
      const last = i === data.length - 1;
      return `
<g class="pl-bar${last ? ' is-last' : ''}" data-bar="${i}"
   data-label="${esc(d.m)}" data-value="$${d.v.toFixed(1)}K">
  <rect class="pl-bar__hit" x="${(cx - slot / 2).toFixed(1)}" y="${padT}"
        width="${slot.toFixed(1)}" height="${plotH}" />
  <rect class="pl-bar__fill" x="${(cx - barW / 2).toFixed(1)}"
        y="${(padT + plotH - h).toFixed(1)}" width="${barW.toFixed(1)}"
        height="${h.toFixed(1)}" rx="5"
        style="--grow:${(h / plotH).toFixed(4)};--d:${(i * 55)}ms" />
  <text class="pl-chart__xtick" x="${cx.toFixed(1)}" y="${H - 12}"
        text-anchor="middle">${esc(d.m)}</text>
</g>`;
    })
    .join('');

  host.innerHTML = `
<div class="pl-chart__wrap">
  <svg class="pl-chart__svg${S.reduced ? ' is-static' : ''}"
       viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">
    ${gridline}
    <line class="pl-chart__axis" x1="${padL}" x2="${W - padR}"
          y1="${(padT + plotH).toFixed(1)}" y2="${(padT + plotH).toFixed(1)}" />
    ${bars}
  </svg>
  <div class="pl-tip" data-tip hidden></div>
</div>
<!-- The accessible copy of the graphic. It is wrapped in a div because a
     <table> ignores width:1px and expands to its min-content width, which
     would give the panel a stray horizontal scrollbar. -->
<div class="u-visually-hidden">
  <table>
    <caption>Commission booked per month, in thousands of US dollars. Demo data.</caption>
    <thead><tr><th scope="col">Month</th><th scope="col">Commission booked</th></tr></thead>
    <tbody>
      ${data
        .map(
          (d) =>
            `<tr><th scope="row">${esc(d.m)}</th><td>$${d.v.toFixed(1)}K</td></tr>`,
        )
        .join('')}
    </tbody>
    <tfoot><tr><th scope="row">Total</th><td>$${total.toFixed(1)}K</td></tr></tfoot>
  </table>
</div>`;
}

function onChartHover(e) {
  const bar = e.target.closest?.('.pl-bar');
  if (!bar || !S.root.contains(bar)) return;
  const wrap = bar.closest('.pl-chart__wrap');
  const tip = wrap?.querySelector('[data-tip]');
  if (!tip) return;
  const fill = bar.querySelector('.pl-bar__fill');
  const a = fill.getBoundingClientRect();
  const b = wrap.getBoundingClientRect();
  tip.textContent = `${bar.dataset.label} · ${bar.dataset.value}`;
  tip.hidden = false;
  tip.style.left = `${a.left - b.left + a.width / 2}px`;
  tip.style.top = `${a.top - b.top}px`;
  wrap.classList.add('is-hovered');
  $$('.pl-bar').forEach((g) => g.classList.toggle('is-dim', g !== bar));
}

function onChartLeave(e) {
  const wrap = e.target.closest?.('.pl-chart__wrap');
  if (!wrap) return;
  wrap.querySelector('[data-tip]')?.setAttribute('hidden', '');
  wrap.classList.remove('is-hovered');
  $$('.pl-bar').forEach((g) => g.classList.remove('is-dim'));
}

/* --- office donut ---------------------------------------------------- */

function renderOverviewDonut() {
  const host = $('[data-donut]');
  if (!host) return;

  const total = OFFICES.reduce((sum, o) => sum + o.value, 0);
  const R = 56;
  const C = 2 * Math.PI * R;
  const GAP = 7;
  const active = S.office ? OFFICES.find((o) => o.name === S.office) : null;

  /* Active listings is a KPI, not a per-office figure, so an office's count
     is an estimate off its share. Say so rather than fake the precision. */
  const activeListings = STATS.find((s) => s.id === 'active')?.value ?? 0;
  const centreTop = active ? `${active.value}%` : `${total}%`;
  const centreSub = active
    ? `${active.name} · ≈${Math.round((active.value / 100) * activeListings)} listings`
    : 'four offices';

  let offset = 0;
  const segs = OFFICES.map((o, i) => {
    const len = (o.value / total) * C - GAP;
    const seg = `
<circle class="pl-donut__seg${active && active.name !== o.name ? ' is-dim' : ''}"
        cx="80" cy="80" r="${R}" fill="none" stroke="var(${o.token})"
        stroke-width="15" stroke-linecap="round"
        stroke-dasharray="${len.toFixed(2)} ${C.toFixed(2)}"
        stroke-dashoffset="${(-offset).toFixed(2)}"
        style="--len:${len.toFixed(2)};--circ:${C.toFixed(2)};--off:${(-offset).toFixed(2)};--d:${i * 110}ms" />`;
    offset += len + GAP;
    return seg;
  }).join('');

  host.innerHTML = `
<div class="pl-donut__ring">
  <svg viewBox="0 0 160 160" class="pl-donut__svg${S.reduced ? ' is-static' : ''}"
       aria-hidden="true" focusable="false">
    <g transform="rotate(-90 80 80)">${segs}</g>
  </svg>
  <p class="pl-donut__centre">
    <span class="pl-donut__big">${esc(centreTop)}</span>
    <span class="pl-donut__small">${esc(centreSub)}</span>
  </p>
</div>
<ul class="pl-legend">
  ${OFFICES.map(
    (o) => `
<li>
  <button class="pl-legend__btn${active && active.name === o.name ? ' is-on' : ''}"
          type="button" data-act="office" data-name="${esc(o.name)}"
          aria-pressed="${active ? active.name === o.name : false}">
    <span class="pl-legend__swatch" style="background:var(${o.token})" aria-hidden="true"></span>
    <span class="pl-legend__name">${esc(o.name)}</span>
    <span class="pl-legend__val">${o.value}%</span>
  </button>
</li>`,
  ).join('')}
</ul>
<div class="u-visually-hidden">
  <table>
    <caption>Share of active listings by office. Demo data.</caption>
    <thead><tr><th scope="col">Office</th><th scope="col">Share of active listings</th></tr></thead>
    <tbody>
      ${OFFICES.map(
        (o) => `<tr><th scope="row">${esc(o.name)}</th><td>${o.value}%</td></tr>`,
      ).join('')}
    </tbody>
  </table>
</div>`;

  if (!S.reduced) {
    host.querySelectorAll('.pl-donut__seg').forEach((seg) => {
      const len = Number(seg.style.getPropertyValue('--len'));
      const circ = Number(seg.style.getPropertyValue('--circ'));
      const off = Number(seg.style.getPropertyValue('--off'));
      const delay = seg.style.getPropertyValue('--d');
      animate(
        seg,
        [
          { strokeDasharray: `0 ${circ}`, strokeDashoffset: off },
          { strokeDasharray: `${len} ${circ}`, strokeDashoffset: off },
        ],
        {
          duration: 700,
          delay: parseFloat(delay) || 0,
          easing: 'cubic-bezier(0.22,1,0.36,1)',
        },
      );
    });
  }
}

/* --- attention queue ------------------------------------------------- */

const KIND_ICON = {
  compliance: 'shield',
  listing: 'listings',
  client: 'phone',
  finance: 'money',
};

function renderQueue() {
  const host = $('[data-queue]');
  if (!host) return;
  const q = S.query.trim();
  const rows = TASKS.filter((t) => {
    if (!q) return true;
    const who = agentById(t.agentId)?.name || '';
    return hasText(`${t.text} ${t.kind} ${t.due} ${who}`, q);
  });

  if (!rows.length) {
    host.innerHTML = emptyState(
      'tasks',
      'Nothing in the queue matches that',
      `No open item mentions “${esc(q)}”. Clear the filter to see all six.`,
    );
    say('No tasks match that filter.');
    return;
  }

  host.innerHTML = `
<ul class="pl-queue">
  ${rows
    .map((t, i) => {
      const who = agentById(t.agentId);
      const soon = t.due === 'Today';
      return `
<li class="pl-queue__row" style="--i:${i}">
  <span class="pl-queue__ico pl-queue__ico--${esc(t.kind)}">
    ${ico(KIND_ICON[t.kind] || 'tasks', 17)}
  </span>
  <span class="pl-queue__body">
    <span class="pl-queue__text">${esc(t.text)}</span>
    <span class="pl-queue__meta">
      <span class="pl-tag">${esc(t.kind)}</span>
      ${who ? `<span>${esc(who.name)} · ${esc(who.role)}</span>` : ''}
    </span>
  </span>
  <span class="pl-due${soon ? ' is-soon' : ''}">${esc(t.due)}</span>
</li>`;
    })
    .join('')}
</ul>`;
  if (q) say(`${plural(rows.length, 'open item', 'open items')} match “${q}”.`);
}

/* ----------------------------------------------------------------------
   Review queue (listings + moderation)
   ------------------------------------------------------------------- */

const STATUS_LABEL = {
  review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function viewListings() {
  return `
${pageHead(
  'Review queue',
  'Every listing is checked against the review rules before it can go live.',
  `
<button class="pl-btn" type="button" data-act="palette">
  ${ico('filter', 14)} Commands
</button>
<button class="pl-btn pl-btn--solid" type="button" data-act="approve-ready">
  ${ico('pass', 14)} Approve the clean ones
</button>`,
)}

<div class="pl-filters">
  <div class="pl-seg" role="group" aria-label="Listing status" data-status-seg></div>
  <div class="pl-seg pl-seg--quiet" role="group" aria-label="Listing kind">
    ${['All', 'Sale', 'Lease']
      .map(
        (k) => `
<button class="pl-seg__btn" type="button" data-act="kind" data-v="${k}"
        aria-pressed="${S.listKind === k}">${k}</button>`,
      )
      .join('')}
  </div>
</div>

<div data-listings></div>`;
}

function renderListings() {
  renderStatusSeg();
  $$('.pl-seg__btn').forEach((b) => {
    if (b.dataset.act === 'kind') {
      b.setAttribute('aria-pressed', String(b.dataset.v === S.listKind));
    }
  });

  const host = $('[data-listings]');
  if (!host) return;
  const q = S.query.trim();

  const rows = S.listings.filter((l) => {
    if (l.status !== S.listStatus) return false;
    if (S.listKind !== 'All' && l.kind !== S.listKind) return false;
    if (!q) return true;
    const who = agentById(l.agentId)?.name || '';
    return hasText(
      `${l.id} ${l.title} ${l.address} ${l.neighbourhood} ${who}`,
      q,
    );
  });

  if (!rows.length) {
    const filtered = Boolean(q) || S.listKind !== 'All';
    const label = STATUS_LABEL[S.listStatus].toLowerCase();
    host.innerHTML = emptyState(
      filtered ? 'filter' : S.listStatus === 'review' ? 'celebrate' : 'tasks',
      filtered
        ? 'Nothing matches that filter'
        : S.listStatus === 'review'
          ? 'Queue clear'
          : `Nothing ${esc(label)} yet`,
      filtered
        ? `No ${esc(label)} listing matches the filter you have on. Widen it and they come back.`
        : S.listStatus === 'review'
          ? 'Every listing has had a decision. New ones land here as agents submit them.'
          : 'Listings show up here once you have made a decision on them.',
    );
    say(
      filtered
        ? 'No listings match that filter.'
        : `No listings are ${label} right now.`,
    );
    return;
  }

  host.innerHTML = `
<div class="pl-grid pl-grid--cards">
  ${rows.map((l, i) => listingCard(l, i)).join('')}
</div>`;
}

function renderStatusSeg() {
  const host = $('[data-status-seg]');
  if (!host) return;
  host.innerHTML = ['review', 'approved', 'rejected']
    .map(
      (s) => `
<button class="pl-seg__btn" type="button" data-act="status" data-v="${s}"
        aria-pressed="${S.listStatus === s}">
  ${STATUS_LABEL[s]}
  <span class="pl-seg__count">${countByStatus(s)}</span>
</button>`,
    )
    .join('');
}

function listingCard(l, i) {
  const who = agentById(l.agentId);
  const clean = l.flags.length === 0;
  return `
<article class="pl-listing" style="--i:${i}" data-card="${esc(l.id)}">
  <div class="pl-listing__media">
    <img src="${esc(l.img)}" alt="${esc(l.alt)}" width="480" height="300"
         loading="lazy" decoding="async"
         onerror="this.closest('.pl-listing__media').classList.add('is-broken');this.remove()" />
    <span class="pl-listing__fallback" aria-hidden="true">${ico('listings', 26)}</span>
    <span class="pl-pill pl-pill--status is-${esc(l.status)}">
      ${esc(STATUS_LABEL[l.status])}
    </span>
    <span class="pl-pill pl-pill--count">${ico('photos', 12)} ${l.photos}</span>
    <span class="pl-pill pl-pill--kind">${esc(l.kind)}</span>
  </div>

  <div class="pl-listing__body">
    <p class="pl-listing__price">${esc(formatPrice(l))}</p>
    <h4 class="pl-listing__title">${esc(l.title)}</h4>
    <p class="pl-listing__addr">${ico('location', 13)} ${esc(l.address)}</p>

    <ul class="pl-specs">
      <li>${ico('beds', 13)} ${l.beds} bd</li>
      <li>${ico('baths', 13)} ${l.baths} ba</li>
      <li>${ico('area', 13)} ${esc(formatSqft(l.sqft))}</li>
    </ul>

    <div class="pl-listing__agent">
      ${
        who
          ? `<img class="pl-avatar" src="${esc(who.photo)}" alt="${esc(who.alt)}"
                  width="30" height="30" loading="lazy" decoding="async" />
             <span>
               <span class="pl-listing__who">${esc(who.name)}</span>
               <span class="pl-listing__meta">${esc(l.id)} · ${plural(l.age, 'day', 'days')} in queue</span>
             </span>`
          : `<span class="pl-listing__meta">${esc(l.id)}</span>`
      }
    </div>

    <ul class="pl-flags">
      ${
        clean
          ? `<li class="pl-flag is-ok">${ico('pass', 12)} All checks passed</li>`
          : l.flags
              .map(
                (f) =>
                  `<li class="pl-flag is-warn">${ico('warn', 12)} ${esc(f)}</li>`,
              )
              .join('')
      }
    </ul>

    <div class="pl-listing__actions">
      ${
        l.status === 'review'
          ? `
<button class="pl-btn pl-btn--danger" type="button" data-act="reject" data-id="${esc(l.id)}">
  ${ico('fail', 13)} Reject
</button>
<button class="pl-btn pl-btn--solid" type="button" data-act="approve" data-id="${esc(l.id)}">
  ${ico('pass', 13)} Approve
</button>`
          : `
<button class="pl-btn pl-btn--wide" type="button" data-act="restore" data-id="${esc(l.id)}">
  ${ico('refresh', 13)} Send back to review
</button>`
      }
    </div>
  </div>
</article>`;
}

/** Move a listing between tabs. The leaving card plays a CSS transition
 *  first (no FLIP, no layout measuring), then the grid re-renders. */
function moveListing(id, status) {
  const item = S.listings.find((l) => l.id === id);
  if (!item || item.status === status) return;
  const from = STATUS_LABEL[item.status];
  item.status = status;

  const card = S.root.querySelector(`[data-card="${CSS.escape(id)}"]`);
  const finish = () => {
    renderStatusSeg();
    renderNav();
    renderListings();
    say(
      `${item.title}. Moved from ${from} to ${STATUS_LABEL[status]}. ` +
        `${plural(countByStatus('review'), 'listing', 'listings')} still in review.`,
    );
  };

  if (card && !S.reduced) {
    card.classList.add('is-leaving');
    later(finish, 240);
  } else {
    finish();
  }
}

function approveReady() {
  const ready = S.listings.filter(
    (l) => l.status === 'review' && l.flags.length === 0,
  );
  if (S.view !== 'listings') setView('listings');
  if (!ready.length) {
    say('Nothing in review passes every check right now, so nothing was approved.');
    return;
  }
  ready.forEach((l) => {
    l.status = 'approved';
  });
  renderStatusSeg();
  renderNav();
  renderListings();
  say(
    `${plural(ready.length, 'listing', 'listings')} approved — every check had passed. ` +
      `${plural(countByStatus('review'), 'listing', 'listings')} still in review.`,
  );
}

/* ----------------------------------------------------------------------
   Finance
   ------------------------------------------------------------------- */

/** Three tiles, every figure summed from PAYOUTS at render time. */
function financeTiles() {
  const sum = (rows, key) => rows.reduce((t, r) => t + r[key], 0);
  const paid = PAYOUTS.filter((p) => p.status === 'paid');
  const open = PAYOUTS.filter((p) => p.status !== 'paid');
  const held = PAYOUTS.filter((p) => p.status === 'held');

  return [
    {
      id: 'fin-gross',
      label: 'Gross commission',
      value: sum(PAYOUTS, 'gross'),
      prefix: '$',
      suffix: '',
      decimals: 0,
      sub: `October 2026 · ${plural(PAYOUTS.length, 'payout', 'payouts')}`,
      icon: 'dollar',
      change: 18.2,
    },
    {
      id: 'fin-paid',
      label: 'Paid to agents',
      value: sum(paid, 'net'),
      prefix: '$',
      suffix: '',
      decimals: 0,
      sub: `${paid.length} of ${PAYOUTS.length} payouts cleared`,
      icon: 'money',
    },
    {
      id: 'fin-open',
      label: 'Still outstanding',
      value: sum(open, 'net'),
      prefix: '$',
      suffix: '',
      decimals: 0,
      sub: `${plural(open.length, 'payout', 'payouts')} open · ${held.length} on hold`,
      icon: 'time',
    },
  ];
}

function viewFinance() {
  return `
${pageHead(
  'Finance',
  'Commission splits and the October payout run. Demo figures.',
  `
<button class="pl-btn" type="button" data-act="nav" data-id="statements">
  ${ico('document', 14)} Statements
</button>`,
)}

<div class="pl-grid pl-grid--trio">
  ${financeTiles().map((t, i) => kpiTile(t, i)).join('')}
</div>

<section class="pl-card" aria-labelledby="pl-payouts-title">
  <div class="pl-card__head">
    <div>
      <h3 class="pl-card__title" id="pl-payouts-title">Agent payouts</h3>
      <p class="pl-card__sub">Gross is the brokerage side. Net is what the agent is paid.</p>
    </div>
  </div>
  <div data-payouts></div>
</section>`;
}

function renderPayouts() {
  const host = $('[data-payouts]');
  if (!host) return;
  const q = S.query.trim();
  const rows = PAYOUTS.filter((p) => {
    if (!q) return true;
    const who = agentById(p.agentId)?.name || '';
    return hasText(`${p.id} ${who} ${p.period} ${p.status}`, q);
  });

  if (!rows.length) {
    host.innerHTML = emptyState(
      'money',
      'No payout matches that',
      `Nothing in the October run mentions “${esc(q)}”.`,
    );
    say('No payouts match that filter.');
    return;
  }

  host.innerHTML = `
<div class="pl-tablewrap">
  <table class="pl-table">
    <caption class="u-visually-hidden">
      October 2026 agent payouts. Demo data.
    </caption>
    <thead>
      <tr>
        <th scope="col">Agent</th>
        <th scope="col">Payout</th>
        <th scope="col" class="pl-num">Gross</th>
        <th scope="col" class="pl-num">Split</th>
        <th scope="col" class="pl-num">Net</th>
        <th scope="col">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows
        .map((p) => {
          const who = agentById(p.agentId);
          return `
<tr class="pl-row pl-row--${esc(p.status)}" style="--i:${rows.indexOf(p)}">
  <th scope="row">
    <span class="pl-cellwho">
      ${
        who
          ? `<img class="pl-avatar" src="${esc(who.photo)}" alt="${esc(who.alt)}"
                  width="28" height="28" loading="lazy" decoding="async" />
             <span>
               <span class="pl-cellwho__name">${esc(who.name)}</span>
               <span class="pl-cellwho__role">${esc(who.role)}</span>
             </span>`
          : esc(p.agentId)
      }
    </span>
  </th>
  <td><span class="pl-mono">${esc(p.id)}</span> · ${esc(p.period)}</td>
  <td class="pl-num pl-mono">${esc(usd.format(p.gross))}</td>
  <td class="pl-num pl-mono">${p.split}%</td>
  <td class="pl-num pl-mono pl-num--strong">${esc(usd.format(p.net))}</td>
  <td><span class="pl-state is-${esc(p.status)}">${esc(p.status)}</span></td>
</tr>`;
        })
        .join('')}
    </tbody>
  </table>
</div>`;
  if (q) say(`${plural(rows.length, 'payout', 'payouts')} match “${q}”.`);
}

/* ----------------------------------------------------------------------
   Activity
   ------------------------------------------------------------------- */

/** ACTIVITY carries relative labels, so the day grouping is derived from
 *  the label itself rather than from an invented timestamp. */
function dayOf(at) {
  if (/minute|hour/i.test(at)) return 'Today';
  if (/yesterday/i.test(at)) return 'Yesterday';
  return 'Earlier this week';
}

function viewActivity() {
  return `
${pageHead(
  'Activity',
  'Everything the team did, newest first. Grouped by day.',
  `
<button class="pl-btn" type="button" data-act="nav" data-id="overview">
  ${ico('overview', 14)} Back to overview
</button>`,
)}
<section class="pl-card" aria-label="Activity feed">
  <div data-feed></div>
</section>`;
}

function renderFeed() {
  const host = $('[data-feed]');
  if (!host) return;
  const q = S.query.trim();
  const rows = ACTIVITY.filter((a) => {
    if (!q) return true;
    const who = agentById(a.agentId)?.name || '';
    return hasText(`${a.text} ${a.at} ${who}`, q);
  });

  if (!rows.length) {
    host.innerHTML = emptyState(
      'activity',
      'Nothing in the log matches that',
      `No entry mentions “${esc(q)}”.`,
    );
    say('No activity matches that filter.');
    return;
  }

  const groups = [];
  rows.forEach((a) => {
    const day = dayOf(a.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(a);
    else groups.push({ day, rows: [a] });
  });

  host.innerHTML = groups
    .map(
      (g, gi) => `
<div class="pl-day">
  <p class="pl-day__label">${esc(g.day)}</p>
  <ul class="pl-feed">
    ${g.rows
      .map((a, i) => {
        const who = agentById(a.agentId);
        return `
<li class="pl-feed__row" style="--i:${gi * 3 + i}">
  <span class="pl-feed__ico">${ico(a.icon, 16)}</span>
  <span class="pl-feed__body">
    <span class="pl-feed__text">${esc(a.text)}</span>
    <span class="pl-feed__meta">
      ${
        who
          ? `<img class="pl-avatar pl-avatar--xs" src="${esc(who.photo)}"
                  alt="${esc(who.alt)}" width="20" height="20"
                  loading="lazy" decoding="async" />
             <span>${esc(who.name)}</span> ·`
          : ''
      }
      <span>${esc(a.at)}</span>
    </span>
  </span>
</li>`;
      })
      .join('')}
  </ul>
</div>`,
    )
    .join('');
  if (q) say(`${plural(rows.length, 'entry', 'entries')} match “${q}”.`);
}

/* ----------------------------------------------------------------------
   Honest "not in this demo" page + shared empty state
   ------------------------------------------------------------------- */

/** What the demo workspace genuinely holds for a section it does not build.
 *  Counted from the data module, so these lines cannot drift. */
const STUB_FACT = {
  team: () => `${plural(AGENTS.length, 'person', 'people')} on the demo roster`,
  offices: () => `${plural(OFFICES.length, 'office', 'offices')} in the demo workspace`,
  documents: () =>
    `${plural(
      S.listings.reduce((n, l) => n + l.flags.length, 0),
      'open document check',
      'open document checks',
    )} across the queue`,
  statements: () =>
    `${plural(PAYOUTS.length, 'payout', 'payouts')} would roll up into October`,
  access: () => `${plural(AGENTS.length, 'person', 'people')} would need a role`,
  settings: () => 'Review rules are fixed in this demo',
};

function viewStub(item) {
  const siblings = NAV_ITEMS.filter((n) => n.built && n.id !== item.id).slice(0, 3);
  const fact = STUB_FACT[item.id]?.();
  return `
${pageHead(
  esc(item.label),
  'Designed, not built. This demo ships four working sections.',
)}
<section class="pl-stub">
  <span class="pl-stub__ico">${ico(item.icon, 30)}</span>
  <h3 class="pl-stub__title">${esc(item.label)} is not in this demo</h3>
  <p class="pl-stub__body">${esc(item.blurb)}</p>
  ${fact ? `<p class="pl-stub__fact">${ico('pass', 13)} ${esc(fact)}</p>` : ''}
  <p class="pl-stub__hint">
    Rather than show you a page of invented numbers, this demo says so.
    The four sections below are real and fully wired.
  </p>
  <ul class="pl-stub__links">
    ${siblings
      .map(
        (n) => `
<li>
  <button class="pl-btn" type="button" data-act="nav" data-id="${esc(n.id)}">
    ${ico(n.icon, 14)} ${esc(n.label)}
  </button>
</li>`,
      )
      .join('')}
  </ul>
</section>`;
}

function emptyState(icon, title, body) {
  return `
<div class="pl-empty">
  <span class="pl-empty__ico">${ico(icon, 24)}</span>
  <p class="pl-empty__title">${title}</p>
  <p class="pl-empty__body">${body}</p>
</div>`;
}

