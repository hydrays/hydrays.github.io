/**
 * chpt11-double-integral.js  (v2)
 * Interactive 3D illustration of the double integral as a Riemann sum.
 *
 * z = f(x,y) = 0.3 + 0.4x + 0.5y + 0.3xy  on  D = [0,1]×[0,1]
 * Surface increases in both x and y directions.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x   (right)
 *   math y → three.-z  (into screen)
 *   math z → three.y   (up)
 */

import * as THREE from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── math ──────────────────────────────────────────────────────────────────────

// Gentle Gaussian bump peaking at (0.5, 0.5): range ≈ [0.55, 1.10]
function f(x, y) {
  const dx = x - 0.5, dy = y - 0.5;
  return 0.45 + 0.65 * Math.exp(-2.5 * (dx*dx + dy*dy));
}

/** math (mx,my,mz) → THREE.Vector3 */
function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -my); }

// ── container ─────────────────────────────────────────────────────────────────

const container = document.getElementById('chpt11-double-integral');
container.style.position = 'relative';

// ── renderers ─────────────────────────────────────────────────────────────────

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xffffff, 1);
renderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText =
  'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
container.appendChild(labelRenderer.domElement);

// ── scene ─────────────────────────────────────────────────────────────────────

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

// ── camera ────────────────────────────────────────────────────────────────────

const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
// Position to see the surface rising toward far corner (1,1)
camera.position.set(2.0, 2.4, 3.0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(V(0.5, 0.5, 0.5));
controls.enableDamping  = true;
controls.dampingFactor  = 0.08;
controls.minDistance    = 1.2;
controls.maxDistance    = 9;

// ── lighting ──────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(2, 6, 3);
scene.add(sun);

// ── smooth surface ────────────────────────────────────────────────────────────

const RES = 60;
const sverts = [], sidx = [];
for (let iy = 0; iy <= RES; iy++) {
  for (let ix = 0; ix <= RES; ix++) {
    const mx = ix / RES, my = iy / RES;
    const p  = V(mx, my, f(mx, my));
    sverts.push(p.x, p.y, p.z);
  }
}
for (let iy = 0; iy < RES; iy++) {
  for (let ix = 0; ix < RES; ix++) {
    const a = iy*(RES+1)+ix, b = a+1, c = a+(RES+1), d = c+1;
    sidx.push(a,c,b, b,c,d);
  }
}
const surfGeo = new THREE.BufferGeometry();
surfGeo.setAttribute('position', new THREE.Float32BufferAttribute(sverts, 3));
surfGeo.setIndex(sidx);
surfGeo.computeVertexNormals();

scene.add(new THREE.Mesh(surfGeo, new THREE.MeshPhongMaterial({
  color: 0xf97316, transparent: true, opacity: 0.62,
  side: THREE.DoubleSide, shininess: 50,
  specular: new THREE.Color(0xffd580),
})));

// ── xy-plane: dashed grid with half the old step (8 × 8 divisions) ───────────

const GRID_N  = 8;            // 8 divisions → step = 0.125
const GRID_STEP = 1 / GRID_N;

const dashMat = new THREE.LineDashedMaterial({
  color: 0x9ca3af,            // gray-400
  dashSize: 0.04,
  gapSize:  0.025,
  linewidth: 1,
});

for (let k = 0; k <= GRID_N; k++) {
  const t = k * GRID_STEP;

  // line parallel to x-axis (constant y = t)
  const lg1 = new THREE.BufferGeometry().setFromPoints([V(0, t, 0), V(1, t, 0)]);
  const l1  = new THREE.Line(lg1, dashMat);
  l1.computeLineDistances();
  scene.add(l1);

  // line parallel to y-axis (constant x = t)
  const lg2 = new THREE.BufferGeometry().setFromPoints([V(t, 0, 0), V(t, 1, 0)]);
  const l2  = new THREE.Line(lg2, dashMat);
  l2.computeLineDistances();
  scene.add(l2);
}

// ── one representative pillar ─────────────────────────────────────────────────
// Choose grid cell (3, 3) (0-indexed) → x ∈ [0.375, 0.5], y ∈ [0.375, 0.5]

const P_IX = 3, P_IY = 3;          // grid indices
const px0 = P_IX * GRID_STEP,  px1 = px0 + GRID_STEP;
const py0 = P_IY * GRID_STEP,  py1 = py0 + GRID_STEP;
const pxc = (px0 + px1) / 2,   pyc = (py0 + py1) / 2;
const pzc = f(pxc, pyc);

// corners at base (z=0) and top (z=pzc)
const b00 = V(px0, py0, 0),  b10 = V(px1, py0, 0);
const b11 = V(px1, py1, 0),  b01 = V(px0, py1, 0);
const t00 = V(px0, py0, pzc), t10 = V(px1, py0, pzc);
const t11 = V(px1, py1, pzc), t01 = V(px0, py1, pzc);

// semi-transparent filled faces
const fillMat = new THREE.MeshPhongMaterial({
  color: 0x93c5fd, transparent: true, opacity: 0.45,
  side: THREE.DoubleSide,
});

const quads = [
  [b00, b10, b11, b01],   // bottom
  [t00, t10, t11, t01],   // top
  [b00, b10, t10, t00],   // front  (y = py0)
  [b01, b11, t11, t01],   // back   (y = py1)
  [b00, b01, t01, t00],   // left   (x = px0)
  [b10, b11, t11, t10],   // right  (x = px1)
];
for (const q of quads) {
  const v = q.flatMap(p => [p.x, p.y, p.z]);
  const arr = new Float32Array([
    v[0],v[1],v[2],  v[3],v[4],v[5],  v[6],v[7],v[8],
    v[0],v[1],v[2],  v[6],v[7],v[8],  v[9],v[10],v[11],
  ]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, fillMat));
}

