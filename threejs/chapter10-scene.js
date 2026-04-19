import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// ── surface: z = f(x,y) = -0.3x²-0.4y²+1.6x+2.8y-2.7 ─────────────────────
// f(1,1)=1, ∂f/∂x|(1,1)=1, ∂f/∂y|(1,1)=2  (concave)
function f(x, y) { return -0.3*x*x - 0.4*y*y + 1.6*x + 2.8*y - 2.7; }
const Z_SCALE = 2;
const Z_SHIFT = 1;
function zView(z) { return z / Z_SCALE; }
function zGraph(z) { return zView(z + Z_SHIFT); }

// Coordinate map  Manim(x,y,z) → Three.js(x, z, -y)
// x:same  y_manim(into screen)→-z_three  z_manim(up)→y_three
function V(mx, my, mz) { return new THREE.Vector3(mx, zView(mz), -my); }

// ── renderer ─────────────────────────────────────────────────────────────────
const container = document.getElementById('grad3d');

// ── build UI bar entirely from JS (avoids Pandoc escaping nested HTML) ────────
const ui = document.createElement('div');
ui.style.cssText = 'position:absolute;bottom:12px;left:0;right:0;display:flex;align-items:center;justify-content:center;gap:12px;z-index:20;';
const btnStyle = 'background:#22314a;color:#d5dbe7;border:1px solid rgba(255,255,255,0.14);padding:4px 16px;border-radius:4px;cursor:pointer;font-size:13px;font-family:sans-serif;';
const btnPrev = document.createElement('button'); btnPrev.textContent = '◀'; btnPrev.style.cssText = btnStyle;
const phaseLabel = document.createElement('span'); phaseLabel.style.cssText = 'color:#999;font-size:13px;font-family:sans-serif;min-width:140px;text-align:center;';
const btnNext = document.createElement('button'); btnNext.textContent = '下一步 ▶'; btnNext.style.cssText = btnStyle;
ui.append(btnPrev, phaseLabel, btnNext);
container.appendChild(ui);

const sideNote = document.createElement('div');
sideNote.style.cssText = 'position:absolute;top:14px;right:14px;width:28%;min-width:180px;padding:8px 10px;background:rgba(18,30,49,0.72);border:1px solid rgba(255,255,255,0.10);border-radius:8px;color:#f2f2f2;font-size:10px;line-height:1.28;z-index:18;pointer-events:none;display:none;';
container.appendChild(sideNote);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0B6E4F, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
container.insertBefore(labelRenderer.domElement, ui);

// ── scene & camera ───────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(5.2, 3.5, 6.9);

const controls = new OrbitControls(camera, renderer.domElement);
// Default framing favors the local tangent-plane picture near P.
controls.target.set(1.65, zGraph(1.05), -1.2);
controls.enableDamping = true;
controls.dampingFactor = 0.07;

// ── lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const dLight = new THREE.DirectionalLight(0xffffff, 0.75);
dLight.position.set(4, 8, 4);
scene.add(dLight);

