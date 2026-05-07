/**
 * chpt13-partial-sums.js
 * §13.1 visualisation of partial sums of four classic series.
 *
 *   1. Geometric:           a_n = (1/2)^(n-1),   S_n → 2
 *   2. Harmonic:            a_n = 1/n,           S_n → ∞ (diverges)
 *   3. Telescoping:         a_n = 1/(n(n+1)),    S_n → 1
 *   4. Alternating harmonic: a_n = (-1)^(n-1)/n, S_n → ln 2 ≈ 0.693
 *
 * Visual:
 *   - 2D plot of S_n vs n with axes; current series highlighted in colour.
 *   - Dashed horizontal line at the analytic limit (when finite).
 *   - A black dot marks (N, S_N) at the slider position.
 *   - Buttons select the series; slider drives N.
 *
 * Math (n, S_n) → Three.js (n, 0, -S_n).
 */

import * as THREE from 'three';

// ── Series catalogue ──────────────────────────────────────────────────────

const N_MAX = 200;

const series = [
  {
    name: '几何级数  (1/2)^(n-1)',
    color: 0x1d4ed8,                // blue
    limit: 2,
    a: n => Math.pow(0.5, n - 1),
  },
  {
    name: '调和级数  1/n',
    color: 0xb45309,                // amber
    limit: null,                    // diverges
    a: n => 1 / n,
  },
  {
    name: '裂项相消  1/(n(n+1))',
    color: 0x059669,                // emerald
    limit: 1,
    a: n => 1 / (n * (n + 1)),
  },
  {
    name: '交错调和  (-1)^(n-1)/n',
    color: 0xb91c1c,                // rose
    limit: Math.log(2),             // ln 2
    a: n => (n % 2 === 1 ? 1 : -1) / n,
  },
];

// Pre-compute S_n for each series.
for (const s of series) {
  s.S = new Float64Array(N_MAX + 1);
  s.S[0] = 0;
  for (let n = 1; n <= N_MAX; n++) {
    s.S[n] = s.S[n - 1] + s.a(n);
  }
}

let activeIdx = 0;

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt13-partial-sums');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

// Math viewport: x axis = n ∈ [0, N_MAX], y axis = S_n.
// Y range adjusts per series.
let X0 = 0, X1 = N_MAX;
let Y0 = -1, Y1 = 3;
const PAD_X = 5, PAD_Y_FRAC = 0.10;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set(0, 10, 0);
camera.up.set(0, 0, -1);

const scene = new THREE.Scene();

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  const W = (X1 - X0) + 2 * PAD_X;
  const H = (Y1 - Y0) * (1 + 2 * PAD_Y_FRAC);
  const aspect = rect.width / canvasH;
  const dataAspect = W / H;
  let halfW, halfH;
  if (aspect >= dataAspect) {
    halfH = H / 2;
    halfW = halfH * aspect;
  } else {
    halfW = W / 2;
    halfH = halfW / aspect;
  }
  const cx = (X0 + X1) / 2;
  const cy = (Y0 + Y1) / 2;
  camera.position.set(cx, 10, -cy);
  camera.lookAt(new THREE.Vector3(cx, 0, -cy));
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

// ── Helpers ────────────────────────────────────────────────────────────────

function v3(n, S, lift = 0.001) { return new THREE.Vector3(n, lift, -S); }

function makeLine(points, color, lineW = 1, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.LineBasicMaterial({ color, linewidth: lineW, transparent: opacity < 1, opacity });
  return new THREE.Line(g, m);
}

// ── Static axes + tick labels ──────────────────────────────────────────────

let axisGroup = new THREE.Group();
scene.add(axisGroup);

function rebuildAxes() {
  axisGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);

  // Axes (math y = 0 horizontal, math x = X0 vertical).
  const xAxis = makeLine([v3(X0, 0), v3(X1, 0)], 0x222222);
  const yAxis = makeLine([v3(X0, Y0), v3(X0, Y1)], 0x222222);
  axisGroup.add(xAxis);
  axisGroup.add(yAxis);

  // X ticks at n = 1, 50, 100, 150, 200 (or whatever fits).
  const xTicks = [1, 50, 100, 150, 200];
  for (const n of xTicks) {
    if (n < X0 || n > X1) continue;
    axisGroup.add(makeLine([v3(n, Y0 - 0.05 * (Y1 - Y0)), v3(n, Y0 + 0.02 * (Y1 - Y0))], 0x222222));
  }
}

// ── Series polylines (one mesh per series) ────────────────────────────────

