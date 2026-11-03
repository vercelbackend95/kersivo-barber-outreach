/**
 * Hub O5: Brand colours app polish. Saved draft opens without re-extraction flicker; swatches, swap, no accent,
 * contrast fix, save draft, edit then close (auto-draft + toast) → reopen → persisted; send → read-only summary;
 * the Overview tile shows Sent without a reload. Layout matrix over the colour fixtures + a wide wordmark at
 * 375 / 390 / 768 / 1024 / 1440, axe at 390 / 1440, no console errors.
 *
 * O5_BEFORE=1 only takes the before shots (run it against main).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
  blackAndWhiteLogo,
  gradientLogo,
  transparentPng,
  twoColourLogo,
  verySmallLogo,
} from "../src/lib/adminHub/colour/fixtures";
import type { RgbaImage } from "../src/lib/adminHub/colour/types";

const BEFORE = Boolean(process.env.O5_BEFORE);
const shotDir =
  process.platform === "win32"
    ? "C:/tmp/kersivo-shots/hub-o5-colours-app"
    : "/tmp/kersivo-shots/hub-o5-colours-app";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL ||
  "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL))
  throw new Error("hub-o5 QA must use a local database");

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
type Seed = { requested: { id: string; token: string } };
let seed: Seed;

const fixturePng = (image: RgbaImage, scale: number) =>
  sharp(Buffer.from(image.data), {
    raw: { width: image.width, height: image.height, channels: 4 },
  })
    .resize(image.width * scale, image.height * scale, { kernel: "nearest" })
    .png()
    .toBuffer();
const svgPng = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();

const LOGOS: Record<string, () => Promise<Buffer>> = {
  "two-colour": () => fixturePng(twoColourLogo(), 4),
  "black-and-white": () => fixturePng(blackAndWhiteLogo(), 8),
  transparent: () => fixturePng(transparentPng(), 8),
  gradient: () => fixturePng(gradientLogo(), 8),
  "very-small": () => fixturePng(verySmallLogo(), 1),
  "wide-wordmark": () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="200">
      <rect x="2" y="2" width="1596" height="196" fill="none" stroke="#C9A24A" stroke-width="4"/>
      <text x="800" y="132" font-family="Arial" font-weight="700" font-size="96" fill="#8A2D2D" text-anchor="middle" letter-spacing="6">FADE ROOM BARBERS</text></svg>`),
};

const PALETTE = [
  { hex: "#1F6F6B", share: 0.42 },
  { hex: "#C9A24A", share: 0.28 },
  { hex: "#141414", share: 0.18 },
  { hex: "#F2E8D5", share: 0.12 },
];

type Brand = {
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandBackgroundTone?: "DARK" | "LIGHT" | null;
  brandColoursSource?: "LOGO" | "MANUAL" | "KERSIVO_CHOOSES" | null;
  brandPaletteExtracted?: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt?: Date | null;
  /** Set the palette's logo id to the uploaded logo. */
  paletteFromLogo?: boolean;
};

