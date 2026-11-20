// WebGL layer (three.js). Two small scenes, each a single full-canvas quad:
//   createHero     – the hero photograph: develops out of the dark once, then sinks back as you scroll.
//                    No pointer reaction and no ambient loop.
//   createChapters – the pinned "Inside the shop" frame: photographs wipe into each other
//                    through a grain-shaped edge, driven by scroll progress.
// Both render only when asked (main.js calls render() from the GSAP ticker while visible).

import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  // object-fit: cover, with a focal point
  vec2 coverUv(vec2 uv, vec2 res, vec2 img, vec2 focus) {
    float rs = res.x / res.y, ri = img.x / img.y;
    vec2 s = rs > ri ? vec2(1.0, ri / rs) : vec2(rs / ri, 1.0);
    return (uv - 0.5) * s + 0.5 + (focus - 0.5) * (1.0 - s);
  }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
    return v;
  }
`;

const HERO_FRAG = COMMON + /* glsl */`
  uniform sampler2D uTex;
  uniform vec2 uRes, uImg, uFocus;
  uniform float uProgress, uReveal;

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv;

    // slow push-in on load, deeper push as the next section slides over
    float zoom = 1.14 - 0.10 * uReveal + 0.12 * uProgress;
    uv = (uv - 0.5) / zoom + 0.5;

    // develop: grain-edged wipe rising from the floor
    float n = fbm(vec2(vUv.x * aspect, vUv.y) * 2.4);
    float edge = uReveal * 1.5 - 0.25;
    float hidden = smoothstep(edge - 0.25, edge, vUv.y * 0.72 + n * 0.28);
    uv += (1.0 - uReveal) * (n - 0.5) * 0.09;

    vec2 c = coverUv(uv, uRes, uImg, uFocus);
    float ca = (1.0 - uReveal) * 0.004;
    vec3 col = vec3(texture2D(uTex, c + vec2(ca, 0.0)).r, texture2D(uTex, c).g, texture2D(uTex, c - vec2(ca, 0.0)).b);

    col += vec3(0.78, 0.66, 0.40) * hidden * (1.0 - hidden) * 0.9;      // brass glint on the developing edge
    col *= 1.0 - 0.5 * uProgress;
    col = mix(col, vec3(0.059, 0.090, 0.086), hidden);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const CHAPTER_FRAG = COMMON + /* glsl */`
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uImgA, uImgB, uFocA, uFocB, uMouse;
  uniform float uMix, uDrift;

  void main() {
    float aspect = uRes.x / uRes.y;
    vec2 uv = vUv + (uMouse - 0.5) * -0.016;
    float n = fbm(vec2(vUv.x * aspect, vUv.y) * 2.8);
    float t = uMix;

    float e = t * 1.5 - 0.25;
    float keepA = smoothstep(e - 0.25, e, vUv.y * 0.7 + n * 0.3);   // 1 where the leaving picture still shows

    // the leaving picture lifts and stretches, the arriving one settles into place
    vec2 ua = (uv - 0.5) / (1.10 + 0.10 * t) + 0.5 + vec2(0.0, 0.10 * t) + (n - 0.5) * 0.10 * t;
    vec2 ub = (uv - 0.5) / (1.22 - 0.12 * t) + 0.5 - vec2(0.0, 0.10 * (1.0 - t)) + (n - 0.5) * 0.10 * (1.0 - t);
    ua.y += uDrift; ub.y += uDrift;

    vec3 a = texture2D(uA, coverUv(ua, uRes, uImgA, uFocA)).rgb;
    vec3 b = texture2D(uB, coverUv(ub, uRes, uImgB, uFocB)).rgb;
    vec3 col = mix(b, a, keepA);
    col += vec3(0.78, 0.66, 0.40) * keepA * (1.0 - keepA) * 1.1;     // brass along the wipe edge
    gl_FragColor = vec4(col, 1.0);
  }
`;

const quad = () => new THREE.PlaneGeometry(2, 2);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

function makeRenderer(canvas, maxDpr) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setClearColor(0x0f1716, 1);
  return renderer;
}

