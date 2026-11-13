/**
 * The /home-v2 backdrop: one red "booking thread" running through dark space. The camera travels
 * along it as the page scrolls and passes through a ring at every chapter. three.js loads lazily,
 * after first paint, and only when motion is allowed and WebGL works; otherwise the CSS glow stays.
 */
type Three = typeof import('three');

const BRAND = 0xd72638;
const BG = 0x0b0d10;

export function createScene(host: HTMLElement): () => void {
  let disposed = false;
  let teardown: (() => void) | null = null;

  const start = () => {
    if (disposed) return;
    void import('three').then((THREE) => {
      if (disposed) return;
      try {
        teardown = mount(THREE, host);
      } catch {
        teardown = null;
      }
    });
  };

  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  let idleHandle = 0;
  const schedule = () => {
    idleHandle = idle ? idle(start, { timeout: 2500 }) : window.setTimeout(start, 900);
  };
  if (document.readyState === 'complete') schedule();
  else window.addEventListener('load', schedule, { once: true });

  return () => {
    disposed = true;
    window.removeEventListener('load', schedule);
    if (idleHandle) {
      const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cancel) cancel(idleHandle);
      else window.clearTimeout(idleHandle);
    }
    teardown?.();
    teardown = null;
  };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function dotTexture(THREE: Three) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Additive glow material that fades out near the camera (no wedges across the copy) and into the distance. */
function glowMaterial(THREE: Three, color: number, opacity: number, near = [5, 16], far = [45, 95]) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uNear: { value: new THREE.Vector2(near[0], near[1]) },
      uFar: { value: new THREE.Vector2(far[0], far[1]) },
    },
    vertexShader: `
      varying float vDepth;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform vec2 uNear;
      uniform vec2 uFar;
      varying float vDepth;
      void main() {
        float fade = smoothstep(uNear.x, uNear.y, vDepth) * (1.0 - smoothstep(uFar.x, uFar.y, vDepth));
        gl_FragColor = vec4(uColor, uOpacity * fade);
      }`,
  });
}

