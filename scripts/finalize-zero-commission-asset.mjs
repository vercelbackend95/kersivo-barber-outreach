import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "public/images/Ilustracje");
const src = path.join(dir, "zero-commission-composed.webp");
const dest = path.join(dir, "zero-commission.webp");

if (!fs.existsSync(src)) {
  console.error("Missing:", src);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log("wrote", path.relative(root, dest), { bytes: fs.statSync(dest).size });
