import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function startEditBlock(source: string): string {
  const start = source.indexOf('function startEdit');
  expect(start).toBeGreaterThan(-1);
  const after = source.slice(start);
  const end = after.search(/\n  (async )?function /);
  return end === -1 ? after : after.slice(0, end);
}

describe('Services settings demo lock', () => {
  it('blocks startEdit with the shared demo lock before opening the editor', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/admin/ServicesAdminPanel.tsx'), 'utf8');
    const block = startEditBlock(source);
    expect(block.indexOf('isPublicAdminDemoMode()')).toBeLessThan(block.indexOf('notifyAdminDemoBlocked()'));
    expect(block.indexOf('notifyAdminDemoBlocked()')).toBeLessThan(block.indexOf('setEditingId'));
    expect(source).toContain('Service settings — sample data is read-only');
    expect(source).toMatch(/className="admin-product-row__edit-btn"/);
    expect(source).not.toMatch(/className="admin-product-row__edit-btn"[^>]*\bdisabled\b/);
  });
});
