/**
 * Regenerate 0% brand-values illustration (bg removal + watermark strip → PNG/WebP).
 * Source: public/images/Ilustracje/0%.png. Used by brandValues.astro as 0%.webp.
 *
 * Usage: npm run assets:zero-illustration
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/remove-illustration-bg.mjs");
const input = path.join(root, "public/images/Ilustracje/0%.png");

const result = spawnSync(
  process.execPath,
  [script, input, "--strip-watermark"],
  { stdio: "inherit", cwd: root },
);

process.exit(result.status ?? 1);
