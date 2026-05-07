/**
 * chpt12-work-along-path.js
 * §12.3 motivation: work done by a vector field along an oriented path.
 *
 * Vector field (uniform drift + rotation):
 *   F(x, y) = (1.5 - y, x)
 * Oriented path L (upper unit half-circle, CCW from (-1, 0) to (1, 0)):
 *   r(t) = (-cos(π t), sin(π t)),   t ∈ [0, 1]
 * Tangent direction r'(t) = (π sin(π t), π cos(π t)).
 *
 * The path is rendered as a coloured ribbon:
 *   green where F·τ > 0  (the field does positive work on the particle)
 *   red where F·τ < 0    (the field opposes the motion)
 *   grey beyond the current slider position (not yet traversed).
 *
 * A particle slides along L with two attached arrows:
 *   red  — the field F at the particle (length scaled by |F|)
 *   blue — the unit tangent τ
 * The HTML readout shows current t, instantaneous F·τ (colour-coded by sign),
 * accumulated work W(t), and the total work over the full path.
 *
 * Math (x,y) → Three.js (x, 0, -y), matching chpt11 / 11–12 convention.
 */

import * as THREE from 'three';

// ── Field & path ───────────────────────────────────────────────────────────

function field(x, y) {
  return { x: 1.5 - y, y: x };
}

const T0 = 0, T1 = 1;
function path(t) {
  const a = Math.PI * t;
  return { x: -Math.cos(a), y: Math.sin(a) };
}
function pathD(t) {
  const a = Math.PI * t;
  return { x: Math.PI * Math.sin(a), y: Math.PI * Math.cos(a) };
}

// True work W = ∫₀¹ F(r(t))·r'(t) dt by Simpson at high res.
const TRUE_WORK = (() => {
  const M = 4000;
  const dt = (T1 - T0) / M;
  let s = 0;
  for (let i = 0; i <= M; i++) {
    const t = T0 + i * dt;
    const p = path(t);
    const d = pathD(t);
    const F = field(p.x, p.y);
    const w = (i === 0 || i === M) ? 1 : (i % 2 === 1 ? 4 : 2);
    s += w * (F.x * d.x + F.y * d.y);
  }
  return s * dt / 3;
})();

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt12-work-along-path');
container.style.position = 'relative';

// ── Renderer + camera ──────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -1.5, X1 = 1.5, Y0 = -0.45, Y1 = 1.4;
const W = X1 - X0, H = Y1 - Y0;
const PAD = 0.05;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set((X0 + X1) / 2, 10, -(Y0 + Y1) / 2);
camera.lookAt(new THREE.Vector3((X0 + X1) / 2, 0, -(Y0 + Y1) / 2));
camera.up.set(0, 0, -1);

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  const aspect = rect.width / canvasH;
  const dataAspect = W / H;
  let halfW, halfH;
  if (aspect >= dataAspect) {
    halfH = (H / 2) + PAD;
    halfW = halfH * aspect;
  } else {
    halfW = (W / 2) + PAD;
    halfH = halfW / aspect;
  }
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

const scene = new THREE.Scene();

// ── Helpers ────────────────────────────────────────────────────────────────

function v3(x, y, lift = 0) { return new THREE.Vector3(x, lift, -y); }

// Flat 2D arrow as Three.js Group. origin/vec in math coords; vec already
// scaled to math-unit length.
function makeArrow2D(origin, vec, colorHex, headLen = 0.10, headWidth = 0.06, lift = 0.005) {
  const g = new THREE.Group();
  const len = Math.hypot(vec.x, vec.y);
  if (len < 1e-9) return g;
  const ux = vec.x / len, uy = vec.y / len;
  const tipX = origin.x + vec.x;
  const tipY = origin.y + vec.y;
  const baseX = tipX - Math.min(headLen, len * 0.9) * ux;
  const baseY = tipY - Math.min(headLen, len * 0.9) * uy;
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    v3(origin.x, origin.y, lift),
    v3(baseX,    baseY,    lift),
  ]);
  g.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: colorHex })));
  // Arrow head triangle
  const px = -uy, py = ux;
  const hw = headWidth * 0.5;
  const t1 = v3(tipX, tipY, lift);
  const t2 = v3(baseX + hw * px, baseY + hw * py, lift);
  const t3 = v3(baseX - hw * px, baseY - hw * py, lift);
  const headGeo = new THREE.BufferGeometry().setFromPoints([t1, t2, t3]);
  headGeo.setIndex([0, 1, 2]);
  g.add(new THREE.Mesh(headGeo, new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide })));
  return g;
}

