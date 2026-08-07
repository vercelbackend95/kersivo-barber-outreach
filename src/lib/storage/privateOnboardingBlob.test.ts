import { describe, it, expect } from 'vitest';
import { ClientOnboardingAssetKind } from '@prisma/client';
import {
  looksLikePublicBlobUrl,
  migrationCsvValidationMessage,
  validateMigrationCsvFile,
  validateOnboardingAssetFile,
  MIGRATION_CSV_MAX_BYTES,
  IMAGE_ASSET_MAX_BYTES,
} from './privateOnboardingBlob';

describe('validateMigrationCsvFile', () => {
  it('accepts a normal csv', () => {
    expect(
      validateMigrationCsvFile({
        name: 'clients.csv',
        type: 'text/csv',
        size: 128,
      }),
    ).toBeNull();
  });

  it('rejects empty file', () => {
    expect(validateMigrationCsvFile({ name: 'a.csv', type: 'text/csv', size: 0 })).toBe(
      'empty',
    );
  });

  it('rejects missing filename', () => {
    expect(validateMigrationCsvFile({ name: '  ', type: 'text/csv', size: 10 })).toBe(
      'filename',
    );
  });

  it('rejects non-csv extension', () => {
    expect(
      validateMigrationCsvFile({ name: 'photo.png', type: 'image/png', size: 100 }),
    ).toBe('extension');
  });

  it('rejects image mime even with .csv name if mime is wrong', () => {
    expect(
      validateMigrationCsvFile({
        name: 'data.csv',
        type: 'image/jpeg',
        size: 100,
      }),
    ).toBe('mime');
  });

  it('rejects random binary mime', () => {
    expect(
      validateMigrationCsvFile({
        name: 'data.csv',
        type: 'application/octet-stream',
        size: 100,
      }),
    ).toBe('mime');
  });

  it('rejects oversize csv', () => {
    expect(
      validateMigrationCsvFile({
        name: 'big.csv',
        type: 'text/csv',
        size: MIGRATION_CSV_MAX_BYTES + 1,
      }),
    ).toBe('oversized');
  });

  it('maps validation codes to messages', () => {
    expect(migrationCsvValidationMessage('oversized')).toMatch(/size|MB|exceed/i);
    expect(migrationCsvValidationMessage('extension')).toMatch(/extension|allowed/i);
  });
});

describe('validateOnboardingAssetFile allowlists', () => {
  it('accepts logo jpeg/png/webp', () => {
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.BRAND_LOGO, {
        name: 'logo.png',
        type: 'image/png',
        size: 1000,
      }),
    ).toBeNull();
  });

  it('rejects svg/html/js for gallery', () => {
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.GALLERY_IMAGE, {
        name: 'x.svg',
        type: 'image/svg+xml',
        size: 100,
      }),
    ).toBe('extension');
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.GALLERY_IMAGE, {
        name: 'x.html',
        type: 'text/html',
        size: 100,
      }),
    ).toBe('extension');
  });

  it('rejects oversize logo', () => {
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.BRAND_LOGO, {
        name: 'big.jpg',
        type: 'image/jpeg',
        size: IMAGE_ASSET_MAX_BYTES + 1,
      }),
    ).toBe('oversized');
  });

  it('accepts pdf guidelines and other text/plain', () => {
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.BRAND_GUIDELINES, {
        name: 'guide.pdf',
        type: 'application/pdf',
        size: 1000,
      }),
    ).toBeNull();
    expect(
      validateOnboardingAssetFile(ClientOnboardingAssetKind.OTHER, {
        name: 'notes.txt',
        type: 'text/plain',
        size: 100,
      }),
    ).toBeNull();
  });
});

describe('looksLikePublicBlobUrl', () => {
  it('detects public blob hosts', () => {
    expect(
      looksLikePublicBlobUrl('https://abc.public.blob.vercel-storage.com/file.csv'),
    ).toBe(true);
    expect(looksLikePublicBlobUrl('https://blob.vercel-storage.com/x')).toBe(true);
  });

  it('allows private pathnames and private hosts', () => {
    expect(looksLikePublicBlobUrl('client-onboarding/shop/m.csv')).toBe(false);
    expect(
      looksLikePublicBlobUrl('https://abc.private.blob.vercel-storage.com/file.csv'),
    ).toBe(false);
  });
});
