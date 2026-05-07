/**
 * chpt12-stokes.js
 * §12.6.2 visual proof of Stokes' theorem:
 *   ∮_∂S F·dr = ∬_S (∇×F)·dS
 *
 * Surface S = upper unit hemisphere (math z ≥ 0).
 * Boundary ∂S = unit circle at z = 0.
 * Field F(x,y,z) = (-y + 1.5x, x, 0)  →  ∇×F = (0, 0, 2).
 * (∇×F)·n on the unit sphere = 2z (≥ 0 on the upper hemisphere).
 * Both ∮ and ∬ evaluate to 2π. Integrand on ∂S is 2π − 3π sin(4π t),
 * so the boundary ribbon has visible sign changes (red & green segments).
 *
 * Visual recipe (3D, rotatable):
 *   - Hemisphere mesh, vertex-coloured by (∇×F)·n (positive ⇒ green).
 *   - Boundary ∂S as a coloured ribbon, traversed by a slider-driven particle.
 *     Ribbon coloured by sign+magnitude of F·τ (rose↔beige↔emerald, §12.3 style);
 *     untraversed portion is grey.
 *   - Sparse curl arrows (constant +z direction) at sample points on the surface.
 *   - 3D field arrow grid (faint blue-grey).
 *   - Particle on ∂S with red F arrow and blue τ arrow.
 *   - Readout: running ∮(t), constant ∬, 反向 button flips both signs.
 *
 * Math (x, y, z) → Three.js (x, z, −y).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -(my ?? 0)); }

// ── Math definitions ───────────────────────────────────────────────────────

function field(x, y, z) {
  return { x: -y + 1.5 * x, y: x, z: 0 };
}
function curl() { return { x: 0, y: 0, z: 2 }; }

// Boundary parameterisation: r(t) = (cos 2πt, sin 2πt, 0), t ∈ [0, 1].
const T0 = 0, T1 = 1;
function path(t) {
  const a = 2 * Math.PI * t;
  return { x: Math.cos(a), y: Math.sin(a), z: 0 };
}
function pathD(t) {
  const a = 2 * Math.PI * t;
  return { x: -2 * Math.PI * Math.sin(a), y: 2 * Math.PI * Math.cos(a), z: 0 };
}

const TRUE_LINE = (() => {
  const M = 4000;
  const dt = (T1 - T0) / M;
  let s = 0;
  for (let i = 0; i <= M; i++) {
    const t = T0 + i * dt;
    const p = path(t);
    const d = pathD(t);
    const F = field(p.x, p.y, p.z);
    const w = (i === 0 || i === M) ? 1 : (i % 2 === 1 ? 4 : 2);
    s += w * (F.x * d.x + F.y * d.y + F.z * d.z);
  }
  return s * dt / 3;     // ≈ 2π
})();

const TRUE_AREA = (() => {
  // ∬_S (∇×F)·n dS  on upper hemisphere, with ∇×F = (0,0,2) and n = (x,y,z).
  // Simpson over (φ, θ) using sin φ as the area element.
  const N_PHI = 200, N_TH = 400;
  let s = 0;
  for (let i = 0; i <= N_PHI; i++) {
    const phi = (i / N_PHI) * (Math.PI / 2);
    const wPhi = (i === 0 || i === N_PHI) ? 1 : (i % 2 === 1 ? 4 : 2);
    let row = 0;
    for (let j = 0; j <= N_TH; j++) {
      const theta = (j / N_TH) * 2 * Math.PI;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      const c = curl();
      const dot = c.x * x + c.y * y + c.z * z;
      const wTh = (j === 0 || j === N_TH) ? 1 : (j % 2 === 1 ? 4 : 2);
      row += wTh * dot * Math.sin(phi);
    }
    s += wPhi * row;
  }
  const dPhi = (Math.PI / 2) / N_PHI;
  const dTh  = (2 * Math.PI) / N_TH;
  return s * dPhi * dTh / 9;     // ≈ 2π
})();

// ── Container, renderer, scene, camera ─────────────────────────────────────

const container = document.getElementById('chpt12-stokes');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xfafafa);

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
camera.position.set(2.7, 2.0, 2.7);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.25, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 10;

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.4);
sun.position.set(2, 5, 3);
scene.add(sun);

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  camera.aspect = rect.width / canvasH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

// ── Helpers ────────────────────────────────────────────────────────────────

const COLOR_NEG = { r: 0.937, g: 0.267, b: 0.267 };
const COLOR_POS = { r: 0.063, g: 0.725, b: 0.506 };
const COLOR_MID = { r: 0.95,  g: 0.93,  b: 0.86  };
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

// ── Coordinate axes ────────────────────────────────────────────────────────

{
  const L = 1.4;
  const ax = [
    { d: V(L, 0, 0),  c: 0xb91c1c },
    { d: V(0, L, 0),  c: 0x16a34a },
    { d: V(0, 0, L),  c: 0x1d4ed8 },
  ];
  for (const a of ax) {
    const g = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), a.d]);
    scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: a.c, transparent: true, opacity: 0.35 })));
  }
}

// ── Hemisphere with vertex colours from (∇×F)·n ────────────────────────────

const N_PHI = 48, N_THETA = 64;
const HEMI_XYZ = [];
const hemiPositions = [];
const hemiIndices = [];
{
  for (let i = 0; i <= N_PHI; i++) {
    const phi = (i / N_PHI) * (Math.PI / 2);
    for (let j = 0; j <= N_THETA; j++) {
      const theta = (j / N_THETA) * 2 * Math.PI;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      HEMI_XYZ.push(x, y, z);
      const v = V(x, y, z);
      hemiPositions.push(v.x, v.y, v.z);
    }
  }
  const stride = N_THETA + 1;
  for (let i = 0; i < N_PHI; i++) {
    for (let j = 0; j < N_THETA; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      hemiIndices.push(a, c, b, b, c, d);
    }
  }
}
const hemiGeo = new THREE.BufferGeometry();
hemiGeo.setAttribute('position', new THREE.Float32BufferAttribute(hemiPositions, 3));
hemiGeo.setAttribute('color',    new THREE.Float32BufferAttribute(new Array(hemiPositions.length).fill(0.5), 3));
hemiGeo.setIndex(hemiIndices);
hemiGeo.computeVertexNormals();
const hemiMat = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.85,
});
scene.add(new THREE.Mesh(hemiGeo, hemiMat));
{
  const hemiColors = hemiGeo.attributes.color.array;
  let maxAbs = 2;     // (∇×F)·n = 2z, max abs on upper hemi is 2
  for (let k = 0; k < HEMI_XYZ.length / 3; k++) {
    const x = HEMI_XYZ[k * 3], y = HEMI_XYZ[k * 3 + 1], z = HEMI_XYZ[k * 3 + 2];
    const c = curl();
    const d = c.x * x + c.y * y + c.z * z;
    const col = divergent(d, maxAbs, 0.55);
    hemiColors[k * 3] = col.r;
    hemiColors[k * 3 + 1] = col.g;
    hemiColors[k * 3 + 2] = col.b;
  }
  hemiGeo.attributes.color.needsUpdate = true;
}
{
  const wireGeo = new THREE.WireframeGeometry(hemiGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.06 });
  scene.add(new THREE.LineSegments(wireGeo, wireMat));
}

// ── Curl arrows on the hemisphere (constant ẑ direction, length ∝ |∇×F|) ───

{
  const cVec = curl();
  const cMag = Math.hypot(cVec.x, cVec.y, cVec.z);
  const dir = V(cVec.x / cMag, cVec.y / cMag, cVec.z / cMag);
  const samples = [
    { phi: 0.001, theta: 0 },
    { phi: Math.PI / 4, theta: 0 },
    { phi: Math.PI / 4, theta: Math.PI / 2 },
    { phi: Math.PI / 4, theta: Math.PI },
    { phi: Math.PI / 4, theta: 3 * Math.PI / 2 },
    { phi: 1.1, theta: Math.PI / 4 },
    { phi: 1.1, theta: 5 * Math.PI / 4 },
  ];
  for (const s of samples) {
    const x = Math.sin(s.phi) * Math.cos(s.theta);
    const y = Math.sin(s.phi) * Math.sin(s.theta);
    const z = Math.cos(s.phi);
    const arrow = new THREE.ArrowHelper(dir, V(x, y, z), 0.30, 0x16a34a, 0.07, 0.045);
    scene.add(arrow);
  }
}

// ── Direction state + per-sample integrand on ∂S ───────────────────────────

let reversed = false;
const PATH_RES = 360;
const RIBBON_HALF = 0.030;

const integrand = new Float32Array(PATH_RES + 1);
for (let i = 0; i <= PATH_RES; i++) {
  const t = T0 + (T1 - T0) * (i / PATH_RES);
  const p = path(t);
  const d = pathD(t);
  const F = field(p.x, p.y, p.z);
  integrand[i] = F.x * d.x + F.y * d.y + F.z * d.z;
}
const cumLine = new Float32Array(PATH_RES + 1);
const dt_path = (T1 - T0) / PATH_RES;
for (let i = 1; i <= PATH_RES; i++) {
  cumLine[i] = cumLine[i - 1] + 0.5 * (integrand[i - 1] + integrand[i]) * dt_path;
}
let INTEG_MAX = 0;
for (let i = 0; i <= PATH_RES; i++) {
  const a = Math.abs(integrand[i]);
  if (a > INTEG_MAX) INTEG_MAX = a;
}
if (INTEG_MAX < 1e-9) INTEG_MAX = 1;

// ── Ribbon for ∂S in 3D (a thick band lying in the z = 0 plane) ────────────

let ribbonMesh = null;

function buildRibbon(particleIOrig) {
  if (ribbonMesh) {
    scene.remove(ribbonMesh);
    ribbonMesh.geometry.dispose();
  }
  const positions = new Float32Array((PATH_RES + 1) * 2 * 3);
  const colors    = new Float32Array((PATH_RES + 1) * 2 * 3);
  const indices   = new Uint32Array(PATH_RES * 2 * 3);

  for (let i = 0; i <= PATH_RES; i++) {
    const t = T0 + (T1 - T0) * (i / PATH_RES);
    const p = path(t);
    const d = pathD(t);
    const len = Math.hypot(d.x, d.y) || 1e-9;
    // Normal in the z = 0 plane, perpendicular to tangent.
    const nx = -d.y / len, ny = d.x / len;
    const a = V(p.x + RIBBON_HALF * nx, p.y + RIBBON_HALF * ny, 0.005);
    const b = V(p.x - RIBBON_HALF * nx, p.y - RIBBON_HALF * ny, 0.005);
    const base = i * 2 * 3;
    positions[base + 0] = a.x; positions[base + 1] = a.y; positions[base + 2] = a.z;
    positions[base + 3] = b.x; positions[base + 4] = b.y; positions[base + 5] = b.z;

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
  ribbonMesh = new THREE.Mesh(geo, mat);
  scene.add(ribbonMesh);
}

// ── Direction arrowhead on the boundary ────────────────────────────────────

let endArrowMesh = null;

function buildEndArrow() {
  if (endArrowMesh) {
    scene.remove(endArrowMesh);
    endArrowMesh.geometry.dispose();
  }
  const t = reversed ? 0.95 : 0.05;
  const p = path(t);
  const d = pathD(t);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const sign = reversed ? -1 : 1;
  const ux = sign * d.x / len, uy = sign * d.y / len;
  const tail1 = { x: p.x - 0.10 * ux + 0.06 * (-uy), y: p.y - 0.10 * uy + 0.06 * ux };
  const tail2 = { x: p.x - 0.10 * ux - 0.06 * (-uy), y: p.y - 0.10 * uy - 0.06 * ux };
  const headGeo = new THREE.BufferGeometry().setFromPoints([
    V(p.x,     p.y,     0.010),
    V(tail1.x, tail1.y, 0.010),
    V(tail2.x, tail2.y, 0.010),
  ]);
  headGeo.setIndex([0, 1, 2]);
  endArrowMesh = new THREE.Mesh(
    headGeo,
    new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
  );
  scene.add(endArrowMesh);
}

// ── Particle dot + F arrow + τ arrow on ∂S ────────────────────────────────

let particleDot = null;
let fArrow = null;
let tauArrow = null;

const F_ARROW_SCALE = 0.18;
const TAU_ARROW_LEN = 0.30;

function placeParticle(t) {
  if (particleDot) { scene.remove(particleDot); particleDot.geometry.dispose(); }
  if (fArrow)      { scene.remove(fArrow); }
  if (tauArrow)    { scene.remove(tauArrow); }

  const p = path(t);
  const d = pathD(t);
  const len = Math.hypot(d.x, d.y) || 1e-9;
  const tauSign = reversed ? -1 : 1;
  const F = field(p.x, p.y, p.z);

  const dotGeo = new THREE.SphereGeometry(0.05, 16, 16);
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  particleDot = new THREE.Mesh(dotGeo, dotMat);
  particleDot.position.copy(V(p.x, p.y, 0.020));
  scene.add(particleDot);

  // F and τ as ArrowHelper.
  const fVec = V(F.x * F_ARROW_SCALE, F.y * F_ARROW_SCALE, 0);
  const fLen = fVec.length();
  if (fLen > 1e-6) {
    fArrow = new THREE.ArrowHelper(fVec.clone().normalize(), V(p.x, p.y, 0.020), fLen, 0xdc2626, 0.10, 0.06);
    scene.add(fArrow);
  }
  const tauVec = V(tauSign * d.x / len * TAU_ARROW_LEN, tauSign * d.y / len * TAU_ARROW_LEN, 0);
  const tLen = tauVec.length();
  if (tLen > 1e-6) {
    tauArrow = new THREE.ArrowHelper(tauVec.clone().normalize(), V(p.x, p.y, 0.020), tLen, 0x1d4ed8, 0.08, 0.05);
    scene.add(tauArrow);
  }
}

// ── 3D field arrow grid (faint, in z = 0 plane mostly) ─────────────────────

{
  const fieldGroup = new THREE.Group();
  const N = 9;
  const len = 0.18;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const x = -1.4 + 2.8 * (i + 0.5) / N;
      const y = -1.4 + 2.8 * (j + 0.5) / N;
      // Only show outside the unit disk so it doesn't clutter the hemisphere.
      if (x * x + y * y < 1.05) continue;
      const F = field(x, y, 0);
      const m = Math.hypot(F.x, F.y, F.z);
      if (m < 0.05) continue;
      const dir = V(F.x, F.y, 0).normalize();
      const arrow = new THREE.ArrowHelper(dir, V(x, y, 0), len, 0x445166, 0.05, 0.035);
      arrow.line.material.transparent = true;
      arrow.line.material.opacity = 0.55;
      arrow.cone.material.transparent = true;
      arrow.cone.material.opacity = 0.55;
      fieldGroup.add(arrow);
    }
  }
  scene.add(fieldGroup);
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
slider.style.cssText = 'width:180px;';
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
  const lineAcc = reversed ? (cumLine[iOrig] - cumLine[PATH_RES]) : cumLine[iOrig];
  const areaNow = reversed ? -TRUE_AREA : TRUE_AREA;
  lineStat.innerHTML = '∮<sub>∂S</sub> F·dr (到 t) = <strong>' + lineAcc.toFixed(3) + '</strong>';
  areaStat.innerHTML = '∬<sub>S</sub> (∇×F)·dS = <strong>' + areaNow.toFixed(3) + '</strong>';
}

slider.addEventListener('input', updateAll);

// ── Init + render loop ─────────────────────────────────────────────────────

fitCamera();
buildEndArrow();
updateAll();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame() {
  if (needsResize) { fitCamera(); needsResize = false; }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
