/**
 * chpt11-example12.js
 * Triple integral ∭_Ω x dV, where Ω is the tetrahedron bounded by
 *   the plane x + 2y + z = 1 and the three coordinate planes.
 *
 * Vertices:  O(0,0,0), A(1,0,0), B(0, 1/2, 0), C(0, 0, 1).
 * The interior is shown shaded by x-value (dark → light) so the weight
 * of the integrand x is visible. Result: ∭ x dV = 1/48.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,   math y → three.-z,   math z → three.y
 */

import * as THREE from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -my); }

const container = document.getElementById('chpt11-example12');
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
camera.position.set(2.1, 1.7, 2.3);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(V(0.3, 0.2, 0.3));
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance  = 1.0;
controls.maxDistance  = 9;

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.5);
sun.position.set(2, 6, 3);
scene.add(sun);

// ── tetrahedron vertices ─────────────────────────────────────────────────────

const O = { x:0, y:0,   z:0 };
const A = { x:1, y:0,   z:0 };
const B = { x:0, y:0.5, z:0 };
const C = { x:0, y:0,   z:1 };

// ── filled faces of the tetrahedron, coloured by x-value per vertex ─────────
// Darker orange at x=0, bright orange at x=1 → visualises integrand x.

function xColor(x) {
  // map x ∈ [0,1] → yellow→orange→red  (so the "weight" of the integrand is obvious)
  const c = new THREE.Color();
  const t = Math.max(0, Math.min(1, x));
  c.setHSL(0.10 - 0.10*t, 0.85, 0.55 - 0.12*t);   // 36°→0° hue, slightly darker as x grows
  return c;
}

function triMesh(p1, p2, p3, opacity = 0.65) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(9);
  const col = new Float32Array(9);
  [p1, p2, p3].forEach((p, i) => {
    const v = V(p.x, p.y, p.z);
    pos[3*i  ] = v.x; pos[3*i+1] = v.y; pos[3*i+2] = v.z;
    const c = xColor(p.x);
    col[3*i  ] = c.r; col[3*i+1] = c.g; col[3*i+2] = c.b;
  });
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    vertexColors: true, transparent: true, opacity,
    side: THREE.DoubleSide, shininess: 20, flatShading: false,
  }));
}

// 4 faces of the tetrahedron
scene.add(triMesh(O, A, B));           // z = 0   (bottom)
scene.add(triMesh(O, A, C));           // y = 0   (front)
scene.add(triMesh(O, B, C));           // x = 0   (left)
scene.add(triMesh(A, B, C, 0.80));     // slanted face, slightly more opaque

// ── edges (solid) ────────────────────────────────────────────────────────────

{
  const edgePts = [
    O,A, O,B, O,C,           // three axis-aligned edges from origin
    A,B, A,C, B,C,           // three edges on the slanted face
  ].map(p => V(p.x, p.y, p.z));
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(edgePts),
    new THREE.LineBasicMaterial({ color: 0x7c2d12 }),
  ));
}

// ── an x-constant slice (representative "slab") ──────────────────────────────
// At fixed x = x0, the cross-section is the triangle in (y,z) with
//   y ≥ 0, z ≥ 0, 2y + z ≤ 1 - x0.
// Draw this slice to show the meaning of ∭ f dV = ∫ (cross-section area · f) dx.

const X0 = 0.35;
{
  const c = 1 - X0;               // z-intercept at y=0
  const b = (1 - X0) / 2;         // y-intercept at z=0
  const p1 = V(X0, 0, 0);
  const p2 = V(X0, b, 0);
  const p3 = V(X0, 0, c);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(
    [p1.x,p1.y,p1.z, p2.x,p2.y,p2.z, p3.x,p3.y,p3.z], 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: 0x1d4ed8, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
  })));
  // slice outline
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([p1, p2, p3, p1]),
    new THREE.LineBasicMaterial({ color: 0x1e3a8a }),
  ));
}

// ── axes ─────────────────────────────────────────────────────────────────────

const AX = 1.25, axMat = new THREE.LineBasicMaterial({ color: 0x374151 });
function axis(a,b){ return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), axMat); }
scene.add(axis(V(0,0,0), V(AX,0,0)));
scene.add(axis(V(0,0,0), V(0,AX,0)));
scene.add(axis(V(0,0,0), V(0,0,AX)));

// ── labels ───────────────────────────────────────────────────────────────────

function ktx(tex, display=false) {
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

// tetrahedron vertex labels (math-style)
label(ktx('O'), V(-0.05, -0.05, 0), { color:'#6b7280', size:'11px' });
label(ktx('A\\,(1,0,0)'),       V(A.x+0.05, A.y-0.02, A.z), { color:'#7c2d12', size:'11px' });
label(ktx('B\\,(0,\\tfrac12,0)'), V(B.x-0.02, B.y+0.08, B.z), { color:'#7c2d12', size:'11px' });
label(ktx('C\\,(0,0,1)'),       V(C.x-0.02, C.y-0.02, C.z+0.05), { color:'#7c2d12', size:'11px' });

// slanted plane label
label(ktx('x + 2y + z = 1'),
      V(0.36, 0.18, 0.28), { color:'#1e3a8a', size:'11px' });

// slice label
label(ktx('x = '+X0.toFixed(2)),
      V(X0, 0.02, 0.65), { color:'#1d4ed8', size:'11px' });

// ── formula overlay ──────────────────────────────────────────────────────────

{
  const info = document.createElement('div');
  info.style.cssText = [
    'position:absolute','top:8px','left:10px','pointer-events:none',
    'background:rgba(255,255,255,0.92)','padding:4px 9px',
    'border-radius:4px','font-size:12px','max-width:90%',
  ].join(';');
  info.innerHTML = typeof katex !== 'undefined'
    ? '<div style="font-weight:600;color:#7c2d12">例12 &nbsp;四面体上的三重积分</div>' +
      katex.renderToString(
        '\\iiint_\\Omega x\\,dV = \\int_0^1\\!x\\!\\int_0^{\\tfrac{1-x}{2}}\\!\\int_0^{1-x-2y}\\!dz\\,dy\\,dx = \\tfrac{1}{48}',
        { displayMode: true, throwOnError: false })
    : '例12: ∭_Ω x dV = 1/48';
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
