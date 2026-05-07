/**
 * chpt13-fourier.js
 * §13.4 Fourier partial sums approximate a periodic target.
 *
 * Targets (period 2π, viewed over [-π, π]):
 *   - 方波  square(x)    → only odd b_n = 4/(nπ); shows Gibbs phenomenon
 *   - 锯齿  sawtooth(x)  → b_n = 2(-1)^(n+1)/n
 *   - 三角  triangle(x)  → only odd a_n = -4/(π n²); a_0/2 = π/2 (after shift)
 *
 * Visual:
 *   - Target plotted in blue across [-π, π] (drawn carefully across jumps).
 *   - Fourier partial sum F_N(x) plotted in red.
 *   - Slider drives N from 1 to 60; buttons select the target.
 *   - At discontinuities, the Gibbs overshoot is visible for square wave.
 *
 * Math (x, y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

// ── Targets and their Fourier coefficients ────────────────────────────────

const targets = [
  {
    name: '方波', f: x => x === 0 ? 0 : (x > 0 ? 1 : -1),
    a0: 0,
    a: n => 0,
    b: n => (n % 2 === 1) ? 4 / (n * Math.PI) : 0,
    yRange: [-1.6, 1.6],
    discontinuities: [-Math.PI, 0, Math.PI],
  },
  {
    name: '锯齿', f: x => x,
    a0: 0,
    a: n => 0,
    b: n => 2 * Math.pow(-1, n + 1) / n,
    yRange: [-Math.PI - 0.6, Math.PI + 0.6],
    discontinuities: [-Math.PI, Math.PI],
  },
  {
    name: '三角', f: x => Math.abs(x),
    a0: Math.PI,
    a: n => (n % 2 === 1) ? -4 / (Math.PI * n * n) : 0,
    b: n => 0,
    yRange: [-0.5, Math.PI + 0.5],
    discontinuities: [],
  },
];

let activeIdx = 0;
let N_terms = 5;

function fourier(x, k) {
  const t = targets[activeIdx];
  let s = t.a0 / 2;
  for (let n = 1; n <= k; n++) {
    s += t.a(n) * Math.cos(n * x) + t.b(n) * Math.sin(n * x);
  }
  return s;
}

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt13-fourier');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -Math.PI, X1 = Math.PI;
let Y0 = -1.6, Y1 = 1.6;
const PAD_X_FRAC = 0.04;
const PAD_Y_FRAC = 0.10;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set(0, 10, 0);
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
  const cx = 0;
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

// ── Helpers ───────────────────────────────────────────────────────────────

function v3(x, y, lift = 0.001) { return new THREE.Vector3(x, lift, -y); }

function makeLine(points, color, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(g, m);
}

// ── Axes ──────────────────────────────────────────────────────────────────

let axisGroup = new THREE.Group();
scene.add(axisGroup);

function rebuildAxes() {
  axisGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);
  axisGroup.add(makeLine([v3(X0, 0, 0.0005), v3(X1, 0, 0.0005)], 0x9ca3af));
  axisGroup.add(makeLine([v3(0, Y0, 0.0005), v3(0, Y1, 0.0005)], 0x9ca3af));
}

// ── Target curve (drawn as separate segments to handle jumps) ─────────────

let targetGroup = new THREE.Group();
scene.add(targetGroup);

function rebuildTarget() {
  targetGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (targetGroup.children.length) targetGroup.remove(targetGroup.children[0]);

  const t = targets[activeIdx];
  // Build segments between discontinuities.
  const breaks = [X0, ...t.discontinuities.filter(d => d > X0 && d < X1), X1];
  for (let s = 0; s < breaks.length - 1; s++) {
    const a = breaks[s], b = breaks[s + 1];
    if (b - a < 1e-6) continue;
    const RES = 200;
    const pts = [];
    for (let i = 0; i <= RES; i++) {
      const x = a + (b - a) * (i / RES);
      // Shift away from endpoints to avoid the discontinuity itself.
      const xs = (i === 0) ? a + 1e-4 : (i === RES ? b - 1e-4 : x);
      const y = t.f(xs);
      if (isFinite(y)) pts.push(v3(xs, y));
    }
    const ln = makeLine(pts, 0x1d4ed8);
    ln.material.linewidth = 2;
    targetGroup.add(ln);
  }
}

// ── Fourier curve (single line, rebuilt on N change) ──────────────────────

let fourierLine = null;

function rebuildFourier() {
  if (fourierLine) { scene.remove(fourierLine); fourierLine.geometry.dispose(); }
  const RES = 800;
  const pts = [];
  for (let i = 0; i <= RES; i++) {
    const x = X0 + (X1 - X0) * (i / RES);
    const y = fourier(x, N_terms);
    pts.push(v3(x, y));
  }
  fourierLine = makeLine(pts, 0xb91c1c);
  fourierLine.material.linewidth = 2;
  scene.add(fourierLine);
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
btnGroup.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;';
overlay.appendChild(btnGroup);

const btns = [];
for (let i = 0; i < targets.length; i++) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = targets[i].name;
  b.style.cssText =
    'padding:3px 10px;border:1px solid #d4d4d8;border-radius:4px;' +
    'background:#fff;cursor:pointer;font:inherit;font-size:0.88em;';
  b.addEventListener('click', () => {
    activeIdx = i;
    btns.forEach((bb, j) => bb.style.background = j === activeIdx ? '#e0f2fe' : '#fff');
    [Y0, Y1] = targets[i].yRange;
    rebuildAxes();
    rebuildTarget();
    rebuildFourier();
    fitCamera();
  });
  btnGroup.appendChild(b);
  btns.push(b);
}

const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">项数 N =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '1';
slider.max = '60';
slider.step = '1';
slider.value = '5';
slider.style.cssText = 'width:180px;';
const NReadout = document.createElement('span');
NReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:3ch;';
NReadout.textContent = slider.value;
sliderLabel.appendChild(slider);
sliderLabel.appendChild(NReadout);
overlay.appendChild(sliderLabel);

const legend = document.createElement('span');
legend.style.cssText = 'color:#4b5563;font-size:0.92em;';
legend.innerHTML =
  '<span style="color:#1d4ed8">■</span> 目标 f(x) &nbsp; ' +
  '<span style="color:#b91c1c">■</span> 傅里叶部分和 F<sub>N</sub>(x)';
overlay.appendChild(legend);

slider.addEventListener('input', () => {
  N_terms = parseInt(slider.value, 10);
  NReadout.textContent = String(N_terms);
  rebuildFourier();
});

// ── Init ──────────────────────────────────────────────────────────────────

btns[0].style.background = '#e0f2fe';
[Y0, Y1] = targets[0].yRange;
rebuildAxes();
rebuildTarget();
rebuildFourier();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) { fitCamera(); needsResize = false; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
