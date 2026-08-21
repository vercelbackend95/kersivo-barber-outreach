import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertSingleProductRow(page: Page) {
  const metrics = await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll('.bl-shop-rail .product-rail__item, .bl-shop-rail .shop6__item'),
    ) as HTMLElement[];
    if (items.length < 2) {
      return { ok: false, reason: 'not-enough-items', tops: [] as number[], count: items.length };
    }
    const tops = items.map((item) => Math.round(item.getBoundingClientRect().top));
    const first = tops[0];
    const ok = tops.every((top) => Math.abs(top - first) <= 2);
    return { ok, tops, count: items.length, reason: ok ? 'ok' : 'wrapped' };
  });
  expect(metrics.reason, JSON.stringify(metrics)).toBe('ok');
  expect(metrics.ok).toBe(true);
  expect(metrics.count).toBe(10);
}

test.describe('BLACKLINE home shop product rail', () => {
  test('matches locked You may also like mobile contract', async ({ page }) => {
    const mobileWidths = [320, 360, 375, 390, 430];

    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/demo', { waitUntil: 'domcontentloaded' });

      const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
      await expect(rail).toBeVisible();
      await rail.scrollIntoViewIfNeeded();

      const metrics = await page.evaluate(() => {
        const root = document.querySelector('.bl-shop-rail [data-product-rail-root]') as HTMLElement | null;
        const track = root?.querySelector('[data-product-rail-track]') as HTMLElement | null;
        const progress = root?.querySelector('.product-rail__progress') as HTMLElement | null;
        const nextBtn = root?.querySelector('[data-product-rail-next]') as HTMLElement | null;
        const atc = root?.querySelector('.sf-atc[data-add-to-cart]') as HTMLElement | null;
        const firstItem = track?.querySelector('.product-rail__item') as HTMLElement | null;
        if (!root || !track || !atc || !firstItem) return null;
        const items = [...track.querySelectorAll('.product-rail__item')] as HTMLElement[];
        const trackRect = track.getBoundingClientRect();
        let fullyVisible = 0;
        let partialVisible = 0;
        for (const item of items) {
          const r = item.getBoundingClientRect();
          const visible = Math.max(0, Math.min(r.right, trackRect.right) - Math.max(r.left, trackRect.left));
          if (visible <= 1) continue;
          if (visible >= r.width - 2) fullyVisible += 1;
          else if (visible >= r.width * 0.35) partialVisible += 1;
        }
        const full = atc.querySelector('.sf-atc-label-full') as HTMLElement | null;
        const short = atc.querySelector('.sf-atc-label-short') as HTMLElement | null;
        const progressBox = progress?.getBoundingClientRect();
        const nextBox = nextBtn?.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        return {
          token: getComputedStyle(root).getPropertyValue('--product-rail-visible-cards').trim(),
          railPadding: getComputedStyle(root).getPropertyValue('--product-rail-padding').trim(),
          trackLeft: Math.round(trackRect.left),
          firstCardLeft: Math.round(firstItem.getBoundingClientRect().left),
          progressFullyVisible: progressBox
            ? progressBox.left >= 0 && progressBox.right <= vw + 0.5
            : false,
          nextFullyVisible: nextBox ? nextBox.left >= 0 && nextBox.right <= vw + 0.5 : false,
          fullyVisible,
          partialVisible,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: vw,
          ariaLabel: atc.getAttribute('aria-label') ?? '',
          fullText: full?.textContent?.trim() ?? '',
          shortText: short?.textContent?.trim() ?? '',
          fullDisplay: full ? getComputedStyle(full).display : '',
          shortDisplay: short ? getComputedStyle(short).display : '',
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics!.token).toBe('2.5');
      expect(metrics!.railPadding).toBe('0px');
      expect(metrics!.trackLeft).toBe(4);
      expect(metrics!.firstCardLeft).toBe(4);
      expect(metrics!.progressFullyVisible).toBe(true);
      expect(metrics!.nextFullyVisible).toBe(true);
      expect(metrics!.fullyVisible).toBe(2);
      expect(metrics!.partialVisible).toBeGreaterThanOrEqual(1);
      expect(metrics!.scrollWidth).toBeLessThanOrEqual(metrics!.clientWidth + 1);
      expect(metrics!.ariaLabel).toMatch(/^Add to bag:/i);
      expect(metrics!.fullText).toBe('Add to bag');
      expect(metrics!.shortText).toBe('Add');
      expect(metrics!.fullDisplay).toBe('none');
      expect(metrics!.shortDisplay).not.toBe('none');
    }

    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    const tablet = await page.evaluate(() => {
      const root = document.querySelector('.bl-shop-rail [data-product-rail-root]') as HTMLElement | null;
      const atc = root?.querySelector('.sf-atc[data-add-to-cart]') as HTMLElement | null;
      const full = atc?.querySelector('.sf-atc-label-full') as HTMLElement | null;
      const short = atc?.querySelector('.sf-atc-label-short') as HTMLElement | null;
      return {
        token: root
          ? getComputedStyle(root).getPropertyValue('--product-rail-visible-cards').trim()
          : '',
        fullDisplay: full ? getComputedStyle(full).display : '',
        shortDisplay: short ? getComputedStyle(short).display : '',
        fullText: full?.textContent?.trim() ?? '',
      };
    });
    expect(tablet.token).toBe('2.35');
    expect(tablet.fullText).toBe('Add to bag');
    expect(tablet.fullDisplay).not.toBe('none');
    expect(tablet.shortDisplay).toBe('none');
  });

  test('landing rail card chrome matches PDP You may also like', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    const relatedChrome = await page.evaluate(() => {
      const card = document.querySelector('.sf-pdp-related .sf-card') as HTMLElement | null;
      const atc = document.querySelector('.sf-pdp-related .sf-atc[data-add-to-cart]') as HTMLElement | null;
      const footer = document.querySelector('.sf-pdp-related .sf-card-footer') as HTMLElement | null;
      if (!card || !atc || !footer) return null;
      const cardStyle = getComputedStyle(card);
      const atcStyle = getComputedStyle(atc);
      const footerStyle = getComputedStyle(footer);
      return {
        hostHasShop: Boolean(document.querySelector('.sf-shop.sf-shop--blackline')),
        display: cardStyle.display,
        flexDirection: cardStyle.flexDirection,
        background: cardStyle.backgroundColor,
        atcBackground: atcStyle.backgroundColor,
        footerDisplay: footerStyle.display,
        footerJustify: footerStyle.justifyContent,
        nameMinHeight: getComputedStyle(card.querySelector('.sf-card-name') as HTMLElement).minHeight,
      };
    });

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    const landingChrome = await page.evaluate(() => {
      const host = document.querySelector('.bl-shop-rail') as HTMLElement | null;
      const card = document.querySelector('.bl-shop-rail .sf-card') as HTMLElement | null;
      const atc = document.querySelector('.bl-shop-rail .sf-atc[data-add-to-cart]') as HTMLElement | null;
      const footer = document.querySelector('.bl-shop-rail .sf-card-footer') as HTMLElement | null;
      if (!host || !card || !atc || !footer) return null;
      const cardStyle = getComputedStyle(card);
      const atcStyle = getComputedStyle(atc);
      const footerStyle = getComputedStyle(footer);
      return {
        hostHasShop: host.classList.contains('sf-shop') && host.classList.contains('sf-shop--blackline'),
        display: cardStyle.display,
        flexDirection: cardStyle.flexDirection,
        background: cardStyle.backgroundColor,
        atcBackground: atcStyle.backgroundColor,
        footerDisplay: footerStyle.display,
        footerJustify: footerStyle.justifyContent,
        nameMinHeight: getComputedStyle(card.querySelector('.sf-card-name') as HTMLElement).minHeight,
      };
    });

    expect(relatedChrome).not.toBeNull();
    expect(landingChrome).not.toBeNull();
    expect(landingChrome!.hostHasShop).toBe(true);
    expect(landingChrome!.display).toBe(relatedChrome!.display);
    expect(landingChrome!.flexDirection).toBe(relatedChrome!.flexDirection);
    expect(landingChrome!.background).toBe(relatedChrome!.background);
    expect(landingChrome!.atcBackground).toBe(relatedChrome!.atcBackground);
    expect(landingChrome!.footerDisplay).toBe(relatedChrome!.footerDisplay);
    expect(landingChrome!.footerJustify).toBe(relatedChrome!.footerJustify);
    expect(landingChrome!.nameMinHeight).toBe(relatedChrome!.nameMinHeight);
    expect(landingChrome!.atcBackground).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i);
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    test(`keeps one horizontal row at ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto('/demo', { waitUntil: 'networkidle' });
      const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
      await expect(rail).toBeVisible();
      await rail.scrollIntoViewIfNeeded();
      await assertSingleProductRow(page);
      await assertNoHorizontalOverflow(page);

      const peek = await page.evaluate(() => {
        const track = document.querySelector('.bl-shop-rail [data-product-rail-track]') as HTMLElement | null;
        if (!track) return { canScroll: false };
        return { canScroll: track.scrollWidth > track.clientWidth + 2 };
      });
      expect(peek.canScroll).toBe(true);
    });
  }

  test('shows ten storefront cards, ATC icons, and shared cart updates', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo', { waitUntil: 'networkidle' });

    const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
    await rail.scrollIntoViewIfNeeded();

    await expect(page.locator('.bl-shop-rail .product-rail__item')).toHaveCount(10);
    await expect(page.locator('.bl-shop-rail .sf-card')).toHaveCount(10);
    await expect(rail.locator('[data-product-rail-status]')).toHaveText(/01\s*\/\s*10/);

    const ids = await page
      .locator('.bl-shop-rail [data-add-to-cart]')
      .evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('data-product-id')).filter(Boolean),
      );
    expect(new Set(ids).size).toBe(10);

    const atcIcons = page.locator('.bl-shop-rail .sf-atc--icon');
    await expect(atcIcons).toHaveCount(10);
    expect(await atcIcons.evaluateAll((nodes) => nodes.every((node) => Boolean(node.querySelector('svg'))))).toBe(
      true,
    );

    await expect(page.locator('.bl-shop-rail .sf-card-body')).toHaveCount(10);
    await expect(page.locator('.bl-shop-rail .sf-card-footer')).toHaveCount(10);

    const cardChrome = await page.evaluate(() => {
      const card = document.querySelector('.bl-shop-rail .sf-card') as HTMLElement | null;
      if (!card) return null;
      const style = getComputedStyle(card);
      const borderTopColor = style.borderTopColor;
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      let rgb: [number, number, number] | null = null;
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillStyle = borderTopColor;
        ctx.fillRect(0, 0, 1, 1);
        const data = ctx.getImageData(0, 0, 1, 1).data;
        rgb = [data[0]!, data[1]!, data[2]!];
      }
      return {
        boxShadow: style.boxShadow,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopStyle: style.borderTopStyle,
        borderTopColor,
        borderRgb: rgb,
      };
    });
    expect(cardChrome).not.toBeNull();
    // Full perimeter border (matches shop grid / PDP related) — not inset stroke covered by media
    expect(cardChrome!.borderTopWidth).toBe('1px');
    expect(cardChrome!.borderRightWidth).toBe('1px');
    expect(cardChrome!.borderBottomWidth).toBe('1px');
    expect(cardChrome!.borderLeftWidth).toBe('1px');
    expect(cardChrome!.borderTopStyle).toBe('solid');
    expect(cardChrome!.borderTopColor).not.toMatch(/rgba\(0,\s*0,\s*0,\s*0\)|transparent/i);
    // Canonical dark cards: ivory shop-border (same as PDP You may also like)
    expect(cardChrome!.borderTopColor).toMatch(/rgba?\(\s*244\s*,\s*241\s*,\s*234/i);
    // Storefront rail cards keep shadow none (productRail storefront rule)
    expect(cardChrome!.boxShadow === 'none' || cardChrome!.boxShadow === '').toBe(true);

    const footerLayout = await page.evaluate(() => {
      const footer = document.querySelector('.bl-shop-rail .sf-card-footer') as HTMLElement | null;
      const price = footer?.querySelector('.sf-card-price') as HTMLElement | null;
      const actions = footer?.querySelector('.sf-card-actions') as HTMLElement | null;
      const cta = footer?.querySelector('.sf-atc') as HTMLElement | null;
      if (!footer || !price || !actions || !cta) return null;
      const footerBox = footer.getBoundingClientRect();
      const priceBox = price.getBoundingClientRect();
      const actionsBox = actions.getBoundingClientRect();
      const ctaStyle = getComputedStyle(cta);
      return {
        priceLeft: priceBox.left < actionsBox.left,
        footerDisplay: getComputedStyle(footer).display,
        footerJustify: getComputedStyle(footer).justifyContent,
        ctaWidthRatio: cta.getBoundingClientRect().width / footerBox.width,
        ctaWidth: ctaStyle.width,
      };
    });
    expect(footerLayout).not.toBeNull();
    expect(footerLayout!.priceLeft).toBe(true);
    expect(footerLayout!.footerDisplay).toBe('flex');
    expect(footerLayout!.ctaWidthRatio).toBeLessThan(0.7);

    await expect(page.locator('.bl-shop-rail .product-rail__affordance')).toHaveCount(0);
    await expect(page.locator('.bl-shop-rail img[src=""]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /view product: ironclad pomade/i })).toHaveAttribute(
      'href',
      /\/demo\/shop\/bl-product-ironclad-pomade/,
    );
    await expect(page.getByRole('link', { name: /view product: essential styling set/i })).toHaveAttribute(
      'href',
      /\/demo\/shop\/bl-product-essential-styling-set/,
    );

    const styling = page.locator('.bl-shop-rail article').filter({ hasText: 'Essential Styling Set' });
    await expect(styling.locator('.sf-media--fallback, .sf-media--wordmark')).toBeVisible();

    const bagCount = page.locator('[data-bl-bag-count]').first();
    const before = Number((await bagCount.textContent())?.trim() || '0');

    await page.getByRole('button', { name: /add to bag: ironclad pomade/i }).click();
    await expect.poll(async () => Number((await bagCount.textContent())?.trim() || '0')).toBe(
      before + 1,
    );

    await page.locator('[data-bl-bag-button]').first().click();
    await expect(page.locator('.sf-cart.is-open, [data-sf-cart].is-open')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText(/ironclad pomade/i).first()).toBeVisible();

    await page.getByRole('button', { name: /continue shopping/i }).click();
    await expect(page.locator('.sf-cart.is-open')).toHaveCount(0);

    const prev = rail.locator('[data-product-rail-prev]').first();
    const next = rail.locator('[data-product-rail-next]').first();
    await expect(prev).toBeDisabled();
    await expect(next).toBeEnabled();
    await next.click();
    await expect(prev).toBeEnabled();

    await expect(page.locator('.bl-shop-cta')).toHaveAttribute('href', '/demo/shop');
  });

  test('matches key computed styles with /demo/shop product cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/demo/shop', { waitUntil: 'networkidle' });
    const shopStyles = await page.evaluate((sel) => {
      const card = document.querySelector(sel) as HTMLElement | null;
      if (!card) return null;
      const body = card.querySelector('.sf-card-body') as HTMLElement | null;
      const media = card.querySelector('.sf-card-media') as HTMLElement | null;
      const title = card.querySelector('.sf-card-name') as HTMLElement | null;
      const footer = card.querySelector('.sf-card-footer') as HTMLElement | null;
      const cta = card.querySelector('.sf-atc') as HTMLElement | null;
      if (!body || !media || !title || !footer || !cta) return null;
      const cardStyle = getComputedStyle(card);
      const bodyStyle = getComputedStyle(body);
      const mediaStyle = getComputedStyle(media);
      const titleStyle = getComputedStyle(title);
      const footerStyle = getComputedStyle(footer);
      const ctaStyle = getComputedStyle(cta);
      return {
        borderRadius: cardStyle.borderRadius,
        backgroundColor: cardStyle.backgroundColor,
        bodyPadding: bodyStyle.padding,
        mediaAspectRatio: mediaStyle.aspectRatio,
        ctaHeight: ctaStyle.height,
        ctaBorderRadius: ctaStyle.borderRadius,
        titleFontSize: titleStyle.fontSize,
        footerDisplay: footerStyle.display,
        footerJustifyContent: footerStyle.justifyContent,
      };
    }, '.sf-shop .sf-grid .sf-card');
    expect(shopStyles).not.toBeNull();

    await page.goto('/demo', { waitUntil: 'networkidle' });
    await page.locator('.bl-shop-rail [data-product-rail-root]').scrollIntoViewIfNeeded();
    const landingStyles = await page.evaluate((sel) => {
      const card = document.querySelector(sel) as HTMLElement | null;
      if (!card) return null;
      const body = card.querySelector('.sf-card-body') as HTMLElement | null;
      const media = card.querySelector('.sf-card-media') as HTMLElement | null;
      const title = card.querySelector('.sf-card-name') as HTMLElement | null;
      const footer = card.querySelector('.sf-card-footer') as HTMLElement | null;
      const cta = card.querySelector('.sf-atc') as HTMLElement | null;
      if (!body || !media || !title || !footer || !cta) return null;
      const cardStyle = getComputedStyle(card);
      const bodyStyle = getComputedStyle(body);
      const mediaStyle = getComputedStyle(media);
      const titleStyle = getComputedStyle(title);
      const footerStyle = getComputedStyle(footer);
      const ctaStyle = getComputedStyle(cta);
      return {
        borderRadius: cardStyle.borderRadius,
        backgroundColor: cardStyle.backgroundColor,
        bodyPadding: bodyStyle.padding,
        mediaAspectRatio: mediaStyle.aspectRatio,
        ctaHeight: ctaStyle.height,
        ctaBorderRadius: ctaStyle.borderRadius,
        titleFontSize: titleStyle.fontSize,
        footerDisplay: footerStyle.display,
        footerJustifyContent: footerStyle.justifyContent,
      };
    }, '.bl-shop-rail .sf-card');
    expect(landingStyles).not.toBeNull();
    expect(landingStyles).toEqual(shopStyles);
  });

  test('keeps hover lift unclipped inside the rail track', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo', { waitUntil: 'networkidle' });
    const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
    await rail.scrollIntoViewIfNeeded();

    const card = page.locator('.bl-shop-rail .sf-card').first();
    await card.hover();

    const hoverMetrics = await page.evaluate(() => {
      const track = document.querySelector('.bl-shop-rail [data-product-rail-track]') as HTMLElement | null;
      const hovered = document.querySelector('.bl-shop-rail .sf-card') as HTMLElement | null;
      if (!track || !hovered) return null;
      const trackBox = track.getBoundingClientRect();
      const cardBox = hovered.getBoundingClientRect();
      const transform = getComputedStyle(hovered).transform;
      return {
        transform,
        cardTop: cardBox.top,
        trackTop: trackBox.top,
      };
    });
    expect(hoverMetrics).not.toBeNull();
    expect(hoverMetrics!.transform === 'none' || hoverMetrics!.transform === '').toBe(false);
    expect(hoverMetrics!.cardTop).toBeGreaterThanOrEqual(hoverMetrics!.trackTop - 1);
  });

  test('shows a right-edge fade while more products remain, then hides it at the end', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo', { waitUntil: 'networkidle' });
    const rail = page.locator('.bl-shop-rail [data-product-rail-root]');
    await rail.scrollIntoViewIfNeeded();
    const track = page.locator('.bl-shop-rail [data-product-rail-track]');

    await expect(rail).toHaveAttribute('data-can-scroll-right', 'true');
    const fadeWhileScrollable = await track.evaluate((el) => {
      const style = getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      return { mask };
    });
    expect(fadeWhileScrollable.mask).toMatch(/linear-gradient/i);
    expect(fadeWhileScrollable.mask).not.toBe('none');
    // Multi-stop ease (not a hard two-stop wash)
    expect((fadeWhileScrollable.mask.match(/rgba?\(/g) || []).length).toBeGreaterThanOrEqual(2);

    // Header controls must stay outside the track mask (not washed out)
    const controlsClear = await page.evaluate(() => {
      const next = document.querySelector(
        '.bl-shop-rail [data-product-rail-next]',
      ) as HTMLElement | null;
      const trackEl = document.querySelector(
        '.bl-shop-rail [data-product-rail-track]',
      ) as HTMLElement | null;
      if (!next || !trackEl) return null;
      const nextBox = next.getBoundingClientRect();
      const trackBox = trackEl.getBoundingClientRect();
      return nextBox.bottom <= trackBox.top + 1;
    });
    expect(controlsClear).toBe(true);

    // Mid-scroll: both edges can fade
    await track.evaluate((el) => {
      el.scrollLeft = Math.round(el.scrollWidth * 0.35);
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(rail).toHaveAttribute('data-can-scroll-left', 'true');
    await expect(rail).toHaveAttribute('data-can-scroll-right', 'true');

    await track.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      el.dispatchEvent(new Event('scroll'));
    });
    await expect(rail).toHaveAttribute('data-can-scroll-right', 'false');
    await expect(rail.locator('[data-product-rail-next]').first()).toBeDisabled();

    const fadeAtEnd = await track.evaluate((el) => {
      const style = getComputedStyle(el);
      const mask = style.maskImage || style.webkitMaskImage || '';
      return { mask };
    });
    // At end: no right fade; left-only mask may remain
    expect(fadeAtEnd.mask === 'none' || fadeAtEnd.mask.includes('linear-gradient')).toBe(true);
    if (fadeAtEnd.mask !== 'none' && fadeAtEnd.mask !== '') {
      await expect(rail).toHaveAttribute('data-can-scroll-left', 'true');
    }
  });

  test('keeps shop page card shadows intact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'networkidle' });
    const shadow = await page.evaluate(() => {
      const card = document.querySelector('.sf-shop .sf-card') as HTMLElement | null;
      if (!card) return null;
      return getComputedStyle(card).boxShadow;
    });
    expect(shadow && shadow !== 'none' && shadow !== '').toBe(true);
  });
});
