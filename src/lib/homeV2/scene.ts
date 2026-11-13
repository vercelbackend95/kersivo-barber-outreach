/**
 * The /home-v2 backdrop: a field of sand grains that drifts into a new shape for each chapter
 * (scissors, the 10:15 booking clock, a diary, 0%, £39, a tick, a question mark) and blows through
 * a short sandstorm in between. The shape follows the section on screen, not raw page progress.
 *
 * three.js loads lazily, after first paint, and only when motion is allowed and WebGL works;
 * otherwise the CSS glow stays.
 */
type Three = typeof import('three');

/** Shape per chapter, in page order. A dune opens and closes the journey. */
const CHAPTERS: Array<{ selector: string; shape: ShapeName }> = [
  { selector: '#hero', shape: 'scissors' },
  { selector: '#one-booking', shape: 'clock' },
  { selector: '#live-demo', shape: 'diary' },
  { selector: '#why-kersivo-is-different', shape: 'zero' },
  { selector: '#pricing', shape: 'price' },
  { selector: '#setup', shape: 'tick' },
  { selector: '#faq', shape: 'question' },
  { selector: '.hv2-contact', shape: 'dune' },
];

type ShapeName = 'dune' | 'scissors' | 'clock' | 'diary' | 'zero' | 'price' | 'tick' | 'question';

/** Normalised shape: x/y roughly in [-0.5, 0.5] (height 1), w = grain brightness. */
type Shape = Float32Array;

const BRAND = [0xd7 / 255, 0x26 / 255, 0x38 / 255];

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

/* ---------- Shape sampling ---------- */

const SIZE = 320;

/** Deterministic random, so every visit draws the same grains. */
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

function headingFont(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--font-heading').trim();
  return value || '"Bebas Neue", Impact, sans-serif';
}

