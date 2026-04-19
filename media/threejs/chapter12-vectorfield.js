/**
 * chapter12-vectorfield.js
 * Two 3-D vector field visualisations for Chapter 12.
 *
 *  Left  (#vf3d-helix)  — Helical field   F(x,y,z) = (−z, 0.5, x)
 *  Right (#vf3d-dipole) — Magnetic dipole F = (r−p₊)/|…|³ − (r−p₋)/|…|³
 *
 * Each scene: streamline tubes + cone-arrow glyphs + OrbitControls.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ═══════════════════════════════════════════════════════════════════════════
//  Shared helpers
// ═══════════════════════════════════════════════════════════════════════════

/** One RK4 step along the (normalised) field. */
function rk4(p, fieldFn, dt) {
  const nrm = (v) => { const m = v.length(); return m < 1e-12 ? v : v.divideScalar(m); };
  const f = (q) => nrm(fieldFn(q));
  const k1 = f(p);
  const k2 = f(p.clone().addScaledVector(k1, dt * 0.5));
  const k3 = f(p.clone().addScaledVector(k2, dt * 0.5));
  const k4 = f(p.clone().addScaledVector(k3, dt));
  return p.clone().add(
    new THREE.Vector3()
      .addScaledVector(k1, 1 / 6)
      .addScaledVector(k2, 1 / 3)
      .addScaledVector(k3, 1 / 3)
      .addScaledVector(k4, 1 / 6)
      .multiplyScalar(dt)
  );
}

/**
 * Trace a streamline using RK4.
 * @param {THREE.Vector3}   start
 * @param {function}        fieldFn  p → THREE.Vector3
 * @param {number}          dt       step size
 * @param {number}          maxSteps
 * @param {function}        inBounds p → bool  (return false to stop)
 */
function traceStreamline(start, fieldFn, dt, maxSteps, inBounds) {
  const pts = [start.clone()];
  let p = start.clone();
  for (let i = 0; i < maxSteps; i++) {
    const next = rk4(p, fieldFn, dt);
    if (!inBounds(next)) break;
    pts.push(next);
    p = next;
  }
  return pts;
}

/**
 * Build a Group containing a tube mesh + cone-arrow glyphs for one streamline.
 * @param {THREE.Vector3[]} pts
 * @param {THREE.Color}     color
 * @param {number}          arrowEvery  place a cone every N points
 */
function buildStreamline(pts, color, arrowEvery = 20) {
  if (pts.length < 4) return null;
  const grp = new THREE.Group();

  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const segs  = Math.max(pts.length * 3, 80);

  // ── tube ────────────────────────────────────────────────────────────────
  const tubeGeo = new THREE.TubeGeometry(curve, segs, 0.018, 7, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color,
    roughness  : 0.45,
    metalness  : 0.25,
    emissive   : color,
    emissiveIntensity: 0.30,
  });
  grp.add(new THREE.Mesh(tubeGeo, tubeMat));

  // ── cone arrows ──────────────────────────────────────────────────────────
  const coneGeo = new THREE.ConeGeometry(0.048, 0.13, 8);
  const coneMat = new THREE.MeshStandardMaterial({
    color,
    roughness  : 0.30,
    metalness  : 0.40,
    emissive   : color,
    emissiveIntensity: 0.55,
  });
  const UP = new THREE.Vector3(0, 1, 0);
  const N  = pts.length;

  for (let i = arrowEvery; i < N - 4; i += arrowEvery) {
    const t   = i / N;
    const pos = curve.getPoint(t);
    const tan = curve.getTangent(t);
    if (tan.length() < 0.5) continue;
    tan.normalize();
    const mesh = new THREE.Mesh(coneGeo, coneMat);
    mesh.position.copy(pos);
    mesh.quaternion.setFromUnitVectors(UP, tan);
    grp.add(mesh);
  }
  return grp;
}

/**
 * Create a Three.js scene inside `containerId`.
 * Returns { renderer, scene, camera, controls } or null.
 */
