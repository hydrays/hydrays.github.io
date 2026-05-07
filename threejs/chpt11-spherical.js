/**
 * chpt11-spherical.js
 * §11 — spherical-coordinate volume element.
 *
 *   ΔV = ρ² sinφ Δρ Δφ Δθ
 *
 * Physics convention:
 *   ρ  = radial distance from origin
 *   φ ∈ [0, π]  = polar angle from +z axis
 *   θ ∈ [0, 2π) = azimuthal angle in xy-plane from +x axis
 *
 *   Math → Cartesian: (ρ, φ, θ) → (ρ sinφ cosθ,  ρ sinφ sinθ,  ρ cosφ)
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,  math y → three.-z,  math z → three.y
 *   So the math z-axis (polar axis) becomes Three.js y (vertical).
 */

import * as THREE                     from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── coordinate helpers ────────────────────────────────────────────────────────

// Spherical (math) → Three.js Vector3.
// math: x = ρ sinφ cosθ,  y = ρ sinφ sinθ,  z = ρ cosφ
// three convention: math-x→three-x, math-y→three-(-z), math-z→three-y
function sph(rho, phi, theta) {
  const sinP = Math.sin(phi), cosP = Math.cos(phi);
  const sinT = Math.sin(theta), cosT = Math.cos(theta);
  const mx = rho * sinP * cosT;   // math x
  const my = rho * sinP * sinT;   // math y
  const mz = rho * cosP;          // math z
  return new THREE.Vector3(mx, mz, -my);  // three (x, y, z)
}

// ── container + renderers ─────────────────────────────────────────────────────

const container = document.getElementById('chpt11-spherical');
if (!container) throw new Error('chpt11-spherical: container not found');
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

// ── scene, lights, camera ─────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dir = new THREE.DirectionalLight(0xffffff, 0.45);
dir.position.set(2, 3, 1.5);
scene.add(dir);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(2.4, 1.8, 2.4);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0, 0);

// ── grid parameters ───────────────────────────────────────────────────────────

const N_rho   = 3;
const N_phi   = 8;
const N_theta = 12;
const R       = 1;         // unit sphere radius

const rhoArr   = Array.from({length: N_rho   + 1}, (_, i) => (i / N_rho)   * R);
const phiArr   = Array.from({length: N_phi   + 1}, (_, i) => (i / N_phi)   * Math.PI);
const thetaArr = Array.from({length: N_theta + 1}, (_, i) => (i / N_theta) * 2 * Math.PI);

// ── 1. semi-transparent reference unit sphere ─────────────────────────────────

{
  const geo = new THREE.SphereGeometry(R, 64, 32);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6b9dc8, transparent: true, opacity: 0.18,
    roughness: 0.85, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ── 2. spherical coordinate grid on the unit sphere ──────────────────────────

const gridMat = new THREE.LineBasicMaterial({
  color: 0x9ab0c8, transparent: true, opacity: 0.55,
});
const ARC_SEGS = 64;

function addLine(pts, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(geo, mat || gridMat));
}

// Longitude lines (fixed θ): N_theta great half-circles from south to north pole.
for (let it = 0; it < N_theta; it++) {
  const th = thetaArr[it];
  const pts = [];
  for (let s = 0; s <= ARC_SEGS; s++) {
    pts.push(sph(R, (s / ARC_SEGS) * Math.PI, th));
  }
  addLine(pts);
}

// Latitude rings (fixed φ): N_phi - 1 rings, skipping poles (i=0 and i=N_phi).
for (let ip = 1; ip < N_phi; ip++) {
  const ph = phiArr[ip];
  const pts = [];
  for (let s = 0; s <= ARC_SEGS; s++) {
    pts.push(sph(R, ph, (s / ARC_SEGS) * 2 * Math.PI));
  }
  addLine(pts);
}

// ── helper for wedge outlines ─────────────────────────────────────────────────

function addEdge(pts, mat) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  scene.add(new THREE.Line(geo, mat));
}

// ── 3. highlighted volume element ────────────────────────────────────────────
// Indices (iρ, iφ, iθ) = (1, 3, 4) — 0-based.
// ρ ∈ [1/3, 2/3],  φ ∈ [3π/8, π/2],  θ ∈ [2π/3, 5π/6]

