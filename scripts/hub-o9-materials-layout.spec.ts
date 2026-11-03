/**
 * Hub O9: Materials ("Add to your website") layout. One logo in the Logo card (earlier logos collapsed), the same
 * header anatomy on every card (title + status pill + one hint line), sticky jump chips with aria-current, a
 * two-column grid at ≥1024 px, ?item= still scrolls to and highlights the right card, no horizontal scroll, axe
 * clean, no layout shift inside the app while it opens.
 *
 * O9_BEFORE=1 only records screenshots and findings (for main); without it every assertion runs.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PrismaClient, Prisma } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const shotDir =
  process.platform === "win32" ? "C:/tmp/kersivo-shots/hub-o9" : "/tmp/kersivo-shots/hub-o9";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error("hub-o9 QA must use a local database");

const BEFORE = Boolean(process.env.O9_BEFORE);
const PHASE = BEFORE ? "before" : "after";
const WIDTHS = [375, 768, 1024, 1440] as const;
const ORDER = ["photos", "logo", "text", "price-list", "other"];

type Seed = { ready: { id: string; token: string } };
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const jpeg = (fill: string, label: string) =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="${fill}"/>
      <text x="400" y="320" font-family="Arial" font-weight="700" font-size="72" fill="#fff" text-anchor="middle">${label}</text></svg>`),
  )
    .jpeg({ quality: 85 })
    .toBuffer();

const wordmark = (fill: string, label: string) =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="200">
      <rect x="10" y="10" width="580" height="180" rx="24" fill="${fill}"/>
      <text x="300" y="125" font-family="Arial" font-weight="700" font-size="84" fill="#fff" text-anchor="middle">${label}</text></svg>`),
  )
    .png()
    .toBuffer();

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === "ks_hub");
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function upload(page: Page, kind: string, name: string, mimeType: string, buffer: Buffer): Promise<string> {
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.post("/api/admin-hub/assets", {
    headers: await hubHeaders(page),
    multipart: { kind, file: { name, mimeType, buffer } },
  });
  expect(res.ok(), `upload ${name} ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { asset?: { id: string } };
  return body.asset!.id;
}

type Ids = { oldLogo: string; logo: string };

/** Ready request, brand not sent: 2 shop photos, 2 logos (old, then current), 1 price list, no other files. */
async function seedAssets(page: Page): Promise<Ids> {
  await prisma.previewRequest.update({
    where: { id: seed.ready.id },
    data: { brandColoursSentAt: null, brandSubmittedSnapshot: Prisma.DbNull },
  });
  const res = await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string; kind: string }> };
  for (const asset of assets.filter((row) => ["SHOP_PHOTO", "TEAM_PHOTO", "LOGO", "PRICE_LIST", "OTHER"].includes(row.kind))) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
  await upload(page, "SHOP_PHOTO", "front.jpg", "image/jpeg", await jpeg("#2b2b30", "SHOP 1"));
  await upload(page, "SHOP_PHOTO", "chairs.jpg", "image/jpeg", await jpeg("#3a2a2a", "SHOP 2"));
  const oldLogo = await upload(page, "LOGO", "old-logo.png", "image/png", await wordmark("#3355aa", "OLD CUTS"));
  await page.waitForTimeout(50);
  const logo = await upload(page, "LOGO", "fade-studio-logo.png", "image/png", await wordmark("#b0122a", "FADE STUDIO"));
  await upload(page, "PRICE_LIST", "prices.jpg", "image/jpeg", await jpeg("#222", "£ PRICES"));
  return { oldLogo, logo };
}

const CLS_INIT = () => {
  const w = window as unknown as { __cls: number };
  w.__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<
      PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }
    >) {
      if (entry.hadRecentInput) continue;
      const els = (entry.sources ?? []).map((source) =>
        source.node instanceof Element ? source.node : (source.node?.parentElement ?? null),
      );
      const app = '[data-testid="admin-hub-app"] .admin-hub-app__body';
      // Shifts that started inside the app body (not the app window animating in).
      if (els.some((el) => el?.closest(app))) w.__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("img")).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
  await page.waitForTimeout(400);
}

async function openMaterials(page: Page, item?: string) {
  await page.goto(`/admin?app=materials${item ? `&item=${item}` : ""}`);
  const app = page.getByTestId("admin-hub-app");
  await expect(app).toHaveAttribute("data-app", "materials", { timeout: 60000 });
  await expect(app.locator("#photos")).toBeVisible();
  await settle(page);
  return app;
}

