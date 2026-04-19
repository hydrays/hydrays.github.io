// chapter10-critpt.js
// Interactive critical-point classification for f(x,y) = ½(λ₁x² + λ₂y²)
// Updates when the 'critpt-update' CustomEvent fires on window.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

function f(x, y, l1, l2) { return 0.5 * (l1 * x * x + l2 * y * y); }

const container = document.getElementById('critpt-3d');

// ── renderer ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0d1120, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.prepend(renderer.domElement);

// ── scene & camera ────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(4.2, 3.0, 5.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;

// ── lighting ──────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const dLight = new THREE.DirectionalLight(0xffffff, 0.85);
dLight.position.set(3, 7, 4);
scene.add(dLight);

// ── helpers ───────────────────────────────────────────────────────────────────
const lineMaterials = [];
function mkLine(pts, color, lw) {
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  const mat = new LineMaterial({ color, linewidth: lw || 2.0 });
  lineMaterials.push(mat);
  return new Line2(geo, mat);
}
function mkArrowObj(start, end, color, lw, headLen, headR) {
  const dir = end.clone().sub(start).normalize();
  const hl = headLen || 0.18;
  const shaftEnd = end.clone().addScaledVector(dir, -hl);
  const shaft = mkLine([start, shaftEnd], color, lw || 2.5);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(headR || 0.07, hl, 14),
    new THREE.MeshPhongMaterial({ color, shininess: 50 })
  );
  head.position.copy(shaftEnd).addScaledVector(dir, hl / 2);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const g = new THREE.Group(); g.add(shaft, head); return g;
}

// ── axes ──────────────────────────────────────────────────────────────────────
const AX = 2.8;
const AC = 0xc8d0e0;
scene.add(mkArrowObj(new THREE.Vector3(-AX, 0, 0), new THREE.Vector3(AX, 0, 0), AC, 2.0, 0.14, 0.055));
scene.add(mkArrowObj(new THREE.Vector3(0, -AX, 0), new THREE.Vector3(0, AX, 0), AC, 2.0, 0.14, 0.055));
scene.add(mkArrowObj(new THREE.Vector3(0, 0, AX), new THREE.Vector3(0, 0, -AX), AC, 2.0, 0.14, 0.055));

// Axis tick marks
{
  const tp = [];
  for (const v of [-2, -1, 1, 2]) {
    tp.push(v, -0.06, 0,  v, 0.06, 0);  // x-axis ticks
    tp.push(-0.06, v, 0,  0.06, v, 0);  // y-axis ticks
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x666880 })));
}

// Critical point marker at origin
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.072, 18, 14),
  new THREE.MeshPhongMaterial({ color: 0xffee44, shininess: 90, emissive: 0x443300 })
));

// ── surface (rebuilt on each update) ─────────────────────────────────────────
const N = 46, RANGE = 2.3;
let surfaceMesh = null;

// coolwarm-like colormap: blue(low) → white(mid) → red(high)
function coolwarm(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const s = t * 2;
    return [0.23 + 0.60 * s, 0.30 + 0.55 * s, 0.85 - 0.20 * s];
  } else {
    const s = (t - 0.5) * 2;
    return [0.83 + 0.17 * s, 0.85 - 0.68 * s, 0.65 - 0.60 * s];
  }
}

function buildSurface(l1, l2) {
  if (surfaceMesh) {
    scene.remove(surfaceMesh);
    surfaceMesh.geometry.dispose();
    surfaceMesh.material.dispose();
    surfaceMesh = null;
  }

  const vs = [], cols = [], ix = [];

  // First pass: z values
  const zArr = new Float32Array((N + 1) * (N + 1));
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    zArr[i * (N + 1) + j] = f(-RANGE + 2 * RANGE * i / N, -RANGE + 2 * RANGE * j / N, l1, l2);
  }
  const zRaw = Array.from(zArr);
  const zMin = Math.min(...zRaw), zMax = Math.max(...zRaw);
  const zSpan = Math.max(Math.max(Math.abs(zMin), Math.abs(zMax)), 0.001);
  // Normalize to visual z ∈ [-1.8, +1.8]
  const zVis = 1.8 / zSpan;

  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const x = -RANGE + 2 * RANGE * i / N;
    const y = -RANGE + 2 * RANGE * j / N;
    const z = zArr[i * (N + 1) + j];
    // Three.js: x→x, z_manim(up)→y, y_manim(into screen)→-z
    vs.push(x, z * zVis, -y);
    const [r, g, b] = coolwarm((z - zMin) / Math.max(zMax - zMin, 0.001));
    cols.push(r, g, b);
  }

  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = i * (N + 1) + j, b = a + 1, c = a + (N + 1), d = c + 1;
    ix.push(a, b, d,  a, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  surfaceMesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    vertexColors: true, transparent: true, opacity: 0.80,
    side: THREE.DoubleSide, shininess: 35, depthWrite: false
  }));
  scene.add(surfaceMesh);
}

// ── initial state ──────────────────────────────────────────────────────────────
const slL1 = document.getElementById('critpt-l1');
const slL2 = document.getElementById('critpt-l2');
buildSurface(
  slL1 ? parseFloat(slL1.value) : 1.0,
  slL2 ? parseFloat(slL2.value) : 1.0
);

window.addEventListener('critpt-update', (e) => {
  buildSurface(e.detail.l1, e.detail.l2);
});

// ── resize & loop ──────────────────────────────────────────────────────────────
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h, false);
  for (const m of lineMaterials) m.resolution.set(w * devicePixelRatio, h * devicePixelRatio);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
resize(); animate();
new ResizeObserver(resize).observe(container);