{
  const rho0  = rhoArr[1],   rho1  = rhoArr[2];    // 1/3, 2/3
  const phi0  = phiArr[3],   phi1  = phiArr[4];    // 3π/8, π/2
  const th0   = thetaArr[4], th1   = thetaArr[5];  // 2π/3, 5π/6

  const WSEG = 20;   // arc subdivisions for curved faces

  const verts = [];

  function tri(a, b, c) {
    verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  }
  function quad(a, b, c, d) { tri(a, b, c); tri(a, c, d); }

  // Inner spherical face (ρ = rho0) and outer spherical face (ρ = rho1).
  for (let sp = 0; sp < WSEG; sp++) {
    const pa = phi0 + (sp     / WSEG) * (phi1 - phi0);
    const pb = phi0 + ((sp+1) / WSEG) * (phi1 - phi0);
    for (let st = 0; st < WSEG; st++) {
      const ta = th0 + (st     / WSEG) * (th1 - th0);
      const tb = th0 + ((st+1) / WSEG) * (th1 - th0);
      // inner face
      quad(sph(rho0, pa, ta), sph(rho0, pa, tb),
           sph(rho0, pb, tb), sph(rho0, pb, ta));
      // outer face
      quad(sph(rho1, pa, ta), sph(rho1, pb, ta),
           sph(rho1, pb, tb), sph(rho1, pa, tb));
    }
  }

  // Top cap (φ = phi0) and bottom cap (φ = phi1): flat conic faces.
  for (let st = 0; st < WSEG; st++) {
    const ta = th0 + (st     / WSEG) * (th1 - th0);
    const tb = th0 + ((st+1) / WSEG) * (th1 - th0);
    for (let sr = 0; sr < WSEG; sr++) {
      const ra = rho0 + (sr     / WSEG) * (rho1 - rho0);
      const rb = rho0 + ((sr+1) / WSEG) * (rho1 - rho0);
      // phi = phi0 face
      quad(sph(ra, phi0, ta), sph(rb, phi0, ta),
           sph(rb, phi0, tb), sph(ra, phi0, tb));
      // phi = phi1 face
      quad(sph(ra, phi1, ta), sph(ra, phi1, tb),
           sph(rb, phi1, tb), sph(rb, phi1, ta));
    }
  }

  // Side flat faces at θ = th0 and θ = th1.
  for (let sp = 0; sp < WSEG; sp++) {
    const pa = phi0 + (sp     / WSEG) * (phi1 - phi0);
    const pb = phi0 + ((sp+1) / WSEG) * (phi1 - phi0);
    for (let sr = 0; sr < WSEG; sr++) {
      const ra = rho0 + (sr     / WSEG) * (rho1 - rho0);
      const rb = rho0 + ((sr+1) / WSEG) * (rho1 - rho0);
      // face at th0
      quad(sph(ra, pa, th0), sph(rb, pa, th0),
           sph(rb, pb, th0), sph(ra, pb, th0));
      // face at th1
      quad(sph(ra, pa, th1), sph(ra, pb, th1),
           sph(rb, pb, th1), sph(rb, pa, th1));
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xe05010, transparent: true, opacity: 0.85,
    roughness: 0.6, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));

  // Thin wireframe outline so edges read clearly.
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x7a2800 });

  const phiMid  = (phi0 + phi1) / 2;
  const thMid   = (th0  + th1)  / 2;
  const rhoMid  = (rho0 + rho1) / 2;

  // Radial edges at all 8 corners of the wedge.
  for (const ph of [phi0, phi1]) {
    for (const th of [th0, th1]) {
      addEdge([sph(rho0, ph, th), sph(rho1, ph, th)], edgeMat);
    }
  }

  // Arc edges along φ at constant ρ and θ (4 arcs: inner/outer × th0/th1).
  for (const rh of [rho0, rho1]) {
    for (const th of [th0, th1]) {
      const pts = [];
      for (let s = 0; s <= WSEG; s++) {
        pts.push(sph(rh, phi0 + (s / WSEG) * (phi1 - phi0), th));
      }
      addEdge(pts, edgeMat);
    }
  }

  // Arc edges along θ at constant ρ and φ (4 arcs: inner/outer × phi0/phi1).
  for (const rh of [rho0, rho1]) {
    for (const ph of [phi0, phi1]) {
      const pts = [];
      for (let s = 0; s <= WSEG; s++) {
        pts.push(sph(rh, ph, th0 + (s / WSEG) * (th1 - th0)));
      }
      addEdge(pts, edgeMat);
    }
  }

  // ── 4. CSS2D edge labels ───────────────────────────────────────────────────

  function makeLabel(text) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText =
      'font:600 13px/1 -apple-system,sans-serif;color:#7a1c00;'
      + 'background:rgba(255,240,230,0.92);padding:2px 6px;border-radius:3px;'
      + 'border:1px solid #e06020;white-space:nowrap;';
    return new CSS2DObject(d);
  }

  // Δρ — midpoint of outer radial edge at (phiMid, thMid), offset outward.
  {
    const lbl = makeLabel('Δρ');
    // Place at midpoint of a radial edge going from rho0 to rho1.
    const p = sph(rhoMid, phiMid, th0 - 0.06);
    // Offset slightly outward from the cell face.
    const outDir = sph(1, phiMid, th0 - 0.06).normalize();
    lbl.position.copy(p.addScaledVector(outDir, 0.08));
    scene.add(lbl);
  }

  // ρΔφ — midpoint of the outer-ρ, φ-arc at thMid, offset outward.
  {
    const lbl = makeLabel('ρΔφ');
    // Midpoint of the outer arc along φ direction.
    const p = sph(rho1, phiMid, thMid);
    const outDir = sph(1, phiMid, thMid).normalize();
    lbl.position.copy(p.addScaledVector(outDir, 0.12));
    scene.add(lbl);
  }

  // ρ sinφ Δθ — midpoint of the outer-ρ, φ1 arc along θ, offset below.
  {
    const lbl = makeLabel('ρ sinφ Δθ');
    // Midpoint of the outer arc along θ direction at phi1 (equator face).
    const p = sph(rho1, phi1, thMid);
    const outDir = sph(1, phi1, thMid).normalize();
    lbl.position.copy(p.addScaledVector(outDir, 0.12));
    scene.add(lbl);
  }
}

// ── 5. math axes + labels ─────────────────────────────────────────────────────

{
  const matAxis = new THREE.LineBasicMaterial({ color: 0x444444 });
  const seg = (a, b) =>
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), matAxis);

  // math +x → three +x
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.4, 0,  0  )));
  // math +y → three -z
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0,   0, -1.4)));
  // math +z → three +y
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0,   1.4, 0 )));

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

// ── resize + animate ──────────────────────────────────────────────────────────

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
