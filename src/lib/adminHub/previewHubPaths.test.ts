import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  isPreviewHubAllowedPath,
  previewHubLegacyRedirect,
  previewHubSectionFromPath,
} from './previewHubPaths';

describe('preview hub paths', () => {
  it('allows only the four hub routes and leave-preview', () => {
    expect(isPreviewHubAllowedPath('/admin')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/changes')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/website')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/messages')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/leave-preview')).toBe(true);
    expect(isPreviewHubAllowedPath('/admin/launch')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/upgrade')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/barbershop-settings')).toBe(false);
    expect(isPreviewHubAllowedPath('/admin/retail-onboarding')).toBe(false);
  });

  it('maps path to section', () => {
    expect(previewHubSectionFromPath('/admin')).toBe('overview');
    expect(previewHubSectionFromPath('/admin/changes')).toBe('changes');
    expect(previewHubSectionFromPath('/admin/website/')).toBe('website');
    expect(previewHubSectionFromPath('/admin/messages')).toBe('messages');
  });

  it('redirects old query URLs', () => {
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=changes'))).toBe('/admin/changes');
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=website&view=booking'))).toBe(
      '/admin/website?view=booking',
    );
    expect(previewHubLegacyRedirect(new URL('http://x/admin?section=messages&draft=reopen'))).toBe(
      '/admin/messages?draft=reopen',
    );
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=messages&draft=reopen'))).toBeNull();
    expect(previewHubLegacyRedirect(new URL('http://x/admin?app=colours'))).toBeNull();
  });

  it('removes admin-hub-tabs from the codebase', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/styles/components/admin-hub.css'), 'utf8');
    const layout = readFileSync(resolve(process.cwd(), 'src/components/admin/AdminLayout.tsx'), 'utf8');
    expect(css).not.toContain('admin-hub-tabs');
    expect(layout).not.toContain('admin-hub-tabs');
    expect(layout).toContain("mode === 'preview'");
    expect(layout).toContain('admin-sidebar-link');
    expect(layout).toContain('PREVIEW_HUB_PATHS.messages');
    expect(layout).toContain('placement="sidebar"');
    expect(layout).toContain('admin-mobile-top-chrome');
    expect(existsSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubShell.astro'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/components/adminHub/AdminHubSetupCard.astro'))).toBe(false);
  });
});
