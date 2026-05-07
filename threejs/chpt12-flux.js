/**
 * chpt12-flux.js
 * §12.5 surface flux ∬_S F·dS through an open surface.
 *
 * Surface S = upper unit hemisphere  (math: z ≥ 0, x² + y² + z² = 1)
 * Outward normal n(x, y, z) = (x, y, z).
 * Field F(x, y, z) = (sin α, 0, cos α) — uniform but tilted by slider α.
 * Then F·n = x sin α + z cos α and total flux = π cos α (the rest is odd in x).
 *
 * Visual recipe (3D, rotatable):
 *   - Hemisphere mesh, vertex-coloured by F·n at each point (rose↔beige↔emerald)
 *   - Boundary ∂S drawn as a black circle in the z = 0 plane
 *   - Sparse outward-normal arrows on the hemisphere (small black arrows)
 *   - 3D field arrow grid (faint blue-grey)
 *   - Slider drives α; readout shows ∬_S F·dS = π cos α and the analytic value
 *
 * Math (x, y, z) → Three.js (x, z, −y), matching chpt11 convention.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// math → THREE
function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -(my ?? 0)); }

// ── State ──────────────────────────────────────────────────────────────────

let alpha = 0;   // field tilt angle, radians; slider drives this

function field(x, y, z) {
  return { x: Math.sin(alpha), y: 0, z: Math.cos(alpha) };
}

const trueFlux = () => Math.PI * Math.cos(alpha);

// ── Container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt12-flux');
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
camera.position.set(2.6, 2.0, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.2, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2;
controls.maxDistance = 9;

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

// ── Coordinate axes (subtle) ───────────────────────────────────────────────

{
  const L = 1.3;
  const axes = [
    { d: V(L, 0, 0),  c: 0xb91c1c },
    { d: V(0, L, 0),  c: 0x16a34a },
    { d: V(0, 0, L),  c: 0x1d4ed8 },
  ];
  for (const ax of axes) {
    const g = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), ax.d]);
    const mat = new THREE.LineBasicMaterial({ color: ax.c, transparent: true, opacity: 0.4 });
    scene.add(new THREE.Line(g, mat));
  }
}

// ── Hemisphere with vertex colours ────────────────────────────────────────

const N_PHI = 48, N_THETA = 64;

function buildHemiVerts() {
  // Returns positions array AND a lookup of (x,y,z) at each vertex.
  const positions = [];
  const indices = [];
  const xyz = [];
  for (let i = 0; i <= N_PHI; i++) {
    const phi = (i / N_PHI) * (Math.PI / 2);   // 0 = north pole, π/2 = equator
    for (let j = 0; j <= N_THETA; j++) {
      const theta = (j / N_THETA) * 2 * Math.PI;
      const x = Math.sin(phi) * Math.cos(theta);
      const y = Math.sin(phi) * Math.sin(theta);
      const z = Math.cos(phi);
      const v = V(x, y, z);
      positions.push(v.x, v.y, v.z);
      xyz.push(x, y, z);
    }
  }
  const stride = N_THETA + 1;
  for (let i = 0; i < N_PHI; i++) {
    for (let j = 0; j < N_THETA; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, indices, xyz };
}

const HEMI = buildHemiVerts();
const hemiGeo = new THREE.BufferGeometry();
hemiGeo.setAttribute('position', new THREE.Float32BufferAttribute(HEMI.positions, 3));
hemiGeo.setAttribute('color',    new THREE.Float32BufferAttribute(new Array(HEMI.positions.length).fill(0.5), 3));
hemiGeo.setIndex(HEMI.indices);
hemiGeo.computeVertexNormals();
const hemiMat = new THREE.MeshLambertMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.95,
});
const hemiMesh = new THREE.Mesh(hemiGeo, hemiMat);
scene.add(hemiMesh);

// Wireframe overlay for visual definition.
{
  const wireGeo = new THREE.WireframeGeometry(hemiGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.06 });
  scene.add(new THREE.LineSegments(wireGeo, wireMat));
}

function recolorHemi() {
  const colors = hemiGeo.attributes.color.array;
  let maxAbs = 0;
  for (let k = 0; k < HEMI.xyz.length / 3; k++) {
    const x = HEMI.xyz[k * 3], y = HEMI.xyz[k * 3 + 1], z = HEMI.xyz[k * 3 + 2];
    const F = field(x, y, z);
    const d = F.x * x + F.y * y + F.z * z;
    if (Math.abs(d) > maxAbs) maxAbs = Math.abs(d);
  }
  if (maxAbs < 1e-9) maxAbs = 1;
  for (let k = 0; k < HEMI.xyz.length / 3; k++) {
    const x = HEMI.xyz[k * 3], y = HEMI.xyz[k * 3 + 1], z = HEMI.xyz[k * 3 + 2];
    const F = field(x, y, z);
    const d = F.x * x + F.y * y + F.z * z;
    const c = divergent(d, maxAbs, 0.55);
    colors[k * 3]     = c.r;
    colors[k * 3 + 1] = c.g;
    colors[k * 3 + 2] = c.b;
  }
  hemiGeo.attributes.color.needsUpdate = true;
}

// ── Boundary circle ∂S at z=0 ──────────────────────────────────────────────

{
  const pts = [];
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * 2 * Math.PI;
    pts.push(V(Math.cos(t), Math.sin(t), 0));
  }
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x111111, linewidth: 2 })));
}

// ── Sample outward normal arrows on the hemisphere ─────────────────────────

{
  const samples = [
    { phi: 0.05,  theta: 0       },
    { phi: Math.PI / 4, theta: 0           },
    { phi: Math.PI / 4, theta: Math.PI / 2 },
    { phi: Math.PI / 4, theta: Math.PI     },
    { phi: Math.PI / 4, theta: 3 * Math.PI / 2 },
    { phi: Math.PI / 3, theta: Math.PI / 4 },
    { phi: Math.PI / 3, theta: 5 * Math.PI / 4 },
  ];
  for (const s of samples) {
    const x = Math.sin(s.phi) * Math.cos(s.theta);
    const y = Math.sin(s.phi) * Math.sin(s.theta);
    const z = Math.cos(s.phi);
    const origin = V(x, y, z);
    const dir = V(x, y, z).normalize();
    const arrow = new THREE.ArrowHelper(dir, origin, 0.20, 0x111111, 0.06, 0.04);
    scene.add(arrow);
  }
}

// ── Field arrow grid in 3D (rebuilt when α changes) ────────────────────────

let fieldGroup = null;

function rebuildFieldArrows() {
  if (fieldGroup) {
    scene.remove(fieldGroup);
    fieldGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  fieldGroup = new THREE.Group();
  const N = 4;
  const span = 2.4;
  const arrowLen = 0.20;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      for (let k = 0; k < N; k++) {
        const x = -1.2 + span * (i + 0.5) / N;
        const y = -1.2 + span * (j + 0.5) / N;
        const z = -0.05 + 1.4 * (k + 0.5) / N;
        // Skip inside hemisphere: fewer arrows there.
        if (x*x + y*y + z*z < 0.7) continue;
        const F = field(x, y, z);
        const m = Math.hypot(F.x, F.y, F.z);
        if (m < 1e-9) continue;
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
sliderLabel.innerHTML = '<span style="white-space:nowrap">场倾角 α =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '-90';
slider.max = '90';
slider.step = '1';
slider.value = '0';
slider.style.cssText = 'width:200px;';
const aReadout = document.createElement('span');
aReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:5ch;';
aReadout.textContent = '0°';
sliderLabel.appendChild(slider);
sliderLabel.appendChild(aReadout);
overlay.appendChild(sliderLabel);

const fluxStat = document.createElement('span');
fluxStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#15803d;';
overlay.appendChild(fluxStat);

const note = document.createElement('span');
note.style.cssText = 'color:#6b7280;font-size:0.92em;';
note.textContent = '左键拖拽旋转视角 / 滚轮缩放';
overlay.appendChild(note);

function updateAll() {
  const deg = parseFloat(slider.value);
  alpha = deg * Math.PI / 180;
  aReadout.textContent = deg.toFixed(0) + '°';
  recolorHemi();
  rebuildFieldArrows();
  fluxStat.innerHTML = '∬<sub>S</sub> F·dS = <strong>' + trueFlux().toFixed(3) + '</strong>' +
                       ' = π cos α';
}

slider.addEventListener('input', updateAll);

// ── Init + render loop ─────────────────────────────────────────────────────

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
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();
