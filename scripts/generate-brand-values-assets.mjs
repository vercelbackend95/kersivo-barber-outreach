/**
 * Composite brand-values hero images (Midjourney-style) from on-brand sources.
 * Applies Kersivo color grade (#0b0d10, #d72638) and booking UI overlay.
 *
 * Usage:
 *   node scripts/generate-brand-values-assets.mjs
 *   node scripts/generate-brand-values-assets.mjs --variant=a|b|c|all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public/images/brand-values");

const WIDTH = 1600;
const HEIGHT = 1000;

const BG = { r: 11, g: 13, b: 16 };
const ACCENT = { r: 215, g: 38, b: 56 };

const sources = {
  mood: path.join(root, "public/images/discoverypic.jpg"),
  bookingUi: path.join(root, "public/hero-assets/screens/2.png"),
};

const variantArg = process.argv.find((a) => a.startsWith("--variant="));
const variant = variantArg?.split("=")[1] ?? "all";

async function buildMoodLayer(variantName) {
  const blur = variantName === "b" ? 42 : 28;
  const darken = variantName === "b" ? 0.28 : 0.42;

  let img = sharp(sources.mood)
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .blur(blur)
    .modulate({ brightness: darken, saturation: 0.55 });

  if (variantName === "a") {
    img = img.composite([
      {
        input: Buffer.from(
          `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="pole" cx="88%" cy="42%" r="34%">
                <stop offset="0%" stop-color="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" stop-opacity="0.34"/>
                <stop offset="100%" stop-color="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" stop-opacity="0"/>
              </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#pole)"/>
          </svg>`,
        ),
        blend: "screen",
      },
    ]);
  }

  return img.toBuffer();
}

async function buildPhoneLayer() {
  const phoneH = Math.round(HEIGHT * 0.78);
  const phoneW = Math.round(phoneH / 1.95);
  const screenPadX = Math.round(phoneW * 0.055);
  const screenPadTop = Math.round(phoneH * 0.045);
  const screenPadBottom = Math.round(phoneH * 0.042);
  const screenW = phoneW - screenPadX * 2;
  const screenH = phoneH - screenPadTop - screenPadBottom;
  const radius = Math.round(phoneW * 0.11);

  const screen = await sharp(sources.bookingUi)
    .resize(screenW, screenH, { fit: "cover", position: "top" })
    .png()
    .toBuffer();

  const phoneSvg = Buffer.from(
    `<svg width="${phoneW}" height="${phoneH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#2a2f38"/>
          <stop offset="100%" stop-color="#0f1115"/>
        </linearGradient>
        <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" flood-opacity="0.45"/>
        </filter>
      </defs>
      <rect x="0" y="0" width="${phoneW}" height="${phoneH}" rx="${radius}" fill="url(#frame)" filter="url(#glow)"/>
      <rect x="${screenPadX}" y="${screenPadTop}" width="${screenW}" height="${screenH}" rx="${Math.round(radius * 0.55)}" fill="#0b0d10"/>
    </svg>`,
  );

  const phoneFrame = await sharp(phoneSvg).png().toBuffer();

  return sharp(phoneFrame)
    .composite([{ input: screen, left: screenPadX, top: screenPadTop }])
    .png()
    .toBuffer();
}

function buildGradeOverlay(variantName) {
  const leftSpace = variantName === "b" ? 0.72 : 0.58;
  return Buffer.from(
    `<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="v" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="rgb(${BG.r},${BG.g},${BG.b})" stop-opacity="${leftSpace}"/>
          <stop offset="55%" stop-color="rgb(${BG.r},${BG.g},${BG.b})" stop-opacity="0.08"/>
          <stop offset="100%" stop-color="rgb(${BG.r},${BG.g},${BG.b})" stop-opacity="0.28"/>
        </linearGradient>
        <radialGradient id="warm" cx="72%" cy="68%" r="48%">
          <stop offset="0%" stop-color="#f1eee8" stop-opacity="0.1"/>
          <stop offset="100%" stop-color="#f1eee8" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="rim" x1="100%" y1="50%" x2="0%" y2="50%">
          <stop offset="0%" stop-color="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="rgb(${ACCENT.r},${ACCENT.g},${ACCENT.b})" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
      <rect width="100%" height="100%" fill="url(#warm)"/>
      <rect width="100%" height="100%" fill="url(#rim)"/>
    </svg>`,
  );
}

async function composeVariant(variantName) {
  const mood = await buildMoodLayer(variantName);
  const phone = await buildPhoneLayer();
  const phoneMeta = await sharp(phone).metadata();

  const phoneLeft =
    variantName === "c"
      ? Math.round(WIDTH * 0.52)
      : Math.round(WIDTH * 0.54);
  const phoneTop = Math.round((HEIGHT - phoneMeta.height) / 2 + (variantName === "c" ? 20 : 0));

  const base = sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: BG,
    },
  }).composite([
    { input: mood, blend: "over" },
    {
      input: phone,
      left: phoneLeft,
      top: phoneTop,
    },
    {
      input: buildGradeOverlay(variantName),
      blend: "over",
    },
  ]);

  const graded =
    variantName === "b"
      ? base.modulate({ brightness: 0.92, saturation: 0.85 })
      : base;

  return graded.webp({ quality: 84, effort: 6 }).toBuffer();
}

async function writeVariant(name) {
  fs.mkdirSync(outDir, { recursive: true });
  const buf = await composeVariant(name);
  const slug = name === "base" ? "base" : name;
  const filename = `own-your-shop-${slug}.webp`;
  const outPath = path.join(outDir, filename);
  await sharp(buf).toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log("wrote", path.relative(root, outPath), { w: meta.width, h: meta.height, bytes: fs.statSync(outPath).size });
  return outPath;
}

const variants = variant === "all" ? ["base", "a", "b", "c"] : [variant === "base" ? "base" : variant];

const written = [];
for (const v of variants) {
  written.push(await writeVariant(v === "base" ? "base" : v));
}

if (variant === "all") {
  const chosen = path.join(outDir, "own-your-shop-a.webp");
  const finalPath = path.join(outDir, "own-your-shop.webp");
  fs.copyFileSync(chosen, finalPath);
  console.log("selected variant a ->", path.relative(root, finalPath));
}