// ── shared helpers ────────────────────────────────────────────────────────────
const lineMaterials = [];
const screenAlignedUpdaters = [];
function mkLine(pts, color, linewidth) {
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
  const mat = new LineMaterial({
    color,
    linewidth: linewidth || 3.0
  });
  lineMaterials.push(mat);
  return new Line2(geo, mat);
}
function mkDottedLine(pts, color, size, step) {
  const dots = [];
  const spacing = step || 0.085;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.ceil(len / spacing));
    for (let j = i === 0 ? 0 : 1; j <= n; j++) {
      dots.push(a.clone().lerp(b, j / n));
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(dots);
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color,
    size: size || 0.038,
    sizeAttenuation: true
  }));
}
function mkArrow(start, end, color, linewidth, headLength, headRadius) {
  const dir = end.clone().sub(start);
  const unit = dir.clone().normalize();
  const shaftEnd = end.clone().addScaledVector(unit, -headLength);
  const shaft = mkLine([start, shaftEnd], color, linewidth || 4.4);
  const head = new THREE.Mesh(
    new THREE.ConeGeometry(headRadius || 0.10, headLength || 0.22, 18),
    new THREE.MeshPhongMaterial({ color, shininess: 60 })
  );
  head.position.copy(shaftEnd.clone().addScaledVector(unit, (headLength || 0.22) / 2));
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
  const g = new THREE.Group();
  g.add(shaft, head);
  return g;
}
function makeTriangleTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.beginPath();
  ctx.moveTo(64, 10);
  ctx.lineTo(112, 112);
  ctx.lineTo(16, 112);
  ctx.closePath();
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}
function mkFlatArrow(start, end, color, linewidth, headLength, headWidth) {
  const dir = end.clone().sub(start);
  const unit = dir.clone().normalize();
  const shaftEnd = end.clone().addScaledVector(unit, -(headLength || 0.24) * 0.72);
  const shaft = mkLine([start, shaftEnd], color, linewidth || 3.8);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeTriangleTexture(color),
    transparent: true,
    depthWrite: false
  }));
  sprite.position.copy(shaftEnd.clone().addScaledVector(unit, (headLength || 0.24) * 0.36));
  sprite.scale.set(headWidth || 0.20, headLength || 0.24, 1);
  screenAlignedUpdaters.push(() => {
    const a = start.clone().project(camera);
    const b = end.clone().project(camera);
    const angle = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
    sprite.material.rotation = angle;
  });
  const g = new THREE.Group();
  g.add(shaft, sprite);
  return g;
}
function mkSphere(pos, color, r) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r || 0.065, 16, 12),
    new THREE.MeshPhongMaterial({ color, shininess: 60 })
  );
  m.position.copy(pos); return m;
}
function mathHTML(tex, displayMode) {
  if (window.katex && typeof window.katex.renderToString === 'function') {
    return window.katex.renderToString(tex, { throwOnError: false, displayMode: !!displayMode });
  }
  return tex;
}
function mkLabel(html, pos, color) {
  const d = document.createElement('div');
  d.innerHTML = html;
  d.style.cssText = 'color:' + (color||'#ccc') + ';font:italic 14px serif;text-shadow:0 0 5px #000;pointer-events:none;';
  const o = new CSS2DObject(d); o.position.copy(pos); return o;
}
function mkMathLabel(tex, pos, color, fontSize) {
  const d = document.createElement('div');
  d.innerHTML = mathHTML(tex, false);
  d.style.cssText = 'color:' + (color||'#f2f2f2') + ';font-size:' + (fontSize || 13) + 'px;text-shadow:0 0 5px #000;pointer-events:none;';
  const o = new CSS2DObject(d); o.position.copy(pos); return o;
}
function setTreeVisible(obj, visible) {
  obj.visible = visible;
  obj.traverse((child) => {
    child.visible = visible;
    if (child.isCSS2DObject && child.element) {
      child.element.style.display = visible ? '' : 'none';
    }
  });
}
function mkPlane(w, h, color, ry) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false })
  );
  if (ry) m.rotation.y = ry;
  return m;
}
function mkPatch(verts, inds) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(inds); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0xddaa22, transparent: true, opacity: 0.40,
    side: THREE.DoubleSide, depthWrite: false, shininess: 20
  }));
}

// ── axes ─────────────────────────────────────────────────────────────────────
const AC = 0xf2f2f2;
scene.add(mkArrow(new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(3.3, 0, 0), AC, 3.2, 0.14, 0.06));
scene.add(mkArrow(new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(0, zView(4.7), 0), AC, 3.2, 0.14, 0.06));
scene.add(mkArrow(new THREE.Vector3(0, 0, 0.1), new THREE.Vector3(0, 0, -3.3), AC, 3.2, 0.14, 0.06));
const axisLabelGroup = new THREE.Group();
axisLabelGroup.add(mkLabel('x', new THREE.Vector3(3.55, 0, 0)));
axisLabelGroup.add(mkLabel('z', new THREE.Vector3(0, zView(4.95), 0)));
axisLabelGroup.add(mkLabel('y', new THREE.Vector3(0, 0, -3.55)));
scene.add(axisLabelGroup);

// ── surface (gray transparent) ────────────────────────────────────────────────
{
  const N=30, vs=[], ix=[];
  for (let i=0; i<=N; i++) for (let j=0; j<=N; j++) {
    const x=2.85*i/N, y=2.85*j/N; vs.push(x, zGraph(f(x,y)), -y);
  }
  for (let i=0; i<N; i++) for (let j=0; j<N; j++) {
    const a=i*(N+1)+j, b=a+1, c=a+(N+1), d=c+1;
    ix.push(a,b,d, a,d,c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  geo.setIndex(ix); geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0x334a9f, transparent: true, opacity: 0.36,
    side: THREE.DoubleSide, depthWrite: false, shininess: 30
  })));
}

