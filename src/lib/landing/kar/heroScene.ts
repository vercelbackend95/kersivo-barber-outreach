/**
 * /barbershop-reports hero: the Reports chart from the dashboard, built in three.js.
 *
 * Four ribbons, one per Reports range (front to back: 1 Week, 1 Day, 1 Month, 1 Year), each the
 * same monotone curve the dashboard draws, with its soft area fill under it. The front ribbon is
 * the brand-red primary series with its glow, point markers and the pulsing latest-value dot.
 * The lines draw in once on load; as the hero scrolls away the camera swings round to face the
 * chart head-on, and the ribbons line up into the flat, multi-series chart the dashboard shows.
 *
 * Shapes come from the demo shop's real Reports series (normalised, no figures are read off it).
 * Loaded with a dynamic import so three.js never blocks first paint; one WebGL context, DPR
 * capped, paused off-screen.
 */
import {
  AdditiveBlending,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { sampleMonotone } from '@/lib/admin/chartUtils';

export type HeroScene = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

/** One normalised (0..1) series per ribbon, front first. */
export type HeroRibbonData = readonly (readonly number[])[];

const BRAND = new Color('#d72638');
const GHOST = new Color('#9a9ca6');

const WIDTH = 9.2;
const HEIGHT = 3.1;
const DEPTH_STEP = 1.35;
const SAMPLES_PER_SEGMENT = 18;
const DRAW_SECONDS = 1.7;
const STAGGER_SECONDS = 0.22;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

const AREA_VERTEX = /* glsl */ `
  attribute float aU;
  attribute float aV;
  varying float vU;
  varying float vV;
  void main() {
    vU = aU;
    vV = aV;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const AREA_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uAlpha;
  uniform float uReveal;
  varying float vU;
  varying float vV;
  void main() {
    if (vU > uReveal) discard;
    // Bright just under the line, gone by the floor: the dashboard's area gradient.
    float a = uAlpha * pow(vV, 2.2);
    // A soft leading edge where the pen currently is.
    a *= smoothstep(uReveal, uReveal - 0.04, vU);
    gl_FragColor = vec4(uColor, a);
  }
`;

type Ribbon = {
  group: Group;
  line: Mesh<TubeGeometry, MeshBasicMaterial>;
  glow: Mesh<TubeGeometry, MeshBasicMaterial> | null;
  area: Mesh<BufferGeometry, ShaderMaterial>;
  lineIndexCount: number;
  segments: number;
  delay: number;
  markers: { mesh: Mesh; u: number }[];
};

export function createHeroScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean; ribbons: HeroRibbonData },
): HeroScene | null {
  const series = options.ribbons.filter((s) => s.length >= 2).slice(0, 4);
  if (series.length === 0) return null;

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
  const chart = new Group();
  scene.add(chart);

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const backZ = -(series.length - 1) * DEPTH_STEP;

  // Hairlines: a floor grid under the ribbons and the three value gridlines on the back wall.
  const lines: number[] = [];
  const x0 = -WIDTH / 2;
  const x1 = WIDTH / 2;
  for (let i = 0; i < series.length; i += 1) {
    const z = -i * DEPTH_STEP;
    lines.push(x0 - 0.3, 0, z, x1 + 0.3, 0, z);
  }
  for (let i = 0; i <= 6; i += 1) {
    const x = x0 + (i / 6) * WIDTH;
    lines.push(x, 0, 0.5, x, 0, backZ - 0.8);
  }
  for (let i = 1; i <= 3; i += 1) {
    const y = (i / 3) * HEIGHT;
    lines.push(x0 - 0.3, y, backZ - 0.8, x1 + 0.3, y, backZ - 0.8);
  }
  const gridGeometry = track(new BufferGeometry());
  gridGeometry.setAttribute('position', new Float32BufferAttribute(lines, 3));
  const gridMaterial = track(new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 }));
  chart.add(new LineSegments(gridGeometry, gridMaterial));

  const markerGeometry = track(new SphereGeometry(0.075, 16, 12));
  const markerCoreGeometry = track(new SphereGeometry(0.04, 12, 8));
  const markerMaterial = track(new MeshBasicMaterial({ color: BRAND }));
  const markerCoreMaterial = track(new MeshBasicMaterial({ color: 0x0d0d0e }));

  const ribbons: Ribbon[] = series.map((values, ribbonIndex) => {
    const isPrimary = ribbonIndex === 0;
    const z = -ribbonIndex * DEPTH_STEP;
    const color = isPrimary ? BRAND : GHOST;
    const group = new Group();
    group.position.z = z;
    chart.add(group);

    const n = values.length;
    const raw = values.map((v, i) => ({ x: (i / (n - 1)) * WIDTH - WIDTH / 2, y: clamp01(v) * HEIGHT }));
    const dense = sampleMonotone(raw, Math.max(4, Math.round((SAMPLES_PER_SEGMENT * 7) / n)));
    const segments = dense.length - 1;

    // The line: a thin tube through the dense monotone points.
    const curve = new CatmullRomCurve3(dense.map((p) => new Vector3(p.x, Math.max(0.005, p.y), 0)), false, 'centripetal');
    const radius = isPrimary ? 0.034 : 0.016;
    const lineGeometry = track(new TubeGeometry(curve, segments, radius, 8, false));
    const lineMaterial = track(
      new MeshBasicMaterial({ color, transparent: !isPrimary, opacity: isPrimary ? 1 : 0.5 - ribbonIndex * 0.1 }),
    );
    const line = new Mesh(lineGeometry, lineMaterial);
    group.add(line);

    let glow: Ribbon['glow'] = null;
    if (isPrimary) {
      const glowGeometry = track(new TubeGeometry(curve, segments, 0.13, 8, false));
      const glowMaterial = track(
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }),
      );
      glow = new Mesh(glowGeometry, glowMaterial);
      group.add(glow);
    }

    // The area: a strip from the curve down to the floor, faded by height in the shader.
    const positions: number[] = [];
    const us: number[] = [];
    const vs: number[] = [];
    const index: number[] = [];
    dense.forEach((p, i) => {
      const u = i / segments;
      positions.push(p.x, Math.max(0, p.y), 0, p.x, 0, 0);
      us.push(u, u);
      vs.push(1, 0);
      if (i < segments) {
        const a = i * 2;
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    });
    const areaGeometry = track(new BufferGeometry());
    areaGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    areaGeometry.setAttribute('aU', new Float32BufferAttribute(us, 1));
    areaGeometry.setAttribute('aV', new Float32BufferAttribute(vs, 1));
    areaGeometry.setIndex(index);
    const areaMaterial = track(
      new ShaderMaterial({
        vertexShader: AREA_VERTEX,
        fragmentShader: AREA_FRAGMENT,
        uniforms: {
          uColor: { value: color.clone() },
          uAlpha: { value: isPrimary ? 0.34 : 0.1 },
          uReveal: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    );
    const area = new Mesh(areaGeometry, areaMaterial);
    area.renderOrder = -1;
    group.add(area);

    // Point markers on the primary series, one per bucket while they read as points.
    const markers: Ribbon['markers'] = [];
    if (isPrimary && n <= 14) {
      raw.forEach((p, i) => {
        const mesh = new Mesh(markerGeometry, markerMaterial);
        mesh.add(new Mesh(markerCoreGeometry, markerCoreMaterial));
        mesh.position.set(p.x, Math.max(0.005, p.y), 0);
        mesh.scale.setScalar(0.0001);
        group.add(mesh);
        markers.push({ mesh, u: i / (n - 1) });
      });
    }

    return {
      group,
      line,
      glow,
      area,
      lineIndexCount: lineGeometry.index?.count ?? 0,
      segments,
      delay: 0.3 + (isPrimary ? 0 : ribbonIndex * STAGGER_SECONDS),
      markers,
    };
  });

  // The latest value: a solid dot with a ring that pulses outwards (always facing the camera).
  const primary = ribbons[0];
  const lastValue = series[0][series[0].length - 1] ?? 0;
  const endPosition = new Vector3(WIDTH / 2, Math.max(0.005, clamp01(lastValue) * HEIGHT), 0);
  const endDot = new Mesh(track(new SphereGeometry(0.12, 20, 14)), track(new MeshBasicMaterial({ color: BRAND })));
  endDot.position.copy(endPosition);
  endDot.scale.setScalar(0.0001);
  primary.group.add(endDot);
  const pulseMaterial = track(
    new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }),
  );
  const pulse = new Mesh(track(new RingGeometry(0.16, 0.22, 40)), pulseMaterial);
  pulse.position.copy(endPosition);
  primary.group.add(pulse);

  const state = {
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    orbitX: 0,
    orbitY: 0,
    time: options.reducedMotion ? 30 : 0,
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
    // Wide: the chart sits right of the copy (about 48% of the width). Narrow: in the band the
    // hero reserves under the buttons (CSS: padding-bottom min(70vw, 28rem) + 1rem).
    const span = 2 * Math.tan((camera.fov * Math.PI) / 360);
    const FIELD_W = WIDTH + 1.6;
    const FIELD_H = HEIGHT + 2.6;
    if (state.wide) {
      camera.setViewOffset(w, h, -w * 0.27, 0, w, h);
      state.distance = Math.max(FIELD_W / (0.4 * span * camera.aspect), FIELD_H / (0.56 * span));
    } else {
      const band = Math.min(0.7 * w, 448) + 16;
      camera.setViewOffset(w, h, 0, -(h / 2 - band / 2), w, h);
      state.distance = Math.max(FIELD_W / (0.94 * span * camera.aspect), (FIELD_H * h) / (0.9 * band * span));
    }
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const target = new Vector3(0, HEIGHT * 0.42, backZ / 2);

  const draw = () => {
    const p = state.progress;
    const face = easeInOut(clamp01(p / 0.85));

    // Camera: a three-quarter view that swings round to face the chart as the hero leaves.
    state.orbitX += (state.pointerX - state.orbitX) * 0.05;
    state.orbitY += (state.pointerY - state.orbitY) * 0.05;
    const sway = options.reducedMotion ? 0 : Math.sin(state.time * 0.16) * 0.035;
    const yaw = (-0.62 + state.orbitX * 0.16 + sway) * (1 - face);
    const tilt = (0.34 - state.orbitY * 0.06) * (1 - face) + 0.04 * face;
    const distance = state.distance * (1 + face * 0.1);
    camera.position.set(
      target.x + Math.sin(yaw) * Math.cos(tilt) * distance,
      target.y + Math.sin(tilt) * distance,
      target.z + Math.cos(yaw) * Math.cos(tilt) * distance,
    );
    camera.lookAt(target);

    ribbons.forEach((ribbon) => {
      const reveal = easeOut(clamp01((state.time - ribbon.delay) / DRAW_SECONDS));
      const visibleSegments = Math.ceil(reveal * ribbon.segments);
      // TubeGeometry indexes 8 radial segments x 6 indices per tubular segment.
      const count = Math.min(ribbon.lineIndexCount, visibleSegments * 8 * 6);
      ribbon.line.geometry.setDrawRange(0, count);
      ribbon.glow?.geometry.setDrawRange(0, count);
      ribbon.area.material.uniforms.uReveal.value = reveal * 1.02;
      ribbon.markers.forEach((marker) => {
        const t = clamp01((reveal - marker.u) / 0.12);
        marker.mesh.scale.setScalar(Math.max(0.0001, easeOutBack(t)));
      });
    });

    const primaryReveal = clamp01((state.time - primary.delay) / DRAW_SECONDS);
    const endIn = clamp01((state.time - primary.delay - DRAW_SECONDS * 0.85) / 0.4);
    endDot.scale.setScalar(Math.max(0.0001, easeOutBack(endIn)));
    pulse.quaternion.copy(camera.quaternion);
    if (options.reducedMotion || primaryReveal < 1) {
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
      disposables.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
