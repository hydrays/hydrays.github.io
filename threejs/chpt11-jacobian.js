/**
 * chpt11-jacobian.js
 * Geometric meaning of the Jacobian determinant.
 *
 * Two panels, side-by-side:
 *   Left  — (u, v) parameter plane, unit square [0,1]² tiled by a 5×5 grid.
 *   Right — (x, y) image plane under the linear map
 *              (x, y) = (1.2 u + 0.6 v,  0.4 u + 1.3 v)
 *           so every sub-square becomes a sub-parallelogram of equal area
 *           |J| = 1.32 times the original. One cell is highlighted on both
 *           sides to make the correspondence explicit.
 *
 * Uses an orthographic camera (this is essentially a 2D diagram).
 */

import * as THREE                     from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── linear map φ : (u,v) → (x,y)  with det = 1.32 ────────────────────────────

const A11 = 1.2, A12 = 0.6;
const A21 = 0.4, A22 = 1.3;
const DET = A11 * A22 - A12 * A21;     // = 1.32
function phi(u, v) { return [A11*u + A12*v, A21*u + A22*v]; }

const NU = 5, NV = 5;
const IH_U = 2, IH_V = 2;              // highlighted cell indices (0-based)

// helper: build one orthographic panel
function makePanel({ containerId, xMin, xMax, yMin, yMax, draw }) {
  const container = document.getElementById(containerId);
  if (!container) return;
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

  // placeholder camera — rebuilt on resize to match aspect
  let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);

  draw(scene);

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    const aspect = w / h;
    const viewW = xMax - xMin, viewH = yMax - yMin;
    let halfW, halfH;
    if (viewW / viewH > aspect) {
      halfW = viewW / 2;
      halfH = halfW / aspect;
    } else {
      halfH = viewH / 2;
      halfW = halfH * aspect;
    }
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2;
    camera.left   = cx - halfW;
    camera.right  = cx + halfW;
    camera.top    = cy + halfH;
    camera.bottom = cy - halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  (function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  })();
}

// ── tiny helpers ─────────────────────────────────────────────────────────────

function fillQuad(scene, pts, color, opacity) {
  const [a, b, c, d] = pts;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    a.x,a.y,0, b.x,b.y,0, c.x,c.y,0,
    a.x,a.y,0, c.x,c.y,0, d.x,d.y,0,
  ], 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
}
function strokeLoop(scene, pts, color, width = 1) {
  const P = [...pts, pts[0]].map(p => new THREE.Vector3(p.x, p.y, 0));
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(P),
    new THREE.LineBasicMaterial({ color, linewidth: width }),
  ));
}
function strokeSegment(scene, p, q, color) {
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x, p.y, 0), new THREE.Vector3(q.x, q.y, 0),
    ]),
    new THREE.LineBasicMaterial({ color }),
  ));
}
function arrow(scene, p, q, color, headLen = 0.10, headWidth = 0.06) {
  const dir = new THREE.Vector2(q.x - p.x, q.y - p.y).normalize();
  const shaftEnd = { x: q.x - dir.x*headLen*0.9, y: q.y - dir.y*headLen*0.9 };
  strokeSegment(scene, p, shaftEnd, color);
  const perp = { x: -dir.y, y: dir.x };
  const base = { x: q.x - dir.x*headLen, y: q.y - dir.y*headLen };
  const tip1 = { x: base.x + perp.x*headWidth, y: base.y + perp.y*headWidth };
  const tip2 = { x: base.x - perp.x*headWidth, y: base.y - perp.y*headWidth };
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    q.x,q.y,0, tip1.x,tip1.y,0, tip2.x,tip2.y,0,
  ], 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide,
  })));
}

function addLabel(scene, html, x, y, { color='#1e293b', size='12px' } = {}) {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.style.cssText = [
    `color:${color}`, `font-size:${size}`,
    'font-family:"STIX Two Math","Cambria Math","Times New Roman",serif',
    'white-space:nowrap', 'pointer-events:none', 'user-select:none',
    'text-shadow:0 0 4px #fff,0 0 4px #fff,0 0 4px #fff',
  ].join(';');
  const obj = new CSS2DObject(div);
  obj.position.set(x, y, 0);
  scene.add(obj);
}
function ktx(tex, display = false) {
  return typeof katex !== 'undefined'
    ? katex.renderToString(tex, { displayMode: display, throwOnError: false })
    : `<i>${tex}</i>`;
}

// ── left panel: (u, v)-plane with 5×5 grid on [0,1]² ─────────────────────────