function mount(THREE: Three, host: HTMLElement): () => void {
  if (!hasWebGL()) return () => {};

  const small = window.matchMedia('(max-width: 47.99rem)').matches;
  const chapters = Math.max(2, document.querySelectorAll('[data-hv2-chapter]').length);

  const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'hv2-scene__canvas';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(BG, small ? 0.03 : 0.024);
  const camera = new THREE.PerspectiveCamera(small ? 70 : 58, 1, 2.2, 150);

  // The thread: a long, lazily winding path into the screen.
  const length = 26 * chapters;
  const points: InstanceType<Three['Vector3']>[] = [];
  const segments = chapters * 3 + 4;
  for (let i = 0; i <= segments; i++) {
    const z = 8 - (i / segments) * length;
    points.push(new THREE.Vector3(Math.sin(i * 0.82) * 5.2, Math.cos(i * 0.57) * 2.6 - 0.4, z));
  }
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.6);

  const disposables: Array<{ dispose: () => void }> = [];
  const keep = <T extends { dispose: () => void }>(item: T) => {
    disposables.push(item);
    return item;
  };

  const tubeSegments = small ? 420 : 900;
  const core = new THREE.Mesh(
    keep(new THREE.TubeGeometry(curve, tubeSegments, 0.045, 8, false)),
    keep(glowMaterial(THREE, BRAND, 0.95)),
  );
  const halo = new THREE.Mesh(
    keep(new THREE.TubeGeometry(curve, tubeSegments, 0.22, 10, false)),
    keep(glowMaterial(THREE, BRAND, 0.1)),
  );
  scene.add(core, halo);

  // A faint second strand that drifts beside the first.
  const twinPoints = points.map((p, i) => new THREE.Vector3(p.x + Math.sin(i * 1.3) * 1.6, p.y + 1.1 + Math.cos(i) * 0.6, p.z));
  const twin = new THREE.Mesh(
    keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(twinPoints, false, 'catmullrom', 0.6), tubeSegments, 0.018, 6, false)),
    keep(glowMaterial(THREE, 0xffffff, 0.18)),
  );
  scene.add(twin);

  // Chapter gates.
  const gateMaterial = keep(glowMaterial(THREE, BRAND, 0.6, [6, 20]));
  const gateFaint = keep(glowMaterial(THREE, 0xffffff, 0.1, [6, 20]));
  const ringGeometry = keep(new THREE.TorusGeometry(2.6, 0.012, 6, 120));
  const outerGeometry = keep(new THREE.TorusGeometry(3.6, 0.008, 6, 120));
  const gates: InstanceType<Three['Group']>[] = [];
  for (let i = 1; i < chapters; i++) {
    const t = i / chapters;
    const at = curve.getPointAt(t);
    const ahead = curve.getPointAt(Math.min(1, t + 0.002));
    const gate = new THREE.Group();
    gate.add(new THREE.Mesh(ringGeometry, gateMaterial), new THREE.Mesh(outerGeometry, gateFaint));
    gate.position.copy(at);
    gate.lookAt(ahead);
    scene.add(gate);
    gates.push(gate);
  }

  // Dust around the path; one in nine motes is brand red.
  const count = small ? 900 : 2600;
  const positions = new Float32Array(count * 3);
  const colours = new Float32Array(count * 3);
  const red = new THREE.Color(BRAND);
  const white = new THREE.Color(0xd9d9dc);
  for (let i = 0; i < count; i++) {
    const p = curve.getPointAt(Math.random());
    const radius = 2.5 + Math.pow(Math.random(), 0.7) * 20;
    const angle = Math.random() * Math.PI * 2;
    positions[i * 3] = p.x + Math.cos(angle) * radius;
    positions[i * 3 + 1] = p.y + Math.sin(angle) * radius * 0.65;
    positions[i * 3 + 2] = p.z + (Math.random() - 0.5) * 6;
    const c = i % 9 === 0 ? red : white;
    colours[i * 3] = c.r;
    colours[i * 3 + 1] = c.g;
    colours[i * 3 + 2] = c.b;
  }
  const dustGeometry = keep(new THREE.BufferGeometry());
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  const sprite = keep(dotTexture(THREE));
  const dust = new THREE.Points(
    dustGeometry,
    keep(new THREE.PointsMaterial({ size: small ? 0.16 : 0.13, map: sprite, vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  scene.add(dust);

  // Scroll and pointer state, smoothed every frame.
  let target = 0;
  let progress = 0;
  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  const onPointer = (event: PointerEvent) => {
    tx = (event.clientX / window.innerWidth - 0.5) * 2;
    ty = (event.clientY / window.innerHeight - 0.5) * 2;
  };
  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  readScroll();
  progress = target;
  resize();
  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onPointer, { passive: true });

  const look = new THREE.Vector3();
  const clock = new THREE.Clock();
  let running = false;

  const frame = () => {
    const time = clock.getElapsedTime();
    progress += (target - progress) * 0.055;
    px += (tx - px) * 0.04;
    py += (ty - py) * 0.04;

    const t = Math.min(0.94, progress * 0.94);
    const at = curve.getPointAt(t);
    camera.position.set(at.x + 3.6 + px * 1.1, at.y + 2.4 - py * 0.6, at.z + 9);
    look.copy(curve.getPointAt(Math.min(1, t + 0.05)));
    look.x *= 0.6;
    camera.lookAt(look);
    camera.rotation.z += Math.sin(time * 0.15) * 0.02;

    dust.rotation.z = time * 0.006;
    halo.material.uniforms.uOpacity.value = 0.1 + Math.sin(time * 1.6) * 0.03;
    for (let i = 0; i < gates.length; i++) gates[i].rotation.z = time * 0.08 * (i % 2 ? 1 : -1);

    renderer.render(scene, camera);
  };

  const play = () => {
    if (running) return;
    running = true;
    clock.getDelta();
    renderer.setAnimationLoop(frame);
  };
  const pause = () => {
    running = false;
    renderer.setAnimationLoop(null);
  };
  const onVisibility = () => (document.hidden ? pause() : play());
  document.addEventListener('visibilitychange', onVisibility);

  play();
  requestAnimationFrame(() => host.classList.add('is-ready'));

  return () => {
    pause();
    host.classList.remove('is-ready');
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('scroll', readScroll);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
    for (const item of disposables) item.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
