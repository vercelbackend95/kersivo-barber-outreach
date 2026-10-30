import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const stylesRoot = dirname(fileURLToPath(import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return path.endsWith('.css') ? [path] : [];
  });
}

describe('KERSIVO brand red', () => {
  it('defines #d72638 once, as --color-brand', () => {
    const hits = cssFiles(stylesRoot).flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const count = source.match(/#d72638/gi)?.length ?? 0;
      return count > 0 ? [`${relative(stylesRoot, file)}:${count}`] : [];
    });
    expect(hits).toEqual(['tokens.css:1']);
  });

  it('does not keep the old bright fill #ff1717', () => {
    const hits = cssFiles(stylesRoot).filter((file) => /#ff1717/i.test(readFileSync(file, 'utf8')));
    expect(hits).toEqual([]);
  });
});
