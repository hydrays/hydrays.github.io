/**
 * chpt12-green.js
 * §12.4.1 visual proof of Green's theorem: ∮_{∂D} F·dr = ∬_D curl F dA.
 *
 * Region D = unit disk centred at origin.
 * Field F(x,y) = (y, -x²) → curl F = ∂Q/∂x - ∂P/∂y = -2x - 1.
 *   curl ranges from -3 (at (1, 0)) through 0 (at x = -1/2) to +1 (at (-1, 0))
 *   over D, so the heatmap shows clear sign change.
 *
 * Visual recipe:
 *   - Curl heatmap fills D (divergent rose↔beige↔emerald, by sign & magnitude)
 *   - Faded vector field arrow grid over and outside D
 *   - The boundary ∂D is traversed by a particle on a slider
 *   - Traversed portion of ∂D is coloured by sign+magnitude of F·τ (§12.3 style)
 *   - Running ∮ appears alongside the constant ∬D curl dA = -π
 *   - 反向 button flips orientation; ∮ flips sign, ∬D unchanged
 *
 * Math (x,y) → Three.js (x, 0, -y), matching chpt11/12 convention.
 */

import * as THREE from 'three';

// ── Field, curl, region ────────────────────────────────────────────────────

function field(x, y) {
  return { x: y, y: -x * x };
}
function curl(x, y) {
  return -2 * x - 1;
}
function inDisk(x, y) {
  return x * x + y * y <= 1;
}

// Boundary of D parameterised CCW: r(t) = (cos 2πt, sin 2πt), t ∈ [0, 1].
const T0 = 0, T1 = 1;
function path(t) {
  const a = 2 * Math.PI * t;
  return { x: Math.cos(a), y: Math.sin(a) };
}
function pathD(t) {
  const a = 2 * Math.PI * t;
  return { x: -2 * Math.PI * Math.sin(a), y: 2 * Math.PI * Math.cos(a) };
}

// True line integral ∮_{∂D} F·dr by Simpson; should equal -π.
const TRUE_LINE = (() => {
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

// True area integral ∬_D curl F dA by midpoint rule on a polar grid.
const TRUE_AREA = (() => {
  const NR = 400, NTH = 800;
  let s = 0;
  for (let i = 0; i < NR; i++) {
    const r = (i + 0.5) / NR;
    for (let j = 0; j < NTH; j++) {
      const th = (j + 0.5) * (2 * Math.PI / NTH);
      const x = r * Math.cos(th), y = r * Math.sin(th);
      s += curl(x, y) * r;          // r·dr·dθ
    }
  }
  return s * (1 / NR) * (2 * Math.PI / NTH);
})();

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt12-green');
container.style.position = 'relative';

// ── Renderer + camera ──────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -1.35, X1 = 1.35, Y0 = -1.35, Y1 = 1.35;
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

// ── Divergent colormap (shared by curl heatmap and ribbon) ─────────────────

const COLOR_NEG = { r: 0.937, g: 0.267, b: 0.267 };  // rose
const COLOR_POS = { r: 0.063, g: 0.725, b: 0.506 };  // emerald
const COLOR_MID = { r: 0.94,  g: 0.92,  b: 0.86  };  // pale beige

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

// ── Curl heatmap inside D ──────────────────────────────────────────────────
// Implemented as a square plate; vertices outside the unit disk get the
// canvas background colour so the disk reads cleanly.

const BG_R = 0.98, BG_G = 0.98, BG_B = 0.98;

let CURL_MAX_ABS = 0;
{
  const N = 60;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const x = -1 + 2 * (i / N);
      const y = -1 + 2 * (j / N);
      if (!inDisk(x, y)) continue;
      const a = Math.abs(curl(x, y));
      if (a > CURL_MAX_ABS) CURL_MAX_ABS = a;
    }
  }
}

{
  const NX = 240, NY = 240;
  const widthM = 2.4, heightM = 2.4;   // covers the disk + a bit
  const geo = new THREE.PlaneGeometry(widthM, heightM, NX, NY);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0);

  const colors = new Float32Array((NX + 1) * (NY + 1) * 3);
  for (let j = 0; j <= NY; j++) {
    const y = -widthM / 2 + (j / NY) * heightM;
    for (let i = 0; i <= NX; i++) {
      const x = -widthM / 2 + (i / NX) * widthM;
      const idx = (j * (NX + 1) + i) * 3;
      if (inDisk(x, y)) {
        const c = divergent(curl(x, y), CURL_MAX_ABS, 0.55);
        // Soften the heatmap a little so the ribbon stands out on top.
        const fade = 0.20;
        colors[idx]     = c.r + (1 - c.r) * fade;
        colors[idx + 1] = c.g + (1 - c.g) * fade;
        colors[idx + 2] = c.b + (1 - c.b) * fade;
      } else {
        colors[idx] = BG_R; colors[idx + 1] = BG_G; colors[idx + 2] = BG_B;
      }
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true })));
}

// ── Faded vector field arrow grid (only inside / near D) ───────────────────