// ── Decorative vector field grid (faded background) ────────────────────────

{
  const NX = 13, NY = 8;
  const dx = (X1 - X0) / NX;
  const dy = (Y1 - Y0) / NY;
  const fieldGroup = new THREE.Group();
  // First pass: find max magnitude for normalisation.
  let maxMag = 0;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const x = X0 + (i + 0.5) * dx;
      const y = Y0 + (j + 0.5) * dy;
      const F = field(x, y);
      const m = Math.hypot(F.x, F.y);
      if (m > maxMag) maxMag = m;
    }
  }
  const TARGET_LEN = 0.20;  // typical arrow length in math units
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const x = X0 + (i + 0.5) * dx;
      const y = Y0 + (j + 0.5) * dy;
      const F = field(x, y);
      const m = Math.hypot(F.x, F.y);
      if (m < 1e-9) continue;
      const k = (m / maxMag) * TARGET_LEN / m;
      const vec = { x: F.x * k, y: F.y * k };
      const origin = { x: x - vec.x / 2, y: y - vec.y / 2 };
      fieldGroup.add(makeArrow2D(origin, vec, 0xb8c0d4, 0.04, 0.025, 0.001));
    }
  }
  scene.add(fieldGroup);
}

// ── Pre-compute integrand g(t) = F(r(t))·r'(t) and cumulative work ─────────

const PATH_RES = 300;
const RIBBON_HALF = 0.025;

function pathSampleAt(i) {
  const t = T0 + (T1 - T0) * (i / PATH_RES);
  return { t, p: path(t), d: pathD(t) };
}

const integrand = new Float32Array(PATH_RES + 1);
for (let i = 0; i <= PATH_RES; i++) {
  const s = pathSampleAt(i);
  const F = field(s.p.x, s.p.y);
  integrand[i] = F.x * s.d.x + F.y * s.d.y;
}
const cumWork = new Float32Array(PATH_RES + 1);
const dt_path = (T1 - T0) / PATH_RES;
for (let i = 1; i <= PATH_RES; i++) {
  cumWork[i] = cumWork[i - 1] + 0.5 * (integrand[i - 1] + integrand[i]) * dt_path;
}

// Max |integrand| — used to normalise the divergent colormap on the ribbon.
let INTEGRAND_MAX_ABS = 0;
for (let i = 0; i <= PATH_RES; i++) {
  const a = Math.abs(integrand[i]);
  if (a > INTEGRAND_MAX_ABS) INTEGRAND_MAX_ABS = a;
}
if (INTEGRAND_MAX_ABS < 1e-9) INTEGRAND_MAX_ABS = 1;

// Divergent colormap: rose for negative work, pale beige at zero, emerald
// for positive work; intensity grows with |F·τ|. Gamma 0.6 lifts mid values
// so the visible variation is richer than a pure linear ramp.
const COLOR_NEG = { r: 0.937, g: 0.267, b: 0.267 };  // rose
const COLOR_POS = { r: 0.063, g: 0.725, b: 0.506 };  // emerald
const COLOR_MID = { r: 0.94,  g: 0.92,  b: 0.86  };  // pale beige
function signRamp(v) {
  let x = Math.max(-1, Math.min(1, v / INTEGRAND_MAX_ABS));
  const u = Math.pow(Math.abs(x), 0.6);
  const tgt = x >= 0 ? COLOR_POS : COLOR_NEG;
  return {
    r: COLOR_MID.r + (tgt.r - COLOR_MID.r) * u,
    g: COLOR_MID.g + (tgt.g - COLOR_MID.g) * u,
    b: COLOR_MID.b + (tgt.b - COLOR_MID.b) * u,
  };
}

