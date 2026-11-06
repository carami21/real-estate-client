/* =========================================================================
   house.js — the PUTSOMESPECONIT scene.

   One Victorian house at blue hour that assembles itself from survey stakes
   to lamplight. Everything is procedural: no model files, no image textures,
   nothing to download beyond three.js itself.

   Exported API (app.js owns all timing):
     createScene(canvas, opts) -> {
       ready,                 // Promise, resolves once the first frame is drawn
       setProgress(p),        // 0..1 — the whole build
       setDoor(t),            // 0..1 — door swing
       setApproach(t),        // 0..1 — extra camera push toward the threshold
       pointerMove(x, y),     // normalised -1..1, parallax + door hover test
       hitDoor(x, y),         // normalised -1..1 -> boolean
       doorScreenPoint(),     // { x, y, visible } in CSS pixels
       onDoorHover(cb),
       resize(), start(), stop(), dispose(),
       quality                // 'high' | 'low'
     }
   ========================================================================= */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/* ---------------------------------------------------------------- utils */

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const inv = (a, b, v) => clamp01((v - a) / (b - a));
const smooth = (a, b, v) => {
  const t = inv(a, b, v);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/* Deterministic PRNG so the house is identical on every load and every
   machine — important, because the hero is the first thing anyone sees. */
let _seed = 20261105;
const rnd = () => {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[(rnd() * arr.length) | 0];

/* ------------------------------------------------------- scene geometry */

/** Top of the stone foundation; every wall sits on this. */
const BASE = 0.55;
/** Porch deck height above grade. */
const PORCH_Y = 0.95;
/** Front plane of the main block. */
const FRONT_Z = 4.25;

/* The clad wall stands slightly proud of the structural face; FACE_Z is the
   plane every window, door and piece of trim is hung on. */
const FACE_Z = FRONT_Z + 0.09;

const DOOR = { x: -0.45, w: 1.18, h: 2.42, z: FACE_Z - 0.02 };
DOOR.y = PORCH_Y + DOOR.h / 2;

/* Camera keyframes: [progress, position, look-at]. */
const SHOTS = [
  [0.00, [14.0, 10.5, 30.0], [-0.5, 0.4, 1.5]],
  [0.14, [-21.0, 9.0, 27.0], [-0.5, 1.2, 1.0]],
  [0.32, [16.0, 15.0, 26.0], [0.0, 3.6, 0.5]],
  [0.50, [-20.0, 8.0, 25.0], [-0.6, 4.6, 0.5]],
  [0.68, [15.0, 6.4, 24.0], [0.6, 4.6, 1.0]],
  [0.84, [6.0, 4.6, 20.0], [-0.25, 3.4, 2.4]],
  [1.00, [-0.45, 2.15, 13.2], [-0.45, 2.25, 4.34]],
];

/* Build layers. Each is revealed by a clipping plane that rises through it,
   so the house grows upward out of the ground instead of popping in.
   [start, end, planeTopY] in progress space. */
const SCHEDULE = {
  footing:  [0.105, 0.165, 0.9],
  stone:    [0.150, 0.225, 1.7],
  deck:     [0.205, 0.250, 1.1],
  studs:    [0.255, 0.420, 11.6],
  joists:   [0.250, 0.300, 7.2],
  sheath:   [0.400, 0.545, 11.6],
  wrap:     [0.520, 0.610, 11.6],
  roofDeck: [0.560, 0.650, 12.4],
  roof:     [0.640, 0.730, 12.4],
  clap:     [0.700, 0.800, 3.95],
  /* shingle is the upper storey only: `from` holds it above the belt course
     so it can never creep down over the clapboard. */
  shingle:  [0.740, 0.830, 11.6, 3.88],
  trim:     [0.790, 0.860, 12.4],
  porch:    [0.800, 0.880, 5.2],
  yard:     [0.855, 0.935, 2.2],
};

/* ------------------------------------------------------------ textures */

function canvasTexture(size, metres, draw, maxAniso) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / metres, 1 / metres);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

function grit(g, s, n, colours, w = [1, 3], h = [1, 3]) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = pick(colours);
    g.globalAlpha = rr(0.18, 0.7);
    g.fillRect(rnd() * s, rnd() * s, rr(w[0], w[1]), rr(h[0], h[1]));
  }
  g.globalAlpha = 1;
}

function buildTextures(maxAniso) {
  const T = {};

  /* Warm cream clapboard — the lower storey, the surface the porch lamps
     turn gold at dusk. */
  T.clap = canvasTexture(512, 2.2, (g, s) => {
    g.fillStyle = '#e9e2d2';
    g.fillRect(0, 0, s, s);
    grit(g, s, 900, ['#ded6c3', '#f4efe3', '#d5ccb8']);
    const rows = 7, rh = s / rows;
    for (let i = 0; i < rows; i++) {
      const y = i * rh;
      g.fillStyle = 'rgba(70,58,40,0.20)';
      g.fillRect(0, y + rh - 4, s, 4);
      g.fillStyle = 'rgba(255,253,246,0.60)';
      g.fillRect(0, y, s, 5);
      g.fillStyle = 'rgba(70,58,40,0.05)';
      g.fillRect(0, y + rh - 11, s, 7);
    }
  }, maxAniso);

  /* Slate-blue shingle for the upper storey and gables. */
  T.shingle = canvasTexture(512, 2.4, (g, s) => {
    g.fillStyle = '#6d7a90';
    g.fillRect(0, 0, s, s);
    const rows = 11, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -26 : 0;
      while (x < s) {
        const w = rr(40, 58);
        const l = rr(-13, 13);
        g.fillStyle = `rgb(${105 + l},${119 + l},${141 + l})`;
        g.fillRect(x, r * rh, w - 2.5, rh - 2.5);
        x += w;
      }
      g.fillStyle = 'rgba(22,26,38,0.42)';
      g.fillRect(0, r * rh + rh - 3, s, 3);
    }
    grit(g, s, 2200, ['#5a6579', '#7d8aa4', '#4e5869'], [1, 2], [1, 2]);
  }, maxAniso);

  /* Dark roof slate. */
  T.roof = canvasTexture(512, 2.0, (g, s) => {
    g.fillStyle = '#2b2639';
    g.fillRect(0, 0, s, s);
    const rows = 12, rh = s / rows;
    for (let r = 0; r < rows; r++) {
      let x = r % 2 ? -22 : 0;
      while (x < s) {
        const w = rr(30, 50);
        const l = rr(-10, 12);
        g.fillStyle = `rgb(${43 + l},${38 + l},${57 + l})`;
        g.fillRect(x, r * rh, w - 2, rh - 2);
        x += w;
      }
      g.fillStyle = 'rgba(8,6,16,0.55)';
      g.fillRect(0, r * rh + rh - 3.5, s, 3.5);
    }
    grit(g, s, 2600, ['#201c2c', '#3b3550', '#171423'], [1, 2], [1, 2]);
  }, maxAniso);

  /* Structural sheathing. */
  T.sheath = canvasTexture(512, 2.4, (g, s) => {
    g.fillStyle = '#c59a5e';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 2000; i++) {
      g.save();
      g.translate(rnd() * s, rnd() * s);
      g.rotate(rnd() * Math.PI);
      g.fillStyle = pick(['#ad7c3f', '#dcb176', '#a3712f', '#e6c38c', '#96672b']);
      g.globalAlpha = rr(0.25, 0.7);
      g.fillRect(-rr(4, 13), -rr(1, 3), rr(9, 26), rr(2, 5));
      g.restore();
    }
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(62,38,12,0.5)';
    g.lineWidth = 2.5;
    g.strokeRect(1, 1, s - 2, s / 2 - 2);
    g.strokeRect(1, s / 2, s - 2, s / 2 - 2);
  }, maxAniso);

  /* Weather barrier. */
  T.wrap = canvasTexture(512, 3.0, (g, s) => {
    g.fillStyle = '#eceef0';
    g.fillRect(0, 0, s, s);
    grit(g, s, 700, ['#dde1e5', '#ffffff']);
    g.fillStyle = 'rgba(58,74,112,0.30)';
    g.font = "600 21px 'IBM Plex Mono', monospace";
    for (let y = 44; y < s; y += 98) {
      for (let x = (y / 98) % 2 ? 0 : 96; x < s; x += 196) g.fillText('WEATHER WRAP', x, y);
    }
    g.strokeStyle = 'rgba(0,0,0,0.07)';
    g.beginPath(); g.moveTo(0, s * 0.63); g.lineTo(s, s * 0.61); g.stroke();
  }, maxAniso);

  /* Rough-faced foundation stone. */
  T.stone = canvasTexture(512, 2.2, (g, s) => {
    g.fillStyle = '#8d8a84';
    g.fillRect(0, 0, s, s);
    const cols = ['#6f6d68', '#827e76', '#5d5b57', '#948f85', '#76736c', '#a09a8e'];
    for (let i = 0; i < 150; i++) {
      const x = rnd() * s, y = rnd() * s, w = rr(30, 74), h = rr(18, 40);
      g.fillStyle = pick(cols);
      g.beginPath();
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        g.lineTo(x + Math.cos(a) * w * rr(0.4, 0.56), y + Math.sin(a) * h * rr(0.4, 0.56));
      }
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.22)'; g.stroke();
    }
    grit(g, s, 1400, ['#55534f', '#9b968c']);
  }, maxAniso);

  T.concrete = canvasTexture(256, 3.0, (g, s) => {
    g.fillStyle = '#9d9a94';
    g.fillRect(0, 0, s, s);
    grit(g, s, 4000, ['#8b8882', '#adaaa3', '#7c7a74'], [1, 3], [1, 3]);
  }, maxAniso);

  /* Lawn, seen almost entirely in shadow at dusk. */
  T.lawn = canvasTexture(512, 6.0, (g, s) => {
    g.fillStyle = '#2d3a28';
    g.fillRect(0, 0, s, s);
    grit(g, s, 14000, ['#36472f', '#243020', '#3e5134', '#2a3724'], [1, 2], [2, 6]);
  }, maxAniso);

  T.dirt = canvasTexture(512, 8.0, (g, s) => {
    g.fillStyle = '#4c3f31';
    g.fillRect(0, 0, s, s);
    grit(g, s, 7000, ['#42362a', '#5b4b39', '#372d23', '#665444'], [1, 4], [1, 4]);
    g.strokeStyle = 'rgba(32,25,18,0.4)';
    g.lineWidth = 7;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(rnd() * s, 0);
      g.bezierCurveTo(rnd() * s, s * 0.3, rnd() * s, s * 0.7, rnd() * s, s);
      g.stroke();
    }
  }, maxAniso);

  /* Bluestone path and porch deck boards. */
  T.deckBoard = canvasTexture(512, 2.4, (g, s) => {
    g.fillStyle = '#d9d2c2';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9; i++) {
      const x = (i * s) / 9;
      g.fillStyle = `rgba(${90 + rr(-12, 12)},${82 + rr(-12, 12)},${68 + rr(-10, 10)},0.22)`;
      g.fillRect(x, 0, 2.5, s);
      g.fillStyle = 'rgba(255,252,244,0.4)';
      g.fillRect(x + 3, 0, 2, s);
    }
    grit(g, s, 1400, ['#cdc5b4', '#e6e0d1']);
  }, maxAniso);

  /* Lit interior behind every pane: hot near the sill, falling off upward. */
  T.interior = (() => {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.00, '#7a4a18');
    grad.addColorStop(0.35, '#e49a35');
    grad.addColorStop(0.72, '#ffc446');
    grad.addColorStop(1.00, '#ffe6b4');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 128);
    /* a hint of furniture, so the glow is not a flat wash */
    g.fillStyle = 'rgba(60,30,8,0.35)';
    g.fillRect(6, 86, 20, 42);
    g.fillRect(40, 72, 18, 56);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  return T;
}