makePanel({
  containerId: 'chpt11-jacobian-uv',
  xMin: -0.25, xMax: 1.35,
  yMin: -0.25, yMax: 1.35,
  draw(scene) {
    // all cells filled very lightly
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const u0 = i/NU, u1 = (i+1)/NU, v0 = j/NV, v1 = (j+1)/NV;
        const isHi = (i === IH_U && j === IH_V);
        fillQuad(scene,
          [{x:u0,y:v0},{x:u1,y:v0},{x:u1,y:v1},{x:u0,y:v1}],
          isHi ? 0xf59e0b : 0xdbeafe,
          isHi ? 0.85 : 0.45);
      }
    }
    // grid lines
    const gridMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    for (let i = 0; i <= NU; i++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(i/NU, 0, 0), new THREE.Vector3(i/NU, 1, 0)]),
        gridMat));
    }
    for (let j = 0; j <= NV; j++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, j/NV, 0), new THREE.Vector3(1, j/NV, 0)]),
        gridMat));
    }
    // boundary
    strokeLoop(scene,
      [{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}], 0x1e3a8a);

    // axes
    arrow(scene, {x:-0.15,y:0}, {x:1.25,y:0}, 0x374151, 0.08, 0.04);
    arrow(scene, {x:0,y:-0.15}, {x:0,y:1.25}, 0x374151, 0.08, 0.04);
    addLabel(scene, ktx('u'), 1.30, 0, { size:'12px' });
    addLabel(scene, ktx('v'), 0, 1.30, { size:'12px' });
    addLabel(scene, ktx('1'), 1.0, -0.06, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('1'), -0.06, 1.0, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('O'), -0.06, -0.06, { color:'#6b7280', size:'10px' });

    // highlighted cell annotation: du, dv sides
    const u0 = IH_U/NU, u1 = (IH_U+1)/NU, v0 = IH_V/NV, v1 = (IH_V+1)/NV;
    addLabel(scene, ktx('du'), (u0+u1)/2, v0 - 0.06, { color:'#b45309', size:'11px' });
    addLabel(scene, ktx('dv'), u0 - 0.07, (v0+v1)/2, { color:'#b45309', size:'11px' });

    addLabel(scene, ktx('dA_{uv} = du\\,dv'),
             0.68, 1.22, { color:'#b45309', size:'11px' });

    // title
    addLabel(scene, '<b>(u, v)</b>-平面',
             -0.10, -0.22, { color:'#1e3a8a', size:'12px' });
  },
});

// ── right panel: (x, y)-plane with the image grid of 5×5 parallelograms ──────

makePanel({
  containerId: 'chpt11-jacobian-xy',
  xMin: -0.25, xMax: 2.15,
  yMin: -0.25, yMax: 2.15,
  draw(scene) {
    for (let j = 0; j < NV; j++) {
      for (let i = 0; i < NU; i++) {
        const u0 = i/NU, u1 = (i+1)/NU, v0 = j/NV, v1 = (j+1)/NV;
        const P = [[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v]) => {
          const [x,y] = phi(u, v); return { x, y };
        });
        const isHi = (i === IH_U && j === IH_V);
        fillQuad(scene, P, isHi ? 0xf59e0b : 0xdbeafe, isHi ? 0.85 : 0.45);
      }
    }
    // grid lines (deformed)
    const gridMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    const mkLine = (pts) => new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        pts.map(p => new THREE.Vector3(p.x, p.y, 0))), gridMat);
    for (let i = 0; i <= NU; i++) {
      const pts = [[i/NU, 0], [i/NU, 1]].map(([u,v]) => {
        const [x,y] = phi(u,v); return { x, y };
      });
      scene.add(mkLine(pts));
    }
    for (let j = 0; j <= NV; j++) {
      const pts = [[0, j/NV], [1, j/NV]].map(([u,v]) => {
        const [x,y] = phi(u,v); return { x, y };
      });
      scene.add(mkLine(pts));
    }
    // image-of-boundary parallelogram
    const corners = [[0,0],[1,0],[1,1],[0,1]].map(([u,v]) => {
      const [x,y] = phi(u,v); return { x, y };
    });
    strokeLoop(scene, corners, 0x1e3a8a);

    // axes
    arrow(scene, {x:-0.15,y:0}, {x:2.05,y:0}, 0x374151, 0.10, 0.05);
    arrow(scene, {x:0,y:-0.15}, {x:0,y:2.05}, 0x374151, 0.10, 0.05);
    addLabel(scene, ktx('x'), 2.10, 0, { size:'12px' });
    addLabel(scene, ktx('y'), 0, 2.10, { size:'12px' });
    addLabel(scene, ktx('O'), -0.07, -0.07, { color:'#6b7280', size:'10px' });

    // basis-image vectors at origin:  ∂φ/∂u = (A11, A21),  ∂φ/∂v = (A12, A22)
    arrow(scene, {x:0,y:0}, {x:A11,y:A21}, 0x0f766e, 0.10, 0.05);
    arrow(scene, {x:0,y:0}, {x:A12,y:A22}, 0xa21caf, 0.10, 0.05);
    addLabel(scene, ktx('\\dfrac{\\partial\\varphi}{\\partial u}'),
             A11 + 0.08, A21 - 0.05, { color:'#0f766e', size:'11px' });
    addLabel(scene, ktx('\\dfrac{\\partial\\varphi}{\\partial v}'),
             A12 - 0.30, A22 + 0.02, { color:'#a21caf', size:'11px' });

    // highlighted image cell annotation
    const hi_u_c = (IH_U + 0.5)/NU, hi_v_c = (IH_V + 0.5)/NV;
    const [hx, hy] = phi(hi_u_c, hi_v_c);
    addLabel(scene,
             ktx('dA_{xy} = |J|\\,du\\,dv'),
             hx + 0.05, hy + 0.18,
             { color:'#b45309', size:'11px' });

    // title + map annotation + det value
    addLabel(scene, '<b>(x, y)</b>-平面',
             -0.10, -0.22, { color:'#1e3a8a', size:'12px' });
    addLabel(scene,
             ktx('\\varphi(u,v) = (1.2u + 0.6v,\\; 0.4u + 1.3v)'),
             0.20, 1.95, { color:'#1e293b', size:'11px' });
    addLabel(scene,
             ktx('|J| = 1.32'),
             0.20, 1.80, { color:'#b45309', size:'12px' });
  },
});
