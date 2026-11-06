/* =========================================================================
   PUTSOMESPECONIT — demo data + verified asset manifest
   -------------------------------------------------------------------------
   This module is the single source of truth for everything the dashboard
   renders. It is DEMO DATA for a DEMO WORKSPACE: the listings, agents,
   numbers and activity below are invented so the UI has something honest
   to show. They are not real transactions and the six people in AGENTS are
   not real employees of any brokerage — they are stock-photo models standing in
   for a roster. Nothing here asserts a customer, award, rating or review.

   VERIFICATION (run 2026-11-05, re-run after the final edit)
   ----------------------------------------------------------
   Photos — all 16 Unsplash CDN URLs checked with:
       curl -s -o /dev/null -w "%{http_code}\n" -L "<url>"
     -> 16/16 returned 200.
   Icons — all 76 candidate Solar names checked in one bulk request:
       curl -s "https://api.iconify.design/solar.json?icons=<a,b,c,...>"
     -> 75 resolved, 1 did not exist ("door-bold-duotone"). Solar has no
        door glyph at all (checked the full 8,979-name collection listing via
        https://api.iconify.design/collection?prefix=solar), so the front-door
        CTA uses "login-3-bold-duotone" instead. Every name in ICONS below
        resolved to a real icon. No icon name here was guessed.

   Photographer names and page slugs were read off unsplash.com itself.
   unsplash.com is behind a proof-of-work challenge that blocks curl, and the
   public JSON API now requires an access key, so the (CDN id -> slug ->
   photographer) triples were captured from the rendered search pages in a
   real browser. Each is therefore a real, matching attribution rather than a
   reconstructed guess.

   Pixel dimensions come from the CDN's own metadata (`?fm=json`) so callers
   can set explicit width/height on below-fold images per the contract.

   TOKEN RULE: there is not a single raw colour value in this file. Where data
   needs to carry a colour it carries the NAME of a custom property declared
   in css/tokens.css (see OFFICES[].token), which the consumer wraps in var().
   ========================================================================= */

/* -------------------------------------------------------------------------
   Image helpers
   ---------------------------------------------------------------------- */

const UNSPLASH = 'https://images.unsplash.com/';

/**
 * Build a sized Unsplash CDN URL.
 * Explicit w/q/auto/fit keeps bytes down and matches the contract's example.
 */
function photoUrl(id, w, h) {
  const crop = h ? `&h=${h}&fit=crop&crop=entropy` : '&fit=crop';
  return `${UNSPLASH}${id}?w=${w}&q=72&auto=format${crop}`;
}

/** Portraits are square-cropped; listing cards are 16:10. */
const face = (id) => photoUrl(id, 320, 320);
const card = (id) => photoUrl(id, 960, 600);

/* -------------------------------------------------------------------------
   PHOTOS — the verified manifest every image in the site resolves through.
   Keys are stable slugs used by AGENTS / LISTINGS below.
   `w`/`h` are the TRUE source pixel dimensions from the CDN metadata, not
   the delivered crop size — use the crop size you requested for the
   width/height attributes, and these only for aspect-ratio maths.
   ---------------------------------------------------------------------- */

