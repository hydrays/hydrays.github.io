/**
 * chpt14-disk-harmonic.js
 * §14.2 harmonic extension of a boundary function on the unit disk.
 *
 * Given a boundary function f(θ) on r = 1, the unique bounded harmonic
 * function in the open disk with this boundary trace is
 *   u(r, θ) = a₀/2 + Σ_{n≥1} r^n (a_n cos n θ + b_n sin n θ),
 * where (a_n, b_n) are the Fourier coefficients of f(θ) on [-π, π].
 * The factor r^n damps higher modes as r decreases — that's why u is
 * always smoother in the interior than on the boundary, and equals the
 * boundary average a₀/2 at the centre (mean-value property).
 *
 * Visual:
 *   - Disk filled with a viridis heatmap of u(r, θ) under the chosen f.
 *   - Boundary value displayed as a thin coloured ring at r = 1.
 *   - Buttons select f: 阶跃 (step), 余弦 cos θ, 三角 tent.
 *   - Slider varies the number of Fourier terms N (truncation).
 *
 * Math (x, y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

// ── Boundary functions and their Fourier coefficients on [-π, π] ─────────

const BOUNDARIES = [
  {
    name: '阶跃 (上1下0)',
    f: theta => (theta > 0 && theta < Math.PI) ? 1 : 0,
    a: n => 0,
    b: n => (n % 2 === 1) ? 2 / (n * Math.PI) : 0,
    a0: 1,    // since f averages 1/2 on [-π, π], (1/π) ∫f = 1
  },
  {
    name: '余弦 cos θ',
    f: theta => Math.cos(theta),
    a: n => (n === 1) ? 1 : 0,
    b: n => 0,
    a0: 0,
  },
  {
    name: '三角脉冲',
    // Tent: f(θ) = max(0, 1 - |2θ/π|), a smooth-ish bump centred at 0
    f: theta => {
      const v = 1 - Math.abs(2 * theta / Math.PI);
      return Math.max(0, v);
    },
    a: n => {
      // Computed numerically once at module load.
      return TENT_A[n] || 0;
    },
    b: n => 0,
    a0: 0.5,   // average of tent over [-π, π] = (1/π) · area = (1/π)(π/2) = 1/2
  },
];

// Pre-compute tent coefficients via Simpson over [-π, π].
const N_MAX_FOURIER = 60;
const TENT_A = new Float64Array(N_MAX_FOURIER + 1);
{
  const f = BOUNDARIES[2].f;
  const M = 2000;
  for (let n = 0; n <= N_MAX_FOURIER; n++) {
    const dt = (2 * Math.PI) / M;
    let s = 0;
    for (let i = 0; i <= M; i++) {
      const t = -Math.PI + i * dt;
      const w = (i === 0 || i === M) ? 1 : (i % 2 === 1 ? 4 : 2);
      s += w * f(t) * Math.cos(n * t);
    }
    TENT_A[n] = (n === 0 ? 0 : s * dt / 3 / Math.PI);
  }
}

let activeIdx = 0;
let N_terms  = 12;

function harmonic(r, theta) {
  const B = BOUNDARIES[activeIdx];
  let s = B.a0 / 2;
  let rPow = r;
  for (let n = 1; n <= N_terms; n++) {
    s += rPow * (B.a(n) * Math.cos(n * theta) + B.b(n) * Math.sin(n * theta));
    rPow *= r;
  }
  return s;
}

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt14-disk-harmonic');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -1.25, X1 = 1.25, Y0 = -1.25, Y1 = 1.25;
const W = X1 - X0, H = Y1 - Y0;
const PAD = 0.05;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set(0, 10, 0);
camera.lookAt(new THREE.Vector3(0, 0, 0));
camera.up.set(0, 0, -1);

const scene = new THREE.Scene();

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

// ── Viridis ramp ──────────────────────────────────────────────────────────

const STOPS = [
  { r: 0.267, g: 0.005, b: 0.329 },
  { r: 0.231, g: 0.318, b: 0.545 },
  { r: 0.129, g: 0.565, b: 0.553 },
  { r: 0.992, g: 0.906, b: 0.144 },
];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const n = STOPS.length - 1;
  const idx = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - idx;
  const a = STOPS[idx], b = STOPS[idx + 1];
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

// ── Interior heatmap (rebuilt on every change of f or N) ──────────────────

const NX = 200, NY = 200;
let interiorMesh = null;

function rebuildInterior() {
  if (interiorMesh) { scene.remove(interiorMesh); interiorMesh.geometry.dispose(); }
  // First pass: range.
  let lo = +Infinity, hi = -Infinity;
  for (let j = 0; j <= NY; j++) {
    const y = -1 + 2 * (j / NY);
    for (let i = 0; i <= NX; i++) {
      const x = -1 + 2 * (i / NX);
      if (x*x + y*y > 1) continue;
      const r = Math.sqrt(x*x + y*y);
      const th = Math.atan2(y, x);
      const v = harmonic(r, th);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (hi - lo < 1e-9) hi = lo + 1;

  const geo = new THREE.PlaneGeometry(2, 2, NX, NY);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, 0);

  const colors = new Float32Array((NX + 1) * (NY + 1) * 3);
  for (let j = 0; j <= NY; j++) {
    const y = -1 + 2 * (j / NY);
    for (let i = 0; i <= NX; i++) {
      const x = -1 + 2 * (i / NX);
      const idx = (j * (NX + 1) + i) * 3;
      if (x*x + y*y > 1) {
        colors[idx] = 0.98; colors[idx + 1] = 0.98; colors[idx + 2] = 0.98;
        continue;
      }
      const r = Math.sqrt(x*x + y*y);
      const th = Math.atan2(y, x);
      const v = harmonic(r, th);
      const tNorm = (v - lo) / (hi - lo);
      const c = ramp(tNorm);
      colors[idx]     = c.r;
      colors[idx + 1] = c.g;
      colors[idx + 2] = c.b;
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  interiorMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  scene.add(interiorMesh);
}

// ── Boundary ring (small thick band at r ≈ 1, coloured by boundary value) ──

const RING_RES = 360;
let boundaryRing = null;

function rebuildBoundary() {
  if (boundaryRing) { scene.remove(boundaryRing); boundaryRing.geometry.dispose(); }
  // Determine boundary value range.
  let lo = +Infinity, hi = -Infinity;
  for (let i = 0; i <= RING_RES; i++) {
    const th = -Math.PI + (i / RING_RES) * 2 * Math.PI;
    const v = BOUNDARIES[activeIdx].f(th);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (hi - lo < 1e-9) hi = lo + 1;

  const inner = 1.0;
  const outer = 1.06;
  const positions = new Float32Array((RING_RES + 1) * 2 * 3);
  const colors    = new Float32Array((RING_RES + 1) * 2 * 3);
  const indices   = new Uint32Array(RING_RES * 2 * 3);

  for (let i = 0; i <= RING_RES; i++) {
    const th = -Math.PI + (i / RING_RES) * 2 * Math.PI;
    const cs = Math.cos(th), sn = Math.sin(th);
    const v = BOUNDARIES[activeIdx].f(th);
    const tNorm = (v - lo) / (hi - lo);
    const c = ramp(tNorm);
    const base = i * 2 * 3;
    positions[base + 0] = inner * cs; positions[base + 1] = 0.003; positions[base + 2] = -inner * sn;
    positions[base + 3] = outer * cs; positions[base + 4] = 0.003; positions[base + 5] = -outer * sn;
    colors[base + 0] = c.r; colors[base + 1] = c.g; colors[base + 2] = c.b;
    colors[base + 3] = c.r; colors[base + 4] = c.g; colors[base + 5] = c.b;
  }
  for (let i = 0; i < RING_RES; i++) {
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
  boundaryRing = new THREE.Mesh(geo, mat);
  scene.add(boundaryRing);
}

// Disk outline (black circle).
{
  const pts = [];
  for (let i = 0; i <= 240; i++) {
    const t = (i / 240) * 2 * Math.PI;
    pts.push(new THREE.Vector3(Math.cos(t), 0.005, -Math.sin(t)));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  ));
}

// ── HTML overlay ──────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const btnGroup = document.createElement('div');
btnGroup.style.cssText = 'display:flex;gap:4px;';
overlay.appendChild(btnGroup);

const btns = [];
for (let i = 0; i < BOUNDARIES.length; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = BOUNDARIES[i].name;
  b.style.cssText =
    'padding:3px 10px;border:1px solid #d4d4d8;border-radius:4px;' +
    'background:#fff;cursor:pointer;font:inherit;font-size:0.88em;';
  b.addEventListener('click', () => {
    activeIdx = i;
    btns.forEach((bb, j) => bb.style.background = j === activeIdx ? '#e0f2fe' : '#fff');
    rebuildInterior();
    rebuildBoundary();
    updateCenter();
  });
  btnGroup.appendChild(b);
  btns.push(b);
}

const lab = document.createElement('label');
lab.style.cssText = 'display:flex;align-items:center;gap:8px;';
lab.innerHTML = '<span style="white-space:nowrap">傅里叶项数 N =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '1';
slider.max = String(N_MAX_FOURIER);
slider.step = '1';
slider.value = String(N_terms);
slider.style.cssText = 'width:160px;';
const NReadout = document.createElement('span');
NReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:3ch;';
NReadout.textContent = String(N_terms);
lab.appendChild(slider);
lab.appendChild(NReadout);
overlay.appendChild(lab);

const centerStat = document.createElement('span');
centerStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
overlay.appendChild(centerStat);

slider.addEventListener('input', () => {
  N_terms = parseInt(slider.value, 10);
  NReadout.textContent = String(N_terms);
  rebuildInterior();
  updateCenter();
});

function updateCenter() {
  const v = harmonic(0, 0);
  centerStat.innerHTML = 'u(0,0) = <strong>' + v.toFixed(3) + '</strong> &nbsp; (= 边界平均值 a<sub>0</sub>/2)';
}

// ── Init ──────────────────────────────────────────────────────────────────

btns[0].style.background = '#e0f2fe';
rebuildInterior();
rebuildBoundary();
updateCenter();
fitCamera();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) { fitCamera(); needsResize = false; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
