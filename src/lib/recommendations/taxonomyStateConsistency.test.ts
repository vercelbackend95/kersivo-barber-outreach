import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { TAXONOMY_VERSION } from './constants';

describe('ShopRecommendationState taxonomy consistency', () => {
  const root = process.cwd();

  it('keeps the active constant on 2026-09-v2', () => {
    expect(TAXONOMY_VERSION).toBe('2026-09-v2');
  });

  it('defaults schema ShopRecommendationState.taxonomyVersion to v2', () => {
    const schema = readFileSync(join(root, 'prisma/schema.prisma'), 'utf8');
    expect(schema).toMatch(
      /model ShopRecommendationState[\s\S]*?taxonomyVersion\s+String\s+@default\("2026-09-v2"\)/,
    );
  });

  it('adds a forward migration without editing the original smart retail migration', () => {
    const original = readFileSync(
      join(root, 'prisma/migrations/20260902140000_smart_retail_recommendations/migration.sql'),
      'utf8',
    );
    expect(original).toContain("DEFAULT '2026-09-v1'");

    const forward = readFileSync(
      join(
        root,
        'prisma/migrations/20260904120000_shop_recommendation_taxonomy_v2_default/migration.sql',
      ),
      'utf8',
    );
    expect(forward).toContain("SET DEFAULT '2026-09-v2'");
    expect(forward).toContain("WHERE \"taxonomyVersion\" = '2026-09-v1'");
    expect(forward).not.toMatch(/ServiceSemanticProfile|ProductSemanticProfile|RecommendationSet\b/);
  });
});