function createScene(containerId, bgColor, camPos, buildFn) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(bgColor, 1);
  renderer.domElement.style.cssText =
    'position:absolute;top:0;left:0;width:100%;height:100%;display:block;';
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const W = container.clientWidth  || 480;
  const H = container.clientHeight || 420;
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.05, 200);
  camera.position.copy(camPos);
  camera.lookAt(0, 0, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping  = true;
  controls.dampingFactor  = 0.06;
  controls.target.set(0, 0, 0);

  // lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.9);
  sun.position.set(6, 10, 6);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x8899cc, 0.4);
  fill.position.set(-4, -2, -5);
  scene.add(fill);

  buildFn(scene);

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  return { renderer, scene, camera, controls };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Scene A — Helical field   F(x,y,z) = (−z, 0.5, x)
// ═══════════════════════════════════════════════════════════════════════════
const helixScene = createScene(
  'vf3d-helix',
  0x04080f,
  new THREE.Vector3(4.5, 2.0, 6.5),
  (scene) => {
    const field = (p) => new THREE.Vector3(-p.z, 0.5, p.x);

    // stop outside a cylinder of radius 2.2 or past y bounds
    const inBounds = (p) =>
      p.y < 2.8 && p.y > -3.2 && (p.x * p.x + p.z * p.z) < 5.0;

    const radii  = [0.35, 0.72, 1.12, 1.55];
    const nAngle = 8;  // streamlines per ring

    radii.forEach((r, ri) => {
      for (let ai = 0; ai < nAngle; ai++) {
        const angle  = (ai / nAngle) * Math.PI * 2;
        const start  = new THREE.Vector3(r * Math.cos(angle), -2.4, r * Math.sin(angle));
        const pts    = traceStreamline(start, field, 0.055, 600, inBounds);
        if (pts.length < 10) continue;

        // colour: hue by azimuth, brightness by radius
        const hue   = (ai / nAngle + ri * 0.05) % 1;
        const light = 0.50 + ri * 0.06;
        const color = new THREE.Color().setHSL(hue, 0.90, light);
        const mesh  = buildStreamline(pts, color, 22);
        if (mesh) scene.add(mesh);
      }
    });

    // thin central axis
    const axGeo = new THREE.CylinderGeometry(0.012, 0.012, 6.2, 8);
    const axMat = new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 1 });
    scene.add(new THREE.Mesh(axGeo, axMat));
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  Scene B — Magnetic dipole
// ═══════════════════════════════════════════════════════════════════════════
const P_PLUS  = new THREE.Vector3(0,  1.3, 0);
const P_MINUS = new THREE.Vector3(0, -1.3, 0);

function dipoleField(p) {
  const r1 = p.clone().sub(P_PLUS);
  const r2 = p.clone().sub(P_MINUS);
  const d1 = Math.max(r1.length(), 0.06);
  const d2 = Math.max(r2.length(), 0.06);
  // positive charge at P_PLUS repels, negative at P_MINUS attracts
  return r1.divideScalar(d1 * d1 * d1).sub(r2.divideScalar(d2 * d2 * d2));
}

const dipoleScene = createScene(
  'vf3d-dipole',
  0x06030f,
  new THREE.Vector3(0.5, 0.5, 6.5),
  (scene) => {
    // ── glowing spheres ────────────────────────────────────────────────────
    const sphGeo = new THREE.SphereGeometry(0.20, 32, 32);

    // positive — red/orange
    const posLight = new THREE.PointLight(0xff5500, 3.0, 5.5);
    posLight.position.copy(P_PLUS);
    scene.add(posLight);
    const posMesh = new THREE.Mesh(sphGeo, new THREE.MeshStandardMaterial({
      color: 0xff4422, emissive: 0xff3311, emissiveIntensity: 1.4,
      roughness: 0.25, metalness: 0.5,
    }));
    posMesh.position.copy(P_PLUS);
    scene.add(posMesh);

    // negative — blue
    const negLight = new THREE.PointLight(0x2255ff, 3.0, 5.5);
    negLight.position.copy(P_MINUS);
    scene.add(negLight);
    const negMesh = new THREE.Mesh(sphGeo, new THREE.MeshStandardMaterial({
      color: 0x2244ff, emissive: 0x1133ff, emissiveIntensity: 1.4,
      roughness: 0.25, metalness: 0.5,
    }));
    negMesh.position.copy(P_MINUS);
    scene.add(negMesh);

    // ── field lines ────────────────────────────────────────────────────────
    const N_LINES  = 32;
    const START_R  = 0.38;
    const inBounds = (p) =>
      p.distanceTo(P_MINUS) > 0.16 &&   // absorbed by sink
      p.length() < 5.0;

    // Fibonacci sphere around P_PLUS for well-distributed start points
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N_LINES; i++) {
      const y_fib  = 1 - (i / (N_LINES - 1)) * 2;  // 1 → −1
      const rho    = Math.sqrt(Math.max(0, 1 - y_fib * y_fib));
      const theta  = phi * i;

      const dir    = new THREE.Vector3(rho * Math.cos(theta), y_fib, rho * Math.sin(theta));
      // skip lines pointing directly at P_MINUS (y_fib very negative) — boring axis lines
      if (y_fib < -0.90) continue;

      const start = P_PLUS.clone().addScaledVector(dir, START_R);
      const pts   = traceStreamline(start, dipoleField, 0.050, 700, inBounds);
      if (pts.length < 6) continue;

      // colour: latitude of start → hue from orange (goes far out) to violet (stays close)
      // y_fib ≈ 1 means pointing UP (away from P_MINUS) → line travels far → warm
      // y_fib ≈ −1 means pointing DOWN (toward P_MINUS) → short line → cool
      const t     = (y_fib + 1) / 2;   // 0..1
      const hue   = (1 - t) * 0.72;    // 0 = red, 0.72 ≈ violet
      const color = new THREE.Color().setHSL(hue, 0.95, 0.62);
      const mesh  = buildStreamline(pts, color, 20);
      if (mesh) scene.add(mesh);
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
//  Shared animation loop
// ═══════════════════════════════════════════════════════════════════════════
function animate() {
  requestAnimationFrame(animate);
  if (helixScene) {
    helixScene.controls.update();
    helixScene.renderer.render(helixScene.scene, helixScene.camera);
  }
  if (dipoleScene) {
    dipoleScene.controls.update();
    dipoleScene.renderer.render(dipoleScene.scene, dipoleScene.camera);
  }
}
animate();
