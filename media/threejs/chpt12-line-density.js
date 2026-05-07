/**
 * chpt12-line-density.js
 * §12.2 motivation: mass of a non-uniform thin wire from line density.
 *
 * Visual recipe (parallel to chpt12-work-along-path):
 *   - Background heatmap shows the scalar density field ρ(x, y) over the
 *     viewport (viridis-style ramp).
 *   - The curve L is drawn as a coloured ribbon: where the particle has
 *     already traversed, the ribbon is coloured by ρ at each sample;
 *     ahead of the particle, the ribbon is grey.
 *   - A black dot is the particle. Dragging the slider moves it along L.
 *   - The HTML readout shows current density ρ at the particle, the
 *     accumulated mass M(t) = ∫₀^t ρ(r(s)) |r'(s)| ds, and the precomputed
 *     total mass M.
 *
 * Curve (one full wave):
 *   r(t) = (t, 0.7 sin t),   t ∈ [0, 2π]
 * Density (Gaussian bump centred near the wave's middle):
 *   ρ(x, y) = 0.25 + 0.95 · exp(-0.6 ((x - π)² + (y - 0.4)²))
 *
 * Math (x, y) → Three.js (x, 0, -y), matching chpt11/12 convention.
 */

import * as THREE from 'three';

// ── Density & path ─────────────────────────────────────────────────────────

function rho(x, y) {
  const dx = x - Math.PI, dy = y - 0.4;
  return 0.25 + 0.95 * Math.exp(-0.6 * (dx * dx + dy * dy));
}

const T0 = 0, T1 = 2 * Math.PI;

function path(t) {
  return { x: t, y: 0.7 * Math.sin(t) };
}
function pathD(t) {
  return { x: 1, y: 0.7 * Math.cos(t) };
}

// True mass M = ∫ ρ(r(t)) |r'(t)| dt by Simpson at high res.
const TRUE_MASS = (() => {
  const M = 4000;
  const dt = (T1 - T0) / M;
  let s = 0;
  for (let i = 0; i <= M; i++) {
    const t = T0 + i * dt;
    const p = path(t);
    const d = pathD(t);
    const ds = Math.hypot(d.x, d.y);
    const w = (i === 0 || i === M) ? 1 : (i % 2 === 1 ? 4 : 2);
    s += w * rho(p.x, p.y) * ds;
  }
  return s * dt / 3;
})();

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt12-line-density');
container.style.position = 'relative';

// ── Renderer + camera ──────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const X0 = -0.4, X1 = 2 * Math.PI + 0.4, Y0 = -1.0, Y1 = 1.0;
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

  // Resize the heatmap to fill the actual visible math rectangle.
  const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
  if (typeof rebuildHeatmap === "function") {
    rebuildHeatmap(cx - halfW, cx + halfW, cy + halfH, cy - halfH);
  }
}

const scene = new THREE.Scene();

// ── Colormap (viridis-inspired) ────────────────────────────────────────────

const RAMP_STOPS = [
  { r: 0.267, g: 0.005, b: 0.329 },   // 0.00  deep purple
  { r: 0.231, g: 0.318, b: 0.545 },   // 0.33  blue
  { r: 0.129, g: 0.565, b: 0.553 },   // 0.66  teal
  { r: 0.992, g: 0.906, b: 0.144 },   // 1.00  yellow
];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const n = RAMP_STOPS.length - 1;
  const idx = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - idx;
  const a = RAMP_STOPS[idx], b = RAMP_STOPS[idx + 1];
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

// ── Background density heatmap ─────────────────────────────────────────────
// Built dynamically from inside fitCamera() so it always fills the actual
// camera frustum, regardless of canvas aspect. RHO_LO/RHO_HI are computed
// once over the curve's bounding box (where the bump lives) so the colour
// normalisation stays stable across rebuilds.

let RHO_LO = +Infinity, RHO_HI = -Infinity;
{
  const NX = 200, NY = 80;
  for (let i = 0; i <= NX; i++) {
    const x = X0 + (i / NX) * W;
    for (let j = 0; j <= NY; j++) {
      const y = Y0 + (j / NY) * H;
      const r = rho(x, y);
      if (r < RHO_LO) RHO_LO = r;
      if (r > RHO_HI) RHO_HI = r;
    }
  }
}

let heatmapMesh = null;
let heatmapBounds = null;

