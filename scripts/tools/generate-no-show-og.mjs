/**
 * Rasterise the 1200×630 social image for /barbershop-no-show-calculator.
 * Brand artwork only (dark canvas, KERSIVO wordmark, accent rule) — no photography,
 * figures or claims. Run: node scripts/tools/generate-no-show-og.mjs
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.join(process.cwd(), 'public/images/tools/no-show-calculator-og.png');
mkdirSync(path.dirname(out), { recursive: true });

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="78%" cy="22%" r="60%">
      <stop offset="0%" stop-color="#d72638" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#030303" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#030303"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <g font-family="Arial, Helvetica, sans-serif" fill="#f5f5f5">
    <text x="80" y="110" font-size="30" font-weight="700" letter-spacing="8">KERSIVO</text>
    <text x="80" y="160" font-size="22" font-weight="700" letter-spacing="4" fill="#b7bdc7">FREE TOOL · NO-SHOW COST CALCULATOR</text>
    <text x="80" y="300" font-size="76" font-weight="800">What do no-shows</text>
    <text x="80" y="390" font-size="76" font-weight="800">really cost your</text>
    <text x="80" y="480" font-size="76" font-weight="800">barbershop?</text>
  </g>
  <rect x="80" y="530" width="96" height="6" fill="#d72638"/>
  <g transform="translate(900 250)" fill="none" stroke="#3a3f47" stroke-width="10" stroke-linecap="round">
    <rect x="0" y="0" width="210" height="190" rx="18"/>
    <line x1="0" y1="55" x2="210" y2="55"/>
    <line x1="55" y1="-22" x2="55" y2="20"/>
    <line x1="155" y1="-22" x2="155" y2="20"/>
    <line x1="70" y1="95" x2="140" y2="165" stroke="#d72638"/>
    <line x1="140" y1="95" x2="70" y2="165" stroke="#d72638"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
console.log(`Wrote ${path.relative(process.cwd(), out)}`);
