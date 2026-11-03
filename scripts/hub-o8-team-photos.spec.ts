/**
 * Hub O8: "Team photos" is no longer a separate thing in the hub. A barber's photo is added with the barber on
 * Team (TEAM_PHOTO with barberId); Materials, the Add menu and the Overview status list no longer show Team
 * photos. Unassigned legacy TEAM_PHOTO assets stay visible under "Earlier team photos" in the Shop photos card
 * and can be deleted. Old `?item=team-photos` links open Materials at the top.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const shotDir =
  process.platform === "win32" ? "C:/tmp/kersivo-shots/hub-o8" : "/tmp/kersivo-shots/hub-o8";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error("hub-o8 QA must use a local database");

const BEFORE = Boolean(process.env.O8_BEFORE);
const PHASE = BEFORE ? "before" : "after";
const WIDTHS = [375, 768, 1024, 1440] as const;
const SHOT_WIDTHS = new Set<number>([375, 1440]);

type Seed = { ready: { id: string; token: string } };
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const photo = (fill: string, label: string) =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
      <rect width="800" height="600" fill="${fill}"/>
      <text x="400" y="320" font-family="Arial" font-weight="700" font-size="72" fill="#fff" text-anchor="middle">${label}</text></svg>`),
  )
    .jpeg({ quality: 85 })
    .toBuffer();

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === "ks_hub");
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function upload(page: Page, kind: string, name: string, buffer: Buffer): Promise<string> {
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.post("/api/admin-hub/assets", {
    headers: await hubHeaders(page),
    multipart: { kind, file: { name, mimeType: "image/jpeg", buffer } },
  });
  expect(res.ok(), `upload ${name} ${res.status()}`).toBeTruthy();
  const body = (await res.json()) as { asset?: { id: string } };
  expect(body.asset?.id, `upload ${name} id`).toBeTruthy();
  return body.asset!.id;
}

type Ids = { shop: string[]; legacy: string; barberPhoto: string; barberId: string };

/** Ready request: 2 shop photos, 1 unassigned (legacy) team photo, 1 barber photo linked to a barber. */
async function seedAssets(page: Page): Promise<Ids> {
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string; kind: string }> };
  for (const asset of assets.filter((row) => row.kind === "SHOP_PHOTO" || row.kind === "TEAM_PHOTO")) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
  const request = await prisma.previewRequest.findUniqueOrThrow({ where: { id: seed.ready.id } });
  const barber = await prisma.barber.findFirstOrThrow({
    where: { shopId: request.draftShopId!, active: true },
    orderBy: { sortOrder: "asc" },
  });
  const shop = [
    await upload(page, "SHOP_PHOTO", "front.jpg", await photo("#2b2b30", "SHOP 1")),
    await upload(page, "SHOP_PHOTO", "chairs.jpg", await photo("#3a2a2a", "SHOP 2")),
  ];
  const legacy = await upload(page, "TEAM_PHOTO", "whole-team.jpg", await photo("#1f3a2e", "TEAM"));
  await page.request.patch(`/api/admin-hub/assets/${encodeURIComponent(legacy)}`, {
    headers: { ...(await hubHeaders(page)), "Content-Type": "application/json" },
    data: { caption: "The whole team, summer 2026" },
  });
  // Same calls the Team page makes: upload TEAM_PHOTO, then link it to the barber.
  const barberPhoto = await upload(page, "TEAM_PHOTO", "barber.jpg", await photo("#20304a", "BARBER"));
  const link = await page.request.patch(`/api/admin-hub/assets/${encodeURIComponent(barberPhoto)}`, {
    headers: { ...(await hubHeaders(page)), "Content-Type": "application/json" },
    data: { barberId: barber.id },
  });
  expect(link.ok(), `link barber photo ${link.status()}`).toBeTruthy();
  return { shop, legacy, barberPhoto, barberId: barber.id };
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>("img")).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
  await page.waitForTimeout(250);
}

async function openOverview(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-hub-overview")).toBeVisible({ timeout: 60000 });
  await settle(page);
}