export const PHOTOS = {
  // Unsplash photo-1777390329674-09285b035781 by Christian Buehner
  // unsplash.com/photos/a-distinguished-man-in-a-suit-with-graying-hair-jSjhdXDZj_8
  'face-broker': {
    id: 'photo-1777390329674-09285b035781',
    by: 'Christian Buehner',
    slug: 'a-distinguished-man-in-a-suit-with-graying-hair-jSjhdXDZj_8',
    alt: 'A man in a suit with graying hair, photographed against a soft background',
    w: 4000, h: 4000,
  },
  // Unsplash photo-1573496359142-b8d87734a5a2 by Christina @ wocintechchat.com
  // unsplash.com/photos/shallow-focus-photo-of-woman-in-gray-jacket-0Zx1bDv5BNY
  'face-listings': {
    id: 'photo-1573496359142-b8d87734a5a2',
    by: 'Christina @ wocintechchat.com',
    slug: 'shallow-focus-photo-of-woman-in-gray-jacket-0Zx1bDv5BNY',
    alt: 'A woman in a grey jacket smiling at the camera',
    w: 4016, h: 6016,
  },
  // Unsplash photo-1519085360753-af0119f7cbe7 by Ali Morshedlou
  // unsplash.com/photos/man-wearing-black-notched-lapel-suit-jacket-in-focus-photography-WMD64tMfc4k
  'face-buyers': {
    id: 'photo-1519085360753-af0119f7cbe7',
    by: 'Ali Morshedlou',
    slug: 'man-wearing-black-notched-lapel-suit-jacket-in-focus-photography-WMD64tMfc4k',
    alt: 'A man in a dark notched-lapel suit jacket looking toward the camera',
    w: 4000, h: 6000,
  },
  // Unsplash photo-1772987438485-ac832640c8a5 by Michael Guertin
  // unsplash.com/photos/smiling-woman-in-a-light-grey-suit-by-a-window-6sYpkD6ifu0
  'face-leasing': {
    id: 'photo-1772987438485-ac832640c8a5',
    by: 'Michael Guertin',
    slug: 'smiling-woman-in-a-light-grey-suit-by-a-window-6sYpkD6ifu0',
    alt: 'A smiling woman in a light grey suit standing beside a window',
    w: 4000, h: 6000,
  },
  // Unsplash photo-1686434538579-4723a0cf2890 by Humberto Chávez
  // unsplash.com/photos/a-man-sitting-in-a-chair-with-his-hand-on-his-chin-JsGZQvd_jkQ
  'face-coordinator': {
    id: 'photo-1686434538579-4723a0cf2890',
    by: 'Humberto Chávez',
    slug: 'a-man-sitting-in-a-chair-with-his-hand-on-his-chin-JsGZQvd_jkQ',
    alt: 'A man seated in a chair resting his hand on his chin',
    w: 2730, h: 4096,
  },
  // Unsplash photo-1604904612715-47bf9d9bc670 by Phạm Duy Quang
  // unsplash.com/photos/woman-in-grey-blazer-business-portrait-QGr6H7pri-Q
  'face-compliance': {
    id: 'photo-1604904612715-47bf9d9bc670',
    by: 'Phạm Duy Quang',
    slug: 'woman-in-grey-blazer-business-portrait-QGr6H7pri-Q',
    alt: 'A woman in a grey blazer and black shirt against a plain grey backdrop',
    w: 4480, h: 6720,
  },

  // Unsplash photo-1790198576346-13acbbde60d1 by Resource Database
  // unsplash.com/photos/modern-house-on-rocky-desert-hill-2X-ZzorRydI
  'home-ridge': {
    id: 'photo-1790198576346-13acbbde60d1',
    by: 'Resource Database',
    slug: 'modern-house-on-rocky-desert-hill-2X-ZzorRydI',
    alt: 'A modern white rectangular house on a rocky desert hillside under a clear sky',
    w: 5000, h: 4000,
  },
  // Unsplash photo-1657346088167-b982455bf29a by George Barros
  // unsplash.com/photos/modern-house-with-white-walls-t4FMbSdmeR0
  'home-dusk': {
    id: 'photo-1657346088167-b982455bf29a',
    by: 'George Barros',
    slug: 'modern-house-with-white-walls-t4FMbSdmeR0',
    alt: 'A three-storey house with white walls and grey siding photographed at dusk',
    w: 4000, h: 6000,
  },
  // Unsplash photo-1791320851270-113a07519bbc by James McDonnell
  // unsplash.com/photos/orange-door-on-white-house-I9dTL82fiQs
  'home-orange-door': {
    id: 'photo-1791320851270-113a07519bbc',
    by: 'James McDonnell',
    slug: 'orange-door-on-white-house-I9dTL82fiQs',
    alt: 'A bright orange front door on a white house with palm trees and gravel landscaping',
    w: 5989, h: 4791,
  },
  // Unsplash photo-1785024773232-aa575a4f5dbf by Hunter Owens
  // unsplash.com/photos/mid-century-modern-house-with-desert-plants-and-mountains-9Mt_7Iq5_2Q
  'home-midcentury': {
    id: 'photo-1785024773232-aa575a4f5dbf',
    by: 'Hunter Owens',
    slug: 'mid-century-modern-house-with-desert-plants-and-mountains-9Mt_7Iq5_2Q',
    alt: 'A mid-century modern house framed by desert planting with mountains behind it',
    w: 5938, h: 3969,
  },
  // Unsplash photo-1568484668894-3e9ab7eb0037 by Gayatri Malhotra
  // unsplash.com/photos/gray-house-on-green-grass-I9SltHRYlq4
  'home-bungalow': {
    id: 'photo-1568484668894-3e9ab7eb0037',
    by: 'Gayatri Malhotra',
    slug: 'gray-house-on-green-grass-I9SltHRYlq4',
    alt: 'A single-storey grey house behind a green front lawn',
    w: 6000, h: 4000,
  },
  // Unsplash photo-1790886140415-19c78f077848 by Francesco Liotti
  // unsplash.com/photos/tan-stucco-walls-with-desert-plants-2BQaDnTyIkA
  'home-stucco': {
    id: 'photo-1790886140415-19c78f077848',
    by: 'Francesco Liotti',
    slug: 'tan-stucco-walls-with-desert-plants-2BQaDnTyIkA',
    alt: 'Tan stucco walls casting sharp shadows beside desert plants',
    w: 4672, h: 7008,
  },
  // Unsplash photo-1605146769289-440113cc3d00 by Dillon Kydd
  // unsplash.com/photos/gray-and-white-concrete-house-2keCPb73aQY
  'home-concrete': {
    id: 'photo-1605146769289-440113cc3d00',
    by: 'Dillon Kydd',
    slug: 'gray-and-white-concrete-house-2keCPb73aQY',
    alt: 'A grey and white concrete house with large ground-floor windows',
    w: 5352, h: 3568,
  },
  // Unsplash photo-1707189855423-83548a34cd59 by Cesar Cid
  // unsplash.com/photos/a-house-with-a-pool-in-front-of-it-EitPmD8YYR4
  'home-pool': {
    id: 'photo-1707189855423-83548a34cd59',
    by: 'Cesar Cid',
    slug: 'a-house-with-a-pool-in-front-of-it-EitPmD8YYR4',
    alt: 'A house with a swimming pool in the foreground',
    w: 5768, h: 3864,
  },
  // Unsplash photo-1672817531592-65df84fe18f1 by Jeremy Huang
  // unsplash.com/photos/a-house-on-a-hill-with-a-palm-tree-in-front-of-it-a0A8nXwVHnY
  'home-palm': {
    id: 'photo-1672817531592-65df84fe18f1',
    by: 'Jeremy Huang',
    slug: 'a-house-on-a-hill-with-a-palm-tree-in-front-of-it-a0A8nXwVHnY',
    alt: 'A house set on a rise with a tall palm tree in front of it',
    w: 6000, h: 4000,
  },
  // Unsplash photo-1629048111552-917b9a731332 by Michael Yantis
  // unsplash.com/photos/brown-and-white-concrete-building-near-brown-mountain-during-daytime-R7E11m121RQ
  'home-mountain': {
    id: 'photo-1629048111552-917b9a731332',
    by: 'Michael Yantis',
    slug: 'brown-and-white-concrete-building-near-brown-mountain-during-daytime-R7E11m121RQ',
    alt: 'A brown and white building with a desert mountain rising behind it',
    w: 6000, h: 4000,
  },
};

