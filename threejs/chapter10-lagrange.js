import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// ── Color palettes ─────────────────────────────────────────────────────────────
function mkPal(stops) {
  return t => {
    const n = stops.length - 1, i = Math.min(n-1, t*n|0), s = t*n - i;
    return stops[i].map((c, k) => (c + (stops[i+1][k]-c)*s) | 0);
  };
}
// Matplotlib "wistia": bright yellow-green → yellow → amber → orange → red-orange
const WISTIA = mkPal([
  [228, 255, 122],   // t=0.00  bright yellow-green
  [255, 255,   0],   // t=0.25  bright yellow
  [255, 176,   0],   // t=0.50  amber/gold
  [255,  96,   0],   // t=0.75  orange
  [255,  30,   0],   // t=1.00  red-orange
]);
// Diverging wistia: flipped wistia (blue) → white → wistia (warm)
const WISTIA_DIV = mkPal([
  [  0,  30, 255],   // t=0.00  strong blue (very negative)
  [  0,  96, 255],   // t=0.25
  [200, 220, 255],   // t=0.50  near-white (zero)
  [255, 176,   0],   // t=0.75  amber
  [255,  30,   0],   // t=1.00  red-orange (very positive)
]);

// ── Generic Lagrange scene factory ────────────────────────────────────────────
function createScene(container, cfg) {
  const { f, fx, fy, gx, gy, domain, VIEW, fRange, fLevels, palette,
          constraintCurves, optimalPts, infoId } = cfg;

  // Shaft half-width in world units ≈ 3.5px at the given VIEW/height
  const SHAFT_HW = VIEW * 3.5 / 400;

  // ── Renderer ─────────────────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0c1830, 1);
  renderer.domElement.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;display:block;cursor:crosshair;';
  container.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.cssText =
    'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;width:100%;height:100%;';
  container.appendChild(labelRenderer.domElement);

  // ── Scene / camera ────────────────────────────────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-VIEW, VIEW, VIEW, -VIEW, -10, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  const lms = [];   // LineMaterials needing resolution updates
  function mkLine2(pts, color, lw) {
    const geo = new LineGeometry();
    geo.setPositions(pts);
    const mat = new LineMaterial({ color, linewidth: lw || 2 });
    lms.push(mat);
    const m = new Line2(geo, mat);
    scene.add(m);
    return m;
  }

  // ── Heatmap ───────────────────────────────────────────────────────────────────
  {
    const RES  = 256;
    const cv   = document.createElement('canvas');
    cv.width   = cv.height = RES;
    const img  = cv.getContext('2d').createImageData(RES, RES);
    const pal  = palette === 'wistia_div' ? WISTIA_DIV : WISTIA;
    const [fMin, fMax] = fRange;
    const fSpan = fMax - fMin;

    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const x = -domain + 2*domain*i/(RES-1);
        const y =  domain - 2*domain*j/(RES-1);
        let   t = Math.min(1, Math.max(0, (f(x,y) - fMin) / fSpan));
        if (palette !== 'wistia_div') t = Math.sqrt(t);
        const [r, g, b] = pal(t);
        const k = (j*RES + i)*4;
        img.data[k]=r; img.data[k+1]=g; img.data[k+2]=b; img.data[k+3]=245;
      }
    }
    cv.getContext('2d').putImageData(img, 0, 0);
    scene.add(new THREE.Mesh(
      new THREE.PlaneGeometry(2*domain, 2*domain),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0.95 })
    ));
  }

  // ── Contour lines of f (marching squares) ─────────────────────────────────────
  {
    const N  = 220;
    const xs = Array.from({length:N+1}, (_,i) => -domain + 2*domain*i/N);
    const ys = Array.from({length:N+1}, (_,j) => -domain + 2*domain*j/N);
    const gr = ys.map(y => xs.map(x => f(x,y)));
    const pos = [];
    for (const lev of fLevels) {
      for (let j=0; j<N; j++) for (let i=0; i<N; i++) {
        const v00=gr[j][i], v10=gr[j][i+1], v01=gr[j+1][i], v11=gr[j+1][i+1];
        const li=(va,vb,a,b)=>a+(b-a)*(lev-va)/(vb-va);
        const segs=[];
        if((v00-lev)*(v10-lev)<0) segs.push([li(v00,v10,xs[i],xs[i+1]),ys[j]]);
        if((v10-lev)*(v11-lev)<0) segs.push([xs[i+1],li(v10,v11,ys[j],ys[j+1])]);
        if((v01-lev)*(v11-lev)<0) segs.push([li(v01,v11,xs[i],xs[i+1]),ys[j+1]]);
        if((v00-lev)*(v01-lev)<0) segs.push([xs[i],li(v00,v01,ys[j],ys[j+1])]);
        if(segs.length===2) pos.push(segs[0][0],segs[0][1],0.1, segs[1][0],segs[1][1],0.1);
      }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      scene.add(new THREE.LineSegments(geo,
        new THREE.LineBasicMaterial({color:0x000000, opacity:0.35, transparent:true})));
    }
  }

  // ── Constraint curve(s) ───────────────────────────────────────────────────────
  for (const pts of constraintCurves(domain)) {
    if (pts.length >= 6) mkLine2(pts, 0x00ff66, 4.5);
  }

  if (cfg.constraintLabel) {
    const [lx, ly, ltext] = cfg.constraintLabel;
    const d = document.createElement('div');
    d.textContent = ltext;
    d.style.cssText = 'color:#00ff66;font-size:12px;font-family:sans-serif;font-weight:700;text-shadow:0 0 8px #00ff66,0 0 3px #000;pointer-events:none;';
    const o = new CSS2DObject(d);
    o.position.set(lx, ly, 0.3);
    scene.add(o);
  }

  // ── Optimal point markers ─────────────────────────────────────────────────────
  for (const [ox, oy, kind] of optimalPts) {
    const isMin = kind === 'min';
    const dotCol = isMin ? 0x66ffaa : 0xff6644;
    const txtCol = isMin ? '#88ffcc' : '#ff8866';

    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 24),
      new THREE.MeshBasicMaterial({color: dotCol, depthTest: false})
    );
    dot.position.set(ox, oy, 0.5);
    scene.add(dot);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.13, 0.21, 24),
      new THREE.MeshBasicMaterial({color:0xffffff, opacity:0.85, transparent:true, side:THREE.DoubleSide})
    );
    ring.position.set(ox, oy, 0.5);
    scene.add(ring);

    const d = document.createElement('div');
    d.textContent = kind;
    d.style.cssText = `color:${txtCol};font-size:11px;font-family:monospace;font-weight:700;text-shadow:0 0 4px #000;pointer-events:none;`;
    const o = new CSS2DObject(d);
    o.position.set(ox + 0.22, oy + 0.22, 0.5);
    scene.add(o);
  }

  // ── Coordinate axes ───────────────────────────────────────────────────────────
  const D = domain;
  mkLine2([-D-0.2,0,0.2, D+0.35,0,0.2], 0xaabbdd, 2.0);
  mkLine2([0,-D-0.2,0.2, 0,D+0.35,0.2], 0xaabbdd, 2.0);

  function cssLabel(text, x, y, z, css) {
    const d = document.createElement('div');
    d.innerHTML = text;
    d.style.cssText = css + ';pointer-events:none;';
    const o = new CSS2DObject(d);
    o.position.set(x, y, z);
    scene.add(o);
    return o;
  }

  cssLabel('x', D+0.45, -0.22, 0.2, 'color:#dde8ff;font-size:14px;font-family:sans-serif;text-shadow:1px 1px 3px rgba(0,0,0,.9)');
  cssLabel('y', 0.08,   D+0.42, 0.2, 'color:#dde8ff;font-size:14px;font-family:sans-serif;text-shadow:1px 1px 3px rgba(0,0,0,.9)');
  if (cfg.fLabel) cssLabel(cfg.fLabel, -D, D+0.32, 0.2, 'color:#bbccff;font-size:11px;font-family:sans-serif;opacity:0.95');

  // ── Arrow system: shaft (quad mesh) + head (triangle mesh) ───────────────────
  // Both use the same MeshBasicMaterial instance → guaranteed identical color.
  const ALEN=1.1, HLEN=0.30, HW=0.12, ZARR=0.7;
  const LABEL_OFFSET = 0.26;

  function makeArrow2(color) {
    // renderOrder=10: draw after the transparent heatmap (which renders in the
    // transparent pass and would otherwise overwrite opaque arrow meshes).
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });

    // Shaft: a rectangle (2 triangles)
    const sGeo = new THREE.BufferGeometry();
    sGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(12), 3));
    sGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    sGeo.setIndex([0,1,2, 0,2,3]);
    const shaft = new THREE.Mesh(sGeo, mat);
    shaft.renderOrder = 10;
    shaft.visible = false;
    scene.add(shaft);

    // Head: filled triangle
    const hGeo = new THREE.BufferGeometry();
    hGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
    hGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
    const head = new THREE.Mesh(hGeo, mat);
    head.renderOrder = 10;
    head.visible = false;
    scene.add(head);

    return { shaft, sGeo, head, hGeo };
  }

  // Returns [tipX, tipY, ux, uy] or null if degenerate
  function setArrow2(arr, x, y, dx, dy) {
    const { shaft, sGeo, head, hGeo } = arr;
    const mag = Math.hypot(dx, dy);
    if (mag < 1e-6) { shaft.visible = head.visible = false; return null; }
    shaft.visible = head.visible = true;

    const ux=dx/mag, uy=dy/mag, px=-uy, py=ux;
    const ex=x+ux*ALEN,  ey=y+uy*ALEN;     // tip
    const bx=ex-ux*HLEN, by=ey-uy*HLEN;    // head base center

    // Shaft quad (start → base)
    const sa = sGeo.attributes.position.array;
    sa[0]=x+px*SHAFT_HW;  sa[1]=y+py*SHAFT_HW;  sa[2]=ZARR;
    sa[3]=x-px*SHAFT_HW;  sa[4]=y-py*SHAFT_HW;  sa[5]=ZARR;
    sa[6]=bx-px*SHAFT_HW; sa[7]=by-py*SHAFT_HW; sa[8]=ZARR;
    sa[9]=bx+px*SHAFT_HW; sa[10]=by+py*SHAFT_HW; sa[11]=ZARR;
    sGeo.attributes.position.needsUpdate = true;
    sGeo.computeBoundingSphere();

    // Head triangle
    const ha = hGeo.attributes.position.array;
    ha[0]=ex;         ha[1]=ey;         ha[2]=ZARR+0.02;
    ha[3]=bx+px*HW;   ha[4]=by+py*HW;   ha[5]=ZARR+0.02;
    ha[6]=bx-px*HW;   ha[7]=by-py*HW;   ha[8]=ZARR+0.02;
    hGeo.attributes.position.needsUpdate = true;
    hGeo.computeBoundingSphere();

    return [ex, ey, ux, uy];
  }

  function hideArrow2(arr) { arr.shaft.visible = arr.head.visible = false; }

  const arrowF = makeArrow2(0xff2222);  // ∇f  bright red
  const arrowG = makeArrow2(0x22ee22);  // ∇g  bright green

  // Cursor dot
  const cursorDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.07, 20),
    new THREE.MeshBasicMaterial({color:0xffffff})
  );
  cursorDot.renderOrder = 11;
  cursorDot.visible = false;
  scene.add(cursorDot);

  // Labels placed beyond the tip along the arrow direction
  function makeCSSLbl(html, color) {
    const d = document.createElement('div');
    d.innerHTML = html;
    d.style.cssText = `color:${color};font-size:15px;font-family:monospace;font-weight:700;` +
      `text-shadow:0 0 8px ${color},0 0 3px #000;pointer-events:none;` +
      `background:rgba(0,0,0,0.40);padding:2px 6px;border-radius:4px;`;
    const o = new CSS2DObject(d);
    o.visible = false;
    scene.add(o);
    return o;
  }
  const lblF = makeCSSLbl('∇f', '#ff2222');
  const lblG = makeCSSLbl('∇g', '#22ee22');

  const infoEl = document.getElementById(infoId);

  // ── Mouse tracking ────────────────────────────────────────────────────────────
  let mx=0, my=0, hasM=false;
  const _v = new THREE.Vector3();

  renderer.domElement.addEventListener('mousemove', e => {
    const r = renderer.domElement.getBoundingClientRect();
    _v.set(((e.clientX-r.left)/r.width)*2-1, -((e.clientY-r.top)/r.height)*2+1, 0);
    _v.unproject(camera);
    mx = Math.max(-D, Math.min(D, _v.x));
    my = Math.max(-D, Math.min(D, _v.y));
    hasM = true;
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    hasM = false;
    hideArrow2(arrowF); hideArrow2(arrowG);
    lblF.visible = lblG.visible = false;
    cursorDot.visible = false;
    if (infoEl) { infoEl.textContent = '将鼠标移入图形区域'; infoEl.style.color = '#7a8aa0'; }
  });

  function updateArrows() {
    if (!hasM) return;
    cursorDot.position.set(mx, my, ZARR);
    cursorDot.visible = true;

    const fdx=fx(mx,my), fdy=fy(mx,my);
    const gdx=gx(mx,my), gdy=gy(mx,my);

    const fRes = setArrow2(arrowF, mx, my, fdx, fdy);
    const gRes = setArrow2(arrowG, mx, my, gdx, gdy);

    if (fRes) {
      const [ex, ey, ux, uy] = fRes;
      lblF.position.set(ex + ux*LABEL_OFFSET, ey + uy*LABEL_OFFSET, ZARR);
      lblF.visible = true;
    } else { lblF.visible = false; }
    if (gRes) {
      const [ex, ey, ux, uy] = gRes;
      lblG.position.set(ex + ux*LABEL_OFFSET, ey + uy*LABEL_OFFSET, ZARR);
      lblG.visible = true;
    } else { lblG.visible = false; }

    if (!infoEl) return;
    const magF=Math.hypot(fdx,fdy), magG=Math.hypot(gdx,gdy);
    if (magF < 1e-6 || magG < 1e-6) { infoEl.textContent = '(梯度趋近零)'; return; }
    const cosA  = Math.abs((fdx*gdx + fdy*gdy) / (magF*magG));
    const angle = Math.acos(Math.min(1, cosA)) * 180 / Math.PI;
    if (angle < 5) {
      infoEl.innerHTML =
        `x=${mx.toFixed(2)}, y=${my.toFixed(2)} &nbsp;│&nbsp;` +
        `<b style="color:#44ff88">∇f ∥ ∇g &nbsp;夹角 ≈ ${angle.toFixed(1)}° &nbsp;✦ 极值候选点！</b>`;
      infoEl.style.color = '#44ff88';
    } else {
      infoEl.innerHTML =
        `x=${mx.toFixed(2)}, y=${my.toFixed(2)} &nbsp;│&nbsp; ∇f 与 ∇g 夹角 = ${angle.toFixed(1)}°`;
      infoEl.style.color = '#8899bb';
    }
  }

  // ── Resize & animate ──────────────────────────────────────────────────────────
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    const dpr = renderer.getPixelRatio();
    for (const m of lms) m.resolution.set(w*dpr, h*dpr);
    const asp = w/h;
    camera.left=-VIEW*asp; camera.right=VIEW*asp;
    camera.top=VIEW; camera.bottom=-VIEW;
    camera.updateProjectionMatrix();
  }

  function animate() {
    requestAnimationFrame(animate);
    updateArrows();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  }

  resize(); animate();
  new ResizeObserver(resize).observe(container);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Example 1 — f(x,y) = x²+y²  subject to  g(x,y) = xy − 4 = 0