// ── base point and its lifted point on the shifted surface ────────────────────
const P0 = V(1,1,0);
const Q0 = V(1,1,1 + Z_SHIFT);
scene.add(mkSphere(Q0, 0xffff00, 0.039));
scene.add(mkSphere(P0, 0xffff66, 0.056));
scene.add(mkDottedLine([P0, Q0], 0xffff00, 0.042, 0.07));
const grp0 = new THREE.Group();
grp0.add(mkMathLabel('P_0', P0.clone().add(new THREE.Vector3(-0.18, -0.04, 0.06)), '#fff2a8'));
grp0.add(mkMathLabel('Q_0', Q0.clone().add(new THREE.Vector3(-0.16, 0.12, 0.06)), '#fff799'));
scene.add(grp0);

// ── Phase 1 — ∂z/∂x: cut y_manim=1  →  z_three=-1 ──────────────────────────
// Plane ∥ xOz_manim; orange; covers x∈[0,2.85], z_manim∈[-0.8,4.2]
const grp1 = new THREE.Group();
let cutPlaneX = null;
{
  cutPlaneX = mkPlane(2.85, zView(5.0), 0xff8800);
  cutPlaneX.position.set(1.425, zGraph(1.7), -1.0);   // no rotation: PlaneGeometry default lies in xOy_three
  grp1.add(cutPlaneX);
}
{ // intersection curve  (t, f(t,1), -1)
  const pts = [];
  for (let t=0; t<=2.85; t+=0.04) pts.push(new THREE.Vector3(t, zGraph(f(t,1.0)), -1.0));
  grp1.add(mkLine(pts, 0xff8800));
}
const DX = 1.10;
const Q1 = V(1 + DX, 1, 1 + DX + Z_SHIFT);
const H1 = V(1 + DX, 1, 1 + Z_SHIFT);
grp1.add(mkSphere(Q1, 0xffffff, 0.039));
grp1.add(mkFlatArrow(Q0.clone(), Q1.clone(), 0xfff4c2, 3.6, 0.20, 0.18));
grp1.add(mkDottedLine([Q0, H1], 0xffffff, 0.040, 0.08));
grp1.add(mkDottedLine([H1, Q1], 0xffffff, 0.040, 0.08));
grp1.add(mkMathLabel('P_0', P0.clone().add(new THREE.Vector3(-0.18, -0.04, 0.06)), '#fff2a8'));
grp1.add(mkMathLabel('Q_0', Q0.clone().add(new THREE.Vector3(-0.16, 0.12, 0.06)), '#fff799'));
grp1.add(mkMathLabel('Q_1', Q1.clone().add(new THREE.Vector3(0.16, 0.12, 0.02)), '#ffffff'));
grp1.add(mkMathLabel('\\mathbf{u}', Q0.clone().lerp(Q1, 0.56).add(new THREE.Vector3(0.10, 0.10, 0.06)), '#fff4c2', 18));
grp1.add(mkMathLabel('\\Delta x', Q0.clone().lerp(H1, 0.5).add(new THREE.Vector3(0, 0.08, 0.12)), '#ffffff'));
grp1.add(mkMathLabel('\\frac{\\partial z}{\\partial x}\\,\\Delta x', H1.clone().lerp(Q1, 0.5).add(new THREE.Vector3(0.18, 0.02, 0)), '#ffffff'));
setTreeVisible(grp1, false);
scene.add(grp1);

