import { describe, expect, it } from 'vitest';
import { assertLocalDatabaseUrl, isLocalDatabaseUrl } from './assertLocalDatabaseUrl';

describe('assertLocalDatabaseUrl', () => {
  it('allows loopback hosts', () => {
    expect(isLocalDatabaseUrl('postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa')).toBe(true);
    expect(isLocalDatabaseUrl('postgres://postgres@localhost:5432/hub')).toBe(true);
  });

  it('rejects Neon / remote hosts', () => {
    expect(
      isLocalDatabaseUrl(
        'postgresql://neondb_owner:x@ep-dark-flower-abnkv6he.eu-west-2.aws.neon.tech/neondb?sslmode=require',
      ),
    ).toBe(false);
    expect(() =>
      assertLocalDatabaseUrl('postgresql://neondb_owner:x@ep-example.neon.tech/neondb'),
    ).toThrow(/localhost/);
  });
});
