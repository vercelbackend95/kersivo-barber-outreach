/**
 * /barbershop-retail-pickup hero: a photoreal render of two Heritage Grooming products on the counter
 * (Oakmoss & Iron Firm Pomade, Barrow & Pike Beard Oil), shown as a 3D photo. A depth map rendered for
 * the same frame lets the camera move through the scene: the pointer turns it, an idle drift keeps it
 * alive, and as the hero scrolls away the camera dollies in and a light sweeps the products (the order
 * is collected).
 *
 * Loaded with a dynamic import after first paint. The same photo sits under the canvas as an <img>
 * (object-fit: cover, centred) and the shader crops it the same way, so the swap is invisible. One
 * WebGL context, DPR capped at 1.75, paused off-screen and in hidden tabs. Under reduced motion it
 * renders still frames only (on resize, pointer and scroll it redraws once, never loops).
 */
import {
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  WebGLRenderer,
  type Texture,
} from 'three';

export type RetailHeroScene = {
  setProgress: (p: number) => void;
  setPointer: (x: number, y: number) => void;
  setRunning: (running: boolean) => void;
  dispose: () => void;
};

export const RETAIL_HERO_PHOTO = '/images/retail-pickup/pickup-counter-1024.webp';
export const RETAIL_HERO_DEPTH = '/images/retail-pickup/pickup-counter-depth.webp';
/** Source photo aspect (width / height). */
const PHOTO_ASPECT = 1;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform sampler2D uImage;
  uniform sampler2D uDepth;
  uniform vec2 uCover;   // object-fit: cover scale for the canvas aspect
  uniform vec2 uOffset;  // camera shift, in uv units at full depth
  uniform float uZoom;
  uniform float uSweep;  // -0.4..1.4, position of the light band
  uniform float uSweepStrength;
  varying vec2 vUv;

  float depthAt(vec2 p) { return texture2D(uDepth, clamp(p, 0.0, 1.0)).r; }

  void main() {
    vec2 uv = (vUv - 0.5) * uCover / uZoom + 0.5;
    // Two fixed-point steps: sample depth where the shifted ray lands, not where it started.
    float d = depthAt(uv);
    vec2 p = uv + uOffset * (d - 0.5);
    d = depthAt(p);
    p = uv + uOffset * (d - 0.5);
    d = depthAt(p);
    p = clamp(uv + uOffset * (d - 0.5), 0.001, 0.999);

    vec3 color = texture2D(uImage, p).rgb;

    // A soft diagonal light band that only lands on the products (mid depth), never on the wall.
    float band = exp(-pow((p.x * 0.8 + (1.0 - p.y) * 0.45 - uSweep) * 7.0, 2.0));
    float onProduct = smoothstep(0.42, 0.62, d) * (1.0 - smoothstep(0.86, 0.98, d));
    color += vec3(1.0, 0.94, 0.86) * band * onProduct * uSweepStrength * (0.35 + 0.65 * dot(color, vec3(0.333)));

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function loadTexture(loader: TextureLoader, url: string, srgb: boolean): Promise<Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (texture) => {
        if (srgb) texture.colorSpace = SRGBColorSpace;
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;
        texture.generateMipmaps = false;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });
}

export function createRetailHeroScene(
  canvas: HTMLCanvasElement,
  options: { reducedMotion: boolean; onReady?: () => void },
): RetailHeroScene | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new PlaneGeometry(2, 2);
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uImage: { value: null },
      uDepth: { value: null },
      uCover: { value: new Vector2(1, 1) },
      uOffset: { value: new Vector2(0, 0) },
      uZoom: { value: 1 },
      uSweep: { value: -0.4 },
      uSweepStrength: { value: 0 },
    },
  });
  const quad = new Mesh(geometry, material);
  scene.add(quad);

  const textures: Texture[] = [];
  let ready = false;
  let disposed = false;

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
    const aspect = width / height;
    // object-fit: cover — the photo fills the box and the overflowing axis is cropped evenly.
    material.uniforms.uCover.value.set(
      aspect > PHOTO_ASPECT ? 1 : aspect / PHOTO_ASPECT,
      aspect > PHOTO_ASPECT ? PHOTO_ASPECT / aspect : 1,
    );
    if (!running) draw(0);
  };

  function draw(dt: number) {
    if (!ready) return;
    elapsed += dt;
    const lerp = options.reducedMotion ? 1 : 1 - Math.pow(0.004, dt);
    progress += (targetProgress - progress) * lerp;
    pointer.x += (pointer.tx - pointer.x) * lerp;
    pointer.y += (pointer.ty - pointer.y) * lerp;

    const t = options.reducedMotion ? 0 : elapsed;
    const settle = ease(progress * 1.3);
    // Idle drift: a slow figure-of-eight so the parallax reads even without a pointer.
    const driftX = options.reducedMotion ? 0 : Math.sin(t * 0.42) * 0.55;
    const driftY = options.reducedMotion ? 0 : Math.sin(t * 0.84) * 0.25;
    const strength = 0.036;
    material.uniforms.uOffset.value.set(
      (pointer.x * 0.85 + driftX * 0.45) * strength,
      (-pointer.y * 0.6 + driftY * 0.45 - settle * 0.4) * strength,
    );
    material.uniforms.uZoom.value = 1.03 + settle * 0.07;
    // The light crosses once on load, then follows the pointer; scrolling away sweeps it across.
    const intro = options.reducedMotion ? 1 : clamp01(elapsed / 2.2);
    material.uniforms.uSweep.value = -0.4 + ease(intro) * 0.95 + pointer.x * 0.18 + settle * 0.6;
    material.uniforms.uSweepStrength.value = options.reducedMotion ? 0 : 0.16 + settle * 0.1;

    renderer.render(scene, camera);
  }

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    draw(dt);
    raf = window.requestAnimationFrame(loop);
  };

  const loader = new TextureLoader();
  Promise.all([loadTexture(loader, RETAIL_HERO_PHOTO, true), loadTexture(loader, RETAIL_HERO_DEPTH, false)])
    .then(([image, depth]) => {
      if (disposed) {
        image.dispose();
        depth.dispose();
        return;
      }
      textures.push(image, depth);
      material.uniforms.uImage.value = image;
      material.uniforms.uDepth.value = depth;
      ready = true;
      draw(0);
      options.onReady?.();
    })
    .catch(() => {
      // Keep the still photo; the canvas stays transparent.
    });

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
      disposed = true;
      window.cancelAnimationFrame(raf);
      running = false;
      resizeObserver.disconnect();
      geometry.dispose();
      material.dispose();
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