/** 'Photographer — unsplash.com/photos/<slug>' for one manifest key. */
const creditFor = (key) =>
  `${PHOTOS[key].by} — unsplash.com/photos/${PHOTOS[key].slug}`;

/* -------------------------------------------------------------------------
   AGENTS — 6 demo personas. Stock-photo models, not real staff.
   ---------------------------------------------------------------------- */

export const AGENTS = [
  {
    id: 'ag-whitaker',
    name: 'Dale Whitaker',
    role: 'Managing broker',
    photo: face(PHOTOS['face-broker'].id),
    alt: PHOTOS['face-broker'].alt,
    credit: creditFor('face-broker'),
  },
  {
    id: 'ag-alston',
    name: 'Kendra Alston',
    role: 'Senior listing agent',
    photo: face(PHOTOS['face-listings'].id),
    alt: PHOTOS['face-listings'].alt,
    credit: creditFor('face-listings'),
  },
  {
    id: 'ag-herrera',
    name: 'Rafael Herrera',
    role: "Buyer's agent",
    photo: face(PHOTOS['face-buyers'].id),
    alt: PHOTOS['face-buyers'].alt,
    credit: creditFor('face-buyers'),
  },
  {
    id: 'ag-marchetti',
    name: 'Joelle Marchetti',
    role: 'Leasing manager',
    photo: face(PHOTOS['face-leasing'].id),
    alt: PHOTOS['face-leasing'].alt,
    credit: creditFor('face-leasing'),
  },
  {
    id: 'ag-nakamura',
    name: 'Theo Nakamura',
    role: 'Transaction coordinator',
    photo: face(PHOTOS['face-coordinator'].id),
    alt: PHOTOS['face-coordinator'].alt,
    credit: creditFor('face-coordinator'),
  },
  {
    id: 'ag-sandoval',
    name: 'Priya Sandoval',
    role: 'Compliance reviewer',
    photo: face(PHOTOS['face-compliance'].id),
    alt: PHOTOS['face-compliance'].alt,
    credit: creditFor('face-compliance'),
  },
];

