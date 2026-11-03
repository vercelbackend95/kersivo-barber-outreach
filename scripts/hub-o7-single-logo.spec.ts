/**
 * Hub O7: the shop's one logo is shown once per surface, as itself (no frame, box or background). Fixtures:
 * opaque dark JPG with a red mark (founder case), black-on-transparent PNG, white-on-transparent PNG and a very
 * wide 1200×200 wordmark. Surfaces: Overview Brand colours tile, Website content tile, Brand colours app (draft
 * and sent/locked) at 375–1440 px. Checks one visible logo <img> per surface, the plate only for the
 * black-on-transparent logo, the wordmark fully visible, CLS and axe.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const shotDir =
  process.platform === "win32" ? "C:/tmp/kersivo-shots/hub-o7" : "/tmp/kersivo-shots/hub-o7";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL || "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL)) throw new Error("hub-o7 QA must use a local database");

const BEFORE = Boolean(process.env.O7_BEFORE);
const PHASE = BEFORE ? "before" : "after";
const WIDTHS = [375, 768, 1024, 1440] as const;
const SHOT_WIDTHS = new Set<number>([375, 768, 1024, 1440]);

type Seed = { requested: { id: string; token: string } };
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const svg = (body: string, width: number, height: number) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${body}</svg>`));

type Fixture = {
  name: string;
  file: () => Promise<Buffer>;
  mimeType: string;
  plate: boolean;
};
const FIXTURES: Fixture[] = [
  {
    name: "a-opaque-dark-jpg",
    mimeType: "image/jpeg",
    plate: false,
    file: () =>
      svg(
        `<rect width="600" height="600" fill="#0c0c0d"/><circle cx="300" cy="250" r="150" fill="#c8102e"/>
         <text x="300" y="520" font-family="Arial" font-weight="700" font-size="72" fill="#f2f2f2" text-anchor="middle">BLADE</text>`,
        600,
        600,
      )
        .flatten({ background: "#0c0c0d" })
        .jpeg({ quality: 88 })
        .toBuffer(),
  },
  {
    name: "b-black-on-transparent",
    mimeType: "image/png",
    plate: true,
    file: () =>
      svg(
        `<circle cx="300" cy="260" r="180" fill="#0a0a0a"/>
         <text x="300" y="560" font-family="Arial" font-weight="700" font-size="80" fill="#0a0a0a" text-anchor="middle">NOIR</text>`,
        600,
        600,
      )
        .png()
        .toBuffer(),
  },
  {
    name: "c-white-on-transparent",
    mimeType: "image/png",
    plate: false,
    file: () =>
      svg(
        `<circle cx="300" cy="260" r="180" fill="#fafafa"/>
         <text x="300" y="560" font-family="Arial" font-weight="700" font-size="80" fill="#fafafa" text-anchor="middle">WHITE</text>`,
        600,
        600,
      )
        .png()
        .toBuffer(),
  },
  {
    name: "d-wide-wordmark",
    mimeType: "image/png",
    plate: false,
    file: () =>
      svg(
        `<text x="600" y="132" font-family="Arial" font-weight="700" font-size="104" fill="#C9A24A" text-anchor="middle" letter-spacing="6">FADE ROOM BARBERS</text>`,
        1200,
        200,
      )
        .png()
        .toBuffer(),
  },
];

const PALETTE = [
  { hex: "#C8102E", share: 0.5 },
  { hex: "#0C0C0D", share: 0.35 },
  { hex: "#F2F2F2", share: 0.15 },
];

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find((row) => row.name === "ks_hub");
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

/** Replaces the logo with the fixture and sets the brand state; returns the new logo asset id. */
async function applyFixture(page: Page, fixture: Fixture, sent: boolean): Promise<string> {
  await prisma.rateLimitEvent.deleteMany({});
  const res = await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) });
  const { assets = [] } = (await res.json()) as { assets?: Array<{ id: string; kind: string }> };
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: { brandColoursSentAt: null, brandSubmittedSnapshot: Prisma.DbNull },
  });
  for (const asset of assets.filter((row) => row.kind === "LOGO")) {
    await page.request.delete(`/api/admin-hub/assets/${encodeURIComponent(asset.id)}`, {
      headers: await hubHeaders(page),
    });
  }
  const up = await page.request.post("/api/admin-hub/assets", {
    headers: await hubHeaders(page),
    multipart: {
      kind: "LOGO",
      file: {
        name: `logo-${fixture.name}.${fixture.mimeType === "image/jpeg" ? "jpg" : "png"}`,
        mimeType: fixture.mimeType,
        buffer: await fixture.file(),
      },
    },
  });
  expect(up.ok(), `logo upload ${up.status()}`).toBeTruthy();
  const after = (await (await page.request.get("/api/admin-hub/assets", { headers: await hubHeaders(page) })).json()) as {
    assets: Array<{ id: string; kind: string }>;
  };
  const logo = after.assets.find((row) => row.kind === "LOGO");
  expect(logo, "uploaded logo").toBeTruthy();
  await prisma.previewRequest.update({
    where: { id: seed.requested.id },
    data: {
      brandPrimaryColour: "#C8102E",
      brandSecondaryColour: "#F2F2F2",
      brandBackgroundTone: "DARK",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: PALETTE,
      brandPaletteLogoAssetId: logo!.id,
      brandColoursSentAt: sent ? new Date("2026-11-02T10:00:00.000Z") : null,
    },
  });
  return logo!.id;
}