// ── Direction state (toggled by the 反向 button) ───────────────────────────

let reversed = false;

// ── Sign-coloured ribbon (rebuilt on slider change) ────────────────────────

let pathRibbonMesh = null;

function buildRibbon(particleIOrig) {
  if (pathRibbonMesh) {
    scene.remove(pathRibbonMesh);
    pathRibbonMesh.geometry.dispose();
  }
  const positions = new Float32Array((PATH_RES + 1) * 2 * 3);
  const colors    = new Float32Array((PATH_RES + 1) * 2 * 3);
  const indices   = new Uint32Array(PATH_RES * 2 * 3);

  for (let i = 0; i <= PATH_RES; i++) {
    const s = pathSampleAt(i);
    const len = Math.hypot(s.d.x, s.d.y) || 1e-9;
    const nx = -s.d.y / len, ny = s.d.x / len;
    const ax = s.p.x + RIBBON_HALF * nx, ay = s.p.y + RIBBON_HALF * ny;
    const bx = s.p.x - RIBBON_HALF * nx, by = s.p.y - RIBBON_HALF * ny;
    const base = i * 2 * 3;
    positions[base + 0] = ax; positions[base + 1] = 0.002; positions[base + 2] = -ay;
    positions[base + 3] = bx; positions[base + 4] = 0.002; positions[base + 5] = -by;
    const traversed = reversed ? (i >= particleIOrig) : (i <= particleIOrig);
    const signedG = reversed ? -integrand[i] : integrand[i];
    const c = traversed
      ? signRamp(signedG)
      : { r: 0.78, g: 0.78, b: 0.78 };                // grey — untraversed
    colors[base + 0] = c.r; colors[base + 1] = c.g; colors[base + 2] = c.b;
    colors[base + 3] = c.r; colors[base + 4] = c.g; colors[base + 5] = c.b;
  }
  for (let i = 0; i < PATH_RES; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    const base = i * 6;
    indices[base + 0] = a; indices[base + 1] = b; indices[base + 2] = c;
    indices[base + 3] = b; indices[base + 4] = d; indices[base + 5] = c;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  pathRibbonMesh = new THREE.Mesh(geo, mat);
  scene.add(pathRibbonMesh);
}

// Path-direction arrowhead — placed at the far end in the current direction,
// rebuilt whenever direction toggles.
let endArrowMesh = null;

function buildEndArrow() {
  if (endArrowMesh) {
    scene.remove(endArrowMesh);
    endArrowMesh.geometry.dispose();
  }
  const t = reversed ? T0 : T1;
  const tip = path(t);
  const d = pathD(t);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const sign = reversed ? -1 : 1;
  const ux = sign * d.x / len, uy = sign * d.y / len;
  const tail1 = { x: tip.x - 0.10 * ux + 0.06 * (-uy), y: tip.y - 0.10 * uy + 0.06 * ux };
  const tail2 = { x: tip.x - 0.10 * ux - 0.06 * (-uy), y: tip.y - 0.10 * uy - 0.06 * ux };
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    v3(tip.x,   tip.y,   0.004),
    v3(tail1.x, tail1.y, 0.004),
    v3(tail2.x, tail2.y, 0.004),
  ]);
  headGeo.setIndex([0, 1, 2]);
  endArrowMesh = new THREE.Mesh(
    headGeo,
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  scene.add(endArrowMesh);
}

// ── Particle dot + F arrow + τ arrow (rebuilt on slider change) ────────────

let particleDot = null;
let fArrow = null;
let tauArrow = null;

const F_ARROW_SCALE = 0.22;   // visual length per unit |F| (math units)
const TAU_ARROW_LEN = 0.32;   // unit-tangent visual length (math units)