/** Look up an agent by id; returns undefined if absent. */
export const agentById = (id) => AGENTS.find((a) => a.id === id);

/* -------------------------------------------------------------------------
   LISTINGS — 10 invented Phoenix-metro properties in a review queue.
   `price`  — dollars. For kind 'Lease' this is the MONTHLY rent.
   `age`    — whole days the listing has been sitting in the review queue.
   `photos` — how many photos the agent uploaded (the queue checks for 8+).
   `flags`  — failed review checks. An empty array means every check passed.
   `status` — 'review' (awaiting a decision), 'approved', or 'rejected'.
   ---------------------------------------------------------------------- */

export const LISTINGS = [
  {
    id: 'PL-2041',
    price: 1285000,
    kind: 'Sale',
    title: 'Desert contemporary with McDowell views',
    address: '7042 E Cholla St, Scottsdale, AZ 85254',
    neighbourhood: 'Kierland',
    beds: 4,
    baths: 3.5,
    sqft: 3410,
    agentId: 'ag-alston',
    age: 2,
    photos: 24,
    flags: [],
    status: 'approved',
    img: card(PHOTOS['home-ridge'].id),
    alt: PHOTOS['home-ridge'].alt,
    credit: creditFor('home-ridge'),
  },
  {
    id: 'PL-2042',
    price: 624900,
    kind: 'Sale',
    title: 'Two-storey on a corner lot, Val Vista Lakes',
    address: '1188 W Vaughn Ave, Gilbert, AZ 85233',
    neighbourhood: 'Val Vista Lakes',
    beds: 4,
    baths: 3,
    sqft: 2480,
    agentId: 'ag-herrera',
    age: 5,
    photos: 6,
    flags: ['Only 6 photos — 8 required', 'Floor plan not attached'],
    status: 'review',
    img: card(PHOTOS['home-dusk'].id),
    alt: PHOTOS['home-dusk'].alt,
    credit: creditFor('home-dusk'),
  },
  {
    id: 'PL-2043',
    price: 3450,
    kind: 'Lease',
    title: 'Updated ranch walkable to ASU',
    address: '1920 E Hermosa Dr, Tempe, AZ 85282',
    neighbourhood: 'Hermosa Vista',
    beds: 3,
    baths: 2,
    sqft: 1640,
    agentId: 'ag-marchetti',
    age: 1,
    photos: 18,
    flags: [],
    status: 'approved',
    img: card(PHOTOS['home-orange-door'].id),
    alt: PHOTOS['home-orange-door'].alt,
    credit: creditFor('home-orange-door'),
  },
  {
    id: 'PL-2044',
    price: 2150000,
    kind: 'Sale',
    title: 'Mid-century rebuild on a half-acre',
    address: '10326 E Mountain Spring Rd, Scottsdale, AZ 85255',
    neighbourhood: 'McDowell Mountain Ranch',
    beds: 5,
    baths: 4.5,
    sqft: 4820,
    agentId: 'ag-whitaker',
    age: 9,
    photos: 31,
    flags: ['Square footage conflicts with county record'],
    status: 'review',
    img: card(PHOTOS['home-midcentury'].id),
    alt: PHOTOS['home-midcentury'].alt,
    credit: creditFor('home-midcentury'),
  },
  {
    id: 'PL-2045',
    price: 469000,
    kind: 'Sale',
    title: 'Encanto bungalow, original casement windows',
    address: '3417 N 14th Ave, Phoenix, AZ 85013',
    neighbourhood: 'Encanto-Palmcroft',
    beds: 3,
    baths: 2,
    sqft: 1710,
    agentId: 'ag-herrera',
    age: 12,
    photos: 14,
    flags: ['Missing lead-based paint disclosure', 'Built 1938 — no permit history'],
    status: 'rejected',
    img: card(PHOTOS['home-bungalow'].id),
    alt: PHOTOS['home-bungalow'].alt,
    credit: creditFor('home-bungalow'),
  },
  {
    id: 'PL-2046',
    price: 845000,
    kind: 'Sale',
    title: 'Arcadia remodel with a north-facing yard',
    address: '6124 E Rose Circle Dr, Phoenix, AZ 85018',
    neighbourhood: 'Arcadia',
    beds: 4,
    baths: 3,
    sqft: 2950,
    agentId: 'ag-alston',
    age: 3,
    photos: 22,
    flags: [],
    status: 'approved',
    img: card(PHOTOS['home-stucco'].id),
    alt: PHOTOS['home-stucco'].alt,
    credit: creditFor('home-stucco'),
  },
  {
    id: 'PL-2047',
    price: 2780,
    kind: 'Lease',
    title: 'Biltmore condo, third floor, covered parking',
    address: '2201 E Camelback Rd Unit 318, Phoenix, AZ 85016',
    neighbourhood: 'Biltmore',
    beds: 2,
    baths: 2,
    sqft: 1180,
    agentId: 'ag-marchetti',
    age: 7,
    photos: 9,
    flags: ['HOA rental cap not confirmed'],
    status: 'review',
    img: card(PHOTOS['home-concrete'].id),
    alt: PHOTOS['home-concrete'].alt,
    credit: creditFor('home-concrete'),
  },
  {
    id: 'PL-2048',
    price: 712500,
    kind: 'Sale',
    title: 'Seville four-bed with a heated pool',
    address: '3845 E Bellerive Dr, Gilbert, AZ 85298',
    neighbourhood: 'Seville',
    beds: 4,
    baths: 3,
    sqft: 3120,
    agentId: 'ag-nakamura',
    age: 4,
    photos: 27,
    flags: [],
    status: 'approved',
    img: card(PHOTOS['home-pool'].id),
    alt: PHOTOS['home-pool'].alt,
    credit: creditFor('home-pool'),
  },
  {
    id: 'PL-2049',
    price: 538000,
    kind: 'Sale',
    title: 'Warner Ranch single-storey, mature citrus',
    address: '8830 S Kyrene Rd, Tempe, AZ 85284',
    neighbourhood: 'Warner Ranch',
    beds: 3,
    baths: 2,
    sqft: 1890,
    agentId: 'ag-sandoval',
    age: 6,
    photos: 11,
    flags: ['List price 18% under comparable sales — confirm with seller'],
    status: 'review',
    img: card(PHOTOS['home-palm'].id),
    alt: PHOTOS['home-palm'].alt,
    credit: creditFor('home-palm'),
  },
  {
    id: 'PL-2050',
    price: 4200,
    kind: 'Lease',
    title: 'Old Town townhouse, two-car garage',
    address: '4525 N Civic Center Plz Unit 312, Scottsdale, AZ 85251',
    neighbourhood: 'Old Town',
    beds: 2,
    baths: 2.5,
    sqft: 1540,
    agentId: 'ag-whitaker',
    age: 14,
    photos: 4,
    flags: [
      'Only 4 photos — 8 required',
      'No seller signature on page 3',
      'Lease term left blank',
    ],
    status: 'rejected',
    img: card(PHOTOS['home-mountain'].id),
    alt: PHOTOS['home-mountain'].alt,
    credit: creditFor('home-mountain'),
  },
];