// ── Phase 2 — ∂z/∂y: cut x_manim=1  →  x_three=1 ───────────────────────────
// Plane ∥ yOz_manim; purple; covers y_manim∈[0,2.85], z_manim∈[-0.8,4.2]
const grp2 = new THREE.Group();
let cutPlaneY = null;
{
  cutPlaneY = mkPlane(2.85, zView(5.0), 0xaa44cc, Math.PI/2);
  cutPlaneY.position.set(1.0, zGraph(1.7), -1.425);   // rotation.y=π/2: width now spans z_three∈[-2.85,0]
  grp2.add(cutPlaneY);
}
{ // intersection curve  (1, f(1,t), -t)
  const pts = [];
  for (let t=0.3; t<=2.85; t+=0.04) pts.push(new THREE.Vector3(1.0, zGraph(f(1.0,t)), -t));
  grp2.add(mkLine(pts, 0xaa44cc));
}
const DY = DX;
const Q2 = V(1, 1 + DY, 1 + 2*DY + Z_SHIFT);
const H2 = V(1, 1 + DY, 1 + Z_SHIFT);
grp2.add(mkSphere(Q2, 0xffffff, 0.039));
grp2.add(mkFlatArrow(Q0.clone(), Q2.clone(), 0xf4dcff, 3.6, 0.20, 0.18));
grp2.add(mkDottedLine([Q0, H2], 0xffffff, 0.040, 0.08));
grp2.add(mkDottedLine([H2, Q2], 0xffffff, 0.040, 0.08));
grp2.add(mkMathLabel('P_0', P0.clone().add(new THREE.Vector3(-0.18, -0.04, 0.06)), '#fff2a8'));
grp2.add(mkMathLabel('Q_0', Q0.clone().add(new THREE.Vector3(-0.16, 0.12, 0.06)), '#fff799'));
grp2.add(mkMathLabel('Q_2', Q2.clone().add(new THREE.Vector3(0.14, 0.12, -0.10)), '#ffffff'));
grp2.add(mkMathLabel('\\mathbf{v}', Q0.clone().lerp(Q2, 0.58).add(new THREE.Vector3(0.10, 0.10, -0.06)), '#f4dcff', 18));
grp2.add(mkMathLabel('\\Delta y', Q0.clone().lerp(H2, 0.5).add(new THREE.Vector3(0.12, 0.10, -0.03)), '#ffffff'));
grp2.add(mkMathLabel('\\frac{\\partial z}{\\partial y}\\,\\Delta y', H2.clone().lerp(Q2, 0.5).add(new THREE.Vector3(0.18, 0.02, 0)), '#ffffff'));
setTreeVisible(grp2, false);
scene.add(grp2);

// ── Phase 3 — tangent patch ─────────────────────────────────────────────────
const grp3 = new THREE.Group();
// Tangent patch enlarged to cover the longer u and v increments.
// Manim(1+u,1+v,2+u+2v) → Three.js(1+u, zGraph(1+u+2v), -(1+v))
{
  const M=10, vs=[], ix=[];
  for (let i=0; i<=M; i++) for (let j=0; j<=M; j++) {
    const u=-0.8+2.0*i/M, v=-0.8+2.0*j/M;
    vs.push(1+u, zGraph(1+u+2*v), -(1+v));
  }
  for (let i=0; i<M; i++) for (let j=0; j<M; j++) {
    const a=i*(M+1)+j, b=a+1, c=a+(M+1), d=c+1;
    ix.push(a,b,d, a,d,c);
  }
  grp3.add(mkPatch(vs, ix));
}
setTreeVisible(grp3, false);
scene.add(grp3);

// ── Phase 4 — parallelogram on the tangent plane ────────────────────────────
const grp4 = new THREE.Group();
const Uvec = Q1.clone().sub(Q0);
const Vvec = Q2.clone().sub(Q0);
const Q3 = Q2.clone().add(Uvec);
const R3 = V(1 + DX, 1 + DY, f(1 + DX, 1 + DY) + Z_SHIFT);
const P3 = V(1 + DX, 1 + DY, 0);
grp4.add(mkSphere(Q3, 0xd8fff6, 0.043));
grp4.add(mkSphere(R3, 0x8affae, 0.040));
grp4.add(mkSphere(P3, 0x9fe7ff, 0.036));
grp4.add(mkFlatArrow(Q2.clone(), Q3.clone(), 0xfff4c2, 3.4, 0.20, 0.18));
grp4.add(mkFlatArrow(Q1.clone(), Q3.clone(), 0xf4dcff, 3.4, 0.20, 0.18));
grp4.add(mkFlatArrow(Q0.clone(), Q3.clone(), 0xa8fff5, 3.8, 0.22, 0.19));
grp4.add(mkDottedLine([Q3, P3], 0xbaffca, 0.040, 0.08));
grp4.add(mkMathLabel('\\mathbf{w}', Q0.clone().lerp(Q3, 0.57).add(new THREE.Vector3(0.14, 0.14, 0.01)), '#a8fff5', 18));
grp4.add(mkMathLabel('Q_3', Q3.clone().add(new THREE.Vector3(0.14, 0.13, -0.08)), '#d8fff6'));
grp4.add(mkMathLabel('R', R3.clone().add(new THREE.Vector3(0.10, -0.08, -0.08)), '#8affae'));
grp4.add(mkMathLabel('P', P3.clone().add(new THREE.Vector3(0.10, -0.08, -0.08)), '#9fe7ff'));
setTreeVisible(grp4, false);
scene.add(grp4);

