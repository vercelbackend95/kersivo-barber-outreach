/**
 * Minimal production-like server for the local `.vercel/output` build.
 *
 * Serves prebuilt static files exactly as Vercel's filesystem handler would, and sends every
 * other request to the built Astro server function. Used only by local visual QA; it loads no
 * `.env` file, so captured pages never depend on local secrets.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';

const OUTPUT_DIR = resolve('.vercel/output');
const STATIC_DIR = join(OUTPUT_DIR, 'static');
const ENTRY = join(OUTPUT_DIR, 'functions/_render.func/dist/server/entry.mjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function staticFileFor(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = normalize(join(STATIC_DIR, decoded));
  if (!candidate.startsWith(STATIC_DIR)) return null;
  for (const file of [candidate, join(candidate, 'index.html')]) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export async function startServer({ port = 4399, host = '127.0.0.1' } = {}) {
  if (!existsSync(ENTRY)) {
    throw new Error('No Vercel build output found. Run `npx astro build` first.');
  }
  const { default: handler } = await import(pathToFileURL(ENTRY).href);

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${host}:${port}`);
      const file = req.method === 'GET' || req.method === 'HEAD' ? staticFileFor(url.pathname) : null;
      if (file) {
        res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(file).pipe(res);
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const request = new Request(url, {
        method: req.method,
        headers: Object.entries(req.headers).flatMap(([key, value]) =>
          Array.isArray(value) ? value.map((v) => [key, v]) : value === undefined ? [] : [[key, value]],
        ),
        ...(hasBody ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      const response = await handler.fetch(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (!response.body || req.method === 'HEAD') return res.end();
      Readable.fromWeb(response.body).pipe(res);
    } catch (error) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(`Visual QA server error: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  await new Promise((done) => server.listen(port, host, done));
  return { server, baseURL: `http://${host}:${port}` };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { baseURL } = await startServer({ port: Number(process.env.PORT ?? 4399) });
  console.log(`[visual-qa] serving .vercel/output at ${baseURL}`);
}
