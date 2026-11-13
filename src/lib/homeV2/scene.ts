/**
 * The /home-v2 sand layer. A few thousand grains of sand gather around the most important element
 * in view: they brush an underline under a key heading, trace a frame around a call to action, or
 * mark the corners of a demo. As the visitor scrolls, the sand lifts and drifts on to the next
 * important element, so the eye is led through each section.
 *
 * Positions are measured from the DOM every frame (in CSS pixels, with an orthographic camera), so
 * the sand stays glued to its element while the page scrolls. three.js loads lazily after first
 * paint, only when motion is allowed and WebGL works.
 */
type Three = typeof import('three');

type Mark = 'underline' | 'frame' | 'corners';

/** Highlight targets in page order. `text` underlines the last line of text instead of the box. */
const TARGETS: Array<{ selector: string; mark: Mark; text?: boolean }> = [
  { selector: '#hv2-hero-title .hv2-hero__line:last-child', mark: 'underline', text: true },
  { selector: '#hero .hv2-hero__actions .hv2-btn--primary', mark: 'frame' },
  { selector: '#hero [data-hv2-wipe]', mark: 'corners' },
  { selector: '#hv2-booking-title', mark: 'underline', text: true },
  { selector: '[data-hv2-ticket]', mark: 'corners' },
  { selector: '#hv2-system-title', mark: 'underline', text: true },
  { selector: '[data-hv2-tablist]', mark: 'frame' },
  { selector: '#hv2-included-title', mark: 'underline', text: true },
  { selector: '.hv2-ledger__item:last-child .hv2-ledger__title', mark: 'underline', text: true },
  { selector: '#hv2-price-title', mark: 'underline', text: true },
  { selector: '.hv2-plan__amount', mark: 'underline' },
  { selector: '[data-hv2-plan] .hv2-plan__actions .hv2-btn--primary', mark: 'frame' },
  { selector: '#hv2-steps-title', mark: 'underline', text: true },
  { selector: '#hv2-faq-title', mark: 'underline', text: true },
  { selector: '#hv2-final-title', mark: 'underline', text: true },
  { selector: '.hv2-final__actions .hv2-btn--primary', mark: 'frame' },
];

const BRAND = [0xd7 / 255, 0x26 / 255, 0x38 / 255];
const MORPH_SECONDS = 1.5;
const INTRO_HOLD = 1.9;

type Box = { x: number; y: number; w: number; h: number };

