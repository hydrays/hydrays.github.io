import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// surface: z = f(x,y) = -0.3x²-0.4y²+1.6x+2.8y-2.7  (same as 3D scenes)
function f(x, y)  { return -0.3*x*x - 0.4*y*y + 1.6*x + 2.8*y - 2.7; }
function gx(x, y) { return -0.6*x + 1.6; }   // ∂f/∂x
function gy(x, y) { return -0.8*y + 2.8; }   // ∂f/∂y

const container = document.getElementById('grad2d');

// ── renderers ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0x0d1a2e, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
container.prepend(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
container.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();
const VIEW = 3.8;
const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, -10, 10);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);

const lineMaterials = [];
function mkThickLine(pts, color, lw) {
  const geo = new LineGeometry();
  geo.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  const mat = new LineMaterial({ color, linewidth: lw || 2.0 });
  lineMaterials.push(mat);
  return new Line2(geo, mat);
}

// ── heatmap background (viridis-like canvas texture) ─────────────────────────
{
  const RES = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = RES;
  const img = cv.getContext('2d').createImageData(RES, RES);

  const stops = [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]];
  function viridis(t) {
    const n = stops.length - 1;
    const i = Math.min(n - 1, Math.floor(t * n));
    const s = t * n - i;
    return stops[i].map((c, k) => Math.round(c + (stops[i+1][k] - c) * s));
  }

  let fmin = Infinity, fmax = -Infinity;
  for (let i = 0; i <= RES; i++) for (let j = 0; j <= RES; j++) {
    const v = f(-3 + 6*i/RES, -3 + 6*j/RES);
    if (v < fmin) fmin = v; if (v > fmax) fmax = v;
  }

  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const [r, g, b] = viridis((f(-3+6*i/(RES-1), -3+6*j/(RES-1)) - fmin) / (fmax - fmin));
    const idx = ((RES-1-j)*RES + i) * 4;  // flip y: canvas top = math y=+3
    img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=210;
  }
  cv.getContext('2d').putImageData(img, 0, 0);

  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(6, 6),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.92 })
  ));
}

// ── contour lines (marching squares, batched into one LineSegments) ───────────
{
  const N = 160;
  const xs = Array.from({length: N+1}, (_, i) => -3 + 6*i/N);
  const ys = Array.from({length: N+1}, (_, j) => -3 + 6*j/N);
  const grid = ys.map(y => xs.map(x => f(x, y)));
  const LEVELS = [-20, -16, -12, -8, -4, 0, 4];
  const positions = [];

  for (const lev of LEVELS) {
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const v00=grid[j][i], v10=grid[j][i+1], v01=grid[j+1][i], v11=grid[j+1][i+1];
      const li = (va, vb, a, b) => a + (b-a)*(lev-va)/(vb-va);
      const segs = [];
      if ((v00-lev)*(v10-lev) < 0) segs.push([li(v00,v10,xs[i],xs[i+1]), ys[j]]);
      if ((v10-lev)*(v11-lev) < 0) segs.push([xs[i+1], li(v10,v11,ys[j],ys[j+1])]);
      if ((v01-lev)*(v11-lev) < 0) segs.push([li(v01,v11,xs[i],xs[i+1]), ys[j+1]]);
      if ((v00-lev)*(v01-lev) < 0) segs.push([xs[i], li(v00,v01,ys[j],ys[j+1])]);
      if (segs.length === 2)
        positions.push(segs[0][0],segs[0][1],0.1, segs[1][0],segs[1][1],0.1);
    }

    // contour label: find a visible crossing point near the middle of the domain
    let lx = null, ly = null;
    outer: for (let j = N>>1; j < N; j++) for (let i = 0; i < N; i++) {
      const v00=grid[j][i], v10=grid[j][i+1];
      if ((v00-lev)*(v10-lev) < 0) {
        lx = xs[i] + (xs[i+1]-xs[i])*(lev-v00)/(v10-v00);
        ly = ys[j];
        if (Math.abs(lx) < 2.7 && Math.abs(ly) < 2.7) break outer;
        lx = null;
      }
    }
    if (lx !== null) {
      const d = document.createElement('div');
      d.textContent = String(lev);
      d.style.cssText = 'color:rgba(255,255,200,0.9);font-size:10px;font-family:sans-serif;text-shadow:0 0 4px #000,0 0 8px #000;pointer-events:none;';
      const o = new CSS2DObject(d);
      o.position.set(lx, ly, 0.15);
      scene.add(o);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  scene.add(new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.45, transparent: true })));
}