function makeTexture(img) {
  const t = new THREE.Texture(img);
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const focusOf = (img) => {
  const [x = 0.5, y = 0.5] = (img.dataset.focus || '').split(' ').map(Number);
  return new THREE.Vector2(x, 1 - y);          // GL uv runs bottom-up
};
const sizeOf = (img) => new THREE.Vector2(img.naturalWidth, img.naturalHeight);

function fit(renderer, canvas, uRes) {
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    uRes.value.set(w, h);
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
}

export function createHero(canvas, img) {
  const renderer = makeRenderer(canvas, 1.75);
  const scene = new THREE.Scene();

  const uniforms = {
    uTex: { value: makeTexture(img) },
    uRes: { value: new THREE.Vector2(1, 1) },
    uImg: { value: sizeOf(img) },
    uFocus: { value: focusOf(img) },
    uProgress: { value: 0 }, uReveal: { value: 0 },
  };
  scene.add(new THREE.Mesh(quad(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: HERO_FRAG, uniforms, depthTest: false })));
  fit(renderer, canvas, uniforms.uRes);

  // renders only when the reveal or the scroll has moved
  let last = '';
  return {
    uniforms,
    render() {
      const key = `${uniforms.uReveal.value}|${uniforms.uProgress.value}|${uniforms.uRes.value.x}|${uniforms.uRes.value.y}`;
      if (key === last) return;
      last = key;
      renderer.render(scene, camera);
    },
  };
}

export function createChapters(canvas, imgs) {
  const renderer = makeRenderer(canvas, 2);
  const scene = new THREE.Scene();
  const slides = imgs.map((img) => ({ tex: makeTexture(img), size: sizeOf(img), focus: focusOf(img) }));

  const uniforms = {
    uA: { value: slides[0].tex }, uB: { value: slides[1].tex },
    uImgA: { value: slides[0].size }, uImgB: { value: slides[1].size },
    uFocA: { value: slides[0].focus }, uFocB: { value: slides[1].focus },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uMix: { value: 0 }, uDrift: { value: 0 },
  };
  scene.add(new THREE.Mesh(quad(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: CHAPTER_FRAG, uniforms, depthTest: false })));
  fit(renderer, canvas, uniforms.uRes);

  const target = new THREE.Vector2(0.5, 0.5);
  return {
    pointer(x, y) { target.set(x, y); },
    // p runs 0 … slides-1; whole numbers rest on a picture
    set(p) {
      const max = slides.length - 1;
      const i = Math.min(Math.floor(p), max - 1);
      const a = slides[i], b = slides[i + 1];
      uniforms.uA.value = a.tex; uniforms.uImgA.value = a.size; uniforms.uFocA.value = a.focus;
      uniforms.uB.value = b.tex; uniforms.uImgB.value = b.size; uniforms.uFocB.value = b.focus;
      uniforms.uMix.value = Math.min(Math.max(p - i, 0), 1);
      uniforms.uDrift.value = (p / max - 0.5) * 0.03;
    },
    render(dt) {
      uniforms.uMouse.value.lerp(target, 1 - Math.exp(-dt * 5));
      renderer.render(scene, camera);
    },
  };
}

// ───────────────────────── team page ─────────────────────────
//   createPortraits – the arched portrait stage on team.html. One quad, two textures; moving between
//                     barbers wipes the next portrait in along diagonal bands (the stripes of a barber's
//                     pole), with a brass line on the edge. Every portrait is printed in the shop's own
//                     ink-to-cream tone, so the stand-in photographs read as one set.
//                     Renders only when the progress or the size changed; nothing loops.

