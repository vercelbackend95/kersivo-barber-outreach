/**
 * The opening "film" of /barbershop-websites: warm dust drifting through a projector beam behind the
 * hero. As the visitor scrolls into "Why your barbershop needs its own website" the dust streams into
 * the one domain every source points to, and keeps orbiting it while it is on screen.
 *
 * The canvas is a sticky, decorative layer (aria-hidden, pointer-events: none). Coordinates are CSS
 * pixels of the viewport; the convergence target is measured from the DOM every frame so it stays
 * glued to its element. three.js loads lazily after first paint, only when motion is allowed and
 * WebGL works, and the loop sleeps whenever the film is off screen or the tab is hidden.
 */
type Three = typeof import('three');

const VERTEX = /* glsl */ `
  attribute vec3 aSeed;      // x, y in 0..1, z = depth 0..1
  attribute float aDelay;    // when this grain joins the stream (0..0.6)
  attribute float aHue;      // 0 sand, 1 ember
  uniform vec2 uView;
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uMouse;
  uniform vec2 uTarget;
  uniform float uConverge;
  uniform float uDpr;
  uniform vec2 uBeamFrom;
  uniform vec2 uBeamTo;
  varying float vAlpha;
  varying float vHue;

  float beam(vec2 p) {
    vec2 dir = normalize(uBeamTo - uBeamFrom);
    vec2 rel = p - uBeamFrom;
    float along = dot(rel, dir);
    float across = abs(rel.x * dir.y - rel.y * dir.x);
    float width = 40.0 + along * 0.42;
    return smoothstep(width, width * 0.15, across) * smoothstep(-40.0, 180.0, along);
  }

  void main() {
    float depth = aSeed.z;
    float t = uTime * (0.25 + depth * 0.35);
    vec2 drift = vec2(
      sin(t + aSeed.y * 31.0) * 26.0 + sin(t * 0.37 + aSeed.x * 17.0) * 40.0,
      cos(t * 0.8 + aSeed.x * 23.0) * 18.0 - uTime * (6.0 + depth * 10.0)
    );
    vec2 p = aSeed.xy * uView + drift;
    p.y -= uScroll * (0.08 + depth * 0.22);
    p = mod(p + uView * 0.5, uView * 1.2) - uView * 0.1;

    // Push away from the pointer, nearer grains more.
    vec2 away = p - uMouse;
    float d = length(away);
    p += normalize(away + 0.0001) * (1.0 - smoothstep(0.0, 160.0, d)) * 38.0 * (0.4 + depth);

    // Stream into the domain and orbit it.
    float k = smoothstep(aDelay, aDelay + 0.4, uConverge);
    k = k * k * (3.0 - 2.0 * k);
    float ang = aSeed.x * 6.2831 + uTime * (0.25 + aSeed.y * 0.4) * (aHue > 0.5 ? -1.0 : 1.0);
    vec2 ring = uTarget + vec2(cos(ang) * (150.0 + aSeed.y * 210.0), sin(ang) * (46.0 + aSeed.y * 70.0));
    p = mix(p, ring, k);

    float lit = beam(p);
    vAlpha = (0.16 + depth * 0.34) * (0.45 + lit * 1.4) * (1.0 - 0.35 * k) + k * 0.25;
    vHue = aHue;

    vec2 clip = vec2(p.x / uView.x * 2.0 - 1.0, 1.0 - p.y / uView.y * 2.0);
    gl_Position = vec4(clip, 0.0, 1.0);
    gl_PointSize = (1.1 + depth * 2.6 + lit * 1.4 + aHue * 1.2) * uDpr;
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
    vec3 sand = vec3(0.93, 0.82, 0.64);
    vec3 ember = vec3(0.92, 0.2, 0.25);
    gl_FragColor = vec4(mix(sand, ember, vHue), soft * vAlpha);
  }
`;

const BEAM_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const BEAM_FRAGMENT = /* glsl */ `
  uniform vec2 uView;
  uniform vec2 uBeamFrom;
  uniform vec2 uBeamTo;
  uniform float uTime;
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    vec2 p = vec2(vUv.x, 1.0 - vUv.y) * uView;
    vec2 dir = normalize(uBeamTo - uBeamFrom);
    vec2 rel = p - uBeamFrom;
    float along = dot(rel, dir);
    float across = abs(rel.x * dir.y - rel.y * dir.x);
    float width = 40.0 + along * 0.42;
    float cone = smoothstep(width, 0.0, across) * smoothstep(-40.0, 260.0, along);
    float fall = 1.0 - smoothstep(0.0, length(uView) * 0.95, along);
    float flicker = 0.92 + 0.05 * sin(uTime * 7.3) + 0.03 * sin(uTime * 13.1);
    float shafts = 0.75 + 0.25 * sin(atan(rel.y, rel.x) * 60.0 + uTime * 0.4);
    float a = cone * fall * flicker * shafts * 0.2 * uFade;
    gl_FragColor = vec4(vec3(0.95, 0.85, 0.68) * a, a);
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
  const count = small ? 700 : 1900;
  const random = rng(39);
  const seeds = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const hues = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    seeds[i * 3] = random();
    seeds[i * 3 + 1] = random();
    seeds[i * 3 + 2] = random() ** 1.6;
    delays[i] = random() * 0.6;
    hues[i] = random() < 0.06 ? 1 : 0;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays, 1));
  geometry.setAttribute('aHue', new THREE.BufferAttribute(hues, 1));

  const uniforms = {
    uView: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uMouse: { value: new THREE.Vector2(-9999, -9999) },
    uTarget: { value: new THREE.Vector2(0, 0) },
    uConverge: { value: 0 },
    uDpr: { value: 1 },
    uBeamFrom: { value: new THREE.Vector2(0, 0) },
    uBeamTo: { value: new THREE.Vector2(0, 0) },
    uFade: { value: 1 },
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

  const beam = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  beam.frustumCulled = false;
  scene.add(beam, points);

  const target = film.querySelector<HTMLElement>('[data-bw-film-target]');
  const stage = film.querySelector<HTMLElement>('[data-bw-film-stage]');
  const why = film.querySelector<HTMLElement>('[data-bw-film-why]');

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

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    uniforms.uTime.value = time;
    uniforms.uScroll.value = window.scrollY;

    const canvasRect = canvas.getBoundingClientRect();
    // Beam: from above the top-right corner, aimed at the hero's example site.
    const stageRect = stage?.getBoundingClientRect();
    uniforms.uBeamFrom.value.set(width * 1.02, -height * 0.18);
    if (stageRect && stageRect.width > 0) {
      uniforms.uBeamTo.value.set(
        stageRect.left + stageRect.width * 0.45 - canvasRect.left,
        stageRect.top + stageRect.height * 0.6 - canvasRect.top,
      );
    } else {
      uniforms.uBeamTo.value.set(width * 0.6, height * 0.7);
    }

    // Converge as the Why chapter rises through the viewport.
    let goal = 0;
    if (why) {
      const r = why.getBoundingClientRect();
      goal = Math.min(1, Math.max(0, (height * 0.95 - r.top) / (height * 0.85)));
    }
    converge += (goal - converge) * Math.min(1, dt * 3.2);
    uniforms.uConverge.value = converge;
    uniforms.uFade.value = 1 - converge * 0.85;

    if (target) {
      const t = target.getBoundingClientRect();
      uniforms.uTarget.value.set(t.left + t.width / 2 - canvasRect.left, t.top + t.height / 2 - canvasRect.top);
    }

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
    beam.geometry.dispose();
    (beam.material as import('three').Material).dispose();
    renderer.dispose();
  };
}