{
  const N = 11;
  const fieldGroup = new THREE.Group();
  let maxMag = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -1.2 + 2.4 * ((i + 0.5) / N);
      const y = -1.2 + 2.4 * ((j + 0.5) / N);
      const F = field(x, y);
      const m = Math.hypot(F.x, F.y);
      if (m > maxMag) maxMag = m;
    }
  }
  const TARGET_LEN = 0.18;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -1.2 + 2.4 * ((i + 0.5) / N);
      const y = -1.2 + 2.4 * ((j + 0.5) / N);
      // Show arrows inside D and a thin ring just outside, skip far away.
      const r = Math.hypot(x, y);
      if (r > 1.18) continue;
      const F = field(x, y);
      const m = Math.hypot(F.x, F.y);
      if (m < 1e-9) continue;
      const k = (m / maxMag) * TARGET_LEN / m;
      const vec = { x: F.x * k, y: F.y * k };
      const origin = { x: x - vec.x / 2, y: y - vec.y / 2 };
      fieldGroup.add(makeArrow2D(origin, vec, 0x445166, 0.04, 0.025, 0.001));
    }
  }
  scene.add(fieldGroup);
}

// ── Direction state ────────────────────────────────────────────────────────

let reversed = false;

// ── Pre-compute integrand & cumulative line integral ───────────────────────

const PATH_RES = 360;
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
const cumLine = new Float32Array(PATH_RES + 1);
const dt_path = (T1 - T0) / PATH_RES;
for (let i = 1; i <= PATH_RES; i++) {
  cumLine[i] = cumLine[i - 1] + 0.5 * (integrand[i - 1] + integrand[i]) * dt_path;
}

let INTEGRAND_MAX_ABS = 0;
for (let i = 0; i <= PATH_RES; i++) {
  const a = Math.abs(integrand[i]);
  if (a > INTEGRAND_MAX_ABS) INTEGRAND_MAX_ABS = a;
}
if (INTEGRAND_MAX_ABS < 1e-9) INTEGRAND_MAX_ABS = 1;

// ── Boundary ribbon ────────────────────────────────────────────────────────

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
    positions[base + 0] = ax; positions[base + 1] = 0.003; positions[base + 2] = -ay;
    positions[base + 3] = bx; positions[base + 4] = 0.003; positions[base + 5] = -by;

    const traversed = reversed ? (i >= particleIOrig) : (i <= particleIOrig);
    const signedG = reversed ? -integrand[i] : integrand[i];
    const c = traversed
      ? divergent(signedG, INTEGRAND_MAX_ABS, 0.6)
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

// ── Direction arrowhead on the boundary ────────────────────────────────────

let endArrowMesh = null;

function buildEndArrow() {
  if (endArrowMesh) {
    scene.remove(endArrowMesh);
    endArrowMesh.geometry.dispose();
  }
  // Place near the start of the loop, pointing along the current direction.
  const t = reversed ? 0.95 : 0.05;
  const tip = path(t);
  const d = pathD(t);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const sign = reversed ? -1 : 1;
  const ux = sign * d.x / len, uy = sign * d.y / len;
  const tail1 = { x: tip.x - 0.10 * ux + 0.06 * (-uy), y: tip.y - 0.10 * uy + 0.06 * ux };
  const tail2 = { x: tip.x - 0.10 * ux - 0.06 * (-uy), y: tip.y - 0.10 * uy - 0.06 * ux };
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    v3(tip.x,   tip.y,   0.005),
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

const F_ARROW_SCALE = 0.22;
const TAU_ARROW_LEN = 0.28;

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
  particleDot.position.set(p.x, 0.014, -p.y);
  scene.add(particleDot);

  fArrow = makeArrow2D(p,
    { x: F.x * F_ARROW_SCALE, y: F.y * F_ARROW_SCALE },
    0xdc2626, 0.10, 0.06, 0.016);
  scene.add(fArrow);

  tauArrow = makeArrow2D(p,
    { x: tau.x * TAU_ARROW_LEN, y: tau.y * TAU_ARROW_LEN },
    0x1d4ed8, 0.08, 0.05, 0.018);
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
sliderLabel.innerHTML = '<span style="white-space:nowrap">边界位置 t =</span>';
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
  slider.value = String(1 - parseFloat(slider.value));
  buildEndArrow();
  updateAll();
});
overlay.appendChild(reverseBtn);

const lineStat = document.createElement('span');
lineStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(lineStat);

const areaStat = document.createElement('span');
areaStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
areaStat.innerHTML = '∬<sub>D</sub> curl F dA = <strong>' + TRUE_AREA.toFixed(3) + '</strong>';
overlay.appendChild(areaStat);

function updateAll() {
  const s = parseFloat(slider.value);
  tReadout.textContent = s.toFixed(2);

  const t = reversed ? (T1 - (T1 - T0) * s) : (T0 + (T1 - T0) * s);
  const iOrig = reversed
    ? PATH_RES - Math.round(s * PATH_RES)
    : Math.round(s * PATH_RES);

  buildRibbon(iOrig);
  placeParticle(t);

  const lineAcc = reversed ? (cumLine[iOrig] - TRUE_LINE) : cumLine[iOrig];
  lineStat.innerHTML = '∮<sub>∂D</sub> F·dr (到 t) = <strong>' + lineAcc.toFixed(3) + '</strong>';
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