/* -------------------------------------------------------------------------
   PIPELINE — commission booked, in thousands of dollars.
   Nine months: steady climb, a July dip when two Scottsdale deals fell out
   of escrow, then a strong close.
   ---------------------------------------------------------------------- */

export const PIPELINE = [
  { m: 'Mar', v: 31.2 },
  { m: 'Apr', v: 38.6 },
  { m: 'May', v: 44.1 },
  { m: 'Jun', v: 52.8 },
  { m: 'Jul', v: 41.3 },
  { m: 'Aug', v: 49.7 },
  { m: 'Sep', v: 58.4 },
  { m: 'Oct', v: 67.9 },
  { m: 'Nov', v: 74.6 },
];

/* -------------------------------------------------------------------------
   OFFICES — share of active listings by office.
   `token` is the NAME of a custom property declared in css/tokens.css.
   Consumers must wrap it: `color: var(${office.token})`. Never a hex.
   ---------------------------------------------------------------------- */

export const OFFICES = [
  { name: 'Scottsdale', value: 38, token: '--amber-400' },
  { name: 'Phoenix', value: 29, token: '--violet-300' },
  { name: 'Gilbert', value: 19, token: '--slate-400' },
  { name: 'Tempe', value: 14, token: '--amber-200' },
];

/* -------------------------------------------------------------------------
   STATS — 8 KPI tiles. `value` is a bare number so it can be counted up;
   `prefix`/`suffix`/`decimals` tell the renderer how to format it.
   `change` is the percentage move vs the previous period (signed).
   ---------------------------------------------------------------------- */

