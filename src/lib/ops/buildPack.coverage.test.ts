import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { BUILD_PACK_EXCLUDED_FIELDS, BUILD_PACK_MAPPED_FIELDS } from './buildPackFields';

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
