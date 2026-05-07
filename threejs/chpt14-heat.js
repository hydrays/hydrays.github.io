/**
 * chpt14-heat.js
 * §14.1 1D heat equation as a smoothing process.
 *
 * Domain x ∈ [0, π], boundary u(0, t) = u(π, t) = 0.
 * Initial condition is a sine-mode mixture rich in high frequencies:
 *   u(x, 0) = 0.6 sin x + 0.5 sin 3x − 0.4 sin 7x + 0.3 sin 11x.
 * Closed-form solution by separation of variables:
 *   u(x, t) = Σ b_n sin(n x) e^{-n² t}.
 *
 * Visual:
 *   - Initial profile (light blue, dashed).
 *   - Current profile u(x, t) (solid red), updated by slider.
 *   - Steady state (zero, gray dashed) for reference.
 *   - Slider drives time t ∈ [0, 1.5].
 *
 * Pedagogical message: high-frequency components decay much faster
 * (rate n²), so the rough initial profile rapidly smooths into the
 * lowest mode and finally fades to the zero steady state.
 */

import * as THREE from 'three';

// ── Initial Fourier-sine coefficients ─────────────────────────────────────

const modes = [
  { n: 1,  b:  0.6 },
  { n: 3,  b:  0.5 },
  { n: 7,  b: -0.4 },
  { n: 11, b:  0.3 },
];

function uInit(x) {
  let s = 0;
  for (const m of modes) s += m.b * Math.sin(m.n * x);
  return s;
}
function uAt(x, t) {
  let s = 0;
  for (const m of modes) s += m.b * Math.sin(m.n * x) * Math.exp(-m.n * m.n * t);
  return s;
}

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt14-heat');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = 0, X1 = Math.PI;
const Y0 = -1.4, Y1 = 1.4;
const PAD_X_FRAC = 0.04, PAD_Y_FRAC = 0.10;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.up.set(0, 0, -1);
const scene = new THREE.Scene();

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  const W = (X1 - X0) * (1 + 2 * PAD_X_FRAC);
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
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  camera.position.set(cx, 10, -cy);
  camera.lookAt(new THREE.Vector3(cx, 0, -cy));
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

function v3(x, y, lift = 0.001) { return new THREE.Vector3(x, lift, -y); }
function makeLine(pts, color, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(g, m);
}

// ── Axes ──────────────────────────────────────────────────────────────────

scene.add(makeLine([v3(X0, 0, 0.0005), v3(X1, 0, 0.0005)], 0x9ca3af));
scene.add(makeLine([v3(X0, Y0, 0.0005), v3(X0, Y1, 0.0005)], 0x9ca3af));

// ── Initial profile (dashed light blue, drawn once) ───────────────────────

{
  const RES = 400;
  const segs = [];
  const step = (X1 - X0) / RES;
  for (let i = 0; i < RES; i += 2) {
    const a = X0 + i * step;
    const b = X0 + (i + 1) * step;
    segs.push(v3(a, uInit(a), 0.001));
    segs.push(v3(b, uInit(b), 0.001));
  }
  const g = new THREE.BufferGeometry().setFromPoints(segs);
  const m = new THREE.LineBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.85 });
  scene.add(new THREE.LineSegments(g, m));
}

// ── Steady-state line (zero) ──────────────────────────────────────────────

{
  const segs = [];
  const dash = 0.18;
  for (let x = X0; x < X1; x += 2 * dash) {
    segs.push(v3(x, 0, 0.0008));
    segs.push(v3(Math.min(X1, x + dash), 0, 0.0008));
  }
  const g = new THREE.BufferGeometry().setFromPoints(segs);
  const m = new THREE.LineBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.6 });
  scene.add(new THREE.LineSegments(g, m));
}

// ── Current profile (solid red, rebuilt on slider change) ─────────────────

let currentLine = null;
function rebuildCurrent(t) {
  if (currentLine) { scene.remove(currentLine); currentLine.geometry.dispose(); }
  const RES = 600;
  const pts = [];
  for (let i = 0; i <= RES; i++) {
    const x = X0 + (X1 - X0) * (i / RES);
    pts.push(v3(x, uAt(x, t), 0.002));
  }
  currentLine = makeLine(pts, 0xb91c1c);
  currentLine.material.linewidth = 2;
  scene.add(currentLine);
}

// ── HTML overlay ──────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const lab = document.createElement('label');
lab.style.cssText = 'display:flex;align-items:center;gap:8px;';
lab.innerHTML = '<span style="white-space:nowrap">时间 t =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = '1.5';
slider.step = '0.005';
slider.value = '0';
slider.style.cssText = 'width:220px;';
const tReadout = document.createElement('span');
tReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:4ch;';
tReadout.textContent = '0.000';
lab.appendChild(slider);
lab.appendChild(tReadout);
overlay.appendChild(lab);

const legend = document.createElement('span');
legend.style.cssText = 'color:#4b5563;font-size:0.92em;';
legend.innerHTML =
  '<span style="color:#60a5fa">┄┄</span> 初始分布 u(x, 0) &nbsp; ' +
  '<span style="color:#b91c1c">━</span> 当前 u(x, t) &nbsp; ' +
  '<span style="color:#6b7280">┄┄</span> 稳态 u<sub>∞</sub> = 0';
overlay.appendChild(legend);

slider.addEventListener('input', () => {
  const t = parseFloat(slider.value);
  tReadout.textContent = t.toFixed(3);
  rebuildCurrent(t);
});

// ── Init ──────────────────────────────────────────────────────────────────

rebuildCurrent(0);
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
