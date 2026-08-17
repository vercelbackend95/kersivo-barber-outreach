/**
 * Downloads landing demo portrait assets from Unsplash, converts to webp,
 * and writes manifest.json. Idempotent — skips files that already exist.
 *
 * License: Unsplash License (https://unsplash.com/license)
 */
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outRoot = join(root, 'public', 'images', 'landing-demo');

/** @type {Array<{ output: string; source: string; author: string; description: string }>} */
const ASSETS = [
  {
    output: 'barbers/jamie.webp',
    source: 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Barber portrait',
  },
  {
    output: 'barbers/alex.webp',
    source: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Barber portrait',
  },
  {
    output: 'barbers/sam.webp',
    source: 'https://images.unsplash.com/photo-1593702233354-259d1f794ed1?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Barber shaving a client in shop',
  },
  {
    output: 'barbers/marcus.webp',
    source: 'https://images.unsplash.com/photo-1553521041-d168abd31de3?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Barber holding scissors',
  },
  {
    output: 'clients/01.webp',
    source: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/02.webp',
    source: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/03.webp',
    source: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/04.webp',
    source: 'https://images.unsplash.com/photo-1463453091185-61582044d556?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/05.webp',
    source: 'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/06.webp',
    source: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/07.webp',
    source: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/08.webp',
    source: 'https://images.unsplash.com/photo-1615109398623-88346a601842?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/09.webp',
    source: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/10.webp',
    source: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/11.webp',
    source: 'https://images.unsplash.com/photo-1545167622-3a6ac756afa4?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
  {
    output: 'clients/12.webp',
    source: 'https://images.unsplash.com/photo-1552058544-f2b08422138a?auto=format&fit=crop&w=400&h=400&q=80',
    author: 'Unsplash',
    description: 'Client portrait',
  },
];

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadAndConvert(asset) {
  const outputPath = join(outRoot, asset.output);
  await mkdir(dirname(outputPath), { recursive: true });

  if (await fileExists(outputPath)) {
    console.info(`[landing-demo-assets] skip ${asset.output} (exists)`);
    return { ...asset, publicPath: `/images/landing-demo/${asset.output}`, skipped: true };
  }

  const response = await fetch(asset.source);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${asset.source}: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await sharp(buffer)
    .resize(400, 400, { fit: 'cover', position: 'centre' })
    .webp({ quality: 80 })
    .toFile(outputPath);

  console.info(`[landing-demo-assets] wrote ${asset.output}`);
  return { ...asset, publicPath: `/images/landing-demo/${asset.output}`, skipped: false };
}

async function main() {
  const manifest = {
    generatedAt: new Date().toISOString(),
    license: 'Unsplash License — https://unsplash.com/license',
    assets: [],
  };

  for (const asset of ASSETS) {
    manifest.assets.push(await downloadAndConvert(asset));
  }

  await writeFile(join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.info(`[landing-demo-assets] manifest written (${manifest.assets.length} assets)`);
}

main().catch((error) => {
  console.error('[landing-demo-assets] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
