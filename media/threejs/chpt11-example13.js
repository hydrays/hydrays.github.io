/**
 * chpt11-example13.js
 * Triple integral ∭_Ω z dV in cylindrical coordinates, where Ω is the
 * region bounded by the paraboloid z = x²+y² and the plane z = 4.
 *
 *   Projection onto xy-plane: disk of radius 2 (from z=4 ⇒ ρ² = 4).
 *   Element:  dV = ρ dρ dθ dz
 *   Result:   ∭ z dV = 64π/3.
 *
 * Highlighted: one representative cylindrical cell ρdρ dθ dz.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x,   math y → three.-z,   math z → three.y
 */

import * as THREE from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

function V(mx, my, mz) { return new THREE.Vector3(mx, mz ?? 0, -my); }

const container = document.getElementById('chpt11-example13');
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
camera.position.set(5.8, 5.2, 7.0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(V(0, 0, 2.0));
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance  = 3.0;
controls.maxDistance  = 30;

scene.add(new THREE.AmbientLight(0xffffff, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.55);
sun.position.set(6, 10, 6);
scene.add(sun);

// ── paraboloid side surface z = ρ², ρ ∈ [0, 2] ───────────────────────────────

{
  const NR = 40, NT = 80, verts = [];
  for (let it = 0; it < NT; it++) {
    for (let ir = 0; ir < NR; ir++) {
      const t0 = (it    /NT)*2*Math.PI;
      const t1 = ((it+1)/NT)*2*Math.PI;
      const r0 = (ir    /NR)*2;
      const r1 = ((ir+1)/NR)*2;
      const p = (r,t) => V(r*Math.cos(t), r*Math.sin(t), r*r);
      const a = p(r0,t0), b = p(r1,t0), c = p(r1,t1), d = p(r0,t1);
      verts.push(
        a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z,
        a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z,
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color: 0x38bdf8, transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, shininess: 40, specular: 0xbae6fd,
  })));
}

// ── top cap: disk at z = 4 ───────────────────────────────────────────────────

{
  const NR = 24, NT = 80, verts = [];
  for (let it = 0; it < NT; it++) {
    for (let ir = 0; ir < NR; ir++) {
      const t0 = (it    /NT)*2*Math.PI;
      const t1 = ((it+1)/NT)*2*Math.PI;
      const r0 = (ir    /NR)*2;
      const r1 = ((ir+1)/NR)*2;
      const p00 = V(r0*Math.cos(t0), r0*Math.sin(t0), 4);
      const p10 = V(r1*Math.cos(t0), r1*Math.sin(t0), 4);
      const p11 = V(r1*Math.cos(t1), r1*Math.sin(t1), 4);
      const p01 = V(r0*Math.cos(t1), r0*Math.sin(t1), 4);
      verts.push(
        p00.x,p00.y,p00.z, p10.x,p10.y,p10.z, p11.x,p11.y,p11.z,
        p00.x,p00.y,p00.z, p11.x,p11.y,p11.z, p01.x,p01.y,p01.z,
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color: 0x0ea5e9, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, shininess: 10,
  })));
}

// ── rim curves for clarity ───────────────────────────────────────────────────

