/**
 * chpt11-mass-plate.js
 * §11.1 motivation: mass of a non-uniform plate as a Riemann sum.
 *
 * Top-down orthographic view of D = [0, 2] × [0, 2] with density
 *   ρ(x,y) = 0.3 + 0.8 · exp(-3·((x-1.2)² + (y-0.8)²))
 * — an off-centre Gaussian bump on a low background. Midpoint Riemann
 * sums under-estimate at low N (the peak is missed) and converge upward
 * as N grows.
 *
 * An N×N grid overlay marks the partition; one centre-point dot per cell
 * is the evaluation point. A slider drives N (4 → 64). The HTML readout
 * shows the running Riemann sum and the precomputed reference integral.
 *
 * No 3D — the plate stays flat. Math (x,y) maps to Three.js (x, 0, -y),
 * matching the convention used elsewhere in this chapter's scenes.
 */

import * as THREE from 'three';

const X0 = 0, X1 = 2;
const Y0 = 0, Y1 = 2;

// Off-centre Gaussian bump. Range over D ≈ [0.30, 1.10].
function rho(x, y) {
  const dx = x - 1.2, dy = y - 0.8;
  return 0.3 + 0.8 * Math.exp(-3 * (dx * dx + dy * dy));
}

// Reference value of ∬_D ρ dA, computed once at high resolution.
const TRUE_INTEGRAL = (() => {
  const M = 600;
  const dx = (X1 - X0) / M, dy = (Y1 - Y0) / M;
  let s = 0;
  for (let i = 0; i < M; i++) {
    const x = X0 + (i + 0.5) * dx;
    for (let j = 0; j < M; j++) {
      const y = Y0 + (j + 0.5) * dy;
      s += rho(x, y);
    }
  }
  return s * dx * dy;
})();

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt11-mass-plate');
container.style.position = 'relative';

// ── Renderer + camera ──────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.appendChild(renderer.domElement);

const W = X1 - X0, H = Y1 - Y0;
const PAD = 0.4;

// Orthographic top-down. The visible math rectangle is [X0,X1]×[Y0,Y1]
// in world coords (x → world.x, y → world.-z), camera looks straight down
// from +y. We keep aspect 1 by adjusting the camera frustum on resize.
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set((X0 + X1) / 2, 10, -(Y0 + Y1) / 2);
camera.lookAt(new THREE.Vector3((X0 + X1) / 2, 0, -(Y0 + Y1) / 2));
camera.up.set(0, 0, -1);

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const aspect = rect.width / rect.height;
  const dataAspect = W / H;
  let halfW, halfH;
  if (aspect >= dataAspect) {
    halfH = (H / 2) + PAD;
    halfW = halfH * aspect;
  } else {
    halfW = (W / 2) + PAD;
    halfH = halfW / aspect;
  }
  const cx = (X0 + X1) / 2;
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, rect.height, false);
}

const scene = new THREE.Scene();

// ── Density-coloured plate ─────────────────────────────────────────────────

const PLATE_RES = 200;  // segments per side — smooth gradient
const plateGeo = new THREE.PlaneGeometry(W, H, PLATE_RES, PLATE_RES);
plateGeo.rotateX(-Math.PI / 2);                  // lie on y = 0
plateGeo.translate((X0 + X1) / 2, 0, -(Y0 + Y1) / 2);

const colors = new Float32Array((PLATE_RES + 1) * (PLATE_RES + 1) * 3);
{
  const minR = rho(0, 0), maxR = rho(0, 0);
  let minR_, maxR_ = -Infinity;
  let lo = +Infinity, hi = -Infinity;
  for (let j = 0; j <= PLATE_RES; j++) {
    const y = Y0 + (j / PLATE_RES) * H;
    for (let i = 0; i <= PLATE_RES; i++) {
      const x = X0 + (i / PLATE_RES) * W;
      const r = rho(x, y);
      if (r < lo) lo = r;
      if (r > hi) hi = r;
    }
  }
  // Map ρ ∈ [lo, hi] to a perceptual blue-to-yellow-to-red ramp.
  for (let j = 0; j <= PLATE_RES; j++) {
    const y = Y0 + (j / PLATE_RES) * H;
    for (let i = 0; i <= PLATE_RES; i++) {
      const x = X0 + (i / PLATE_RES) * W;
      const r = rho(x, y);
      const t = (r - lo) / (hi - lo);
      const c = ramp(t);
      const idx = (j * (PLATE_RES + 1) + i) * 3;
      colors[idx]     = c.r;
      colors[idx + 1] = c.g;
      colors[idx + 2] = c.b;
    }
  }
}
plateGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const plateMat = new THREE.MeshBasicMaterial({ vertexColors: true });
const plate = new THREE.Mesh(plateGeo, plateMat);
scene.add(plate);

