/**
 * chpt11-example2.js
 * Geometric meaning of ∬_D (1 - x² - y²) dA,
 * D = { (x,y) : x² + y² ≤ 1, x > 0, y > 0 } (first-quadrant unit disk).
 *
 * Surface z = 1 - x² - y² is non-negative throughout D, so the integral
 * equals a pure volume: the solid under the quarter-paraboloid cap = π/8.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,   math y → three.-z,   math z → three.y
 */

import * as THREE from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

function f(x, y) { return 1 - x*x - y*y; }
function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -my); }

const container = document.getElementById('chpt11-example2');
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
controls.target.copy(V(0.4, 0.4, 0.35));
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance  = 1.2;
controls.maxDistance  = 9;

scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const sun = new THREE.DirectionalLight(0xffffff, 0.45);
sun.position.set(2, 6, 3);
scene.add(sun);

// ── quarter-paraboloid cap: polar parametrisation ρ ∈ [0,1], θ ∈ [0, π/2] ────

const NR = 50, NT = 50;
const capVerts = [];
for (let it = 0; it < NT; it++) {
  for (let ir = 0; ir < NR; ir++) {
    const t0 = (it / NT) * (Math.PI / 2);
    const t1 = ((it + 1) / NT) * (Math.PI / 2);
    const r0 = ir / NR, r1 = (ir + 1) / NR;
    const corners = [
      [r0 * Math.cos(t0), r0 * Math.sin(t0)],
      [r1 * Math.cos(t0), r1 * Math.sin(t0)],
      [r1 * Math.cos(t1), r1 * Math.sin(t1)],
      [r0 * Math.cos(t1), r0 * Math.sin(t1)],
    ].map(([x,y]) => V(x, y, f(x, y)));
    capVerts.push(
      corners[0].x,corners[0].y,corners[0].z,
      corners[1].x,corners[1].y,corners[1].z,
      corners[2].x,corners[2].y,corners[2].z,
      corners[0].x,corners[0].y,corners[0].z,
      corners[2].x,corners[2].y,corners[2].z,
      corners[3].x,corners[3].y,corners[3].z,
    );
  }
}
{
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(capVerts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color: 0x22c55e, transparent: true, opacity: 0.62,
    side: THREE.DoubleSide, shininess: 45,
    specular: new THREE.Color(0xbbf7d0),
  })));
}

// ── base quarter-disk on xy-plane ────────────────────────────────────────────

{
  const baseVerts = [];
  for (let it = 0; it < NT; it++) {
    for (let ir = 0; ir < NR; ir++) {
      const t0 = (it / NT) * (Math.PI / 2);
      const t1 = ((it + 1) / NT) * (Math.PI / 2);
      const r0 = ir / NR, r1 = (ir + 1) / NR;
      const p00 = V(r0*Math.cos(t0), r0*Math.sin(t0), 0);
      const p10 = V(r1*Math.cos(t0), r1*Math.sin(t0), 0);
      const p11 = V(r1*Math.cos(t1), r1*Math.sin(t1), 0);
      const p01 = V(r0*Math.cos(t1), r0*Math.sin(t1), 0);
      baseVerts.push(
        p00.x,p00.y,p00.z, p10.x,p10.y,p10.z, p11.x,p11.y,p11.z,
        p00.x,p00.y,p00.z, p11.x,p11.y,p11.z, p01.x,p01.y,p01.z,
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(baseVerts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: 0x86efac, transparent: true, opacity: 0.42, side: THREE.DoubleSide,
  })));
}

// ── curved side wall: cylindrical surface over the arc, from z=0 to z=0 ──────
// Along x²+y²=1 we have f=0, so only the two straight edges (x=0, y=0) need walls.

function edgeWall(edgeFn, color) {
  const M = 60, verts = [];
  for (let k = 0; k < M; k++) {
    const t0 = k / M, t1 = (k + 1) / M;
    const [x0, y0] = edgeFn(t0), [x1, y1] = edgeFn(t1);
    const z0 = f(x0, y0), z1 = f(x1, y1);
    const a = V(x0,y0,0), b = V(x1,y1,0);
    const c = V(x1,y1,z1), d = V(x0,y0,z0);
    verts.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z);
    verts.push(a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color, transparent: true, opacity: 0.22, side: THREE.DoubleSide,
  })));
}
edgeWall(t => [t,   0], 0x15803d);   // along y = 0,  x: 0 → 1
edgeWall(t => [0, 1-t], 0x15803d);   // along x = 0,  y: 1 → 0

// ── boundary curves ──────────────────────────────────────────────────────────

// base arc x²+y²=1 (z=0)
{
  const arcPts = [];
  for (let k = 0; k <= 80; k++) {
    const t = (k / 80) * (Math.PI / 2);
    arcPts.push(V(Math.cos(t), Math.sin(t), 0));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(arcPts),
    new THREE.LineBasicMaterial({ color: 0x0f766e })
  ));
}
// straight radial edges (x-axis and y-axis on xy-plane) are already the axes.
// rising edges along x-axis and y-axis (z=1-x² or 1-y²) — draw them for clarity
{
  const pts1 = [], pts2 = [];
  for (let k = 0; k <= 40; k++) {
    const t = k / 40;
    pts1.push(V(t, 0, 1 - t*t));
    pts2.push(V(0, t, 1 - t*t));
  }
  const mat = new THREE.LineBasicMaterial({ color: 0x166534 });
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), mat));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), mat));
}

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

label(ktx('D'), V(0.42, 0.42, 0), { color:'#0f766e' });
label(ktx('z = 1 - x^2 - y^2'), V(0.15, 0.15, f(0.15,0.15)+0.08),
      { color:'#15803d', size:'12px' });
label(ktx('x^2+y^2=1'), V(0.75, 0.75, 0.02),
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
    ? '<div style="font-weight:600;color:#0f766e">例2 &nbsp;四分之一圆域</div>' +
      katex.renderToString(
        '\\iint_D (1-x^2-y^2)\\,dA = \\tfrac{\\pi}{8}',
        { displayMode: true, throwOnError: false })
    : '例2: ∬_D (1-x²-y²) dA = π/8';
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