export const STATS = [
  {
    id: 'volume',
    label: 'Gross volume',
    value: 18.4,
    prefix: '$',
    suffix: 'M',
    decimals: 1,
    sub: 'Closed year to date',
    icon: 'graph-up-bold-duotone',
    change: 12.4,
  },
  {
    id: 'active',
    label: 'Active listings',
    value: 142,
    prefix: '',
    suffix: '',
    decimals: 0,
    sub: 'Across four offices',
    icon: 'home-smile-bold-duotone',
    change: 6.1,
  },
  {
    id: 'review',
    label: 'In review',
    value: 9,
    prefix: '',
    suffix: '',
    decimals: 0,
    sub: 'Waiting on a decision',
    icon: 'clipboard-check-bold-duotone',
    change: -3.0,
  },
  {
    id: 'dom',
    label: 'Avg days on market',
    value: 27,
    prefix: '',
    suffix: 'd',
    decimals: 0,
    sub: 'Down from 34 last quarter',
    icon: 'clock-circle-bold-duotone',
    change: -20.6,
  },
  {
    id: 'commission',
    label: 'Commission booked',
    value: 459.2,
    prefix: '$',
    suffix: 'K',
    decimals: 1,
    sub: 'Nine-month trailing',
    icon: 'wallet-money-bold-duotone',
    change: 18.2,
  },
  {
    id: 'close-rate',
    label: 'List-to-close rate',
    value: 68.5,
    prefix: '',
    suffix: '%',
    decimals: 1,
    sub: 'Of listings taken',
    icon: 'chart-square-bold-duotone',
    change: 4.1,
  },
  {
    id: 'showings',
    label: 'Showings this week',
    value: 213,
    prefix: '',
    suffix: '',
    decimals: 0,
    sub: 'Booked across the team',
    icon: 'calendar-mark-bold-duotone',
    change: 31.0,
  },
  {
    id: 'failing',
    label: 'Checks failing',
    value: 7,
    prefix: '',
    suffix: '',
    decimals: 0,
    sub: 'Fix before publish',
    icon: 'danger-triangle-bold-duotone',
    change: -2.0,
  },
];

/* -------------------------------------------------------------------------
   PAYOUTS — 5 commission payouts. All dollars.
   `gross` is the brokerage side, `split` the agent's percentage,
   `net` what the agent is paid. `status` drives the badge colour token.
   ---------------------------------------------------------------------- */

export const PAYOUTS = [
  {
    id: 'PO-881',
    agentId: 'ag-alston',
    period: 'Oct 2026',
    gross: 38550,
    split: 70,
    net: 26985,
    status: 'paid',
  },
  {
    id: 'PO-882',
    agentId: 'ag-whitaker',
    period: 'Oct 2026',
    gross: 52400,
    split: 80,
    net: 41920,
    status: 'paid',
  },
  {
    id: 'PO-883',
    agentId: 'ag-herrera',
    period: 'Oct 2026',
    gross: 18740,
    split: 65,
    net: 12181,
    status: 'scheduled',
  },
  {
    id: 'PO-884',
    agentId: 'ag-marchetti',
    period: 'Oct 2026',
    gross: 9630,
    split: 60,
    net: 5778,
    status: 'scheduled',
  },
  {
    id: 'PO-885',
    agentId: 'ag-nakamura',
    period: 'Oct 2026',
    gross: 14220,
    split: 65,
    net: 9243,
    status: 'held',
  },
];

/* -------------------------------------------------------------------------
   TASKS — the "needs your attention" queue.
   `kind` groups the item: 'compliance' | 'listing' | 'client' | 'finance'.
   `due` is human-readable and relative on purpose — demo data should not
   rot into a wall of overdue dates.
   ---------------------------------------------------------------------- */

export const TASKS = [
  {
    id: 'tk-1',
    text: 'Countersign the Seville purchase contract (PL-2048)',
    kind: 'compliance',
    due: 'Today',
    agentId: 'ag-nakamura',
  },
  {
    id: 'tk-2',
    text: 'Old Town townhouse is missing four photos and a lease term',
    kind: 'listing',
    due: 'Today',
    agentId: 'ag-whitaker',
  },
  {
    id: 'tk-3',
    text: 'Confirm the Warner Ranch list price with the seller',
    kind: 'listing',
    due: 'Tomorrow',
    agentId: 'ag-sandoval',
  },
  {
    id: 'tk-4',
    text: 'Call back the Biltmore applicant about the HOA rental cap',
    kind: 'client',
    due: 'In 2 days',
    agentId: 'ag-marchetti',
  },
  {
    id: 'tk-5',
    text: 'Release the held October payout for Theo Nakamura',
    kind: 'finance',
    due: 'Friday',
    agentId: 'ag-nakamura',
  },
  {
    id: 'tk-6',
    text: 'Reconcile square footage on PL-2044 against county records',
    kind: 'compliance',
    due: 'Next week',
    agentId: 'ag-whitaker',
  },
];

/* -------------------------------------------------------------------------
   ACTIVITY — recent feed. `at` is a relative label; `icon` is a verified
   Solar name so each row can carry a glyph.
   ---------------------------------------------------------------------- */

