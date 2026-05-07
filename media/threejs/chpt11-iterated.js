/**
 * chpt11-iterated.js
 * §11.3 motivation: iterated integration via slabs.
 *
 *   z = f(x,y) = 0.6 + 0.4 sin(πx) sin(πy)   on   D = [0,1] × [0,1]
 *
 * Two side-by-side 3-D panels show the same solid sliced two different ways:
 *
 *   Left  (chpt11-iterated-x)  — slabs ⟂ x-axis; slider picks x = x₀,
 *                                 highlights the slab and the cross-section
 *                                 curve z = f(x₀, y); reports the area
 *                                 A(x₀) = ∫₀¹ f(x₀, y) dy.
 *
 *   Right (chpt11-iterated-y)  — slabs ⟂ y-axis; slider picks y = y₀,
 *                                 highlights cross-section z = f(x, y₀);
 *                                 reports B(y₀) = ∫₀¹ f(x, y₀) dx.
 *
 * Coordinate convention (math → Three.js):
 *   math x → three.x, math y → three.-z, math z → three.y.
 */

import * as THREE                     from 'three';
import { OrbitControls }              from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

// ── shared math ────────────────────────────────────────────────────────────

function f(x, y) { return 0.6 + 0.4 * Math.sin(Math.PI * x) * Math.sin(Math.PI * y); }

function V(mx, my, mz) { return new THREE.Vector3(mx, mz, -my); }

// Trapezoid integration on [0,1] for a slab cross-section.
function sliceArea(fixedAxis, t) {
  const N = 200;
  const h = 1 / N;
  let s = 0;
  for (let i = 0; i <= N; i++) {
    const u = i * h;
    const v = (fixedAxis === 'x') ? f(t, u) : f(u, t);
    s += (i === 0 || i === N) ? 0.5 * v : v;
  }
  return s * h;
}

// ── per-panel factory ──────────────────────────────────────────────────────

