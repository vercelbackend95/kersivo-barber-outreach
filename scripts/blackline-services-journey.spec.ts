import { expect, test, type Page } from '@playwright/test';

const VIEWPORTS = [
  { width: 320, height: 720 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

test.describe('BLACKLINE service menu', () => {
  test('renders all 18 services without category filtering', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /Choose your finish/i })).toBeVisible();
    await expect(page.locator('.bl-services-cat')).toHaveCount(0);
    await expect(page.locator('.bl-service-group')).toHaveCount(4);
    await expect(page.locator('.bl-service-group[hidden]')).toHaveCount(0);
    await expect(page.locator('.bl-service-item')).toHaveCount(18);
    await expect(page.getByRole('heading', { name: /^Cuts & Fades$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Beard & Shave$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Hair & Beard Combos$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Grooming & Care$/i })).toBeVisible();
    await expect(page.locator('.bl-service-group-name')).toHaveCount(4);
    await expect(page.locator('.bl-service-group-index')).toHaveCount(0);
    await expect(page.locator('.bl-services-viewing-index, [data-bl-viewing-index]')).toHaveCount(0);
    for (const heading of await page.locator('.bl-service-group-name').all()) {
      await expect(heading).not.toHaveText(/^\d/);
    }
    await expect(page.locator('.bl-service-index').first()).toBeVisible();
    await expect(page.getByRole('complementary', { name: 'Current service category' })).toBeVisible();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Cuts & Fades/i);
    await expect(page.locator('[data-bl-viewing-meta]')).toBeVisible();
    await expect(page).not.toHaveURL(/category=/);
  });

  test('updates the viewing panel while scrolling without changing the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    await page.locator('#beard-and-shave').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Beard & Shave/i);
    await expect(page.locator('[data-bl-viewing-meta]')).toContainText(/service/i);

    await page.locator('#hair-and-beard-combos').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Hair & Beard Combos/i);

    await page.locator('#grooming-and-care').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Grooming & Care/i);

    await page.locator('.bl-services-close').scrollIntoViewIfNeeded();
    await expect(page.locator('[data-bl-viewing-name]')).toHaveText(/Grooming & Care/i);
    await expect(page).not.toHaveURL(/category=/);
  });

  test('keeps booking links on stable slugs', async ({ page }) => {
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: /Book Skin Fade, 45 minutes/i })).toHaveAttribute(
      'href',
      '/demo/book?service=skin-fade',
    );
    await expect(page.getByRole('link', { name: /Book Classic Cut and Finish, 35 minutes/i })).toHaveAttribute(
      'href',
      '/demo/book?service=haircut-finish',
    );
  });

  test('is keyboard operable without a category menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await page.locator('.bl-service-item[data-service-slug="hot-towel-shave"] .bl-service-book').focus();
    await expect(page.locator('.bl-service-item[data-service-slug="hot-towel-shave"] .bl-service-book')).toBeFocused();
    await expect(page.locator('.bl-service-group[data-category-slug="cuts-fades"]')).toBeVisible();
  });

  test('keeps reverse category panels, larger titles, and stable Featured slots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });

    const metrics = await page.evaluate(() => {
      const groups = Array.from(document.querySelectorAll('.bl-service-group'));
      return groups.map((group) => {
        const head = group.querySelector('.bl-service-group-head') as HTMLElement | null;
        const name = group.querySelector('.bl-service-group-name') as HTMLElement | null;
        const count = group.querySelector('.bl-service-group-count') as HTMLElement | null;
        const service = group.querySelector('.bl-service-name') as HTMLElement | null;
        const copy = group.querySelector('.bl-service-copy') as HTMLElement | null;
        if (!head || !name || !count || !service || !copy) return null;
        const nameBox = name.getBoundingClientRect();
        const countBox = count.getBoundingClientRect();
        const serviceBox = service.getBoundingClientRect();
        const copyBox = copy.getBoundingClientRect();
        const headStyle = getComputedStyle(head);
        const overlaps =
          nameBox.left < countBox.right &&
          nameBox.right > countBox.left &&
          nameBox.top < countBox.bottom &&
          nameBox.bottom > countBox.top;
        return {
          categoryLabel: name.textContent?.trim() ?? '',
          categorySize: Number.parseFloat(getComputedStyle(name).fontSize),
          serviceSize: Number.parseFloat(getComputedStyle(service).fontSize),
          overlaps,
          serviceOverflows: service.scrollWidth > copyBox.width + 1,
          headBackground: headStyle.backgroundColor,
          headColor: headStyle.color,
          headShadow: headStyle.boxShadow,
        };
      });
    });

    expect(metrics.every(Boolean)).toBe(true);
    for (const row of metrics) {
      expect(row!.overlaps).toBe(false);
      expect(row!.categorySize).toBeGreaterThan(row!.serviceSize);
      expect(row!.serviceOverflows).toBe(false);
      expect(row!.categoryLabel).not.toMatch(/^\d/);
      expect(row!.headShadow === 'none' || row!.headShadow === '').toBe(true);
      expect(row!.headBackground).toMatch(/rgb\(\s*11,\s*12,\s*14\s*\)/);
    }

    const chipAlignment = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.bl-service-chip')) as HTMLElement[];
      if (chips.length < 2) return { ok: false, reason: 'not-enough-chips', tops: [] as number[], rights: [] as number[] };
      const tops = chips.map((chip) => Math.round(chip.getBoundingClientRect().top));
      const rights = chips.map((chip) => Math.round(chip.getBoundingClientRect().right));
      const firstTop = tops[0]!;
      const firstRight = rights[0]!;
      // Featured chips sit in different service rows, so tops differ; right edges should share the slot column.
      const rightAligned = rights.every((right) => Math.abs(right - firstRight) <= 2);
      const slots = Array.from(document.querySelectorAll('.bl-service-chip-slot')) as HTMLElement[];
      const slotRights = slots
        .filter((slot) => slot.querySelector('.bl-service-chip'))
        .map((slot) => Math.round(slot.getBoundingClientRect().right));
      const slotAligned = slotRights.every((right) => Math.abs(right - slotRights[0]!) <= 2);
      const collisions = chips.some((chip) => {
        const name = chip.closest('.bl-service-heading')?.querySelector('.bl-service-name');
        if (!(name instanceof HTMLElement)) return true;
        const chipBox = chip.getBoundingClientRect();
        const nameBox = name.getBoundingClientRect();
        return (
          nameBox.left < chipBox.right &&
          nameBox.right > chipBox.left &&
          nameBox.top < chipBox.bottom &&
          nameBox.bottom > chipBox.top
        );
      });
      return {
        ok: rightAligned && slotAligned && !collisions,
        reason: !slotAligned ? 'slot-misaligned' : collisions ? 'collision' : 'ok',
        tops,
        rights: slotRights,
        firstTop,
      };
    });
    expect(chipAlignment.reason, JSON.stringify(chipAlignment)).toBe('ok');
    expect(chipAlignment.ok).toBe(true);

    const longService = page.locator('.bl-service-item[data-service-slug="haircut-beard"] .bl-service-name');
    await expect(longService).toBeVisible();
    const longOverflow = await longService.evaluate((el) => {
      const copy = el.closest('.bl-service-copy') as HTMLElement | null;
      if (!copy) return true;
      return el.scrollWidth > copy.clientWidth + 1;
    });
    expect(longOverflow).toBe(false);
  });

  test('turns motion off when the user prefers reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
    await expect.poll(async () => page.locator('html').getAttribute('data-bl-services-motion')).toBeNull();
  });

  for (const viewport of VIEWPORTS) {
    test(`does not overflow at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo/services', { waitUntil: 'domcontentloaded' });
      await assertNoHorizontalOverflow(page);
      await expect(page.locator('.bl-service-item')).toHaveCount(18);
      await page.locator('#hair-and-beard-combos').scrollIntoViewIfNeeded();
      await expect(page.locator('#hair-and-beard-combos')).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }
});
