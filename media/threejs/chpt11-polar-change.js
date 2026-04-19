/**
 * chpt11-polar-change.js
 * Polar-coordinate change-of-variables in 2D.
 *
 * Two panels, side-by-side:
 *   Left  — (r, θ) rectangle [0,1] × [0, π/2] tiled by a uniform grid.
 *   Right — (x, y) image under (x, y) = (r cosθ, r sinθ): the quarter disk,
 *           tiled by the corresponding polar cells.
 *
 * One cell is highlighted on both sides so the stretching factor
 *     dx dy = r · dr · dθ
 * becomes visible: near r = 0 the sector is tiny; near r = 1 it has full
 * angular length. Matching (r,θ) cells have the same rectangular area,
 * but their images have area proportional to r.
 *
 * Uses an orthographic camera (2D diagram).
 */

import * as THREE                     from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// grid: 5 divisions in r, 6 divisions in θ
const NR = 5, NT = 6;
const IH_R = 3, IH_T = 2;              // highlighted cell: r ∈ [3/5, 4/5], θ bucket 2

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

function fillPolyline(scene, pts, color, opacity) {
  if (pts.length < 3) return;
  const verts = [];
  for (let k = 1; k < pts.length - 1; k++) {
    verts.push(pts[0].x, pts[0].y, 0,
               pts[k].x, pts[k].y, 0,
               pts[k+1].x, pts[k+1].y, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
  })));
}
function strokePolyline(scene, pts, color, closed = false) {
  const P = pts.map(p => new THREE.Vector3(p.x, p.y, 0));
  if (closed) P.push(P[0]);
  scene.add(new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(P),
    new THREE.LineBasicMaterial({ color }),
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
function arrow(scene, p, q, color, headLen = 0.06, headWidth = 0.035) {
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

// ── left panel: (r, θ) rectangle [0,1] × [0, π/2] ────────────────────────────

const THETA_MAX = Math.PI / 2;

makePanel({
  containerId: 'chpt11-polar-rtheta',
  xMin: -0.25, xMax: 1.25,
  yMin: -0.25, yMax: THETA_MAX + 0.25,
  draw(scene) {
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NR; i++) {
        const r0 = i/NR, r1 = (i+1)/NR;
        const t0 = (j/NT)*THETA_MAX, t1 = ((j+1)/NT)*THETA_MAX;
        const isHi = (i === IH_R && j === IH_T);
        fillPolyline(scene,
          [{x:r0,y:t0},{x:r1,y:t0},{x:r1,y:t1},{x:r0,y:t1}],
          isHi ? 0xf59e0b : 0xdcfce7,
          isHi ? 0.85 : 0.45);
      }
    }
    const gridMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    for (let i = 0; i <= NR; i++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(i/NR, 0, 0),
          new THREE.Vector3(i/NR, THETA_MAX, 0)]),
        gridMat));
    }
    for (let j = 0; j <= NT; j++) {
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, (j/NT)*THETA_MAX, 0),
          new THREE.Vector3(1, (j/NT)*THETA_MAX, 0)]),
        gridMat));
    }
    strokePolyline(scene, [
      {x:0,y:0},{x:1,y:0},{x:1,y:THETA_MAX},{x:0,y:THETA_MAX},
    ], 0x166534, true);

    // axes
    arrow(scene, {x:-0.15,y:0}, {x:1.18,y:0}, 0x374151, 0.08, 0.04);
    arrow(scene, {x:0,y:-0.15}, {x:0,y:THETA_MAX+0.18}, 0x374151, 0.08, 0.04);
    addLabel(scene, ktx('r'), 1.22, 0, { size:'12px' });
    addLabel(scene, ktx('\\theta'), 0, THETA_MAX+0.22, { size:'12px' });
    addLabel(scene, ktx('O'), -0.06, -0.08, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('1'), 1.0, -0.08, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('\\tfrac{\\pi}{2}'), -0.10, THETA_MAX,
             { color:'#6b7280', size:'10px' });

    // highlighted-cell annotation
    const r0 = IH_R/NR, r1 = (IH_R+1)/NR;
    const t0 = (IH_T/NT)*THETA_MAX, t1 = ((IH_T+1)/NT)*THETA_MAX;
    addLabel(scene, ktx('dr'), (r0+r1)/2, t0 - 0.08,
             { color:'#b45309', size:'11px' });
    addLabel(scene, ktx('d\\theta'), r0 - 0.09, (t0+t1)/2,
             { color:'#b45309', size:'11px' });
    addLabel(scene, ktx('dA_{r\\theta} = dr\\,d\\theta'),
             0.55, THETA_MAX+0.10, { color:'#b45309', size:'11px' });

    addLabel(scene, '<b>(r, θ)</b>-平面',
             -0.10, -0.22, { color:'#166534', size:'12px' });
  },
});

