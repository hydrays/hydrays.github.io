/**
 * chpt11-mass-solid.js
 * §11.5 motivation: mass of a non-uniform solid as a triple Riemann sum.
 *
 *   solid V = { (x, y, z) : x² + y² ≤ 1,  0 ≤ z ≤ 1 }
 *   density  ρ(x,y,z) = 0.5 + 0.4 z + 0.3 (x² + y²)        (range ≈ [0.5, 1.2])
 *
 * The cylinder side and top/bottom caps are vertex-coloured by ρ. A slider
 * drives a horizontal cutting plane at z = z₀. The cross-section disk is
 * rendered opaque with the same colormap so the density profile across z
 * is legible. The remaining solid is shown semi-transparent so the disk
 * stays the focal point.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x, math y → three.-z, math z → three.y.
 */

import * as THREE                     from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── density ────────────────────────────────────────────────────────────────

function rho(x, y, z) {
  return 0.5 + 0.4 * z + 0.3 * (x * x + y * y);
}

const RHO_LO = 0.5;                          // (x,y) = (0,0), z = 0
const RHO_HI = rho(1, 0, 1);                 // = 0.5 + 0.4 + 0.3 = 1.2

// Three-stop colour ramp matching chpt11-mass-plate for visual continuity.
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const c0 = { r: 0.18, g: 0.30, b: 0.65 };
  const c1 = { r: 0.97, g: 0.85, b: 0.30 };
  const c2 = { r: 0.78, g: 0.18, b: 0.18 };
  const u = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = t < 0.5 ? c0 : c1;
  const b = t < 0.5 ? c1 : c2;
  return { r: a.r + (b.r - a.r) * u,
           g: a.g + (b.g - a.g) * u,
           b: a.b + (b.b - a.b) * u };
}

function colorAt(x, y, z) {
  const t = (rho(x, y, z) - RHO_LO) / (RHO_HI - RHO_LO);
  return ramp(t);
}

// ── container ──────────────────────────────────────────────────────────────

const container = document.getElementById('chpt11-mass-solid');
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

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const dir = new THREE.DirectionalLight(0xffffff, 0.45);
dir.position.set(2, 3, 1.5);
scene.add(dir);

const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
camera.position.set(2.6, 2.0, 2.6);
camera.lookAt(0, 0.5, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.5, 0);

// ── helper: paint vertex colours on a geometry by sampling rho ─────────────
//   xyzFn maps a vertex index → math (x,y,z); useful when geometry positions
//   aren't already in math space.

function paintGeometry(geo, xyzFn) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const m = xyzFn(i, pos);
    const c = colorAt(m.x, m.y, m.z);
    colors[3 * i]     = c.r;
    colors[3 * i + 1] = c.g;
    colors[3 * i + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// ── outer cylinder side (semi-transparent) ─────────────────────────────────

{
  const segs = 64;
  const stacks = 24;
  // Three.js cylinder: y is the up axis. We want it standing 0..1 in three.y
  // (which is math z). Default CylinderGeometry sits centred at origin with
  // height extending along y; translate so its base is at y=0.
  const geo = new THREE.CylinderGeometry(1, 1, 1, segs, stacks, true);
  geo.translate(0, 0.5, 0);

  paintGeometry(geo, (i, pos) => {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    // math (x,y,z) ← three (x, -z, y)
    return { x: px, y: -pz, z: py };
  });

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, opacity: 0.45,
    roughness: 0.85, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));
}

// ── outer caps (top + bottom) ─────────────────────────────────────────────

