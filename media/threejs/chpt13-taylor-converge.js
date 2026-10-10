/**
 * chpt13-taylor-converge.js
 * §13.3 两块面板, 共享同一个阶数滑块 N, 演示 Maclaurin 级数的"收敛域".
 *
 *   Panel A — eˣ:  Taylor 部分和 T_N 随 N 增大向两侧无限追上 eˣ,
 *                  收敛半径 R = +∞ —— 处处收敛.
 *   Panel B — sin x: 阴影标出 [-π, π]. 低阶时部分和已在带内贴合,
 *                  但只要 N 够大, 贴合区会越过 ±π 不断外扩 ——
 *                  收敛同样是处处的, [-π, π] 只是"低阶就够用"的范围.
 *   Panel C — 1/(1-x): 收敛半径有限的对照. 阴影标出 (-1, 1). 带内 N 越大
 *                  越贴合, 但越过 x = ±1 无论 N 多大都剧烈发散 ——
 *                  几何级数 Σ xⁿ 的收敛域就是 (-1, 1), R = 1.
 *
 * 每块面板各自用滚轮缩放自己的 x 轴 (关于原点对称); 共享滑块同时
 * 改变三块的阶数; 一个按钮把三块的缩放复位.
 *
 * Math (x, y) → Three.js (x, 0, -y).
 */

import * as THREE from 'three';

function fact(k) { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; }

// ── A reusable single-curve-pair panel ──────────────────────────────────────

function buildPanel(id, cfg) {
  const container = document.getElementById(id);
  if (!container) return null;
  container.style.position = 'relative';

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xfafafa, 1);
  renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;display:block;';
  container.appendChild(renderer.domElement);

  const Y0 = cfg.yRange[0], Y1 = cfg.yRange[1];
  let X0 = cfg.xRange[0], X1 = cfg.xRange[1];
  const PAD_X_FRAC = 0.04, PAD_Y_FRAC = 0.10;

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  camera.position.set(0, 10, 0);
  camera.up.set(0, 0, -1);
  const scene = new THREE.Scene();

  let overlay = null;   // legend strip, set below

  function fitCamera() {
    const rect = container.getBoundingClientRect();
    const overlayH = overlay ? overlay.offsetHeight : 0;
    const canvasH = Math.max(1, rect.height - overlayH);
    const W = (X1 - X0) * (1 + 2 * PAD_X_FRAC);
    const H = (Y1 - Y0) * (1 + 2 * PAD_Y_FRAC);
    const aspect = rect.width / canvasH;
    const dataAspect = W / H;
    let halfW, halfH;
    if (aspect >= dataAspect) { halfH = H / 2; halfW = halfH * aspect; }
    else { halfW = W / 2; halfH = halfW / aspect; }
    const cx = (X0 + X1) / 2, cy = (Y0 + Y1) / 2;
    camera.position.set(cx, 10, -cy);
    camera.lookAt(new THREE.Vector3(cx, 0, -cy));
    camera.left = -halfW; camera.right = halfW;
    camera.top = halfH; camera.bottom = -halfH;
    camera.updateProjectionMatrix();
    renderer.setSize(rect.width, canvasH, true);
  }

  function v3(x, y, lift = 0.001) { return new THREE.Vector3(x, lift, -y); }

  function makeLine(points, color, opacity = 1) {
    const g = new THREE.BufferGeometry().setFromPoints(points);
    const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    return new THREE.Line(g, m);
  }

  function makeQuad(x0, x1, y0, y1, color, opacity) {
    const g = new THREE.BufferGeometry();
    const p = [
      v3(x0, y0, 0.0002), v3(x1, y0, 0.0002), v3(x1, y1, 0.0002),
      v3(x0, y0, 0.0002), v3(x1, y1, 0.0002), v3(x0, y1, 0.0002),
    ];
    g.setFromPoints(p);
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    return new THREE.Mesh(g, m);
  }

  function clampY(y) {
    const margin = 0.6 * (Y1 - Y0);
    if (y > Y1 + margin) return Y1 + margin;
    if (y < Y0 - margin) return Y0 - margin;
    return y;
  }

  function taylor(x, k) {
    let s = 0, xp = 1;
    for (let i = 0; i <= k; i++) { s += cfg.coef(i) * xp; xp *= x; }
    return s;
  }

  // static decoration (band + ±π guides) that lives in data coords
  const decoGroup = new THREE.Group();
  scene.add(decoGroup);
  if (cfg.band) {
    const [bx0, bx1] = cfg.band;
    decoGroup.add(makeQuad(bx0, bx1, Y0, Y1, 0x10b981, 0.10));
    for (const bx of [bx0, bx1]) {
      decoGroup.add(makeLine([v3(bx, Y0, 0.0003), v3(bx, Y1, 0.0003)], 0x10b981, 0.55));
    }
  }

  const axisGroup = new THREE.Group();
  scene.add(axisGroup);
  function rebuildAxes() {
    axisGroup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    while (axisGroup.children.length) axisGroup.remove(axisGroup.children[0]);
    axisGroup.add(makeLine([v3(X0, 0, 0.0005), v3(X1, 0, 0.0005)], 0x9ca3af));
    axisGroup.add(makeLine([v3(0, Y0, 0.0005), v3(0, Y1, 0.0005)], 0x9ca3af));
  }

  let N_terms = cfg.N0;
  let targetLine = null, taylorLine = null;
  function rebuildCurves() {
    if (targetLine) { scene.remove(targetLine); targetLine.geometry.dispose(); }
    if (taylorLine) { scene.remove(taylorLine); taylorLine.geometry.dispose(); }
    const RES = 700;
    const tp = [], ap = [];
    for (let i = 0; i <= RES; i++) {
      const x = X0 + (X1 - X0) * (i / RES);
      let yT = cfg.f(x); if (!isFinite(yT)) yT = NaN; yT = clampY(yT);
      if (!isNaN(yT)) tp.push(v3(x, yT, 0.0012));
      let yA = taylor(x, N_terms); if (!isFinite(yA)) yA = NaN; yA = clampY(yA);
      if (!isNaN(yA)) ap.push(v3(x, yA, 0.0014));
    }
    targetLine = makeLine(tp, 0x1d4ed8);   // blue target
    taylorLine = makeLine(ap, 0xb91c1c);   // rose Taylor
    scene.add(targetLine); scene.add(taylorLine);
  }

  // overlay: legend row + its own N slider + reset (每块面板独立控制 N)
  overlay = document.createElement('div');
  overlay.style.cssText =
    'position:absolute;left:0;right:0;bottom:0;padding:7px 12px;' +
    'background:rgba(255,255,255,0.92);border-top:1px solid #e5e7eb;' +
    'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif;' +
    'display:flex;gap:8px 10px;align-items:center;flex-wrap:wrap;color:#4b5563;';

  const legend = document.createElement('span');
  legend.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';
  legend.innerHTML =
    '<b style="color:#111827">' + cfg.title + '</b>' +
    '<span><span style="color:#1d4ed8">■</span> ' + cfg.targetLabel + '</span>' +
    '<span><span style="color:#b91c1c">■</span> T<sub>N</sub></span>' +
    (cfg.band ? '<span><span style="color:#10b981">■</span> ' + cfg.bandLabel + '</span>' : '');
  overlay.appendChild(legend);

  const sliderLabel = document.createElement('label');
  sliderLabel.style.cssText = 'display:flex;align-items:center;gap:6px;white-space:nowrap;';
  sliderLabel.innerHTML = '<span>N =</span>';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0'; slider.max = '30'; slider.step = '1';
  slider.value = String(cfg.N0);
  slider.style.cssText = 'width:110px;';
  const readout = document.createElement('span');
  readout.style.cssText = 'font-variant-numeric:tabular-nums;min-width:2.5ch;';
  readout.textContent = slider.value;
  sliderLabel.appendChild(slider);
  sliderLabel.appendChild(readout);
  overlay.appendChild(sliderLabel);

  const resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.textContent = '重置';
  resetBtn.title = '重置 x 轴缩放';
  resetBtn.style.cssText =
    'padding:2px 8px;border:1px solid #d4d4d8;border-radius:4px;' +
    'background:#fff;cursor:pointer;font:inherit;font-size:0.82em;';
  overlay.appendChild(resetBtn);

  const hint = document.createElement('span');
  hint.style.cssText = 'color:#9ca3af;font-size:0.82em;margin-left:auto;';
  hint.textContent = '滚轮缩放 x';
  overlay.appendChild(hint);

  slider.addEventListener('input', () => {
    N_terms = parseInt(slider.value, 10);
    readout.textContent = String(N_terms);
    rebuildCurves();
  });
  resetBtn.addEventListener('click', () => {
    X0 = cfg.xRange[0]; X1 = cfg.xRange[1];
    rebuildAxes(); rebuildCurves(); fitCamera();
  });

  container.appendChild(overlay);

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
    const c = (X0 + X1) / 2;
    let half = (X1 - X0) / 2 * factor;
    half = Math.max(cfg.minHalf, Math.min(cfg.maxHalf, half));
    X0 = c - half; X1 = c + half;
    rebuildAxes(); rebuildCurves(); fitCamera();
  }, { passive: false });

  rebuildAxes();
  rebuildCurves();

  let needsResize = true;
  const ro = new ResizeObserver(() => { needsResize = true; });
  ro.observe(container);
  function frame() {
    if (needsResize) { fitCamera(); needsResize = false; }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  frame();

  return {
    setN(n) { N_terms = n; rebuildCurves(); },
    reset() { X0 = cfg.xRange[0]; X1 = cfg.xRange[1]; rebuildAxes(); rebuildCurves(); fitCamera(); },
    el: container,
  };
}