// ── phase control ─────────────────────────────────────────────────────────────
const LABELS = ['曲面与点 P', '偏导数 ∂z/∂x', '偏导数 ∂z/∂y', '切平面', '平行四边形'];
let phase = 0;
function setPhase(p) {
  phase = Math.max(0, Math.min(4, p));
  setTreeVisible(axisLabelGroup, phase !== 0);
  setTreeVisible(grp0, phase === 0);
  setTreeVisible(grp1, phase >= 1);
  setTreeVisible(grp2, phase >= 2);
  setTreeVisible(grp3, phase >= 3);
  setTreeVisible(grp4, phase === 4);
  if (cutPlaneX) cutPlaneX.visible = phase === 1 || phase === 2;
  if (cutPlaneY) cutPlaneY.visible = phase === 2;
  sideNote.style.display = 'block';
  sideNote.style.fontSize = phase === 4 ? '9px' : '10px';
  sideNote.style.lineHeight = phase === 4 ? '1.22' : '1.28';
  if (phase === 0) {
    sideNote.innerHTML =
      '<div style="margin-bottom:3px;">' + mathHTML('P_0=(x_0,y_0)', false) + '</div>' +
      '<div>' + mathHTML('Q_0=(x_0,y_0,z_0)', false) + '</div>';
  } else if (phase === 1) {
    sideNote.innerHTML =
      '<div style="margin-bottom:4px;">' + mathHTML('P_0=(x_0,y_0)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_0=(x_0,y_0,z_0)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_1=\\left(x_0+\\Delta x,\\,y_0,\\,z_0+\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>' +
      '<div>' + mathHTML('\\mathbf{u}=\\left(\\Delta x,\\,0,\\,\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>';
  } else if (phase === 2 || phase === 3) {
    sideNote.innerHTML =
      '<div style="margin-bottom:4px;">' + mathHTML('P_0=(x_0,y_0)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_0=(x_0,y_0,z_0)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_1=\\left(x_0+\\Delta x,\\,y_0,\\,z_0+\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('\\mathbf{u}=\\left(\\Delta x,\\,0,\\,\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_2=\\left(x_0,\\,y_0+\\Delta y,\\,z_0+\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>' +
      '<div>' + mathHTML('\\mathbf{v}=\\left(0,\\,\\Delta y,\\,\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>';
  } else if (phase === 4) {
    sideNote.innerHTML =
      '<div style="margin-bottom:4px;">' + mathHTML('Q_1=\\left(x_0+\\Delta x,\\,y_0,\\,z_0+\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('\\mathbf{u}=\\left(\\Delta x,\\,0,\\,\\frac{\\partial z}{\\partial x}\\Delta x\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('Q_2=\\left(x_0,\\,y_0+\\Delta y,\\,z_0+\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('\\mathbf{v}=\\left(0,\\,\\Delta y,\\,\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('\\mathbf{w}=\\mathbf{u}+\\mathbf{v}', false) + '</div>' +
      '<div style="margin-bottom:4px;">' + mathHTML('\\mathbf{w}=\\left(\\Delta x,\\,\\Delta y,\\,\\frac{\\partial z}{\\partial x}\\Delta x+\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>' +
      '<div>' + mathHTML('Q_3=\\left(x_0+\\Delta x,\\,y_0+\\Delta y,\\,z_0+\\frac{\\partial z}{\\partial x}\\Delta x+\\frac{\\partial z}{\\partial y}\\Delta y\\right)', false) + '</div>';
  }
  phaseLabel.textContent = LABELS[phase];
  btnPrev.style.opacity = phase === 0 ? '0.3' : '1';
  btnNext.style.opacity = phase === 4 ? '0.3' : '1';
}
btnPrev.addEventListener('click', () => setPhase(phase-1));
btnNext.addEventListener('click', () => setPhase(phase+1));
setPhase(0);

// ── resize & loop ─────────────────────────────────────────────────────────────
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  for (const mat of lineMaterials) mat.resolution.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  for (const update of screenAlignedUpdaters) update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
resize(); controls.update(); animate();
new ResizeObserver(resize).observe(container);