// solid wireframe edges
const edgePts = [
  b00,b10, b10,b11, b11,b01, b01,b00,   // bottom rect
  t00,t10, t10,t11, t11,t01, t01,t00,   // top rect
  b00,t00, b10,t10, b11,t11, b01,t01,   // verticals
];
scene.add(new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints(edgePts),
  new THREE.LineBasicMaterial({ color: 0x1e40af }),
));

// dashed vertical centre line (height indicator)
const vlineGeo = new THREE.BufferGeometry().setFromPoints([V(pxc,pyc,0), V(pxc,pyc,pzc)]);
const vlineMat = new THREE.LineDashedMaterial({ color: 0x1e40af, dashSize:0.04, gapSize:0.025 });
const vline    = new THREE.Line(vlineGeo, vlineMat);
vline.computeLineDistances();
scene.add(vline);

// dot at top
const dot = new THREE.Mesh(
  new THREE.SphereGeometry(0.016, 8, 8),
  new THREE.MeshBasicMaterial({ color: 0x1e40af }),
);
dot.position.copy(V(pxc, pyc, pzc));
scene.add(dot);

// ── axes ──────────────────────────────────────────────────────────────────────

const AX = 1.3;
const axMat = new THREE.LineBasicMaterial({ color: 0x374151 });
function axis(a, b) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), axMat);
}
scene.add(axis(V(0,0,0), V(AX,0,0)));   // x
scene.add(axis(V(0,0,0), V(0,AX,0)));   // y (Three.js z)
scene.add(axis(V(0,0,0), V(0,0,AX)));   // z (height)

// ── CSS2D labels ──────────────────────────────────────────────────────────────

function ktx(tex, display = false) {
  return typeof katex !== 'undefined'
    ? katex.renderToString(tex, { displayMode: display, throwOnError: false })
    : `<i>${tex}</i>`;
}

function label(html, pos, { color='#1e293b', size='13px' } = {}) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.style.cssText = [
    `color:${color}`, `font-size:${size}`,
    'font-family:"STIX Two Math","Cambria Math","Times New Roman",serif',
    'white-space:nowrap', 'pointer-events:none', 'user-select:none',
    'text-shadow:0 0 4px #fff,0 0 4px #fff,0 0 4px #fff',
  ].join(';');
  const obj = new CSS2DObject(div);
  obj.position.copy(pos);
  scene.add(obj);
}

// axis labels
label(ktx('x'), V(AX+0.07, 0, 0));
label(ktx('y'), V(0, AX+0.07, 0));
label(ktx('z'), V(0, 0, AX+0.07));

// region D
label(ktx('D'), V(0.5, 1.12, 0), { color: '#374151' });

// surface label — near the peak
label(ktx('z = f(x,y)'), V(0.72, 0.28, f(0.72,0.28)+0.12), { color:'#c2410c', size:'12px' });

// pillar annotations
label(ktx('f(x_i,y_i)'), V(px1+0.06, pyc-0.04, pzc+0.06), { color:'#1e40af', size:'12px' });
label(ktx('\\Delta A'),   V(pxc,      pyc,       -0.10),    { color:'#374151', size:'12px' });

// ── formula overlay ───────────────────────────────────────────────────────────

{
  const info = document.createElement('div');
  info.style.cssText = [
    'position:absolute','top:10px','left:12px',
    'pointer-events:none',
    'background:rgba(255,255,255,0.88)',
    'padding:4px 10px','border-radius:4px',
  ].join(';');
  info.innerHTML = typeof katex !== 'undefined'
    ? katex.renderToString(
        'V \\approx \\displaystyle\\sum_{i=1}^{N} f(x_i,y_i)\\,\\Delta A',
        { displayMode: true, throwOnError: false })
    : 'V ≈ Σ f(xᵢ,yᵢ) ΔA';
  container.appendChild(info);
}

// ── resize ────────────────────────────────────────────────────────────────────

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}
new ResizeObserver(resize).observe(container);
resize();

// ── render loop ───────────────────────────────────────────────────────────────

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
})();
