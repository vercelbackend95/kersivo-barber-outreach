/**
 * The homepage sand layer. The hero stays clean: the sand first appears at the One booking chapter
 * and, in every chapter after that, sculpts the one word that chapter is about (BOOKED., ONE DIARY,
 * YOUR CLIENTS, GO LIVE…) in the space its heading reserves for it.
 *
 * The words live in the markup as empty `[data-hv2-glyph]` slots that CSS places (beside the heading
 * on wide screens, under the lead on phones), so layout stays in CSS and the text stays in the
 * component. three.js loads lazily shortly after first paint, only when motion is allowed and WebGL
 * works.
 *
 * Two modes:
 * - Wide screens: one fixed full-viewport canvas. Positions are measured from the DOM every frame
 *   (CSS pixels, orthographic camera) and the sand blows from one chapter's word to the next.
 * - Phones: a small canvas that lives inside the current slot, so it scrolls with the page natively.
 *   A fixed overlay that follows the page from JS always trails touch scrolling (scroll runs off the
 *   main thread) and stretches when the browser toolbar collapses; a canvas in the flow does neither.
 *   Each word pours in from loose sand as its chapter arrives.
 */
type Three = typeof import('three');

type Mark = 'underline' | 'frame' | 'glyph';
type Target = { selector: string; mark: Mark; text?: boolean };

const BRAND = [0xd7 / 255, 0x26 / 255, 0x38 / 255];
/** Seconds for a full move between two marks at reading speed; fast scrolling shortens it. */
const MORPH_SECONDS = 0.95;
/** Phones: the canvas reaches this far past its slot so loose grains and the pour-in are not clipped. */
const LOCAL_PAD = 28;

type Box = { x: number; y: number; w: number; h: number };
type Resolved = Target & { el: HTMLElement; word?: string };

