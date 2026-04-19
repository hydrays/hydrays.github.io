import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

function f(x, y) { return -0.3*x*x - 0.4*y*y + 1.6*x + 2.8*y - 2.7; }
const Z_SCALE = 2;
const Z0 = f(1, 1);
const DX = 1.10;
const DY = DX;

function zView(z) { return z / Z_SCALE; }
function localHeight(dx, dy) { return f(1 + dx, 1 + dy) - Z0; }
function V(x, y, z) { return new THREE.Vector3(x, zView(z), -y); }

const container = document.getElementById('grad3d_local');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0B6E4F, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(3.0, 2.15, 3.45);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0.10, 0.18, -0.12);
controls.enableDamping = true;
controls.dampingFactor = 0.07;

scene.add(new THREE.AmbientLight(0xffffff, 0.70));
const dLight = new THREE.DirectionalLight(0xffffff, 0.72);
dLight.position.set(4, 7, 4);
scene.add(dLight);

const lineMaterials = [];
const screenAlignedUpdaters = [];

function mkLine(pts, color, linewidth) {
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap((p) => [p.x, p.y, p.z]));
  const mat = new LineMaterial({ color, linewidth: linewidth || 3.0 });
  lineMaterials.push(mat);
  return new Line2(geo, mat);
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

function mkArrow(start, end, color, linewidth, headLength, headRadius) {
  const dir = end.clone().sub(start);
  const unit = dir.clone().normalize();
  const shaftEnd = end.clone().addScaledVector(unit, -headLength);
  const shaft = mkLine([start, shaftEnd], color, linewidth || 4.0);
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
    sprite.material.rotation = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2;
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
  m.position.copy(pos);
  return m;
}
function mkPatch(verts, inds) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(inds);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0xddaa22,
    transparent: true,
    opacity: 0.34,
    side: THREE.DoubleSide,
    depthWrite: false,
    shininess: 20
  }));
}
function mkCylinder(radius, height, color, opacity) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 72, 1, true),
    new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: opacity || 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
      shininess: 18
    })
  );
}

function mathHTML(tex) {
  if (window.katex && typeof window.katex.renderToString === 'function') {
    return window.katex.renderToString(tex, { throwOnError: false, displayMode: false });
  }
  return tex;
}

function mkMathLabel(tex, pos, color, fontSize) {
  const d = document.createElement('div');
  d.innerHTML = mathHTML(tex);
  d.style.cssText = 'color:' + (color || '#f2f2f2') + ';font-size:' + (fontSize || 13) + 'px;text-shadow:0 0 5px #000;pointer-events:none;';
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  return o;
}

const AC = 0xf2f2f2;
scene.add(mkArrow(new THREE.Vector3(-1.45, 0, 0), new THREE.Vector3(1.95, 0, 0), AC, 2.9, 0.12, 0.05));
scene.add(mkArrow(new THREE.Vector3(0, -1.10, 0), new THREE.Vector3(0, 1.75, 0), AC, 2.9, 0.12, 0.05));
scene.add(mkArrow(new THREE.Vector3(0, 0, 1.45), new THREE.Vector3(0, 0, -1.95), AC, 2.9, 0.12, 0.05));
scene.add(mkMathLabel('x', new THREE.Vector3(2.10, 0, 0), '#f2f2f2', 12));
scene.add(mkMathLabel('z', new THREE.Vector3(0, 1.88, 0), '#f2f2f2', 12));
scene.add(mkMathLabel('y', new THREE.Vector3(0, 0, -2.12), '#f2f2f2', 12));

{
  const N = 28, vs = [], ix = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const dx = -1.15 + 2.55 * i / N;
    const dy = -1.15 + 2.55 * j / N;
    vs.push(dx, zView(localHeight(dx, dy)), -dy);
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const a = i * (N + 1) + j, b = a + 1, c = a + (N + 1), d = c + 1;
    ix.push(a, b, d, a, d, c);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
  geo.setIndex(ix);
  geo.computeVertexNormals();
  scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
    color: 0x334a9f, transparent: true, opacity: 0.09,
    side: THREE.DoubleSide, depthWrite: false, shininess: 28
  })));
}

{
  const M = 12, vs = [], ix = [];
  for (let i = 0; i <= M; i++) for (let j = 0; j <= M; j++) {
    const x = -1.25 + 2.7 * i / M;
    const y = -1.25 + 2.7 * j / M;
    vs.push(x, zView(x + 2 * y), -y);
  }
  for (let i = 0; i < M; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + 1, c = a + (M + 1), d = c + 1;
    ix.push(a, b, d, a, d, c);
  }
  scene.add(mkPatch(vs, ix));
}

{
  const cyl = mkCylinder(1.0, 3.2, 0x8ddad0, 0.12);
  cyl.position.set(0, 0.28, 0);
  scene.add(cyl);

  const pts = [];
  for (let t = 0; t <= Math.PI * 2 + 0.001; t += 0.04) {
    const x = Math.cos(t);
    const y = Math.sin(t);
    pts.push(new THREE.Vector3(x, zView(x + 2 * y), -y));
  }
  scene.add(mkLine(pts, 0x9afff0, 3.2));
}

const Q0 = V(0, 0, 0);
const Q1 = V(DX, 0, DX);
const Q2 = V(0, DY, 2 * DY);
const Q3 = V(DX, DY, DX + 2 * DY);

scene.add(mkSphere(Q0, 0xffff00, 0.042));
scene.add(mkSphere(Q1, 0xffffff, 0.039));
scene.add(mkSphere(Q2, 0xffffff, 0.039));
scene.add(mkSphere(Q3, 0xd8fff6, 0.043));

scene.add(mkFlatArrow(Q0.clone(), Q1.clone(), 0xfff4c2, 3.7, 0.20, 0.18));
scene.add(mkFlatArrow(Q0.clone(), Q2.clone(), 0xf4dcff, 3.7, 0.20, 0.18));
scene.add(mkLine([Q1.clone(), Q3.clone()], 0xfff4c2, 2.8));
scene.add(mkLine([Q2.clone(), Q3.clone()], 0xf4dcff, 2.8));

scene.add(mkMathLabel('Q_0', Q0.clone().add(new THREE.Vector3(-0.14, 0.12, 0.08)), '#fff799'));
scene.add(mkMathLabel('Q_1', Q1.clone().add(new THREE.Vector3(0.12, 0.12, 0.04)), '#ffffff'));
scene.add(mkMathLabel('Q_2', Q2.clone().add(new THREE.Vector3(0.12, 0.12, -0.08)), '#ffffff'));
scene.add(mkMathLabel('Q_3', Q3.clone().add(new THREE.Vector3(0.12, 0.12, -0.07)), '#d8fff6'));
scene.add(mkMathLabel('\\mathbf{u}', Q0.clone().lerp(Q1, 0.56).add(new THREE.Vector3(0.08, 0.10, 0.05)), '#fff4c2', 18));
scene.add(mkMathLabel('\\mathbf{v}', Q0.clone().lerp(Q2, 0.58).add(new THREE.Vector3(0.10, 0.10, -0.06)), '#f4dcff', 18));

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  for (const mat of lineMaterials) mat.resolution.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  for (const update of screenAlignedUpdaters) update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

resize();
controls.update();
animate();
new ResizeObserver(resize).observe(container);