function rebuildHeatmap(left, right, top, bottom) {
  // Skip rebuild if bounds haven't changed materially.
  if (heatmapBounds &&
      Math.abs(heatmapBounds.left   - left)   < 0.005 &&
      Math.abs(heatmapBounds.right  - right)  < 0.005 &&
      Math.abs(heatmapBounds.top    - top)    < 0.005 &&
      Math.abs(heatmapBounds.bottom - bottom) < 0.005) {
    return;
  }
  if (heatmapMesh) {
    scene.remove(heatmapMesh);
    heatmapMesh.geometry.dispose();
  }
  const NX = 220, NY = 100;
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
      const r = rho(x, y);
      const tNorm = (r - RHO_LO) / Math.max(1e-9, RHO_HI - RHO_LO);
      const c = ramp(Math.max(0, Math.min(1, tNorm)));
      const fade = 0.55;
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

// ── Pre-compute path samples + cumulative mass ─────────────────────────────

const PATH_RES = 600;
const RIBBON_HALF = 0.028;  // half-width of the ribbon, in math units

function pathSampleAt(i) {
  const t = T0 + (T1 - T0) * (i / PATH_RES);
  return { t, p: path(t), d: pathD(t) };
}

const sampleRho = new Float32Array(PATH_RES + 1);  // ρ at each sample
const sampleDs  = new Float32Array(PATH_RES + 1);  // |r'(t)| at each sample
for (let i = 0; i <= PATH_RES; i++) {
  const s = pathSampleAt(i);
  sampleRho[i] = rho(s.p.x, s.p.y);
  sampleDs[i]  = Math.hypot(s.d.x, s.d.y);
}
const dt_path = (T1 - T0) / PATH_RES;
const cumMass = new Float32Array(PATH_RES + 1);
for (let i = 1; i <= PATH_RES; i++) {
  cumMass[i] = cumMass[i - 1] + 0.5 * (sampleRho[i - 1] * sampleDs[i - 1] +
                                       sampleRho[i]     * sampleDs[i])     * dt_path;
}

// ── Direction state (toggled by the 反向 button) ───────────────────────────

let reversed = false;

// ── Density-coloured ribbon (rebuilt on slider change) ─────────────────────

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
    let c;
    if (!traversed) {
      c = { r: 0.78, g: 0.78, b: 0.78 };  // grey — untraversed
    } else {
      const t = (sampleRho[i] - RHO_LO) / Math.max(1e-9, RHO_HI - RHO_LO);
      c = ramp(t);
    }
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

// Direction arrowhead — placed at the far end in the current direction.
let endArrowMesh = null;

function buildEndArrow() {
  if (endArrowMesh) {
    scene.remove(endArrowMesh);
    endArrowMesh.geometry.dispose();
  }
  const tEnd = reversed ? T0 : T1;
  const p = path(tEnd);
  const d = pathD(tEnd);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const sign = reversed ? -1 : 1;
  const ux = sign * d.x / len, uy = sign * d.y / len;
  const px = -uy, py = ux;
  const tail1 = { x: p.x - 0.13 * ux + 0.07 * px, y: p.y - 0.13 * uy + 0.07 * py };
  const tail2 = { x: p.x - 0.13 * ux - 0.07 * px, y: p.y - 0.13 * uy - 0.07 * py };
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p.x,     0.004, -p.y),
    new THREE.Vector3(tail1.x, 0.004, -tail1.y),
    new THREE.Vector3(tail2.x, 0.004, -tail2.y),
  ]);
  headGeo.setIndex([0, 1, 2]);
  endArrowMesh = new THREE.Mesh(
    headGeo,
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  scene.add(endArrowMesh);
}

// ── Particle dot (rebuilt on slider change) ────────────────────────────────

let particleDot = null;

function placeParticle(s) {
  if (particleDot) { scene.remove(particleDot); particleDot.geometry.dispose(); }
  const t = reversed ? (T1 - (T1 - T0) * s) : (T0 + (T1 - T0) * s);
  const p = path(t);
  const dotGeo = new THREE.SphereGeometry(0.045, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  particleDot = new THREE.Mesh(dotGeo, dotMat);
  particleDot.position.set(p.x, 0.012, -p.y);
  scene.add(particleDot);
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

const rhoStat = document.createElement('span');
rhoStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(rhoStat);

const massStat = document.createElement('span');
massStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(massStat);

const trueStat = document.createElement('span');
trueStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
trueStat.textContent = '总质量 M ≈ ' + TRUE_MASS.toFixed(3);
overlay.appendChild(trueStat);

function updateAll() {
  const s = parseFloat(slider.value);
  tReadout.textContent = s.toFixed(2);
  const iOrig = reversed
    ? PATH_RES - Math.round(s * PATH_RES)
    : Math.round(s * PATH_RES);
  buildRibbon(iOrig);
  placeParticle(s);
  // M(t) — accumulated mass along the (possibly reversed) traversal.
  const massAcc = reversed ? (TRUE_MASS - cumMass[iOrig]) : cumMass[iOrig];
  rhoStat.innerHTML  = '当前密度 ρ = <strong>' + sampleRho[iOrig].toFixed(3) + '</strong>';
  massStat.innerHTML = '已积累质量 M(t) = <strong>' + massAcc.toFixed(3) + '</strong>';
  // Total mass is direction-invariant — same readout regardless of `reversed`.
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