function drawShape(ctx: CanvasRenderingContext2D, name: ShapeName) {
  const c = SIZE / 2;
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const fitText = (text: string, weight = '400') => {
    const family = headingFont();
    ctx.font = `${weight} 100px ${family}`;
    const m = ctx.measureText(text);
    const h = (m.actualBoundingBoxAscent || 72) + (m.actualBoundingBoxDescent || 0);
    const scale = Math.min((SIZE * 0.86) / m.width, (SIZE * 0.82) / h);
    ctx.font = `${weight} ${Math.floor(100 * scale)}px ${family}`;
    const m2 = ctx.measureText(text);
    const asc = m2.actualBoundingBoxAscent || 72 * scale;
    const desc = m2.actualBoundingBoxDescent || 0;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, c - m2.width / 2, c + (asc - desc) / 2);
  };

  switch (name) {
    case 'scissors': {
      // Open barber scissors lying on their side, tips to the right: ring handles, crossed blades, pivot screw.
      ctx.translate(c, c);
      ctx.rotate(Math.PI / 2);
      ctx.translate(-c, -c);
      const blade = (bx: number, by: number, tx: number, ty: number, w: number) => {
        const dx = tx - bx;
        const dy = ty - by;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        ctx.beginPath();
        ctx.moveTo(bx + nx * w, by + ny * w);
        ctx.quadraticCurveTo(bx + dx * 0.55 + nx * w * 1.1, by + dy * 0.55 + ny * w * 1.1, tx, ty);
        ctx.lineTo(bx - nx * w * 0.4, by - ny * w * 0.4);
        ctx.closePath();
        ctx.fill();
      };
      blade(118, 238, 262, 22, 17);
      blade(202, 238, 58, 22, 17);
      ctx.lineWidth = 15;
      ctx.beginPath();
      ctx.arc(96, 262, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(224, 262, 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(122, 232);
      ctx.lineTo(132, 214);
      ctx.moveTo(198, 232);
      ctx.lineTo(188, 214);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(160, 150, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'clock': {
      // The demo booking's time: 10:15.
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.arc(c, c, 132, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const inner = i % 3 === 0 ? 96 : 108;
        ctx.lineWidth = i % 3 === 0 ? 10 : 6;
        ctx.beginPath();
        ctx.moveTo(c + Math.sin(a) * inner, c - Math.cos(a) * inner);
        ctx.lineTo(c + Math.sin(a) * 118, c - Math.cos(a) * 118);
        ctx.stroke();
      }
      const hand = (angle: number, len: number, w: number) => {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(c, c);
        ctx.lineTo(c + Math.sin(angle) * len, c - Math.cos(angle) * len);
        ctx.stroke();
      };
      hand(((10 + 15 / 60) / 12) * Math.PI * 2, 62, 14);
      hand((15 / 60) * Math.PI * 2, 92, 9);
      ctx.beginPath();
      ctx.arc(c, c, 13, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'diary': {
      // A week view: header bar, binder rings and a grid with booked slots.
      const x0 = 32;
      const y0 = 58;
      const w = 256;
      const h = 228;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, h, 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.roundRect(x0, y0, w, 44, [18, 18, 0, 0]);
      ctx.fill();
      ctx.lineWidth = 11;
      for (const rx of [92, 160, 228]) {
        ctx.beginPath();
        ctx.moveTo(rx, 36);
        ctx.lineTo(rx, 72);
        ctx.stroke();
      }
      const booked = new Set([1, 4, 9, 10, 15, 19, 20, 24, 30, 33]);
      const cols = 7;
      const rows = 5;
      const gx = x0 + 18;
      const gy = y0 + 62;
      const cw = (w - 36) / cols;
      const ch = (h - 80) / rows;
      for (let r = 0; r < rows; r++) {
        for (let k = 0; k < cols; k++) {
          const i = r * cols + k;
          const x = gx + k * cw + cw / 2;
          const y = gy + r * ch + ch / 2;
          if (booked.has(i)) {
            ctx.beginPath();
            ctx.roundRect(x - cw * 0.38, y - ch * 0.34, cw * 0.76, ch * 0.68, 5);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(x, y, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      break;
    }
    case 'zero':
      fitText('0%');
      break;
    case 'price':
      fitText('£39');
      break;
    case 'question':
      fitText('?');
      break;
    case 'tick': {
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(c, c, 128, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 34;
      ctx.beginPath();
      ctx.moveTo(98, 166);
      ctx.lineTo(142, 210);
      ctx.lineTo(226, 114);
      ctx.stroke();
      break;
    }
    case 'dune':
      break;
  }
}

/** Samples `count` grains: two thirds inside the shape, a third along its edge (brighter), plus loose drift. */
function sampleShape(name: ShapeName, count: number, seed: number): Shape {
  const out = new Float32Array(count * 4);
  const rand = rng(seed);

  if (name === 'dune') {
    // A wide, low dune of settled sand; x spans [-1.6, 1.6] and is stretched to the viewport later.
    for (let i = 0; i < count; i++) {
      const x = (rand() * 2 - 1) * 1.6;
      const ridge = -0.38 + Math.sin(x * 1.7 + 0.6) * 0.05 + Math.sin(x * 4.3) * 0.018;
      const depth = Math.pow(rand(), 1.8) * 0.28;
      out[i * 4] = x;
      out[i * 4 + 1] = ridge - depth;
      out[i * 4 + 2] = (rand() - 0.5) * 0.6;
      out[i * 4 + 3] = depth < 0.02 ? 1 : 0.55 - depth;
    }
    return out;
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  drawShape(ctx, name);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && data[(y * SIZE + x) * 4 + 3] > 110;

  const fill: number[] = [];
  const edge: number[] = [];
  let minX = SIZE;
  let maxX = 0;
  let minY = SIZE;
  let maxY = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!filled(x, y)) continue;
      const index = y * SIZE + x;
      if (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1)) edge.push(index);
      else fill.push(index);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!fill.length && !edge.length) return out;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxY - minY, (maxX - minX) / 1.2, 1);

  for (let i = 0; i < count; i++) {
    const roll = rand();
    let x: number;
    let y: number;
    let w: number;
    if (roll < 0.09) {
      // Loose grains hanging around the shape.
      const a = rand() * Math.PI * 2;
      const r = 0.42 + Math.pow(rand(), 0.6) * 0.5;
      x = Math.cos(a) * r * 1.1;
      y = Math.sin(a) * r * 0.85;
      out[i * 4] = x;
      out[i * 4 + 1] = y;
      out[i * 4 + 2] = (rand() - 0.5) * 0.5;
      out[i * 4 + 3] = 0.25;
      continue;
    }
    const fromEdge = (roll < 0.4 && edge.length) || !fill.length;
    const pool = fromEdge ? edge : fill;
    const index = pool[Math.floor(rand() * pool.length)];
    x = ((index % SIZE) + rand() - cx) / span;
    y = -((Math.floor(index / SIZE) + rand() - cy) / span);
    w = fromEdge ? 1 : 0.55 + rand() * 0.2;
    out[i * 4] = x;
    out[i * 4 + 1] = y;
    out[i * 4 + 2] = (rand() - 0.5) * 0.07;
    out[i * 4 + 3] = w;
  }

  // Sort grains left to right (with a little noise) so a morph sweeps across like wind, instead of
  // every grain crossing the whole shape.
  const order = Array.from({ length: count }, (_, i) => i);
  const key = new Float32Array(count);
  for (let i = 0; i < count; i++) key[i] = out[i * 4] + out[i * 4 + 1] * 0.25 + (rand() - 0.5) * 0.12;
  order.sort((a, b) => key[a] - key[b]);
  const sorted = new Float32Array(count * 4);
  order.forEach((from, to) => sorted.set(out.subarray(from * 4, from * 4 + 4), to * 4));
  return sorted;
}

/* ---------- Scene ---------- */

function mount(THREE: Three, host: HTMLElement): () => void {
  if (!hasWebGL()) return () => {};

  const small = window.matchMedia('(max-width: 47.99rem)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const count = small ? 9000 : 24000;

  const chapters = CHAPTERS.map((chapter) => ({ ...chapter, el: document.querySelector<HTMLElement>(chapter.selector) })).filter(
    (chapter): chapter is (typeof CHAPTERS)[number] & { el: HTMLElement } => chapter.el !== null,
  );
  // Index 0 is the opening dune the sand rises from.
  const names: ShapeName[] = ['dune', ...chapters.map((chapter) => chapter.shape)];
  const shapes = names.map((name, index) => sampleShape(name, count, 1013 + index * 7919));

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'hv2-scene__canvas';
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const geometry = new THREE.BufferGeometry();
  const from = new Float32Array(count * 4);
  const to = new Float32Array(count * 4);
  const seeds = new Float32Array(count * 4);
  const seedRand = rng(42);
  for (let i = 0; i < count; i++) {
    seeds[i * 4] = seedRand();
    seeds[i * 4 + 1] = 0.8 + Math.pow(seedRand(), 2.2) * 1.7;
    seeds[i * 4 + 2] = seedRand();
    seeds[i * 4 + 3] = seedRand();
  }
  const fromAttr = new THREE.BufferAttribute(from, 4);
  const toAttr = new THREE.BufferAttribute(to, 4);
  fromAttr.setUsage(THREE.DynamicDrawUsage);
  toAttr.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('aFrom', fromAttr);
  geometry.setAttribute('aTo', toAttr);
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 100);

  const uniforms = {
    uMix: { value: 0 },
    uTime: { value: 0 },
    uPx: { value: dpr * (small ? 1.05 : 1) },
    uOpacity: { value: small ? 0.4 : 1.05 },
    uPointer: { value: new THREE.Vector2(99, 99) },
    uPush: { value: 0 },
    uWind: { value: 1 },
    uBrand: { value: new THREE.Vector3(BRAND[0], BRAND[1], BRAND[2]) },
  };

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms,
    vertexShader: /* glsl */ `
      attribute vec4 aFrom;
      attribute vec4 aTo;
      attribute vec4 aSeed; // x: phase, y: size, z: tone, w: delay jitter
      uniform float uMix;
      uniform float uTime;
      uniform float uPx;
      uniform vec2 uPointer;
      uniform float uPush;
      uniform float uWind;
      varying float vBright;
      varying float vTone;
      varying float vStorm;

      void main() {
        // Grains leave in a sweep from left to right; each waits for the wind to reach it.
        float sweep = clamp((aFrom.x + 0.9) / 2.6, 0.0, 1.0);
        float delay = sweep * 0.38 + aSeed.w * 0.12;
        float t = clamp((uMix - delay) / 0.5, 0.0, 1.0);
        float e = t * t * (3.0 - 2.0 * t);
        float storm = sin(3.14159265 * t);

        vec3 p = mix(aFrom.xyz, aTo.xyz, e);

        // In flight, grains lift, swirl and are carried by the wind.
        float ph = aSeed.x * 6.2831;
        vec3 swirl = vec3(
          sin(p.y * 1.3 + uTime * 0.9 + ph),
          cos(p.x * 1.1 - uTime * 0.7 + ph * 1.7),
          sin((p.x - p.y) * 0.9 + uTime * 0.5 + ph)
        );
        p += swirl * storm * (0.35 + aSeed.x * 0.9);
        p.x += storm * (0.6 + aSeed.w * 0.9) * uWind;
        p.y += storm * (0.25 + aSeed.z * 0.35);

        // At rest, the sand still breathes; loose grains drift more.
        float loose = step(aTo.w, 0.3) * (1.0 - storm);
        p.x += sin(uTime * 0.31 + ph * 3.0) * (0.006 + loose * 0.12);
        p.y += cos(uTime * 0.27 + ph * 2.0) * (0.006 + loose * 0.09) + loose * sin(uTime * 0.12 + ph) * 0.06;

        // A fine pointer brushes grains aside.
        vec2 d = p.xy - uPointer;
        float r2 = dot(d, d);
        p.xy += normalize(d + 0.0001) * uPush * exp(-r2 / 0.45) * (0.35 + aSeed.x * 0.4);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSeed.y * uPx * (1.0 + storm * 0.5) * (10.0 / -mv.z);

        vBright = mix(aFrom.w, aTo.w, e);
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
        float soft = smoothstep(0.5, 0.15, d);
        vec3 sandDark = vec3(0.55, 0.47, 0.38);
        vec3 sandLight = vec3(0.96, 0.89, 0.78);
        vec3 col = mix(sandDark, sandLight, vTone * 0.7 + vBright * 0.3);
        // About one grain in twelve is brand red; more glow red while the sand is in the air.
        float red = step(0.915 - vStorm * 0.12, vTone);
        col = mix(col, uBrand * 1.25, red);
        float a = soft * uOpacity * (0.28 + vBright * 0.72) * (1.0 - vStorm * 0.3);
        gl_FragColor = vec4(col * a, a);
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  /* World placement: shapes sit in the empty upper-right beside section headings on wide screens,
     and high in the centre, smaller and dimmer, on phones. */
  let halfW = 1;
  let halfH = 1;
  let worlds: Float32Array[] = [];
  const place = (name: ShapeName, shape: Shape): Float32Array => {
    const world = new Float32Array(shape.length);
    const wide = halfW / halfH > 1.1;
    let sx: number;
    let sy: number;
    let ox: number;
    let oy: number;
    if (name === 'dune') {
      sx = halfW * 0.72;
      sy = halfH * 1.6;
      ox = 0;
      oy = -halfH * 0.42;
    } else if (wide) {
      // Hero: beside the headline, above the compare stage. Chapters: beside the section heading.
      const s = Math.min(halfH * 0.82, halfW * 0.5);
      sx = sy = name === 'scissors' ? s * 0.78 : s;
      ox = name === 'scissors' ? halfW * 0.5 : halfW * 0.46;
      oy = name === 'scissors' ? halfH * 0.56 : halfH * 0.3;
    } else {
      const s = Math.min(halfW * 1.25, halfH * 0.75);
      sx = sy = s;
      ox = 0;
      oy = halfH * 0.32;
    }
    for (let i = 0; i < shape.length; i += 4) {
      world[i] = shape[i] * sx + ox;
      world[i + 1] = shape[i + 1] * sy + oy;
      world[i + 2] = shape[i + 2] * Math.min(sx, 3);
      world[i + 3] = shape[i + 3];
    }
    return world;
  };

  let segment = -1;
  const assign = (next: number) => {
    segment = next;
    from.set(worlds[next]);
    to.set(worlds[Math.min(worlds.length - 1, next + 1)]);
    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
  };

  const resize = () => {
    const w = host.clientWidth || window.innerWidth;
    const h = host.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    halfW = halfH * camera.aspect;
    worlds = names.map((name, index) => place(name, shapes[index]));
    if (segment >= 0) assign(segment);
    measure();
  };

  /* Scroll position in "shapes": 1 = hero shape, 2 = next chapter's shape, and so on. Each morph runs
     while the next chapter's top travels from the bottom of the viewport to 35% down it. */
  let tops: number[] = [];
  const measure = () => {
    tops = chapters.map((chapter) => chapter.el.getBoundingClientRect().top + window.scrollY);
  };
  const scrollShape = () => {
    const vh = window.innerHeight;
    const y = window.scrollY;
    let s = 0;
    for (let k = 1; k < tops.length; k++) s += Math.min(1, Math.max(0, (y + vh - tops[k]) / (vh * 0.65)));
    return s;
  };

  let intro = 0;
  let target = 0;
  let current = 0;
  let px = 99;
  let py = 99;
  let tx = 99;
  let ty = 99;
  let push = 0;
  let pushTarget = 0;
  let tilt = 0;
  let tiltTarget = 0;

  const onPointer = (event: PointerEvent) => {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = -((event.clientY / window.innerHeight) * 2 - 1);
    tx = nx * halfW;
    ty = ny * halfH;
    tiltTarget = nx;
    pushTarget = 1;
  };
  const onLeave = () => {
    pushTarget = 0;
  };

  resize();
  assign(0);
  window.addEventListener('resize', resize);
  if (finePointer) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }
  // Layout shifts as widgets hydrate; re-measure chapter tops now and then.
  const observer = new ResizeObserver(() => measure());
  const main = document.querySelector('.hv2');
  if (main) observer.observe(main);

  const clock = new THREE.Clock();
  let running = false;
  let last = 0;

  const frame = () => {
    const time = clock.getElapsedTime();
    const dt = Math.min(0.05, time - last);
    last = time;

    // The sand rises from the dune into the first shape on arrival.
    intro = Math.min(1, intro + dt / 2.4);
    target = scrollShape();
    const goal = Math.min(names.length - 1, intro + target);
    // Ease toward the scroll position; a fast scroll becomes a longer sandstorm, never a jump.
    current += (goal - current) * Math.min(1, dt * 2.6);
    if (Math.abs(goal - current) < 0.0005) current = goal;

    let seg = Math.min(names.length - 2, Math.floor(current));
    if (seg < 0) seg = 0;
    if (seg !== segment) assign(seg);
    uniforms.uMix.value = Math.min(1, Math.max(0, current - seg));
    uniforms.uWind.value = goal >= current ? 1 : -1;
    uniforms.uTime.value = time;

    px += (tx - px) * Math.min(1, dt * 6);
    py += (ty - py) * Math.min(1, dt * 6);
    push += (pushTarget * 0.5 - push) * Math.min(1, dt * 3);
    uniforms.uPointer.value.set(px, py);
    uniforms.uPush.value = push;
    tilt += (tiltTarget - tilt) * Math.min(1, dt * 1.5);
    points.rotation.y = Math.sin(time * 0.18) * 0.12 + tilt * 0.1;
    points.rotation.x = Math.cos(time * 0.14) * 0.04;

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
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
