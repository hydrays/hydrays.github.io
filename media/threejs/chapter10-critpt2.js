// chapter10-critpt2.js
// Generalized critical-point visualization with Hessian rotation angle θ.
//
// f(x,y) = ½(λ₁(x cosθ + y sinθ)² + λ₂(-x sinθ + y cosθ)²)
//        = ½(A x² + 2B xy + C y²)
//
// The two eigenvectors e₁ = (cosθ, sinθ) and e₂ = (-sinθ, cosθ) are always
// PERPENDICULAR (Spectral Theorem — symmetric matrix). The θ slider rotates
// them away from the coordinate axes, giving a non-diagonal Hessian (B ≠ 0).
//
// Visual elements:
//   · 3D surface colored coolwarm by height (auto-normalized)
//   · Orange parabola on the surface along e₁ (curvature = λ₁)
//   · Blue  parabola on the surface along e₂ (curvature = λ₂)
//   · Orange / blue arrows on the xy-plane for e₁ / e₂
//   · A small right-angle marker at the origin between the two arrows
//   · KaTeX labels e₁, e₂ with λ values
//   · Static coordinate axes

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── math ──────────────────────────────────────────────────────────────────────
function computeABC(l1, l2, theta) {
  const c = Math.cos(theta), s = Math.sin(theta);
  return { A: l1*c*c + l2*s*s, B: (l1-l2)*c*s, C: l1*s*s + l2*c*c };
}
function fABC(x, y, {A, B, C}) { return 0.5*(A*x*x + 2*B*x*y + C*y*y); }

// ── Three.js coord map:  math(x,y,z) → Three(x, z*scale, -y) ─────────────────
function V(x, y, zmath, zvis) { return new THREE.Vector3(x, zmath*zvis, -y); }

// ── setup ─────────────────────────────────────────────────────────────────────
const container = document.getElementById('critpt2-3d');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0a0e1a, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(4.5, 3.5, 5.5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;

scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const dLight = new THREE.DirectionalLight(0xffffff, 0.9);
dLight.position.set(3, 7, 4);
scene.add(dLight);
const dLight2 = new THREE.DirectionalLight(0x8899ff, 0.3);
dLight2.position.set(-4, 2, -3);
scene.add(dLight2);

// ── Line helpers ──────────────────────────────────────────────────────────────
// Static materials (axes, never rebuilt) vs dynamic materials (rebuilt each
// frame). LineMaterial needs resolution set or it renders as a fullscreen quad.
const staticLineMats = [];
let dynLineMats = [];      // cleared + repopulated inside rebuild()

function mkLine(pts, color, lw, isStatic) {
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  const mat = new LineMaterial({ color, linewidth: lw || 2.0 });
  (isStatic ? staticLineMats : dynLineMats).push(mat);
  return new Line2(geo, mat);
}
function mkArrow(from, to, color, lw, hl, hr) {
  const dir = to.clone().sub(from).normalize();
  const headLen = hl || 0.20;
  const shaftEnd = to.clone().addScaledVector(dir, -headLen);
  const shaft = mkLine([from, shaftEnd], color, lw || 2.8);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(hr || 0.078, headLen, 16),
    new THREE.MeshPhongMaterial({ color, shininess: 60 })
  );
  head.position.copy(shaftEnd).addScaledVector(dir, headLen/2);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  const g = new THREE.Group(); g.add(shaft, head); return g;
}

// ── Static coordinate axes ────────────────────────────────────────────────────
const AX = 2.8, AC = 0xc8d0e0;
// Pass isStatic=true so these LineMaterials go into staticLineMats
function mkArrowStatic(from, to, color, lw, hl, hr) {
  const dir = to.clone().sub(from).normalize();
  const headLen = hl || 0.20;
  const shaftEnd = to.clone().addScaledVector(dir, -headLen);
  const shaft = mkLine([from, shaftEnd], color, lw || 2.8, true);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(hr || 0.078, headLen, 16),
    new THREE.MeshPhongMaterial({ color, shininess: 60 })
  );
  head.position.copy(shaftEnd).addScaledVector(dir, headLen/2);
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir);
  const g = new THREE.Group(); g.add(shaft, head); return g;
}
scene.add(mkArrowStatic(new THREE.Vector3(-AX,0,0), new THREE.Vector3(AX,0,0), AC, 2.0, 0.14, 0.055));
scene.add(mkArrowStatic(new THREE.Vector3(0,-AX,0), new THREE.Vector3(0,AX,0), AC, 2.0, 0.14, 0.055));
scene.add(mkArrowStatic(new THREE.Vector3(0,0,AX),  new THREE.Vector3(0,0,-AX), AC, 2.0, 0.14, 0.055));