// ═══════════════════════════════════════════════════════════════════════════════
const CFG1 = {
  f:  (x, y) => x*x + y*y,
  fx: (x, _) => 2*x,
  fy: (_, y) => 2*y,
  gx: (_, y) => y,
  gy: (x, _) => x,
  domain: 4.2,
  VIEW:   4.7,
  fRange: [0, 36],
  fLevels: [2, 4, 8, 12, 16, 20, 24, 28, 32],
  palette: 'wistia',
  constraintCurves: D => {
    const yClip = D, xMin = 4 / yClip;
    const b1=[], b2=[];
    for (let i=0; i<=250; i++) { const x = xMin + (D-xMin)*i/250; b1.push(x, 4/x, 0.3); }
    for (let i=0; i<=250; i++) { const x = -D + (D-xMin)*i/250;   b2.push(x, 4/x, 0.3); }
    return [b1, b2];
  },
  constraintLabel: [3.5, 3.5/4 + 0.25, 'xy=4'],
  optimalPts: [[2,2,'min'],[-2,-2,'min']],
  infoId:  'lagrange-info-1',
  fLabel:  'f = x²+y²',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Example 2 — f(x,y) = xy  subject to  g(x,y) = x²+y² − 4 = 0
// ═══════════════════════════════════════════════════════════════════════════════
const S2 = Math.sqrt(2);
const CFG2 = {
  f:  (x, y) => x*y,
  fx: (_, y) => y,
  fy: (x, _) => x,
  gx: (x, _) => 2*x,
  gy: (_, y) => 2*y,
  domain: 2.8,
  VIEW:   3.15,
  fRange: [-4, 4],
  fLevels: [-3, -2, -1, 0, 1, 2, 3],
  palette: 'wistia_div',
  constraintCurves: _ => {
    const pts=[];
    for (let i=0; i<=320; i++) { const a=2*Math.PI*i/320; pts.push(2*Math.cos(a), 2*Math.sin(a), 0.3); }
    return [pts];
  },
  constraintLabel: [2*Math.cos(Math.PI/8)+0.15, 2*Math.sin(Math.PI/8)+0.22, 'g=0'],
  optimalPts: [
    [ S2,  S2, 'max'], [-S2, -S2, 'max'],
    [ S2, -S2, 'min'], [-S2,  S2, 'min'],
  ],
  infoId: 'lagrange-info-2',
  fLabel: 'f = xy',
};

// ── Boot both scenes ──────────────────────────────────────────────────────────
const c1 = document.getElementById('lagrange-ex1');
const c2 = document.getElementById('lagrange-ex2');
if (c1) createScene(c1, CFG1);
if (c2) createScene(c2, CFG2);