/**
 * CLS from the logo surfaces only: shifts whose sources sit inside the Brand colours / Website content tiles.
 * (A 23 px shift of .admin-main-panel at 375 px exists on main too and is unrelated to the logo.)
 */
const CLS_INIT = () => {
  const w = window as unknown as { __cls: number; __clsAll: number };
  w.__cls = 0;
  w.__clsAll = 0;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as Array<
      PerformanceEntry & { value: number; hadRecentInput: boolean; sources?: Array<{ node?: Node | null }> }
    >) {
      if (entry.hadRecentInput) continue;
      w.__clsAll += entry.value;
      const els = (entry.sources ?? []).map((source) => {
        const node = source.node;
        return node instanceof Element ? node : (node?.parentElement ?? null);
      });
      const tiles = '[data-tile="colours"], [data-testid="admin-hub-content-tile"]';
      // A shift that moved an ancestor of the tiles (the page chrome) did not start in them.
      const fromOutside = els.some((el) => el && !el.closest(tiles) && el.querySelector(tiles));
      if (!fromOutside && els.some((el) => el?.closest(tiles))) w.__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

type LogoReport = {
  visible: number;
  plate: boolean[];
  fullyVisible: boolean[];
  framed: string[];
};

/** Visible <img> of this logo inside the surface, and how each one is painted. */
async function logoReport(surface: Locator, logoId: string): Promise<LogoReport> {
  return surface.evaluate((root, id) => {
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter((img) => {
      if (!img.currentSrc.includes(`/assets/${encodeURIComponent(id)}`) && !img.src.includes(`/assets/${id}`)) return false;
      const r = img.getBoundingClientRect();
      return img.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && r.width > 0 && r.height > 0;
    });
    const opaque = (value: string) => value !== "rgba(0, 0, 0, 0)" && value !== "transparent";
    return {
      visible: imgs.length,
      plate: imgs.map((img) => img.classList.contains("hub-logo-mark--plate")),
      fullyVisible: imgs.map((img) => {
        const r = img.getBoundingClientRect();
        const ratio = img.naturalWidth / img.naturalHeight;
        const cs = getComputedStyle(img);
        const cw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const ch = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        const painted = Math.min(cw, ch * ratio);
        // Never clipped by an ancestor with overflow: hidden.
        let clipped = false;
        for (let el = img.parentElement; el && el !== root.parentElement; el = el.parentElement) {
          const ecs = getComputedStyle(el);
          if (ecs.overflow === "visible") continue;
          const box = el.getBoundingClientRect();
          if (r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
            clipped = true;
        }
        return !clipped && (cs.objectFit === "contain" || Math.abs(cw / ch - ratio) < 0.05) && painted > 0;
      }),
      // A box behind the logo: an ancestor (up to 2 levels) that hugs the logo (≤ 2.5× its area) and has its
      // own background or border. Section cards that hold other content too are not logo frames.
      framed: imgs.flatMap((img) => {
        const out: string[] = [];
        const r = img.getBoundingClientRect();
        let el: HTMLElement | null = img.parentElement;
        for (let depth = 0; el && depth < 2; depth += 1, el = el.parentElement) {
          const box = el.getBoundingClientRect();
          if (box.width * box.height > 2.5 * r.width * r.height) continue;
          const ecs = getComputedStyle(el);
          if (opaque(ecs.backgroundColor) || ecs.backgroundImage !== "none" || parseFloat(ecs.borderTopWidth) > 0)
            out.push(`${el.className}: bg ${ecs.backgroundColor} border ${ecs.borderTopWidth}`);
        }
        return out;
      }),
    };
  }, logoId);
}

async function waitForLogos(page: Page) {
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
  await expect(page.getByTestId("admin-hub-overview")).toBeVisible();
  await waitForLogos(page);
}

async function openApp(page: Page) {
  const tile = page.locator('a[data-tile="colours"]');
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  const app = page.getByTestId("admin-hub-app");
  await expect(app).toBeVisible();
  await expect(app.getByTestId("admin-hub-colours")).toBeVisible();
  await waitForLogos(page);
  return app;
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o7] findings (${PHASE})\n${findings.join("\n")}`);
  await prisma.$disconnect();
});

for (const fixture of FIXTURES) {
  test(`one logo per surface — ${fixture.name}`, async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(CLS_INIT);
    const page = await context.newPage();
    await page.goto(`/preview/${seed.requested.token}`);
    await expect(page.locator(".admin-shell")).toBeVisible();

    for (const sent of [false, true]) {
      const state = sent ? "sent" : "draft";
      const logoId = await applyFixture(page, fixture, sent);
      for (const width of WIDTHS) {
        await openOverview(page, width);
        const { cls, clsAll } = await page.evaluate(() => {
          const w = window as unknown as { __cls: number; __clsAll: number };
          return { cls: w.__cls, clsAll: w.__clsAll };
        });
        const coloursTile = page.locator('a[data-tile="colours"]');
        const contentTile = page.getByTestId("admin-hub-content-tile");
        const shoot = SHOT_WIDTHS.has(width);
        if (shoot) {
          await coloursTile.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await page.waitForTimeout(100);
          await coloursTile.screenshot({ path: join(shotDir, `${PHASE}-colours-tile-${fixture.name}-${state}-${width}.png`) });
          if (!sent) {
            await contentTile.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await page.waitForTimeout(100);
            await contentTile.screenshot({ path: join(shotDir, `${PHASE}-content-tile-${fixture.name}-${width}.png`) });
          }
        }
        const tileReport = await logoReport(coloursTile, logoId);
        const contentReport = await logoReport(contentTile, logoId);

        const app = await openApp(page);
        if (shoot) {
          await page.screenshot({ path: join(shotDir, `${PHASE}-colours-app-${fixture.name}-${state}-${width}.png`), fullPage: false });
        }
        const appReport = await logoReport(app, logoId);
        findings.push(
          `${fixture.name} ${state} ${width}px: tile ${tileReport.visible} content ${contentReport.visible} app ${appReport.visible}` +
            ` plate ${JSON.stringify([tileReport.plate, contentReport.plate, appReport.plate])}` +
            ` framed ${JSON.stringify([...tileReport.framed, ...contentReport.framed, ...appReport.framed])} cls tiles ${cls.toFixed(4)} page ${clsAll.toFixed(4)}`,
        );
        if (BEFORE) continue;

        for (const [surface, report] of [
          ["colours tile", tileReport],
          ["content tile", contentReport],
          ["colours app", appReport],
        ] as const) {
          expect(report.visible, `${surface} ${width}px: one visible logo`).toBe(1);
          expect(report.plate, `${surface} ${width}px: plate`).toEqual([fixture.plate]);
          expect(report.fullyVisible, `${surface} ${width}px: never cropped`).toEqual([true]);
          expect(report.framed, `${surface} ${width}px: no box behind the logo`).toEqual([]);
        }
        expect(cls, `logo tiles CLS ${width}px`).toBeLessThan(0.01);

        if (width === 375 || width === 1440) {
          const axe = await new AxeBuilder({ page })
            .include('[data-testid="admin-hub-app"]')
            .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
            .analyze();
          expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), `axe app ${width}px`).toEqual([]);
        }
        await page.keyboard.press("Escape");
      }
      if (!BEFORE) {
        await openOverview(page, 1440);
        const axe = await new AxeBuilder({ page })
          .include('a[data-tile="colours"]')
          .include('[data-testid="admin-hub-content-tile"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`), "axe overview tiles").toEqual([]);
      }
    }
    await context.close();
  });
}