/** Box-projected UVs in metres, so every texture keeps real-world scale
    no matter how a box is stretched. */
function boxUV(geo, flat = false) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = flat ? z : x; v = flat ? x : z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* ========================================================================
   createScene
   ======================================================================== */

export function createScene(canvas, opts = {}) {
  const reduced = !!opts.reducedMotion;

  /* ---------------------------------------------------------- renderer */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  });

  const lowEnd =
    (navigator.hardwareConcurrency || 4) <= 4 ||
    matchMedia('(max-width: 720px)').matches;
  const quality = lowEnd ? 'low' : 'high';

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.3 : 1.75));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !lowEnd;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x171433, 56, 230);

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 1400);
  camera.position.set(...SHOTS[0][1]);

  /* A fixed vertical FOV crops the house badly on a narrow window. Hold the
     horizontal field instead and let the vertical one open up. */
  const REF_ASPECT = 16 / 9;
  const REF_FOV = 38;
  const H_FOV = 2 * Math.atan(Math.tan((REF_FOV * Math.PI) / 360) * REF_ASPECT);
  function fitFov() {
    const a = camera.aspect;
    camera.fov = a >= REF_ASPECT
      ? REF_FOV
      : (2 * Math.atan(Math.tan(H_FOV / 2) / a) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }
  fitFov();

  /* ------------------------------------------------------------- post */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null;
  if (!lowEnd) {
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.0, 0.5, 0.86);
    composer.addPass(bloom);
  }
  composer.addPass(new OutputPass());

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const T = buildTextures(maxAniso);

  /* ------------------------------------------------------- build layers */
  const L = {};
  for (const [key, [a, b, top, from]] of Object.entries(SCHEDULE)) {
    const planes = [new THREE.Plane(new THREE.Vector3(0, -1, 0), -1)];
    if (from != null) {
      /* normal (0,1,0): keeps y >= from */
      planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -from));
    }
    L[key] = { a, b, top, from, plane: planes[0], planes, meshes: [] };
  }
  const clipped = (layer, params) =>
    new THREE.MeshStandardMaterial({
      ...params,
      clippingPlanes: L[layer].planes,
      clipShadows: true,
    });

  const MAT = {
    concrete: clipped('footing', { map: T.concrete, roughness: 0.95 }),
    stone:    clipped('stone',   { map: T.stone, roughness: 0.96 }),
    deck:     clipped('deck',    { map: T.sheath, roughness: 0.9 }),
    joist:    clipped('joists',  { color: 0xcaa269, roughness: 0.86 }),
    stud:     clipped('studs',   { color: 0xd6ad70, roughness: 0.85 }),
    sheath:   clipped('sheath',  { map: T.sheath, roughness: 0.9, side: THREE.DoubleSide }),
    wrap:     clipped('wrap',    { map: T.wrap, roughness: 0.72, side: THREE.DoubleSide }),
    roofDeck: clipped('roofDeck',{ map: T.sheath, roughness: 0.9 }),
    roof:     clipped('roof',    { map: T.roof, roughness: 0.84 }),
    clap:     clipped('clap',    { map: T.clap, roughness: 0.78, side: THREE.DoubleSide }),
    shingle:  clipped('shingle', { map: T.shingle, roughness: 0.82, side: THREE.DoubleSide }),
    trim:     clipped('trim',    { color: 0xf2ebdf, roughness: 0.62 }),
    trimDeep: clipped('trim',    { color: 0xd9cfbd, roughness: 0.66 }),
    porchDeck:clipped('porch',   { map: T.deckBoard, roughness: 0.8 }),
    porchTrim:clipped('porch',   { color: 0xf4eee3, roughness: 0.6 }),
    porchRoof:clipped('porch',   { map: T.roof, roughness: 0.85 }),
    ceiling:  clipped('porch',   { color: 0xeadfc9, roughness: 0.85 }),
    stoneTrim:clipped('porch',   { map: T.stone, roughness: 0.95 }),
  };

  const disposables = new Set();
  const track = (obj) => { disposables.add(obj); return obj; };
  Object.values(MAT).forEach(track);
  Object.values(T).forEach(track);

  const house = new THREE.Group();
  scene.add(house);

  function place(layer, mesh, parent = house) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    L[layer].meshes.push(mesh);
    track(mesh.geometry);
    return mesh;
  }

  const unit = track(new THREE.BoxGeometry(1, 1, 1));

  /* ---------------------------------------------------------------------
     Massing. A cross-gabled Victorian: main block, projecting front gable
     over the entry, a polygonal bay on the left, a steep-hipped wing right.
     --------------------------------------------------------------------- */

  const MAIN = { w: 10.4, d: 8.5, eave: 6.35, ridge: 9.5, x: 0, z: 0 };
  /* The entry gable oversails the porch roof rather than landing on the
     ground, so the porch can run clean across the front. Its eave/ridge are
     local to its own floating base. */
  const GABLE = {
    w: 4.3, d: 1.4, x: -0.45, z: 4.3,
    base: 3.95, eave: 1.85, ridge: 5.0, noJoists: true,
  };
  const WING = { w: 4.8, d: 5.2, eave: 5.1, ridge: 8.6, x: 6.9, z: 1.1 };

  /* Outer clad surfaces, used to hang openings on each elevation. */
  const GAB_FACE = GABLE.z + (GABLE.d / 2) * 1.02 + 0.05;
  const WING_FACE = WING.z + (WING.d / 2) * 1.02 + 0.05;
  const WING_SIDE = WING.x + (WING.w / 2) * 1.02 + 0.05;

  /** Pentagon prism: four walls + the gable triangle, extruded in one go. */
  function prism(w, eave, ridge, depth) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, eave);
    s.lineTo(0, ridge);
    s.lineTo(-w / 2, eave);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return boxUV(g);
  }

  /** Two sloped slabs forming a gable roof over a volume. */
  function gableRoof(v, parent, layer, mat, thick, lift, overhang = 0.62) {
    const ang = Math.atan2(v.ridge - v.eave, v.w / 2);
    const run = v.w / 2;
    const endOver = 0.42;
    const geo = boxUV(
      new THREE.BoxGeometry(run / Math.cos(ang) + overhang, thick, v.d + endOver * 2),
      true,
    );
    const out = [];
    for (const s of [1, -1]) {
      const m = new THREE.Mesh(geo, mat);
      let cx = (s * run) / 2 + s * (overhang / 2) * Math.cos(ang);
      let cy = v.eave + (v.ridge - v.eave) / 2 - (overhang / 2) * Math.sin(ang);
      cx += s * Math.sin(ang) * (thick / 2 + lift);
      cy += Math.cos(ang) * (thick / 2 + lift);
      m.position.set(cx, cy, 0);
      m.rotation.z = -s * ang;
      out.push(place(layer, m, parent));
    }
    return out;
  }

  /* ---- main block ---------------------------------------------------- */
  const mainG = new THREE.Group();
  mainG.position.set(MAIN.x, BASE, MAIN.z);
  mainG.rotation.y = Math.PI / 2; /* ridge runs left-right */
  house.add(mainG);
  {
    const body = prism(MAIN.d, MAIN.eave, MAIN.ridge, MAIN.w);
    place('sheath', new THREE.Mesh(body, MAT.sheath), mainG);
    place('wrap', new THREE.Mesh(body, MAT.wrap), mainG).scale.set(1.006, 1.002, 1.004);
    /* lower storey in clapboard, upper in shingle: split with two clipped
       copies of the same body, offset outward so they read as cladding. */
    const lower = place('clap', new THREE.Mesh(body, MAT.clap), mainG);
    lower.scale.set(1.013, 1.004, 1.009);
    const upper = place('shingle', new THREE.Mesh(body, MAT.shingle), mainG);
    upper.scale.set(1.012, 1.004, 1.008);
    gableRoof({ ...MAIN, w: MAIN.d, d: MAIN.w }, mainG, 'roofDeck', MAT.roofDeck, 0.08, 0.1);
    gableRoof({ ...MAIN, w: MAIN.d, d: MAIN.w }, mainG, 'roof', MAT.roof, 0.11, 0.19);
  }

  /* ---- projecting front gable (over the entry) ------------------------ */
  const gabG = new THREE.Group();
  gabG.position.set(GABLE.x, BASE + GABLE.base, GABLE.z);
  house.add(gabG);
  {
    const body = prism(GABLE.w, GABLE.eave, GABLE.ridge, GABLE.d);
    place('sheath', new THREE.Mesh(body, MAT.sheath), gabG);
    place('wrap', new THREE.Mesh(body, MAT.wrap), gabG).scale.set(1.01, 1.002, 1.01);
    place('clap', new THREE.Mesh(body, MAT.clap), gabG).scale.set(1.02, 1.004, 1.02);
    place('shingle', new THREE.Mesh(body, MAT.shingle), gabG).scale.set(1.018, 1.004, 1.018);
    gableRoof(GABLE, gabG, 'roofDeck', MAT.roofDeck, 0.08, 0.1, 0.55);
    gableRoof(GABLE, gabG, 'roof', MAT.roof, 0.11, 0.19, 0.55);
  }

  /* ---- right wing with a steep hip ------------------------------------ */
  const wingG = new THREE.Group();
  wingG.position.set(WING.x, BASE, WING.z);
  house.add(wingG);
  {
    const body = prism(WING.w, WING.eave, WING.ridge, WING.d);
    place('sheath', new THREE.Mesh(body, MAT.sheath), wingG);
    place('wrap', new THREE.Mesh(body, MAT.wrap), wingG).scale.set(1.01, 1.002, 1.01);
    place('clap', new THREE.Mesh(body, MAT.clap), wingG).scale.set(1.02, 1.004, 1.02);
    place('shingle', new THREE.Mesh(body, MAT.shingle), wingG).scale.set(1.018, 1.004, 1.018);
    gableRoof(WING, wingG, 'roofDeck', MAT.roofDeck, 0.08, 0.1, 0.5);
    gableRoof(WING, wingG, 'roof', MAT.roof, 0.11, 0.19, 0.5);
  }

  /* ---- polygonal bay / turret on the left ----------------------------- */
  const BAY = { x: -6.1, z: FRONT_Z - 0.9, r: 2.05, top: 6.9, sides: 8 };
  const bayG = new THREE.Group();
  bayG.position.set(BAY.x, BASE, BAY.z);
  bayG.rotation.y = Math.PI / BAY.sides;
  house.add(bayG);
  {
    const shell = (rad, h, y0) => {
      const g = new THREE.CylinderGeometry(rad, rad, h, BAY.sides, 1, true);
      g.translate(0, y0 + h / 2, 0);
      return boxUV(g);
    };
    place('sheath', new THREE.Mesh(shell(BAY.r, BAY.top, 0), MAT.sheath), bayG);
    place('wrap', new THREE.Mesh(shell(BAY.r + 0.04, BAY.top, 0), MAT.wrap), bayG);
    place('clap', new THREE.Mesh(shell(BAY.r + 0.09, BAY.top, 0), MAT.clap), bayG);
    place('shingle', new THREE.Mesh(shell(BAY.r + 0.085, BAY.top, 0), MAT.shingle), bayG);

    /* conical cap — the silhouette that says "Victorian" from any distance */
    const capGeo = boxUV(new THREE.ConeGeometry(BAY.r + 0.55, 2.5, BAY.sides, 1));
    capGeo.translate(0, BAY.top + 1.25, 0);
    place('roof', new THREE.Mesh(capGeo, MAT.roof), bayG);
    const capDeck = boxUV(new THREE.ConeGeometry(BAY.r + 0.42, 2.35, BAY.sides, 1));
    capDeck.translate(0, BAY.top + 1.2, 0);
    place('roofDeck', new THREE.Mesh(capDeck, MAT.roofDeck), bayG);

    /* finial */
    const fin = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.05, 0.09, 0.95, 7)),
      MAT.trimDeep,
    );
    fin.position.y = BAY.top + 2.6;
    place('trim', fin, bayG);

    /* belt course where clapboard meets shingle */
    const belt = boxUV(new THREE.CylinderGeometry(BAY.r + 0.2, BAY.r + 0.2, 0.22, BAY.sides));
    belt.translate(0, 3.42, 0);
    place('trim', new THREE.Mesh(belt, MAT.trim), bayG);
  }

  /* ---- belt course: the board the shingle sits on ---------------------- */
  for (const band of [
    { w: MAIN.w + 0.26, d: MAIN.d + 0.26, x: MAIN.x, z: MAIN.z },
    { w: WING.w + 0.26, d: WING.d + 0.26, x: WING.x, z: WING.z },
  ]) {
    const m = new THREE.Mesh(
      boxUV(new THREE.BoxGeometry(band.w, 0.2, band.d)),
      MAT.trim,
    );
    m.position.set(band.x, 3.88, band.z);
    place('trim', m);
  }

  /* ---- chimney --------------------------------------------------------- */
  {
    const geo = boxUV(new THREE.BoxGeometry(1.0, 4.2, 1.0));
    const core = new THREE.Mesh(geo, MAT.sheath);
    core.position.set(2.9, BASE + 8.0, -1.9);
    place('sheath', core);
    const clad = new THREE.Mesh(geo, MAT.stoneTrim);
    clad.position.copy(core.position);
    clad.scale.setScalar(1.06);
    place('trim', clad);
    const cap = new THREE.Mesh(track(new THREE.BoxGeometry(1.35, 0.2, 1.35)), MAT.trimDeep);
    cap.position.set(2.9, BASE + 10.2, -1.9);
    place('trim', cap);
  }

  /* ---- foundation, framing ------------------------------------------- */
  const FOOT = [
    { w: MAIN.w, d: MAIN.d, x: MAIN.x, z: MAIN.z },
    { w: WING.w, d: WING.d, x: WING.x, z: WING.z },
  ];
  for (const f of FOOT) {
    const foot = new THREE.Mesh(
      boxUV(new THREE.BoxGeometry(f.w + 0.5, 0.78, f.d + 0.5)),
      MAT.concrete,
    );
    foot.position.set(f.x, -0.39 + BASE - 0.16, f.z);
    place('footing', foot);

    const st = new THREE.Mesh(
      boxUV(new THREE.BoxGeometry(f.w + 0.22, BASE + 0.2, f.d + 0.22)),
      MAT.stone,
    );
    st.position.set(f.x, (BASE + 0.2) / 2 - 0.1, f.z);
    place('stone', st);

    const dk = new THREE.Mesh(boxUV(new THREE.BoxGeometry(f.w, 0.12, f.d), true), MAT.deck);
    dk.position.set(f.x, BASE + 0.06, f.z);
    place('deck', dk);
  }
  /* bay pier */
  {
    const pier = boxUV(new THREE.CylinderGeometry(BAY.r + 0.18, BAY.r + 0.24, BASE + 0.3, BAY.sides));
    pier.translate(0, (BASE + 0.3) / 2 - 0.15, 0);
    const m = new THREE.Mesh(pier, MAT.stone);
    m.position.set(BAY.x, 0, BAY.z);
    m.rotation.y = Math.PI / BAY.sides;
    place('stone', m);
  }

  /** Stud walls, floor joists and rafters as one instanced mesh per kind. */
  function frameVolume(v, group, isGable) {
    const items = [];
    const sp = 0.62;
    const roofY = (x) => v.eave + (v.ridge - v.eave) * (1 - Math.abs(x) / (v.w / 2));

    for (const sx of [-1, 1]) {
      for (let z = -v.d / 2 + 0.06; z <= v.d / 2; z += sp) {
        items.push([sx * (v.w / 2 - 0.06), v.eave / 2, z, 0.1, v.eave, 0.05]);
      }
      items.push([sx * (v.w / 2 - 0.06), v.eave - 0.05, 0, 0.11, 0.1, v.d]);
      items.push([sx * (v.w / 2 - 0.06), v.eave / 2, 0, 0.11, 0.26, v.d]);
    }
    for (const sz of isGable ? [1] : [-1, 1]) {
      for (let x = -v.w / 2 + 0.06; x <= v.w / 2; x += sp) {
        const h = roofY(x);
        items.push([x, h / 2, sz * (v.d / 2 - 0.06), 0.05, h, 0.1]);
      }
      items.push([0, 0.05, sz * (v.d / 2 - 0.06), v.w, 0.1, 0.11]);
      items.push([0, v.eave / 2, sz * (v.d / 2 - 0.06), v.w, 0.26, 0.11]);
    }
    const ang = Math.atan2(v.ridge - v.eave, v.w / 2);
    const run = v.w / 2;
    const rl = run / Math.cos(ang);
    for (let z = -v.d / 2 + 0.12; z <= v.d / 2; z += sp) {
      for (const s of [1, -1]) {
        items.push([(s * run) / 2, v.eave + (v.ridge - v.eave) / 2 + 0.1, z, rl, 0.22, 0.055, -s * ang]);
      }
    }
    items.push([0, v.ridge + 0.06, 0, 0.055, 0.3, v.d]);

    const im = new THREE.InstancedMesh(unit, MAT.stud, items.length);
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(it[0], it[1], it[2]);
      o.rotation.set(0, 0, it[6] || 0);
      o.scale.set(it[3], it[4], it[5]);
      o.updateMatrix();
      im.setMatrixAt(i, o.matrix);
    });
    im.instanceMatrix.needsUpdate = true;
    place('studs', im, group);

    /* floor joists at the second storey */
    if (v.noJoists) return;
    const jItems = [];
    for (let x = -v.w / 2 + 0.4; x < v.w / 2; x += 0.55) {
      jItems.push([x, 3.25, 0, 0.07, 0.3, v.d]);
    }
    const jm = new THREE.InstancedMesh(unit, MAT.joist, jItems.length);
    jItems.forEach((it, i) => {
      o.position.set(it[0], it[1], it[2]);
      o.rotation.set(0, 0, 0);
      o.scale.set(it[3], it[4], it[5]);
      o.updateMatrix();
      jm.setMatrixAt(i, o.matrix);
    });
    jm.instanceMatrix.needsUpdate = true;
    place('joists', jm, group);
  }
  frameVolume({ w: MAIN.d, d: MAIN.w, eave: MAIN.eave, ridge: MAIN.ridge }, mainG, false);
  frameVolume(GABLE, gabG, true);
  frameVolume(WING, wingG, false);

  /* ---------------------------------------------------------------------
     Windows. Each one is a frame, muntins and a glowing pane. Every pane
     gets its own material so the lights can come on one room at a time.
     --------------------------------------------------------------------- */
  const windows = [];
  const glassMats = [];

  const frameMat = track(new THREE.MeshStandardMaterial({
    color: 0xf1e9dc, roughness: 0.55,
    clippingPlanes: [L.trim.plane], clipShadows: true,
  }));
  const sillMat = track(new THREE.MeshStandardMaterial({
    color: 0xded3c0, roughness: 0.6,
    clippingPlanes: [L.trim.plane], clipShadows: true,
  }));

  /**
   * @param {object} o  x, y, z, w, h, cols, rows, rotY, layer, parent, warm
   */
  function addWindow(o) {
    const { x, y, z, w, h } = o;
    const rotY = o.rotY || 0;
    const layer = o.layer || 'trim';
    const parent = o.parent || house;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    parent.add(g);

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0d0c18,
      roughness: 0.14,
      metalness: 0.55,
      emissive: 0xffffff,
      emissiveMap: T.interior,
      emissiveIntensity: 0,
      clippingPlanes: [L[layer].plane],
    });
    glassMats.push(glassMat);
    track(glassMat);

    const pane = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), glassMat);
    pane.position.z = 0.015;
    g.add(pane);
    L[layer].meshes.push(pane);

    /* casing */
    const t = 0.11;
    const casing = [
      [0, h / 2 + t / 2, w + t * 2, t],
      [0, -h / 2 - t / 2, w + t * 2, t * 1.6],
      [-w / 2 - t / 2, 0, t, h + t * 2],
      [w / 2 + t / 2, 0, t, h + t * 2],
    ];
    for (const [cx, cy, cw, ch] of casing) {
      const m = new THREE.Mesh(unit, frameMat);
      m.position.set(cx, cy, 0.06);
      m.scale.set(cw, ch, 0.12);
      m.castShadow = true;
      g.add(m);
      L[layer].meshes.push(m);
    }
    /* sill */
    const sill = new THREE.Mesh(unit, sillMat);
    sill.position.set(0, -h / 2 - t * 1.1, 0.12);
    sill.scale.set(w + t * 3.2, 0.1, 0.3);
    sill.castShadow = true;
    g.add(sill);
    L[layer].meshes.push(sill);

    /* muntins */
    const cols = o.cols ?? 2;
    const rows = o.rows ?? 2;
    for (let i = 1; i < cols; i++) {
      const m = new THREE.Mesh(unit, frameMat);
      m.position.set(-w / 2 + (i * w) / cols, 0, 0.05);
      m.scale.set(0.045, h, 0.05);
      g.add(m);
      L[layer].meshes.push(m);
    }
    for (let i = 1; i < rows; i++) {
      const m = new THREE.Mesh(unit, frameMat);
      m.position.set(0, -h / 2 + (i * h) / rows, 0.05);
      m.scale.set(w, 0.045, 0.05);
      g.add(m);
      L[layer].meshes.push(m);
    }

    windows.push({ group: g, mat: glassMat, warm: o.warm ?? 1, order: windows.length });
    return g;
  }

  /* front elevation, lower storey — flanking the entry, seen through the
     porch posts, which is the shot the whole page lands on */
  addWindow({ x: -3.1, y: PORCH_Y + 1.25, z: FACE_Z, w: 1.5, h: 2.0, cols: 2, rows: 3 });
  addWindow({ x: 2.1, y: PORCH_Y + 1.25, z: FACE_Z, w: 1.5, h: 2.0, cols: 2, rows: 3 });
  addWindow({ x: 4.0, y: PORCH_Y + 1.25, z: FACE_Z, w: 1.1, h: 1.7, cols: 1, rows: 2, warm: 0.7 });

  /* front elevation, upper storey — clear of the entry gable */
  addWindow({ x: -3.6, y: 5.0, z: FACE_Z, w: 1.35, h: 1.75, cols: 2, rows: 2 });
  addWindow({ x: 3.0, y: 5.0, z: FACE_Z, w: 1.35, h: 1.75, cols: 2, rows: 2, warm: 0.55 });

  /* the entry gable: a balcony door-window, plus a light in the peak */
  addWindow({ x: GABLE.x, y: 5.45, z: GAB_FACE, w: 1.7, h: 1.5, cols: 2, rows: 2 });
  addWindow({ x: GABLE.x, y: 7.5, z: GAB_FACE, w: 0.95, h: 0.95, cols: 1, rows: 1, warm: 0.45 });

  /* the bay: three lit facets, two storeys. Offsets use the apothem of the
     octagon, not its circumradius, or the sashes float off the wall. */
  {
    const apo = (BAY.r + 0.09) * Math.cos(Math.PI / BAY.sides) + 0.06;
    for (const k of [-1, 0, 1]) {
      const ang = k * ((Math.PI * 2) / BAY.sides);
      const px = BAY.x + Math.sin(ang) * apo;
      const pz = BAY.z + Math.cos(ang) * apo;
      addWindow({ x: px, y: PORCH_Y + 1.35, z: pz, w: 1.05, h: 2.2, cols: 1, rows: 3, rotY: ang });
      addWindow({
        x: px, y: 5.1, z: pz,
        w: 0.98, h: 1.55, cols: 1, rows: 2, rotY: ang,
        warm: k === 0 ? 0.9 : 0.45,
      });
    }
  }

  /* right wing */
  addWindow({ x: WING.x - 1.0, y: 1.6, z: WING_FACE, w: 1.2, h: 1.5, cols: 2, rows: 2, warm: 0.8 });
  addWindow({ x: WING.x + 1.2, y: 1.6, z: WING_FACE, w: 1.0, h: 1.5, cols: 1, rows: 2, warm: 0.3 });
  addWindow({ x: WING.x, y: 4.3, z: WING_FACE, w: 1.3, h: 1.5, cols: 2, rows: 2, warm: 0.65 });
  addWindow({
    x: WING_SIDE, y: 1.7, z: WING.z + 0.6,
    w: 1.2, h: 1.6, cols: 2, rows: 2, rotY: Math.PI / 2, warm: 0.5,
  });

  /* ---------------------------------------------------------------------
     The porch. This is where the whole page lands, so it gets real
     detail: turned posts, a railing, brackets, a beadboard ceiling and
     a bluestone stair.
     --------------------------------------------------------------------- */
  const PORCH = { x0: -4.6, x1: 4.9, z0: FRONT_Z - 0.1, z1: FRONT_Z + 3.3 };
  const porchGroup = new THREE.Group();
  house.add(porchGroup);
  {
    const w = PORCH.x1 - PORCH.x0;
    const d = PORCH.z1 - PORCH.z0;
    const cx = (PORCH.x0 + PORCH.x1) / 2;
    const cz = (PORCH.z0 + PORCH.z1) / 2;

    /* skirt + deck */
    const skirt = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w, PORCH_Y, d)), MAT.stoneTrim);
    skirt.position.set(cx, PORCH_Y / 2, cz);
    place('porch', skirt, porchGroup);

    const deck = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w + 0.3, 0.16, d + 0.3), true), MAT.porchDeck);
    deck.position.set(cx, PORCH_Y + 0.02, cz);
    place('porch', deck, porchGroup);

    /* steps, centred on the door */
    for (let i = 0; i < 3; i++) {
      const h = PORCH_Y - i * (PORCH_Y / 3);
      const step = new THREE.Mesh(
        boxUV(new THREE.BoxGeometry(3.3, h, 0.42), true),
        MAT.porchDeck,
      );
      step.position.set(DOOR.x, h / 2, PORCH.z1 + 0.28 + i * 0.42);
      place('porch', step, porchGroup);
    }

    /* posts */
    const postXs = [-4.4, -2.4, 1.4, 3.3, 4.75];
    const capGeo = track(new THREE.BoxGeometry(0.44, 0.14, 0.44));
    for (const px of postXs) {
      const shaft = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.15, 0.17, 2.62, 12)),
        MAT.porchTrim,
      );
      shaft.position.set(px, PORCH_Y + 0.1 + 1.31, PORCH.z1 - 0.3);
      place('porch', shaft, porchGroup);

      for (const [dy, sc] of [[0.1, 1], [2.72, 1]]) {
        const cap = new THREE.Mesh(capGeo, MAT.porchTrim);
        cap.position.set(px, PORCH_Y + dy + 0.07, PORCH.z1 - 0.3);
        cap.scale.setScalar(sc);
        place('porch', cap, porchGroup);
      }
      /* scroll brackets, as simple chamfered blocks */
      for (const s of [-1, 1]) {
        if ((px === postXs[0] && s === -1) || (px === postXs[postXs.length - 1] && s === 1)) continue;
        const b = new THREE.Mesh(unit, MAT.porchTrim);
        b.scale.set(0.78, 0.13, 0.14);
        b.position.set(px + s * 0.36, PORCH_Y + 2.56, PORCH.z1 - 0.3);
        b.rotation.z = s * -0.72;
        place('porch', b, porchGroup);
      }
    }

    /* railing between posts, skipping the stair opening */
    const stairA = DOOR.x - 1.75, stairB = DOOR.x + 1.75;
    for (let i = 0; i < postXs.length - 1; i++) {
      const a = postXs[i] + 0.2, b = postXs[i + 1] - 0.2;
      if (b <= stairA || a >= stairB) {
        const railTop = new THREE.Mesh(unit, MAT.porchTrim);
        railTop.scale.set(b - a, 0.1, 0.14);
        railTop.position.set((a + b) / 2, PORCH_Y + 1.06, PORCH.z1 - 0.3);
        place('porch', railTop, porchGroup);
        const railBot = new THREE.Mesh(unit, MAT.porchTrim);
        railBot.scale.set(b - a, 0.08, 0.12);
        railBot.position.set((a + b) / 2, PORCH_Y + 0.28, PORCH.z1 - 0.3);
        place('porch', railBot, porchGroup);
        const n = Math.max(2, Math.round((b - a) / 0.22));
        const balGeo = track(new THREE.CylinderGeometry(0.035, 0.045, 0.74, 6));
        const bal = new THREE.InstancedMesh(balGeo, MAT.porchTrim, n);
        const o = new THREE.Object3D();
        for (let k = 0; k < n; k++) {
          o.position.set(a + ((k + 0.5) * (b - a)) / n, PORCH_Y + 0.67, PORCH.z1 - 0.3);
          o.rotation.set(0, 0, 0);
          o.scale.setScalar(1);
          o.updateMatrix();
          bal.setMatrixAt(k, o.matrix);
        }
        bal.instanceMatrix.needsUpdate = true;
        place('porch', bal, porchGroup);
      }
    }

    /* beam, ceiling and the shed roof over the porch */
    const beam = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w + 0.5, 0.38, 0.4)), MAT.porchTrim);
    beam.position.set(cx, PORCH_Y + 2.95, PORCH.z1 - 0.3);
    place('porch', beam, porchGroup);

    const ceil = new THREE.Mesh(track(new THREE.PlaneGeometry(w, d)), MAT.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(cx, PORCH_Y + 2.86, cz);
    place('porch', ceil, porchGroup);

    const zA = PORCH.z0, zB = PORCH.z1 + 0.5;
    const yA = PORCH_Y + 3.55, yB = PORCH_Y + 3.0;
    const ang = Math.atan2(yA - yB, zB - zA);
    const len = Math.hypot(zB - zA, yA - yB);
    const proof = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w + 0.7, 0.15, len), true), MAT.porchRoof);
    proof.position.set(cx, (yA + yB) / 2 + 0.08, (zA + zB) / 2);
    proof.rotation.x = ang;
    place('porch', proof, porchGroup);

    const fascia = new THREE.Mesh(boxUV(new THREE.BoxGeometry(w + 0.72, 0.26, 0.12)), MAT.porchTrim);
    fascia.position.set(cx, yB - 0.03, zB);
    place('porch', fascia, porchGroup);

    /* house number, as real geometry rather than a drawn graphic */
    const plaque = new THREE.Mesh(unit, MAT.trimDeep);
    plaque.scale.set(0.9, 0.3, 0.06);
    plaque.position.set(DOOR.x, PORCH_Y + 2.72, PORCH.z1 - 0.52);
    place('porch', plaque, porchGroup);
  }

  /* A small balcony sitting on the porch roof, in front of the entry
     gable — the detail that reads "Victorian" from across the street. */
  {
    const bY = BASE + GABLE.base;
    const bz0 = GAB_FACE - 0.02;
    const bz1 = bz0 + 1.0;
    const bw = 2.9;
    const deck = new THREE.Mesh(
      boxUV(new THREE.BoxGeometry(bw, 0.12, bz1 - bz0), true),
      MAT.porchDeck,
    );
    deck.position.set(GABLE.x, bY, (bz0 + bz1) / 2);
    place('porch', deck, house);

    const rail = (x, y, z, w, h, d) => {
      const m = new THREE.Mesh(unit, MAT.porchTrim);
      m.scale.set(w, h, d);
      m.position.set(x, y, z);
      place('porch', m, house);
    };
    rail(GABLE.x, bY + 0.86, bz1, bw, 0.09, 0.12);
    rail(GABLE.x, bY + 0.14, bz1, bw, 0.07, 0.1);
    for (const sx of [-1, 1]) {
      rail(GABLE.x + sx * (bw / 2), bY + 0.5, (bz0 + bz1) / 2, 0.1, 0.95, bz1 - bz0);
    }
    const n = 13;
    const balGeo = track(new THREE.CylinderGeometry(0.032, 0.04, 0.7, 6));
    const bal = new THREE.InstancedMesh(balGeo, MAT.porchTrim, n);
    const o = new THREE.Object3D();
    for (let k = 0; k < n; k++) {
      o.position.set(GABLE.x - bw / 2 + ((k + 0.5) * bw) / n, bY + 0.5, bz1);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(1);
      o.updateMatrix();
      bal.setMatrixAt(k, o.matrix);
    }
    bal.instanceMatrix.needsUpdate = true;
    place('porch', bal, house);
  }

  /* ---------------------------------------------------------------------
     The front door. The one thing on this page you can press.
     --------------------------------------------------------------------- */
  const doorPivot = new THREE.Group();
  doorPivot.position.set(DOOR.x - DOOR.w / 2, PORCH_Y, DOOR.z);
  house.add(doorPivot);

  const doorMat = track(new THREE.MeshStandardMaterial({
    color: 0x3f2436, roughness: 0.42, metalness: 0.08,
    clippingPlanes: [L.porch.plane], clipShadows: true,
  }));
  const brassMat = track(new THREE.MeshStandardMaterial({
    color: 0xd9a348, roughness: 0.26, metalness: 0.92,
    emissive: 0x3a2206, emissiveIntensity: 0.35,
    clippingPlanes: [L.porch.plane],
  }));
  const doorGlassMat = track(new THREE.MeshStandardMaterial({
    color: 0x120d1c, roughness: 0.1, metalness: 0.4,
    emissive: 0xffffff, emissiveMap: T.interior, emissiveIntensity: 0,
    clippingPlanes: [L.porch.plane],
  }));
  glassMats.push(doorGlassMat);

  {
    const slab = new THREE.Mesh(boxUV(new THREE.BoxGeometry(DOOR.w, DOOR.h, 0.1)), doorMat);
    slab.position.set(DOOR.w / 2, DOOR.h / 2, 0);
    slab.castShadow = true;
    doorPivot.add(slab);
    L.porch.meshes.push(slab);
    track(slab.geometry);

    /* raised panels */
    for (const [py, ph] of [[0.52, 0.72], [1.34, 0.56]]) {
      const p = new THREE.Mesh(unit, doorMat);
      p.scale.set(DOOR.w - 0.3, ph, 0.03);
      p.position.set(DOOR.w / 2, py, 0.062);
      doorPivot.add(p);
      L.porch.meshes.push(p);
    }
    /* glazed upper light */
    const lite = new THREE.Mesh(track(new THREE.PlaneGeometry(DOOR.w - 0.34, 0.74)), doorGlassMat);
    lite.position.set(DOOR.w / 2, 1.98, 0.056);
    doorPivot.add(lite);
    L.porch.meshes.push(lite);
    const liteFrame = new THREE.Mesh(unit, MAT.porchTrim);
    liteFrame.scale.set(DOOR.w - 0.22, 0.86, 0.04);
    liteFrame.position.set(DOOR.w / 2, 1.98, 0.048);
    doorPivot.add(liteFrame);
    L.porch.meshes.push(liteFrame);

    /* knob + plate */
    const knob = new THREE.Mesh(track(new THREE.SphereGeometry(0.062, 16, 12)), brassMat);
    knob.position.set(DOOR.w - 0.17, 1.06, 0.095);
    doorPivot.add(knob);
    L.porch.meshes.push(knob);
    const plate = new THREE.Mesh(unit, brassMat);
    plate.scale.set(0.09, 0.4, 0.02);
    plate.position.set(DOOR.w - 0.17, 1.06, 0.055);
    doorPivot.add(plate);
    L.porch.meshes.push(plate);
  }

  /* door casing, sidelights and transom — these stay put when it swings */
  {
    const caseMat = MAT.porchTrim;
    const side = (sx) => {
      const g = new THREE.Mesh(unit, caseMat);
      g.scale.set(0.16, DOOR.h + 0.5, 0.16);
      g.position.set(DOOR.x + sx * (DOOR.w / 2 + 0.42), PORCH_Y + (DOOR.h + 0.5) / 2, FACE_Z + 0.05);
      place('porch', g, house);
      const sl = new THREE.Mesh(track(new THREE.PlaneGeometry(0.42, DOOR.h - 0.5)), doorGlassMat);
      sl.position.set(DOOR.x + sx * (DOOR.w / 2 + 0.2), PORCH_Y + (DOOR.h - 0.5) / 2 + 0.3, FACE_Z + 0.015);
      house.add(sl);
      L.porch.meshes.push(sl);
    };
    side(-1); side(1);

    const head = new THREE.Mesh(unit, caseMat);
    head.scale.set(DOOR.w + 1.5, 0.22, 0.2);
    head.position.set(DOOR.x, PORCH_Y + DOOR.h + 0.62, FACE_Z + 0.06);
    place('porch', head, house);

    const transom = new THREE.Mesh(track(new THREE.PlaneGeometry(DOOR.w + 1.0, 0.4)), doorGlassMat);
    transom.position.set(DOOR.x, PORCH_Y + DOOR.h + 0.3, FACE_Z + 0.015);
    house.add(transom);
    L.porch.meshes.push(transom);
  }

  /* What is behind the door. The wall itself is solid, so the opening is a
     lit plane sitting just inside the casing: swing the slab away and you
     are looking into a warm hallway, not at siding. */
  const hallMat = track(new THREE.MeshStandardMaterial({
    color: 0x1a1016,
    roughness: 1,
    emissive: 0xffffff,
    emissiveMap: T.interior,
    emissiveIntensity: 0,
    clippingPlanes: [L.porch.plane],
  }));
  const doorway = new THREE.Mesh(
    track(new THREE.PlaneGeometry(DOOR.w + 0.04, DOOR.h)),
    hallMat,
  );
  doorway.position.set(DOOR.x, DOOR.y, DOOR.z - 0.07);
  house.add(doorway);
  L.porch.meshes.push(doorway);

  /* porch lanterns, flanking the door */
  const lanternMats = [];
  for (const sx of [-1, 1]) {
    const body = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 6)),
      track(new THREE.MeshStandardMaterial({
        color: 0xffc46a, roughness: 0.3,
        emissive: 0xffb547, emissiveIntensity: 0,
        clippingPlanes: [L.porch.plane],
      })),
    );
    lanternMats.push(body.material);
    body.position.set(DOOR.x + sx * 1.42, PORCH_Y + 2.1, FACE_Z + 0.2);
    house.add(body);
    L.porch.meshes.push(body);
    const arm = new THREE.Mesh(unit, MAT.trimDeep);
    arm.scale.set(0.06, 0.3, 0.06);
    arm.position.set(DOOR.x + sx * 1.42, PORCH_Y + 2.42, FACE_Z + 0.2);
    place('porch', arm, house);
  }

  /* ---------------------------------------------------------------------
     Ground, planting, treeline
     --------------------------------------------------------------------- */
  const lawnMat = track(new THREE.MeshStandardMaterial({ map: T.lawn, roughness: 1 }));
  const lawn = new THREE.Mesh(track(new THREE.PlaneGeometry(420, 420)), lawnMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.receiveShadow = true;
  scene.add(lawn);

  /* the construction pad: dirt that greens over at the end */
  const padMat = track(new THREE.MeshStandardMaterial({ map: T.dirt, roughness: 1, transparent: true, opacity: 1 }));
  const pad = new THREE.Mesh(track(new THREE.PlaneGeometry(40, 32)), padMat);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-0.5, 0.012, 2);
  pad.receiveShadow = true;
  scene.add(pad);

  const pathMat = track(new THREE.MeshStandardMaterial({
    map: T.deckBoard, color: 0x6e675b, roughness: 0.95,
    transparent: true, opacity: 0,
  }));
  const path = new THREE.Mesh(track(new THREE.PlaneGeometry(2.4, 16)), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.set(DOOR.x, 0.03, PORCH.z1 + 9.3);
  path.receiveShadow = true;
  scene.add(path);

  /* shrubs along the porch, which pop in on the last beat */
  const shrubs = [];
  {
    const geo = track(new THREE.IcosahedronGeometry(0.58, 1));
    const mat = track(new THREE.MeshStandardMaterial({ color: 0x29391f, roughness: 0.95, flatShading: true }));
    const spots = [
      [-8.0, 8.0], [-7.0, 8.2], [-6.0, 8.05], [-5.0, 8.25], [-4.0, 8.1],
      [-2.6, 8.2], [1.9, 8.15], [2.9, 8.3], [3.9, 8.1], [4.8, 8.25],
      [5.9, 6.6], [6.9, 6.8], [7.9, 6.6], [9.3, 5.2],
    ];
    spots.forEach(([x, z], i) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, 0.44, z);
      m.castShadow = true;
      m.scale.setScalar(0.0001);
      m.userData = { s: rr(0.78, 1.18), sy: rr(1.0, 1.5), d: i * 0.035 };
      scene.add(m);
      shrubs.push(m);
    });
  }

  /* a dense treeline, so the house sits in a place instead of a void */
  {
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 1 }));
    const crownMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, flatShading: true }));
    const spots = [];
    for (let i = 0; i < 110; i++) spots.push([rr(-78, 86), rr(-70, -13)]);
    for (let i = 0; i < 46; i++) {
      const s = rnd() < 0.5 ? -1 : 1;
      spots.push([s < 0 ? rr(-80, -16) : rr(17, 84), rr(-14, 22)]);
    }
    const crowns = new THREE.InstancedMesh(track(new THREE.IcosahedronGeometry(1, 1)), crownMat, spots.length * 3);
    const trunks = new THREE.InstancedMesh(track(new THREE.CylinderGeometry(0.2, 0.3, 1, 6)), trunkMat, spots.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    const greens = ['#1d2c18', '#26381e', '#162312', '#2d4222', '#1a2a15'];
    let k = 0;
    spots.forEach(([x, z], i) => {
      const h = rr(6, 13), r = rr(2.4, 4.6);
      o.position.set(x, h / 2, z);
      o.rotation.set(0, 0, 0);
      o.scale.set(1, h, 1);
      o.updateMatrix();
      trunks.setMatrixAt(i, o.matrix);
      for (let c = 0; c < 3; c++) {
        o.position.set(x + rr(-1, 1) * r * 0.5, h + rr(-0.4, 1.7) * r * 0.6, z + rr(-1, 1) * r * 0.45);
        o.rotation.set(rnd(), rnd(), rnd());
        const s = r * rr(0.62, 1.0);
        o.scale.set(s, s * rr(1, 1.4), s);
        o.updateMatrix();
        crowns.setMatrixAt(k, o.matrix);
        crowns.setColorAt(k, col.set(pick(greens)));
        k++;
      }
    });
    crowns.instanceMatrix.needsUpdate = true;
    if (crowns.instanceColor) crowns.instanceColor.needsUpdate = true;
    trunks.instanceMatrix.needsUpdate = true;
    crowns.castShadow = !lowEnd;
    scene.add(crowns, trunks);
  }

  /* ---------------------------------------------------------------------
     Survey act: stakes, string lines and a set-out plan drawn on the dirt.
     This is what you see before a single thing is built.
     --------------------------------------------------------------------- */
  const survey = new THREE.Group();
  scene.add(survey);
  const surveyMat = track(new THREE.LineBasicMaterial({
    color: new THREE.Color(1.1, 1.55, 2.4),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    fog: false,
  }));
  {
    const pts = [];
    const rect = (x0, x1, z0, z1, y = 0.05) => {
      pts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    };
    rect(MAIN.x - MAIN.w / 2, MAIN.x + MAIN.w / 2, MAIN.z - MAIN.d / 2, MAIN.z + MAIN.d / 2);
    rect(WING.x - WING.w / 2, WING.x + WING.w / 2, WING.z - WING.d / 2, WING.z + WING.d / 2);
    rect(PORCH.x0, PORCH.x1, PORCH.z0, PORCH.z1);
    rect(GABLE.x - GABLE.w / 2, GABLE.x + GABLE.w / 2, GABLE.z - GABLE.d, GABLE.z);
    /* bay octagon */
    for (let i = 0; i < BAY.sides; i++) {
      const a0 = (i / BAY.sides) * Math.PI * 2 + Math.PI / BAY.sides;
      const a1 = ((i + 1) / BAY.sides) * Math.PI * 2 + Math.PI / BAY.sides;
      pts.push(
        BAY.x + Math.sin(a0) * BAY.r, 0.05, BAY.z + Math.cos(a0) * BAY.r,
        BAY.x + Math.sin(a1) * BAY.r, 0.05, BAY.z + Math.cos(a1) * BAY.r,
      );
    }
    /* dimension line across the front */
    const dz = PORCH.z1 + 2.6;
    pts.push(PORCH.x0, 0.05, dz, 9.4, 0.05, dz);
    for (const x of [PORCH.x0, MAIN.x - MAIN.w / 2, MAIN.x + MAIN.w / 2, 9.4]) {
      pts.push(x, 0.05, dz - 0.45, x, 0.05, dz + 0.45);
    }
    /* a vertical height stick, so the empty lot has scale */
    pts.push(-11.5, 0.05, 3.2, -11.5, 10.1, 3.2);
    for (const y of [0.05, 3.3, 6.6, 10.05]) pts.push(-11.9, y, 3.2, -11.1, y, 3.2);

    const g = track(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const lines = new THREE.LineSegments(g, surveyMat);
    lines.renderOrder = 8;
    survey.add(lines);

    /* corner stakes */
    const stakeMat = track(new THREE.MeshStandardMaterial({
      color: 0xffb547, emissive: 0xff8c1a, emissiveIntensity: 0.6, roughness: 0.7,
    }));
    const stakeGeo = track(new THREE.CylinderGeometry(0.035, 0.01, 1.1, 5));
    const stakes = [
      [MAIN.x - MAIN.w / 2, MAIN.z - MAIN.d / 2], [MAIN.x + MAIN.w / 2, MAIN.z - MAIN.d / 2],
      [PORCH.x0, PORCH.z1], [PORCH.x1, PORCH.z1],
      [WING.x + WING.w / 2, WING.z + WING.d / 2], [WING.x + WING.w / 2, WING.z - WING.d / 2],
      [BAY.x, BAY.z + BAY.r],
    ];
    for (const [x, z] of stakes) {
      const m = new THREE.Mesh(stakeGeo, stakeMat);
      m.position.set(x, 0.55, z);
      survey.add(m);
    }
  }

  const grid = new THREE.GridHelper(220, 110, 0x4a3f87, 0x241f4d);
  grid.material.transparent = true;
  grid.material.depthWrite = false;
  grid.position.y = 0.008;
  track(grid.material);
  track(grid.geometry);
  scene.add(grid);

  /* ---------------------------------------------------------------------
     Sky and light. The arc is late afternoon -> blue hour, because the
     photograph that set the palette was taken at blue hour.
     --------------------------------------------------------------------- */
  const skyU = {
    top: { value: new THREE.Color('#0a0818') },
    hor: { value: new THREE.Color('#4a3f87') },
    bot: { value: new THREE.Color('#0c0a1c') },
  };
  const skyMat = track(new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vP;
      void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform vec3 top, hor, bot;
      varying vec3 vP;
      void main(){
        float h = vP.y;
        vec3 c = h > 0.0
          ? mix(hor, top, pow(smoothstep(0.0, 0.62, h), 0.78))
          : mix(hor, bot, smoothstep(0.0, -0.18, h));
        /* a touch of banding relief */
        c += (fract(sin(dot(vP.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(900, 32, 16)), skyMat);
  sky.renderOrder = -1;
  scene.add(sky);

  const PALETTE = {
    afternoon: { top: new THREE.Color('#2f4f8a'), hor: new THREE.Color('#cdb5a0'), bot: new THREE.Color('#3b3326') },
    dusk:      { top: new THREE.Color('#171436'), hor: new THREE.Color('#6a4f8e'), bot: new THREE.Color('#171028') },
    night:     { top: new THREE.Color('#07061a'), hor: new THREE.Color('#2b2458'), bot: new THREE.Color('#09071a') },
  };

  const hemi = new THREE.HemisphereLight(0x9fb3e8, 0x3a2a1e, 0.22);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffd9a8, 1.1);
  sun.position.set(34, 30, 26);
  if (!lowEnd) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 26, bottom: -16, near: 1, far: 150 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.045;
    sun.shadow.camera.updateProjectionMatrix();
  }
  sun.target.position.set(0, 2, 2);
  scene.add(sun, sun.target);

  /* the porch lamp — the only warm light left once the sun is gone */
  const porchLight = new THREE.PointLight(0xffb86b, 0, 11, 2);
  porchLight.position.set(DOOR.x, PORCH_Y + 2.2, FACE_Z + 0.9);
  scene.add(porchLight);

  const windowSpill = new THREE.PointLight(0xffc98a, 0, 22, 2);
  windowSpill.position.set(-2.0, 2.4, FACE_Z + 2.6);
  scene.add(windowSpill);

  const moon = new THREE.DirectionalLight(0x8fa6e8, 0);
  moon.position.set(-28, 22, -16);
  scene.add(moon);

  /* Blue-hour skylight. Without it the house goes black between sunset and
     the lamps coming on, which is exactly the stretch where the shingle,
     clapboard and trim are worth looking at. No shadows: it is fill. */
  const skylight = new THREE.DirectionalLight(0x9db6ee, 0.0);
  skylight.position.set(-14, 26, 34);
  scene.add(skylight);

  const SUN_HIGH = new THREE.Vector3(34, 30, 26);
  const SUN_LOW = new THREE.Vector3(-40, 5.5, 14);

  /* ------------------------------------------------------------- state */
  let progress = 0;
  let doorT = 0;
  let approach = 0;
  let px = 0, py = 0;      /* pointer, smoothed */
  let tpx = 0, tpy = 0;    /* pointer, target */
  let running = false;
  let raf = 0;
  let disposed = false;
  let hovering = false;
  let hoverCb = null;
  let firstFrame;
  const ready = new Promise((res) => { firstFrame = res; });

  const _camPos = new THREE.Vector3();
  const _camTgt = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _c = new THREE.Color();
  const _d = new THREE.Color();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /* an invisible, generous hit target in front of the door */
  const doorHit = new THREE.Mesh(
    track(new THREE.PlaneGeometry(DOOR.w + 1.4, DOOR.h + 0.7)),
    track(new THREE.MeshBasicMaterial({ visible: false })),
  );
  doorHit.position.set(DOOR.x, PORCH_Y + (DOOR.h + 0.7) / 2, FACE_Z + 0.35);
  scene.add(doorHit);
  const doorAnchor = new THREE.Object3D();
  doorAnchor.position.set(DOOR.x, PORCH_Y + DOOR.h * 0.62, FACE_Z + 0.3);
  scene.add(doorAnchor);

  function shotAt(p) {
    let i = 0;
    while (i < SHOTS.length - 2 && p > SHOTS[i + 1][0]) i++;
    const [p0, a0, t0] = SHOTS[i];
    const [p1, a1, t1] = SHOTS[i + 1];
    const raw = inv(p0, p1, p);
    const t = raw * raw * (3 - 2 * raw);
    _camPos.set(lerp(a0[0], a1[0], t), lerp(a0[1], a1[1], t), lerp(a0[2], a1[2], t));
    _camTgt.set(lerp(t0[0], t1[0], t), lerp(t0[1], t1[1], t), lerp(t0[2], t1[2], t));
  }

  function applyProgress(p) {
    /* clipping planes reveal each layer bottom-up */
    for (const key in L) {
      const l = L[key];
      const t = smooth(l.a, l.b, p);
      /* normal is (0,-1,0), so the kept half-space is y <= constant:
         raise the constant and the layer grows up out of the ground. */
      const floor = l.from ?? 0;
      l.plane.constant = t <= 0 ? -1 : floor + t * (l.top - floor);
    }

    /* survey fades as concrete arrives */
    const surveyOn = 1 - smooth(0.10, 0.26, p);
    surveyMat.opacity = surveyOn * 0.95;
    survey.visible = surveyOn > 0.01;
    survey.children.forEach((c) => {
      if (c.isMesh) { c.scale.setScalar(Math.max(0.0001, surveyOn)); }
    });
    grid.material.opacity = surveyOn * 0.33;
    grid.visible = surveyOn > 0.01;

    /* dirt pad greens over, path appears */
    padMat.opacity = 1 - smooth(0.86, 0.96, p);
    pad.visible = padMat.opacity > 0.01;
    pathMat.opacity = smooth(0.88, 0.97, p);
    path.visible = pathMat.opacity > 0.01;

    /* shrubs */
    const yardT = smooth(SCHEDULE.yard[0], SCHEDULE.yard[1], p);
    for (const s of shrubs) {
      const k = clamp01((yardT - s.userData.d) / 0.5);
      const e = k === 0 ? 0 : 1 + 1.7 * Math.pow(k - 1, 3) + 0.7 * Math.pow(k - 1, 2);
      s.scale.set(s.userData.s * e, s.userData.s * s.userData.sy * e, s.userData.s * e);
      s.visible = k > 0.001;
    }

    /* sky: afternoon -> dusk -> night */
    const toDusk = smooth(0.40, 0.82, p);
    const toNight = smooth(0.80, 1.0, p);
    for (const key of ['top', 'hor', 'bot']) {
      _c.copy(PALETTE.afternoon[key]).lerp(PALETTE.dusk[key], toDusk);
      _c.lerp(PALETTE.night[key], toNight);
      skyU[key].value.copy(_c);
    }
    scene.fog.color.copy(skyU.hor.value).multiplyScalar(0.55);
    scene.fog.near = lerp(60, 34, toNight);
    scene.fog.far = lerp(260, 165, toNight);

    /* sun sinks and cools out; moon takes over */
    _a.copy(SUN_HIGH).lerp(SUN_LOW, toDusk);
    sun.position.copy(_a);
    sun.intensity = lerp(1.15, 0.12, smooth(0.70, 0.97, p));
    _d.set(0xffd9a8).lerp(_c.set(0xff8e4e), toDusk);
    sun.color.copy(_d);
    moon.intensity = toNight * 0.3;
    skylight.intensity = smooth(0.46, 0.80, p) * 0.62;
    hemi.intensity = lerp(0.26, 0.30, toDusk);
    hemi.color.set(0x9fb3e8).lerp(_c.set(0x7e8fd0), toNight);

    /* the lights come on, one room at a time */
    const lightsT = smooth(0.84, 1.0, p);
    windows.forEach((w, i) => {
      const stagger = (i % 7) * 0.055 + (i > 10 ? 0.12 : 0);
      const k = clamp01((lightsT - stagger) / 0.42);
      /* small flicker on ignition reads as a filament warming up */
      const warm = k * w.warm;
      w.mat.emissiveIntensity = warm * 1.85;
    });
    doorGlassMat.emissiveIntensity = lightsT * 1.7;
    const lampT = smooth(0.88, 1.0, p);
    lanternMats.forEach((m) => { m.emissiveIntensity = lampT * 2.2; });
    porchLight.intensity = lampT * 4.4;
    windowSpill.intensity = lightsT * 2.6;
    hallMat.emissiveIntensity = lightsT * 1.9;

    if (bloom) bloom.strength = lerp(0.0, 0.46, lightsT);
    renderer.toneMappingExposure = lerp(1.0, 1.08, toNight);
  }

  function frame() {
    if (!running || disposed) return;
    raf = requestAnimationFrame(frame);

    /* pointer easing, skipped under reduced motion */
    if (!reduced) {
      px += (tpx - px) * 0.06;
      py += (tpy - py) * 0.06;
    }

    shotAt(progress);

    /* the final push through the doorway when the dashboard opens */
    if (approach > 0) {
      const e = approach * approach;
      _a.set(DOOR.x, PORCH_Y + DOOR.h * 0.52, FACE_Z - 1.6);
      _camPos.lerp(_a, e * 0.92);
      _b.set(DOOR.x, PORCH_Y + DOOR.h * 0.5, FACE_Z - 3.2);
      _camTgt.lerp(_b, e * 0.92);
    }

    const parallax = (1 - approach) * (1 - progress * 0.55);
    camera.position.set(
      _camPos.x + px * 1.5 * parallax,
      _camPos.y + py * 0.7 * parallax,
      _camPos.z,
    );
    camera.lookAt(_camTgt);

    doorPivot.rotation.y = -doorT * 1.62;

    composer.render();
    if (firstFrame) { firstFrame(); firstFrame = null; }
  }

  /* --------------------------------------------------------------- api */

  function resize() {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    fitFov();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowEnd ? 1.3 : 1.75));
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    if (bloom) bloom.setSize(w, h);
  }

  function hitDoor(nx, ny) {
    if (progress < 0.9) return false;
    ndc.set(nx, ny);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(doorHit, false).length > 0;
  }

  const api = {
    ready,
    quality,
    get progress() { return progress; },
    setProgress(p) {
      progress = clamp01(p);
      applyProgress(progress);
      if (!running) composer.render();
    },
    setDoor(t) { doorT = clamp01(t); },
    setApproach(t) { approach = clamp01(t); },
    pointerMove(nx, ny) {
      tpx = nx; tpy = ny;
      const h = hitDoor(nx, ny);
      if (h !== hovering) {
        hovering = h;
        if (hoverCb) hoverCb(h);
      }
    },
    hitDoor,
    onDoorHover(cb) { hoverCb = cb; },
    doorScreenPoint() {
      _a.copy(doorAnchor.position).project(camera);
      return {
        x: (_a.x * 0.5 + 0.5) * innerWidth,
        y: (-_a.y * 0.5 + 0.5) * innerHeight,
        visible: _a.z < 1,
      };
    },
    resize,
    start() {
      if (running || disposed) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      api.stop();
      scene.traverse((o) => {
        if (o.isMesh || o.isInstancedMesh || o.isLineSegments) {
          o.geometry?.dispose?.();
          const m = o.material;
          if (Array.isArray(m)) m.forEach((x) => x.dispose?.());
          else m?.dispose?.();
        }
      });
      disposables.forEach((d) => d.dispose?.());
      disposables.clear();
      composer.dispose?.();
      bloom?.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      scene.clear();
    },
  };

  applyProgress(0);
  return api;
}