// ── gradient arrows (uniform length, colored by magnitude) ───────────────────
{
  const STEP = 0.5;
  let maxMag = 0;
  for (let x = -3; x <= 3.001; x += STEP) for (let y = -3; y <= 3.001; y += STEP)
    maxMag = Math.max(maxMag, Math.hypot(gx(x,y), gy(x,y)));

  const ALEN = 0.30, HLEN = 0.10, HW = 0.065;
  const shaftP = [], shaftC = [], headP = [], headC = [];

  for (let x = -3; x <= 3.001; x += STEP) {
    for (let y = -3; y <= 3.001; y += STEP) {
      const dx = gx(x,y), dy = gy(x,y);
      const mag = Math.hypot(dx, dy);
      if (mag < 1e-8) continue;
      const ux = dx/mag, uy = dy/mag;
      const ex = x + ux*ALEN, ey = y + uy*ALEN;  // arrowhead tip
      const bx = ex - ux*HLEN, by = ey - uy*HLEN; // shaft end / head base

      // color by magnitude: blue(small) → cyan → yellow(large)
      const t = mag / maxMag;
      const r = Math.min(1, t * 1.9);
      const g = Math.min(1, t * 1.3 + 0.15);
      const b = Math.max(0, 1 - t * 1.7);

      shaftP.push(x,y,0.2, bx,by,0.2);
      shaftC.push(r,g,b, r,g,b);

      // arrowhead: V-shape (two lines meeting at tip)
      const px = -uy, py = ux;
      headP.push(ex,ey,0.2, bx+px*HW,by+py*HW,0.2,
                 ex,ey,0.2, bx-px*HW,by-py*HW,0.2);
      headC.push(r,g,b, r,g,b, r,g,b, r,g,b);
    }
  }

  function mkLS(pos, col) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
    return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true }));
  }
  scene.add(mkLS(shaftP, shaftC));
  scene.add(mkLS(headP,  headC));
}

// ── coordinate axes ───────────────────────────────────────────────────────────
scene.add(mkThickLine([new THREE.Vector3(-3.3,0,0.3), new THREE.Vector3(3.6,0,0.3)], 0xe0e0e0, 1.8));
scene.add(mkThickLine([new THREE.Vector3(0,-3.3,0.3), new THREE.Vector3(0,3.6,0.3)], 0xe0e0e0, 1.8));

{
  const tp = [];
  for (let t = -3; t <= 3; t++) {
    if (t === 0) continue;
    tp.push(t,-0.12,0.3, t,0.12,0.3, -0.12,t,0.3, 0.12,t,0.3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
  scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xe0e0e0 })));
}

function mkLabel(text, pos, color, size) {
  const d = document.createElement('div');
  d.textContent = text;
  d.style.cssText = `color:${color||'#f2f2f2'};font-size:${size||12}px;font-family:sans-serif;text-shadow:1px 1px 3px rgba(0,0,0,0.9);pointer-events:none;`;
  const o = new CSS2DObject(d);
  o.position.copy(pos);
  return o;
}

scene.add(mkLabel('x',      new THREE.Vector3(3.72, 0.10, 0.3), '#f2f2f2', 14));
scene.add(mkLabel('y',      new THREE.Vector3(0.12, 3.68, 0.3), '#f2f2f2', 14));
scene.add(mkLabel('∇f',     new THREE.Vector3(-3.5, 3.55, 0.3), '#ffffff', 13));

for (const t of [-3,-2,-1,1,2,3]) {
  scene.add(mkLabel(String(t), new THREE.Vector3(t-0.07, -0.44, 0.3), '#bbbbbb', 9));
  scene.add(mkLabel(String(t), new THREE.Vector3(-0.46,  t-0.06, 0.3), '#bbbbbb', 9));
}

// ── resize & animate ──────────────────────────────────────────────────────────
function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  renderer.setSize(w, h, false);
  labelRenderer.setSize(w, h);
  for (const mat of lineMaterials) mat.resolution.set(w * window.devicePixelRatio, h * window.devicePixelRatio);
  const aspect = w / h;
  camera.left = -VIEW * aspect; camera.right = VIEW * aspect;
  camera.top = VIEW;            camera.bottom = -VIEW;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}

resize(); animate();
new ResizeObserver(resize).observe(container);
