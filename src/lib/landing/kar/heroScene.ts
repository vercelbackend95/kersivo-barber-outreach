/**
 * /barbershop-reports hero: a week of bookings as a field of columns, one per day and opening
 * hour. The columns rise once on load; as the hero scrolls away the camera turns to look straight
 * down and the field flattens into the heatmap behind "peak day and hour", with the busiest slot
 * lit in brand red.
 *
 * Illustrative shape only (no figures are read off it). Loaded with a dynamic import so three.js
 * never blocks first paint; one WebGL context, DPR capped, paused off-screen.
 */
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';

export type HeroScene = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

const BRAND = new Color('#d72638');
const LOW = new Color('#1b1b1f');
const HIGH = new Color('#7d7f88');

const DAYS = 7;
const HOURS = 11;
const PEAK_DAY = 3;
const PEAK_HOUR = 0;
const GAP = 0.18;
const SIZE = 0.62;
const MAX_HEIGHT = 2.6;

/** A believable week: closed early in the week, busy mornings, a Thursday 09:00 peak. */
function demand(day: number, hour: number): number {
  const dayWeight = [0.05, 0.05, 0.62, 1, 0.8, 0.92, 0.7][day];
  const hourCurve = 0.55 + 0.45 * Math.cos((hour / (HOURS - 1)) * Math.PI * 1.6) * 0.9 + (hour === 8 ? 0.15 : 0);
  const ripple = 0.85 + 0.15 * Math.sin(day * 2.3 + hour * 1.7);
  const v = dayWeight * hourCurve * ripple;
  return day === PEAK_DAY && hour === PEAK_HOUR ? 1 : Math.min(0.86, Math.max(0.04, v));
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createHeroScene(canvas: HTMLCanvasElement, options: { reducedMotion: boolean }): HeroScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);

  scene.add(new AmbientLight(0xffffff, 0.55));
  const key = new DirectionalLight(0xffffff, 1.5);
  key.position.set(-4, 9, 6);
  scene.add(key);
  const rim = new DirectionalLight(0xc8ccd4, 0.25);
  rim.position.set(6, 3, -6);
  scene.add(rim);

  const field = new Group();
  scene.add(field);

  const width = DAYS * (SIZE + GAP) - GAP;
  const depth = HOURS * (SIZE + GAP) - GAP;

  // Columns: one instanced mesh, pivot at the base so scaling grows them upwards.
  const geometry = new BoxGeometry(SIZE, 1, SIZE);
  geometry.translate(0, 0.5, 0);
  const material = new MeshStandardMaterial({ roughness: 0.55, metalness: 0.15 });
  const count = DAYS * HOURS;
  const columns = new InstancedMesh(geometry, material, count);
  field.add(columns);

  const heights: number[] = [];
  const delays: number[] = [];
  const bases: Vector3[] = [];
  const color = new Color();
  for (let d = 0; d < DAYS; d += 1) {
    for (let h = 0; h < HOURS; h += 1) {
      const i = d * HOURS + h;
      const v = demand(d, h);
      heights.push(v);
      delays.push((d + h) * 0.045);
      bases.push(new Vector3(d * (SIZE + GAP) - width / 2 + SIZE / 2, 0, h * (SIZE + GAP) - depth / 2 + SIZE / 2));
      if (d === PEAK_DAY && h === PEAK_HOUR) color.copy(BRAND);
      else color.copy(LOW).lerp(HIGH, Math.pow(v, 0.8));
      columns.setColorAt(i, color);
    }
  }
  if (columns.instanceColor) columns.instanceColor.needsUpdate = true;

  // A hairline floor grid under the field.
  const lines: number[] = [];
  const pad = 0.5;
  for (let d = 0; d <= DAYS; d += 1) {
    const x = d * (SIZE + GAP) - width / 2 - GAP / 2;
    lines.push(x, 0, -depth / 2 - pad, x, 0, depth / 2 + pad);
  }
  for (let h = 0; h <= HOURS; h += 1) {
    const z = h * (SIZE + GAP) - depth / 2 - GAP / 2;
    lines.push(-width / 2 - pad, 0, z, width / 2 + pad, 0, z);
  }
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute('position', new Float32BufferAttribute(lines, 3));
  const gridMaterial = new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 });
  const grid = new LineSegments(gridGeometry, gridMaterial);
  grid.position.y = -0.002;
  field.add(grid);

  // A soft red light that sits over the peak slot.
  const peakIndex = PEAK_DAY * HOURS + PEAK_HOUR;
  const peakGlow = new PointLight(BRAND, 6, 4.5, 2);
  peakGlow.position.copy(bases[peakIndex]).setY(1.2);
  field.add(peakGlow);

  const dummy = new Object3D();
  const matrix = new Matrix4();
  const state = {
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    orbitX: 0,
    orbitY: 0,
    time: options.reducedMotion ? 10 : 0,
    running: false,
    frame: 0,
    last: 0,
    width: 0,
    height: 0,
    wide: true,
    distance: 22,
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h || (w === state.width && h === state.height)) return;
    state.width = w;
    state.height = h;
    state.wide = w >= 1024;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Wide: the field sits right of the copy. Narrow: below the buttons (the hero reserves that space).
    // Fit the field: about 46% of the width beside the copy on wide screens. On narrow screens it sits
    // in the band the hero reserves under the buttons (CSS: padding-bottom min(70vw, 28rem) + 1rem).
    const span = 2 * Math.tan((camera.fov * Math.PI) / 360);
    const FIELD = 10.6;
    if (state.wide) {
      camera.setViewOffset(w, h, -w * 0.24, 0, w, h);
      state.distance = Math.max(FIELD / (0.46 * span * camera.aspect), 8.5 / (0.8 * span));
    } else {
      const band = Math.min(0.7 * w, 448) + 16;
      camera.setViewOffset(w, h, 0, -(h / 2 - band / 2), w, h);
      state.distance = Math.max(FIELD / (0.92 * span * camera.aspect), (7.6 * h) / (0.9 * band * span));
    }
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const target = new Vector3(0, 0.4, 0);

  const draw = () => {
    const p = state.progress;
    const flatten = easeInOut(clamp01(p / 0.85));

    // Camera: a three-quarter view that turns to look straight down as the hero leaves.
    state.orbitX += (state.pointerX - state.orbitX) * 0.05;
    state.orbitY += (state.pointerY - state.orbitY) * 0.05;
    const yaw = -0.62 + state.orbitX * 0.22 + Math.sin(state.time * 0.12) * 0.04;
    const tilt = 0.62 + flatten * 0.86 - state.orbitY * 0.08;
    const distance = state.distance * (1 - flatten * 0.08);
    camera.position.set(
      Math.sin(yaw) * Math.cos(tilt) * distance,
      Math.sin(tilt) * distance,
      Math.cos(yaw) * Math.cos(tilt) * distance,
    );
    camera.lookAt(target);

    for (let i = 0; i < count; i += 1) {
      const rise = easeOutBack(clamp01((state.time - 0.25 - delays[i]) / 0.9));
      const breathe = 1 + Math.sin(state.time * 1.1 + i * 0.7) * 0.025;
      const full = Math.max(0.04, heights[i] * MAX_HEIGHT * breathe);
      const h = Math.max(0.02, full * rise * (1 - flatten * 0.94));
      dummy.position.copy(bases[i]);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      matrix.copy(dummy.matrix);
      columns.setMatrixAt(i, matrix);
    }
    columns.instanceMatrix.needsUpdate = true;
    peakGlow.intensity = 5 + Math.sin(state.time * 2) * 1.2 + flatten * 4;

    renderer.render(scene, camera);
  };

  const tick = (now: number) => {
    state.frame = requestAnimationFrame(tick);
    const dt = state.last ? Math.min(0.05, (now - state.last) / 1000) : 0.016;
    state.last = now;
    state.time += dt;
    draw();
  };

  const setRunning = (running: boolean) => {
    if (options.reducedMotion) {
      draw();
      return;
    }
    if (running === state.running) return;
    state.running = running;
    if (running) {
      state.last = 0;
      state.frame = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(state.frame);
    }
  };

  draw();

  return {
    setProgress(p) {
      state.progress = clamp01(p);
      if (!state.running) draw();
    },
    setPointer(x, y) {
      if (options.reducedMotion) return;
      state.pointerX = x;
      state.pointerY = y;
    },
    setRunning,
    dispose() {
      cancelAnimationFrame(state.frame);
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      gridGeometry.dispose();
      gridMaterial.dispose();
      columns.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