const DRAFT: Brand = {
  brandPrimaryColour: "#1F6F6B",
  brandSecondaryColour: "#C9A24A",
  brandBackgroundTone: "DARK",
  brandColoursSource: "LOGO",
  brandPaletteExtracted: PALETTE,
  paletteFromLogo: true,
};

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === "ks_hub");
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function applyScenario(page: Page, logo: string | null, brand: Brand) {
  await prisma.rateLimitEvent.deleteMany({});
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: {
      brandPrimaryColour: null,
      brandSecondaryColour: null,
      brandBackgroundTone: null,
      brandColoursSource: null,
      brandPaletteExtracted: Prisma.DbNull,
      brandColoursSentAt: null,
      brandSubmittedSnapshot: Prisma.DbNull,
    },
  });
  const res = await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string; kind: string }> };
  for (const asset of assets.filter((row) => row.kind === "LOGO")) {
    deletedLogos.add(asset.id);
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, {
      headers: await hubHeaders(page),
    });
  }
  let logoId: string | null = null;
  if (logo) {
    const up = await page.request.post("/api/admin-hub/assets", {
      headers: await hubHeaders(page),
      multipart: {
        kind: "LOGO",
        file: { name: `logo-${logo}.png`, mimeType: "image/png", buffer: await LOGOS[logo]!() },
      },
    });
    expect(up.ok(), `logo upload ${up.status()}`).toBeTruthy();
    const after = await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) });
    const list = ((await after.json()) as { assets?: Array<{ id: string; kind: string }> }).assets ?? [];
    logoId = list.find((row) => row.kind === "LOGO")?.id ?? null;
  }
  const data: Record<string, unknown> = {
    brandPrimaryColour: brand.brandPrimaryColour ?? null,
    brandSecondaryColour: brand.brandSecondaryColour ?? null,
    brandBackgroundTone: brand.brandBackgroundTone ?? null,
    brandColoursSource: brand.brandColoursSource ?? null,
    brandPaletteExtracted: brand.brandPaletteExtracted ?? Prisma.DbNull,
    brandColoursSentAt: brand.brandColoursSentAt ?? null,
  };
  // The O5 column (absent on main for the before shots).
  if (!BEFORE) data.brandPaletteLogoAssetId = brand.paletteFromLogo ? logoId : null;
  await prisma.previewRequest.update({ where: { id: seed.requested.id }, data });
  return logoId;
}

const INIT = () => {
  const w = window as unknown as { __skel: number; __errors: string[] };
  w.__skel = 0;
  // Init scripts run before <html> exists: observe the document itself.
  new MutationObserver(() => {
    if (document.querySelector('[data-testid="admin-hub-colours"] .hub-skel')) w.__skel += 1;
  }).observe(document, { childList: true, subtree: true });
};

const consoleErrors: string[] = [];
/** Logos this spec deletes between scenarios: an open page may still request their thumb (404). */
const deletedLogos = new Set<string>();
/** Dev-server-only noise: Astro's dev toolbar while Vite re-optimises deps. Not shipped to production. */
const DEV_ONLY = /Outdated Optimize Dep\) http:\/\/127\.0\.0\.1:4397\/@id\/astro\/runtime\/client\/dev-toolbar\//;

function ignorable(line: string): boolean {
  if (DEV_ONLY.test(line)) return true;
  const asset = /404 \(Not Found\) \S*\/api\/admin-hub\/assets\/([^?\s]+)/.exec(line);
  return Boolean(asset && deletedLogos.has(asset[1]!));
}