// Axis tick marks on xz-plane (xz in Three.js = xy in math)
{
  const tp = [];
  for (const v of [-2,-1,1,2]) {
    tp.push(v,-0.06,0, v,0.06,0);
    tp.push(-0.06,v,0, 0.06,v,0);
    tp.push(0,-0.06,v, 0,0.06,v);
    tp.push(-0.06,0,v, 0.06,0,v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x444a60 })));
}

// Axis labels (static)
function mkStaticLabel(html, pos, color, size) {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.style.cssText = `color:${color||'#c0c8d8'};font-size:${size||13}px;font-style:italic;text-shadow:0 0 6px #000;pointer-events:none;`;
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  return o;
}
scene.add(mkStaticLabel('x', new THREE.Vector3(AX+0.2, 0, 0), '#c0c8d8', 13));
scene.add(mkStaticLabel('y', new THREE.Vector3(0, 0, -(AX+0.2)), '#c0c8d8', 13));
scene.add(mkStaticLabel('z', new THREE.Vector3(0, AX+0.2, 0), '#c0c8d8', 13));

// Critical point marker
scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.078, 20, 16),
  new THREE.MeshPhongMaterial({ color: 0xffee44, shininess: 100, emissive: 0x554400 })
));

// ── Dynamic group (rebuilt on each update) ────────────────────────────────────
const dynGroup = new THREE.Group();
scene.add(dynGroup);
let cssLabels = [];

// ── Colormap ──────────────────────────────────────────────────────────────────
function coolwarm(t) {
  t = Math.max(0, Math.min(1, t));
  if (t < 0.5) {
    const s = t*2;
    return [0.20+0.64*s, 0.28+0.56*s, 0.88-0.22*s];
  } else {
    const s = (t-0.5)*2;
    return [0.84+0.16*s, 0.84-0.70*s, 0.66-0.62*s];
  }
}

// ── Build all dynamic geometry ────────────────────────────────────────────────
const N = 50, RANGE = 2.25;

