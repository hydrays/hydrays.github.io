/**
 * chpt14-jacobi.js
 * §14.3 Jacobi iteration converges to the discrete harmonic solution.
 *
 * Domain: a square N × N grid (N ≈ 60).
 * Boundary conditions (fixed): four sides have a smooth pattern.
 *   top:    u = sin(π i / (N-1))         (a hump along the top)
 *   bottom: u = 0
 *   left:   u = (j / (N-1))                (linear)
 *   right:  u = 1 - (j / (N-1))           (linear, mirrored)
 *
 * Iteration: u^(k+1)(i, j) ← (u^(k)(i+1, j) + u^(k)(i-1, j)
 *                           + u^(k)(i, j+1) + u^(k)(i, j-1)) / 4
 * applied at interior nodes; boundary nodes stay fixed.
 *
 * Visual:
 *   - Heatmap of u over the grid (viridis), boundary always shown.
 *   - Slider drives the iteration count k ∈ {0, 1, …, K_MAX}.
 *   - At k = 0 the interior is uniform 0.5; with each step the field
 *     gets smoother and approaches the discrete harmonic limit.
 *   - Display the per-step max change "‖u^(k) - u^(k-1)‖∞" so the
 *     reader can watch convergence numerically.
 *
 * Math (i, j) → math (x = i, y = j) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

// ── Grid and boundary ─────────────────────────────────────────────────────

const N = 60;
const K_MAX = 600;

function bcTop(i)    { return Math.sin(Math.PI * i / (N - 1)); }
function bcBottom(i) { return 0; }
function bcLeft(j)   { return j / (N - 1); }
function bcRight(j)  { return 1 - j / (N - 1); }

// Allocate the K snapshots: too large to keep all states in memory if K_MAX is big.
// Trick: store every state we'll need to display lazily — but here we just snapshot
// all K_MAX states at iteration boundaries. 60×60 doubles × 600 ≈ 17 MB; OK.
const states = new Array(K_MAX + 1);
const maxDelta = new Float64Array(K_MAX + 1);
{
  const u = new Float64Array(N * N);
  // Interior init = 0.5 (mid-range), boundaries set immediately.
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      let v;
      if (j === 0)         v = bcBottom(i);
      else if (j === N-1)  v = bcTop(i);
      else if (i === 0)    v = bcLeft(j);
      else if (i === N-1)  v = bcRight(j);
      else                 v = 0.5;
      u[j * N + i] = v;
    }
  }
  states[0] = u.slice();
  let prev = u;
  let cur = new Float64Array(N * N);
  for (let k = 1; k <= K_MAX; k++) {
    // Copy boundary
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        if (i === 0 || i === N-1 || j === 0 || j === N-1) {
          cur[j * N + i] = prev[j * N + i];
        }
      }
    }
    let mx = 0;
    for (let j = 1; j < N - 1; j++) {
      for (let i = 1; i < N - 1; i++) {
        const v = 0.25 * (
          prev[j * N + (i + 1)] +
          prev[j * N + (i - 1)] +
          prev[(j + 1) * N + i] +
          prev[(j - 1) * N + i]
        );
        const d = Math.abs(v - prev[j * N + i]);
        if (d > mx) mx = d;
        cur[j * N + i] = v;
      }
    }
    states[k] = cur.slice();
    maxDelta[k] = mx;
    [prev, cur] = [cur, prev];
  }
}

// Determine global heatmap range from any state (use the converged state).
const final = states[K_MAX];
let GLO_LO = +Infinity, GLO_HI = -Infinity;
for (let i = 0; i < final.length; i++) {
  const v = final[i];
  if (v < GLO_LO) GLO_LO = v;
  if (v > GLO_HI) GLO_HI = v;
}
if (GLO_HI - GLO_LO < 1e-9) GLO_HI = GLO_LO + 1;

// ── Container, renderer, camera ───────────────────────────────────────────

const container = document.getElementById('chpt14-jacobi');
container.style.position = 'relative';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setClearColor(0xfafafa, 1);
renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
container.appendChild(renderer.domElement);

// Math viewport: x, y ∈ [0, N-1].
const X0 = -1, X1 = N, Y0 = -1, Y1 = N;
const W = X1 - X0, H = Y1 - Y0;

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
camera.position.set((X0 + X1) / 2, 10, -(Y0 + Y1) / 2);
camera.lookAt(new THREE.Vector3((X0 + X1) / 2, 0, -(Y0 + Y1) / 2));
camera.up.set(0, 0, -1);

const scene = new THREE.Scene();

function fitCamera() {
  const rect = container.getBoundingClientRect();
  const overlayH = (typeof overlay !== "undefined" && overlay) ? overlay.offsetHeight : 0;
  const canvasH = Math.max(1, rect.height - overlayH);
  const aspect = rect.width / canvasH;
  const dataAspect = W / H;
  let halfW, halfH;
  if (aspect >= dataAspect) {
    halfH = H / 2;
    halfW = halfH * aspect;
  } else {
    halfW = W / 2;
    halfH = halfW / aspect;
  }
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  renderer.setSize(rect.width, canvasH, true);
}

// ── Viridis ramp ──────────────────────────────────────────────────────────

const STOPS = [
  { r: 0.267, g: 0.005, b: 0.329 },
  { r: 0.231, g: 0.318, b: 0.545 },
  { r: 0.129, g: 0.565, b: 0.553 },
  { r: 0.992, g: 0.906, b: 0.144 },
];
function ramp(t) {
  t = Math.max(0, Math.min(1, t));
  const n = STOPS.length - 1;
  const idx = Math.min(n - 1, Math.floor(t * n));
  const u = t * n - idx;
  const a = STOPS[idx], b = STOPS[idx + 1];
  return { r: a.r + (b.r - a.r) * u, g: a.g + (b.g - a.g) * u, b: a.b + (b.b - a.b) * u };
}

// ── Grid mesh: a single PlaneGeometry of N × N quads, vertex-coloured ─────

const gridGeo = new THREE.PlaneGeometry(N - 1, N - 1, N - 1, N - 1);
gridGeo.rotateX(-Math.PI / 2);
gridGeo.translate((N - 1) / 2, 0, -(N - 1) / 2);
gridGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Array((N) * (N) * 3).fill(0.5), 3));
const gridMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
const gridMesh = new THREE.Mesh(gridGeo, gridMat);
scene.add(gridMesh);

function applyState(state) {
  const colors = gridGeo.attributes.color.array;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const v = state[j * N + i];
      const t = (v - GLO_LO) / (GLO_HI - GLO_LO);
      const c = ramp(t);
      const idx = (j * N + i) * 3;
      colors[idx]     = c.r;
      colors[idx + 1] = c.g;
      colors[idx + 2] = c.b;
    }
  }
  gridGeo.attributes.color.needsUpdate = true;
}

// ── HTML overlay ──────────────────────────────────────────────────────────

const overlay = document.createElement('div');
overlay.style.cssText =
  'position:absolute;left:0;right:0;bottom:0;padding:10px 14px;' +
  'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
  'font:14px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
  'display:flex;gap:14px;align-items:center;flex-wrap:wrap;';
container.appendChild(overlay);

const lab = document.createElement('label');
lab.style.cssText = 'display:flex;align-items:center;gap:8px;';
lab.innerHTML = '<span style="white-space:nowrap">迭代次数 k =</span>';
const slider = document.createElement('input');
slider.type = 'range';
slider.min = '0';
slider.max = String(K_MAX);
slider.step = '1';
slider.value = '0';
slider.style.cssText = 'width:240px;';
const kReadout = document.createElement('span');
kReadout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:4ch;';
kReadout.textContent = '0';
lab.appendChild(slider);
lab.appendChild(kReadout);
overlay.appendChild(lab);

const playBtn = document.createElement('button');
playBtn.type = 'button';
playBtn.textContent = '▶ 播放';
playBtn.style.cssText =
  'padding:4px 12px;border:1px solid #d4d4d8;border-radius:4px;' +
  'background:#fff;cursor:pointer;font:inherit;';
overlay.appendChild(playBtn);

const deltaStat = document.createElement('span');
deltaStat.style.cssText = 'font-variant-numeric:tabular-nums;color:#374151;';
overlay.appendChild(deltaStat);

slider.addEventListener('input', () => updateAll());

let playing = false;
let lastFrame = 0;
playBtn.addEventListener('click', () => {
  playing = !playing;
  playBtn.textContent = playing ? '⏸ 暂停' : '▶ 播放';
  lastFrame = performance.now();
});

function updateAll() {
  const k = parseInt(slider.value, 10);
  kReadout.textContent = String(k);
  applyState(states[k]);
  if (k === 0) {
    deltaStat.innerHTML = '初始: 内部均设为 0.5';
  } else {
    deltaStat.innerHTML = '本步最大变化 ‖Δu‖<sub>∞</sub> = <strong>' +
                          maxDelta[k].toExponential(2) + '</strong>';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────

updateAll();
fitCamera();

let needsResize = true;
const ro = new ResizeObserver(() => { needsResize = true; });
ro.observe(container);

function frame(now) {
  if (needsResize) { fitCamera(); needsResize = false; }
  if (playing) {
    if (now - lastFrame > 30) {
      let k = parseInt(slider.value, 10);
      // Step size grows so we don't crawl forever.
      const step = k < 30 ? 1 : (k < 100 ? 2 : (k < 300 ? 5 : 10));
      k = Math.min(K_MAX, k + step);
      slider.value = String(k);
      lastFrame = now;
      updateAll();
      if (k === K_MAX) { playing = false; playBtn.textContent = '▶ 播放'; }
    }
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
