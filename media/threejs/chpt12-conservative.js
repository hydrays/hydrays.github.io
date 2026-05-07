/**
 * chpt12-conservative.js
 * §12.4.2 path independence for a conservative field.
 *
 * Potential f(x, y) = -exp(-(x² + y²)/2)  (Gaussian well centred at origin)
 * Conservative field F = ∇f = (x, y) · exp(-(x² + y²)/2)
 *
 * Endpoints: A = (0, 0) at the well bottom, f(A) = -1
 *            B = (1.5, 1),                f(B) ≈ -0.197
 * So f(B) − f(A) ≈ 0.803 — this is what every path must yield.
 *
 * Visual recipe:
 *   - Background heatmap of f (viridis, faded)
 *   - Faint gradient field arrows
 *   - A, B marked with small dots
 *   - A morphing path A → B, parameterised by a slider α ∈ [-1, 1]:
 *       r(t, α) = (1-t)A + tB + α · 0.85 · sin(π t) · n̂
 *     where n̂ is the unit normal to AB. α = 0 is the straight line;
 *     α = ±1 are wide arcs above/below.
 *   - A second slider t drives the particle along the current path.
 *   - Path ribbon coloured by sign+magnitude of F·τ (continuous, §12.3 style)
 *   - Readout: running ∫ F·dr to t, plus the constant f(B) − f(A); they
 *     coincide at t = 1 regardless of α.
 *
 * Math (x,y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

// ── Potential, field, endpoints ────────────────────────────────────────────

function pot(x, y) { return -Math.exp(-(x * x + y * y) / 2); }
function field(x, y) {
  const k = Math.exp(-(x * x + y * y) / 2);
  return { x: x * k, y: y * k };
}

const A = { x: 0,   y: 0   };
const B = { x: 1.5, y: 1.0 };
const F_A = pot(A.x, A.y);
const F_B = pot(B.x, B.y);
const POT_DIFF = F_B - F_A;       // ≈ 0.803

// Unit normal to AB (rotate AB by +90°).
const ABx = B.x - A.x, ABy = B.y - A.y;
const ABlen = Math.hypot(ABx, ABy);
const Nx = -ABy / ABlen, Ny = ABx / ABlen;
const BUMP = 0.85;

const T0 = 0, T1 = 1;
function path(t, alpha) {
  const s = BUMP * alpha * Math.sin(Math.PI * t);
  return {
    x: (1 - t) * A.x + t * B.x + s * Nx,
    y: (1 - t) * A.y + t * B.y + s * Ny,
  };
}
function pathD(t, alpha) {
  const c = BUMP * alpha * Math.PI * Math.cos(Math.PI * t);
  return {
    x: (B.x - A.x) + c * Nx,
    y: (B.y - A.y) + c * Ny,
  };
}

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt12-conservative');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -0.6, X1 = 2.1, Y0 = -0.9, Y1 = 1.9;
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

  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  if (typeof rebuildHeatmap === "function") {
    rebuildHeatmap(cx - halfW, cx + halfW, cy + halfH, cy - halfH);
  }
}

const scene = new THREE.Scene();

// ── Helpers ────────────────────────────────────────────────────────────────

function v3(x, y, lift = 0) { return new THREE.Vector3(x, lift, -y); }

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

// ── Colormaps ──────────────────────────────────────────────────────────────

// Viridis-inspired ramp for the potential heatmap.
const POT_RAMP = [
  { r: 0.267, g: 0.005, b: 0.329 },
  { r: 0.231, g: 0.318, b: 0.545 },
  { r: 0.129, g: 0.565, b: 0.553 },
  { r: 0.992, g: 0.906, b: 0.144 },
];
function potRamp(t) {
  t = Math.max(0, Math.min(1, t));
  const n = POT_RAMP.length - 1;
  const idx = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - idx;
  const a = POT_RAMP[idx], b = POT_RAMP[idx + 1];
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

// Divergent ramp for the ribbon (signed F·τ).
const COLOR_NEG = { r: 0.937, g: 0.267, b: 0.267 };
const COLOR_POS = { r: 0.063, g: 0.725, b: 0.506 };
const COLOR_MID = { r: 0.94,  g: 0.92,  b: 0.86  };
function divergent(v, vMax, gamma = 0.6) {
  let x = vMax > 1e-9 ? v / vMax : 0;
  x = Math.max(-1, Math.min(1, x));
  const u = Math.pow(Math.abs(x), gamma);
  const tgt = x >= 0 ? COLOR_POS : COLOR_NEG;
  return {
    r: COLOR_MID.r + (tgt.r - COLOR_MID.r) * u,
    g: COLOR_MID.g + (tgt.g - COLOR_MID.g) * u,
    b: COLOR_MID.b + (tgt.b - COLOR_MID.b) * u,
  };
}

// ── Potential heatmap (rebuilt to fit frustum) ─────────────────────────────

const POT_LO = -1, POT_HI = 0;   // f-range over the visible region

let heatmapMesh = null;
let heatmapBounds = null;

function rebuildHeatmap(left, right, top, bottom) {
  if (heatmapBounds &&
      Math.abs(heatmapBounds.left   - left)   < 0.005 &&
      Math.abs(heatmapBounds.right  - right)  < 0.005 &&
      Math.abs(heatmapBounds.top    - top)    < 0.005 &&
      Math.abs(heatmapBounds.bottom - bottom) < 0.005) return;
  if (heatmapMesh) {
    scene.remove(heatmapMesh);
    heatmapMesh.geometry.dispose();
  }
  const NX = 220, NY = 220;
  const widthM  = right - left;
  const heightM = top - bottom;
  const geo = new THREE.PlaneGeometry(widthM, heightM, NX, NY);
  geo.rotateX(-Math.PI / 2);
  geo.translate((left + right) / 2, 0, -(top + bottom) / 2);

  const colors = new Float32Array((NX + 1) * (NY + 1) * 3);
  for (let j = 0; j <= NY; j++) {
    const y = bottom + (j / NY) * heightM;
    for (let i = 0; i <= NX; i++) {
      const x = left + (i / NX) * widthM;
      const f = pot(x, y);
      const tNorm = (f - POT_LO) / Math.max(1e-9, POT_HI - POT_LO);
      const c = potRamp(Math.max(0, Math.min(1, tNorm)));
      const fade = 0.6;
      const idx = (j * (NX + 1) + i) * 3;
      colors[idx]     = c.r + (1 - c.r) * fade;
      colors[idx + 1] = c.g + (1 - c.g) * fade;
      colors[idx + 2] = c.b + (1 - c.b) * fade;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  heatmapMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(heatmapMesh);
  heatmapBounds = { left, right, top, bottom };
}

// ── Faint gradient field arrows ────────────────────────────────────────────

{
  const NX = 13, NY = 11;
  const dx = (X1 - X0) / NX;
  const dy = (Y1 - Y0) / NY;
  const fieldGroup = new THREE.Group();
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
  const TARGET_LEN = 0.18;
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NY; j++) {
      const x = X0 + (i + 0.5) * dx;
      const y = Y0 + (j + 0.5) * dy;
      const F = field(x, y);
      const m = Math.hypot(F.x, F.y);
      if (m < 0.02) continue;
      const k = (m / maxMag) * TARGET_LEN / m;
      const vec = { x: F.x * k, y: F.y * k };
      const origin = { x: x - vec.x / 2, y: y - vec.y / 2 };
      fieldGroup.add(makeArrow2D(origin, vec, 0x3a4458, 0.04, 0.025, 0.001));
    }
  }
  scene.add(fieldGroup);
}

// ── A and B markers (drawn once) ───────────────────────────────────────────

{
  const dotGeo = new THREE.SphereGeometry(0.055, 20, 20);
  const dotMatA = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const dotMatB = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const dotA = new THREE.Mesh(dotGeo, dotMatA);
  dotA.position.set(A.x, 0.020, -A.y);
  scene.add(dotA);
  const dotB = new THREE.Mesh(dotGeo, dotMatB);
  dotB.position.set(B.x, 0.020, -B.y);
  scene.add(dotB);
}

// ── Path samples + integrand + cumulative (rebuilt when α changes) ─────────

const PATH_RES = 360;
const RIBBON_HALF = 0.025;

let alpha = 0;             // path-shape parameter
let reversed = false;

let integrand = new Float32Array(PATH_RES + 1);
let cumLine   = new Float32Array(PATH_RES + 1);
let INTEG_MAX = 1;

function recomputePath() {
  for (let i = 0; i <= PATH_RES; i++) {
    const t = T0 + (T1 - T0) * (i / PATH_RES);
    const r = path(t, alpha);
    const d = pathD(t, alpha);
    const F = field(r.x, r.y);
    integrand[i] = F.x * d.x + F.y * d.y;
  }
  cumLine[0] = 0;
  const dt = (T1 - T0) / PATH_RES;
  for (let i = 1; i <= PATH_RES; i++) {
    cumLine[i] = cumLine[i - 1] + 0.5 * (integrand[i - 1] + integrand[i]) * dt;
  }
  let m = 0;
  for (let i = 0; i <= PATH_RES; i++) {
    const a = Math.abs(integrand[i]);
    if (a > m) m = a;
  }
  INTEG_MAX = m || 1;
}

// ── Path ribbon ────────────────────────────────────────────────────────────

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
    const t = T0 + (T1 - T0) * (i / PATH_RES);
    const r = path(t, alpha);
    const d = pathD(t, alpha);
    const len = Math.hypot(d.x, d.y) || 1e-9;
    const nx = -d.y / len, ny = d.x / len;
    const ax = r.x + RIBBON_HALF * nx, ay = r.y + RIBBON_HALF * ny;
    const bx = r.x - RIBBON_HALF * nx, by = r.y - RIBBON_HALF * ny;
    const base = i * 2 * 3;
    positions[base + 0] = ax; positions[base + 1] = 0.003; positions[base + 2] = -ay;
    positions[base + 3] = bx; positions[base + 4] = 0.003; positions[base + 5] = -by;

    const traversed = reversed ? (i >= particleIOrig) : (i <= particleIOrig);
    const signedG = reversed ? -integrand[i] : integrand[i];
    const c = traversed
      ? divergent(signedG, INTEG_MAX, 0.6)
      : { r: 0.55, g: 0.55, b: 0.55 };
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

// ── Direction arrowhead near the start ─────────────────────────────────────

let endArrowMesh = null;

function buildEndArrow() {
  if (endArrowMesh) {
    scene.remove(endArrowMesh);
    endArrowMesh.geometry.dispose();
  }
  const t = reversed ? 0.92 : 0.08;
  const r = path(t, alpha);
  const d = pathD(t, alpha);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const sign = reversed ? -1 : 1;
  const ux = sign * d.x / len, uy = sign * d.y / len;
  const tail1 = { x: r.x - 0.10 * ux + 0.06 * (-uy), y: r.y - 0.10 * uy + 0.06 * ux };
  const tail2 = { x: r.x - 0.10 * ux - 0.06 * (-uy), y: r.y - 0.10 * uy - 0.06 * ux };
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    v3(r.x,     r.y,     0.005),
    v3(tail1.x, tail1.y, 0.005),
    v3(tail2.x, tail2.y, 0.005),
  ]);
  headGeo.setIndex([0, 1, 2]);
  endArrowMesh = new THREE.Mesh(
    headGeo,
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  scene.add(endArrowMesh);
}

// ── Particle dot + F arrow + τ arrow ───────────────────────────────────────

let particleDot = null;
let fArrow = null;
let tauArrow = null;

const F_ARROW_SCALE = 0.30;
const TAU_ARROW_LEN = 0.30;

function placeParticle(t) {
  if (particleDot) { scene.remove(particleDot); particleDot.geometry.dispose(); }
  if (fArrow)      { scene.remove(fArrow); }
  if (tauArrow)    { scene.remove(tauArrow); }

  const r = path(t, alpha);
  const d = pathD(t, alpha);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const tauSign = reversed ? -1 : 1;
  const tau = { x: tauSign * d.x / len, y: tauSign * d.y / len };
  const F = field(r.x, r.y);

  const dotGeo = new THREE.SphereGeometry(0.04, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0xb91c1c });
  particleDot = new THREE.Mesh(dotGeo, dotMat);
  particleDot.position.set(r.x, 0.014, -r.y);
  scene.add(particleDot);

  fArrow = makeArrow2D(r,
    { x: F.x * F_ARROW_SCALE, y: F.y * F_ARROW_SCALE },
    0xdc2626, 0.10, 0.06, 0.018);
  scene.add(fArrow);

  tauArrow = makeArrow2D(r,
    { x: tau.x * TAU_ARROW_LEN, y: tau.y * TAU_ARROW_LEN },
    0x1d4ed8, 0.08, 0.05, 0.020);
  scene.add(tauArrow);
}

// ── HTML overlay (two sliders + reverse button) ────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

// α slider — path shape
const alphaWrap = document.createElement('label');
alphaWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
alphaWrap.innerHTML = '<span style="white-space:nowrap">路径形状 α =</span>';
const alphaSlider = document.createElement('input');
alphaSlider.type = 'range';
alphaSlider.min = '-1';
alphaSlider.max = '1';
alphaSlider.step = '0.02';
alphaSlider.value = '0';
alphaSlider.style.cssText = 'width:140px;';
const alphaReadout = document.createElement('span');
alphaReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:4ch;';
alphaReadout.textContent = '0.00';
alphaWrap.appendChild(alphaSlider);
alphaWrap.appendChild(alphaReadout);
overlay.appendChild(alphaWrap);

// t slider — particle position
const tWrap = document.createElement('label');
tWrap.style.cssText = 'display:flex;align-items:center;gap:8px;';
tWrap.innerHTML = '<span style="white-space:nowrap">质点位置 t =</span>';
const tSlider = document.createElement('input');
tSlider.type = 'range';
tSlider.min = '0';
tSlider.max = '1';
tSlider.step = '0.005';
tSlider.value = '1';
tSlider.style.cssText = 'width:140px;';
const tReadout = document.createElement('span');
tReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:4ch;';
tReadout.textContent = '1.00';
tWrap.appendChild(tSlider);
tWrap.appendChild(tReadout);
overlay.appendChild(tWrap);

const reverseBtn = document.createElement('button');
reverseBtn.type = 'button';
reverseBtn.textContent = '反向 ↔';
reverseBtn.style.cssText =
  'padding:4px 12px;border:1px solid #d4d4d8;border-radius:4px;' +
  'background:#fff;cursor:pointer;font:inherit;';
reverseBtn.addEventListener('click', () => {
  reversed = !reversed;
  reverseBtn.style.background = reversed ? '#fef3c7' : '#fff';
  tSlider.value = String(1 - parseFloat(tSlider.value));
  buildEndArrow();
  updateAll();
});
overlay.appendChild(reverseBtn);

const lineStat = document.createElement('span');
lineStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(lineStat);

const diffStat = document.createElement('span');
diffStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
diffStat.innerHTML = 'f(B) − f(A) = <strong>' + POT_DIFF.toFixed(3) + '</strong>';
overlay.appendChild(diffStat);

function updateAll() {
  const aRaw = parseFloat(alphaSlider.value);
  const sRaw = parseFloat(tSlider.value);
  alphaReadout.textContent = aRaw.toFixed(2);
  tReadout.textContent     = sRaw.toFixed(2);

  if (alpha !== aRaw) {
    alpha = aRaw;
    recomputePath();
    buildEndArrow();
  }

  const t = reversed ? (T1 - (T1 - T0) * sRaw) : (T0 + (T1 - T0) * sRaw);
  const iOrig = reversed
    ? PATH_RES - Math.round(sRaw * PATH_RES)
    : Math.round(sRaw * PATH_RES);

  buildRibbon(iOrig);
  placeParticle(t);

  const lineAcc = reversed ? (cumLine[iOrig] - cumLine[PATH_RES]) : cumLine[iOrig];
  lineStat.innerHTML = '∫<sub>L</sub> F·dr (到 t) = <strong>' + lineAcc.toFixed(3) + '</strong>';
  // The constant readout f(B)−f(A) is direction-independent: when reversed
  // we display f(A)−f(B) = −POT_DIFF instead.
  const diffNow = reversed ? -POT_DIFF : POT_DIFF;
  diffStat.innerHTML = 'f(终点) − f(起点) = <strong>' + diffNow.toFixed(3) + '</strong>';
}

alphaSlider.addEventListener('input', () => updateAll());
tSlider.addEventListener('input',     () => updateAll());

// ── Init + render loop ─────────────────────────────────────────────────────

recomputePath();
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