export const ACTIVITY = [
  {
    id: 'av-1',
    text: 'Kendra Alston published 7042 E Cholla St',
    agentId: 'ag-alston',
    at: '12 minutes ago',
    icon: 'home-smile-bold-duotone',
  },
  {
    id: 'av-2',
    text: 'Price check flagged PL-2049 as 18% under comps',
    agentId: 'ag-sandoval',
    at: '48 minutes ago',
    icon: 'danger-triangle-bold-duotone',
  },
  {
    id: 'av-3',
    text: 'Rafael Herrera uploaded 6 photos to PL-2042',
    agentId: 'ag-herrera',
    at: '2 hours ago',
    icon: 'gallery-wide-bold-duotone',
  },
  {
    id: 'av-4',
    text: 'October payout of $41,920 cleared for Dale Whitaker',
    agentId: 'ag-whitaker',
    at: '5 hours ago',
    icon: 'wallet-money-bold-duotone',
  },
  {
    id: 'av-5',
    text: 'PL-2045 rejected — lead-based paint disclosure missing',
    agentId: 'ag-sandoval',
    at: 'Yesterday',
    icon: 'close-circle-bold-duotone',
  },
  {
    id: 'av-6',
    text: 'Joelle Marchetti booked 11 showings for the Tempe ranch',
    agentId: 'ag-marchetti',
    at: 'Yesterday',
    icon: 'calendar-mark-bold-duotone',
  },
  {
    id: 'av-7',
    text: 'Theo Nakamura opened escrow on 3845 E Bellerive Dr',
    agentId: 'ag-nakamura',
    at: '2 days ago',
    icon: 'key-minimalistic-square-bold-duotone',
  },
  {
    id: 'av-8',
    text: 'Gilbert office crossed 19% of active inventory',
    agentId: 'ag-herrera',
    at: '3 days ago',
    icon: 'chart-square-bold-duotone',
  },
];

/* -------------------------------------------------------------------------
   ICONS — every Solar glyph the site uses, by semantic key.
   Each name was verified against the Iconify API (see the header block);
   none is a guess. Solar has NO door glyph, so `door` points at
   `login-3-bold-duotone` — the closest "enter here" mark in the set.
   ---------------------------------------------------------------------- */

export const ICONS = {
  // landing + shell
  door: 'login-3-bold-duotone',
  enter: 'arrow-right-bold-duotone',
  brand: 'home-smile-bold-duotone',
  menu: 'hamburger-menu-bold-duotone',
  close: 'close-circle-bold-duotone',
  scrollCue: 'alt-arrow-down-bold-duotone',
  lightsOn: 'lightbulb-bolt-bold-duotone',
  signpost: 'signpost-2-bold-duotone',

  // dashboard navigation
  overview: 'widget-5-bold-duotone',
  listings: 'home-2-bold-duotone',
  offices: 'buildings-2-bold-duotone',
  city: 'city-bold-duotone',
  pipeline: 'chart-2-bold-duotone',
  payouts: 'wallet-money-bold-duotone',
  tasks: 'clipboard-check-bold-duotone',
  activity: 'notes-bold-duotone',
  team: 'users-group-rounded-bold-duotone',
  agent: 'user-rounded-bold-duotone',
  settings: 'settings-bold-duotone',
  search: 'magnifer-bold-duotone',
  bell: 'bell-bold-duotone',
  logout: 'logout-2-bold-duotone',

  // listing attributes
  beds: 'bed-bold-duotone',
  baths: 'bath-bold-duotone',
  area: 'ruler-angular-bold-duotone',
  photos: 'camera-bold-duotone',
  gallery: 'gallery-wide-bold-duotone',
  location: 'map-point-bold-duotone',
  price: 'tag-price-bold-duotone',
  keys: 'key-minimalistic-square-bold-duotone',
  document: 'document-text-bold-duotone',
  folder: 'folder-bold-duotone',

  // status + deltas
  pass: 'check-circle-bold-duotone',
  fail: 'close-circle-bold-duotone',
  warn: 'danger-triangle-bold-duotone',
  shield: 'shield-check-bold-duotone',
  flag: 'flag-2-bold-duotone',
  up: 'arrow-right-up-bold-duotone',
  down: 'arrow-right-down-bold-duotone',
  trendUp: 'graph-up-bold-duotone',
  trendDown: 'graph-down-bold-duotone',

  // actions + misc
  time: 'clock-circle-bold-duotone',
  calendar: 'calendar-mark-bold-duotone',
  filter: 'filter-bold-duotone',
  sort: 'sort-vertical-bold-duotone',
  download: 'download-minimalistic-bold-duotone',
  add: 'add-circle-bold-duotone',
  view: 'eye-bold-duotone',
  edit: 'pen-new-square-bold-duotone',
  refresh: 'refresh-bold-duotone',
  phone: 'phone-calling-rounded-bold-duotone',
  mail: 'letter-bold-duotone',
  message: 'chat-round-dots-bold-duotone',
  money: 'hand-money-bold-duotone',
  dollar: 'dollar-minimalistic-bold-duotone',
  celebrate: 'confetti-minimalistic-bold-duotone',
  external: 'square-top-down-bold-duotone',
};