export function createScene(host: HTMLElement, onUnavailable?: () => void): () => void {
  let disposed = false;
  let teardown: (() => void) | null = null;

  const start = () => {
    if (disposed) return;
    void Promise.all([import('three'), document.fonts?.ready ?? Promise.resolve()]).then(([THREE]) => {
      if (disposed) return;
      try {
        teardown = mount(THREE, host, onUnavailable);
      } catch {
        teardown = null;
        onUnavailable?.();
      }
    }, () => onUnavailable?.());
  };

  // Start soon after first paint instead of waiting for every image on the page to load.
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
    .requestIdleCallback;
  const idleHandle = idle ? idle(start, { timeout: 500 }) : window.setTimeout(start, 250);

  return () => {
    disposed = true;
    const cancel = (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
    if (idle !== undefined && cancel !== undefined) cancel(idleHandle);
    else window.clearTimeout(idleHandle);
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

/** Orders grains left to right so a move sweeps across like wind instead of every grain crossing. */
function sweepOrder(out: Float32Array, count: number, rand: () => number): Float32Array {
  const order = Array.from({ length: count }, (_, i) => i);
  const key = new Float32Array(count);
  for (let i = 0; i < count; i++) key[i] = out[i * 3] + (rand() - 0.5) * 30;
  order.sort((a, b) => key[a] - key[b]);
  const sorted = new Float32Array(count * 3);
  order.forEach((from, to) => sorted.set(out.subarray(from * 3, from * 3 + 3), to * 3));
  return sorted;
}

/**
 * Sculpts `word` out of sand inside a w × h slot: the word is drawn once into a small offscreen
 * canvas in the slot's own font and alignment, and grains are dropped onto its filled pixels. Edges
 * get the brightest grains so the letters stay crisp; about one grain in ten settles into a low dune
 * along the baseline, as if the word had just been poured.
 */
function glyphLayout(word: string, slot: HTMLElement, w: number, h: number, count: number, seed: number): Float32Array {
  const out = new Float32Array(count * 3);
  const rand = rng(seed);
  const style = getComputedStyle(slot);
  const family = style.fontFamily || 'sans-serif';
  const align = style.textAlign === 'right' || style.textAlign === 'end' ? 'right' : style.textAlign === 'center' ? 'center' : 'left';

  // Sample at a capped resolution; positions scale back up to the slot.
  const scale = Math.min(1, 900 / Math.max(w, 1), 320 / Math.max(h, 1));
  const cw = Math.max(8, Math.round(w * scale));
  const ch = Math.max(8, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;

  // Fit the word to the slot: as tall as the slot allows, never wider than it.
  let size = ch * 1.02;
  ctx.font = `400 ${size}px ${family}`;
  const measured = ctx.measureText(word).width;
  if (measured > cw * 0.98) size *= (cw * 0.98) / measured;
  ctx.font = `400 ${size}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = align;
  ctx.fillStyle = '#fff';
  const metrics = ctx.measureText(word);
  const ascent = metrics.actualBoundingBoxAscent || size * 0.72;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baseline = ch - Math.max(2, descent) - (ch - ascent - descent) * 0.12;
  const x = align === 'right' ? cw - 1 : align === 'center' ? cw / 2 : 1;
  ctx.fillText(word, x, baseline);

  const data = ctx.getImageData(0, 0, cw, ch).data;
  const filled: number[] = [];
  const edge: number[] = [];
  let minX = cw;
  let maxX = 0;
  for (let py = 1; py < ch - 1; py++) {
    for (let px = 1; px < cw - 1; px++) {
      const i = (py * cw + px) * 4 + 3;
      if (data[i] < 128) continue;
      const p = py * cw + px;
      filled.push(p);
      if (data[i - 4] < 128 || data[i + 4] < 128 || data[i - cw * 4] < 128 || data[i + cw * 4] < 128) edge.push(p);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
    }
  }
  if (filled.length === 0) return out;

  const inv = 1 / scale;
  const put = (i: number, gx: number, gy: number, b: number) => {
    out[i * 3] = gx;
    out[i * 3 + 1] = gy;
    out[i * 3 + 2] = b;
  };
  const dune = Math.floor(count * 0.1);
  for (let i = 0; i < count; i++) {
    if (i < dune) {
      // A low dune under the word: a heap that is tallest in the middle and blows out at the ends.
      const u = rand();
      const span = (maxX - minX + 1) * inv;
      const heap = Math.pow(Math.sin(Math.PI * u), 1.6) * Math.min(14, h * 0.07);
      put(i, minX * inv + u * span * 1.04 - span * 0.02, (baseline + 3) * inv + 4 - Math.abs(gauss(rand)) * heap, 0.32 + rand() * 0.28);
      continue;
    }
    const fromEdge = edge.length > 0 && rand() < 0.38;
    const list = fromEdge ? edge : filled;
    const p = list[Math.floor(rand() * list.length)];
    const gx = ((p % cw) + rand()) * inv;
    const gy = (Math.floor(p / cw) + rand()) * inv;
    put(i, gx, gy, fromEdge ? 0.9 + rand() * 0.1 : 0.62 + rand() * 0.33);
  }
  return sweepOrder(out, count, rand);
}

/**
 * Lays `count` grains out as a mark around a box of size w × h, as offsets from the box's top-left
 * corner, plus a brightness. About one grain in eight hangs loose around the mark like blown sand.
 */
function markLayout(mark: 'underline' | 'frame' | 'scatter', w: number, h: number, count: number, seed: number): Float32Array {
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
      put(i, cx, cy, 0.14 + rand() * 0.12);
      continue;
    }

    if (mark === 'underline') {
      // A brushed stroke: thick in the middle, tapering at both ends, with a slight wave.
      const u = rand();
      const x = -0.015 * w + u * w * 1.03;
      const taper = Math.pow(Math.sin(Math.PI * u), 0.55);
      const thick = Math.min(4.5, Math.max(2.2, h * 0.055)) * taper;
      const y = h + 4 + thick + Math.sin(u * 9.5) * 1.2 + gauss(rand) * thick;
      put(i, x, y, 0.35 + rand() * 0.3);
    } else {
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
      put(i, x - pad + gauss(rand) * 1.4, y - pad + gauss(rand) * 1.4, 0.32 + rand() * 0.3);
    }
  }
  return sweepOrder(out, count, rand);
}

function mount(THREE: Three, host: HTMLElement, onUnavailable?: () => void): () => void {
  if (!hasWebGL()) {
    onUnavailable?.();
    return () => {};
  }

  // Phones (and narrow tablets) draw the sand inside the current slot instead of over the viewport.
  const local = window.matchMedia('(max-width: 47.99rem)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const count = local ? 7000 : 14000;
  const range = document.createRange();

  const targets: Resolved[] = [];
  for (const slot of Array.from(document.querySelectorAll<HTMLElement>('[data-hv2-glyph]'))) {
    const word = slot.dataset.hv2Glyph?.trim();
    if (word) targets.push({ selector: '', mark: 'glyph', el: slot, word });
  }
  if (targets.length === 0) return () => {};

  // Wide screens: above the page (so it can reach any chapter) but never taking input.
  // Phones: inside the active slot, moved from slot to slot as the chapters arrive.
  const layer = document.createElement('div');
  layer.className = local ? 'hv2-sand hv2-sand--local' : 'hv2-sand';
  layer.setAttribute('aria-hidden', 'true');
  if (local) layer.style.setProperty('--hv2-sand-pad', `${LOCAL_PAD}px`);
  else (host.parentElement ?? document.body).appendChild(layer);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: local ? 'default' : 'high-performance' });
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
    // Phones get slightly coarser grains so the word reads at arm's length.
    seeds[i * 4 + 1] = (1.0 + Math.pow(seedRand(), 2.4) * 1.8) * (local ? 1.25 : 1);
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
    uOpacity: { value: 0.92 },
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
        // The whole sweep fits inside uMix 0..1 so a move never lingers after the scroll has settled.
        float sweep = clamp(aFrom.x / max(uSpan, 1.0), 0.0, 1.0);
        float delay = sweep * 0.18 + aSeed.w * 0.2;
        float t = clamp((uMix - delay) / 0.62, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - t, 3.0);
        float storm = sin(3.14159265 * t);

        vec2 a = uFromO + aFrom.xy;
        vec2 b = uToO + aTo.xy;
        vec2 p = mix(a, b, e);

        // In flight the grains spread into a drifting ribbon and swirl a little.
        vec2 dir = b - a;
        float len = length(dir);
        vec2 n = len > 0.001 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);
        p += n * storm * (aSeed.x - 0.5) * min(len * 0.25, 120.0);
        float ph = aSeed.x * 6.2831;
        p += vec2(sin(uTime * 1.3 + ph * 7.0), cos(uTime * 1.1 + aSeed.z * 30.0)) * storm * (8.0 + aSeed.z * 18.0);

        // At rest the sand still shimmers; loose grains drift further.
        float bright = mix(aFrom.z, aTo.z, e);
        float rest = 1.0 - storm;
        float loose = 1.0 - step(0.3, bright);
        p.x += sin(uTime * 0.7 + ph * 9.0) * (0.5 + loose * 6.0) * rest;
        p.y += cos(uTime * 0.6 + aSeed.z * 50.0) * (0.4 + loose * 4.0) * rest;

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
        // Warm sand from umber to pale dune, with a rare brand-red grain as the KERSIVO fleck.
        vec3 sandDark = vec3(0.56, 0.44, 0.31);
        vec3 sandLight = vec3(0.97, 0.89, 0.74);
        vec3 col = mix(sandDark, sandLight, vTone * 0.55 + vBright * 0.45);
        float red = step(0.965, vTone);
        col = mix(col, uBrand * 1.25, red);
        float a = soft * uOpacity * vBright * (1.0 - vStorm * 0.3);
        gl_FragColor = vec4(col * a, a);
      }`,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  /* ---------- Which mark is current ---------- */

  type Live = { index: number; box: Box; shape: Float32Array; w: number; h: number };
  const shapes = new Map<string, Float32Array>();
  const shapeFor = (index: number, box: Box): Float32Array => {
    const target = targets[index];
    const key = `${index}:${Math.round(box.w)}x${Math.round(box.h)}`;
    const cached = shapes.get(key);
    if (cached) return cached;
    const shape =
      target.mark === 'glyph' && target.word
        ? glyphLayout(target.word, target.el, box.w, box.h, count, 1013 + index * 7919)
        : markLayout(target.mark === 'glyph' ? 'underline' : target.mark, box.w, box.h, count, 1013 + index * 7919);
    shapes.set(key, shape);
    return shape;
  };

  /**
   * Where a target sits in canvas pixels. Wide screens: its viewport box. Phones: its layout size,
   * offset by the canvas padding, which never changes while the page scrolls.
   */
  const boxOf = (index: number): Box | null => {
    const el = targets[index].el;
    if (!local) return measure(el, targets[index].text, range);
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return w < 2 || h < 2 ? null : { x: LOCAL_PAD, y: LOCAL_PAD, w, h };
  };

  /**
   * The last target, in page order, that has come up into the lower part of the viewport and is still
   * on screen. Reacting at 78% (not the middle) means the sand is already moving as a chapter arrives.
   */
  const pick = (): number => {
    const vh = window.innerHeight;
    let chosen = -1;
    for (let i = 0; i < targets.length; i++) {
      const r = targets[i].el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (r.top < vh * 0.78 && r.bottom > vh * 0.08) chosen = i;
    }
    return chosen;
  };

  // Nothing is drawn until the first chapter word comes into view.
  let started = false;
  const blank: Box = { x: 0, y: 0, w: 1, h: 1 };
  let source: { origin: Box; shape: Float32Array; follow: number } = { origin: blank, shape: new Float32Array(count * 3), follow: -1 };
  let current: Live = { index: -1, box: blank, shape: new Float32Array(count * 3), w: 1, h: 1 };
  let mix = 1;

  const upload = () => {
    from.set(source.shape);
    to.set(current.shape);
    fromAttr.needsUpdate = true;
    toAttr.needsUpdate = true;
    let span = 1;
    for (let i = 0; i < count; i++) span = Math.max(span, source.shape[i * 3]);
    uniforms.uSpan.value = span;
  };

  /** Freezes where every grain is right now (ignoring the in-flight swirl) as the start of the next move. */
  const settleInto = (origin: Box): Float32Array => {
    const out = new Float32Array(count * 3);
    const fx = source.origin.x;
    const fy = source.origin.y;
    const span = Math.max(uniforms.uSpan.value, 1);
    for (let i = 0; i < count; i++) {
      const sweep = Math.min(1, Math.max(0, from[i * 3] / span));
      const delay = sweep * 0.18 + seeds[i * 4 + 3] * 0.2;
      const t = Math.min(1, Math.max(0, (mix - delay) / 0.62));
      const e = 1 - Math.pow(1 - t, 3);
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

  /** Phones: size the canvas to the slot plus its padding and point the camera at it. */
  const fitLocal = (box: Box) => {
    const w = Math.round(box.w + LOCAL_PAD * 2);
    const h = Math.round(box.h + LOCAL_PAD * 2);
    renderer.setSize(w, h, false);
    camera.left = 0;
    camera.right = w;
    camera.top = 0;
    camera.bottom = -h;
    camera.updateProjectionMatrix();
  };

  const moveTo = (index: number) => {
    const box = boxOf(index);
    if (!box) return;
    if (local || !started) {
      // Pour in: the word gathers out of loose sand around its own slot.
      if (local) {
        targets[index].el.appendChild(layer);
        fitLocal(box);
      }
      source = { origin: box, shape: markLayout('scatter', box.w, box.h, count, 7 + index), follow: index };
    } else {
      // The new move starts from wherever the sand is now, anchored to the mark it was heading for.
      source = { origin: current.box, shape: mix >= 0.999 ? current.shape : settleInto(current.box), follow: current.index };
    }
    current = { index, box, shape: shapeFor(index, box), w: box.w, h: box.h };
    mix = 0;
    upload();
    if (!started) {
      started = true;
      requestAnimationFrame(() => layer.classList.add('is-ready'));
    }
  };

  /* ---------- Sizing, pointer, scroll speed, loop ---------- */

  let lastW = 0;
  let lastH = 0;
  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Phones fire resize whenever the browser toolbar shows or hides; only a width change matters there.
    if (local && w === lastW) return;
    if (!local && w === lastW && h === lastH) return;
    lastW = w;
    lastH = h;
    shapes.clear();
    if (!local) {
      renderer.setSize(w, h, false);
      camera.left = 0;
      camera.right = w;
      camera.top = 0;
      camera.bottom = -h;
      camera.updateProjectionMatrix();
    }
    if (current.index < 0) return;
    // Marks are laid out in pixels; rebuild the current one for the new size.
    const box = boxOf(current.index);
    if (box) {
      if (local) fitLocal(box);
      current = { ...current, box, shape: shapeFor(current.index, box), w: box.w, h: box.h };
      if (local || mix >= 0.999) {
        source = { ...source, shape: current.shape, origin: box, follow: current.index };
        mix = 1;
      }
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

  // Scroll speed (px/s, smoothed). A fast flick through the page should not leave the sand behind.
  let lastY = window.scrollY;
  let speed = 0;
  // Re-check the target on scroll as well as every frame, so a move starts on the scroll event itself.
  let dirty = true;
  const onScroll = () => {
    dirty = true;
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('scroll', onScroll, { passive: true });
  if (finePointer && !local) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  const clock = new THREE.Clock();
  let running = false;
  let last = 0;

  const frame = () => {
    const time = clock.getElapsedTime();
    const dt = Math.min(0.05, time - last);
    last = time;

    const y = window.scrollY;
    const instant = dt > 0 ? Math.abs(y - lastY) / dt : 0;
    lastY = y;
    speed += (instant - speed) * Math.min(1, dt * 10);

    // Follow the chapter word in view.
    if (dirty) {
      dirty = false;
      const next = pick();
      if (next >= 0 && next !== current.index) moveTo(next);
    }
    if (!started) return;

    // Reading speed: a full move in MORPH_SECONDS. Flicking through: up to three times faster.
    const boost = 1 + Math.min(2, speed / 1400);
    mix = Math.min(1, mix + (dt / MORPH_SECONDS) * boost);

    if (local) {
      // The canvas scrolls with its slot. Skip drawing while it is off screen.
      const r = layer.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
    } else {
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
      if (mix < 1) {
        const fromBox = source.follow === current.index ? current.box : boxOf(source.follow);
        if (fromBox) source.origin = fromBox;
      }
    }
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

  return () => {
    pause();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', resize);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointer);
    document.documentElement.removeEventListener('pointerleave', onLeave);
    range.detach();
    shapes.clear();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    layer.remove();
  };
}
