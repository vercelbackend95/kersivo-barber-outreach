import { describe, expect, it } from 'vitest';
import { healthProbeHeaders, isVerifiedHealthProbe } from './healthProbeAuth';

const SECRET = 's'.repeat(32);
const env = { KERSIVO_HEALTH_PROBE_SECRET: SECRET };
const req = (headers: Record<string, string>) => new Request('https://kersivo.co.uk/x', { headers });

describe('isVerifiedHealthProbe', () => {
  it('needs both the header and the exact secret', () => {
    expect(isVerifiedHealthProbe(req({ 'X-Kersivo-Health': '1', 'X-Kersivo-Health-Secret': SECRET }), env)).toBe(true);
    expect(isVerifiedHealthProbe(req({ 'X-Kersivo-Health': '1' }), env)).toBe(false);
    expect(isVerifiedHealthProbe(req({ 'X-Kersivo-Health': '1', 'X-Kersivo-Health-Secret': 'wrong' }), env)).toBe(false);
    expect(isVerifiedHealthProbe(req({ 'X-Kersivo-Health-Secret': SECRET }), env)).toBe(false);
  });

  it('fails closed when the secret is missing or too short', () => {
    const headers = { 'X-Kersivo-Health': '1', 'X-Kersivo-Health-Secret': 'short' };
    expect(isVerifiedHealthProbe(req(headers), { KERSIVO_HEALTH_PROBE_SECRET: 'short' })).toBe(false);
    expect(isVerifiedHealthProbe(req({ 'X-Kersivo-Health': '1', 'X-Kersivo-Health-Secret': '' }), {})).toBe(false);
  });
});

describe('healthProbeHeaders', () => {
  it('never sends the secret to another host or over a lookalike domain', () => {
    expect(healthProbeHeaders(new URL('https://kersivo.co.uk/book/a'), env)).toHaveProperty('X-Kersivo-Health-Secret', SECRET);
    expect(healthProbeHeaders(new URL('https://kersivo.co.uk.evil.com/'), env)).not.toHaveProperty('X-Kersivo-Health-Secret');
    expect(healthProbeHeaders(new URL('https://fade-room.co.uk/'), env)).not.toHaveProperty('X-Kersivo-Health-Secret');
  });
});