const PORTRAIT_FRAG = COMMON + /* glsl */`
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uImgA, uImgB, uFocA, uFocB;
  uniform float uMix;

  vec3 tone(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    l = smoothstep(0.03, 0.97, l);
    vec3 ink = vec3(0.059, 0.090, 0.086), cream = vec3(0.937, 0.910, 0.847), brass = vec3(0.776, 0.655, 0.400);
    vec3 col = mix(ink, cream, l);
    return mix(col, brass * (0.35 + 0.75 * l), 0.22 * (1.0 - abs(l - 0.5) * 2.0));   // brass in the midtones
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    float t = uMix;

    // diagonal bands, like the stripes on a barber's pole; the edge climbs the frame (scrolling back reverses it)
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    float band = fract((p.x * 0.55 + p.y) * 3.2);
    float lead = vUv.y + vUv.x * 0.18;
    float n = fbm(p * 3.0) * 0.12;
    float e = t * 1.7 - 0.35;
    float keepA = smoothstep(e - 0.045, e + 0.045, lead + band * 0.22 + n);   // 1 where the leaving portrait still shows

    // the leaving portrait eases back, the arriving one settles from slightly closer
    vec2 ua = (vUv - 0.5) / (1.0 + 0.05 * t) + 0.5;
    vec2 ub = (vUv - 0.5) / (1.08 - 0.08 * t) + 0.5 + vec2(0.0, -0.025 * (1.0 - t));
    vec3 a = tone(texture2D(uA, coverUv(ua, uRes, uImgA, uFocA)).rgb);
    vec3 b = tone(texture2D(uB, coverUv(ub, uRes, uImgB, uFocB)).rgb);
    vec3 col = mix(b, a, keepA);
    float edge = keepA * (1.0 - keepA) * 4.0;
    col = mix(col, vec3(0.890, 0.796, 0.580), edge * 0.6);                   // brass line on the wipe
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createPortraits(canvas, imgs) {
  const renderer = makeRenderer(canvas, 2);
  const scene = new THREE.Scene();
  const slides = imgs.map((img) => ({ tex: makeTexture(img), size: sizeOf(img), focus: focusOf(img) }));

  const uniforms = {
    uA: { value: slides[0].tex }, uB: { value: slides[Math.min(1, slides.length - 1)].tex },
    uImgA: { value: slides[0].size }, uImgB: { value: slides[0].size },
    uFocA: { value: slides[0].focus }, uFocB: { value: slides[0].focus },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMix: { value: 0 },
  };
  scene.add(new THREE.Mesh(quad(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: PORTRAIT_FRAG, uniforms, depthTest: false })));
  fit(renderer, canvas, uniforms.uRes);

  let last = '';
  return {
    // p runs 0 … slides-1; whole numbers rest on a portrait
    set(p) {
      const max = slides.length - 1;
      const i = Math.max(0, Math.min(Math.floor(p), max - 1));
      const a = slides[i], b = slides[i + 1] ?? a;
      uniforms.uA.value = a.tex; uniforms.uImgA.value = a.size; uniforms.uFocA.value = a.focus;
      uniforms.uB.value = b.tex; uniforms.uImgB.value = b.size; uniforms.uFocB.value = b.focus;
      uniforms.uMix.value = Math.min(Math.max(p - i, 0), 1);
    },
    // a direct wipe between any two portraits (a -> b at t), for jumps from the name list
    pair(a, b, t) {
      const A = slides[a], B = slides[b];
      uniforms.uA.value = A.tex; uniforms.uImgA.value = A.size; uniforms.uFocA.value = A.focus;
      uniforms.uB.value = B.tex; uniforms.uImgB.value = B.size; uniforms.uFocB.value = B.focus;
      uniforms.uMix.value = Math.min(Math.max(t, 0), 1);
    },
    render() {
      const key = `${uniforms.uMix.value}|${uniforms.uA.value.id}|${uniforms.uB.value.id}|${uniforms.uRes.value.x}|${uniforms.uRes.value.y}`;
      if (key === last) return;
      last = key;
      renderer.render(scene, camera);
    },
  };
}

// ───────────────────────── services page ─────────────────────────
//   createRazor – the mirror on services.html. Moving between chapters takes the next photograph in
//                 with one stroke of an open razor: a straight, slightly angled edge travels down the
//                 glass, a thin steel glint on the blade and a band of lather just ahead of it.
//                 Same printed tone as the portraits on team.html. Same API (set, pair, render);
//                 renders only when the progress or the size changed; nothing loops.

const RAZOR_FRAG = COMMON + /* glsl */`
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uImgA, uImgB, uFocA, uFocB;
  uniform float uMix;

  vec3 tone(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    l = smoothstep(0.03, 0.97, l);
    vec3 ink = vec3(0.059, 0.090, 0.086), cream = vec3(0.937, 0.910, 0.847), brass = vec3(0.776, 0.655, 0.400);
    vec3 col = mix(ink, cream, l);
    return mix(col, brass * (0.35 + 0.75 * l), 0.22 * (1.0 - abs(l - 0.5) * 2.0));
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    float t = uMix;
    vec2 p = vec2(vUv.x * aspect, vUv.y);

    // distance along the stroke: 0 at the top, the blade held a little off level
    float d = (1.0 - vUv.y) + (vUv.x - 0.5) * 0.32;
    float e = t * 1.42 - 0.2;
    float shaved = 1.0 - smoothstep(e - 0.0035, e + 0.0035, d);           // 1 where the stroke has passed

    // behind the blade the new picture settles; ahead of it the old one is pushed very slightly
    float behind = clamp(e - d, 0.0, 0.25);
    vec2 ub = (vUv - 0.5) / (1.06 - 0.06 * t) + 0.5 + vec2(0.0, behind * 0.03);
    vec2 ua = (vUv - 0.5) / (1.0 + 0.04 * t) + 0.5;
    vec3 a = tone(texture2D(uA, coverUv(ua, uRes, uImgA, uFocA)).rgb);
    vec3 b = tone(texture2D(uB, coverUv(ub, uRes, uImgB, uFocB)).rgb);
    vec3 col = mix(a, b, shaved);

    // lather: a soft cream band just ahead of the edge, broken up like foam
    float ahead = d - e;
    float band = smoothstep(0.0, 0.012, ahead) * (1.0 - smoothstep(0.03, 0.13, ahead));
    float foam = smoothstep(0.38, 0.7, fbm(p * 9.0 + vec2(0.0, t * 2.0)) + band * 0.35);
    col = mix(col, vec3(0.955, 0.94, 0.9), band * foam * 0.85);

    // the blade: a thin bright steel line, warmer where it meets the lather
    float glint = exp(-abs(ahead) * 520.0);
    col += vec3(0.95, 0.86, 0.66) * glint * 0.75 * step(0.001, t) * step(t, 0.999);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createRazor(canvas, imgs) {
  const renderer = makeRenderer(canvas, 2);
  const scene = new THREE.Scene();
  const slides = imgs.map((img) => ({ tex: makeTexture(img), size: sizeOf(img), focus: focusOf(img) }));

  const uniforms = {
    uA: { value: slides[0].tex }, uB: { value: slides[Math.min(1, slides.length - 1)].tex },
    uImgA: { value: slides[0].size }, uImgB: { value: slides[0].size },
    uFocA: { value: slides[0].focus }, uFocB: { value: slides[0].focus },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMix: { value: 0 },
  };
  scene.add(new THREE.Mesh(quad(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: RAZOR_FRAG, uniforms, depthTest: false })));
  fit(renderer, canvas, uniforms.uRes);

  const use = (a, b, t) => {
    uniforms.uA.value = a.tex; uniforms.uImgA.value = a.size; uniforms.uFocA.value = a.focus;
    uniforms.uB.value = b.tex; uniforms.uImgB.value = b.size; uniforms.uFocB.value = b.focus;
    uniforms.uMix.value = Math.min(Math.max(t, 0), 1);
  };
  let last = '';
  return {
    set(p) {
      const max = slides.length - 1;
      const i = Math.max(0, Math.min(Math.floor(p), max - 1));
      use(slides[i], slides[i + 1] ?? slides[i], p - i);
    },
    pair(a, b, t) { use(slides[a], slides[b], t); },
    render() {
      const key = `${uniforms.uMix.value}|${uniforms.uA.value.id}|${uniforms.uB.value.id}|${uniforms.uRes.value.x}|${uniforms.uRes.value.y}`;
      if (key === last) return;
      last = key;
      renderer.render(scene, camera);
    },
  };
}

