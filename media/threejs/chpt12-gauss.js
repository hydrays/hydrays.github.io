/**
 * chpt12-gauss.js
 * §12.6.1 visual proof of the divergence (Gauss) theorem:
 *   ∯_∂V F·dS = ∭_V ∇·F dV
 *
 * Volume V = unit cube [-1, 1]³.
 * Field F(x, y, z) = (x², y, z²)  →  ∇·F = 2x + 1 + 2z.
 * Both sides evaluate to 8 (only the constant "1" contributes; 2x and 2z
 * integrate to zero by symmetry).
 *
 * Visual recipe (3D, rotatable):
 *   - Cube wireframe + 6 semi-transparent face panels, vertex-coloured by F·n.
 *   - A slice plane at y = 0, fully opaque, coloured by ∇·F (rose↔beige↔emerald).
 *   - Sparse outward-normal arrows at face centres.
 *   - 3D field arrow grid (faint blue-grey).
 *   - Slider scales the field by κ ∈ [0.5, 2]; both ∯ and ∭ scale together.
 *
 * Math (x, y, z) → Three.js (x, z, −y).
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -(my ?? 0)); }

let kappa = 1.0;
function field(x, y, z) {
  return { x: kappa * x * x, y: kappa * y, z: kappa * z * z };
}
function divField(x, y, z) {
  return kappa * (2 * x + 1 + 2 * z);
}
const trueFlux = () => kappa * 8;

// ── Container, renderer, scene, camera ─────────────────────────────────────

const container = document.getElementById('chpt12-gauss');
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
camera.position.set(3.4, 2.7, 3.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.5;
controls.maxDistance = 12;

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(3, 6, 4);
scene.add(sun);

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  camera.aspect = rect.width / canvasH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

// ── Divergent ramp ─────────────────────────────────────────────────────────

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
  const L = 1.5;
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

// ── Cube wireframe ─────────────────────────────────────────────────────────

{
  const corners = [];
  for (let dx of [-1, 1]) for (let dy of [-1, 1]) for (let dz of [-1, 1]) {
    corners.push({ x: dx, y: dy, z: dz });
  }
  const segs = [];
  for (let i = 0; i < corners.length; i++) {
    for (let j = i + 1; j < corners.length; j++) {
      const a = corners[i], b = corners[j];
      const d = (a.x !== b.x ? 1 : 0) + (a.y !== b.y ? 1 : 0) + (a.z !== b.z ? 1 : 0);
      if (d !== 1) continue;
      segs.push(V(a.x, a.y, a.z), V(b.x, b.y, b.z));
    }
  }
  const g = new THREE.BufferGeometry().setFromPoints(segs);
  scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.6 })));
}

// ── Six face panels with vertex colours ─────────────────────────────────────
// Each face is a plane; we sample F·n at its 4 corners (or finer grid) and
// store as vertex colours so the panel shades smoothly.

const FACE_RES = 24;     // subdivision per side

// Faces specified as (axis, sign): axis ∈ {0,1,2} for x,y,z; sign ∈ {-1, +1}.
const FACE_DEFS = [
  { axis: 0, sign:  1 }, { axis: 0, sign: -1 },
  { axis: 1, sign:  1 }, { axis: 1, sign: -1 },
  { axis: 2, sign:  1 }, { axis: 2, sign: -1 },
];
const faceMeshes = [];

function buildOrUpdateFaces() {
  // Find global max |F·n| across all face vertices (for divergent ramp).
  let maxAbs = 0;
  for (const f of FACE_DEFS) {
    for (let i = 0; i <= FACE_RES; i++) {
      for (let j = 0; j <= FACE_RES; j++) {
        const u = -1 + 2 * (i / FACE_RES);
        const v = -1 + 2 * (j / FACE_RES);
        let x, y, z;
        if (f.axis === 0) { x = f.sign; y = u; z = v; }
        if (f.axis === 1) { x = u; y = f.sign; z = v; }
        if (f.axis === 2) { x = u; y = v; z = f.sign; }
        const F = field(x, y, z);
        const n = [0, 0, 0]; n[f.axis] = f.sign;
        const fdotn = F.x * n[0] + F.y * n[1] + F.z * n[2];
        if (Math.abs(fdotn) > maxAbs) maxAbs = Math.abs(fdotn);
      }
    }
  }
  if (maxAbs < 1e-9) maxAbs = 1;

  for (let f = 0; f < FACE_DEFS.length; f++) {
    const def = FACE_DEFS[f];
    let mesh = faceMeshes[f];
    if (!mesh) {
      // Build geometry once.
      const positions = [];
      const indices = [];
      for (let i = 0; i <= FACE_RES; i++) {
        for (let j = 0; j <= FACE_RES; j++) {
          const u = -1 + 2 * (i / FACE_RES);
          const v = -1 + 2 * (j / FACE_RES);
          let x, y, z;
          if (def.axis === 0) { x = def.sign; y = u; z = v; }
          if (def.axis === 1) { x = u; y = def.sign; z = v; }
          if (def.axis === 2) { x = u; y = v; z = def.sign; }
          const p = V(x, y, z);
          positions.push(p.x, p.y, p.z);
        }
      }
      const stride = FACE_RES + 1;
      for (let i = 0; i < FACE_RES; i++) {
        for (let j = 0; j < FACE_RES; j++) {
          const a = i * stride + j;
          const b = a + 1;
          const c = a + stride;
          const d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.Float32BufferAttribute(new Array(positions.length).fill(0.5), 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
      });
      mesh = new THREE.Mesh(geo, mat);
      scene.add(mesh);
      faceMeshes[f] = mesh;
    }
    // Update colors based on current field.
    const colors = mesh.geometry.attributes.color.array;
    let k = 0;
    for (let i = 0; i <= FACE_RES; i++) {
      for (let j = 0; j <= FACE_RES; j++) {
        const u = -1 + 2 * (i / FACE_RES);
        const v = -1 + 2 * (j / FACE_RES);
        let x, y, z;
        if (def.axis === 0) { x = def.sign; y = u; z = v; }
        if (def.axis === 1) { x = u; y = def.sign; z = v; }
        if (def.axis === 2) { x = u; y = v; z = def.sign; }
        const F = field(x, y, z);
        const n = [0, 0, 0]; n[def.axis] = def.sign;
        const fdotn = F.x * n[0] + F.y * n[1] + F.z * n[2];
        const c = divergent(fdotn, maxAbs, 0.6);
        colors[k++] = c.r; colors[k++] = c.g; colors[k++] = c.b;
      }
    }
    mesh.geometry.attributes.color.needsUpdate = true;
  }
}

// ── Outward normal arrows at face centres ───────────────────────────────────

{
  for (const def of FACE_DEFS) {
    const c = [0, 0, 0]; c[def.axis] = def.sign;
    const n = [0, 0, 0]; n[def.axis] = def.sign;
    const dir = V(n[0], n[1], n[2]).normalize();
    const arrow = new THREE.ArrowHelper(dir, V(c[0], c[1], c[2]), 0.30, 0x111111, 0.08, 0.05);
    scene.add(arrow);
  }
}

// ── Slice plane (y = 0) coloured by div F ──────────────────────────────────

const SLICE_RES = 50;
let sliceMesh = null;

function buildOrUpdateSlice() {
  let maxAbs = 0;
  for (let i = 0; i <= SLICE_RES; i++) {
    for (let j = 0; j <= SLICE_RES; j++) {
      const x = -1 + 2 * (i / SLICE_RES);
      const z = -1 + 2 * (j / SLICE_RES);
      const d = divField(x, 0, z);
      if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d);
    }
  }
  if (maxAbs < 1e-9) maxAbs = 1;

  if (!sliceMesh) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= SLICE_RES; i++) {
      for (let j = 0; j <= SLICE_RES; j++) {
        const x = -1 + 2 * (i / SLICE_RES);
        const z = -1 + 2 * (j / SLICE_RES);
        const p = V(x, 0, z);
        positions.push(p.x, p.y, p.z);
      }
    }
    const stride = SLICE_RES + 1;
    for (let i = 0; i < SLICE_RES; i++) {
      for (let j = 0; j < SLICE_RES; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = a + stride;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(new Array(positions.length).fill(0.5), 3));
    geo.setIndex(indices);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    sliceMesh = new THREE.Mesh(geo, mat);
    scene.add(sliceMesh);
  }
  const colors = sliceMesh.geometry.attributes.color.array;
  let k = 0;
  for (let i = 0; i <= SLICE_RES; i++) {
    for (let j = 0; j <= SLICE_RES; j++) {
      const x = -1 + 2 * (i / SLICE_RES);
      const z = -1 + 2 * (j / SLICE_RES);
      const d = divField(x, 0, z);
      const c = divergent(d, maxAbs, 0.6);
      colors[k++] = c.r; colors[k++] = c.g; colors[k++] = c.b;
    }
  }
  sliceMesh.geometry.attributes.color.needsUpdate = true;
}

// ── 3D field arrow grid ────────────────────────────────────────────────────

let fieldGroup = null;

function rebuildFieldArrows() {
  if (fieldGroup) {
    scene.remove(fieldGroup);
    fieldGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  fieldGroup = new THREE.Group();
  const N = 4;
  const span = 2.6;
  const offset = -1.3;
  const arrowLen = 0.18;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        const x = offset + span * (i + 0.5) / N;
        const y = offset + span * (j + 0.5) / N;
        const z = offset + span * (k + 0.5) / N;
        // Outside the cube only, so we don't clutter the interior.
        if (Math.abs(x) < 1 && Math.abs(y) < 1 && Math.abs(z) < 1) continue;
        const F = field(x, y, z);
        const m = Math.hypot(F.x, F.y, F.z);
        if (m < 1e-6) continue;
        const dir = V(F.x, F.y, F.z).normalize();
        const arrow = new THREE.ArrowHelper(dir, V(x, y, z), arrowLen, 0x445166, 0.05, 0.035);
        arrow.line.material.transparent = true;
        arrow.line.material.opacity = 0.55;
        arrow.cone.material.transparent = true;
        arrow.cone.material.opacity = 0.55;
        fieldGroup.add(arrow);
      }
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
sliderLabel.innerHTML = '<span style="white-space:nowrap">场强系数 κ =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0.5';
slider.max = '2';
slider.step = '0.05';
slider.value = '1';
slider.style.cssText = 'width:160px;';
const kReadout = document.createElement('span');
kReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:4ch;';
kReadout.textContent = '1.00';
sliderLabel.appendChild(slider);
sliderLabel.appendChild(kReadout);
overlay.appendChild(sliderLabel);

const fluxStat = document.createElement('span');
fluxStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(fluxStat);

const divStat = document.createElement('span');
divStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
overlay.appendChild(divStat);

const note = document.createElement('span');
note.style.cssText = 'color:#6b7280;font-size:0.92em;';
note.textContent = '左键拖拽旋转';
overlay.appendChild(note);

function updateAll() {
  kappa = parseFloat(slider.value);
  kReadout.textContent = kappa.toFixed(2);
  buildOrUpdateFaces();
  buildOrUpdateSlice();
  rebuildFieldArrows();
  fluxStat.innerHTML = '∯<sub>∂V</sub> F·dS = <strong>' + trueFlux().toFixed(3) + '</strong>';
  divStat.innerHTML  = '∭<sub>V</sub> ∇·F dV = <strong>' + trueFlux().toFixed(3) + '</strong>';
}

slider.addEventListener('input', updateAll);

// ── Init + render loop ─────────────────────────────────────────────────────

fitCamera();
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
