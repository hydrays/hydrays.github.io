/**
 * chpt13-taylor.js
 * §13.3 Taylor / Maclaurin partial-sum approximation.
 *
 * Toggle between target functions and watch a partial Taylor sum
 *   T_N(x) = Σ_{k=0..N} (f^(k)(0) / k!) x^k
 * approach f(x) over a wider interval as N grows.
 *
 * Targets (with their analytic Maclaurin coefficients):
 *   - sin x
 *   - cos x
 *   - exp x
 *   - ln(1 + x)         (only valid for -1 < x ≤ 1)
 *   - 1/(1 - x)         (only valid for |x| < 1)
 *
 * Visual:
 *   - The target plotted in blue across the visible x range.
 *   - The Taylor partial sum plotted in red, clamped vertically.
 *   - Slider drives N from 1 to 30; buttons select the target.
 *   - The interval where |T_N - f| < some threshold is highlighted along x.
 *
 * Math (x, y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

// ── Targets ───────────────────────────────────────────────────────────────

const targets = [
  {
    name: 'sin x', f: x => Math.sin(x),
    coef: k => {
      // sin: series x - x³/3! + x⁵/5! - ...
      if (k % 2 === 0) return 0;
      const sign = ((k - 1) / 2) % 2 === 0 ? 1 : -1;
      return sign / fact(k);
    },
    xRange: [-3 * Math.PI, 3 * Math.PI],
    yRange: [-2, 2],
  },
  {
    name: 'cos x', f: x => Math.cos(x),
    coef: k => {
      if (k % 2 === 1) return 0;
      const sign = (k / 2) % 2 === 0 ? 1 : -1;
      return sign / fact(k);
    },
    xRange: [-3 * Math.PI, 3 * Math.PI],
    yRange: [-2, 2],
  },
  {
    name: 'exp x', f: x => Math.exp(x),
    coef: k => 1 / fact(k),
    xRange: [-3, 3],
    yRange: [-2, 12],
  },
  {
    name: 'ln(1+x)', f: x => Math.log(1 + x),
    coef: k => k === 0 ? 0 : (k % 2 === 1 ? 1 : -1) / k,
    xRange: [-1.5, 2.5],
    yRange: [-3, 1.5],
  },
  {
    name: '1/(1-x)', f: x => 1 / (1 - x),
    coef: k => 1,
    xRange: [-1.8, 1.8],
    yRange: [-4, 8],
  },
];

let activeIdx = 0;
let N_terms = 5;

function fact(k) {
  let r = 1;
  for (let i = 2; i <= k; i++) r *= i;
  return r;
}

function taylor(x, k) {
  const t = targets[activeIdx];
  let s = 0, xp = 1;
  for (let i = 0; i <= k; i++) {
    s += t.coef(i) * xp;
    xp *= x;
  }
  return s;
}

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt13-taylor');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

let X0 = 0, X1 = 1, Y0 = -1, Y1 = 1;
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

// ── Curve lines (rebuilt on series / N change) ────────────────────────────

let targetLine = null;
let taylorLine = null;

function rebuildCurves() {
  if (targetLine) { scene.remove(targetLine); targetLine.geometry.dispose(); }
  if (taylorLine) { scene.remove(taylorLine); taylorLine.geometry.dispose(); }
  const t = targets[activeIdx];
  const RES = 600;

  const targetPts = [];
  const taylorPts = [];
  let yPrevTaylor = NaN;
  for (let i = 0; i <= RES; i++) {
    const x = X0 + (X1 - X0) * (i / RES);
    let yT = t.f(x);
    if (!isFinite(yT)) yT = NaN;
    yT = clampY(yT);
    if (!isNaN(yT)) targetPts.push(v3(x, yT));

    let yA = taylor(x, N_terms);
    if (!isFinite(yA)) yA = NaN;
    yA = clampY(yA);
    if (!isNaN(yA)) taylorPts.push(v3(x, yA));
  }

  targetLine = makeLine(targetPts, 0x1d4ed8);                     // blue
  taylorLine = makeLine(taylorPts, 0xb91c1c);                     // rose
  // Make Taylor stand out a touch.
  targetLine.material.linewidth = 2;
  taylorLine.material.linewidth = 2;
  scene.add(targetLine);
  scene.add(taylorLine);
}

function clampY(y) {
  // Avoid the line going to infinity for divergent partial sums by clamping
  // a bit beyond Y range; render will still look sensible.
  const margin = 0.5 * (Y1 - Y0);
  if (y > Y1 + margin) return Y1 + margin;
  if (y < Y0 - margin) return Y0 - margin;
  return y;
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
    [X0, X1] = targets[i].xRange;
    [Y0, Y1] = targets[i].yRange;
    rebuildAxes();
    rebuildCurves();
    fitCamera();
  });
  btnGroup.appendChild(b);
  btns.push(b);
}

const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">阶数 N =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = '30';
slider.step = '1';
slider.value = '5';
slider.style.cssText = 'width:160px;';
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
  '<span style="color:#b91c1c">■</span> 泰勒近似 T<sub>N</sub>(x)';
overlay.appendChild(legend);

slider.addEventListener('input', () => {
  N_terms = parseInt(slider.value, 10);
  NReadout.textContent = String(N_terms);
  rebuildCurves();
});

// ── Init ──────────────────────────────────────────────────────────────────

btns[0].style.background = '#e0f2fe';
[X0, X1] = targets[0].xRange;
[Y0, Y1] = targets[0].yRange;
rebuildAxes();
rebuildCurves();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) { fitCamera(); needsResize = false; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