async function openMaterials(page: Page, item?: string) {
  await page.goto(`/admin?app=materials${item ? `&item=${item}` : ""}`);
  const app = page.getByTestId("admin-hub-app");
  await expect(app).toHaveAttribute("data-app", "materials", { timeout: 60000 });
  await expect(app.locator("#photos")).toBeVisible();
  await settle(page);
  return app;
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o8] findings (${PHASE})\n${findings.join("\n")}`);
  await prisma.$disconnect();
});

test("team photos live with barbers; legacy ones stay reachable", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (err) => {
    // Back-to-back page.goto() aborts the cross-document view transition; not an app error.
    if (!String(err).includes("Transition was aborted")) errors.push(String(err));
  });
  page.on("response", (res) => {
    // Vite dev-toolbar modules (/@id/…) 504 under load in dev; they are not app requests.
    if (res.status() >= 500 && !new URL(res.url()).pathname.startsWith("/@")) errors.push(`${res.status()} ${res.url()}`);
  });
  await page.goto(`/preview/${seed.ready.token}`);
  await expect(page.locator(".admin-shell")).toBeVisible({ timeout: 90000 });
  const ids = await seedAssets(page);

  for (const width of WIDTHS) {
    const shoot = SHOT_WIDTHS.has(width);

    // Overview: Website content status list.
    await openOverview(page, width);
    const tile = page.getByTestId("admin-hub-content-tile");
    const rows = await tile.locator("[data-content-item]").evaluateAll((els) =>
      els.map((el) => `${el.getAttribute("data-content-item")}=${el.querySelector(".admin-hub-status__value")?.textContent}`),
    );
    findings.push(`${width}px overview status: ${rows.join(", ")}`);
    if (shoot) {
      await tile.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(150);
      await tile.screenshot({ path: join(shotDir, `${PHASE}-overview-content-${width}.png`) });
    }
    if (!BEFORE) {
      expect(rows.some((row) => row.startsWith("team-photos")), `${width}px: no Team photos row`).toBe(false);
      expect(rows).toContain("photos=2");
    }

    // Add menu: desktop panel from the header, mobile sheet below.
    const trigger = tile.getByTestId("admin-hub-add-inline");
    await tile.scrollIntoViewIfNeeded();
    await trigger.click();
    const menu = width <= 640 ? page.getByTestId("admin-hub-add-sheet") : page.getByTestId("admin-hub-add-menu");
    await expect(menu).toBeVisible();
    await page.waitForTimeout(350);
    const items = await page.getByRole("menuitem").allTextContents();
    findings.push(`${width}px add menu: ${items.map((t) => t.trim().replace(/\s+/g, " ")).join(" | ")}`);
    if (shoot) await page.screenshot({ path: join(shotDir, `${PHASE}-add-menu-${width}.png`) });
    if (!BEFORE) {
      await expect(page.getByRole("menuitem", { name: /Team photos/ })).toHaveCount(0);
      await expect(page.getByRole("menuitem", { name: /Shop photos/ })).toHaveCount(1);
      await expect(page.getByRole("menuitem", { name: /Team member/ })).toHaveCount(1);
    }
    await page.keyboard.press("Escape");

    // Materials app.
    await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
    const app = await openMaterials(page);
    const chips = await app.getByTestId("hub-jump").locator("button").allTextContents();
    const barberShown = await app.locator(`img[src*="${ids.barberPhoto}"]`).count();
    const legacyShown = await app.locator(`img[src*="${ids.legacy}"]`).count();
    findings.push(
      `${width}px materials: chips [${chips.join(", ")}] #team-photos ${await app.locator("#team-photos").count()}` +
        ` barber photo imgs ${barberShown} legacy imgs ${legacyShown}`,
    );
    if (shoot) {
      await page.screenshot({ path: join(shotDir, `${PHASE}-materials-top-${width}.png`) });
      const photos = app.locator("#photos");
      await photos.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await page.waitForTimeout(150);
      await photos.screenshot({ path: join(shotDir, `${PHASE}-materials-shop-photos-${width}.png`) });
    }
    if (!BEFORE) {
      expect(chips.some((chip) => chip.includes("Team photos")), `${width}px: no Team photos chip`).toBe(false);
      await expect(app.locator("#team-photos")).toHaveCount(0);
      expect(barberShown, `${width}px: barber photo never in Materials`).toBe(0);
      const earlier = app.getByTestId("hub-earlier-team-photos");
      await expect(earlier).toBeVisible();
      if (shoot) {
        await earlier.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(shotDir, `${PHASE}-materials-earlier-team-${width}.png`) });
      }
      await expect(earlier.getByRole("heading", { name: "Earlier team photos" })).toBeVisible();
      await expect(earlier.locator(`img[src*="${ids.legacy}"]`)).toHaveCount(1);
      await expect(earlier.locator('input[type="file"]')).toHaveCount(0);
      await expect(earlier.getByLabel("Caption")).toHaveValue("The whole team, summer 2026");
      await expect(earlier.getByRole("button", { name: "Delete" })).toBeVisible();
      if (width === 375 || width === 1440) {
        const axe = await new AxeBuilder({ page })
          .include('[data-testid="admin-hub-app"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `axe materials ${width}px`).toEqual([]);
      }
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(scrollWidth, `${width}px: no horizontal scroll`).toBeLessThanOrEqual(0);
    }
    await page.keyboard.press("Escape");
  }

  // Old links: ?item=team-photos opens Materials at the top, no error.
  await page.setViewportSize({ width: 1440, height: 900 });
  const legacyLinkApp = await openMaterials(page, "team-photos");
  const legacyLink = await legacyLinkApp.evaluate((el) => {
    const body = el.querySelector(".admin-hub-app__body") ?? el;
    return { scrollTop: (body as HTMLElement).scrollTop, target: document.querySelectorAll(".is-hub-add-target").length };
  });
  findings.push(`old ?item=team-photos link: ${JSON.stringify(legacyLink)}`);
  await page.screenshot({ path: join(shotDir, `${PHASE}-materials-old-link-1440.png`) });
  if (!BEFORE) {
    expect(legacyLink.target, "old link: nothing highlighted").toBe(0);
    expect(legacyLink.scrollTop, "old link: at the top").toBe(0);
  }

  // Barber photo is still linked to its barber (what Team reads).
  const barberAsset = await prisma.previewHubAsset.findUniqueOrThrow({ where: { id: ids.barberPhoto } });
  expect(barberAsset.barberId).toBe(ids.barberId);
  expect(barberAsset.deletedAt).toBeNull();

  if (!BEFORE) {
    // Delete the legacy photo from "Earlier team photos" (5 s undo window, committed on close).
    const earlier = legacyLinkApp.getByTestId("hub-earlier-team-photos");
    await earlier.getByRole("button", { name: "Delete" }).click();
    await expect(legacyLinkApp.getByTestId("hub-earlier-team-photos")).toHaveCount(0);
    await expect
      .poll(async () => (await prisma.previewHubAsset.findUniqueOrThrow({ where: { id: ids.legacy } })).deletedAt, {
        timeout: 15000,
      })
      .not.toBeNull();
    const app = await openMaterials(page);
    await expect(app.getByTestId("hub-earlier-team-photos")).toHaveCount(0);
    await page.screenshot({ path: join(shotDir, `${PHASE}-materials-after-delete-1440.png`) });
    const stillLinked = await prisma.previewHubAsset.findUniqueOrThrow({ where: { id: ids.barberPhoto } });
    expect(stillLinked.deletedAt, "barber photo untouched").toBeNull();
  }

  expect(errors, "no page errors / 5xx").toEqual([]);
  // Leave the shared seed as other specs expect it: no team photos.
  await prisma.previewHubAsset.updateMany({
    where: { previewRequestId: seed.ready.id, kind: "TEAM_PHOTO", deletedAt: null },
    data: { deletedAt: new Date() },
  });
  await context.close();
});