/* -------------------------------------------------------------------------
   iconSvg — icon markup as a string.

   WHY AN <img>, NOT INLINE <svg>:
   Inlining real SVG would mean fetching 40+ glyphs from the Iconify API at
   runtime, which blocks first paint and makes every tile depend on a network
   round trip. An <img> hands that work to the browser's own image pipeline:
   requests are parallel, cached, and — critically — LAYOUT IS NEVER BLOCKED,
   because width and height are set on the element up front, so the box is
   reserved before a single byte arrives. Nothing reflows when the icons land.

   COLOUR: an <img> cannot inherit `currentColor`, and this project forbids a
   raw hex outside tokens.css — so colour is NOT baked into the URL. Instead
   every icon carries the class `pl-icon`, which CSS themes with a `filter`.
   Passing `color` as a custom-property NAME (e.g. '--amber-400') sets
   `--icon-tint: var(--amber-400)` inline for stylesheets to pick up. Passing
   anything else (including the 'currentColor' default) just leaves the class
   to do the work. A hex is never emitted.

   ACCESSIBILITY: icons here are decoration beside real text, so they get
   alt="" and aria-hidden="true". An icon-ONLY control must put its meaning in
   an aria-label on the surrounding <button>, per the contract.
   ---------------------------------------------------------------------- */

const ICON_API = 'https://api.iconify.design/solar/';

/** Strip anything that could break out of an attribute. */
const safeIconName = (n) => String(n || '').replace(/[^a-zA-Z0-9-]/g, '');

/** Resolve an ICONS key, or pass a raw Solar name straight through. */
export const iconName = (key) => ICONS[key] || key;

/** The bare CDN URL for a Solar glyph — handy for CSS background-image. */
export function iconUrl(name) {
  return `${ICON_API}${safeIconName(iconName(name))}.svg`;
}

export function iconSvg(name, { size = 20, color = 'currentColor' } = {}) {
  const safe = safeIconName(iconName(name));
  if (!safe) return '';
  const px = Number.isFinite(Number(size)) ? Number(size) : 20;
  // Only a custom-property NAME is accepted as a tint. Never a hex.
  const tint = /^--[a-zA-Z0-9-]+$/.test(String(color))
    ? ` style="--icon-tint: var(${color})"`
    : '';
  return (
    `<img class="pl-icon" src="${ICON_API}${safe}.svg"` +
    ` width="${px}" height="${px}"` +
    ` alt="" aria-hidden="true" loading="lazy" decoding="async"${tint}>`
  );
}

/* -------------------------------------------------------------------------
   CREDITS — one line per distinct photo, for the footer credits block.
   Derived from PHOTOS so it can never drift out of sync with what ships.
   ---------------------------------------------------------------------- */

export const CREDITS = Object.keys(PHOTOS).map(creditFor);

/** Shown next to the credits so nobody reads the demo numbers as real. */
export const DEMO_NOTICE =
  'Demo workspace. Listings, agents and figures on this page are sample data.';

/* -------------------------------------------------------------------------
   Formatters — kept here so every surface renders money the same way.
   ---------------------------------------------------------------------- */

const usd0 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

/** $1,285,000 — or '$3,450/mo' for a lease. */
export function formatPrice(listing) {
  const n = usd0.format(listing.price);
  return listing.kind === 'Lease' ? `${n}/mo` : n;
}

/** 3,410 sq ft */
export const formatSqft = (n) => `${n.toLocaleString('en-US')} sq ft`;

/** Format a STATS tile's value with its own prefix/suffix/decimals. */
export function formatStat(stat, value = stat.value) {
  const n = Number(value).toLocaleString('en-US', {
    minimumFractionDigits: stat.decimals,
    maximumFractionDigits: stat.decimals,
  });
  return `${stat.prefix}${n}${stat.suffix}`;
}

/** '+12.4%' / '-3.0%' — sign always explicit. */
export const formatChange = (n) =>
  `${n > 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
