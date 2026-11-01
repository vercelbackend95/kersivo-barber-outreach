import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ prisma: {} }));

import { parseAdminHubLocation } from './hubView';
import { ADMIN_HUB_LINKS, adminHubUrlFor, tokenHubLinks } from './links';

const read = (rel: string) => readFileSync(resolve(process.cwd(), rel), 'utf8');

describe('/admin hub location', () => {
  const parse = (search: string) => parseAdminHubLocation(new URLSearchParams(search));

  it('renders the three sections and falls back to Overview', () => {
    expect(parse('').section).toBe('overview');
    expect(parse('section=changes').section).toBe('changes');
    expect(parse('section=website').section).toBe('website');
    expect(parse('section=bookings').section).toBe('overview');
  });

  it('opens apps without replacing the section underneath', () => {
    expect(parse('app=messages&draft=reopen')).toMatchObject({ section: 'overview', app: 'messages', draft: 'reopen' });
    for (const app of ['setup', 'logo', 'photos', 'services', 'team', 'hours', 'about', 'colours', 'activity', 'business']) {
      expect(parse(`app=${app}`)).toMatchObject({ section: 'overview', app });
    }
    expect(parse('app=unknown&section=changes')).toMatchObject({ section: 'changes', app: null });
    expect(parse('section=website&app=logo')).toMatchObject({ section: 'website', app: 'logo' });
    expect(parse('draft=<script>').draft).toBeNull();
  });

  it('keeps the booking view', () => {
    expect(parse('section=website&view=booking').view).toBe('booking');
    expect(parse('section=website&view=x').view).toBe('website');
  });

  it('every bridged URL is an /admin URL without a token', () => {
    for (const subroute of ['', 'overview', 'website', 'changes', 'messages', 'details'] as const) {
      expect(adminHubUrlFor(subroute, new URLSearchParams())).toMatch(/^\/admin(\?|$)/);
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
    for (const effect of ['Astro.response.headers', 'Astro.rewrite', 'Astro.locals.adminHubMode']) {
      expect(frontmatter.indexOf(effect)).toBeGreaterThan(guard);
    }
  });
});

describe('/admin hub page never exposes the token', () => {
  const page = read('src/pages/admin/hub.astro');
  const shell = read('src/components/adminHub/AdminHubShell.astro');

  it('passes an empty token and the cookie API to every remaining island', () => {
    const tokens = page.match(/token=\{?[^\s>]*/g) ?? [];
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens.every((value) => value === 'token=""')).toBe(true);
    expect(page).toContain('apiBase={ADMIN_HUB_API_BASE}');
    expect(page).toContain('<AppHost client:load');
    expect(page).toContain('<AdminHubWebsite');
    expect(page).toContain('<AdminHubChanges');
    expect(page).not.toContain('HubWebsiteView');
    expect(page).not.toContain('HubYourShop');
    expect(page).not.toContain('HubMessages');
  });

  it('never reads the token or builds /preview URLs', () => {
    for (const src of [page, shell, read('src/components/adminHub/AdminHubSetupCard.astro')]) {
      expect(src).not.toContain('publicToken');
      expect(src).not.toContain('ctx.token');
      expect(src).not.toContain('previewPagePath');
      expect(src).not.toContain('/api/preview-hub');
    }
  });

  it('is private and refuses to render outside hub mode', () => {
    expect(page).toContain('ADMIN_PRIVATE_HEADERS');
    expect(page).toContain("if (!mode) return hubNotFound();");
    expect(page).toContain("if (mode.kind !== 'hub')");
  });

  it('keeps HubShell for the old /preview pages only', () => {
    expect(page).not.toContain('components/previewHub/HubShell.astro');
    expect(read('src/pages/preview/[token]/overview.astro')).toContain('HubShell');
  });
});
