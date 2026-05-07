/**
 * chpt11-cylindrical.js
 * §11.4 / §11.5 — cylindrical-coordinate volume element.
 *
 *   ΔV = ρ Δρ Δθ Δz
 *
 * The scene shows a unit cylinder (radius 1, height 1) with a cylindrical
 * coordinate grid drawn on its surfaces, and one highlighted wedge-shaped
 * volume element at grid index (iρ, iθ, iz) = (2, 2, 2).
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,  math y → three.-z,  math z → three.y
 * The math z-axis is therefore Three.js y (vertical).
 * Cylindrical coords: x = ρ cosθ, y = ρ sinθ, z = z
 * → three-space: (ρ cosθ, z, -ρ sinθ)
 */

import * as THREE                     from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── coordinate helper ─────────────────────────────────────────────────────
// Convert math cylindrical (rho, theta, z) → Three.js Vector3.
function cyl(rho, theta, mz) {
  return new THREE.Vector3(rho * Math.cos(theta), mz, -rho * Math.sin(theta));
}

// ── container + renderers ─────────────────────────────────────────────────

const container = document.getElementById('chpt11-cylindrical');
if (!container) throw new Error('chpt11-cylindrical: container not found');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
container.appendChild(labelRenderer.domElement);

// ── scene, lights, camera ─────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dir = new THREE.DirectionalLight(0xffffff, 0.45);
dir.position.set(2, 3, 1.5);
scene.add(dir);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(2.4, 1.8, 2.4);
camera.lookAt(0, 0.5, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.08;
controls.target.set(0, 0.5, 0);

// ── grid parameters ───────────────────────────────────────────────────────

const N_rho   = 4;                        // radial divisions
const N_theta = 12;                       // angular divisions
const N_z     = 5;                        // vertical divisions
const R       = 1;                        // cylinder radius
const H       = 1;                        // cylinder height

const rhoArr   = Array.from({length: N_rho   + 1}, (_, i) => (i / N_rho)   * R);
const thetaArr = Array.from({length: N_theta + 1}, (_, i) => (i / N_theta) * 2 * Math.PI);
const zArr     = Array.from({length: N_z     + 1}, (_, i) => (i / N_z)     * H);

// ── 1. semi-transparent reference cylinder ────────────────────────────────

{
  const geo = new THREE.CylinderGeometry(R, R, H, 64, 1, false);
  geo.translate(0, H / 2, 0);   // base at y=0 (math z=0)
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6b9dc8, transparent: true, opacity: 0.18,
    roughness: 0.85, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ── 2. cylindrical grid ───────────────────────────────────────────────────

const gridMat = new THREE.LineBasicMaterial({ color: 0x9ab0c8, transparent: true, opacity: 0.55 });
const ARC_SEGS = 64;   // segments per arc

// Helper: add a line from array of Vector3 points.
function addLine(pts) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(geo, gridMat));
}

// Side surface: vertical lines at each theta, horizontal rings at each z.
for (let it = 0; it < N_theta; it++) {
  const th = thetaArr[it];
  addLine([cyl(R, th, 0), cyl(R, th, H)]);   // vertical spoke on side
}

for (let iz = 0; iz <= N_z; iz++) {
  const mz = zArr[iz];
  const pts = [];
  for (let s = 0; s <= ARC_SEGS; s++) {
    pts.push(cyl(R, (s / ARC_SEGS) * 2 * Math.PI, mz));
  }
  addLine(pts);   // horizontal ring on side
}

// Top cap (z = H) and bottom cap (z = 0): concentric circles + radial spokes.
for (const mz of [0, H]) {
  // Concentric circles at each rho level.
  for (let ir = 1; ir <= N_rho; ir++) {
    const r = rhoArr[ir];
    const pts = [];
    for (let s = 0; s <= ARC_SEGS; s++) {
      pts.push(cyl(r, (s / ARC_SEGS) * 2 * Math.PI, mz));
    }
    addLine(pts);
  }
  // Radial spokes.
  for (let it = 0; it < N_theta; it++) {
    const th = thetaArr[it];
    addLine([cyl(0, th, mz), cyl(R, th, mz)]);
  }
}

// ── 3. highlighted volume element wedge ───────────────────────────────────
// Indices (iρ, iθ, iz) = (2, 2, 2) → 0-based.
// ρ ∈ [0.5, 0.75],  θ ∈ [π/3, π/2],  z ∈ [0.4, 0.6]