const seriesLines = [];
for (let s = 0; s < series.length; s++) {
  const pts = [];
  for (let n = 1; n <= N_MAX; n++) {
    const yClamped = clampY(series[s].S[n]);
    pts.push(v3(n, yClamped));
  }
  const line = makeLine(pts, series[s].color, 2);
  line.visible = false;
  scene.add(line);
  seriesLines.push(line);
}
function clampY(y) {
  // We'll override via dynamic Y range; this stub keeps the geometry stable.
  return y;
}

// ── Limit line (dashed, rebuilt per series change) ─────────────────────────

let limitLine = null;
function rebuildLimitLine() {
  if (limitLine) {
    scene.remove(limitLine);
    limitLine.geometry.dispose();
  }
  const lim = series[activeIdx].limit;
  if (lim === null || !isFinite(lim)) return;
  // Dashed line: build as many short segments
  const segs = [];
  const dashLen = (X1 - X0) / 60;
  let x = X0;
  while (x < X1) {
    const x2 = Math.min(x + dashLen, X1);
    segs.push(v3(x, lim, 0.002));
    segs.push(v3(x2, lim, 0.002));
    x = x2 + dashLen;
  }
  const g = new THREE.BufferGeometry().setFromPoints(segs);
  const m = new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.85 });
  limitLine = new THREE.LineSegments(g, m);
  scene.add(limitLine);
}

// ── Highlight dot at (N, S_N) ──────────────────────────────────────────────

let dotMesh = null;
function placeDot(N) {
  if (dotMesh) { scene.remove(dotMesh); dotMesh.geometry.dispose(); }
  const s = series[activeIdx];
  const SN = s.S[N];
  const radius = 0.012 * (X1 - X0);
  const geo = new THREE.SphereGeometry(radius, 14, 14);
  const mat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  dotMesh = new THREE.Mesh(geo, mat);
  // Place in math (n, S_n).
  dotMesh.position.set(N, 0.005, -SN);
  // Skinny in y (since y is depth here), so radius scaling is only X-direction.
  scene.add(dotMesh);
}

// ── Y-range adjust per series ──────────────────────────────────────────────

function adjustYRange() {
  const s = series[activeIdx];
  let lo = +Infinity, hi = -Infinity;
  for (let n = 1; n <= N_MAX; n++) {
    const v = s.S[n];
    if (!isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (s.limit !== null && isFinite(s.limit)) {
    if (s.limit < lo) lo = s.limit;
    if (s.limit > hi) hi = s.limit;
  }
  // Pad by 10% on top, 5% on bottom (or extend slightly into negatives if needed).
  const span = Math.max(0.5, hi - lo);
  Y0 = lo - 0.10 * span;
  Y1 = hi + 0.10 * span;
  if (Y0 > 0) Y0 = -0.05 * span;   // always show y=0 axis if all values are positive
  rebuildAxes();
  rebuildLimitLine();
  fitCamera();
}

// ── HTML overlay ──────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

// Series buttons
const btnGroup = document.createElement('div');
btnGroup.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
overlay.appendChild(btnGroup);

const btns = [];
for (let i = 0; i < series.length; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = series[i].name;
  b.style.cssText =
    'padding:3px 10px;border:1px solid #d4d4d8;border-radius:4px;' +
    'background:#fff;cursor:pointer;font:inherit;font-size:0.88em;';
  b.addEventListener('click', () => {
    activeIdx = i;
    btns.forEach((bb, j) => bb.style.background = j === activeIdx ? '#e0f2fe' : '#fff');
    seriesLines.forEach((ln, j) => ln.visible = j === activeIdx);
    adjustYRange();
    updateAll();
  });
  btnGroup.appendChild(b);
  btns.push(b);
}

// Slider for N
const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">前 N 项 =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '1';
slider.max = String(N_MAX);
slider.step = '1';
slider.value = '20';
slider.style.cssText = 'width:160px;';
const NReadout = document.createElement('span');
NReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:3.5ch;';
NReadout.textContent = slider.value;
sliderLabel.appendChild(slider);
sliderLabel.appendChild(NReadout);
overlay.appendChild(sliderLabel);

const SStat = document.createElement('span');
SStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(SStat);

const limStat = document.createElement('span');
limStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
overlay.appendChild(limStat);

slider.addEventListener('input', () => updateAll());

function updateAll() {
  const N = parseInt(slider.value, 10);
  NReadout.textContent = String(N);
  placeDot(N);
  const s = series[activeIdx];
  SStat.innerHTML = 'S<sub>N</sub> = <strong>' + s.S[N].toFixed(4) + '</strong>';
  if (s.limit === null || !isFinite(s.limit)) {
    limStat.innerHTML = '极限 = <strong style="color:#b91c1c">+∞ (发散)</strong>';
  } else {
    limStat.innerHTML = '极限 = <strong>' + s.limit.toFixed(4) + '</strong>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

btns[0].style.background = '#e0f2fe';
seriesLines[0].visible = true;
adjustYRange();
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
