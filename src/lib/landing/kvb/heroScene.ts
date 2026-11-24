/**
 * /kersivo-vs-booksy hero: a globe of grey points (a marketplace of shops) with one red point
 * (your shop). As the hero scrolls away the marketplace scatters and fades, and your shop moves
 * to the centre and opens into a red ring: one address that is yours.
 *
 * Loaded with a dynamic import so three.js never blocks first paint. Named imports keep the
 * bundle to what the scene uses. One WebGL context, DPR capped, paused off-screen.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
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
const GREY = new Color('#8b8f98');

const vertexShader = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uScatter;
  uniform float uPixelRatio;
  uniform float uSize;
  varying float vAlpha;

  void main() {
    vec3 p = position;
    // a quiet breathing on the surface
    p *= 1.0 + sin(uTime * 0.7 + aSeed * 40.0) * 0.012;
    // scatter outwards along the normal, each point at its own pace
    float s = smoothstep(0.0, 1.0, clamp(uScatter * (0.6 + aSeed * 0.9), 0.0, 1.0));
    p += normalize(position) * s * (2.2 + aSeed * 4.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + aSeed * 0.6) * (6.0 / -mv.z);
    // points on the far side of the globe sit back
    float facing = clamp((-mv.z - 3.2) / 3.6, 0.0, 1.0);
    vAlpha = mix(0.95, 0.28, facing) * (1.0 - s);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.32, d) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

function fibonacciSphere(count: number, radius: number): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function createHeroScene(canvas: HTMLCanvasElement, options: { reducedMotion: boolean }): HeroScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }

  const compact = window.matchMedia('(max-width: 767px)').matches;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  const globe = new Group();
  scene.add(globe);

  const RADIUS = 1.9;
  const COUNT = compact ? 900 : 1700;
  const positions = fibonacciSphere(COUNT, RADIUS);
  const seeds = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i += 1) seeds[i] = Math.random();

  const pointsGeometry = new BufferGeometry();
  pointsGeometry.setAttribute('position', new BufferAttribute(positions, 3));
  pointsGeometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));

  const pointsMaterial = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uScatter: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uSize: { value: compact ? 3.4 : 3 },
      uColor: { value: GREY },
    },
  });
  const points = new Points(pointsGeometry, pointsMaterial);
  globe.add(points);

  // Your shop: a red point on the globe's front face.
  const shopHome = new Vector3(0.55, 0.42, 1).normalize().multiplyScalar(RADIUS);
  const shopGeometry = new SphereGeometry(0.058, 24, 24);
  const shopMaterial = new MeshBasicMaterial({ color: BRAND });
  const shop = new Mesh(shopGeometry, shopMaterial);
  shop.position.copy(shopHome);
  globe.add(shop);

  const haloGeometry = new SphereGeometry(0.15, 24, 24);
  const haloMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0.18, blending: AdditiveBlending, depthWrite: false });
  const halo = new Mesh(haloGeometry, haloMaterial);
  shop.add(halo);

  // The ring your shop opens into; lives outside the rotating globe so it faces the camera.
  const ringGeometry = new RingGeometry(0.985, 1, 160);
  const ringMaterial = new MeshBasicMaterial({ color: BRAND, transparent: true, opacity: 0, depthWrite: false });
  const ring = new Mesh(ringGeometry, ringMaterial);
  scene.add(ring);

  const state = {
    progress: 0,
    pointerX: 0,
    pointerY: 0,
    rotX: 0,
    rotY: 0,
    time: 0,
    running: false,
    frame: 0,
    last: 0,
    width: 0,
    height: 0,
  };

  const resize = () => {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h || (w === state.width && h === state.height)) return;
    state.width = w;
    state.height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Desktop: the globe sits right of the copy. Narrow: lower and smaller, behind nothing important.
    // Matches the CSS breakpoint that reserves room under the buttons below 1024px.
    const wide = w >= 1024;
    if (wide) {
      globe.position.set(2.15, -0.05, 0);
      globe.scale.setScalar(0.92);
    } else {
      // Narrow screens: the globe sits in the space the hero reserves under the buttons
      // (CSS: padding-bottom min(73vw, 31rem)). Radius in pixels: min(34% of width, 230px).
      const visibleHeight = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360);
      const worldPerPx = visibleHeight / h;
      const radiusPx = Math.min(0.34 * w, 230);
      globe.scale.setScalar((radiusPx * worldPerPx) / RADIUS);
      globe.position.set(0, -visibleHeight / 2 + radiusPx * 1.15 * worldPerPx, 0);
    }
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const worldShop = new Vector3();

  const draw = () => {
    const p = state.progress;
    pointsMaterial.uniforms.uTime.value = state.time;
    pointsMaterial.uniforms.uScatter.value = p * 1.25;

    // pointer and idle spin, damped
    const targetY = state.time * 0.05 + state.pointerX * 0.35;
    const targetX = -0.18 + state.pointerY * 0.18;
    state.rotY += (targetY - state.rotY) * 0.06;
    state.rotX += (targetX - state.rotX) * 0.06;
    globe.rotation.set(state.rotX, state.rotY, 0);

    // your shop travels from its place on the globe to the centre of the frame
    const travel = easeOut(clamp01((p - 0.08) / 0.55));
    shop.position.copy(shopHome).multiplyScalar(1 - travel);
    shop.scale.setScalar(1 + travel * 1.6);
    haloMaterial.opacity = 0.18 + Math.sin(state.time * 2.2) * 0.06;

    shop.getWorldPosition(worldShop);
    const open = easeOut(clamp01((p - 0.35) / 0.55));
    ring.position.copy(worldShop);
    ring.scale.setScalar(0.2 + open * 1.9 * globe.scale.x);
    ringMaterial.opacity = open * 0.9;

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
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      shopGeometry.dispose();
      shopMaterial.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