function placeParticle(t) {
  if (particleDot) { scene.remove(particleDot); particleDot.geometry.dispose(); }
  if (fArrow)      { scene.remove(fArrow); }
  if (tauArrow)    { scene.remove(tauArrow); }

  const p = path(t);
  const d = pathD(t);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const tauSign = reversed ? -1 : 1;
  const tau = { x: tauSign * d.x / len, y: tauSign * d.y / len };
  const F = field(p.x, p.y);

  const dotGeo = new THREE.SphereGeometry(0.045, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  particleDot = new THREE.Mesh(dotGeo, dotMat);
  particleDot.position.set(p.x, 0.012, -p.y);
  scene.add(particleDot);

  fArrow = makeArrow2D(p,
    { x: F.x * F_ARROW_SCALE, y: F.y * F_ARROW_SCALE },
    0xdc2626, 0.10, 0.06, 0.014);
  scene.add(fArrow);

  tauArrow = makeArrow2D(p,
    { x: tau.x * TAU_ARROW_LEN, y: tau.y * TAU_ARROW_LEN },
    0x1d4ed8, 0.08, 0.05, 0.016);
  scene.add(tauArrow);
}

// ── HTML overlay ───────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">质点位置 t =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = '1';
slider.step = '0.005';
slider.value = '0.5';
slider.style.cssText = 'width:200px;';
const tReadout = document.createElement('span');
tReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:3.5ch;';
tReadout.textContent = parseFloat(slider.value).toFixed(2);
sliderLabel.appendChild(slider);
sliderLabel.appendChild(tReadout);
overlay.appendChild(sliderLabel);

const reverseBtn = document.createElement('button');
reverseBtn.type = 'button';
reverseBtn.textContent = '反向 ↔';
reverseBtn.style.cssText =
  'padding:4px 12px;border:1px solid #d4d4d8;border-radius:4px;' +
  'background:#fff;cursor:pointer;font:inherit;';
reverseBtn.addEventListener('click', () => {
  reversed = !reversed;
  reverseBtn.style.background = reversed ? '#fef3c7' : '#fff';
  // Keep the particle at the same physical position by mapping s → 1 - s,
  // so the slider value reflects "fraction completed in the new direction".
  slider.value = String(1 - parseFloat(slider.value));
  buildEndArrow();
  updateAll();
});
overlay.appendChild(reverseBtn);

const dotStat = document.createElement('span');
dotStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(dotStat);

const workStat = document.createElement('span');
workStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(workStat);

const trueStat = document.createElement('span');
trueStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
trueStat.textContent = '总功 W = ' + TRUE_WORK.toFixed(3);
overlay.appendChild(trueStat);

function updateAll() {
  const s = parseFloat(slider.value);
  tReadout.textContent = s.toFixed(2);

  // Position along the (possibly reversed) traversal.
  const t = reversed ? (T1 - (T1 - T0) * s) : (T0 + (T1 - T0) * s);
  const iOrig = reversed
    ? PATH_RES - Math.round(s * PATH_RES)
    : Math.round(s * PATH_RES);

  buildRibbon(iOrig);
  placeParticle(t);

  const p = path(t);
  const d = pathD(t);
  const F = field(p.x, p.y);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const tauSign = reversed ? -1 : 1;
  const ftau = tauSign * (F.x * d.x + F.y * d.y) / len;
  const wAcc = reversed ? (cumWork[iOrig] - TRUE_WORK) : cumWork[iOrig];
  const totalNow = reversed ? -TRUE_WORK : TRUE_WORK;

  dotStat.innerHTML =
    'F · τ = <strong style="color:' + (ftau >= 0 ? '#15803d' : '#b91c1c') +
    '">' + ftau.toFixed(3) + '</strong>';
  workStat.innerHTML = '已积累功 W(t) = <strong>' + wAcc.toFixed(3) + '</strong>';
  trueStat.textContent = '总功 W = ' + totalNow.toFixed(3);
}

slider.addEventListener('input', () => updateAll());

// ── Init + render loop ─────────────────────────────────────────────────────

fitCamera();
buildEndArrow();
updateAll();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) {
    fitCamera();
    needsResize = false;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
