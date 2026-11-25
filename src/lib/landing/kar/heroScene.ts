/**
 * /barbershop-reports hero: one Reports chart from the dashboard, built in three.js.
 *
 * A single brand-red series (booking value for the selected range) drawn with the dashboard's
 * monotone curve as a laser: a white-hot core inside a red beam and a tight additive halo, with a
 * bright pen head while it draws, point markers and the pulsing latest-value dot. No area fill,
 * no grid, no background and no shadow: the line carries the chart on its own. The line draws in from left to right, and
 * draws again from the left each time the hero's range widget moves on (`setSeries`). As the hero
 * scrolls away the camera swings round to face the chart head-on.
 *
 * Shapes come from the demo shop's real Reports series (normalised; the figures are in the HTML
 * widgets beside it). Loaded with a dynamic import so three.js never blocks first paint; one WebGL
 * context, DPR capped, paused off-screen.
 */
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { sampleMonotone } from '@/lib/admin/chartUtils';

export type HeroScene = {
  /** Draw a new normalised (0..1) series, from the left. */
  setSeries: (values: readonly number[]) => void;
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

const BRAND = new Color('#d72638');
/** The laser's core: near white with a little of the brand in it. */
const CORE = new Color('#ffe1e5');

const WIDTH = 9.2;
const HEIGHT = 3.4;
const SAMPLES = 96;
const DRAW_SECONDS = 1.6;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

type Series = {
  group: Group;
  line: Mesh<TubeGeometry, MeshBasicMaterial>;
  beam: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial>;
  curve: CatmullRomCurve3;
  lineIndexCount: number;
  segments: number;
  markers: { mesh: Mesh; u: number }[];
  end: Vector3;
  /** Scene time the pen started. */
  start: number;
};

export function createHeroScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean; series: readonly number[] },
): HeroScene | null {
  if (options.series.length < 2) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const chart = new Group();
  scene.add(chart);

  // Shared across every series the hero draws.
  const markerGeometry = new SphereGeometry(0.08, 16, 12);
  const markerCoreGeometry = new SphereGeometry(0.042, 12, 8);
  const markerMaterial = new MeshBasicMaterial({ color: BRAND });
  const markerCoreMaterial = new MeshBasicMaterial({ color: 0x0d0d0e });
  // The laser: a white-hot core, the red beam around it and a tight halo, all added to the dark page.
  const lineMaterial = new MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false });
  const beamMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false });
  const glowMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.24, blending: AdditiveBlending, depthWrite: false });
  // The pen head: a white spark with a red bloom, only while the line is being drawn.
  const headGeometry = new SphereGeometry(0.06, 16, 12);
  const headMaterial = new MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const bloomGeometry = new SphereGeometry(0.22, 20, 14);
  const bloomMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const endDotGeometry = new SphereGeometry(0.13, 20, 14);
  const pulseGeometry = new RingGeometry(0.17, 0.23, 40);
  const pulseMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
  const shared = [markerGeometry, markerCoreGeometry, markerMaterial, markerCoreMaterial, lineMaterial, beamMaterial, glowMaterial, headGeometry, headMaterial, bloomGeometry, bloomMaterial, endDotGeometry, pulseGeometry, pulseMaterial];

  const endDot = new Mesh(endDotGeometry, markerMaterial);
  endDot.scale.setScalar(0.0001);
  chart.add(endDot);
  const pulse = new Mesh(pulseGeometry, pulseMaterial);
  chart.add(pulse);
  const head = new Mesh(headGeometry, headMaterial);
  const bloom = new Mesh(bloomGeometry, bloomMaterial);
  chart.add(head, bloom);

  const state = {
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    orbitX: 0,
    orbitY: 0,
    time: 0,
    running: false,
    frame: 0,
    last: 0,
    width: 0,
    height: 0,
    distance: 22,
  };

  const build = (values: readonly number[]): Series => {
    const group = new Group();
    const n = values.length;
    const raw = values.map((v, i) => ({ x: (i / (n - 1)) * WIDTH - WIDTH / 2, y: clamp01(v) * HEIGHT }));
    const dense = sampleMonotone(raw, Math.max(4, Math.round(SAMPLES / (n - 1))));
    const segments = dense.length - 1;

    const curve = new CatmullRomCurve3(dense.map((p) => new Vector3(p.x, Math.max(0.005, p.y), 0)), false, 'centripetal');
    const line = new Mesh(new TubeGeometry(curve, segments, 0.014, 8, false), lineMaterial);
    const beam = new Mesh(new TubeGeometry(curve, segments, 0.04, 8, false), beamMaterial);
    const glow = new Mesh(new TubeGeometry(curve, segments, 0.085, 8, false), glowMaterial);
    line.renderOrder = 2;
    beam.renderOrder = 1;
    group.add(glow, beam, line);

    // Point markers while the series still reads as points.
    const markers: Series['markers'] = [];
    if (n <= 14) {
      raw.forEach((p, i) => {
        const mesh = new Mesh(markerGeometry, markerMaterial);
        mesh.add(new Mesh(markerCoreGeometry, markerCoreMaterial));
        mesh.position.set(p.x, Math.max(0.005, p.y), 0);
        mesh.scale.setScalar(0.0001);
        group.add(mesh);
        markers.push({ mesh, u: i / (n - 1) });
      });
    }

    chart.add(group);
    const last = raw[raw.length - 1]!;
    return {
      group,
      line,
      beam,
      glow,
      curve,
      lineIndexCount: line.geometry.index?.count ?? 0,
      segments,
      markers,
      end: new Vector3(last.x, Math.max(0.005, last.y), 0),
      start: state.time + 0.25,
    };
  };

  const destroy = (s: Series) => {
    chart.remove(s.group);
    s.line.geometry.dispose();
    s.beam.geometry.dispose();
    s.glow.geometry.dispose();
  };

  let current = build(options.series);
  let leaving: { series: Series; from: number } | null = null;
  if (options.reducedMotion) current.start = -DRAW_SECONDS * 2;

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h || (w === state.width && h === state.height)) return;
    state.width = w;
    state.height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Wide: the chart sits in the right half, between the four widgets (CSS: .kar-hero__board).
    // Narrow: in the band the hero reserves under the buttons (padding-bottom min(70vw, 28rem) + 1rem).
    const span = 2 * Math.tan((camera.fov * Math.PI) / 360);
    const FIELD_W = WIDTH + 2.4;
    const FIELD_H = HEIGHT + 3.4;
    if (w >= 1024) {
      camera.setViewOffset(w, h, -w * 0.3, -h * 0.03, w, h);
      state.distance = Math.max(FIELD_W / (0.32 * span * camera.aspect), FIELD_H / (0.5 * span));
    } else {
      const band = Math.min(0.7 * w, 448) + 16;
      camera.setViewOffset(w, h, 0, -(h / 2 - band / 2), w, h);
      state.distance = Math.max(FIELD_W / (0.9 * span * camera.aspect), (FIELD_H * h) / (0.8 * band * span));
    }
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const target = new Vector3(0, HEIGHT * 0.45, 0);

  const draw = () => {
    const face = easeInOut(clamp01(state.progress / 0.85));

    // Camera: a three-quarter view that swings round to face the chart as the hero leaves.
    state.orbitX += (state.pointerX - state.orbitX) * 0.05;
    state.orbitY += (state.pointerY - state.orbitY) * 0.05;
    const sway = options.reducedMotion ? 0 : Math.sin(state.time * 0.18) * 0.04;
    const yaw = (-0.46 + state.orbitX * 0.14 + sway) * (1 - face);
    const tilt = (0.26 - state.orbitY * 0.05) * (1 - face) + 0.03 * face;
    const distance = state.distance * (1 + face * 0.08);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(tilt) * distance,
      target.y + Math.sin(tilt) * distance,
      target.z + Math.cos(yaw) * Math.cos(tilt) * distance,
    );
    camera.lookAt(target);

    // The previous series fades and sinks while the new one draws over it.
    if (leaving) {
      const t = clamp01((state.time - leaving.from) / 0.45);
      const keep = 1 - easeOut(t);
      leaving.series.group.position.y = -0.25 * easeOut(t);
      leaving.series.group.scale.y = Math.max(0.0001, keep);
      if (t >= 1) {
        destroy(leaving.series);
        leaving = null;
      }
    }

    const s = current;
    const reveal = easeInOut(clamp01((state.time - s.start) / DRAW_SECONDS));
    const count = Math.min(s.lineIndexCount, Math.ceil(reveal * s.segments) * 8 * 6);
    s.line.geometry.setDrawRange(0, count);
    s.beam.geometry.setDrawRange(0, count);
    s.glow.geometry.setDrawRange(0, count);

    // The pen head rides the leading edge and burns out as the line lands.
    const drawing = reveal > 0 && reveal < 1;
    const headOn = drawing ? Math.min(1, reveal / 0.04) * clamp01((1 - reveal) / 0.08) : 0;
    if (headOn > 0) {
      s.curve.getPointAt(reveal, head.position);
      bloom.position.copy(head.position);
      const flicker = options.reducedMotion ? 1 : 0.9 + Math.sin(state.time * 38) * 0.1;
      head.scale.setScalar(Math.max(0.0001, headOn));
      bloom.scale.setScalar(Math.max(0.0001, headOn * flicker));
    }
    headMaterial.opacity = headOn;
    bloomMaterial.opacity = 0.34 * headOn;
    head.visible = headOn > 0;
    bloom.visible = headOn > 0;
    s.markers.forEach((marker) => {
      const t = clamp01((reveal - marker.u) / 0.1);
      marker.mesh.scale.setScalar(Math.max(0.0001, easeOutBack(t)));
    });

    endDot.position.copy(s.end);
    pulse.position.copy(s.end);
    const endIn = clamp01((state.time - s.start - DRAW_SECONDS * 0.9) / 0.35);
    endDot.scale.setScalar(Math.max(0.0001, easeOutBack(endIn)));
    pulse.quaternion.copy(camera.quaternion);
    if (options.reducedMotion || reveal < 1) {
      pulseMaterial.opacity = 0;
    } else {
      const cycle = (state.time % 2.4) / 2.4;
      const grow = easeOut(clamp01(cycle / 0.7));
      pulse.scale.setScalar(1 + grow * 1.6);
      pulseMaterial.opacity = 0.45 * (1 - grow);
    }

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
    setSeries(values) {
      if (values.length < 2) return;
      if (leaving) destroy(leaving.series);
      leaving = options.reducedMotion ? null : { series: current, from: state.time };
      if (options.reducedMotion) destroy(current);
      current = build(values);
      if (options.reducedMotion) current.start = state.time - DRAW_SECONDS * 2;
      if (!state.running) draw();
    },
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
      if (leaving) destroy(leaving.series);
      destroy(current);
      shared.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
