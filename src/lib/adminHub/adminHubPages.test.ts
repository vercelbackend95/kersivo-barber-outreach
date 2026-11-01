import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { parseAdminHubLocation } from './hubView';
import { ADMIN_HUB_LINKS, adminHubUrlFor, tokenHubLinks } from './links';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('/admin hub location', () => {
  const parse = (path: string) => parseAdminHubLocation(new URL(`http://localhost${path}`));

  it('renders the four sections from the path', () => {
    expect(parse('/admin').section).toBe('overview');
    expect(parse('/admin/changes').section).toBe('changes');
    expect(parse('/admin/website').section).toBe('website');
    expect(parse('/admin/messages').section).toBe('messages');
    expect(parse('/admin/team').section).toBe('team');
    expect(parse('/admin/services').section).toBe('services');
    expect(parse('/admin/products').section).toBe('products');
    expect(parse('/admin/launch').section).toBe('overview');
  });

  it('opens apps without replacing the section underneath', () => {
    expect(parse('/admin?app=messages&draft=reopen')).toMatchObject({
      section: 'overview',
      app: 'messages',
      draft: 'reopen',
    });
    for (const app of ['setup', 'logo', 'photos', 'materials', 'hours', 'about', 'colours', 'activity', 'business']) {
      expect(parse(`/admin?app=${app}`)).toMatchObject({ section: 'overview', app });
    }
    expect(parse('/admin?app=services')).toMatchObject({ section: 'overview', app: null });
    expect(parse('/admin?app=team')).toMatchObject({ section: 'overview', app: null });
    expect(parse('/admin/changes?app=unknown')).toMatchObject({ section: 'changes', app: null });
    expect(parse('/admin/website?app=logo')).toMatchObject({ section: 'website', app: 'logo' });
    expect(parse('/admin?draft=<script>').draft).toBeNull();
  });

  it('keeps the booking view', () => {
    expect(parse('/admin/website?view=booking').view).toBe('booking');
    expect(parse('/admin/website?view=x').view).toBe('website');
  });

  it('every bridged URL is an /admin URL without a token', () => {
    for (const subroute of ['', 'overview', 'website', 'changes', 'messages', 'details'] as const) {
      expect(adminHubUrlFor(subroute, new URLSearchParams())).toMatch(/^\/admin(\/|\?|$)/);
    }
    expect(Object.values(ADMIN_HUB_LINKS).filter((value) => typeof value === 'string').every((value) => (value as string).startsWith('/admin'))).toBe(true);
    expect(tokenHubLinks('abc').details).toBe('/preview/abc/details');
  });
});

describe('/admin page with the flag off', () => {
  const src = read('src/pages/admin.astro');

  it('still renders the full admin exactly as before', () => {
    expect(src).toContain('<AdminPanel client:load initialSection={Astro.url.searchParams.get(\'section\')} />');
    expect(src).toContain('title="Admin | Kersivo"');
    expect(src).not.toContain('admin-hub.css');
    expect(src).not.toContain('AdminHubShell');
  });

  it('only touches headers or cookies once resolveAdminPageMode returns a mode', () => {
    const frontmatter = src.split('---')[1]!;
    const guard = frontmatter.indexOf('if (mode) {');
    expect(guard).toBeGreaterThan(frontmatter.indexOf('resolveAdminPageMode('));
    for (const effect of ['Astro.response.headers', 'Astro.locals.adminHubMode']) {
      expect(frontmatter.indexOf(effect)).toBeGreaterThan(guard);
    }
  });
});

describe('/admin hub pages never expose the token', () => {
  const pages = [
    read('src/pages/admin.astro'),
    read('src/pages/admin/changes.astro'),
    read('src/pages/admin/website.astro'),
    read('src/pages/admin/messages.astro'),
  ];

  it('passes an empty token and the cookie API to remaining islands', () => {
    const website = read('src/pages/admin/website.astro');
    const changes = read('src/pages/admin/changes.astro');
    expect(website).toContain('token=""');
    expect(changes).toContain('token=""');
    expect(website).toContain('apiBase={ADMIN_HUB_API_BASE}');
    expect(read('src/components/adminHub/PreviewHubFrame.astro')).toContain('<AppHost client:load');
    expect(website).toContain('<AdminHubWebsite');
    expect(changes).toContain('<AdminHubChanges');
    expect(website).not.toContain('HubWebsiteView');
    expect(website).not.toContain('HubYourShop');
    expect(read('src/pages/admin/messages.astro')).toContain('AdminHubMessages');
    expect(read('src/pages/admin/messages.astro')).toContain('token=""');
    expect(read('src/pages/admin/messages.astro')).not.toContain('admin-hub-messages-placeholder');
  });

  it('never reads the token or builds /preview URLs', () => {
    for (const src of [...pages, read('src/components/adminHub/AdminHubSetupCard.tsx')]) {
      expect(src).not.toContain('publicToken');
      expect(src).not.toContain('ctx.token');
      expect(src).not.toContain('previewPagePath');
      expect(src).not.toContain('/api/preview-hub');
    }
    expect(read('src/components/adminHub/AdminHubSetupCard.tsx')).not.toMatch(/\bfetch\s*\(/);
  });

  it('is private and refuses to render outside hub mode', () => {
    const hub = read('src/pages/admin/hub.astro');
    expect(hub).toContain('ADMIN_PRIVATE_HEADERS');
    expect(hub).toContain("if (!mode) return hubNotFound();");
    expect(hub).toContain("if (mode.kind !== 'hub')");
    expect(read('src/pages/admin/changes.astro')).toContain('fallbackFullToAdmin');
    expect(read('src/lib/adminHub/previewHubAdminPage.ts')).toContain('ADMIN_PRIVATE_HEADERS');
    expect(read('src/layouts/PreviewHubDocument.astro')).toContain('noindex={true}');
    expect(read('src/layouts/PreviewHubDocument.astro')).toContain('robotsFollow={false}');
    for (const page of ['team', 'services', 'products']) {
      const src = read(`src/pages/admin/${page}.astro`);
      expect(src).toContain('preparePreviewHubRealAdminPage');
      expect(src).toContain('<AdminPanel client:load');
      expect(src).toContain('hubChrome={hubChrome}');
      expect(src).toContain('HubDraftShopSetup');
      expect(src).toContain('PreviewHubAdminDocument');
    }
  });

  it('keeps HubShell for the old /preview pages only', () => {
    expect(read('src/pages/admin.astro')).not.toContain('components/previewHub/HubShell.astro');
    expect(read('src/pages/preview/[token]/overview.astro')).toContain('HubShell');
  });
});