function addCap(zMath, opacity) {
  const ring = 64;
  const radial = 18;
  // Build a disk by triangle-fan around centre. Three.js CircleGeometry would
  // work but we want enough radial subdivisions to colour the gradient.
  const verts = [];
  const indices = [];
  // index 0 = centre
  verts.push(0, 0, 0);
  for (let r = 1; r <= radial; r++) {
    const radius = r / radial;
    for (let s = 0; s < ring; s++) {
      const a = (s / ring) * Math.PI * 2;
      verts.push(radius * Math.cos(a), 0, radius * Math.sin(a));
    }
  }
  // Tris: centre to first ring
  for (let s = 0; s < ring; s++) {
    indices.push(0, 1 + s, 1 + ((s + 1) % ring));
  }
  for (let r = 1; r < radial; r++) {
    const inner = 1 + (r - 1) * ring;
    const outer = 1 + r * ring;
    for (let s = 0; s < ring; s++) {
      const s1 = (s + 1) % ring;
      indices.push(inner + s, outer + s,    outer + s1);
      indices.push(inner + s, outer + s1,   inner + s1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.translate(0, zMath, 0);   // raise the disk to its math-z (= three-y)

  paintGeometry(geo, (i, pos) => {
    const px = pos.getX(i), pz = pos.getZ(i);
    return { x: px, y: -pz, z: zMath };
  });

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: true, opacity,
    roughness: 0.8, side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(geo, mat));
}
addCap(0, 0.55);
addCap(1, 0.55);

// ── slice disk (rebuilt per slider tick) ──────────────────────────────────

let sliceMesh   = null;
let sliceLabel  = null;

function setSlice(z0) {
  if (sliceMesh) {
    scene.remove(sliceMesh);
    sliceMesh.geometry.dispose();
    sliceMesh.material.dispose();
    sliceMesh = null;
  }
  if (sliceLabel) {
    scene.remove(sliceLabel);
    sliceLabel.geometry.dispose();
    sliceLabel.material.dispose();
    sliceLabel = null;
  }

  const ring = 80, radial = 20;
  const verts = [];
  const indices = [];
  verts.push(0, 0, 0);
  for (let r = 1; r <= radial; r++) {
    const radius = r / radial;
    for (let s = 0; s < ring; s++) {
      const a = (s / ring) * Math.PI * 2;
      verts.push(radius * Math.cos(a), 0, radius * Math.sin(a));
    }
  }
  for (let s = 0; s < ring; s++) {
    indices.push(0, 1 + s, 1 + ((s + 1) % ring));
  }
  for (let r = 1; r < radial; r++) {
    const inner = 1 + (r - 1) * ring;
    const outer = 1 + r * ring;
    for (let s = 0; s < ring; s++) {
      const s1 = (s + 1) % ring;
      indices.push(inner + s, outer + s, outer + s1);
      indices.push(inner + s, outer + s1, inner + s1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  geo.translate(0, z0, 0);

  paintGeometry(geo, (i, pos) => {
    const px = pos.getX(i), pz = pos.getZ(i);
    return { x: px, y: -pz, z: z0 };
  });

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, transparent: false, opacity: 1.0,
    roughness: 0.6, side: THREE.DoubleSide,
  });
  sliceMesh = new THREE.Mesh(geo, mat);
  scene.add(sliceMesh);

  // Thin ring outline for the slice edge so it's visible against the body.
  {
    const pts = [];
    for (let s = 0; s <= ring; s++) {
      const a = (s / ring) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a), z0, Math.sin(a)));
    }
    const lg = new THREE.BufferGeometry().setFromPoints(pts);
    const lm = new THREE.LineBasicMaterial({ color: 0x111111 });
    sliceLabel = new THREE.Line(lg, lm);
    scene.add(sliceLabel);
  }
}

// ── axes + labels (math x, y, z) ──────────────────────────────────────────
// Three.js (x, y, z) ↔ math (x, z, -y) — so the math-y axis runs along
// three.-z. Endpoints below are chosen to match.

{
  const matAxis = new THREE.LineBasicMaterial({ color: 0x444444 });
  const seg = (a, b) =>
    new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), matAxis);
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.4, 0,  0)));    // math +x
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0,   0, -1.4)));  // math +y
  scene.add(seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0,   1.4, 0)));   // math +z

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
  tag('x', new THREE.Vector3(1.50, 0,    0));
  tag('y', new THREE.Vector3(0,    0,   -1.50));
  tag('z', new THREE.Vector3(0,    1.50, 0));
}

// ── HTML overlay ───────────────────────────────────────────────────────────

const strip = document.createElement('div');
strip.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:8px 12px;'
  + 'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;'
  + 'font:13px/1.2 -apple-system,sans-serif;color:#374151;'
  + 'display:flex;align-items:center;gap:10px;';
container.appendChild(strip);

strip.appendChild(document.createTextNode('切片 z ='));

const sliderEl = document.createElement('input');
sliderEl.type = 'range';
sliderEl.min = '0.05'; sliderEl.max = '0.95'; sliderEl.step = '0.01';
sliderEl.value = '0.5';
sliderEl.style.cssText = 'flex:1;min-width:0;';
strip.appendChild(sliderEl);

const labelEl = document.createElement('span');
labelEl.style.cssText = 'font-variant-numeric:tabular-nums;min-width:3em;';
strip.appendChild(labelEl);

function refresh() {
  const z = parseFloat(sliderEl.value);
  labelEl.textContent = z.toFixed(2);
  setSlice(z);
}
sliderEl.addEventListener('input', refresh);
refresh();

// ── resize + animate ──────────────────────────────────────────────────────

function resize() {
  const r = container.getBoundingClientRect();
  const stripH = strip.getBoundingClientRect().height;
  const w = r.width, h = Math.max(1, r.height - stripH);
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