async function stagePage(browser: Browser, width: number) {
  const context = await browser.newContext({ viewport: { width, height: width < 768 ? 812 : 900 } });
  await context.addInitScript(INIT);
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`${page.url()} :: ${msg.text()} ${msg.location().url ?? ""}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`${page.url()} :: pageerror ${err.message}`));
  await page.goto(`/preview/${seed.requested.token}`);
  await expect(page.locator(".admin-shell")).toBeVisible();
  return page;
}

async function openOverview(page: Page) {
  await page.goto("/admin");
  await expect(page.getByTestId("admin-hub-overview")).toBeVisible();
  await page.waitForLoadState("networkidle");
  return page.locator('a[data-tile="colours"]');
}

async function openApp(page: Page) {
  const tile = page.locator('a[data-tile="colours"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  const app = page.getByTestId("admin-hub-app");
  await expect(app).toBeVisible();
  await expect(app.getByTestId("admin-hub-colours")).toBeVisible();
  return app;
}

async function closeApp(page: Page) {
  const app = page.getByTestId("admin-hub-app");
  await app.getByRole("button", { name: "Close" }).first().click();
  await expect(app).toHaveCount(0);
}

async function axe(page: Page, label: string) {
  const result = await new AxeBuilder({ page })
    .include('[data-testid="admin-hub-app"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`),
    `axe ${label}`,
  ).toEqual([]);
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o5] findings\n${findings.join("\n")}`);
  console.log(`[hub-o5] console errors: ${consoleErrors.length}\n${consoleErrors.join("\n")}`);
  await prisma.$disconnect();
});

test("before shots (main)", async ({ browser }) => {
  test.skip(!BEFORE, "only with O5_BEFORE=1");
  const states: Array<[string, string | null, Brand]> = [
    ["draft", "two-colour", DRAFT],
    ["no-main", "black-and-white", {}],
    ["sent", "two-colour", { ...DRAFT, brandColoursSentAt: new Date("2026-11-02T10:00:00.000Z") }],
  ];
  for (const width of [375, 1440]) {
    const page = await stagePage(browser, width);
    for (const [name, logo, brand] of states) {
      await applyScenario(page, logo, brand);
      await openOverview(page);
      await openApp(page);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(shotDir, `before-${name}-${width}.png`) });
      await closeApp(page);
    }
    await page.context().close();
  }
});

test("saved draft: no re-extraction flicker; full desktop flow to Sent", async ({ browser }) => {
  test.skip(BEFORE);
  const page = await stagePage(browser, 1440);
  await applyScenario(page, "two-colour", DRAFT);
  const tile = await openOverview(page);
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const app = await openApp(page);

  // Saved palette shows at once, never a skeleton, no "Find colours again" for the same logo.
  await expect(app.locator(".admin-hub-extract__row")).toHaveCount(4);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => (window as unknown as { __skel: number }).__skel), "skeleton never shown").toBe(0);
  await expect(app.getByRole("button", { name: "Find colours again" })).toHaveCount(0);
  await expect(app.getByTestId("admin-hub-colours-contrast")).toHaveCount(1);
  await page.screenshot({ path: join(shotDir, "after-draft-1440.png") });
  await axe(page, "editor @1440");

  // Accent → cream, swap, no accent.
  await app.getByTestId("admin-hub-role-accent").click();
  await app.getByTestId("admin-hub-swatch-F2E8D5").click();
  await expect(app.getByTestId("admin-hub-role-accent")).toContainText("#F2E8D5");
  await app.getByRole("button", { name: "Swap main and accent" }).click();
  await expect(app.getByTestId("admin-hub-role-main")).toContainText("#F2E8D5");
  await expect(app.getByTestId("admin-hub-role-accent")).toContainText("#1F6F6B");
  await app.getByRole("button", { name: "No accent" }).click();
  await expect(app.getByTestId("admin-hub-role-accent")).toContainText("Not set");
  await expect(app.locator('[data-line="button"]')).toHaveCount(0);

  // Light background makes cream Main unreadable → fix it.
  await app.getByRole("button", { name: "Light", exact: true }).click();
  await expect(app.locator('[data-line="main"]')).toHaveAttribute("data-pass", "false");
  await page.screenshot({ path: join(shotDir, "after-contrast-fail-1440.png") });
  await app.getByRole("button", { name: "Make main deeper" }).click();
  await expect(app.locator('[data-line="main"]')).toHaveAttribute("data-pass", "true");
  const fixedMain = ((await app.getByTestId("admin-hub-role-main").locator(".admin-hub-role__hex").textContent()) ?? "").trim();
  expect(fixedMain).toMatch(/^#[0-9A-F]{6}$/);

  // Save draft → Saved; an edit → Save draft again.
  await app.getByRole("button", { name: "Save draft" }).click();
  await expect(app.getByRole("button", { name: "Saved" })).toBeVisible({ timeout: 20000 });
  await app.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(app.getByRole("button", { name: "Save draft" })).toBeVisible();

  // Close with the unsaved edit → auto draft + toast; tile refreshes.
  await closeApp(page);
  await expect(page.getByTestId("admin-hub-toast")).toHaveText("Draft saved", { timeout: 20000 });
  await page.screenshot({ path: join(shotDir, "after-autosave-toast-1440.png") });
  await expect(tile).toHaveAttribute("data-state", "draft");
  const row = await prisma.previewRequest.findUniqueOrThrow({ where: { id: seed.requested.id } });
  expect(row.brandBackgroundTone).toBe("DARK");
  expect(row.brandPrimaryColour).toBe(fixedMain);
  expect(row.brandSecondaryColour).toBeNull();
  expect(row.brandColoursSentAt, "auto-save never sends").toBeNull();

  // Reopen: persisted.
  const again = await openApp(page);
  await expect(again.getByTestId("admin-hub-role-main")).toContainText(fixedMain);
  await expect(again.getByTestId("admin-hub-role-accent")).toContainText("Not set");
  await expect(again.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __skel: number }).__skel)).toBe(0);

  // Send → read-only summary.
  await again.getByRole("button", { name: "Send colours to KERSIVO" }).first().click();
  await page.getByRole("button", { name: "Yes, send to KERSIVO" }).click();
  await expect(again.getByTestId("admin-hub-colours-sent")).toBeVisible({ timeout: 20000 });
  await expect(again.getByRole("slider")).toHaveCount(0);
  await expect(again.getByRole("button", { name: `Copy ${fixedMain}` })).toBeVisible();
  await page.screenshot({ path: join(shotDir, "after-sent-1440.png") });
  await axe(page, "sent summary @1440");
  await closeApp(page);
  await expect(tile).toHaveAttribute("data-state", "sent");
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.context().close();
});

test("mobile 390: extraction, edit, close → auto draft → reopen → send", async ({ browser }) => {
  test.skip(BEFORE);
  const page = await stagePage(browser, 390);
  await applyScenario(page, "two-colour", {});
  const tile = await openOverview(page);
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const app = await openApp(page);
  await expect(app.getByTestId("admin-hub-role-main")).not.toContainText("Not set", { timeout: 20000 });
  await page.screenshot({ path: join(shotDir, "after-mobile-open-390.png") });
  await axe(page, "editor @390");
  const seg = app.locator(".admin-hub-seg");
  await expect(seg).toBeVisible();
  await expect(app.getByTestId("admin-hub-colours-contrast")).toBeVisible();
  // Footer (Send) stays on screen.
  const foot = await app.locator(".admin-hub-app__foot").boundingBox();
  expect(foot && foot.y + foot.height <= 812 + 1, "sticky footer in view").toBe(true);

  await seg.getByRole("button", { name: "Accent" }).click();
  const swatches = app.locator(".admin-hub-swatch-row__item");
  const count = await swatches.count();
  await swatches.nth(count - 1).click();
  await app.getByRole("button", { name: "Light", exact: true }).click();
  const main = ((await app.getByTestId("admin-hub-role-main").locator(".admin-hub-role__hex").textContent()) ?? "").trim();
  const accent = ((await app.getByTestId("admin-hub-role-accent").locator(".admin-hub-role__hex").textContent()) ?? "").trim();
  await closeApp(page);
  await expect(page.getByTestId("admin-hub-toast")).toHaveText("Draft saved", { timeout: 20000 });
  await page.screenshot({ path: join(shotDir, "after-mobile-autosave-390.png") });
  await expect(tile).toHaveAttribute("data-state", "draft");

  const again = await openApp(page);
  await expect(again.getByTestId("admin-hub-role-main")).toContainText(main);
  await expect(again.getByTestId("admin-hub-role-accent")).toContainText(accent);
  await expect(again.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true");
  await again.getByRole("button", { name: "Send colours to KERSIVO" }).first().click();
  await page.getByRole("button", { name: "Yes, send to KERSIVO" }).click();
  await expect(again.getByTestId("admin-hub-colours-sent")).toBeVisible({ timeout: 20000 });
  await page.screenshot({ path: join(shotDir, "after-mobile-sent-390.png"), fullPage: true });
  await axe(page, "sent summary @390");
  await closeApp(page);
  await expect(tile).toHaveAttribute("data-state", "sent");
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
  await page.context().close();
});

test("no Main: neutral preview with a prompt (no made-up colours)", async ({ browser }) => {
  test.skip(BEFORE);
  for (const width of [375, 1440]) {
    const page = await stagePage(browser, width);
    await applyScenario(page, "black-and-white", {});
    await openOverview(page);
    const app = await openApp(page);
    await page.waitForTimeout(2000);
    await expect(app.getByText("Pick a main colour").locator("visible=true").first()).toBeVisible();
    const html = (await app.innerHTML()).toLowerCase();
    expect(html).not.toContain("#1f6f6b");
    expect(html).not.toContain("#c9a24a");
    await page.screenshot({ path: join(shotDir, `after-no-main-${width}.png`) });
    await page.context().close();
  }
});

for (const logo of Object.keys(LOGOS)) {
  test(`layout matrix — ${logo}`, async ({ browser }) => {
    test.skip(BEFORE);
    for (const width of [375, 390, 768, 1024, 1440]) {
      const page = await stagePage(browser, width);
      await applyScenario(page, logo, {});
      await openOverview(page);
      const app = await openApp(page);
      // Extraction finished: a role is set, or the black-and-white hint shows.
      await expect
        .poll(
          async () =>
            (await app.getByTestId("admin-hub-role-main").locator(".admin-hub-role__hex").textContent())?.trim() !== "—" ||
            (await app.getByText(/black and white/).count()) > 0,
          { timeout: 20000 },
        )
        .toBe(true);
      const m = await page.evaluate(() => {
        const dialog = document.querySelector<HTMLElement>('[data-testid="admin-hub-app"]')!;
        const body = dialog.querySelector<HTMLElement>(".admin-hub-app__body")!;
        const foot = dialog.querySelector<HTMLElement>(".admin-hub-app__foot")!.getBoundingClientRect();
        const cp = dialog.querySelector<HTMLElement>(".admin-hub-cp")!.getBoundingClientRect();
        const cols = Array.from(dialog.querySelectorAll<HTMLElement>(".admin-hub-cp > section"))
          .filter((el) => el.checkVisibility())
          .map((el) => el.getBoundingClientRect());
        return {
          pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
          bodyOverflow: body.scrollWidth - body.clientWidth,
          footInView: foot.bottom <= window.innerHeight + 1 && foot.top >= 0,
          colsInside: cols.every((r) => r.left >= cp.left - 1 && r.right <= cp.right + 1),
          // Sections sharing the first row = columns.
          columns: cols.filter((r) => Math.abs(r.top - cols[0]!.top) < 2).length,
          bodyWidth: body.clientWidth,
          main: dialog.querySelector('[data-testid="admin-hub-role-main"] .admin-hub-role__hex')?.textContent ?? "",
          accent: dialog.querySelector('[data-testid="admin-hub-role-accent"] .admin-hub-role__hex')?.textContent ?? "",
          swatches: dialog.querySelectorAll(".admin-hub-extract__row").length,
        };
      });
      expect(m.pageOverflow, `page overflow ${logo} @${width}`).toBeLessThanOrEqual(0);
      expect(m.bodyOverflow, `app body overflow ${logo} @${width}`).toBeLessThanOrEqual(0);
      expect(m.footInView, `sticky footer ${logo} @${width}`).toBe(true);
      expect(m.colsInside, `columns fit ${logo} @${width}`).toBe(true);
      // Columns follow the app window: three from a 940 px body, two from 620 px, one in the sheet.
      if (width >= 1024) expect(m.columns, `columns @${width} (body ${m.bodyWidth})`).toBe(m.bodyWidth >= 940 ? 3 : 2);
      findings.push(`${logo} @${width} (body ${m.bodyWidth}px): main ${m.main}, accent ${m.accent}, ${m.swatches} swatches, columns ${m.columns}`);
      await page.screenshot({ path: join(shotDir, `matrix-${logo}-${width}.png`) });
      await page.context().close();
    }
  });
}

test("no console errors", async () => {
  test.skip(BEFORE);
  expect(consoleErrors.filter((line) => !ignorable(line))).toEqual([]);
});
