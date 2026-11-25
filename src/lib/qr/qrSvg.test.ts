import { describe, expect, it } from 'vitest';
import {
  alignmentPositions,
  dataCodewordsFor,
  dataModuleOrder,
  encodeQr,
  formatBits,
  functionPatterns,
  maskBit,
  qrSvgPath,
  rsDivisor,
  rsRemainder,
} from './qrSvg';

/** Reads the matrix back the way a scanner does: format, unmask, deinterleave, check RS, parse. */
function decode(matrix: ReturnType<typeof encodeQr>): string {
  const { size, version, modules } = matrix;
  // Format information, first copy (around the top-left finder).
  let read = 0;
  const bitAt = (x: number, y: number) => (modules[y]![x] ? 1 : 0);
  const positions: Array<[number, number]> = [];
  for (let i = 0; i <= 5; i += 1) positions.push([8, i]);
  positions.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i += 1) positions.push([14 - i, 8]);
  positions.forEach(([x, y], i) => (read |= bitAt(x, y) << i));
  const mask = [0, 1, 2, 3, 4, 5, 6, 7].find((m) => formatBits(m) === read);
  expect(mask, 'format bits match a level-M mask').toBeDefined();

  const { isFunction } = functionPatterns(version);
  const order = dataModuleOrder(size, isFunction);
  const bits = order.map(([x, y]) => (modules[y]![x] !== maskBit(mask!, x, y) ? 1 : 0));
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const eccLen = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26][version]!;
  const numBlocks = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5][version]!;
  const raw = codewords.length;
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const blocks: number[][] = Array.from({ length: numBlocks }, () => []);
  let k = 0;
  for (let i = 0; i < shortLen + 1; i += 1) {
    for (let j = 0; j < numBlocks; j += 1) {
      if (i === shortLen - eccLen && j < numShort) continue;
      blocks[j]!.push(codewords[k++]!);
    }
  }
  const divisor = rsDivisor(eccLen);
  const data: number[] = [];
  for (const block of blocks) {
    const dat = block.slice(0, block.length - eccLen);
    expect(rsRemainder(dat, divisor)).toEqual(block.slice(block.length - eccLen));
    data.push(...dat);
  }
  expect(data.length).toBe(dataCodewordsFor(version));

  const stream = data.map((b) => b.toString(2).padStart(8, '0')).join('');
  expect(stream.slice(0, 4)).toBe('0100');
  const countBits = version <= 9 ? 8 : 16;
  const count = parseInt(stream.slice(4, 4 + countBits), 2);
  const bytes: number[] = [];
  for (let i = 0; i < count; i += 1) bytes.push(parseInt(stream.slice(4 + countBits + i * 8, 12 + countBits + i * 8), 2));
  return new TextDecoder().decode(new Uint8Array(bytes));
}

describe('qrSvg encoder', () => {
  it('builds the standard Reed–Solomon generator and format bits', () => {
    expect(rsDivisor(7)).toEqual([127, 122, 154, 164, 11, 68, 117]);
    expect(formatBits(0)).toBe(0b101010000010010);
    expect(alignmentPositions(4)).toEqual([6, 26]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
  });

  it('matches the published 1-M "HELLO WORLD" error-correction codewords', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it.each([
    'https://kersivo.co.uk/demo/heritage-grooming/services.html#book',
    'https://kersivo.co.uk',
    'x'.repeat(150),
  ])('round-trips %s', (text) => {
    const matrix = encodeQr(text);
    expect(matrix.size).toBe(matrix.version * 4 + 17);
    expect(decode(matrix)).toBe(text);
  });

  it('draws an SVG path with a quiet zone', () => {
    const { d, viewBox } = qrSvgPath(encodeQr('https://kersivo.co.uk'));
    expect(viewBox).toMatch(/^0 0 \d+ \d+$/);
    expect(d.startsWith('M4 4h1v1h-1z')).toBe(true);
  });
});