// ───────────────────────── home page: reviews ─────────────────────────
//   createMirror – the arched mirror beside the reviews. Between two reviews the glass steams up
//                  from the bottom (the hot towel), the picture changes under the steam, and a towel
//                  stroke wipes it clean across the glass (alternating sides). Scroll drives it both ways.
//                  The stand-in photographs get one shared warm tone so they read as one set.
//                  Renders only when the progress or the size changed; nothing loops.

const MIRROR_FRAG = COMMON + /* glsl */`
  uniform sampler2D uA, uB;
  uniform vec2 uRes, uImgA, uImgB, uFocA, uFocB;
  uniform float uMix, uDir;

  vec3 tone(vec3 c) {
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.72);                          // a little less colour
    return c * vec3(1.05, 1.0, 0.9) + vec3(0.015, 0.01, 0.0);
  }
  // soft focus: a small golden-angle disc of taps, scaled by the steam
  vec3 pic(sampler2D t, vec2 uv, vec2 img, vec2 foc, float blur, float aspect) {
    if (blur < 0.0005) return texture2D(t, coverUv(uv, uRes, img, foc)).rgb;
    vec3 c = vec3(0.0);
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float a = fi * 2.39996, r = sqrt((fi + 0.5) / 9.0) * blur;
      c += texture2D(t, coverUv(uv + vec2(cos(a) / aspect, sin(a)) * r, uRes, img, foc)).rgb;
    }
    return c / 9.0;
  }

  void main() {
    float aspect = uRes.x / uRes.y;
    float t = uMix;
    vec2 p = vec2(vUv.x * aspect, vUv.y);
    float n = fbm(p * 3.2);
    float n2 = fbm(p * 11.0 + 4.0);

    // 1st half: steam climbs the glass from the bottom, in patches
    float rise = clamp(t / 0.5, 0.0, 1.0);
    float steam = smoothstep(0.0, 0.42, rise * 1.5 - (vUv.y * 0.62 + n * 0.4));

    // 2nd half: a towel stroke clears it, slightly tilted, with a ragged damp edge
    float w = clamp((t - 0.5) / 0.5, 0.0, 1.0);
    float s = (uDir > 0.0 ? vUv.x : 1.0 - vUv.x) * 0.86 + (1.0 - vUv.y) * 0.14 + (n2 - 0.5) * 0.07;
    float front = w * 1.32 - 0.16;
    float wiped = 1.0 - smoothstep(front - 0.05, front + 0.015, s);   // 1 behind the towel
    float fog = t < 0.5 ? steam : 1.0 - wiped;

    // the picture under the glass changes while it is fully steamed
    float ab = smoothstep(0.46, 0.54, t);
    float blur = fog * 0.03;
    vec2 uv = (vUv - 0.5) / (1.04 + 0.03 * fog) + 0.5;
    vec3 col = vec3(0.0);
    if (ab < 1.0) col += pic(uA, uv, uImgA, uFocA, blur, aspect) * (1.0 - ab);
    if (ab > 0.0) col += pic(uB, uv, uImgB, uFocB, blur, aspect) * ab;
    col = tone(col);

    vec3 mist = vec3(0.90, 0.87, 0.81) * (0.93 + 0.07 * n2);
    col = mix(col, mix(col, mist, 0.82), fog);

    // the damp line the towel leaves, with a hair of brass on its edge
    float edge = (t > 0.5) ? smoothstep(0.0, 0.03, front - s) * (1.0 - smoothstep(0.03, 0.12, front - s)) : 0.0;
    col *= 1.0 - edge * 0.12;
    float lip = (t > 0.5 && t < 1.0) ? (1.0 - smoothstep(0.0, 0.012, abs(s - front + 0.012))) : 0.0;
    col = mix(col, vec3(0.890, 0.796, 0.580), lip * 0.55);
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createMirror(canvas, imgs) {
  const renderer = makeRenderer(canvas, 2);
  renderer.setClearColor(0xd8ceb8, 1);
  const scene = new THREE.Scene();
  const slides = imgs.map((img) => ({ tex: makeTexture(img), size: sizeOf(img), focus: focusOf(img) }));

  const uniforms = {
    uA: { value: slides[0].tex }, uB: { value: slides[1].tex },
    uImgA: { value: slides[0].size }, uImgB: { value: slides[1].size },
    uFocA: { value: slides[0].focus }, uFocB: { value: slides[1].focus },
    uRes: { value: new THREE.Vector2(1, 1) },
    uMix: { value: 0 }, uDir: { value: 1 },
  };
  scene.add(new THREE.Mesh(quad(), new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: MIRROR_FRAG, uniforms, depthTest: false })));
  fit(renderer, canvas, uniforms.uRes);

  let last = '';
  return {
    // i: the review shown, m: 0…1 on the way to the next one
    set(i, m) {
      const max = slides.length - 1;
      if (i >= max) { i = max - 1; m = 1; }
      const a = slides[i], b = slides[i + 1];
      uniforms.uA.value = a.tex; uniforms.uImgA.value = a.size; uniforms.uFocA.value = a.focus;
      uniforms.uB.value = b.tex; uniforms.uImgB.value = b.size; uniforms.uFocB.value = b.focus;
      uniforms.uMix.value = Math.min(Math.max(m, 0), 1);
      uniforms.uDir.value = i % 2 ? -1 : 1;
    },
    render() {
      const key = `${uniforms.uA.value.id}|${uniforms.uMix.value}|${uniforms.uRes.value.x}|${uniforms.uRes.value.y}`;
      if (key === last) return;
      last = key;
      renderer.render(scene, camera);
    },
  };
}