function makePanel({ containerId, fixedAxis, sliderLabel }) {
  const container = document.getElementById(containerId);
  if (!container) return null;
  container.style.position = 'relative';

  // ── renderers ─────────────────────────────────────────────────────────
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

  // ── scene + camera ────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  camera.position.set(1.6, 1.4, 1.6);
  camera.lookAt(0.5, 0.4, -0.5);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0.5, 0.4, -0.5);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(2, 3, 1.5);
  scene.add(dir);

  // ── solid surface (top of the prism) ──────────────────────────────────
  {
    const RES = 60;
    const geo = new THREE.PlaneGeometry(1, 1, RES, RES);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0.5, 0, -0.5);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);   // math y = -z_three
      pos.setY(i, f(x, -z));
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x9bb5d6, transparent: true, opacity: 0.55,
      side: THREE.DoubleSide, roughness: 0.7,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
  }

  // ── floor (z=0 face of the prism) ─────────────────────────────────────
  {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate(0.5, 0, -0.5);
    const m = new THREE.MeshBasicMaterial({
      color: 0xeeeeee, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
    });
    scene.add(new THREE.Mesh(g, m));
  }

  // ── axes ──────────────────────────────────────────────────────────────
  {
    const matAxis = new THREE.LineBasicMaterial({ color: 0x111111 });
    const seg = (a, b) =>
      new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), matAxis);
    scene.add(seg(V(0, 0, 0), V(1.15, 0, 0)));   // x
    scene.add(seg(V(0, 0, 0), V(0, 1.15, 0)));   // y
    scene.add(seg(V(0, 0, 0), V(0, 0, 1.15)));   // z
    function tag(text, p) {
      const d = document.createElement('div');
      d.textContent = text;
      d.style.cssText =
        'font:13px/1 -apple-system,sans-serif;color:#111;';
      const o = new CSS2DObject(d);
      o.position.copy(p);
      scene.add(o);
    }
    tag('x', V(1.20, 0, 0));
    tag('y', V(0, 0, 1.20));   // remember: math y = three -z; +y axis in math sits along three.-z
    tag('z', V(0, 1.20, 0));
  }

  // ── slab + cross-section group (rebuilt per slider tick) ──────────────
  const slabGroup = new THREE.Group();
  scene.add(slabGroup);
  let curveLabel = null;

  function setSlice(t) {
    // Clear previous slab artefacts.
    while (slabGroup.children.length) {
      const c = slabGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    if (curveLabel) { scene.remove(curveLabel); curveLabel = null; }

    // 1. Translucent thin slab orthogonal to the chosen axis.
    const slabHalf = 0.012;
    const slabGeo = new THREE.BoxGeometry(
      fixedAxis === 'x' ? 2 * slabHalf : 1,
      1.2,                          // tall enough
      fixedAxis === 'y' ? 2 * slabHalf : 1
    );
    const slabMat = new THREE.MeshBasicMaterial({
      color: fixedAxis === 'x' ? 0xea580c : 0x7c3aed,
      transparent: true, opacity: 0.18,
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    if (fixedAxis === 'x') slab.position.set(t, 0.6, -0.5);
    else                   slab.position.set(0.5, 0.6, -t);
    slabGroup.add(slab);

    // 2. Cross-section curve (z = f(t, u)) drawn as a thick polyline.
    const curvePts = [];
    const M = 80;
    for (let i = 0; i <= M; i++) {
      const u = i / M;
      const z = (fixedAxis === 'x') ? f(t, u) : f(u, t);
      const p = (fixedAxis === 'x') ? V(t, u, z) : V(u, t, z);
      curvePts.push(p);
    }
    const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePts);
    const curveMat = new THREE.LineBasicMaterial({
      color: fixedAxis === 'x' ? 0xea580c : 0x7c3aed, linewidth: 2,
    });
    slabGroup.add(new THREE.Line(curveGeo, curveMat));

    // 3. Filled cross-section under the curve, semi-transparent.
    {
      const verts = [];
      for (let i = 0; i < M; i++) {
        const u0 = i / M, u1 = (i + 1) / M;
        const z0 = (fixedAxis === 'x') ? f(t, u0) : f(u0, t);
        const z1 = (fixedAxis === 'x') ? f(t, u1) : f(u1, t);
        const a = (fixedAxis === 'x') ? V(t, u0, 0)  : V(u0, t, 0);
        const b = (fixedAxis === 'x') ? V(t, u1, 0)  : V(u1, t, 0);
        const c = (fixedAxis === 'x') ? V(t, u1, z1) : V(u1, t, z1);
        const d = (fixedAxis === 'x') ? V(t, u0, z0) : V(u0, t, z0);
        verts.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        verts.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
      }
      const fillGeo = new THREE.BufferGeometry();
      fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
      fillGeo.computeVertexNormals();
      const fillMat = new THREE.MeshBasicMaterial({
        color: fixedAxis === 'x' ? 0xea580c : 0x7c3aed,
        transparent: true, opacity: 0.45, side: THREE.DoubleSide,
      });
      slabGroup.add(new THREE.Mesh(fillGeo, fillMat));
    }

    // 4. Numeric label at the top of the slab.
    const A = sliceArea(fixedAxis, t);
    const labelDiv = document.createElement('div');
    labelDiv.style.cssText =
      'font:13px/1.2 -apple-system,sans-serif;color:#111;'
      + 'background:rgba(255,255,255,0.92);padding:2px 6px;border-radius:3px;'
      + 'border:1px solid ' + (fixedAxis === 'x' ? '#ea580c' : '#7c3aed') + ';'
      + 'white-space:nowrap;';
    labelDiv.innerHTML = (fixedAxis === 'x'
      ? 'A(x) = ' : 'B(y) = ') + A.toFixed(3);
    curveLabel = new CSS2DObject(labelDiv);
    const top = (fixedAxis === 'x') ? V(t, 0.5, 1.05) : V(0.5, t, 1.05);
    curveLabel.position.copy(top);
    scene.add(curveLabel);
  }

  // ── HTML slider strip at the bottom ───────────────────────────────────
  const strip = document.createElement('div');
  strip.style.cssText =
    'position:absolute;left:0;right:0;bottom:0;padding:8px 12px;'
    + 'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;'
    + 'font:13px/1.2 -apple-system,sans-serif;color:#374151;'
    + 'display:flex;align-items:center;gap:10px;';
  container.appendChild(strip);

  const sliderEl = document.createElement('input');
  sliderEl.type = 'range';
  sliderEl.min = '0.05'; sliderEl.max = '0.95'; sliderEl.step = '0.01';
  sliderEl.value = '0.5';
  sliderEl.style.cssText = 'flex:1;min-width:0;';
  const labelEl = document.createElement('span');
  labelEl.style.cssText = 'font-variant-numeric:tabular-nums;min-width:5em;';
  strip.appendChild(document.createTextNode(sliderLabel + ' ='));
  strip.appendChild(sliderEl);
  strip.appendChild(labelEl);

  function refresh() {
    const t = parseFloat(sliderEl.value);
    labelEl.textContent = t.toFixed(2);
    setSlice(t);
  }
  sliderEl.addEventListener('input', refresh);

  // ── resize + animate ──────────────────────────────────────────────────
  function resize() {
    const r = container.getBoundingClientRect();
    const stripH = strip.getBoundingClientRect().height;
    const w = r.width, h = Math.max(1, r.height - stripH);
    renderer.setSize(w, h, false);
    labelRenderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(container);

  refresh();

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  })();

  return { setSlice, refresh };
}

makePanel({
  containerId: 'chpt11-iterated-x',
  fixedAxis:   'x',
  sliderLabel: 'x',
});

makePanel({
  containerId: 'chpt11-iterated-y',
  fixedAxis:   'y',
  sliderLabel: 'y',
});
