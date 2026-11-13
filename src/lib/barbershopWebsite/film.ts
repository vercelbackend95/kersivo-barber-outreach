/**
 * The opening "film" of /barbershop-websites: a field of KERSIVO-red and white sparks behind the
 * hero. As the visitor scrolls, the sparks stream down the page with the scroll and settle into the
 * system in "Why your barbershop needs its own website": some travel along the lines from each place
 * clients find a shop into the one address, the rest hug the address card like a live border. A few
 * stay behind as ambient stars.
 *
 * The canvas is a sticky, decorative layer (aria-hidden, pointer-events: none). Coordinates are CSS
 * pixels of the viewport; the hub and the line end points are measured from the DOM every frame so
 * the sparks stay glued to them. three.js loads lazily after first paint, only when motion is allowed
 * and WebGL works, and the loop sleeps whenever the film is off screen or the tab is hidden.
 */
type Three = typeof import('three');

const LANES = 6;

const VERTEX = /* glsl */ `
  attribute vec3 aSeed;      // x, y in 0..1, z = depth 0..1
  attribute float aDelay;    // when this spark joins the stream (0..0.5)
  attribute float aHue;      // 0 white, 1 KERSIVO red
  attribute float aRole;     // 0 ambient, 1 travels a line, 2 hugs the hub
  attribute float aLane;     // which line (0..5)
  attribute float aT;        // phase along the line / around the hub
  uniform vec2 uView;
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uMouse;
  uniform vec2 uTarget;
  uniform vec2 uHub;
  uniform float uConverge;
  uniform float uLanes;
  uniform vec2 uFrom[${LANES}];
  uniform vec2 uTo[${LANES}];
  uniform vec2 uGlow;
  uniform float uDpr;
  varying float vAlpha;
  varying float vHue;

  vec2 cubic(vec2 a, vec2 b, vec2 c, vec2 d, float t) {
    float u = 1.0 - t;
    return u * u * u * a + 3.0 * u * u * t * b + 3.0 * u * t * t * c + t * t * t * d;
  }

  void main() {
    float depth = aSeed.z;
    float t = uTime * (0.2 + depth * 0.3);
    vec2 drift = vec2(
      sin(t + aSeed.y * 31.0) * 22.0 + sin(t * 0.37 + aSeed.x * 17.0) * 34.0,
      cos(t * 0.8 + aSeed.x * 23.0) * 16.0 - uTime * (5.0 + depth * 9.0)
    );
    vec2 p = aSeed.xy * uView + drift;
    p.y -= uScroll * (0.05 + depth * 0.18);
    p = mod(p + uView * 0.5, uView * 1.2) - uView * 0.1;

    // Push away from the pointer, nearer sparks more.
    vec2 away = p - uMouse;
    float d = length(away);
    p += normalize(away + 0.0001) * (1.0 - smoothstep(0.0, 160.0, d)) * 34.0 * (0.4 + depth);

    // Where this spark ends up in the system.
    vec2 f = p;
    float flow = 1.0;
    bool hub = aRole > 1.5 || (aRole > 0.5 && uLanes < 0.5);
    if (hub) {
      float a = aT * 6.2831 + uTime * 0.09 * (aHue > 0.5 ? 1.0 : -1.0);
      float ca = cos(a);
      float sa = sin(a);
      vec2 sq = vec2(sign(ca) * pow(abs(ca), 0.28), sign(sa) * pow(abs(sa), 0.28));
      f = uTarget + sq * (uHub + 8.0 + depth * 26.0);
    } else if (aRole > 0.5) {
      vec2 a = uFrom[0];
      vec2 b = uTo[0];
      for (int i = 1; i < ${LANES}; i++) {
        if (abs(aLane - float(i)) < 0.5) {
          a = uFrom[i];
          b = uTo[i];
        }
      }
      float dx = b.x - a.x;
      float s = fract(aT + uTime * (0.06 + depth * 0.07));
      f = cubic(a, a + vec2(dx * 0.5, 0.0), b - vec2(dx * 0.5, 0.0), b, s);
      f.y += (aSeed.y - 0.5) * (2.0 + depth * 7.0);
      flow = smoothstep(0.0, 0.06, s) * (1.0 - smoothstep(0.9, 1.0, s));
    }

    // Stream down with the scroll: each spark leaves on its own beat and curves in.
    float k = aRole > 0.5 ? smoothstep(aDelay, aDelay + 0.5, uConverge) : 0.0;
    k = k * k * (3.0 - 2.0 * k);
    vec2 mid = (p + f) * 0.5 + vec2((aSeed.y - 0.5) * uView.x * 0.45, (aSeed.x - 0.5) * uView.y * 0.3);
    vec2 q = mix(mix(p, mid, k), mix(mid, f, k), k);

    float glow = 1.0 - smoothstep(0.0, 520.0, length(q - uGlow));
    float twinkle = 0.72 + 0.28 * sin(uTime * (1.2 + aSeed.y * 2.4) + aSeed.x * 40.0);
    float base = (0.26 + depth * 0.5) * (0.75 + glow * 0.9) * twinkle;
    float settled = aRole > 1.5 || (aRole > 0.5 && uLanes < 0.5) ? 0.42 + depth * 0.3 : (0.5 + depth * 0.4) * flow;
    vAlpha = mix(base, settled, k);
    if (aRole < 0.5) vAlpha *= 1.0 - 0.65 * uConverge;
    vAlpha *= 0.75 + aHue * 0.45;
    vHue = aHue;

    vec2 clip = vec2(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
    // A few near sparks read as soft red stars.
    float star = step(0.82, depth) * aHue * (1.0 - k) * 2.6;
    gl_PointSize = (1.3 + depth * 2.8 + aHue * 1.1 + star + k * (aRole < 1.5 ? 0.6 : 0.0)) * uDpr;
  }
`;

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying float vHue;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = dot(c, c);
    if (r > 0.25) discard;
    float soft = smoothstep(0.25, 0.0, r);
    vec3 white = vec3(0.98, 0.95, 0.93);
    vec3 red = vec3(0.86, 0.13, 0.2);
    vec3 col = mix(white, red, vHue);
    col = mix(col, vec3(1.0, 0.78, 0.78), smoothstep(0.06, 0.0, r) * vHue * 0.55);
    gl_FragColor = vec4(col, soft * vAlpha);
  }
