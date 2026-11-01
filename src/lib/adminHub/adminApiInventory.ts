import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { HUB_ADMIN_API_ALLOWLIST, isHubAdminApiAllowed } from './hubAdminAccess';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type AdminHttpMethod = (typeof METHODS)[number];

export type AdminApiEndpoint = {
  method: AdminHttpMethod;
  path: string;
  file: string;
  allowlisted: boolean;
};

const METHOD_EXPORT = /export\s+(?:const|async\s+function)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;
const DESTRUCTURED_EXPORT = /export\s+const\s+\{([^}]+)\}/g;

function exportedMethods(src: string): Set<AdminHttpMethod> {
  const found = new Set<AdminHttpMethod>();
  for (const match of src.matchAll(METHOD_EXPORT)) {
    found.add(match[1] as AdminHttpMethod);
  }
  for (const match of src.matchAll(DESTRUCTURED_EXPORT)) {
    for (const part of match[1].split(',')) {
      const method = part.trim().split(':')[0]?.trim();
      if ((METHODS as readonly string[]).includes(method ?? '')) found.add(method as AdminHttpMethod);
    }
  }
  return found;
}

function walkTsFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkTsFiles(full, acc);
    else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.includes('.test.')) acc.push(full);
  }
  return acc;
}

function fileToApiPath(absFile: string, pagesRoot: string): string {
  const rel = relative(pagesRoot, absFile).replace(/\\/g, '/');
  const withoutExt = rel.replace(/\.ts$/, '');
  const trimmed = withoutExt.replace(/\/index$/, '');
  const withParams = trimmed.replace(/\[([^\]]+)\]/g, ':$1');
  return `/${withParams}`;
}

function samplePath(path: string): string {
  return path.replace(/:[^/]+/g, 'x');
}

/** Every exported method on every /api/admin route file, classified against the hub allowlist. */
export function listAdminApiEndpoints(repoRoot = process.cwd()): AdminApiEndpoint[] {
  const pagesRoot = join(repoRoot, 'src/pages');
  const adminRoot = join(pagesRoot, 'api/admin');
  const rows: AdminApiEndpoint[] = [];
  for (const file of walkTsFiles(adminRoot)) {
    const src = readFileSync(file, 'utf8');
    const found = exportedMethods(src);
    if (found.size === 0) continue;
    const path = fileToApiPath(file, pagesRoot);
    const fileRel = relative(repoRoot, file).replace(/\\/g, '/');
    for (const method of METHODS) {
      if (!found.has(method)) continue;
      rows.push({
        method,
        path,
        file: fileRel,
        allowlisted: isHubAdminApiAllowed(method, samplePath(path)),
      });
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

export function allowlistedAdminApiEndpoints(repoRoot = process.cwd()): AdminApiEndpoint[] {
  return listAdminApiEndpoints(repoRoot).filter((row) => row.allowlisted);
}

export function deniedAdminApiEndpoints(repoRoot = process.cwd()): AdminApiEndpoint[] {
  return listAdminApiEndpoints(repoRoot).filter((row) => !row.allowlisted);
}

export type AdminHubApiEndpoint = {
  method: AdminHttpMethod;
  /** Runtime path with `[param]` replaced by a dummy id. */
  path: string;
  file: string;
};

/** Every exported method on every /api/admin-hub route file. */
export function listAdminHubApiEndpoints(repoRoot = process.cwd()): AdminHubApiEndpoint[] {
  const pagesRoot = join(repoRoot, 'src/pages');
  const hubRoot = join(pagesRoot, 'api/admin-hub');
  const rows: AdminHubApiEndpoint[] = [];
  for (const file of walkTsFiles(hubRoot)) {
    const src = readFileSync(file, 'utf8');
    const found = exportedMethods(src);
    if (found.size === 0) continue;
    const path = fileToApiPath(file, pagesRoot).replace(/:[^/]+/g, 'asset_1');
    const fileRel = relative(repoRoot, file).replace(/\\/g, '/');
    for (const method of METHODS) {
      if (!found.has(method)) continue;
      rows.push({ method, path, file: fileRel });
    }
  }
  return rows.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

/** Markdown table for the H4 security report. */
export function formatAdminApiAllowlistTable(rows: AdminApiEndpoint[]): string {
  const lines = [
    '| Method | Path | Allowlisted | Expected with `ks_hub` only |',
    '| --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.method} | \`${row.path}\` | ${row.allowlisted ? 'yes' : 'no'} | ${
        row.allowlisted ? '2xx / 4xx validation' : '403'
      } |`,
    );
  }
  return lines.join('\n');
}

export function allowlistEntriesMissingFromDisk(rows: AdminApiEndpoint[]): string[] {
  const discovered = new Set(rows.filter((row) => row.allowlisted).map((row) => `${row.method} ${row.path}`));
  const missing: string[] = [];
  for (const entry of HUB_ADMIN_API_ALLOWLIST) {
    const key = `${entry.method} ${entry.path}`;
    if (!discovered.has(key) && !rows.some((row) => row.method === entry.method && isHubAdminApiAllowed(entry.method, samplePath(row.path)) && pathsAlign(entry.path, row.path))) {
      missing.push(key);
    }
  }
  return missing;
}

function pathsAlign(pattern: string, discovered: string): boolean {
  if (pattern === discovered) return true;
  const regex = new RegExp(
    `^${pattern
      .split('/')
      .map((segment) => (segment.startsWith(':') ? ':[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      .join('/')}$`,
  );
  return regex.test(discovered);
}
