/**
 * chpt11-example1.js
 * Geometric meaning of ∬_D (1 - x² - y²) dA, D = [0,1]×[0,1].
 *
 * Surface z = 1 - x² - y² over the unit square.
 * Positive region (above xy-plane): quarter disk x²+y² < 1 → green.
 * Negative region: corner near (1,1) → red (shown dipping below z=0).
 * Signed volume under the surface equals the integral = 1/3.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,   math y → three.-z,   math z → three.y
 */

import * as THREE from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

function f(x, y) { return 1 - x*x - y*y; }
function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -my); }

const container = document.getElementById('chpt11-example1');
container.style.position = 'relative';

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

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
camera.position.set(2.1, 1.9, 2.6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(V(0.5, 0.5, 0.2));
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance  = 1.2;
controls.maxDistance  = 9;

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.45);
sun.position.set(2, 6, 3);
scene.add(sun);

// ── surface z = 1 - x² - y² over D = [0,1]², coloured by sign ────────────────

const RES = 80;
const posVerts = [], posIdx = [], negVerts = [], negIdx = [];
// Build separate meshes for z ≥ 0 and z < 0 by classifying triangles.
const gridZ = [];
for (let iy = 0; iy <= RES; iy++) {
  const row = [];
  for (let ix = 0; ix <= RES; ix++) {
    const mx = ix / RES, my = iy / RES;
    row.push({ x: mx, y: my, z: f(mx, my) });
  }
  gridZ.push(row);
}
function push(list, p) { list.push(p.x, p.y, p.z); }
for (let iy = 0; iy < RES; iy++) {
  for (let ix = 0; ix < RES; ix++) {
    const P = [gridZ[iy][ix], gridZ[iy][ix+1], gridZ[iy+1][ix+1], gridZ[iy+1][ix]];
    for (const tri of [[P[0],P[1],P[2]], [P[0],P[2],P[3]]]) {
      const avg = (tri[0].z + tri[1].z + tri[2].z) / 3;
      const bucket = avg >= 0 ? posVerts : negVerts;
      for (const q of tri) {
        const v = V(q.x, q.y, q.z);
        bucket.push(v.x, v.y, v.z);
      }
    }
  }
}

function makeSurf(verts, color) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color, transparent: true, opacity: 0.60,
    side: THREE.DoubleSide, shininess: 40,
  }));
}
scene.add(makeSurf(posVerts, 0x22c55e));   // green above
scene.add(makeSurf(negVerts, 0xef4444));   // red  below

// ── base square on xy-plane, split into + and - halves along unit circle ─────

const squarePos = [], squareNeg = [];
for (let iy = 0; iy < RES; iy++) {
  for (let ix = 0; ix < RES; ix++) {
    const x0 = ix/RES, x1 = (ix+1)/RES, y0 = iy/RES, y1 = (iy+1)/RES;
    const cx = (x0+x1)/2, cy = (y0+y1)/2;
    const inside = (cx*cx + cy*cy) <= 1;
    const tgt = inside ? squarePos : squareNeg;
    const p00 = V(x0,y0,0), p10 = V(x1,y0,0), p11 = V(x1,y1,0), p01 = V(x0,y1,0);
    tgt.push(p00.x,p00.y,p00.z, p10.x,p10.y,p10.z, p11.x,p11.y,p11.z);
    tgt.push(p00.x,p00.y,p00.z, p11.x,p11.y,p11.z, p01.x,p01.y,p01.z);
  }
}
function basePatch(verts, color, opacity) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide,
  }));
}
scene.add(basePatch(squarePos, 0x86efac, 0.35));   // light green inside unit circle
scene.add(basePatch(squareNeg, 0xfca5a5, 0.35));   // light red outside unit circle

// ── unit-circle arc on xy-plane (dividing line f = 0) ────────────────────────

{
  const arcPts = [];
  const N = 80;
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * (Math.PI / 2);
    arcPts.push(V(Math.cos(t), Math.sin(t), 0));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(arcPts),
    new THREE.LineBasicMaterial({ color: 0x0f766e })
  ));
}

// ── square boundary (solid) ──────────────────────────────────────────────────

{
  const pts = [V(0,0,0), V(1,0,0), V(1,1,0), V(0,1,0), V(0,0,0)];
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineBasicMaterial({ color: 0x1e3a8a, linewidth: 2 })
  ));
}