// ── Build the two panels ─────────────────────────────────────────────────────

const N0 = 6;

const panelA = buildPanel('chpt13-taylor-exp', {
  title: 'eˣ', targetLabel: 'eˣ',
  f: x => Math.exp(x),
  coef: k => 1 / fact(k),
  xRange: [-8, 8], yRange: [-3, 25],
  minHalf: 1, maxHalf: 30, N0,
});

const panelB = buildPanel('chpt13-taylor-sin', {
  title: 'sin x', targetLabel: 'sin x',
  f: x => Math.sin(x),
  coef: k => {
    if (k % 2 === 0) return 0;
    const sign = ((k - 1) / 2) % 2 === 0 ? 1 : -1;
    return sign / fact(k);
  },
  xRange: [-3 * Math.PI, 3 * Math.PI], yRange: [-1.7, 1.7],
  band: [-Math.PI, Math.PI], bandLabel: '[−π, π]',
  minHalf: 1.2, maxHalf: 4 * Math.PI, N0,
});

const panelC = buildPanel('chpt13-taylor-geom', {
  title: '1/(1−x)', targetLabel: '1/(1−x)',
  f: x => 1 / (1 - x),
  coef: k => 1,                                  // 1/(1-x) = Σ xⁿ
  xRange: [-2.6, 2.6], yRange: [-5, 9],
  band: [-1, 1], bandLabel: '(−1, 1)',
  minHalf: 0.6, maxHalf: 16, N0,
});

// Each panel carries its own N slider + reset in its overlay (built above),
// so there is no shared control bar — the three panels are independent.
void panelA; void panelB; void panelC;
