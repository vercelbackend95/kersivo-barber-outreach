import { describe, expect, it } from 'vitest';
import {
  BLACKLINE_STOREFRONT_THEME,
  KERSIVO_STOREFRONT_THEME,
  storefrontThemeClass,
} from './storefrontTheme';

describe('storefrontTheme', () => {
  it('keeps BLACKLINE and KERSIVO palettes as named presets', () => {
    expect(KERSIVO_STOREFRONT_THEME.id).toBe('kersivo');
    expect(KERSIVO_STOREFRONT_THEME.imageFallback).toBe('initial');
    expect(BLACKLINE_STOREFRONT_THEME.id).toBe('blackline');
    expect(BLACKLINE_STOREFRONT_THEME.imageFallback).toBe('wordmark');
    expect(storefrontThemeClass('blackline')).toBe('sf-shop sf-shop--blackline');
    expect(storefrontThemeClass('kersivo')).toBe('sf-shop sf-shop--kersivo');
  });
});