// ── right panel: (x, y) quarter disk under (x,y) = (r cos θ, r sin θ) ───────

makePanel({
  containerId: 'chpt11-polar-xy',
  xMin: -0.25, xMax: 1.25,
  yMin: -0.25, yMax: 1.25,
  draw(scene) {
    const MT = 10;    // sub-samples along the arc for smooth curvature
    for (let j = 0; j < NT; j++) {
      for (let i = 0; i < NR; i++) {
        const r0 = i/NR, r1 = (i+1)/NR;
        const t0 = (j/NT)*THETA_MAX, t1 = ((j+1)/NT)*THETA_MAX;
        const ring = [];
        // outer arc  θ: t0 → t1 at r = r1
        for (let k = 0; k <= MT; k++) {
          const t = t0 + (k/MT)*(t1 - t0);
          ring.push({ x: r1*Math.cos(t), y: r1*Math.sin(t) });
        }
        // inner arc θ: t1 → t0 at r = r0
        for (let k = 0; k <= MT; k++) {
          const t = t1 - (k/MT)*(t1 - t0);
          ring.push({ x: r0*Math.cos(t), y: r0*Math.sin(t) });
        }
        const isHi = (i === IH_R && j === IH_T);
        fillPolyline(scene, ring,
          isHi ? 0xf59e0b : 0xdcfce7,
          isHi ? 0.85 : 0.45);
      }
    }

    // polar grid lines on (x,y)
    const gridMat = new THREE.LineBasicMaterial({ color: 0x64748b });
    // concentric arcs
    for (let i = 0; i <= NR; i++) {
      const r = i/NR, pts = [];
      const M = 64;
      for (let k = 0; k <= M; k++) {
        const t = (k/M)*THETA_MAX;
        pts.push(new THREE.Vector3(r*Math.cos(t), r*Math.sin(t), 0));
      }
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    // radial rays
    for (let j = 0; j <= NT; j++) {
      const t = (j/NT)*THETA_MAX;
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(t), Math.sin(t), 0)]),
        gridMat));
    }
    // boundary of quarter disk (emphasised)
    {
      const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(1,0,0)];
      const M = 64;
      for (let k = 0; k <= M; k++) {
        const t = (k/M)*THETA_MAX;
        pts.push(new THREE.Vector3(Math.cos(t), Math.sin(t), 0));
      }
      pts.push(new THREE.Vector3(0, 0, 0));
      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x166534 }),
      ));
    }

    // axes
    arrow(scene, {x:-0.15,y:0}, {x:1.18,y:0}, 0x374151, 0.08, 0.04);
    arrow(scene, {x:0,y:-0.15}, {x:0,y:1.18}, 0x374151, 0.08, 0.04);
    addLabel(scene, ktx('x'), 1.22, 0, { size:'12px' });
    addLabel(scene, ktx('y'), 0, 1.22, { size:'12px' });
    addLabel(scene, ktx('O'), -0.06, -0.08, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('1'), 1.0, -0.08, { color:'#6b7280', size:'10px' });
    addLabel(scene, ktx('1'), -0.08, 1.0, { color:'#6b7280', size:'10px' });

    // highlighted-cell annotation — use its mid-radius centre
    const r0 = IH_R/NR, r1 = (IH_R+1)/NR;
    const t0 = (IH_T/NT)*THETA_MAX, t1 = ((IH_T+1)/NT)*THETA_MAX;
    const rC = (r0+r1)/2, tC = (t0+t1)/2;
    addLabel(scene,
             ktx('r\\,dr'),
             rC*Math.cos(tC) + 0.08, rC*Math.sin(tC) - 0.14,
             { color:'#b45309', size:'11px' });
    addLabel(scene,
             ktx('r\\,d\\theta'),
             rC*Math.cos(tC) + 0.13, rC*Math.sin(tC) + 0.04,
             { color:'#b45309', size:'11px' });
    addLabel(scene,
             ktx('dA_{xy} = r\\,dr\\,d\\theta'),
             0.48, 1.12, { color:'#b45309', size:'11px' });

    addLabel(scene, '<b>(x, y)</b>-平面',
             -0.10, -0.22, { color:'#166534', size:'12px' });
  },
});