async function bodyOf(app: Locator) {
  return app.locator(".admin-hub-app__body");
}

/** Scrolls only the app body so `el` sits `offset` px below its top (scrollIntoView would move the window too). */
const scrollInBody = (el: Locator, offset: number) =>
  el.evaluate((node, off) => {
    const body = node.closest(".admin-hub-app__body") as HTMLElement;
    body.scrollTop += node.getBoundingClientRect().top - body.getBoundingClientRect().top - off;
  }, offset);

/** The app window's title bar is fully inside the window (nothing scrolled the window's own box). */
const barInView = (app: Locator) =>
  app.evaluate((root) => {
    const bar = root.querySelector(".admin-hub-app__bar")!.getBoundingClientRect();
    return bar.top >= root.getBoundingClientRect().top - 1 && root.scrollTop === 0;
  });

const visibleImgs = (card: Locator) =>
  card.evaluate((root) =>
    Array.from(root.querySelectorAll("img")).filter((img) => {
      const r = img.getBoundingClientRect();
      return img.checkVisibility() && r.width > 0 && r.height > 0;
    }).length,
  );

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o9] findings (${PHASE})\n${findings.join("\n")}`);
  await prisma.$disconnect();
});

test("materials layout: one logo, same card anatomy, sticky chips, two columns", async ({ browser }) => {
  const context = await browser.newContext();
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    if (!String(err).includes("Transition was aborted")) errors.push(String(err));
  });
  page.on("response", (res) => {
    if (res.status() >= 500 && !new URL(res.url()).pathname.startsWith("/@")) errors.push(`${res.status()} ${res.url()}`);
  });
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page.locator(".admin-shell")).toBeVisible({ timeout: 90000 });
  const ids = await seedAssets(page);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    const app = await openMaterials(page);
    const body = await bodyOf(app);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    const logoCard = app.locator("#logo");
    const logoImgs = await visibleImgs(logoCard);
    const order = await app.locator("section.hub-card[id]").evaluateAll((els) => els.map((el) => el.id));
    findings.push(`${width}px: order ${order.join(",")} | logo card imgs ${logoImgs} | app CLS ${cls.toFixed(4)}`);
    await page.screenshot({ path: join(shotDir, `${PHASE}-materials-top-${width}.png`) });
    await scrollInBody(logoCard, 0);
    await page.waitForTimeout(200);
    await page.screenshot({ path: join(shotDir, `${PHASE}-materials-logo-${width}.png`) });
    await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(shotDir, `${PHASE}-materials-bottom-${width}.png`) });

    if (!BEFORE) {
      expect(order, `${width}px: card order`).toEqual(ORDER);
      expect(cls, `${width}px: no layout shift inside the app`).toBeLessThan(0.01);

      // One logo; earlier logos collapsed and without the current one.
      await body.evaluate((el) => el.scrollTo(0, 0));
      expect(logoImgs, `${width}px: one logo img in the Logo card`).toBe(1);
      await expect(logoCard.getByRole("heading", { level: 2, name: "Logo" })).toBeVisible();
      await expect(logoCard.locator(`img[src*="${ids.logo}"]`)).toHaveCount(1);
      await expect(logoCard.getByText("fade-studio-logo.png")).toBeVisible();
      const earlier = logoCard.locator("details.hub-earlier");
      await expect(earlier).not.toHaveAttribute("open", /.*/);
      await expect(earlier.locator("summary")).toHaveText(/Earlier logos \(1\)/);
      await expect(logoCard.locator(".hub-swatch")).toHaveCount(0);
      await expect(logoCard.getByRole("link", { name: /Brand colours/ })).toHaveAttribute("href", "/admin?app=colours");
      await earlier.locator("summary").click();
      await expect(earlier.locator(`img[src*="${ids.oldLogo}"]`)).toBeVisible();
      await expect(earlier.locator(`img[src*="${ids.logo}"]`)).toHaveCount(0);
      if (width === 375 || width === 1440) {
        await scrollInBody(earlier, 200);
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(shotDir, `${PHASE}-materials-earlier-logos-${width}.png`) });
      }
      await earlier.locator("summary").click();
      await expect(earlier).not.toHaveAttribute("open", /.*/);

      // Same anatomy on every card.
      for (const id of ORDER) {
        const card = app.locator(`#${id}`);
        await expect(card.locator(".hub-card__head h2"), `${id} title`).toHaveCount(1);
        await expect(card.locator(".hub-card__head .hub-status"), `${id} status`).toHaveCount(1);
        await expect(card.locator(":scope > .hub-card__hint"), `${id} hint`).toHaveCount(1);
      }
      await expect(app.locator("#photos .hub-status")).toHaveText("2 added");
      await expect(app.locator("#logo .hub-status")).toHaveText("Added");
      await expect(app.locator("#other .hub-status")).toHaveText("Not added yet");
      await expect(app.locator("#other .hub-empty")).toHaveCount(1);

      // Columns.
      const boxes = await app.evaluate((root) => {
        const r = (id: string) => root.querySelector(`#${id}`)!.getBoundingClientRect();
        return { photos: r("photos").toJSON(), logo: r("logo").toJSON(), text: r("text").toJSON() };
      });
      if (width >= 1024) {
        expect(boxes.logo.left, `${width}px: Logo in the right column`).toBeGreaterThan(boxes.photos.right - 1);
        expect(Math.abs(boxes.logo.top - boxes.photos.top), `${width}px: columns start together`).toBeLessThan(2);
        expect(boxes.text.top).toBeGreaterThan(boxes.logo.bottom - 1);
      } else {
        expect(boxes.logo.top, `${width}px: one column`).toBeGreaterThan(boxes.photos.bottom - 1);
      }

      // Sticky chips with aria-current following the scroll.
      const nav = app.getByTestId("hub-jump");
      await body.evaluate((el) => el.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await expect(nav.locator('[aria-current="true"]')).toHaveText(/Photos/);
      await body.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(500);
      const sticky = await app.evaluate((root) => {
        const b = root.querySelector(".admin-hub-app__body")!.getBoundingClientRect();
        const n = root.querySelector('[data-testid="hub-jump"]')!.getBoundingClientRect();
        return { delta: n.top - b.top, visible: n.bottom > b.top && n.top < b.bottom };
      });
      expect(sticky.visible, `${width}px: chips stay visible`).toBe(true);
      expect(Math.abs(sticky.delta), `${width}px: chips pinned to the body top`).toBeLessThan(4);
      const current = await nav.locator('[aria-current="true"]').textContent();
      findings.push(`${width}px: chip in view after scrolling down: ${current}`);
      expect(current, `${width}px: aria-current moved`).not.toMatch(/Photos/);
      expect(await nav.evaluate((el) => getComputedStyle(el).scrollbarWidth)).toBe("none");

      // Keyboard: the chip moves focus to the section heading.
      await nav.getByRole("button", { name: /Price list/ }).focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(600);
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("hub-price-title");
      await expect(nav.locator('[aria-current="true"]')).toHaveText(/Price list/);
      expect(await barInView(app), `${width}px: chip jump keeps the app title bar in view`).toBe(true);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(scrollWidth, `${width}px: no horizontal scroll`).toBeLessThanOrEqual(0);
      const axe = await new AxeBuilder({ page })
        .include('[data-testid="admin-hub-app"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `axe materials ${width}px`).toEqual([]);
    }

    // ?item=price-list scrolls to Price list and briefly highlights it.
    await page.goto("/admin?app=materials&item=price-list");
    const deep = page.getByTestId("admin-hub-app");
    await expect(deep).toHaveAttribute("data-app", "materials", { timeout: 60000 });
    if (!BEFORE) await expect(deep.locator("#price-list")).toHaveClass(/is-hub-add-target/);
    await page.waitForTimeout(900);
    const target = await deep.evaluate((root) => {
      const b = root.querySelector(".admin-hub-app__body")!.getBoundingClientRect();
      const card = root.querySelector("#price-list")!;
      const r = card.getBoundingClientRect();
      return { offset: Math.round(r.top - b.top), highlighted: card.classList.contains("is-hub-add-target") };
    });
    findings.push(`${width}px: ?item=price-list → offset ${target.offset}px highlighted ${target.highlighted}`);
    await page.screenshot({ path: join(shotDir, `${PHASE}-materials-item-price-list-${width}.png`) });
    const bar = await barInView(deep);
    findings.push(`${width}px: ?item=price-list keeps the title bar in view: ${bar}`);
    if (!BEFORE) {
      expect(bar, `${width}px: ?item= keeps the app title bar in view`).toBe(true);
      expect(target.offset, `${width}px: price list near the top, below the chips`).toBeGreaterThanOrEqual(50);
      expect(target.offset).toBeLessThan(90);
      await expect(deep.getByTestId("hub-jump").locator('[aria-current="true"]')).toHaveText(/Price list/);
    }
  }

  expect(errors, "no page errors / 5xx").toEqual([]);
  await context.close();
});