export function createScene(host: HTMLElement): () => void {
  let disposed = false;
  let teardown: (() => void) | null = null;

  const start = () => {
    if (disposed) return;
    void Promise.all([import('three'), document.fonts?.ready ?? Promise.resolve()]).then(([THREE]) => {
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

/** Deterministic random, so the marks look the same on every visit. */
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

function gauss(rand: () => number) {
  return (rand() + rand() + rand() - 1.5) / 1.5;
}

/** Measures a target in viewport pixels; text targets use the last line box of their text. */
function measure(el: HTMLElement, text: boolean | undefined, range: Range): Box | null {
  if (text) {
    range.selectNodeContents(el);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 2 && r.height > 2);
    if (rects.length) {
      // Width comes from the last line's text; height from the element's line box, because a text
      // range includes the font's whole content area and would push the underline into the next block.
      const bottom = Math.max(...rects.map((r) => r.bottom));
      const line = rects.filter((r) => r.bottom > bottom - 4);
      const left = Math.min(...line.map((r) => r.left));
      const right = Math.max(...line.map((r) => r.right));
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.15;
      const h = Math.min(lineHeight, box.height);
      return { x: left, y: box.bottom - h, w: right - left, h };
    }
  }
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return null;
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

/**
 * Lays `count` grains out as a mark around a box of size w × h, as offsets from the box's top-left
 * corner, plus a brightness. About one grain in eight hangs loose around the mark like blown sand.
 */
function layout(mark: Mark | 'scatter', w: number, h: number, count: number, seed: number): Float32Array {
  const out = new Float32Array(count * 3);
  const rand = rng(seed);
  const put = (i: number, x: number, y: number, b: number) => {
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = b;
  };

  for (let i = 0; i < count; i++) {
    if (mark === 'scatter') {
      put(i, w / 2 + gauss(rand) * w * 0.7, h / 2 + gauss(rand) * Math.max(h, 120), 0.2 + rand() * 0.2);
      continue;
    }
    if (rand() < 0.12) {
      // Loose grains: a faint halo of sand around the mark.
      const a = rand() * Math.PI * 2;
      const spread = 16 + rand() * 46;
      const cx = mark === 'underline' ? rand() * w : w / 2 + Math.cos(a) * (w / 2 + spread);
      const cy = mark === 'underline' ? h + 10 + Math.abs(gauss(rand)) * 26 : h / 2 + Math.sin(a) * (h / 2 + spread * 0.7);
      put(i, cx, cy, 0.18 + rand() * 0.15);
      continue;
    }

    if (mark === 'underline') {
      // A brushed stroke: thick in the middle, tapering at both ends, with a slight wave.
      const u = rand();
      const x = -0.015 * w + u * w * 1.03;
      const taper = Math.pow(Math.sin(Math.PI * u), 0.55);
      const thick = Math.min(4.5, Math.max(2.2, h * 0.055)) * taper;
      const y = h + 4 + thick + Math.sin(u * 9.5) * 1.2 + gauss(rand) * thick;
      put(i, x, y, 0.65 + rand() * 0.35);
    } else if (mark === 'frame') {
      // A rounded outline a little outside the box.
      const pad = 9;
      const W = w + pad * 2;
      const H = h + pad * 2;
      const r = Math.min(18, H / 2);
      const quarter = (Math.PI * r) / 2;
      const sides: Array<[number, number, number, number, number]> = [
        // length, start x, start y, dx, dy
        [W - 2 * r, r, 0, 1, 0],
        [H - 2 * r, W, r, 0, 1],
        [W - 2 * r, W - r, H, -1, 0],
        [H - 2 * r, 0, H - r, 0, -1],
      ];
      const corners: Array<[number, number, number]> = [
        [W - r, r, -Math.PI / 2],
        [W - r, H - r, 0],
        [r, H - r, Math.PI / 2],
        [r, r, Math.PI],
      ];
      const total = sides.reduce((sum, side) => sum + Math.max(0, side[0]), 0) + quarter * 4;
      let d = rand() * total;
      let x = 0;
      let y = 0;
      for (let k = 0; k < 4; k++) {
        const [len, sx, sy, dx, dy] = sides[k];
        const run = Math.max(0, len);
        if (d < run) {
          x = sx + dx * d;
          y = sy + dy * d;
          break;
        }
        d -= run;
        if (d < quarter) {
          const [cx, cy, a0] = corners[k];
          const a = a0 + (d / quarter) * (Math.PI / 2);
          x = cx + Math.cos(a) * r;
          y = cy + Math.sin(a) * r;
          break;
        }
        d -= quarter;
      }
      put(i, x - pad + gauss(rand) * 1.4, y - pad + gauss(rand) * 1.4, 0.6 + rand() * 0.4);
    } else {
      // Corner marks, like a viewfinder.
      const pad = 12;
      const arm = Math.min(46, Math.max(18, Math.min(w, h) * 0.12));
      const corner = Math.floor(rand() * 4);
      const sx = corner % 2 ? w + pad : -pad;
      const sy = corner > 1 ? h + pad : -pad;
      const along = rand() * arm;
      const horizontal = rand() < 0.5;
      const dirX = corner % 2 ? -1 : 1;
      const dirY = corner > 1 ? -1 : 1;
      const x = sx + (horizontal ? dirX * along : 0) + gauss(rand) * 1.5;
      const y = sy + (horizontal ? 0 : dirY * along) + gauss(rand) * 1.5;
      put(i, x, y, 0.65 + rand() * 0.35);
    }
  }

  // Order grains left to right so a move sweeps across like wind instead of every grain crossing.
  const order = Array.from({ length: count }, (_, i) => i);
  const key = new Float32Array(count);
  for (let i = 0; i < count; i++) key[i] = out[i * 3] + (rand() - 0.5) * 30;
  order.sort((a, b) => key[a] - key[b]);
  const sorted = new Float32Array(count * 3);
  order.forEach((from, to) => sorted.set(out.subarray(from * 3, from * 3 + 3), to * 3));
  return sorted;
}

function mount(THREE: Three, host: HTMLElement): () => void {
  if (!hasWebGL()) return () => {};

  const small = window.matchMedia('(max-width: 47.99rem)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const count = small ? 3600 : 7000;
  const range = document.createRange();

  const targets = TARGETS.map((target) => ({ ...target, el: document.querySelector<HTMLElement>(target.selector) })).filter(
    (target): target is (typeof TARGETS)[number] & { el: HTMLElement } => target.el !== null,
  );
  if (targets.length === 0) return () => {};

  // The sand sits above the page (so it can mark elements inside cards) but never takes input.
  const layer = document.createElement('div');
  layer.className = 'hv2-sand';
  layer.setAttribute('aria-hidden', 'true');
  (host.parentElement ?? document.body).appendChild(layer);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'hv2-sand__canvas';
  layer.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);

  const geometry = new THREE.BufferGeometry();
  const from = new Float32Array(count * 3);
  const to = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 4);
  const seedRand = rng(42);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = seedRand();
    seeds[i * 4 + 1] = 1.1 + Math.pow(seedRand(), 2.4) * 1.9;
    seeds[i * 4 + 2] = seedRand();
    seeds[i * 4 + 3] = seedRand();
  }
  const fromAttr = new THREE.BufferAttribute(from, 3);
  const toAttr = new THREE.BufferAttribute(to, 3);
  fromAttr.setUsage(THREE.DynamicDrawUsage);
  toAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aFrom', fromAttr);
  geometry.setAttribute('aTo', toAttr);
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));

  const uniforms = {
    uFromO: { value: new THREE.Vector2() },
    uToO: { value: new THREE.Vector2() },
    uSpan: { value: 1 },
    uMix: { value: 0 },
    uTime: { value: 0 },
    uDpr: { value: dpr },
    uOpacity: { value: small ? 0.75 : 0.9 },
    uPointer: { value: new THREE.Vector2(-999, -999) },
    uPush: { value: 0 },
    uBrand: { value: new THREE.Vector3(BRAND[0], BRAND[1], BRAND[2]) },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec3 aFrom;
      attribute vec3 aTo;
      attribute vec4 aSeed; // x: phase, y: size, z: tone, w: delay jitter
      uniform vec2 uFromO;
      uniform vec2 uToO;
      uniform float uSpan;
      uniform float uMix;
      uniform float uTime;
      uniform float uDpr;
      uniform vec2 uPointer;
      uniform float uPush;
      varying float vBright;
      varying float vTone;
      varying float vStorm;

      void main() {
        // Grains leave left to right, each a moment after the one before: sand blown off the mark.
        float sweep = clamp(aFrom.x / max(uSpan, 1.0), 0.0, 1.0);
        float delay = sweep * 0.22 + aSeed.w * 0.26;
        float t = clamp((uMix - delay) / 0.52, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float storm = sin(3.14159265 * t);

        vec2 a = uFromO + aFrom.xy;
        vec2 b = uToO + aTo.xy;
        vec2 p = mix(a, b, e);

        // In flight the grains spread into a drifting ribbon and swirl a little.
        vec2 dir = b - a;
        float len = length(dir);
        vec2 n = len > 0.001 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
        p += n * storm * (aSeed.x - 0.5) * min(len * 0.3, 150.0);
        float ph = aSeed.x * 6.2831;
        p += vec2(sin(uTime * 1.3 + ph * 7.0), cos(uTime * 1.1 + aSeed.z * 30.0)) * storm * (10.0 + aSeed.z * 22.0);

        // At rest the sand still shimmers; loose grains drift further.
        float bright = mix(aFrom.z, aTo.z, e);
        float rest = 1.0 - storm;
        float loose = 1.0 - step(0.4, bright);
        p.x += sin(uTime * 0.7 + ph * 9.0) * (0.7 + loose * 7.0) * rest;
        p.y += cos(uTime * 0.6 + aSeed.z * 50.0) * (0.5 + loose * 5.0) * rest;

        // A fine pointer brushes grains aside.
        vec2 d = p - uPointer;
        float r2 = dot(d, d);
        p += normalize(d + 0.0001) * uPush * exp(-r2 / 1800.0) * (10.0 + aSeed.x * 16.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, -p.y, 0.0, 1.0);
        gl_PointSize = aSeed.y * uDpr * (1.0 + storm * 0.25);
        vBright = bright;
        vTone = aSeed.z;
        vStorm = storm;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uBrand;
      varying float vBright;
      varying float vTone;
      varying float vStorm;

      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        if (d > 0.5) discard;
        float soft = smoothstep(0.5, 0.1, d);
        vec3 sandDark = vec3(0.62, 0.53, 0.42);
        vec3 sandLight = vec3(0.98, 0.92, 0.82);
        vec3 col = mix(sandDark, sandLight, vTone * 0.6 + vBright * 0.4);
        // Roughly one grain in seven is brand red, so the marks read as KERSIVO, not decoration.
        float red = step(0.86, vTone);
        col = mix(col, uBrand * 1.3, red);
        float a = soft * uOpacity * vBright * (1.0 - vStorm * 0.35);
        gl_FragColor = vec4(col * a, a);
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  /* ---------- Which mark is current ---------- */

  type Live = { index: number; box: Box; shape: Float32Array; w: number; h: number };
  const shapeFor = (index: number, box: Box) => layout(targets[index].mark, box.w, box.h, count, 1013 + index * 7919);
  const boxOf = (index: number) => measure(targets[index].el, targets[index].text, range);

  /** The last target, in page order, whose centre has passed the middle of the viewport and is still on screen. */
  const pick = (): number => {
    const vh = window.innerHeight;
    let chosen = -1;
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i].el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const centre = r.top + r.height / 2;
      if (centre < vh * 0.52 && r.bottom > vh * 0.1) chosen = i;
    }
    return chosen;
  };

  const firstBox = boxOf(0) ?? { x: window.innerWidth * 0.1, y: window.innerHeight * 0.2, w: 300, h: 40 };
  let source: { origin: Box; shape: Float32Array; follow: number } = {
    origin: firstBox,
    shape: layout('scatter', firstBox.w, firstBox.h, count, 7),
    follow: 0,
  };
  let current: Live = { index: 0, box: firstBox, shape: shapeFor(0, firstBox), w: firstBox.w, h: firstBox.h };
  let mix = 0;

  const upload = () => {
    from.set(source.shape);
    to.set(current.shape);
    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    let span = 1;
    for (let i = 0; i < count; i++) span = Math.max(span, source.shape[i * 3]);
    uniforms.uSpan.value = span;
  };
  upload();

  /** Freezes where every grain is right now (ignoring the in-flight swirl) as the start of the next move. */
  const settleInto = (origin: Box): Float32Array => {
    const out = new Float32Array(count * 3);
    const fx = source.origin.x;
    const fy = source.origin.y;
    for (let i = 0; i < count; i++) {
      const sweep = Math.min(1, Math.max(0, from[i * 3] / Math.max(uniforms.uSpan.value, 1)));
      const delay = sweep * 0.22 + seeds[i * 4 + 3] * 0.26;
      const t = Math.min(1, Math.max(0, (mix - delay) / 0.52));
      const e = t * t * (3 - 2 * t);
      const ax = fx + from[i * 3];
      const ay = fy + from[i * 3 + 1];
      const bx = current.box.x + to[i * 3];
      const by = current.box.y + to[i * 3 + 1];
      out[i * 3] = ax + (bx - ax) * e - origin.x;
      out[i * 3 + 1] = ay + (by - ay) * e - origin.y;
      out[i * 3 + 2] = from[i * 3 + 2] + (to[i * 3 + 2] - from[i * 3 + 2]) * e;
    }
    return out;
  };

  const moveTo = (index: number) => {
    const box = boxOf(index);
    if (!box) return;
    // The new move starts from wherever the sand is now, anchored to the mark it was heading for.
    source = { origin: current.box, shape: mix >= 0.999 ? current.shape : settleInto(current.box), follow: current.index };
    current = { index, box, shape: shapeFor(index, box), w: box.w, h: box.h };
    mix = 0;
    upload();
  };

  /* ---------- Sizing, pointer, loop ---------- */

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.left = 0;
    camera.right = w;
    camera.top = 0;
    camera.bottom = -h;
    camera.updateProjectionMatrix();
    // Marks are laid out in pixels; rebuild the current one for the new size.
    const box = boxOf(current.index);
    if (box) {
      current = { ...current, box, shape: shapeFor(current.index, box), w: box.w, h: box.h };
      if (mix >= 0.999) source = { ...source, shape: current.shape, origin: box, follow: current.index };
      upload();
    }
  };

  let px = -999;
  let py = -999;
  let push = 0;
  let pushTarget = 0;
  const onPointer = (event: PointerEvent) => {
    px = event.clientX;
    py = event.clientY;
    pushTarget = 1;
  };
  const onLeave = () => {
    pushTarget = 0;
  };

  resize();
  window.addEventListener('resize', resize);
  if (finePointer) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  const clock = new THREE.Clock();
  let running = false;
  let last = 0;
  let candidate = -1;
  let candidateSince = 0;

  const frame = () => {
    const time = clock.getElapsedTime();
    const dt = Math.min(0.05, time - last);
    last = time;

    // After the intro, follow the most important element in view (with a short debounce).
    if (time > INTRO_HOLD) {
      const next = pick();
      if (next !== candidate) {
        candidate = next;
        candidateSince = time;
      }
      if (candidate >= 0 && candidate !== current.index && time - candidateSince > 0.14) moveTo(candidate);
    }

    mix = Math.min(1, mix + dt / MORPH_SECONDS);

    // Re-measure both ends every frame so the sand rides along with the page.
    const toBox = boxOf(current.index);
    if (toBox) {
      if (Math.abs(toBox.w - current.w) > 3 || Math.abs(toBox.h - current.h) > 3) {
        current = { ...current, box: toBox, shape: shapeFor(current.index, toBox), w: toBox.w, h: toBox.h };
        to.set(current.shape);
        toAttr.needsUpdate = true;
      }
      current.box = toBox;
    }
    const fromBox = source.follow === current.index ? current.box : boxOf(source.follow);
    if (fromBox) source.origin = fromBox;
    uniforms.uFromO.value.set(source.origin.x, source.origin.y);
    uniforms.uToO.value.set(current.box.x, current.box.y);
    uniforms.uMix.value = mix;
    uniforms.uTime.value = time;

    push += (pushTarget - push) * Math.min(1, dt * 3);
    uniforms.uPointer.value.set(px, py);
    uniforms.uPush.value = push;

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
  requestAnimationFrame(() => layer.classList.add('is-ready'));

  return () => {
    pause();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    range.detach();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    layer.remove();
  };
}
