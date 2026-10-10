/**
 * chpt13-power-basis.js
 * §13.3 幂级数 — the monomials 1, x, x², … as the building blocks ("basis")
 * of a power series  Σ aₙ xⁿ.
 *
 * Plots y = xᵏ for k = 0…N (N driven by a slider) over a symmetric,
 * zoomable x-window. Colour runs from low degree (warm/red) to high
 * degree (cool/blue). The mouse-wheel zooms the x-axis about the origin;
 * a button resets it.
 *
 * Pedagogy: every term flattens near 0 and bends ever more sharply toward
 * |x| = 1 as the degree grows; |x| = 1 is the pivot that later becomes the
 * radius of convergence. A power series picks coefficients aₖ and stacks
 * these curves.
 *
 * Math (x, y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

const MAX_DEG = 10;
let N_deg = 6;

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt13-power-basis');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X_DEFAULT = [-1.4, 1.4];
const Y0 = -1.5, Y1 = 1.5;
let X0 = X_DEFAULT[0], X1 = X_DEFAULT[1];
const PAD_X_FRAC = 0.04;
const PAD_Y_FRAC = 0.10;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set(0, 10, 0);
camera.up.set(0, 0, -1);

const scene = new THREE.Scene();

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = overlay ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  const W = (X1 - X0) * (1 + 2 * PAD_X_FRAC);
  const H = (Y1 - Y0) * (1 + 2 * PAD_Y_FRAC);
  const aspect = rect.width / canvasH;
  const dataAspect = W / H;
  let halfW, halfH;
  if (aspect >= dataAspect) { halfH = H / 2; halfW = halfH * aspect; }
  else { halfW = W / 2; halfH = halfW / aspect; }
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  camera.position.set(cx, 10, -cy);
  camera.lookAt(new THREE.Vector3(cx, 0, -cy));
  camera.left = -halfW; camera.right = halfW;
  camera.top = halfH; camera.bottom = -halfH;
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

function clampY(y) {
  const margin = 0.5 * (Y1 - Y0);
  if (y > Y1 + margin) return Y1 + margin;
  if (y < Y0 - margin) return Y0 - margin;
  return y;
}

// Hue from warm (low degree) to cool (high degree).
function degColor(k) {
  const t = MAX_DEG === 0 ? 0 : k / MAX_DEG;
  const c = new THREE.Color();
  c.setHSL(0.02 + 0.62 * t, 0.72, 0.45);   // red → blue
  return c.getHex();
}

// ── Axes ────────────────────────────────────────────────────────────────────

const axisGroup = new THREE.Group();
scene.add(axisGroup);

function rebuildAxes() {
  axisGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);
  axisGroup.add(makeLine([v3(X0, 0, 0.0005), v3(X1, 0, 0.0005)], 0x9ca3af));
  axisGroup.add(makeLine([v3(0, Y0, 0.0005), v3(0, Y1, 0.0005)], 0x9ca3af));
  // unit markers x = ±1 (the eventual radius of convergence)
  for (const xm of [-1, 1]) {
    axisGroup.add(makeLine(
      [v3(xm, Y0, 0.0004), v3(xm, Y1, 0.0004)], 0xd1d5db, 0.9));
  }
}

// ── Curves (rebuilt on N change / zoom) ──────────────────────────────────────

let curveGroup = new THREE.Group();
scene.add(curveGroup);

function rebuildCurves() {
  curveGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  while (curveGroup.children.length) curveGroup.remove(curveGroup.children[0]);
  const RES = 600;
  for (let k = 0; k <= N_deg; k++) {
    const pts = [];
    for (let i = 0; i <= RES; i++) {
      const x = X0 + (X1 - X0) * (i / RES);
      const y = clampY(Math.pow(x, k));
      pts.push(v3(x, y, 0.001 + 0.0002 * k));
    }
    curveGroup.add(makeLine(pts, degColor(k)));
  }
}

// ── HTML overlay (legend + slider + reset) ───────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">最高次数 N =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0'; slider.max = String(MAX_DEG); slider.step = '1';
slider.value = String(N_deg);
slider.style.cssText = 'width:150px;';
const NReadout = document.createElement('span');
NReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:2ch;';
NReadout.textContent = slider.value;
sliderLabel.appendChild(slider);
sliderLabel.appendChild(NReadout);
overlay.appendChild(sliderLabel);

const legend = document.createElement('span');
legend.style.cssText = 'color:#4b5563;font-size:0.9em;display:flex;gap:8px;flex-wrap:wrap;';
overlay.appendChild(legend);

const resetBtn = document.createElement('button');
resetBtn.type = 'button';
resetBtn.textContent = '重置缩放';
resetBtn.style.cssText =
  'padding:3px 10px;border:1px solid #d4d4d8;border-radius:4px;' +
  'background:#fff;cursor:pointer;font:inherit;font-size:0.85em;margin-left:auto;';
overlay.appendChild(resetBtn);

const hint = document.createElement('span');
hint.style.cssText = 'color:#9ca3af;font-size:0.8em;';
hint.textContent = '滚轮缩放 x 轴';
overlay.appendChild(hint);

function termLabel(k) {
  if (k === 0) return '1';
  if (k === 1) return 'x';
  return 'x<sup>' + k + '</sup>';
}

function rebuildLegend() {
  legend.innerHTML = '';
  for (let k = 0; k <= N_deg; k++) {
    const span = document.createElement('span');
    span.style.whiteSpace = 'nowrap';
    const hex = '#' + degColor(k).toString(16).padStart(6, '0');
    span.innerHTML = '<span style="color:' + hex + '">■</span> ' + termLabel(k);
    legend.appendChild(span);
  }
}

slider.addEventListener('input', () => {
  N_deg = parseInt(slider.value, 10);
  NReadout.textContent = String(N_deg);
  rebuildCurves();
  rebuildLegend();
});

resetBtn.addEventListener('click', () => {
  [X0, X1] = X_DEFAULT;
  rebuildAxes(); rebuildCurves(); fitCamera();
});

// ── Wheel zoom on x (symmetric about origin) ─────────────────────────────────

container.addEventListener('wheel', (e) => {
  e.preventDefault();
  const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
  const c = (X0 + X1) / 2;
  let half = (X1 - X0) / 2 * factor;
  half = Math.max(0.25, Math.min(40, half));
  X0 = c - half; X1 = c + half;
  rebuildAxes(); rebuildCurves(); fitCamera();
}, { passive: false });

// ── Init ──────────────────────────────────────────────────────────────────

rebuildAxes();
rebuildCurves();
rebuildLegend();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) { fitCamera(); needsResize = false; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