function rebuild(l1, l2, theta) {
  // Clear dynamic LineMaterial list FIRST (before creating new ones)
  dynLineMats = [];

  // Dispose & clear dynamic scene objects
  while (dynGroup.children.length) {
    const ch = dynGroup.children[0];
    ch.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose(); }
    });
    dynGroup.remove(ch);
  }
  for (const lbl of cssLabels) if (lbl.element?.parentNode) lbl.element.parentNode.removeChild(lbl.element);
  cssLabels = [];

  const abc = computeABC(l1, l2, theta);
  const c = Math.cos(theta), s = Math.sin(theta);

  // ── surface ────────────────────────────────────────────────────────────────
  const zArr = new Float32Array((N+1)*(N+1));
  for (let i=0; i<=N; i++) for (let j=0; j<=N; j++) {
    const x = -RANGE+2*RANGE*i/N, y = -RANGE+2*RANGE*j/N;
    zArr[i*(N+1)+j] = fABC(x, y, abc);
  }
  const zAll = Array.from(zArr);
  const zMin = Math.min(...zAll), zMax = Math.max(...zAll);
  const zSpan = Math.max(Math.max(Math.abs(zMin), Math.abs(zMax)), 0.001);
  const ZV = 1.8 / zSpan;   // visual z scale

  {
    const vs=[], cols=[], ix=[];
    for (let i=0; i<=N; i++) for (let j=0; j<=N; j++) {
      const x = -RANGE+2*RANGE*i/N, y = -RANGE+2*RANGE*j/N;
      const z = zArr[i*(N+1)+j];
      vs.push(x, z*ZV, -y);
      const [r,g,b] = coolwarm((z-zMin)/Math.max(zMax-zMin,0.001));
      cols.push(r, g, b);
    }
    for (let i=0; i<N; i++) for (let j=0; j<N; j++) {
      const a=i*(N+1)+j, b=a+1, cc=a+(N+1), d=cc+1;
      ix.push(a,b,d, a,d,cc);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vs,3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(cols,3));
    geo.setIndex(ix); geo.computeVertexNormals();
    dynGroup.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true, transparent: true, opacity: 0.72,
      side: THREE.DoubleSide, shininess: 40, depthWrite: false
    })));
  }

  // ── parabolic cross-section curves (lie exactly on the surface) ───────────
  const STEPS = 80;
  const pts1=[], pts2=[];
  for (let k=-STEPS; k<=STEPS; k++) {
    const t = k*RANGE/STEPS;
    // Along e1=(c,s): math(t·c, t·s, ½λ₁t²) → Three(t·c, ½λ₁t²·ZV, -t·s)
    pts1.push(new THREE.Vector3(t*c, 0.5*l1*t*t*ZV, -t*s));
    // Along e2=(-s,c): math(-t·s, t·c, ½λ₂t²) → Three(-t·s, ½λ₂t²·ZV, -t·c)
    pts2.push(new THREE.Vector3(-t*s, 0.5*l2*t*t*ZV, -t*c));
  }
  dynGroup.add(mkLine(pts1, 0xff7744, 4.0));   // e1: orange
  dynGroup.add(mkLine(pts2, 0x44aaff, 4.0));   // e2: blue

  // ── eigenvector arrows on the xy-plane (y=0 in Three.js = z=0 in math) ────
  // e1 in Three.js: (c, 0, -s)
  // e2 in Three.js: (-s, 0, -c)
  const ARR = 2.1;
  dynGroup.add(mkArrow(
    new THREE.Vector3(-ARR*c, 0,  ARR*s),
    new THREE.Vector3( ARR*c, 0, -ARR*s),
    0xff7744, 3.4, 0.22, 0.085));
  dynGroup.add(mkArrow(
    new THREE.Vector3( ARR*s, 0,  ARR*c),
    new THREE.Vector3(-ARR*s, 0, -ARR*c),
    0x44aaff, 3.4, 0.22, 0.085));

  // ── right-angle marker at origin (between e1 and e2 on xy-plane) ──────────
  {
    const SZ = 0.22;
    // Corner points of the right-angle box:
    //   O + SZ*e1_three + SZ*e2_three
    const e1t = new THREE.Vector3(c, 0, -s);
    const e2t = new THREE.Vector3(-s, 0, -c);
    const p1 = e1t.clone().multiplyScalar(SZ);
    const p2 = e1t.clone().multiplyScalar(SZ).add(e2t.clone().multiplyScalar(SZ));
    const p3 = e2t.clone().multiplyScalar(SZ);
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2, p3]);
    dynGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.5 })));
  }

  // ── Labels (plain HTML pill — no KaTeX to avoid layout bleed) ───────────────
  function mkLabel(html, pos, color) {
    const d = document.createElement('div');
    d.innerHTML = html;
    d.style.cssText = [
      'display:inline-block',
      'white-space:nowrap',
      `color:${color}`,
      'font-size:12px',
      'font-family:sans-serif',
      'background:rgba(10,14,26,0.82)',
      'padding:2px 7px',
      'border-radius:4px',
      'pointer-events:none',
      'line-height:1.4',
    ].join(';');
    const o = new CSS2DObject(d);
    o.position.copy(pos);
    dynGroup.add(o);
    cssLabels.push(o);
  }

  mkLabel(`<b>e\u2081</b> (\u03bb\u2081\u202f=\u202f${l1.toFixed(1)})`,
    new THREE.Vector3(ARR*c+0.08, 0.15, -ARR*s-0.05), '#ff9966');
  mkLabel(`<b>e\u2082</b> (\u03bb\u2082\u202f=\u202f${l2.toFixed(1)})`,
    new THREE.Vector3(-ARR*s-0.1, 0.15, -ARR*c-0.05), '#66ccff');

  // ── floor projection ring (ellipse of intersection at z=0 level) ──────────
  // For a quadratic form, the level curve f=k is an ellipse/hyperbola.
  // Draw the unit level curve |f|=0.3 projected onto floor (y=-1.85 in Three.js)
  const FLOOR = -1.9;
  {
    const contPts = [];
    const R2 = RANGE*RANGE;
    for (let k=0; k<=180; k++) {
      const alpha = k/180 * 2*Math.PI;
      // parametric: walk the circle r=RANGE*0.9 and project
      const r = RANGE * 0.88;
      const xm = r*Math.cos(alpha), ym = r*Math.sin(alpha);
      contPts.push(new THREE.Vector3(xm, FLOOR, -ym));
    }
    dynGroup.add(mkLine(contPts, 0x334466, 1.5));
  }

  // ── Set resolution on all newly created dynamic LineMaterials ─────────────
  // Must happen here (not just in resize) because resize() only fires on
  // container resize, not on rebuild. resolution=(0,0) → fullscreen quad bug.
  const w = container.clientWidth, h = container.clientHeight;
  for (const m of dynLineMats) m.resolution.set(w * devicePixelRatio, h * devicePixelRatio);
}

// ── initial state ─────────────────────────────────────────────────────────────
function readSliders() {
  return {
    l1:    parseFloat(document.getElementById('critpt2-l1')?.value    ?? 2),
    l2:    parseFloat(document.getElementById('critpt2-l2')?.value    ?? -1),
    theta: parseFloat(document.getElementById('critpt2-theta')?.value ?? 35) * Math.PI / 180
  };
}
{ const {l1,l2,theta} = readSliders(); rebuild(l1, l2, theta); }

window.addEventListener('critpt2-update', e => {
  rebuild(e.detail.l1, e.detail.l2, e.detail.theta);
});

// ── resize & loop ─────────────────────────────────────────────────────────────
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  for (const m of [...staticLineMats, ...dynLineMats])
    m.resolution.set(w * devicePixelRatio, h * devicePixelRatio);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
resize(); animate();
new ResizeObserver(resize).observe(container);
