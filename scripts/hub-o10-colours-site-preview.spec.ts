/**
 * Hub O10: the Brand colours tile shows a small barbershop website (BrandSitePreview, size="tile") built from the
 * same colour logic as the Brand colours app. States × widths: screenshots, preview visible only on a wide tile,
 * fixed 16:11 box, no horizontal overflow, Book in Accent, hero matches the app, distinct Main / Accent names,
 * CLS and axe (the preview stays aria-hidden inside the one tile link).
 *
 * Before shots: O10_BEFORE=1 (run on main).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { betterButtonText } from "../src/lib/adminHub/colour/contrast";

const shotDir =
  process.platform === "win32" ? "C:/tmp/kersivo-shots/hub-o10" : "/tmp/kersivo-shots/hub-o10";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error("hub-o10 QA must use a local database");

const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
const BEFORE = Boolean(process.env.O10_BEFORE);
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
let seed: { requested: { id: string; token: string } };

const LOGO = () =>
  sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <circle cx="300" cy="240" r="170" fill="#1F6F6B"/><text x="300" y="262" font-family="Arial" font-weight="700" font-size="120" fill="#C9A24A" text-anchor="middle">FR</text>
      <text x="300" y="540" font-family="Arial" font-weight="700" font-size="64" fill="#F2E8D5" text-anchor="middle">FADE ROOM</text></svg>`),
  )
    .png()
    .toBuffer();

type Brand = {
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandBackgroundTone?: "DARK" | "LIGHT" | null;
  brandColoursSource?: "LOGO" | "MANUAL" | "KERSIVO_CHOOSES" | null;
  brandPaletteExtracted?: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt?: Date | null;
};
type Scenario = { name: string; logo: boolean; brand: Brand; state: string; look: boolean };
const PALETTE = [
  { hex: "#1F6F6B", share: 0.42 },
  { hex: "#C9A24A", share: 0.24 },
  { hex: "#141414", share: 0.18 },
  { hex: "#F2E8D5", share: 0.1 },
];
const SENT_AT = new Date("2026-11-02T10:00:00.000Z");
const SCENARIOS: Scenario[] = [
  { name: "no-logo", logo: false, brand: {}, state: "no_logo", look: false },
  { name: "logo-not-started", logo: true, brand: {}, state: "not_started", look: false },
  {
    name: "draft",
    logo: true,
    brand: {
      brandPrimaryColour: "#1F6F6B",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "DARK",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: PALETTE,
    },
    state: "draft",
    look: true,
  },
  {
    name: "sent",
    logo: true,
    brand: {
      brandPrimaryColour: "#1F6F6B",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "LIGHT",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: PALETTE,
      brandColoursSentAt: SENT_AT,
    },
    state: "sent",
    look: true,
  },
  {
    name: "kersivo-chooses",
    logo: true,
    brand: { brandColoursSource: "KERSIVO_CHOOSES", brandPaletteExtracted: PALETTE.slice(0, 3), brandColoursSentAt: SENT_AT },
    state: "kersivo",
    look: false,
  },
  {
    name: "light-tone",
    logo: true,
    brand: {
      brandPrimaryColour: "#8A2D2D",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "LIGHT",
      brandColoursSource: "MANUAL",
    },
    state: "draft",
    look: true,
  },
  {
    // Both hexes are "Copper" in the name table: the rows must still read differently.
    name: "dark-tone-same-name",
    logo: true,
    brand: {
      brandPrimaryColour: "#401010",
      brandSecondaryColour: "#742A27",
      brandBackgroundTone: "DARK",
      brandColoursSource: "MANUAL",
    },
    state: "draft",
    look: true,
  },
  {
    name: "no-logo-main-only",
    logo: false,
    brand: { brandPrimaryColour: "#1F6F6B", brandBackgroundTone: "DARK", brandColoursSource: "MANUAL" },
    state: "draft",
    look: true,
  },
  {
    name: "accent-only",
    logo: true,
    brand: { brandSecondaryColour: "#C9A24A", brandBackgroundTone: "DARK", brandColoursSource: "MANUAL" },
    state: "draft",
    look: true,
  },
];

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === "ks_hub");
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function applyScenario(page: Page, scenario: Scenario) {
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
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, { headers: await hubHeaders(page) });
  }
  if (scenario.logo) {
    const up = await page.request.post("/api/admin-hub/assets", {
      headers: await hubHeaders(page),
      multipart: { kind: "LOGO", file: { name: "logo.png", mimeType: "image/png", buffer: await LOGO() } },
    });
    expect(up.ok(), `logo upload ${up.status()}`).toBeTruthy();
  }
  const brand = scenario.brand;
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: {
      brandPrimaryColour: brand.brandPrimaryColour ?? null,
      brandSecondaryColour: brand.brandSecondaryColour ?? null,
      brandBackgroundTone: brand.brandBackgroundTone ?? null,
      brandColoursSource: brand.brandColoursSource ?? null,
      brandPaletteExtracted: brand.brandPaletteExtracted ?? Prisma.DbNull,
      brandColoursSentAt: brand.brandColoursSentAt ?? null,
    },
  });
}

const CLS_INIT = () => {
  (window as unknown as { __cls: number }).__cls = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) {
      if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function stagePage(browser: Browser) {
  const context = await browser.newContext();
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  await page.goto(`/preview/${seed.requested.token}`);
  await expect(page.locator(".admin-shell")).toBeVisible();
  return page;
}

async function openOverview(page: Page, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 812 : 900 });
  await page.goto("/admin");
  await expect(page.getByTestId("admin-hub-overview")).toBeVisible();
  const tile = page.locator('a[data-tile="colours"]');
  await tile.scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>('a[data-tile="colours"] img')).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
  await page.waitForTimeout(200);
  return tile;
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as typeof seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o10] findings\n${findings.join("\n")}`);
  await prisma.$disconnect();
});

test("before shots (main)", async ({ browser }) => {
  test.skip(!BEFORE, "only with O10_BEFORE=1");
  const page = await stagePage(browser);
  for (const scenario of SCENARIOS) {
    await applyScenario(page, scenario);
    for (const width of WIDTHS) {
      const tile = await openOverview(page, width);
      await tile.screenshot({ path: join(shotDir, `before-tile-${scenario.name}-${width}.png`) });
    }
  }
  await page.context().close();
});

test("colours tile: website preview matrix", async ({ browser }) => {
  test.skip(BEFORE);
  const page = await stagePage(browser);
  for (const scenario of SCENARIOS) {
    await applyScenario(page, scenario);
    for (const width of WIDTHS) {
      const tile = await openOverview(page, width);
      await expect(tile).toHaveAttribute("data-state", scenario.state);
      const m = await tile.evaluate((el) => {
        const preview = el.querySelector<HTMLElement>('[data-testid="admin-hub-colours-site-preview"]');
        const visible = Boolean(preview?.checkVisibility());
        const r = preview?.getBoundingClientRect();
        const pick = (sel: string) => {
          const node = preview?.querySelector<HTMLElement>(sel);
          if (!node) return null;
          const cs = getComputedStyle(node);
          return { bg: cs.backgroundColor, fg: cs.color, image: cs.backgroundImage };
        };
        const overflowing = preview
          ? Array.from(preview.querySelectorAll<HTMLElement>("*")).filter((node) => {
              const box = node.getBoundingClientRect();
              return node.checkVisibility() && box.width > 0 && box.right > r!.right + 0.5;
            }).length
          : 0;
        const names = Array.from(el.querySelectorAll(".admin-hub-colours-role__name")).map((n) => n.textContent ?? "");
        return {
          visible,
          ariaHidden: preview?.getAttribute("aria-hidden") ?? null,
          ratio: r && r.height ? r.width / r.height : 0,
          width: Math.round(r?.width ?? 0),
          overflowing,
          hero: pick(".admin-hub-livep__hero"),
          book: pick(".admin-hub-livep__book"),
          logo: Boolean(preview?.querySelector("img")),
          names,
          body: Math.round(el.querySelector<HTMLElement>(".admin-hub-colours-body")!.getBoundingClientRect().width),
        };
      });
      expect(m.visible, `preview @${width} (body ${m.body})`).toBe(scenario.look && m.body >= 560);
      if (scenario.look) {
        expect(m.ariaHidden).toBe("true");
        expect(new Set(m.names).size, `distinct names ${m.names.join(" / ")}`).toBe(m.names.length);
      }
      if (m.visible) {
        expect(Math.abs(m.ratio - 16 / 11), `16:11 box (${m.ratio.toFixed(3)})`).toBeLessThan(0.03);
        expect(m.overflowing, "nothing sticks out of the preview").toBe(0);
        expect(m.logo).toBe(scenario.logo);
        const accent = scenario.brand.brandSecondaryColour;
        if (accent) {
          expect(m.book?.bg).toBe(hexToRgb(accent));
          expect(m.book?.fg).toBe(hexToRgb(betterButtonText(accent)));
        }
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `no horizontal scroll ${scenario.name} @${width}`).toBeLessThanOrEqual(0);
      const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
      expect(cls, `CLS ${scenario.name} @${width}`).toBeLessThan(0.05);
      findings.push(
        `${scenario.name} @${width}: body ${m.body}px, preview ${m.visible ? `${m.width}px r${m.ratio.toFixed(3)}` : "hidden"}, names ${m.names.join(" / ") || "—"}, CLS ${cls.toFixed(4)}`,
      );
      await tile.screenshot({ path: join(shotDir, `after-tile-${scenario.name}-${width}.png`) });

      // Same colours → same hero and Book button as the full preview inside the Brand colours app.
      if (m.visible && width === 1440 && scenario.state === "draft") {
        await tile.click();
        const app = page.getByTestId("admin-hub-app");
        await expect(app).toBeVisible();
        const full = app.getByTestId("admin-hub-colours-preview");
        await expect(full).toBeVisible();
        const paint = (sel: string) =>
          full.locator(sel).evaluate((node) => {
            const cs = getComputedStyle(node);
            return { bg: cs.backgroundColor, fg: cs.color, image: cs.backgroundImage };
          });
        expect(await paint(".admin-hub-livep__hero")).toEqual(m.hero);
        expect(await paint(".admin-hub-livep__book")).toEqual(m.book);
        await page.screenshot({ path: join(shotDir, `after-app-${scenario.name}-${width}.png`) });
      }
    }
    for (const width of [1440, 1024, 375]) {
      await openOverview(page, width);
      const axe = await new AxeBuilder({ page })
        .include('a[data-tile="colours"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `axe ${scenario.name} @${width}`).toEqual([]);
    }
  }
  await page.context().close();
});