// ── vertical walls along the four edges of the square (base → surface) ──────

function wallStrip(edgeFn, color) {
  const M = 60;
  const verts = [];
  for (let k = 0; k < M; k++) {
    const t0 = k / M, t1 = (k + 1) / M;
    const [x0, y0] = edgeFn(t0), [x1, y1] = edgeFn(t1);
    const z0 = f(x0, y0),       z1 = f(x1, y1);
    const a = V(x0,y0,0),  b = V(x1,y1,0);
    const c = V(x1,y1,z1), d = V(x0,y0,z0);
    verts.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z);
    verts.push(a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color, transparent: true, opacity: 0.18, side: THREE.DoubleSide,
  })));
}
wallStrip(t => [t,   0  ], 0x1e3a8a);   // y = 0
wallStrip(t => [1,   t  ], 0x1e3a8a);   // x = 1
wallStrip(t => [1-t, 1  ], 0x1e3a8a);   // y = 1  (reverse)
wallStrip(t => [0,   1-t], 0x1e3a8a);   // x = 0

// ── axes ─────────────────────────────────────────────────────────────────────

const AX = 1.35, axMat = new THREE.LineBasicMaterial({ color: 0x374151 });
function axis(a, b) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), axMat);
}
scene.add(axis(V(0,0,0), V(AX,0,0)));
scene.add(axis(V(0,0,0), V(0,AX,0)));
scene.add(axis(V(0,0,0), V(0,0,AX)));

// ── labels ───────────────────────────────────────────────────────────────────

function ktx(tex, display = false) {
  return typeof katex !== 'undefined'
    ? katex.renderToString(tex, { displayMode: display, throwOnError: false })
    : `<i>${tex}</i>`;
}
function label(html, pos, { color='#1e293b', size='12px' } = {}) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.style.cssText = [
    `color:${color}`, `font-size:${size}`,
    'font-family:"STIX Two Math","Cambria Math","Times New Roman",serif',
    'white-space:nowrap', 'pointer-events:none', 'user-select:none',
    'text-shadow:0 0 4px #fff,0 0 4px #fff,0 0 4px #fff',
  ].join(';');
  const obj = new CSS2DObject(div); obj.position.copy(pos); scene.add(obj);
}

label(ktx('x'), V(AX+0.07, 0, 0));
label(ktx('y'), V(0, AX+0.07, 0));
label(ktx('z'), V(0, 0, AX+0.07));
label(ktx('1'), V(1, -0.05, 0), { color:'#6b7280', size:'11px' });
label(ktx('1'), V(-0.05, 1, 0), { color:'#6b7280', size:'11px' });
label(ktx('1'), V(0, 0, 1.02),  { color:'#6b7280', size:'11px' });

label(ktx('D'), V(0.5, 0.5, 0), { color:'#1e3a8a' });
label(ktx('z = 1 - x^2 - y^2'), V(0.15, 0.15, f(0.15,0.15)+0.08),
      { color:'#15803d', size:'12px' });
label(ktx('f<0'), V(0.92, 0.92, f(0.92,0.92)-0.05),
      { color:'#b91c1c', size:'12px' });
label(ktx('x^2+y^2=1'), V(0.72, 0.72, 0.02),
      { color:'#0f766e', size:'11px' });

// ── formula overlay ──────────────────────────────────────────────────────────

{
  const info = document.createElement('div');
  info.style.cssText = [
    'position:absolute','top:8px','left:10px','pointer-events:none',
    'background:rgba(255,255,255,0.90)','padding:4px 9px',
    'border-radius:4px','font-size:12px',
  ].join(';');
  info.innerHTML = typeof katex !== 'undefined'
    ? '<div style="font-weight:600;color:#1e3a8a">例1 &nbsp;矩形域</div>' +
      katex.renderToString(
        '\\iint_D (1-x^2-y^2)\\,dA = \\tfrac{1}{3}',
        { displayMode: true, throwOnError: false })
    : '例1: ∬_D (1-x²-y²) dA = 1/3';
  container.appendChild(info);
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h); labelRenderer.setSize(w, h);
}
new ResizeObserver(resize).observe(container);
resize();

(function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
})();
