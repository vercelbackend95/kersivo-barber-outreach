import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression: ClientProfilePanel is hydrated inside AdminPanel.
 * Importing storeNoteImage from the client pulled `sharp` into the island
 * graph (`process is not defined`) and left the BLACKLINE admin shell inert.
 */
describe('ClientProfilePanel client note image import', () => {
  it('imports resolveClientNoteImageSrc from the client-safe URL module', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/admin/ClientProfilePanel.tsx'),
      'utf8',
    );
    expect(source).toMatch(
      /import\s+\{\s*resolveClientNoteImageSrc\s*\}\s+from\s+['"]@\/lib\/storage\/clientNoteImageUrl['"]/,
    );
    expect(source).not.toMatch(/from\s+['"][^'"]*storeNoteImage['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*convertImageToWebp['"]/);
    expect(source).not.toMatch(/from\s+['"]sharp['"]/);
  });

  it('fails closed if the panel is pointed back at the server storage module', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/components/admin/ClientProfilePanel.tsx'),
      'utf8',
    );
    // Intentional regression guard: restoring the pre-fix import must fail this suite.
    expect(source.includes("from '@/lib/storage/storeNoteImage'")).toBe(false);
    expect(source.includes("from '../../lib/storage/storeNoteImage'")).toBe(false);
  });

  it('keeps clientNoteImageUrl free of Node-only image codecs', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'src/lib/storage/clientNoteImageUrl.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]sharp['"]/);
    expect(source).not.toMatch(/convertImageToWebp/);
    expect(source).not.toMatch(/@vercel\/blob/);
    expect(source).not.toMatch(/storeNoteImage/);
    expect(source).not.toMatch(/uploadPrivate/);
  });
});
