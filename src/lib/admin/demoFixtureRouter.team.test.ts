import { describe, expect, it } from 'vitest';

import { resolveDemoFixture } from './demoFixtureRouter';

describe('resolveDemoFixture team', () => {
  it('GET team returns 200 with four member cards', async () => {
    const result = await resolveDemoFixture('/api/admin-demo/team', new URLSearchParams(), 'GET');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(200);
    const body = result!.body as { ok: boolean; cards: Array<{ kind: string; barberId: string }> };
    expect(body.ok).toBe(true);
    expect(body.cards).toHaveLength(4);
    expect(body.cards.every((card) => card.kind === 'member')).toBe(true);
  });
});
