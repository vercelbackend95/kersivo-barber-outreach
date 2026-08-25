import { expect, test, type Page } from '@playwright/test';

const DASHBOARD_CTA = 'See your order in the dashboard';
const PRODUCT = 'Ironclad Pomade';

async function assertNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function waitForCartIsland(page: Page) {
  await expect(page.locator('[data-sf-cart]')).toBeAttached();
}

async function openBag(page: Page) {
  await waitForCartIsland(page);
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('kersivo:cart-open-request')));
    await expect(page.locator('.sf-cart.is-open')).toBeVisible({ timeout: 400 });
  }).toPass();
}

test.describe('BLACKLINE shop purchase to Orders and Sales', () => {
  test('creates a session order, collects it, and focuses the derived sale', async ({ page }) => {
    const pageErrors: string[] = [];
    const isBenignPageNoise = (text: string) =>
      /favicon|ResizeObserver|net::ERR_|Outdated Optimize Dep|cannot be a descendant|cannot contain a nested|Suspense boundary/i.test(
        text,
      );
    page.on('pageerror', (error) => {
      if (isBenignPageNoise(error.message)) return;
      pageErrors.push(error.message);
    });
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (isBenignPageNoise(text)) return;
        pageErrors.push(text);
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);
    await expect(page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-ironclad-pomade"]')).toBeVisible();

    await page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-ironclad-pomade"]').click();
    await expect(page.locator('[data-sf-cart-toast]')).toContainText('Ironclad Pomade added to bag');
    await expect(page.getByRole('link', { name: /CONTINUE TO CHECKOUT/i })).toHaveCount(0);

    await page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-matte-pomade"]').click();
    await expect(page.locator('[data-sf-cart-toast]')).toContainText('Matte Pomade added to bag');

    await page.locator('[data-bl-bag-button]').click();
    await expect(page.locator('.sf-cart.is-open')).toBeVisible();
    await expect(page.getByRole('dialog', { name: /COLLECT IN SHOP/i })).toBeVisible();
    await page.getByRole('button', { name: /Increase quantity of Ironclad Pomade/i }).click();
    await expect(page.getByText('£56')).toBeVisible();

    const checkoutCta = page.getByRole('link', { name: /CONTINUE TO CHECKOUT/i });
    await expect(checkoutCta).toBeVisible();
    const ctaColor = await checkoutCta.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(ctaColor).toBe('rgb(49, 94, 245)');
    await checkoutCta.click();

    await expect(page.getByRole('button', { name: /COMPLETE DEMO ORDER/i })).toBeVisible();
    await page.getByRole('button', { name: /COMPLETE DEMO ORDER/i }).click();

    await expect(page.getByRole('heading', { name: /Ready for collection/i })).toBeVisible();
    await expect(page.getByText(PRODUCT, { exact: true })).toBeVisible();
    const reference = (await page.locator('.bl-confirm-reference span').innerText()).trim();
    expect(reference).toMatch(/^BL-\d{4}$/);
    await expect(page.getByText(/no real payment, order or email/i)).toBeVisible();

    const dashboardLink = page.getByRole('link', { name: DASHBOARD_CTA });
    const href = await dashboardLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href?.startsWith('/demo/admin?')).toBe(true);
    expect(href?.startsWith('/admin?')).toBe(false);

    const deepLink = new URL(href!, 'http://127.0.0.1:4321');
    expect(deepLink.searchParams.get('section')).toBe('shop_orders');
    expect(deepLink.searchParams.get('demoJourney')).toBe('retail');
    const orderId = deepLink.searchParams.get('order');
    expect(orderId).toBeTruthy();

    await dashboardLink.click();
    await expect(page).toHaveURL(/\/demo\/admin/);
    await expect(page.getByRole('heading', { name: 'BLACKLINE owner dashboard' })).toBeAttached();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 15000 });

    const row = page.locator(`[data-order-id="${orderId}"]`);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText('YOUR DEMO ORDER');
    await expect(row).toContainText(PRODUCT === 'Ironclad Pomade' ? 'Demo' : PRODUCT);
    await expect(page.getByText('A customer has paid online')).toBeVisible();

    await expect
      .poll(async () =>
        row.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          const viewH = window.innerHeight;
          return rect.top >= -80 && rect.bottom <= viewH + 80;
        }),
      )
      .toBe(true);

    const collectBtn = row.locator('.admin-orders-grid-collect-btn');
    await expect(collectBtn).toBeVisible();

    const toCollectBefore = await page.getByText(/\d+ to collect/).innerText();
    await collectBtn.click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByText('Order marked as collected.')).toBeVisible();
    await expect(page.getByText('ORDER COLLECTED')).toBeVisible();
    await expect(page.getByText('Now see the sale')).toBeVisible();
    await expect(page.getByText(/\d+ to collect/)).not.toHaveText(toCollectBefore);

    await expect.poll(async () => page.url()).not.toContain('demoJourney=');
    await expect.poll(async () => page.url()).not.toContain('order=');
    expect(new URL(page.url()).pathname).toBe('/demo/admin');

    const salesCta = page.getByRole('link', { name: 'View in Sales' });
    const salesHref = await salesCta.getAttribute('href');
    expect(salesHref).toContain('section=shop_sales');
    expect(salesHref).toContain(`order=${orderId}`);
    expect(salesHref).toContain('demoJourney=retail');
    await salesCta.click();

    await expect(page.getByRole('heading', { name: 'Sales Analytics' })).toBeVisible({ timeout: 15000 });
    const saleCard = page.locator(`[data-demo-sale-id="${orderId}"]`);
    await expect(saleCard).toBeVisible();
    await expect(saleCard).toContainText('YOUR DEMO SALE');
    await expect(saleCard).toContainText(reference);
    await expect(saleCard).toContainText(PRODUCT);

    const revenueLocator = page.locator('[data-blackline-sales-revenue]').filter({ hasNotText: '£0.00' }).first();
    await expect(revenueLocator).toBeVisible();
    const revenue = await revenueLocator.getAttribute('data-blackline-sales-revenue');
    expect(Number(revenue)).toBeGreaterThan(0);

    await expect.poll(async () => page.url()).not.toContain('demoJourney=');
    await expect.poll(async () => page.url()).not.toContain('order=');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sales Analytics' })).toBeVisible({ timeout: 15000 });
    const revenueAfterLocator = page.locator('[data-blackline-sales-revenue]').filter({ hasNotText: '£0.00' }).first();
    await expect(revenueAfterLocator).toBeVisible();
    const revenueAfter = await revenueAfterLocator.getAttribute('data-blackline-sales-revenue');
    expect(revenueAfter).toBe(revenue);

    await page.goto(`/demo/admin?section=shop_orders`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator(`[data-order-id="${orderId}"]`)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`[data-order-id="${orderId}"] .admin-orders-grid-collect-btn`)).toBeDisabled();

    expect(pageErrors).toEqual([]);
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 768, height: 1024 });
    await assertNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator(`[data-order-id="${orderId}"]`)).toBeVisible();
    await assertNoHorizontalOverflow(page);
  });

  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1918] as const) {
    test(`listing does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /the blackline edit/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test('discovery updates the URL, keeps Featured mounted, and restores on back/forward', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sf-spotlight')).toBeVisible();

    await page.getByRole('tab', { name: /beard care/i }).click();
    await expect(page).toHaveURL(/category=BEARD_CARE/);
    await expect(page.locator('.sf-spotlight')).toBeVisible();
    await expect(page.locator('.sf-grid [data-product-category="BEARD_CARE"]').first()).toBeVisible();

    await page.goBack();
    await expect(page).not.toHaveURL(/category=/);
    await expect(page.locator('.sf-spotlight')).toBeVisible();

    await page.goForward();
    await expect(page).toHaveURL(/category=BEARD_CARE/);
    await expect(page.locator('.sf-spotlight')).toBeVisible();
  });

  test('load more reveals the rest of the filtered catalog', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(/24 of 29 products/i)).toBeVisible();
    await page.getByRole('button', { name: 'Show more products' }).click();
    await expect(page.getByText(/29 of 29 products/i)).toBeVisible();
  });

  test('lists 29 Live products, six derived categories, and packshot PDP media', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'All products' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'All products' }).locator('.sf-rail-count')).toHaveText('29');
    await expect(page.getByRole('tab', { name: 'Styling' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Hair & Scalp' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Beard Care' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Shave & Skin' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Tools & Accessories' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sets & Gifts' })).toBeVisible();

    await page.getByRole('button', { name: 'Show more products' }).click();
    await expect(page.locator('.sf-grid [data-product-item]')).toHaveCount(29);

    await expect(page.locator('[data-shop-search]')).toHaveCount(0);
    await expect(page.getByPlaceholder('Search products')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Styling' }).click();
    await expect(page).toHaveURL(/category=STYLING/);
    await expect(page.locator('.sf-grid [data-product-item]').first()).toBeVisible();

    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /ironclad pomade/i })).toBeVisible();
    await expect(page.locator('.sf-pdp-hero img.sf-media-img')).toBeVisible();
    const pdpAtc = page.locator('.sf-pdp-hero .sf-atc').first();
    await expect(pdpAtc).toHaveClass(/sf-atc--icon/);
    await expect(pdpAtc.locator('svg')).toBeVisible();

    await page.goto('/demo/shop/bl-product-shave-cream', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);
    await expect(page.getByRole('heading', { name: /shave cream/i })).toBeVisible();
    await expect(page.locator('.sf-pdp-hero img.sf-media-img')).toBeVisible();
    await expect(page.locator('.sf-pdp-hero .sf-media--fallback')).toHaveCount(0);
    await page.getByRole('button', { name: 'Add to bag: Shave Cream' }).click();
    await expect(page.locator('[data-sf-cart-toast]')).toContainText('Shave Cream added to bag');
  });

  test('card media fills cover frame and Featured spotlight stays compact', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });

    const cardMedia = await page.evaluate(() => {
      const media = document.querySelector(
        '.sf-shop--blackline .sf-grid .sf-card-media--cover',
      ) as HTMLElement | null;
      const inner = media?.querySelector(':scope > .sf-media') as HTMLElement | null;
      const img = media?.querySelector('.sf-media-img') as HTMLElement | null;
      if (!media || !inner) return null;
      const mediaStyle = getComputedStyle(media);
      const innerStyle = getComputedStyle(inner);
      const imgStyle = img ? getComputedStyle(img) : null;
      const mediaBox = media.getBoundingClientRect();
      const innerBox = inner.getBoundingClientRect();
      return {
        mediaAspect: mediaStyle.aspectRatio,
        innerAspect: innerStyle.aspectRatio,
        imgFit: imgStyle?.objectFit ?? null,
        imgPadding: imgStyle?.padding ?? null,
        mediaWidth: Math.round(mediaBox.width),
        mediaHeight: Math.round(mediaBox.height),
        innerWidth: Math.round(innerBox.width),
        innerHeight: Math.round(innerBox.height),
        leftGap: Math.abs(innerBox.left - mediaBox.left),
        topGap: Math.abs(innerBox.top - mediaBox.top),
      };
    });

    expect(cardMedia).not.toBeNull();
    expect(cardMedia!.mediaAspect).toMatch(/1\s*\/\s*1/);
    expect(cardMedia!.innerAspect === 'auto' || cardMedia!.innerAspect === 'none').toBe(true);
    expect(cardMedia!.leftGap).toBeLessThanOrEqual(1);
    expect(cardMedia!.topGap).toBeLessThanOrEqual(1);
    expect(Math.abs(cardMedia!.innerWidth - cardMedia!.mediaWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(cardMedia!.innerHeight - cardMedia!.mediaHeight)).toBeLessThanOrEqual(1);
    if (cardMedia!.imgFit) {
      expect(cardMedia!.imgFit).toBe('cover');
      expect(cardMedia!.imgPadding).toBe('0px');
    }

    const featuredHeights: Array<{ width: number; height: number }> = [];
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      const metrics = await page.evaluate(() => {
        const root = document.querySelector(
          '.sf-shop--blackline .sf-spotlight--unified',
        ) as HTMLElement | null;
        const story = root?.querySelector(
          '.sf-spotlight-slide .sf-spotlight-story:not([aria-hidden="true"])',
        ) as HTMLElement | null;
        const media = story?.querySelector('.sf-featured-media') as HTMLElement | null;
        const copy = story?.querySelector('.sf-featured-copy') as HTMLElement | null;
        const progress = root?.querySelector(':scope > .sf-spotlight-progress') as HTMLElement | null;
        const product = story?.querySelector('.sf-featured-media-product') as HTMLElement | null;
        if (!story || !media || !copy || !progress) return null;
        const storyBox = story.getBoundingClientRect();
        const mediaBox = media.getBoundingClientRect();
        const copyBox = copy.getBoundingClientRect();
        const progressBox = progress.getBoundingClientRect();
        return {
          height: Math.round(storyBox.height),
          mediaHeight: Math.round(mediaBox.height),
          copyHeight: Math.round(copyBox.height),
          progressTop: Math.round(progressBox.top),
          storyBottom: Math.round(storyBox.bottom),
          mediaBottom: Math.round(mediaBox.bottom),
          progressWidth: Math.round(progressBox.width),
          storyWidth: Math.round(storyBox.width),
          copyWidth: Math.round(copyBox.width),
          productFit: product ? getComputedStyle(product).objectFit : null,
        };
      });
      expect(metrics).not.toBeNull();
      expect(metrics!.height).toBeGreaterThanOrEqual(360);
      expect(metrics!.height).toBeLessThanOrEqual(520);
      expect(Math.abs(metrics!.mediaHeight - metrics!.copyHeight)).toBeLessThanOrEqual(2);
      expect(metrics!.storyBottom - metrics!.mediaBottom).toBeLessThanOrEqual(2);
      expect(metrics!.storyBottom - metrics!.progressTop).toBeLessThanOrEqual(40);
      expect(metrics!.progressWidth).toBeGreaterThan(metrics!.copyWidth + 40);
      expect(Math.abs(metrics!.progressWidth - metrics!.storyWidth)).toBeLessThanOrEqual(56);
      expect(metrics!.productFit).toBe('cover');
      featuredHeights.push({ width, height: metrics!.height });
    }
    expect(featuredHeights).toHaveLength(3);
  });

  test('featured carousel covers product images and uses progress autoplay', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });

    const media = await page.evaluate(() => {
      const product = document.querySelector(
        '.sf-shop--blackline .sf-spotlight--unified .sf-featured-media-product',
      ) as HTMLElement | null;
      const ambient = document.querySelector(
        '.sf-shop--blackline .sf-spotlight--unified .sf-featured-media-ambient',
      );
      if (!product) return null;
      return {
        productFit: getComputedStyle(product).objectFit,
        productPadding: getComputedStyle(product).padding,
        ambientPresent: Boolean(ambient),
      };
    });
    expect(media).not.toBeNull();
    expect(media!.productFit).toBe('cover');
    expect(media!.productPadding).toBe('0px');
    expect(media!.ambientPresent).toBe(false);

    await expect(page.locator('.sf-spotlight-nav-btn')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Previous featured product|Next featured product/i })).toHaveCount(0);
    await expect(page.locator('.sf-spotlight--unified > .sf-spotlight-progress')).toHaveCount(1);
    await expect(page.locator('.sf-spotlight-progress-seg')).toHaveCount(4);
    await expect(page.getByRole('button', { name: /Pause featured products|Resume featured products/i })).toHaveCount(0);

    const track = page.locator('.sf-spotlight-track');
    const transitionProperty = await track.evaluate((el) => getComputedStyle(el).transitionProperty);
    expect(transitionProperty.split(',').map((part) => part.trim())).toEqual(['transform']);

    const activeStory = page.locator('.sf-spotlight-story:not([aria-hidden="true"])');
    await expect(activeStory).toBeVisible();
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('01 / 04');
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/ironclad pomade/i);
    const desktopBoxes = await activeStory.evaluate((story) => {
      const media = story.querySelector('.sf-featured-media') as HTMLElement | null;
      const name = story.querySelector('.sf-featured-name') as HTMLElement | null;
      return {
        storyHeight: story.getBoundingClientRect().height,
        mediaHeight: media?.getBoundingClientRect().height ?? 0,
        nameHeight: name?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(desktopBoxes.storyHeight).toBeGreaterThan(80);
    expect(desktopBoxes.mediaHeight).toBeGreaterThan(80);
    expect(desktopBoxes.nameHeight).toBeGreaterThan(16);

    const before = await track.evaluate((el) => getComputedStyle(el).transform);

    await page.getByRole('button', { name: /Show featured product 2 of 4: Beard Balm/i }).click();
    await expect.poll(async () => track.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/beard balm/i);
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('02 / 04');
    await expect(page.getByRole('button', { name: /Show featured product 2 of 4: Beard Balm/i })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await page.mouse.move(0, 0);
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);

    await expect(activeStory.locator('.sf-atc').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    // Keyboard activation of desktop progress segment
    await page.getByRole('button', { name: /Show featured product 3 of 4/i }).press('Enter');
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/barber wash/i);
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('03 / 04');
    await page.mouse.move(0, 0);

    await page.clock.install();

    // Leave hover so autoplay is armed, then restart timer under the fake clock
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: /Show featured product 2 of 4: Beard Balm/i }).click();
    await page.mouse.move(0, 0);

    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/barber wash/i);
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('03 / 04');
    await page.clock.fastForward(800);
    await page.mouse.move(0, 0);
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);

    // Focused ATC must not permanently pause autoplay
    await activeStory.locator('.sf-atc').first().focus();
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);
    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/essential styling set/i);
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('04 / 04');
    await page.clock.fastForward(800);
    await page.mouse.move(0, 0);

    // Loop last → first with complete content and stable progress
    await page.getByRole('button', { name: /Show featured product 4 of 4/i }).click();
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('04 / 04');
    await page.mouse.move(0, 0);
    await page.getByRole('button', { name: /Show featured product 4 of 4/i }).click();
    await page.mouse.move(0, 0);
    await expect(page.locator('.sf-spotlight--unified > .sf-spotlight-progress')).toHaveCount(1);
    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(/ironclad pomade/i);
    await expect(activeStory.locator('.sf-spotlight-index')).toContainText('01 / 04');
    await expect(page.locator('.sf-spotlight--unified > .sf-spotlight-progress')).toBeVisible();
    await page.clock.fastForward(800);
    await page.mouse.move(0, 0);

    // Hover pause freezes autoplay (fine pointer)
    await page.locator('.sf-spotlight--unified').hover();
    const pausedName = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(pausedName);
    await page.mouse.move(0, 0);

    // Panel background click must not permanently pause — re-arm a full cycle first
    await page.getByRole('button', { name: /Show featured product 1 of 4/i }).click();
    await page.mouse.move(0, 0);
    await activeStory.locator('.sf-spotlight-index').evaluate((node) => {
      if (node instanceof HTMLElement) node.click();
    });
    await page.mouse.move(0, 0);
    const afterBgClick = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).not.toHaveText(afterBgClick);
    await page.clock.fastForward(800);
    await page.mouse.move(0, 0);

    // Document hidden pauses progress fill
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.locator('.sf-spotlight-progress-fill.is-active')).toHaveClass(/is-paused/);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // Reduced motion: segment click still works
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.clock.resume();
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /Pause featured products|Resume featured products/i })).toHaveCount(0);
    const reducedName = await page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-featured-name').innerText();
    await page.getByRole('button', { name: /Show featured product 3 of 4/i }).click();
    await expect(page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-featured-name')).not.toHaveText(
      reducedName,
    );
    await expect(page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-atc').first()).toBeVisible();
  });

  test('featured mobile swipe, non-interactive progress, and autoplay resume', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);

    const root = page.locator('.sf-spotlight--unified');
    const activeStory = page.locator('.sf-spotlight-story:not([aria-hidden="true"])');
    await expect(activeStory).toBeVisible();
    await expect(root.locator(':scope > .sf-spotlight-progress')).toHaveCount(1);
    await expect(root.locator('.sf-spotlight-progress--static')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /Show featured product/i })).toHaveCount(0);
    const mobileBoxes = await activeStory.evaluate((story) => {
      const media = story.querySelector('.sf-featured-media') as HTMLElement | null;
      const name = story.querySelector('.sf-featured-name') as HTMLElement | null;
      return {
        storyHeight: story.getBoundingClientRect().height,
        mediaHeight: media?.getBoundingClientRect().height ?? 0,
        nameHeight: name?.getBoundingClientRect().height ?? 0,
      };
    });
    expect(mobileBoxes.storyHeight).toBeGreaterThan(80);
    expect(mobileBoxes.mediaHeight).toBeGreaterThan(80);
    expect(mobileBoxes.nameHeight).toBeGreaterThan(16);

    const nameBefore = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    const indexBefore = (await activeStory.locator('.sf-spotlight-index').textContent())?.trim() ?? '';
    await root.locator('.sf-spotlight-progress-seg').nth(2).click({ force: true });
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(nameBefore);
    await expect(activeStory.locator('.sf-spotlight-index')).toHaveText(indexBefore);

    const focusableProgress = await page.evaluate(() => {
      const segs = Array.from(document.querySelectorAll('.sf-spotlight--unified .sf-spotlight-progress-seg'));
      return segs.some((seg) => {
        if (!(seg instanceof HTMLElement)) return false;
        const tabIndex = seg.getAttribute('tabindex');
        return seg.tagName === 'BUTTON' || (tabIndex != null && Number(tabIndex) >= 0);
      });
    });
    expect(focusableProgress).toBe(false);

    const box = await root.boundingBox();
    expect(box).not.toBeNull();

    // Use touch events only — mouse hover on Chromium still matches (hover:hover) and (pointer:fine)
    await page.evaluate(() => {
      const target = document.querySelector('.sf-spotlight--unified') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const y = rect.top + rect.height * 0.35;
      const fire = (type: string, x: number) => {
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
            changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
          }),
        );
      };
      fire('touchstart', rect.left + rect.width * 0.85);
      fire('touchmove', rect.left + rect.width * 0.45);
      fire('touchend', rect.left + rect.width * 0.2);
    });
    await page.mouse.move(0, 0);

    await expect(activeStory.locator('.sf-featured-name')).not.toHaveText(nameBefore);
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);
    const afterSwipeName = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    const afterSwipeIndex = (await activeStory.locator('.sf-spotlight-index').textContent())?.trim() ?? '';
    const afterSwipeCategory = (await activeStory.locator('.sf-card-category').textContent())?.trim() ?? '';
    const afterSwipePrice = (await activeStory.locator('.sf-card-price').textContent())?.trim() ?? '';
    await expect(root.locator('.sf-spotlight-progress-fill.is-active')).toBeAttached();
    expect(afterSwipeIndex).toMatch(/\d{2}\s*\/\s*04/);

    // Mixed-product guard: active story fields stay coherent
    const coherent = await page.evaluate(() => {
      const story = document.querySelector(
        '.sf-spotlight-story:not([aria-hidden="true"])',
      ) as HTMLElement | null;
      if (!story) return null;
      return {
        name: story.querySelector('.sf-featured-name')?.textContent?.trim() ?? '',
        index: story.querySelector('.sf-spotlight-index')?.textContent?.trim() ?? '',
        category: story.querySelector('.sf-card-category')?.textContent?.trim() ?? '',
        price: story.querySelector('.sf-card-price')?.textContent?.trim() ?? '',
      };
    });
    expect(coherent).toEqual({
      name: afterSwipeName,
      index: afterSwipeIndex,
      category: afterSwipeCategory,
      price: afterSwipePrice,
    });

    // Clone slides keep counters visible
    const cloneCounters = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.sf-spotlight-slide .sf-spotlight-index')).map((node) =>
        node.textContent?.replace(/\s+/g, ' ').trim(),
      ),
    );
    expect(cloneCounters.length).toBeGreaterThanOrEqual(4);
    expect(cloneCounters.every((text) => /\d{2}\s*\/\s*04/.test(text ?? ''))).toBe(true);

    await page.clock.install();
    await page.mouse.move(0, 0);
    // Create a fresh autoplay timer under the fake clock
    await page.evaluate(() => {
      const target = document.querySelector('.sf-spotlight--unified') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const y = rect.top + rect.height * 0.35;
      const fire = (type: string, x: number) => {
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
            changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
          }),
        );
      };
      fire('touchstart', rect.left + rect.width * 0.85);
      fire('touchmove', rect.left + rect.width * 0.45);
      fire('touchend', rect.left + rect.width * 0.2);
    });
    await page.mouse.move(0, 0);
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);
    const armedName = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    await page.clock.fastForward(6000);
    await expect(activeStory.locator('.sf-featured-name')).not.toHaveText(armedName);
    await page.clock.fastForward(800);
    await page.mouse.move(0, 0);

    // Rapid spam should not double-skip; only one advance while locked
    await page.clock.resume();
    const settledName = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    await page.evaluate(() => {
      const target = document.querySelector('.sf-spotlight--unified') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const y = rect.top + rect.height * 0.35;
      const fire = (type: string, x: number) => {
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
            changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
          }),
        );
      };
      for (let i = 0; i < 4; i += 1) {
        fire('touchstart', rect.left + rect.width * 0.85);
        fire('touchmove', rect.left + rect.width * 0.45);
        fire('touchend', rect.left + rect.width * 0.2);
      }
    });
    await expect(activeStory.locator('.sf-featured-name')).not.toHaveText(settledName);
    const afterSpam = (await activeStory.locator('.sf-featured-name').textContent())?.trim() ?? '';
    await page.waitForTimeout(700);
    await expect(activeStory.locator('.sf-featured-name')).toHaveText(afterSpam);
  });

  test('featured progress autoplay ATC and landing rail stay isolated', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);
    await assertNoHorizontalOverflow(page);

    const featuredAtc = page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-atc').first();
    await featuredAtc.scrollIntoViewIfNeeded();
    await featuredAtc.evaluate((node) => {
      if (node instanceof HTMLButtonElement) node.click();
    });
    await expect(page.locator('[data-sf-cart-toast]')).toContainText(/added to bag/i);

    // ATC focus must not permanently pause autoplay
    await page.clock.install();
    await featuredAtc.focus();
    await page.mouse.move(0, 0);
    // Restart a full cycle under the fake clock via settled swipe
    await page.evaluate(() => {
      const target = document.querySelector('.sf-spotlight--unified') as HTMLElement | null;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const y = rect.top + rect.height * 0.35;
      const fire = (type: string, x: number) => {
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
            changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
          }),
        );
      };
      fire('touchstart', rect.left + rect.width * 0.85);
      fire('touchmove', rect.left + rect.width * 0.45);
      fire('touchend', rect.left + rect.width * 0.2);
    });
    await page.mouse.move(0, 0);
    await expect
      .poll(async () =>
        page.locator('.sf-spotlight-progress-fill.is-active').evaluate((el) => el.classList.contains('is-paused')),
      )
      .toBe(false);
    const nameAfterAtc = (await page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-featured-name').textContent())?.trim() ?? '';
    await featuredAtc.focus();
    await page.clock.fastForward(6000);
    await expect(page.locator('.sf-spotlight-story:not([aria-hidden="true"]) .sf-featured-name')).not.toHaveText(
      nameAfterAtc,
    );
    await page.clock.resume();

    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.bl-shop-rail [data-product-rail-root]')).toBeVisible();
    await expect(page.locator('.bl-shop-rail .sf-spotlight-progress')).toHaveCount(0);
  });

  test('compact discovery keeps one sticky row without search or shelf heading', async ({ page }) => {
    test.setTimeout(180_000);
    const viewports = [
      { width: 390, height: 844 },
      { width: 430, height: 932 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1280, height: 800 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 },
    ] as const;
    const heights: Array<{ width: number; height: number }> = [];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-sf-discovery-variant="compact"]')).toBeVisible();

      await expect(page.locator('[data-shop-search]')).toHaveCount(0);
      await expect(page.getByText(/shop the shelf/i)).toHaveCount(0);
      await expect(page.locator('.sf-toolbar-heading')).toHaveCount(0);
      await expect(page.locator('.sf-toolbar-count')).toHaveCount(0);
      await expect(page.locator('.sf-clear')).toHaveCount(0);
      await expect(page.locator('.sf-discovery-row')).toHaveCount(1);

      const metrics = await page.evaluate(() => {
        const root = document.querySelector('.sf-discovery--compact') as HTMLElement | null;
        const row = document.querySelector('.sf-discovery-row') as HTMLElement | null;
        const sort = document.querySelector('.sf-discovery-sort') as HTMLElement | null;
        const tabs = Array.from(
          document.querySelectorAll('.sf-discovery--compact .sf-rail-tab'),
        ) as HTMLElement[];
        if (!root || !row || !sort || tabs.length < 2) {
          return null;
        }
        const rootBox = root.getBoundingClientRect();
        const rowBox = row.getBoundingClientRect();
        const sortBox = sort.getBoundingClientRect();
        const tops = tabs.map((tab) => Math.round(tab.getBoundingClientRect().top));
        return {
          height: Math.round(rootBox.height),
          wrapped: !tops.every((top) => Math.abs(top - tops[0]!) <= 2),
          sortDropped: Math.abs(sortBox.top - rowBox.top) > 8,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics!.wrapped).toBe(false);
      expect(metrics!.sortDropped).toBe(false);
      expect(metrics!.height).toBeGreaterThanOrEqual(48);
      expect(metrics!.height).toBeLessThanOrEqual(72);
      expect(metrics!.scrollWidth).toBeLessThanOrEqual(metrics!.clientWidth + 1);
      heights.push({ width: viewport.width, height: metrics!.height });
    }

    expect(heights).toHaveLength(viewports.length);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop?q=pomade&category=STYLING', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-sf-discovery-variant="compact"]')).toBeVisible();
    await expect.poll(() => page.url()).toMatch(/category=STYLING/);
    await expect.poll(() => page.url()).not.toMatch(/[?&]q=/);
    await expect(page.locator('[data-shop-search]')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Styling' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('tab', { name: 'All products' }).click();
    await expect.poll(() => page.url()).not.toMatch(/category=/);
    const sort = page.locator('[data-shop-sort]');
    await expect(sort).toBeVisible();
    await sort.selectOption('price-asc');
    await expect.poll(() => page.url()).toMatch(/sort=price-asc/);
  });

  test('mobile grid, discovery, and compact cards stay two-column under 768px', async ({ page }) => {
    test.setTimeout(180_000);
    const phones = [320, 360, 375, 390, 430] as const;

    for (const width of phones) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      await waitForCartIsland(page);
      await assertNoHorizontalOverflow(page);

      const metrics = await page.evaluate(() => {
        const shop = document.querySelector('.sf-shop--blackline') as HTMLElement | null;
        const spotlight = document.querySelector(
          '.sf-shop--blackline .sf-spotlight--unified',
        ) as HTMLElement | null;
        const grid = document.querySelector('.sf-shop--blackline .sf-grid') as HTMLElement | null;
        const media = document.querySelector(
          '.sf-shop--blackline .sf-grid .sf-card-media--cover',
        ) as HTMLElement | null;
        const card = document.querySelector('.sf-shop--blackline .sf-grid .sf-card') as HTMLElement | null;
        const atc = document.querySelector(
          '.sf-shop--blackline .sf-grid .sf-atc[data-add-to-cart]',
        ) as HTMLElement | null;
        const prev = document.querySelector('.sf-category-carousel__prev') as HTMLElement | null;
        const next = document.querySelector('.sf-category-carousel__next') as HTMLElement | null;
        const sortIcon = document.querySelector('.sf-sort-icon') as HTMLElement | null;
        const sortSelect = document.querySelector('[data-shop-sort]') as HTMLSelectElement | null;
        const selected = document.querySelector(
          '.sf-discovery--compact .sf-rail-tab.is-selected',
        ) as HTMLElement | null;
        if (!shop || !spotlight || !grid || !media || !card || !atc || !sortSelect) return null;
        const gridStyle = getComputedStyle(grid);
        const mediaBox = media.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        const shopBox = shop.getBoundingClientRect();
        const spotlightBox = spotlight.getBoundingClientRect();
        const selectedBox = selected?.getBoundingClientRect();
        const after = document.querySelector('.sf-category-carousel') as HTMLElement | null;
        const afterStyle = after ? getComputedStyle(after, '::after') : null;
        const fullLabel = atc.querySelector('.sf-atc-label-full')?.textContent?.trim() ?? '';
        return {
          columns: gridStyle.gridTemplateColumns.split(' ').filter(Boolean).length,
          mediaAspect: getComputedStyle(media).aspectRatio,
          mediaWidth: mediaBox.width,
          mediaHeight: mediaBox.height,
          cardHeight: cardBox.height,
          atcFull: fullLabel,
          atcFullDisplay: atc.querySelector('.sf-atc-label-full')
            ? getComputedStyle(atc.querySelector('.sf-atc-label-full')!).display
            : null,
          atcShortDisplay: atc.querySelector('.sf-atc-label-short')
            ? getComputedStyle(atc.querySelector('.sf-atc-label-short')!).display
            : null,
          atcHasSvg: Boolean(atc.querySelector('svg')),
          atcAria: atc.getAttribute('aria-label'),
          prevDisplay: prev ? getComputedStyle(prev).display : 'none',
          nextDisplay: next ? getComputedStyle(next).display : 'none',
          sortIconDisplay: sortIcon ? getComputedStyle(sortIcon).display : 'none',
          sortOptions: Array.from(sortSelect.options).map((option) => option.value),
          sortAria: sortSelect.getAttribute('aria-label'),
          spotlightWider: spotlightBox.width > shopBox.width + 8,
          spotlightLeftGutter: Math.round(spotlightBox.left),
          spotlightRightGutter: Math.round(document.documentElement.clientWidth - spotlightBox.right),
          scrollY: Math.round(window.scrollY),
          shopNearFullBleed: Math.abs(shopBox.width - document.documentElement.clientWidth) <= 1,
          fadeCoversSelected:
            selectedBox && afterStyle
              ? afterStyle.opacity !== '0' &&
                Number.parseFloat(afterStyle.width || '0') > 8 &&
                selectedBox.right > (after?.getBoundingClientRect().right ?? 0) - 12
              : false,
        };
      });

      expect(metrics).not.toBeNull();
      expect(metrics!.columns).toBe(2);
      expect(metrics!.mediaAspect).toMatch(/4\s*\/\s*3/);
      expect(metrics!.mediaHeight).toBeLessThan(metrics!.mediaWidth * 0.9);
      expect(metrics!.cardHeight).toBeLessThan(420);
      expect(metrics!.atcFull).toBe('Add to bag');
      expect(metrics!.atcFullDisplay).not.toBe('none');
      expect(metrics!.atcShortDisplay).toBe('none');
      expect(metrics!.atcHasSvg).toBe(true);
      expect(metrics!.atcAria).toMatch(/add to bag/i);
      expect(metrics!.spotlightWider).toBe(false);
      expect(metrics!.shopNearFullBleed).toBe(true);
      expect(metrics!.spotlightLeftGutter).toBeGreaterThanOrEqual(3);
      expect(metrics!.spotlightLeftGutter).toBeLessThanOrEqual(6);
      expect(metrics!.spotlightRightGutter).toBeGreaterThanOrEqual(3);
      expect(metrics!.spotlightRightGutter).toBeLessThanOrEqual(6);
      expect(metrics!.scrollY).toBe(0);
      expect(metrics!.prevDisplay).toBe('none');
      expect(metrics!.nextDisplay).toBe('none');
      expect(metrics!.sortIconDisplay).toMatch(/flex|inline-flex/);
      expect(metrics!.sortOptions).toEqual(['recommended', 'price-asc', 'price-desc', 'name']);
      expect(metrics!.sortAria).toMatch(/Sort products\. Current sorting:/i);
      expect(metrics!.fadeCoversSelected).toBe(false);
      const recommendedVisible = await page.evaluate(() => {
        const sort = document.querySelector('.sf-discovery--compact [data-shop-sort]') as HTMLElement | null;
        const label = document.querySelector('.sf-discovery--compact .sf-sort-label') as HTMLElement | null;
        if (!sort || !label) return true;
        const sortStyle = getComputedStyle(sort);
        const labelStyle = getComputedStyle(label);
        const labelHidden =
          labelStyle.position === 'absolute' &&
          (labelStyle.width === '1px' || labelStyle.clipPath === 'rect(0px 0px 0px 0px)' || labelStyle.clip === 'rect(0px, 0px, 0px, 0px)');
        return !(labelHidden && Number.parseFloat(sortStyle.opacity || '1') < 0.05);
      });
      expect(recommendedVisible).toBe(false);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);
    await expect(page.locator('[data-sf-discovery-variant="compact"]')).toBeVisible();
    await expect.poll(async () => page.evaluate(() => Math.round(window.scrollY))).toBe(0);

    const footerTops = await page.evaluate(() => {
      const cards = Array.from(
        document.querySelectorAll('.sf-shop--blackline .sf-grid .sf-card'),
      ).slice(0, 2) as HTMLElement[];
      return cards.map((card) => {
        const footer = card.querySelector('.sf-card-footer') as HTMLElement | null;
        return footer ? Math.round(footer.getBoundingClientRect().top) : -1;
      });
    });
    expect(footerTops).toHaveLength(2);
    expect(Math.abs(footerTops[0]! - footerTops[1]!)).toBeLessThanOrEqual(2);

    await page.getByRole('button', { name: /Add to bag:/i }).first().click();
    await expect(page.locator('[data-sf-cart-toast]')).toContainText(/added to bag/i);

    const rail = page.locator('.sf-discovery--compact .sf-rail');
    await rail.evaluate((node) => {
      node.scrollLeft = node.scrollWidth;
    });
    await page.getByRole('tab', { name: 'Sets & Gifts' }).click();
    await expect(page.getByRole('tab', { name: 'Sets & Gifts' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);
    await assertNoHorizontalOverflow(page);

    const pdpMetrics = await page.evaluate(() => {
      const actions = document.querySelector('.sf-pdp-actions') as HTMLElement | null;
      const back = document.querySelector('.sf-pdp-back') as HTMLElement | null;
      const hero = document.querySelector('.sf-pdp-hero') as HTMLElement | null;
      const media = document.querySelector(
        '.sf-pdp-hero .sf-pdp-media--cover',
      ) as HTMLElement | null;
      const img = document.querySelector(
        '.sf-pdp-hero .sf-media-img',
      ) as HTMLElement | null;
      const relatedHeading = document.querySelector(
        '.sf-pdp-related .sf-toolbar-heading',
      ) as HTMLElement | null;
      const buttons = Array.from(
        document.querySelectorAll('.sf-pdp-actions .sf-atc'),
      ) as HTMLElement[];
      if (!actions || !back || !hero || buttons.length < 2) return null;
      const actionsBox = actions.getBoundingClientRect();
      const vw = document.documentElement.clientWidth;
      const widths = buttons.map((button) => Math.round(button.getBoundingClientRect().width));
      const railAtc = document.querySelector(
        '.sf-pdp-related .sf-atc[data-add-to-cart]',
      ) as HTMLElement | null;
      const mediaBox = media?.getBoundingClientRect();
      const imgBox = img?.getBoundingClientRect();
      return {
        leftGutter: Math.round(actionsBox.left),
        rightGutter: Math.round(vw - actionsBox.right),
        backLeft: Math.round(back.getBoundingClientRect().left),
        heroLeft: Math.round(hero.getBoundingClientRect().left),
        relatedLeft: relatedHeading ? Math.round(relatedHeading.getBoundingClientRect().left) : -1,
        widths,
        railLabel: railAtc?.querySelector('.sf-atc-label-full')?.textContent?.trim() ?? null,
        railHasSvg: Boolean(railAtc?.querySelector('svg')),
        railShortDisplay: railAtc?.querySelector('.sf-atc-label-short')
          ? getComputedStyle(railAtc.querySelector('.sf-atc-label-short')!).display
          : null,
        imgFit: img ? getComputedStyle(img).objectFit : null,
        mediaWidth: mediaBox ? Math.round(mediaBox.width) : null,
        imgWidth: imgBox ? Math.round(imgBox.width) : null,
      };
    });
    expect(pdpMetrics).not.toBeNull();
    expect(pdpMetrics!.backLeft).toBeGreaterThanOrEqual(16);
    expect(pdpMetrics!.heroLeft).toBeGreaterThanOrEqual(16);
    expect(pdpMetrics!.relatedLeft).toBeGreaterThanOrEqual(16);
    expect(Math.abs(pdpMetrics!.leftGutter - pdpMetrics!.rightGutter)).toBeLessThanOrEqual(1);
    expect(pdpMetrics!.widths[0]).toBe(pdpMetrics!.widths[1]);
    expect(pdpMetrics!.widths[0]).toBeGreaterThan(200);
    expect(pdpMetrics!.railLabel).toBe('Add to bag');
    expect(pdpMetrics!.railHasSvg).toBe(true);
    expect(pdpMetrics!.railShortDisplay).toBe('none');
    expect(pdpMetrics!.imgFit).toBe('cover');
    expect(pdpMetrics!.mediaWidth).not.toBeNull();
    expect(pdpMetrics!.imgWidth).not.toBeNull();
    expect(Math.abs(pdpMetrics!.mediaWidth! - pdpMetrics!.imgWidth!)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    const desktop = await page.evaluate(() => {
      const shop = document.querySelector('.sf-shop--blackline') as HTMLElement | null;
      const spotlight = document.querySelector(
        '.sf-shop--blackline .sf-spotlight--unified',
      ) as HTMLElement | null;
      const media = document.querySelector(
        '.sf-shop--blackline .sf-grid .sf-card-media--cover',
      ) as HTMLElement | null;
      const atc = document.querySelector(
        '.sf-shop--blackline .sf-grid .sf-atc[data-add-to-cart]',
      ) as HTMLElement | null;
      const sortIcon = document.querySelector('.sf-sort-icon') as HTMLElement | null;
      const sortSelect = document.querySelector('[data-shop-sort]') as HTMLSelectElement | null;
      const shopBox = shop?.getBoundingClientRect();
      const spotlightBox = spotlight?.getBoundingClientRect();
      return {
        mediaAspect: media ? getComputedStyle(media).aspectRatio : null,
        atcFullDisplay: atc?.querySelector('.sf-atc-label-full')
          ? getComputedStyle(atc.querySelector('.sf-atc-label-full')!).display
          : null,
        atcShortDisplay: atc?.querySelector('.sf-atc-label-short')
          ? getComputedStyle(atc.querySelector('.sf-atc-label-short')!).display
          : null,
        sortIconDisplay: sortIcon ? getComputedStyle(sortIcon).display : null,
        sortWidth: sortSelect ? sortSelect.getBoundingClientRect().width : 0,
        spotlightAligned:
          shopBox && spotlightBox
            ? Math.abs(spotlightBox.left - shopBox.left) <= 1 &&
              Math.abs(spotlightBox.right - shopBox.right) <= 1
            : false,
      };
    });
    expect(desktop.mediaAspect).toMatch(/1\s*\/\s*1/);
    expect(desktop.atcFullDisplay).not.toBe('none');
    expect(desktop.atcShortDisplay).toBe('none');
    expect(desktop.sortIconDisplay).toBe('none');
    expect(desktop.sortWidth).toBeGreaterThan(120);
    expect(desktop.spotlightAligned).toBe(true);
    await expect(page.locator('.sf-grid .sf-atc-label-full').first()).toContainText(/add to bag/i);
  });

  test('kersivo marketing shop uses a separate catalog from BLACKLINE', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/shop', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.sf-shop--kersivo')).toBeVisible();
    await expect(page.locator('.sf-shop--blackline')).toHaveCount(0);
    await expect(page.locator('[data-product-id^="bl-product-"]')).toHaveCount(0);
    await expect(page.locator('[data-product-id^="demo-product-"]').first()).toBeVisible();
  });

  test('category rail is keyboard reachable', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    const tab = page.getByRole('tab', { name: /all products/i });
    await expect(tab).toBeVisible();
    await tab.focus();
    await expect(tab).toBeFocused();
    await page.keyboard.press('Tab');
    const selected = page.locator('[role="tab"][aria-selected="true"]');
    await expect(selected).toHaveCount(1);
  });

  test('bag opens from the trigger, closes on Escape and backdrop, and restores focus', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await waitForCartIsland(page);

    const bagButton = page.locator('[data-bl-bag-button]');
    await bagButton.click();
    const dialog = page.getByRole('dialog', { name: /COLLECT IN SHOP/i });
    await expect(page.locator('.sf-cart.is-open')).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(page.locator('.sf-cart-close')).toBeFocused();
    await expect(page.getByText('YOUR BAG IS EMPTY')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(bagButton).toBeFocused();

    await bagButton.click();
    await expect(page.locator('.sf-cart.is-open')).toBeVisible();
    await page.locator('.sf-cart-backdrop').dispatchEvent('click');
    await expect(dialog).toHaveCount(0);
  });

  test('captures empty, one-item and multi-item bag screenshots', async ({ page }, testInfo) => {
    const capture = async (name: string) => {
      await page.screenshot({
        path: testInfo.outputPath(`${name}.png`),
        animations: 'disabled',
      });
    };

    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        for (const key of Object.keys(window.localStorage)) {
          if (key.includes('kersivo_shop_cart')) window.localStorage.removeItem(key);
        }
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await openBag(page);
      await capture(`cart-empty-${viewport.name}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /COLLECT IN SHOP/i })).toHaveCount(0);

      await page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-ironclad-pomade"]').click();
      await openBag(page);
      await expect(page.locator('[data-sf-cart-line] .sf-cart-line-name').filter({ hasText: 'Ironclad Pomade' })).toBeVisible();
      await capture(`cart-one-${viewport.name}`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: /COLLECT IN SHOP/i })).toHaveCount(0);

      await page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-matte-pomade"]').click();
      await openBag(page);
      await expect(page.getByRole('dialog', { name: /COLLECT IN SHOP/i })).toBeVisible();
      await expect(page.locator('[data-sf-cart-line] .sf-cart-line-name').filter({ hasText: 'Matte Pomade' })).toBeVisible();
      await capture(`cart-multi-${viewport.name}`);
    }
  });

  for (const width of [320, 375, 390, 430, 768, 1440] as const) {
    test(`open bag does not overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
      await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
      await waitForCartIsland(page);
      await page.locator('.sf-grid [data-add-to-cart][data-product-id="bl-product-ironclad-pomade"]').click();
      await openBag(page);
      await expect(page.getByRole('dialog', { name: /COLLECT IN SHOP/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  }

  test('reduced motion keeps the bag usable without transform travel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await openBag(page);
    const dialog = page.locator('.sf-cart.is-open');
    await expect(dialog).toBeVisible();
    const transform = await dialog.evaluate((node) => getComputedStyle(node).transform);
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true);
  });

  test('header keeps Shop current on PDP, books /demo/book, and opens the bag', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    const header = page.locator('[data-sf-header]');
    await expect(header).toBeVisible();
    await expect(header.locator('.sf-nav a', { hasText: 'Shop' })).toHaveAttribute('aria-current', 'page');
    const book = header.locator('.sf-header-cta');
    await expect(book).toHaveAttribute('href', '/demo/book');
    await expect(book).toContainText('BOOK NOW');
    await page.screenshot({ path: 'test-results/storefront-header-desktop.png', animations: 'disabled' });

    await page.evaluate(() => window.scrollTo(0, 480));
    await expect(header).toHaveAttribute('data-scrolled', '');
    await page.screenshot({ path: 'test-results/storefront-header-desktop-scrolled.png', animations: 'disabled' });

    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-sf-header] .sf-nav a', { hasText: 'Shop' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.locator('[data-bl-bag-button]').click();
    await expect(page.locator('.sf-cart.is-open')).toBeVisible();
  });

  test('PDP You may also like reuses ProductRail with storefront cards', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });

    const related = page.locator('section[aria-label="Related products"]');
    await expect(related.getByRole('heading', { name: 'You may also like' })).toBeVisible();

    const rail = related.locator('[data-product-rail-root]');
    await expect(rail).toBeVisible();
    await expect(related.locator('ul.sf-grid')).toHaveCount(0);
    await expect(rail.locator('.product-rail__item .sf-card')).toHaveCount(10);

    await expect(rail).toHaveAttribute('data-can-scroll-right', 'true');
    await expect(rail.locator('[data-product-rail-next]').first()).toBeEnabled();

    const track = rail.locator('[data-product-rail-track]');
    const fade = await track.evaluate((el) => {
      const style = getComputedStyle(el);
      return style.maskImage || style.webkitMaskImage || '';
    });
    expect(fade).toMatch(/linear-gradient/i);

    await rail.locator('[data-product-rail-next]').first().click();
    await expect(rail).toHaveAttribute('data-can-scroll-left', 'true');
  });

  test('PDP You may also like shows 2.5 cards on mobile only', async ({ page }) => {
    const mobileWidths = [320, 360, 375, 390, 430];

    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });

      const related = page.locator('section.sf-pdp-related');
      const rail = related.locator('[data-product-rail-root]');
      await expect(rail).toBeVisible();

      const metrics = await page.evaluate(() => {
        const section = document.querySelector('section.sf-pdp-related') as HTMLElement | null;
        const heading = section?.querySelector('.sf-toolbar-heading') as HTMLElement | null;
        const root = section?.querySelector('[data-product-rail-root]') as HTMLElement | null;
        const track = root?.querySelector('[data-product-rail-track]') as HTMLElement | null;
        const progress = root?.querySelector('.product-rail__progress') as HTMLElement | null;
        const nextBtn = root?.querySelector('[data-product-rail-next]') as HTMLElement | null;
        const atc = root?.querySelector('.sf-atc[data-add-to-cart]') as HTMLElement | null;
        const firstItem = track?.querySelector('.product-rail__item') as HTMLElement | null;
        if (!section || !heading || !root || !track || !atc || !firstItem) return null;
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
        const headingBox = heading.getBoundingClientRect();
        const progressBox = progress?.getBoundingClientRect();
        const nextBox = nextBtn?.getBoundingClientRect();
        const itemBox = firstItem.getBoundingClientRect();
        const vw = document.documentElement.clientWidth;
        return {
          token: getComputedStyle(root).getPropertyValue('--product-rail-visible-cards').trim(),
          railPadding: getComputedStyle(root).getPropertyValue('--product-rail-padding').trim(),
          headingLeft: Math.round(headingBox.left),
          trackLeft: Math.round(trackRect.left),
          firstCardLeft: Math.round(itemBox.left),
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
      expect(metrics!.headingLeft).toBeGreaterThan(4);
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
    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    const tablet = await page.evaluate(() => {
      const root = document.querySelector(
        'section.sf-pdp-related [data-product-rail-root]',
      ) as HTMLElement | null;
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

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/demo/shop/bl-product-ironclad-pomade', { waitUntil: 'domcontentloaded' });
    const desktopToken = await page
      .locator('section.sf-pdp-related [data-product-rail-root]')
      .evaluate((root) => getComputedStyle(root).getPropertyValue('--product-rail-visible-cards').trim());
    expect(desktopToken).toBe('3.25');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo', { waitUntil: 'domcontentloaded' });
    const homeRailToken = await page
      .locator('.bl-shop-rail [data-product-rail-root]')
      .evaluate((root) => getComputedStyle(root).getPropertyValue('--product-rail-visible-cards').trim());
    expect(homeRailToken).toBe('2.5');
  });

  test('mobile header shows bag, hides BOOK at 320px, and keeps booking in the menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    const header = page.locator('[data-sf-header]');
    await expect(header.locator('[data-bl-bag-button]')).toBeVisible();
    await expect(header.locator('.sf-header-cta-short')).toBeVisible();
    await expect(header.locator('.sf-nav-toggle')).toBeVisible();
    await page.screenshot({ path: 'test-results/storefront-header-mobile.png', animations: 'disabled' });

    await page.setViewportSize({ width: 320, height: 568 });
    await expect(header.locator('.sf-header-cta')).toBeHidden();
    await expect(header.locator('[data-bl-bag-button]')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, 420));
    await header.locator('.sf-nav-toggle').click();
    await expect(page.locator('[data-bl-nav-book]')).toBeVisible();
    await expect(page.locator('[data-bl-nav-book]')).toHaveAttribute('href', '/demo/book');
    await expect(header).toHaveAttribute('data-sf-nav-state', 'open');

    const chrome = await page.evaluate(() => {
      const headerEl = document.querySelector('[data-sf-header]') as HTMLElement | null;
      const inner = document.querySelector('.sf-header-inner') as HTMLElement | null;
      const toggle = document.querySelector('[data-sf-nav-toggle]') as HTMLElement | null;
      const overlay = document.querySelector('[data-sf-nav-panel]') as HTMLElement | null;
      if (!headerEl || !inner || !toggle || !overlay) return null;
      const headerBox = headerEl.getBoundingClientRect();
      const overlayBox = overlay.getBoundingClientRect();
      return {
        headerTop: Math.round(headerBox.top),
        headerBottom: Math.round(headerBox.bottom),
        overlayTop: Math.round(overlayBox.top),
        toggleVisible: toggle.getClientRects().length > 0,
        position: getComputedStyle(headerEl).position,
        clipPath: getComputedStyle(overlay).clipPath,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(chrome).not.toBeNull();
    expect(chrome!.headerTop).toBeLessThanOrEqual(1);
    expect(chrome!.position).toBe('fixed');
    expect(chrome!.toggleVisible).toBe(true);
    expect(chrome!.overlayTop).toBeGreaterThanOrEqual(chrome!.headerBottom - 1);
    expect(chrome!.clipPath === 'none' || chrome!.clipPath === '').toBe(true);
    expect(chrome!.scrollWidth).toBeLessThanOrEqual(chrome!.clientWidth + 1);
    await expect(page.locator('[data-sf-nav-panel]')).toBeVisible();
    await expect(header.locator('.sf-nav-toggle')).toBeVisible();
  });

  test('reduced motion opens the overlay without clip travel', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/demo/shop', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-sf-nav-toggle]').click();
    const overlay = page.locator('[data-sf-nav-panel]');
    await expect(overlay).toBeVisible();
    await expect(page.locator('[data-sf-header]')).toHaveAttribute('data-sf-nav-state', 'open');
    const clip = await overlay.evaluate((node) => getComputedStyle(node).clipPath);
    expect(clip === 'none' || clip === '').toBe(true);
  });
});
