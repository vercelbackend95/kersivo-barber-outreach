/**
 * /barbershop-retail-pickup hero: a pomade tin with its lid lifted and a beard-oil bottle, floating
 * over a red ring on the counter (the pickup spot). The pointer turns the pair; as the hero scrolls
 * away the lid closes, both settle onto the ring and it glows: the order is collected.
 *
 * Loaded with a dynamic import after first paint. Named imports keep the bundle to what the scene
 * uses. One WebGL context, DPR capped at 1.75, paused off-screen and in hidden tabs. Under reduced
 * motion it renders still frames only (on resize, pointer and scroll it redraws once, never loops).
 */
import {
  AdditiveBlending,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PMREMGenerator,
  PointLight,
  RingGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type RetailHeroScene = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

const BRAND = '#d72638';
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** Lid artwork: a dark disc with a red hairline ring and the product name. */
function lidTexture(): CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const grad = ctx.createRadialGradient(c, c * 0.8, 10, c, c, c);
  grad.addColorStop(0, '#1d1d20');
  grad.addColorStop(1, '#09090a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = BRAND;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#f1eee8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 64px "Bebas Neue", Impact, sans-serif';
  ctx.fillText('MATTE', c, c - 30);
  ctx.fillText('POMADE', c, c + 34);
  ctx.fillStyle = BRAND;
  ctx.beginPath();
  ctx.arc(c, c + 96, 8, 0, Math.PI * 2);
  ctx.fill();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Soft round shadow for the counter. */
function shadowTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Lathe profile helper: points are (radius, y). */
const profile = (points: Array<[number, number]>) => points.map(([x, y]) => new Vector2(x, y));

export function createRetailHeroScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean },
): RetailHeroScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];
  const textures: Texture[] = [];
  const track = <T extends BufferGeometry>(g: T) => (geometries.push(g), g);
  const trackMat = <T extends Material>(m: T) => (materials.push(m), m);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  textures.push(envMap);

  const camera = new PerspectiveCamera(32, 1, 0.1, 50);
  // Camera sits a little left so the products clear the pickup ticket in the visual's lower left.
  const CAMERA_X = -0.55;
  camera.position.set(CAMERA_X, 1.55, 7.2);
  camera.lookAt(CAMERA_X, 0.1, 0);

  scene.add(new HemisphereLight(0xffffff, 0x1a0a0c, 0.35));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new PointLight(new Color(BRAND), 14, 9, 1.6);
  rim.position.set(-2.4, 0.4, -1.6);
  scene.add(rim);

  /* ---------- Counter: shadow and the red pickup ring ---------- */
  const counter = new Group();
  counter.position.y = -1.05;
  scene.add(counter);

  const shadowTex = shadowTexture();
  textures.push(shadowTex);
  const shadowMat = trackMat(new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  const shadow = new Mesh(track(new CircleGeometry(2.3, 48)), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  counter.add(shadow);

  const ringMat = trackMat(
    new MeshBasicMaterial({ color: new Color(BRAND), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }),
  );
  const ring = new Mesh(track(new RingGeometry(1.86, 1.9, 96)), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.002;
  counter.add(ring);

  const haloMat = trackMat(
    new MeshBasicMaterial({ color: new Color(BRAND), transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false }),
  );
  const halo = new Mesh(track(new RingGeometry(1.9, 2.25, 96)), haloMat);
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.001;
  counter.add(halo);

  /* ---------- Products ---------- */
  const products = new Group();
  scene.add(products);

  // Pomade tin: brushed steel body, dark lid with its artwork on top.
  const tin = new Group();
  tin.position.set(-0.55, 0, 0.2);
  products.add(tin);

  const steel = trackMat(new MeshStandardMaterial({ color: 0xb9bcc2, metalness: 1, roughness: 0.32 }));
  const body = new Mesh(
    track(
      new LatheGeometry(
        profile([[0, -0.34], [0.92, -0.34], [0.99, -0.3], [1, -0.24], [1, 0.16], [0.97, 0.19], [0.97, 0.22], [0, 0.22]]),
        72,
      ),
    ),
    steel,
  );
  tin.add(body);

  const pomadeMat = trackMat(new MeshStandardMaterial({ color: 0x2a2320, roughness: 0.85, metalness: 0 }));
  const pomade = new Mesh(track(new CylinderGeometry(0.93, 0.93, 0.02, 64)), pomadeMat);
  pomade.position.y = 0.2;
  tin.add(pomade);

  const lid = new Group();
  tin.add(lid);
  const lidSideMat = trackMat(new MeshStandardMaterial({ color: 0x111113, metalness: 0.6, roughness: 0.38 }));
  const lidSide = new Mesh(
    track(
      new LatheGeometry(
        profile([[1.02, -0.1], [1.05, -0.08], [1.05, 0.08], [1.02, 0.11], [0.98, 0.12], [0, 0.12]]),
        72,
      ),
    ),
    lidSideMat,
  );
  lid.add(lidSide);
  const lidTex = lidTexture();
  textures.push(lidTex);
  const lidTopMat = trackMat(new MeshStandardMaterial({ map: lidTex, metalness: 0.2, roughness: 0.55 }));
  const lidTop = new Mesh(track(new CircleGeometry(0.98, 72)), lidTopMat);
  lidTop.rotation.x = -Math.PI / 2;
  lidTop.position.y = 0.121;
  lid.add(lidTop);
  const bandMat = trackMat(new MeshStandardMaterial({ color: new Color(BRAND), metalness: 0.3, roughness: 0.4 }));
  const band = new Mesh(track(new CylinderGeometry(1.055, 1.055, 0.035, 72, 1, true)), bandMat);
  lid.add(band);

  // Beard-oil bottle: amber glass, black cap and dropper bulb.
  const bottle = new Group();
  bottle.position.set(1.05, 0, -0.45);
  products.add(bottle);
  const glass = trackMat(
    new MeshStandardMaterial({ color: 0x7a3410, metalness: 0.1, roughness: 0.12, transparent: true, opacity: 0.94 }),
  );
  const bottleBody = new Mesh(
    track(
      new LatheGeometry(
        profile([[0, -0.34], [0.38, -0.34], [0.44, -0.28], [0.44, 0.62], [0.4, 0.74], [0.2, 0.86], [0.17, 0.92], [0, 0.92]]),
        56,
      ),
    ),
    glass,
  );
  bottle.add(bottleBody);
  const capMat = trackMat(new MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0.4, roughness: 0.3 }));
  const cap = new Mesh(track(new CylinderGeometry(0.2, 0.21, 0.26, 40)), capMat);
  cap.position.y = 1.03;
  bottle.add(cap);
  const bulb = new Mesh(track(new SphereGeometry(0.15, 32, 20)), capMat);
  bulb.scale.set(1, 1.35, 1);
  bulb.position.y = 1.27;
  bottle.add(bulb);
  const labelMat = trackMat(new MeshStandardMaterial({ color: 0xf1eee8, roughness: 0.7 }));
  const label = new Mesh(track(new CylinderGeometry(0.447, 0.447, 0.42, 56, 1, true, -0.9, 1.8)), labelMat);
  label.position.y = 0.16;
  bottle.add(label);
  const labelBand = new Mesh(track(new CylinderGeometry(0.449, 0.449, 0.05, 56, 1, true, -0.9, 1.8)), bandMat);
  labelBand.position.y = 0.3;
  bottle.add(labelBand);

  /* ---------- State ---------- */
  let progress = 0;
  let targetProgress = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let running = false;
  let raf = 0;
  let last = performance.now();
  let elapsed = 0;

  const resize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Keep both products in frame on narrow, tall canvases.
    camera.position.z = camera.aspect < 0.9 ? 9.4 : camera.aspect < 1.2 ? 8.2 : 7.2;
    camera.updateProjectionMatrix();
    if (!running) draw(0);
  };

  function draw(dt: number) {
    elapsed += dt;
    const lerp = options.reducedMotion ? 1 : 1 - Math.pow(0.0018, dt);
    progress += (targetProgress - progress) * lerp;
    pointer.x += (pointer.tx - pointer.x) * lerp;
    pointer.y += (pointer.ty - pointer.y) * lerp;

    const t = options.reducedMotion ? 0 : elapsed;
    const settle = ease(progress * 1.4);
    const float = (1 - settle) * Math.sin(t * 1.1) * 0.07;

    products.rotation.y = -0.38 + pointer.x * 0.45 + (options.reducedMotion ? 0 : Math.sin(t * 0.25) * 0.12);
    products.rotation.x = 0.06 + pointer.y * 0.12;
    products.position.y = 0.15 - settle * 0.85 + float;

    // The lid hovers open, then closes as the order is collected.
    lid.position.y = 0.66 - settle * 0.54 + (1 - settle) * Math.sin(t * 1.3 + 1) * 0.05;
    lid.rotation.z = (1 - settle) * 0.22;
    lid.rotation.x = (1 - settle) * -0.12;
    bottle.rotation.z = (1 - settle) * -0.08 + Math.sin(t * 0.9) * 0.02 * (1 - settle);
    bottle.position.y = (1 - settle) * 0.18 + Math.sin(t * 1.1 + 2) * 0.05 * (1 - settle);

    const glow = 0.45 + settle * 0.55 + (options.reducedMotion ? 0 : Math.sin(t * 1.6) * 0.06);
    ringMat.opacity = glow;
    haloMat.opacity = 0.08 + settle * 0.2;
    ring.scale.setScalar(1 + settle * 0.05);
    shadowMat.opacity = 0.55 + settle * 0.45;
    rim.intensity = 10 + settle * 10;

    renderer.render(scene, camera);
  }

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(dt);
    raf = window.requestAnimationFrame(loop);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  return {
    setProgress(p) {
      targetProgress = clamp01(p);
      if (options.reducedMotion) draw(0);
    },
    setPointer(x, y) {
      pointer.tx = Math.max(-1, Math.min(1, x));
      pointer.ty = Math.max(-1, Math.min(1, y));
      if (options.reducedMotion) draw(0);
    },
    setRunning(next) {
      if (options.reducedMotion) {
        draw(0);
        return;
      }
      if (next === running) return;
      running = next;
      if (running) {
        last = performance.now();
        raf = window.requestAnimationFrame(loop);
      } else {
        window.cancelAnimationFrame(raf);
      }
    },
    dispose() {
      window.cancelAnimationFrame(raf);
      running = false;
      resizeObserver.disconnect();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      room.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
