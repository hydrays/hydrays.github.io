// chapter10-complex.js
// Left panel : 2D contour map + gradient field
// Right panel: 3D surface (interactive OrbitControls)
// Function   : f(x,y) = sin(x)·sin(y)  on  [-3.6, 3.6]²

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

function f(x, y)  { return Math.sin(x) * Math.sin(y); }
function gx(x, y) { return Math.cos(x) * Math.sin(y); }
function gy(x, y) { return Math.sin(x) * Math.cos(y); }

const D = 3.6;      // domain half-width: [-D, D]²
const HS = 2.4;     // 3D height scale: z_view = f * HS

// viridis colormap
const STOPS = [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]];
function viridis(t) {
  t = Math.max(0, Math.min(1, t));
  const n = STOPS.length - 1, i = Math.min(n-1, Math.floor(t*n)), s = t*n - i;
  return STOPS[i].map((c, k) => (c + (STOPS[i+1][k]-c)*s) / 255);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEFT PANEL  —  2D contour + gradient
// ═══════════════════════════════════════════════════════════════════════════════
{
  const container = document.getElementById('cplx-2d');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0d1a2e, 1);
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
  container.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const VIEW = D + 0.35;
  const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, -10, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const lineMats = [];
  function mkThickLine(pts, color, lw) {
    const g = new LineGeometry();
    g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color, linewidth: lw || 2 });
    lineMats.push(m);
    return new Line2(g, m);
  }

  // ── heatmap ─────────────────────────────────────────────────────────────────
  {
    const RES = 256;
    const cv = document.createElement('canvas');
    cv.width = cv.height = RES;
    const img = cv.getContext('2d').createImageData(RES, RES);
    for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
      const [r, g, b] = viridis((f(-D+2*D*i/(RES-1), -D+2*D*j/(RES-1)) + 1) / 2).map(c => Math.round(c*255));
      const idx = ((RES-1-j)*RES + i) * 4;
      img.data[idx]=r; img.data[idx+1]=g; img.data[idx+2]=b; img.data[idx+3]=215;
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2*D, 2*D),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.92 })
    ));
  }

  // ── contour lines ────────────────────────────────────────────────────────────
  {
    const N = 180;
    const xs = Array.from({length:N+1}, (_, i) => -D + 2*D*i/N);
    const ys = Array.from({length:N+1}, (_, j) => -D + 2*D*j/N);
    const grid = ys.map(y => xs.map(x => f(x, y)));
    const LEVELS = [-0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6, 0.8];
    const pos = [];

    for (const lev of LEVELS) {
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const v00=grid[j][i], v10=grid[j][i+1], v01=grid[j+1][i], v11=grid[j+1][i+1];
        const li = (va, vb, a, b) => a + (b-a)*(lev-va)/(vb-va);
        const s = [];
        if ((v00-lev)*(v10-lev) < 0) s.push([li(v00,v10,xs[i],xs[i+1]), ys[j]]);
        if ((v10-lev)*(v11-lev) < 0) s.push([xs[i+1], li(v10,v11,ys[j],ys[j+1])]);
        if ((v01-lev)*(v11-lev) < 0) s.push([li(v01,v11,xs[i],xs[i+1]), ys[j+1]]);
        if ((v00-lev)*(v01-lev) < 0) s.push([xs[i], li(v00,v01,ys[j],ys[j+1])]);
        if (s.length === 2) pos.push(s[0][0],s[0][1],0.1, s[1][0],s[1][1],0.1);
      }
      // contour label: find a point near middle of domain
      let lx = null, ly = null;
      outer: for (let j = N>>1; j < N; j++) for (let i = 0; i < N; i++) {
        const v0 = grid[j][i], v1 = grid[j][i+1];
        if ((v0-lev)*(v1-lev) < 0) {
          lx = xs[i] + (xs[i+1]-xs[i])*(lev-v0)/(v1-v0); ly = ys[j];
          if (Math.abs(lx) < D-0.4 && Math.abs(ly) < D-0.4) break outer;
          lx = null;
        }
      }
      if (lx !== null) {
        const d = document.createElement('div');
        d.textContent = lev.toFixed(1);
        d.style.cssText = 'color:rgba(255,255,210,0.9);font-size:9px;font-family:sans-serif;text-shadow:0 0 4px #000,0 0 8px #000;pointer-events:none;';
        const o = new CSS2DObject(d); o.position.set(lx, ly, 0.15); scene.add(o);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true })));
  }

  // ── gradient arrows ──────────────────────────────────────────────────────────
  {
    const STEP=0.55, ALEN=0.28, HLEN=0.09, HW=0.060;
    let maxMag = 0;
    for (let x=-D; x<=D+.01; x+=STEP) for (let y=-D; y<=D+.01; y+=STEP)
      maxMag = Math.max(maxMag, Math.hypot(gx(x,y), gy(x,y)));

    const sP=[], sC=[], hP=[], hC=[];
    for (let x=-D; x<=D+.01; x+=STEP) for (let y=-D; y<=D+.01; y+=STEP) {
      const dx=gx(x,y), dy=gy(x,y), mag=Math.hypot(dx,dy);
      if (mag < 0.02) continue;  // skip near-zero (saddle points)
      const ux=dx/mag, uy=dy/mag;
      const ex=x+ux*ALEN, ey=y+uy*ALEN;
      const bx=ex-ux*HLEN, by=ey-uy*HLEN;
      const [r,g,b] = viridis(0.15 + (mag/maxMag)*0.85);
      sP.push(x,y,0.2, bx,by,0.2); sC.push(r,g,b, r,g,b);
      const px=-uy, py=ux;
      hP.push(ex,ey,0.2, bx+px*HW,by+py*HW,0.2, ex,ey,0.2, bx-px*HW,by-py*HW,0.2);
      hC.push(r,g,b, r,g,b, r,g,b, r,g,b);
    }
    const mkLS = (p, c) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('color',    new THREE.Float32BufferAttribute(c, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true }));
    };
    scene.add(mkLS(sP, sC)); scene.add(mkLS(hP, hC));
  }

  // ── critical points ───────────────────────────────────────────────────────────
  // maxima: f=+1 at (π/2,π/2) and (-π/2,-π/2)
  // minima: f=-1 at (π/2,-π/2) and (-π/2,π/2)
  // saddles: f=0 at (0,0), (±π,0), (0,±π)
  const H2 = Math.PI/2, P = Math.PI;
  const critPts = [
    { pos: [ H2,  H2], color: 0xff4455, label: 'max' },
    { pos: [-H2, -H2], color: 0xff4455, label: 'max' },
    { pos: [ H2, -H2], color: 0x44aaff, label: 'min' },
    { pos: [-H2,  H2], color: 0x44aaff, label: 'min' },
    { pos: [  0,   0], color: 0xffee44, label: '鞍' },
    { pos: [  P,   0], color: 0xffee44, label: '鞍' },
    { pos: [ -P,   0], color: 0xffee44, label: '鞍' },
    { pos: [  0,   P], color: 0xffee44, label: '鞍' },
    { pos: [  0,  -P], color: 0xffee44, label: '鞍' },
  ];
  for (const { pos: [px, py], color, label } of critPts) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(0.085, 16),
      new THREE.MeshBasicMaterial({ color, depthWrite: false })
    );
    m.position.set(px, py, 0.4); scene.add(m);
    if (label === 'max' || label === 'min' || (px === 0 && py === 0)) {
      const d = document.createElement('div');
      d.textContent = label;
      d.style.cssText = `color:#${color.toString(16).padStart(6,'0')};font-size:9px;font-family:sans-serif;text-shadow:0 0 4px #000;pointer-events:none;`;
      const o = new CSS2DObject(d);
      o.position.set(px + 0.15, py + 0.15, 0.4);
      scene.add(o);
    }
  }

  // ── axes ─────────────────────────────────────────────────────────────────────
  scene.add(mkThickLine([new THREE.Vector3(-D-0.2,0,0.3), new THREE.Vector3(D+0.45,0,0.3)], 0xd8d8d8, 1.6));
  scene.add(mkThickLine([new THREE.Vector3(0,-D-0.2,0.3), new THREE.Vector3(0,D+0.45,0.3)], 0xd8d8d8, 1.6));
  {
    const tp = [];
    for (const t of [-3,-2,-1,1,2,3]) { tp.push(t,-0.11,0.3,t,0.11,0.3, -0.11,t,0.3,0.11,t,0.3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xd8d8d8 })));
  }

  function mkLbl(text, pos, color, size) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `color:${color||'#f2f2f2'};font-size:${size||11}px;font-family:sans-serif;text-shadow:1px 1px 3px #000;pointer-events:none;`;
    const o = new CSS2DObject(d); o.position.copy(pos); return o;
  }
  scene.add(mkLbl('x',    new THREE.Vector3(D+0.55, 0.10, 0.3), '#f2f2f2', 13));
  scene.add(mkLbl('y',    new THREE.Vector3(0.10, D+0.52, 0.3), '#f2f2f2', 13));
  scene.add(mkLbl('等值线 & ∇f', new THREE.Vector3(-D-0.1, D+0.3, 0.3), '#ddd', 10));
  for (const t of [-3,-2,-1,1,2,3]) {
    scene.add(mkLbl(String(t), new THREE.Vector3(t-0.06,-0.42,0.3), '#aaa', 8));
    scene.add(mkLbl(String(t), new THREE.Vector3(-0.44,t-0.06,0.3), '#aaa', 8));
  }

  function resize2d() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
    for (const m of lineMats) m.resolution.set(w*window.devicePixelRatio, h*window.devicePixelRatio);
    const asp = w/h;
    camera.left=-VIEW*asp; camera.right=VIEW*asp; camera.top=VIEW; camera.bottom=-VIEW;
    camera.updateProjectionMatrix();
  }
  function animate2d() {
    requestAnimationFrame(animate2d);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  resize2d(); animate2d();
  new ResizeObserver(resize2d).observe(container);
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIGHT PANEL  —  3D surface
// ═══════════════════════════════════════════════════════════════════════════════
{
  const container = document.getElementById('cplx-3d');

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x0b1020, 1);
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
  container.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;';
  container.appendChild(labelRenderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(7.5, 5.5, 8.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.7;

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const dl = new THREE.DirectionalLight(0xffffff, 0.85);
  dl.position.set(5, 9, 5); scene.add(dl);

  // ── surface mesh with vertex colors ──────────────────────────────────────────
  {
    const N = 70;
    const verts=[], colors=[], idx=[];
    for (let j=0; j<=N; j++) for (let i=0; i<=N; i++) {
      const x=-D+2*D*i/N, y=-D+2*D*j/N, z=f(x,y)*HS;
      verts.push(x, z, -y);   // Three.js: x=math_x, y=height, z=-math_y
      const [r,g,b] = viridis((f(x,y)+1)/2);
      colors.push(r, g, b);
    }
    for (let j=0; j<N; j++) for (let i=0; i<N; i++) {
      const a=j*(N+1)+i, b=a+1, c=a+(N+1), d=c+1;
      idx.push(a,b,d, a,d,c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({
      vertexColors: true, shininess: 55, side: THREE.DoubleSide
    })));
    // subtle wireframe
    scene.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x000000, wireframe: true, opacity: 0.07, transparent: true
    })));
  }

  // ── axes ─────────────────────────────────────────────────────────────────────
  const lineMats3 = [];
  function mkLine3(pts, color, lw) {
    const g = new LineGeometry();
    g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
    const m = new LineMaterial({ color, linewidth: lw || 2 });
    lineMats3.push(m);
    return new Line2(g, m);
  }
  const AX = D + 0.7;
  scene.add(mkLine3([new THREE.Vector3(-AX,0,0), new THREE.Vector3(AX,0,0)], 0xc8c8c8, 1.8));
  scene.add(mkLine3([new THREE.Vector3(0,-HS-0.4,0), new THREE.Vector3(0,HS+0.6,0)], 0xc8c8c8, 1.8));
  scene.add(mkLine3([new THREE.Vector3(0,0,-AX), new THREE.Vector3(0,0,AX)], 0xc8c8c8, 1.8));

  function mkLbl3(text, pos, color, size) {
    const d = document.createElement('div');
    d.textContent = text;
    d.style.cssText = `color:${color||'#f2f2f2'};font-size:${size||12}px;font-family:sans-serif;text-shadow:1px 1px 3px #000;pointer-events:none;`;
    const o = new CSS2DObject(d); o.position.copy(pos); return o;
  }
  scene.add(mkLbl3('x', new THREE.Vector3(AX+0.25, 0, 0), '#f2f2f2', 13));
  scene.add(mkLbl3('z', new THREE.Vector3(0, HS+0.75, 0), '#f2f2f2', 13));
  scene.add(mkLbl3('y', new THREE.Vector3(0, 0, -(AX+0.25)), '#f2f2f2', 13));
  scene.add(mkLbl3('z = sin x · sin y', new THREE.Vector3(-D*0.85, HS+0.55, 0), '#cccccc', 11));

  function resize3d() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); labelRenderer.setSize(w, h);
    for (const m of lineMats3) m.resolution.set(w*window.devicePixelRatio, h*window.devicePixelRatio);
    camera.aspect = w/h; camera.updateProjectionMatrix();
  }
  function animate3d() {
    requestAnimationFrame(animate3d);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }
  resize3d(); animate3d();
  new ResizeObserver(resize3d).observe(container);
}