`;

const GLOW_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Two soft red lights: one behind the hero site that dims as the sparks leave, one behind the
// address card that comes up as they arrive.
const GLOW_FRAGMENT = /* glsl */ `
  uniform vec2 uView;
  uniform vec2 uGlow;
  uniform vec2 uTarget;
  uniform vec2 uHub;
  uniform float uConverge;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;
    float r0 = length((p - uGlow) / vec2(1.0, 0.7));
    float a0 = (1.0 - smoothstep(0.0, uView.x * 0.45, r0)) * 0.14 * (1.0 - uConverge);
    vec2 hub = max(uHub, vec2(80.0));
    float r1 = length((p - uTarget) / (hub * 2.4));
    float breathe = 0.9 + 0.1 * sin(uTime * 1.3);
    float a1 = (1.0 - smoothstep(0.0, 1.0, r1)) * 0.16 * uConverge * breathe;
    float a = a0 + a1;
    gl_FragColor = vec4(vec3(0.84, 0.15, 0.22) * a, a);
  }
`;

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFilm(film: HTMLElement): () => void {
  const canvas = film.querySelector<HTMLCanvasElement>('[data-bw-film-canvas]');
  if (!canvas || !hasWebGL()) return () => {};
  let disposed = false;
  let teardown: (() => void) | null = null;

  const start = () => {
    if (disposed) return;
    void import('three').then((THREE) => {
      if (disposed) return;
      try {
        teardown = mount(THREE, film, canvas);
      } catch {
        teardown = null;
      }
    });
  };
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  const handle = idle ? idle(start, { timeout: 600 }) : window.setTimeout(start, 300);

  return () => {
    disposed = true;
    const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (idle !== undefined && cancel !== undefined) cancel(handle);
    else window.clearTimeout(handle);
    teardown?.();
    teardown = null;
  };
}

function mount(THREE: Three, film: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const small = window.matchMedia('(max-width: 47.99rem)').matches;
  const count = small ? 900 : 2400;
  const random = rng(39);
  const seeds = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const hues = new Float32Array(count);
  const roles = new Float32Array(count);
  const lanes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    seeds[i * 3] = random();
    seeds[i * 3 + 1] = random();
    seeds[i * 3 + 2] = random() ** 1.5;
    delays[i] = random() * 0.5;
    hues[i] = random() < 0.55 ? 1 : 0;
    const role = random();
    roles[i] = role < 0.42 ? 1 : role < 0.7 ? 2 : 0;
    lanes[i] = Math.floor(random() * LANES);
    phases[i] = random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute('aHue', new THREE.BufferAttribute(hues, 1));
  geometry.setAttribute('aRole', new THREE.BufferAttribute(roles, 1));
  geometry.setAttribute('aLane', new THREE.BufferAttribute(lanes, 1));
  geometry.setAttribute('aT', new THREE.BufferAttribute(phases, 1));

  const uniforms = {
    uView: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uMouse: { value: new THREE.Vector2(-9999, -9999) },
    uTarget: { value: new THREE.Vector2(0, 0) },
    uHub: { value: new THREE.Vector2(120, 80) },
    uConverge: { value: 0 },
    uLanes: { value: 0 },
    uFrom: { value: Array.from({ length: LANES }, () => new THREE.Vector2(0, 0)) },
    uTo: { value: Array.from({ length: LANES }, () => new THREE.Vector2(0, 0)) },
    uGlow: { value: new THREE.Vector2(0, 0) },
    uDpr: { value: 1 },
  };

  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  points.frustumCulled = false;

  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  glow.frustumCulled = false;
  scene.add(glow, points);

  const target = film.querySelector<HTMLElement>('[data-bw-film-target]');
  const stage = film.querySelector<HTMLElement>('[data-bw-film-stage]');
  const lines = film.querySelector<SVGElement>('[data-bw-sys-lines]');
  const froms = Array.from({ length: LANES }, (_, i) => film.querySelector<HTMLElement>(`[data-bw-lane-from='${i}']`));
  const tos = Array.from({ length: LANES }, (_, i) => film.querySelector<HTMLElement>(`[data-bw-lane-to='${i}']`));

  let width = 0;
  let height = 0;
  const resize = () => {
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    uniforms.uView.value.set(width, height);
    uniforms.uDpr.value = dpr;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const onPointer = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    uniforms.uMouse.value.set(event.clientX - rect.left, event.clientY - rect.top);
  };
  const onLeave = () => uniforms.uMouse.value.set(-9999, -9999);
  window.addEventListener('pointermove', onPointer, { passive: true });
  document.addEventListener('pointerleave', onLeave);

  let visible = true;
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    if (visible) loop();
  });
  io.observe(film);

  let raf = 0;
  let last = performance.now();
  let time = 0;
  let converge = 0;
  const loop = () => {
    cancelAnimationFrame(raf);
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(frame);
  };

  const centre = (el: Element | null, ox: number, oy: number, out: import('three').Vector2) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    out.set(r.left + r.width / 2 - ox, r.top + r.height / 2 - oy);
    return true;
  };

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    uniforms.uTime.value = time;
    uniforms.uScroll.value = window.scrollY;

    const canvasRect = canvas.getBoundingClientRect();
    const ox = canvasRect.left;
    const oy = canvasRect.top;

    // A soft red light behind the hero site.
    const stageRect = stage?.getBoundingClientRect();
    if (stageRect && stageRect.width > 0) {
      uniforms.uGlow.value.set(stageRect.left + stageRect.width * 0.5 - ox, stageRect.top + stageRect.height * 0.5 - oy);
    } else {
      uniforms.uGlow.value.set(width * 0.6, height * 0.5);
    }

    // The sparks follow the scroll: fully settled once the hub reaches the middle of the screen.
    let goal = 0;
    if (target) {
      const t = target.getBoundingClientRect();
      uniforms.uTarget.value.set(t.left + t.width / 2 - ox, t.top + t.height / 2 - oy);
      uniforms.uHub.value.set(t.width / 2, t.height / 2);
      const travel = t.top + t.height / 2 + window.scrollY - height * 0.5;
      goal = travel > 1 ? Math.min(1, Math.max(0, window.scrollY / travel)) : 1;
    }
    converge += (goal - converge) * Math.min(1, dt * 5);
    uniforms.uConverge.value = converge;

    // Lines exist only where the wide layout draws them; elsewhere every spark hugs the hub.
    let lanesOn = Boolean(lines && lines.getBoundingClientRect().width > 0);
    if (lanesOn) {
      for (let i = 0; i < LANES; i += 1) {
        const ok = centre(froms[i], ox, oy, uniforms.uFrom.value[i]) && centre(tos[i], ox, oy, uniforms.uTo.value[i]);
        if (!ok) lanesOn = false;
      }
    }
    uniforms.uLanes.value = lanesOn ? 1 : 0;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };

  const onVisibility = () => {
    last = performance.now();
    loop();
  };
  document.addEventListener('visibilitychange', onVisibility);
  film.classList.add('is-filming');
  loop();

  return () => {
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    film.classList.remove('is-filming');
    geometry.dispose();
    (points.material as import('three').Material).dispose();
    glow.geometry.dispose();
    (glow.material as import('three').Material).dispose();
    renderer.dispose();
  };
}