{
  // top circle ρ = 2, z = 4
  const top = [], bot = [];
  const M = 120;
  for (let k = 0; k <= M; k++) {
    const t = (k/M)*2*Math.PI;
    top.push(V(2*Math.cos(t), 2*Math.sin(t), 4));
    bot.push(V(0, 0, 0));
  }
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(top),
    new THREE.LineBasicMaterial({ color: 0x0369a1 })
  ));
  // a few generatrices (vertical-ish curves along the paraboloid)
  const mat = new THREE.LineBasicMaterial({
    color: 0x0284c7, transparent: true, opacity: 0.55,
  });
  for (let k = 0; k < 12; k++) {
    const t = (k/12)*2*Math.PI;
    const pts = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const r = (i/N)*2;
      pts.push(V(r*Math.cos(t), r*Math.sin(t), r*r));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
  // a few level circles at z = const
  for (const z0 of [1, 2, 3]) {
    const r = Math.sqrt(z0);
    const pts = [];
    for (let k = 0; k <= M; k++) {
      const t = (k/M)*2*Math.PI;
      pts.push(V(r*Math.cos(t), r*Math.sin(t), z0));
    }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
}

// ── one representative cylindrical cell  ρ dρ dθ dz  ─────────────────────────

const R_IN = 0.9, R_OUT = 1.2;
const T0 = Math.PI * 0.15, T1 = Math.PI * 0.35;
const Z0 = 1.6, Z1 = 2.2;
{
  const verts = [];
  function quad(a,b,c,d) {
    verts.push(a.x,a.y,a.z, b.x,b.y,b.z, c.x,c.y,c.z);
    verts.push(a.x,a.y,a.z, c.x,c.y,c.z, d.x,d.y,d.z);
  }
  const M = 10;
  // inner + outer cylindrical surfaces
  for (let k = 0; k < M; k++) {
    const ta = T0 + (k  /M)*(T1-T0);
    const tb = T0 + ((k+1)/M)*(T1-T0);
    quad(
      V(R_IN *Math.cos(ta), R_IN *Math.sin(ta), Z0),
      V(R_IN *Math.cos(tb), R_IN *Math.sin(tb), Z0),
      V(R_IN *Math.cos(tb), R_IN *Math.sin(tb), Z1),
      V(R_IN *Math.cos(ta), R_IN *Math.sin(ta), Z1),
    );
    quad(
      V(R_OUT*Math.cos(ta), R_OUT*Math.sin(ta), Z0),
      V(R_OUT*Math.cos(tb), R_OUT*Math.sin(tb), Z0),
      V(R_OUT*Math.cos(tb), R_OUT*Math.sin(tb), Z1),
      V(R_OUT*Math.cos(ta), R_OUT*Math.sin(ta), Z1),
    );
  }
  // radial side walls at θ = T0 and θ = T1
  for (const t of [T0, T1]) {
    quad(
      V(R_IN *Math.cos(t), R_IN *Math.sin(t), Z0),
      V(R_OUT*Math.cos(t), R_OUT*Math.sin(t), Z0),
      V(R_OUT*Math.cos(t), R_OUT*Math.sin(t), Z1),
      V(R_IN *Math.cos(t), R_IN *Math.sin(t), Z1),
    );
  }
  // top + bottom
  for (const z of [Z0, Z1]) {
    for (let k = 0; k < M; k++) {
      const ta = T0 + (k  /M)*(T1-T0);
      const tb = T0 + ((k+1)/M)*(T1-T0);
      quad(
        V(R_IN *Math.cos(ta), R_IN *Math.sin(ta), z),
        V(R_OUT*Math.cos(ta), R_OUT*Math.sin(ta), z),
        V(R_OUT*Math.cos(tb), R_OUT*Math.sin(tb), z),
        V(R_IN *Math.cos(tb), R_IN *Math.sin(tb), z),
      );
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshPhongMaterial({
    color: 0xf59e0b, transparent: true, opacity: 0.85,
    side: THREE.DoubleSide, shininess: 30,
  })));
}

// ── axes ─────────────────────────────────────────────────────────────────────

const AX = 2.6, AZ = 4.6;
const axMat = new THREE.LineBasicMaterial({ color: 0x374151 });
function axis(a,b){ return new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]), axMat); }
scene.add(axis(V(-AX,0,0), V(AX,0,0)));
scene.add(axis(V(0,-AX,0), V(0,AX,0)));
scene.add(axis(V(0,0,0),   V(0,0,AZ)));

// tick marks / labels on z-axis
const tickMat = new THREE.LineBasicMaterial({ color: 0x6b7280 });
for (const z of [1,2,3,4]) {
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([V(-0.06,0,z), V(0.06,0,z)]),
    tickMat));
}

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

label(ktx('x'), V(AX+0.15, 0, 0));
label(ktx('y'), V(0, AX+0.15, 0));
label(ktx('z'), V(0, 0, AZ+0.15));
label(ktx('4'), V(0.12, 0, 4), { color:'#6b7280', size:'11px' });
label(ktx('2'), V(2, 0, -0.18), { color:'#6b7280', size:'11px' });

label(ktx('z = x^2 + y^2'),
      V(1.5, 1.3, 1.5*1.5 + 0.4), { color:'#0369a1', size:'11px' });
label(ktx('z = 4'),
      V(1.6, -1.6, 4.15), { color:'#0369a1', size:'11px' });

// cell annotation
const tC = (T0+T1)/2, rC = (R_IN+R_OUT)/2, zC = (Z0+Z1)/2;
label(ktx('\\rho\\,d\\rho\\,d\\theta\\,dz'),
      V(rC*Math.cos(tC) + 0.35, rC*Math.sin(tC) + 0.05, zC + 0.2),
      { color:'#b45309', size:'12px' });

// ── formula overlay ──────────────────────────────────────────────────────────

{
  const info = document.createElement('div');
  info.style.cssText = [
    'position:absolute','top:8px','left:10px','pointer-events:none',
    'background:rgba(255,255,255,0.92)','padding:4px 9px',
    'border-radius:4px','font-size:12px','max-width:90%',
  ].join(';');
  info.innerHTML = typeof katex !== 'undefined'
    ? '<div style="font-weight:600;color:#0369a1">例13 &nbsp;柱面坐标</div>' +
      katex.renderToString(
        '\\iiint_\\Omega z\\,dV = \\int_0^4\\!\\!\\int_0^{2\\pi}\\!\\!\\int_0^{\\sqrt z} z\\,\\rho\\,d\\rho\\,d\\theta\\,dz = \\tfrac{64\\pi}{3}',
        { displayMode: true, throwOnError: false })
    : '例13: ∭_Ω z dV = 64π/3';
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
