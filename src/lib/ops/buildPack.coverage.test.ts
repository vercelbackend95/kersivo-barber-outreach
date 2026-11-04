import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { shapeBuildPack } from './buildPack';
import { BUILD_PACK_EXCLUDED_FIELDS, BUILD_PACK_MAPPED_FIELDS } from './buildPackFields';
import { BUILD_PACK_NON_IMAGE_URL_FIELDS, BUILD_PACK_REMOTE_IMAGE_FIELDS } from './buildPackRemoteImages';

function scalarFields(model: string): string[] {
  const found = Prisma.dmmf.datamodel.models.find((m) => m.name === model);
  if (!found) throw new Error(`Model ${model} not in the Prisma schema`);
  return found.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum').map((f) => f.name);
}

describe('ops build pack field coverage', () => {
  for (const model of Object.keys(BUILD_PACK_EXCLUDED_FIELDS) as Array<keyof typeof BUILD_PACK_EXCLUDED_FIELDS>) {
    it(`${model}: every column is mapped into the pack or excluded with a reason`, () => {
      const mapped = new Set<string>(BUILD_PACK_MAPPED_FIELDS[model]);
      const excluded = BUILD_PACK_EXCLUDED_FIELDS[model];
      const unaccounted = scalarFields(model).filter((field) => !mapped.has(field) && !(field in excluded));
      // A new column here means: show it in the Build brief (add to BUILD_PACK_MAPPED_FIELDS and
      // buildPack.ts), or say why not in BUILD_PACK_EXCLUDED_FIELDS.
      expect(unaccounted).toEqual([]);
    });

    it(`${model}: no field is both mapped and excluded, and every reason is filled in`, () => {
      const mapped = new Set<string>(BUILD_PACK_MAPPED_FIELDS[model]);
      for (const [field, reason] of Object.entries(BUILD_PACK_EXCLUDED_FIELDS[model])) {
        expect(mapped.has(field), field).toBe(false);
        expect(reason.trim().length, field).toBeGreaterThan(3);
      }
    });
  }

  for (const model of Object.keys(BUILD_PACK_MAPPED_FIELDS) as Array<keyof typeof BUILD_PACK_MAPPED_FIELDS>) {
    it(`${model}: mapped fields exist in the schema`, () => {
      const real = new Set(scalarFields(model));
      expect(BUILD_PACK_MAPPED_FIELDS[model].filter((field) => !real.has(field))).toEqual([]);
    });
  }

  it('never maps personal or secret request fields', () => {
    const mapped = new Set<string>(BUILD_PACK_MAPPED_FIELDS.PreviewRequest);
    for (const field of [
      'firstName',
      'email',
      'publicToken',
      'publicTokenHash',
      'detailsTokenHash',
      'internalNotes',
      'marketingOptInAt',
      'authorisationConsentAt',
      'stripeCustomerId',
      'stripeSubscriptionId',
    ]) {
      expect(mapped.has(field), field).toBe(false);
    }
    expect(new Set<string>(BUILD_PACK_MAPPED_FIELDS.Barber).has('email')).toBe(false);
    expect(new Set<string>(BUILD_PACK_MAPPED_FIELDS.Product).has('inStock')).toBe(false);
  });
});

describe('ops build pack image URL coverage', () => {
  const urlLike = /(url|image|photo|logo|avatar)/i;

  for (const model of Object.keys(BUILD_PACK_REMOTE_IMAGE_FIELDS) as Array<keyof typeof BUILD_PACK_REMOTE_IMAGE_FIELDS>) {
    it(`${model}: every image URL column is mapped to remoteImages`, () => {
      const imageFields = new Set(Object.keys(BUILD_PACK_REMOTE_IMAGE_FIELDS[model]));
      const links = new Set(BUILD_PACK_NON_IMAGE_URL_FIELDS[model]);
      const unmapped = scalarFields(model).filter((field) => urlLike.test(field) && !imageFields.has(field) && !links.has(field));
      // A new image column here must become a remoteImages source (buildPackRemoteImages.ts), so it is
      // downloaded into the pack and named in brief.md, or be listed as a plain link.
      expect(unmapped).toEqual([]);
      const selected = new Set<string>(BUILD_PACK_MAPPED_FIELDS[model as keyof typeof BUILD_PACK_MAPPED_FIELDS] ?? []);
      for (const field of imageFields) expect(selected.has(field), `${model}.${field} is selected`).toBe(true);
    });
  }

  it('every mapped image field ends up in pack.remoteImages', () => {
    const url = (name: string) => `https://store1.public.blob.vercel-storage.com/shops/shop_1/${name}.jpg`;
    const pack = shapeBuildPack({
      request: { id: 'req_1', shopName: 'Fade Co', townCity: 'Leeds', draftShopId: 'shop_1' } as never,
      shop: { id: 'shop_1', name: 'Fade Co', townCity: 'Leeds', logoUrl: url('logo'), bookingSlug: null, sitePreviewUrl: null, sitePreviewVersion: null },
      profile: null,
      hours: [],
      services: [{ id: 's1', name: 'Fade', description: null, imageUrl: url('s1'), pricePence: 1, priceFrom: false, durationMinutes: 30, displayOrder: 0, category: null, featured: false }],
      barbers: [{ id: 'b1', name: 'Alex', avatarUrl: url('b1'), title: null, bio: null, sortOrder: 0 }],
      products: [{ id: 'p1', name: 'Wax', description: null, pricePence: 1, imageUrl: url('p1'), featured: false, category: 'HAIR', sortOrder: 0 }],
      assets: [],
      changeRequests: [],
    });
    const sources = new Set(pack.remoteImages.map((image) => image.source));
    for (const fields of Object.values(BUILD_PACK_REMOTE_IMAGE_FIELDS)) {
      for (const source of Object.values(fields)) expect(sources.has(source), source).toBe(true);
    }
  });
});