// Three-stop colormap: low = cool blue, mid = warm yellow, high = red.
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  // stops
  const c0 = { r: 0.18, g: 0.30, b: 0.65 };  // deep blue
  const c1 = { r: 0.97, g: 0.85, b: 0.30 };  // golden yellow
  const c2 = { r: 0.78, g: 0.18, b: 0.18 };  // red
  if (t < 0.5) {
    const u = t / 0.5;
    return mix(c0, c1, u);
  } else {
    const u = (t - 0.5) / 0.5;
    return mix(c1, c2, u);
  }
}
function mix(a, b, t) {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  };
}

// ── Region border ──────────────────────────────────────────────────────────

{
  const pts = [
    new THREE.Vector3(X0, 0.001, -Y0),
    new THREE.Vector3(X1, 0.001, -Y0),
    new THREE.Vector3(X1, 0.001, -Y1),
    new THREE.Vector3(X0, 0.001, -Y1),
    new THREE.Vector3(X0, 0.001, -Y0),
  ];
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({ color: 0x111111 });
  scene.add(new THREE.Line(g, m));
}

// ── Grid + dots (rebuilt when N changes) ───────────────────────────────────

let gridLines = null;
let dotsMesh  = null;

function rebuildPartition(N) {
  if (gridLines) { scene.remove(gridLines); gridLines.geometry.dispose(); }
  if (dotsMesh)  { scene.remove(dotsMesh);  dotsMesh.geometry.dispose(); }

  // Vertical and horizontal lines.
  const linePts = [];
  const dx = W / N, dy = H / N;
  for (let i = 1; i < N; i++) {
    const x = X0 + i * dx;
    linePts.push(new THREE.Vector3(x, 0.002, -Y0));
    linePts.push(new THREE.Vector3(x, 0.002, -Y1));
  }
  for (let j = 1; j < N; j++) {
    const y = Y0 + j * dy;
    linePts.push(new THREE.Vector3(X0, 0.002, -y));
    linePts.push(new THREE.Vector3(X1, 0.002, -y));
  }
  const lg = new THREE.BufferGeometry().setFromPoints(linePts);
  const lm = new THREE.LineBasicMaterial({
    color: 0x111111, transparent: true, opacity: 0.35,
  });
  gridLines = new THREE.LineSegments(lg, lm);
  scene.add(gridLines);

  // Dots at cell centres.
  const radius = 0.012 * Math.min(W, H) * (16 / Math.max(16, N));
  const dotGeo = new THREE.SphereGeometry(radius, 8, 8);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  dotsMesh = new THREE.InstancedMesh(dotGeo, dotMat, N * N);
  const m = new THREE.Matrix4();
  let k = 0;
  for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * dx;
    for (let j = 0; j < N; j++) {
      const y = Y0 + (j + 0.5) * dy;
      m.makeTranslation(x, 0.005, -y);
      dotsMesh.setMatrixAt(k++, m);
    }
  }
  scene.add(dotsMesh);
}

function riemannSum(N) {
  const dx = W / N, dy = H / N, dA = dx * dy;
  let s = 0;
  for (let i = 0; i < N; i++) {
    const x = X0 + (i + 0.5) * dx;
    for (let j = 0; j < N; j++) {
      const y = Y0 + (j + 0.5) * dy;
      s += rho(x, y);
    }
  }
  return s * dA;
}

// ── HTML overlay: slider + readout ─────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const sliderLabel = document.createElement('label');
sliderLabel.style.cssText = 'display:flex;align-items:center;gap:8px;';
sliderLabel.innerHTML = '<span style="white-space:nowrap">分割数 N =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '4';
slider.max = '64';
slider.step = '1';
slider.value = '8';
slider.style.cssText = 'width:160px;';
const nReadout = document.createElement('span');
nReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:2ch;';
nReadout.textContent = slider.value;
sliderLabel.appendChild(slider);
sliderLabel.appendChild(nReadout);
overlay.appendChild(sliderLabel);

const numStat = document.createElement('span');
numStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(numStat);

const trueStat = document.createElement('span');
trueStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
trueStat.textContent = '真实积分 ≈ ' + TRUE_INTEGRAL.toFixed(4);
overlay.appendChild(trueStat);

function updateAll() {
  const N = parseInt(slider.value, 10);
  nReadout.textContent = String(N);
  rebuildPartition(N);
  const sum = riemannSum(N);
  const err = Math.abs(sum - TRUE_INTEGRAL);
  numStat.innerHTML =
    'Riemann 和 ≈ <strong>' + sum.toFixed(4) + '</strong>' +
    ' &nbsp; (误差 ' + err.toFixed(4) + ')';
}

slider.addEventListener('input', () => { updateAll(); });

// ── Initialise + render loop ────────────────────────────────────────────────

fitCamera();
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