{
  const rho0  = rhoArr[2],   rho1  = rhoArr[3];    // 0.5, 0.75
  const th0   = thetaArr[2], th1   = thetaArr[3];  // π/3, π/2
  const z0    = zArr[2],     z1    = zArr[3];       // 0.4, 0.6

  const WSEG = 16;    // arc subdivision for the wedge faces

  // Build geometry as raw triangles.
  const verts = [];

  function tri(a, b, c) {
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }

  // Inner curved face (ρ = rho0) and outer curved face (ρ = rho1).
  for (let s = 0; s < WSEG; s++) {
    const ta = th0 + (s     / WSEG) * (th1 - th0);
    const tb = th0 + ((s+1) / WSEG) * (th1 - th0);
    // inner arc face
    quad(cyl(rho0, ta, z0), cyl(rho0, ta, z1),
         cyl(rho0, tb, z1), cyl(rho0, tb, z0));
    // outer arc face
    quad(cyl(rho1, ta, z0), cyl(rho1, tb, z0),
         cyl(rho1, tb, z1), cyl(rho1, ta, z1));
  }

  // Bottom face (z = z0) and top face (z = z1).
  for (let s = 0; s < WSEG; s++) {
    const ta = th0 + (s     / WSEG) * (th1 - th0);
    const tb = th0 + ((s+1) / WSEG) * (th1 - th0);
    // bottom
    quad(cyl(rho0, ta, z0), cyl(rho1, ta, z0),
         cyl(rho1, tb, z0), cyl(rho0, tb, z0));
    // top
    quad(cyl(rho0, ta, z1), cyl(rho0, tb, z1),
         cyl(rho1, tb, z1), cyl(rho1, ta, z1));
  }

  // Side flat faces at θ = th0 and θ = th1.
  for (let s = 0; s < WSEG; s++) {
    const ra = rho0 + (s     / WSEG) * (rho1 - rho0);
    const rb = rho0 + ((s+1) / WSEG) * (rho1 - rho0);
    // face at th0
    quad(cyl(ra, th0, z0), cyl(rb, th0, z0),
         cyl(rb, th0, z1), cyl(ra, th0, z1));
    // face at th1
    quad(cyl(ra, th1, z0), cyl(ra, th1, z1),
         cyl(rb, th1, z1), cyl(rb, th1, z0));
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xe06020, transparent: true, opacity: 0.85,
    roughness: 0.6, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));

  // Thin wireframe outline so the edges read clearly.
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x7a2800 });
  const rhoMid  = (rho0 + rho1) / 2;
  const thMid   = (th0  + th1)  / 2;
  const zMid    = (z0   + z1)   / 2;

  // Radial edges at corners.
  for (const [th, mz] of [[th0, z0],[th0, z1],[th1, z0],[th1, z1]]) {
    addEdge([cyl(rho0, th, mz), cyl(rho1, th, mz)], edgeMat);
  }
  // Vertical edges at corners.
  for (const [rh, th] of [[rho0, th0],[rho0, th1],[rho1, th0],[rho1, th1]]) {
    addEdge([cyl(rh, th, z0), cyl(rh, th, z1)], edgeMat);
  }
  // Arc edges (inner and outer, top and bottom).
  for (const [rh, mz] of [[rho0, z0],[rho0, z1],[rho1, z0],[rho1, z1]]) {
    const pts = [];
    for (let s = 0; s <= WSEG; s++) {
      pts.push(cyl(rh, th0 + (s / WSEG) * (th1 - th0), mz));
    }
    addEdge(pts, edgeMat);
  }

  // ── 4. CSS2D edge labels ───────────────────────────────────────────────

  function makeLabel(text) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText =
      'font:600 13px/1 -apple-system,sans-serif;color:#7a1c00;'
      + 'background:rgba(255,240,230,0.92);padding:2px 6px;border-radius:3px;'
      + 'border:1px solid #e06020;white-space:nowrap;';
    const o = new CSS2DObject(d);
    return o;
  }

  // Δρ — midpoint of outer radial edge on bottom face, offset outward.
  {
    const midRho = (rho0 + rho1) / 2;
    const offset = 0.12;
    const lbl = makeLabel('Δρ');
    const p = cyl(midRho + offset, thMid, z0 - 0.08);
    lbl.position.copy(p);
    scene.add(lbl);
  }

  // ρΔθ — midpoint of outer arc on top face, offset outward radially.
  {
    const offset = 0.13;
    const lbl = makeLabel('ρΔθ');
    const p = cyl(rho1 + offset, thMid, z1 + 0.05);
    lbl.position.copy(p);
    scene.add(lbl);
  }

  // Δz — midpoint of vertical edge at outer corner, offset outward.
  {
    const offset = 0.12;
    const lbl = makeLabel('Δz');
    const p = cyl(rho1 + offset, th0 - 0.05, zMid);
    lbl.position.copy(p);
    scene.add(lbl);
  }
}

// ── edge helper (used both in grid and wedge outline) ─────────────────────

function addEdge(pts, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(geo, mat));
}

// ── 5. math axes + labels ─────────────────────────────────────────────────

{
  const matAxis = new THREE.LineBasicMaterial({ color: 0x444444 });
  const seg = (a, b) =>
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), matAxis);

  // Math +x → three +x,  Math +y → three -z,  Math +z → three +y
  scene.add(seg(new THREE.Vector3(0, 0,  0), new THREE.Vector3(1.4, 0,  0  )));  // math x
  scene.add(seg(new THREE.Vector3(0, 0,  0), new THREE.Vector3(0,   0, -1.4)));  // math y
  scene.add(seg(new THREE.Vector3(0, 0,  0), new THREE.Vector3(0,   1.4, 0 )));  // math z

  function tag(text, p) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText =
      'font:600 14px/1 -apple-system,sans-serif;color:#111;'
      + 'background:rgba(255,255,255,0.85);padding:1px 5px;border-radius:3px;';
    const o = new CSS2DObject(d);
    o.position.copy(p);
    scene.add(o);
  }
  tag('x', new THREE.Vector3(1.50, 0,    0   ));
  tag('y', new THREE.Vector3(0,    0,   -1.50));
  tag('z', new THREE.Vector3(0,    1.50, 0   ));
}

// ── resize + animate ──────────────────────────────────────────────────────

function resize() {
  const r = container.getBoundingClientRect();
  const w = r.width, h = Math.max(1, r.height);
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();
new ResizeObserver(resize).observe(container);

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
})();
