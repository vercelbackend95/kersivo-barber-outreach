/**
 * Hub O4: Brand colours tile — states (no logo / not started / draft / sent / KERSIVO chooses), black-and-white
 * and very wide logos, both Overview stages, 375–1440 px. Checks the headline count against the chips, never-cropped
 * logo (one, as itself since O7), the website preview (BrandSitePreview since O10), CLS, axe, the preview phone background and the live refresh from the app.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { Prisma, PrismaClient } from "@prisma/client";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const shotDir =
  process.platform === "win32"
    ? "C:/tmp/kersivo-shots/hub-o4-colours-tile"
    : "/tmp/kersivo-shots/hub-o4-colours-tile";
mkdirSync(shotDir, { recursive: true });

const ORIGIN = "http://127.0.0.1:4397";
const DATABASE_URL =
  process.env.PREVIEW_HUB_DATABASE_URL ||
  "postgresql://kersivo:kersivo@127.0.0.1:55432/kersivo_hub_qa";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(DATABASE_URL))
  throw new Error("hub-o4 QA must use a local database");

const WIDTHS = [375, 768, 1024, 1280, 1440] as const;
type Seed = {
  requested: { id: string; token: string };
  ready: { id: string; token: string };
};
type StageKey = "requested" | "ready";
let seed: Seed;
const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

const svgPng = (svg: string) => sharp(Buffer.from(svg)).png().toBuffer();
const LOGOS = {
  colour: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <circle cx="300" cy="240" r="170" fill="#1F6F6B"/><text x="300" y="262" font-family="Arial" font-weight="700" font-size="120" fill="#C9A24A" text-anchor="middle">FR</text>
      <text x="300" y="540" font-family="Arial" font-weight="700" font-size="64" fill="#F2E8D5" text-anchor="middle">FADE ROOM</text></svg>`),
  bw: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
      <circle cx="300" cy="260" r="200" fill="#111111"/><text x="300" y="300" font-family="Arial" font-weight="700" font-size="140" fill="#F5F5F5" text-anchor="middle">BW</text></svg>`),
  wordmark: () =>
    svgPng(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="200">
      <rect x="2" y="2" width="1596" height="196" fill="none" stroke="#C9A24A" stroke-width="4"/>
      <text x="800" y="132" font-family="Arial" font-weight="700" font-size="96" fill="#8A2D2D" text-anchor="middle" letter-spacing="6">FADE ROOM BARBERS</text></svg>`),
};

const PALETTE = [
  { hex: "#1F6F6B", share: 0.42 },
  { hex: "#C9A24A", share: 0.24 },
  { hex: "#141414", share: 0.18 },
  { hex: "#F2E8D5", share: 0.1 },
  { hex: "#8A2D2D", share: 0.06 },
];

type Brand = {
  brandPrimaryColour?: string | null;
  brandSecondaryColour?: string | null;
  brandBackgroundTone?: "DARK" | "LIGHT" | null;
  brandColoursSource?: "LOGO" | "MANUAL" | "KERSIVO_CHOOSES" | null;
  brandPaletteExtracted?: Array<{ hex: string; share: number }> | null;
  brandColoursSentAt?: Date | null;
};
type Scenario = {
  name: string;
  logo: keyof typeof LOGOS | null;
  brand: Brand;
  state: string;
  chips: number;
  look: boolean;
};
const SENT_AT = new Date("2026-11-02T10:00:00.000Z");
const SCENARIOS: Scenario[] = [
  {
    name: "no-logo",
    logo: null,
    brand: {},
    state: "no_logo",
    chips: 0,
    look: false,
  },
  {
    name: "logo-not-started",
    logo: "colour",
    brand: {},
    state: "not_started",
    chips: 0,
    look: false,
  },
  {
    name: "draft",
    logo: "colour",
    brand: {
      brandPrimaryColour: "#1F6F6B",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "DARK",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: PALETTE,
    },
    state: "draft",
    chips: 5,
    look: true,
  },
  {
    name: "sent",
    logo: "colour",
    brand: {
      brandPrimaryColour: "#1F6F6B",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "LIGHT",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: PALETTE.slice(0, 4),
      brandColoursSentAt: SENT_AT,
    },
    state: "sent",
    chips: 4,
    look: true,
  },
  {
    name: "kersivo-chooses",
    logo: "colour",
    brand: {
      brandColoursSource: "KERSIVO_CHOOSES",
      brandPaletteExtracted: PALETTE.slice(0, 3),
      brandColoursSentAt: SENT_AT,
    },
    state: "kersivo",
    chips: 3,
    look: false,
  },
  {
    name: "black-and-white-logo",
    logo: "bw",
    brand: {
      brandPrimaryColour: "#111111",
      brandSecondaryColour: "#F5F5F5",
      brandBackgroundTone: "DARK",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: [
        { hex: "#111111", share: 0.7 },
        { hex: "#F5F5F5", share: 0.3 },
      ],
    },
    state: "draft",
    chips: 2,
    look: true,
  },
  {
    name: "wide-wordmark",
    logo: "wordmark",
    brand: {
      brandPrimaryColour: "#8A2D2D",
      brandSecondaryColour: "#C9A24A",
      brandBackgroundTone: "DARK",
      brandColoursSource: "LOGO",
      brandPaletteExtracted: [
        { hex: "#8A2D2D", share: 0.55 },
        { hex: "#C9A24A", share: 0.45 },
      ],
    },
    state: "draft",
    chips: 2,
    look: true,
  },
];

async function hubHeaders(page: Page) {
  const cookie = (await page.context().cookies()).find(
    (row) => row.name === "ks_hub",
  );
  expect(cookie, "ks_hub cookie").toBeTruthy();
  return { Origin: ORIGIN, Cookie: `${cookie!.name}=${cookie!.value}` };
}

async function applyScenario(
  page: Page,
  stage: StageKey,
  scenario: Pick<Scenario, "logo" | "brand">,
) {
  await prisma.rateLimitEvent.deleteMany({});
  await prisma.previewRequest.update({
    where: { id: seed[stage].id },
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
  const res = await page.request.get("/api/admin-hub/assets", {
    headers: await hubHeaders(page),
  });
  const { assets = [] } = (await res.json()) as {
    assets?: Array<{ id: string; kind: string }>;
  };
  for (const asset of assets.filter((row) => row.kind === "LOGO")) {
    await page.request.delete(
      `/api/admin-hub/assets/${encodeURIComponent(asset.id)}`,
      { headers: await hubHeaders(page) },
    );
  }
  if (scenario.logo) {
    const up = await page.request.post("/api/admin-hub/assets", {
      headers: await hubHeaders(page),
      multipart: {
        kind: "LOGO",
        file: {
          name: `logo-${scenario.logo}.png`,
          mimeType: "image/png",
          buffer: await LOGOS[scenario.logo](),
        },
      },
    });
    expect(up.ok(), `logo upload ${up.status()}`).toBeTruthy();
  }
  const brand = scenario.brand;
  await prisma.previewRequest.update({
    where: { id: seed[stage].id },
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
    for (const entry of list.getEntries() as Array<
      PerformanceEntry & { value: number; hadRecentInput: boolean }
    >) {
      if (!entry.hadRecentInput)
        (window as unknown as { __cls: number }).__cls += entry.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
};

async function stagePage(browser: Browser, stage: StageKey) {
  const context = await browser.newContext();
  await context.addInitScript(CLS_INIT);
  const page = await context.newPage();
  await page.goto(`/preview/${seed[stage].token}`);
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
    Array.from(
      document.querySelectorAll<HTMLImageElement>('a[data-tile="colours"] img'),
    ).every(
      (img) => !img.checkVisibility() || (img.complete && img.naturalWidth > 0),
    ),
  );
  await page.waitForTimeout(200);
  return tile;
}

const findings: string[] = [];

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/preview-hub-qa/seed");
  expect(res.ok(), `seed ${res.status()}`).toBeTruthy();
  seed = (await res.json()) as Seed;
});

test.afterAll(async () => {
  console.log(`\n[hub-o4] findings\n${findings.join("\n")}`);
  await prisma.$disconnect();
});

const BEFORE = Boolean(process.env.O4_BEFORE);

// Run once on main (O4_BEFORE=1) for the before shots; the O4 assertions below are skipped then.
test("before shots (main)", async ({ browser }) => {
  test.skip(!BEFORE, "only with O4_BEFORE=1");
  for (const stage of ["requested", "ready"] as StageKey[]) {
    const page = await stagePage(browser, stage);
    for (const scenario of SCENARIOS) {
      await applyScenario(page, stage, scenario);
      for (const width of [375, 1440]) {
        const tile = await openOverview(page, width);
        await tile.screenshot({
          path: join(
            shotDir,
            `before-tile-${stage === "ready" ? "with-changes" : "no-changes"}-${scenario.name}-${width}.png`,
          ),
        });
      }
    }
    await page.context().close();
  }
});

for (const stage of ["requested", "ready"] as StageKey[]) {
  test(`colours tile matrix — ${stage === "ready" ? "with Changes" : "without Changes"}`, async ({
    browser,
  }) => {
    test.skip(BEFORE);
    const page = await stagePage(browser, stage);
    for (const scenario of SCENARIOS) {
      await applyScenario(page, stage, scenario);
      for (const width of WIDTHS) {
        const tile = await openOverview(page, width);
        await expect(tile).toHaveAttribute("data-state", scenario.state);
        await expect(tile).toHaveAttribute(
          "href",
          scenario.state === "no_logo"
            ? "/admin?app=materials&item=logo"
            : "/admin?app=colours",
        );
        const palette = tile.getByTestId("admin-hub-colours-palette");
        await expect(palette).toHaveAttribute(
          "data-count",
          String(scenario.chips),
        );

        const m = await tile.evaluate((el) => {
          const chips = el.querySelectorAll(
            ".admin-hub-palette__chip:not(.admin-hub-palette__chip--slot)",
          ).length;
          const slots = el.querySelectorAll(
            ".admin-hub-palette__chip--slot",
          ).length;
          const headline =
            el.querySelector('[data-testid="admin-hub-colours-headline"]')
              ?.textContent ?? "";
          const holder = el.querySelector<HTMLElement>(
            '[data-testid="admin-hub-colours-logos"]',
          )!;
          const plates = Array.from(
            holder.querySelectorAll<HTMLElement>(
              ".hub-logo-mark, .admin-hub-colours-initials",
            ),
          ).filter((p) => p.checkVisibility());
          const contained = plates.every((mark) => {
            const img = mark instanceof HTMLImageElement ? mark : null;
            if (!img) return true;
            const box = holder.getBoundingClientRect();
            const r = img.getBoundingClientRect();
            const naturalRatio = img.naturalWidth / img.naturalHeight;
            // object-fit: contain → painted size is the largest box of the natural ratio inside the content box.
            const cs = getComputedStyle(img);
            const cw =
              r.width -
              parseFloat(cs.paddingLeft) -
              parseFloat(cs.paddingRight);
            const ch =
              r.height -
              parseFloat(cs.paddingTop) -
              parseFloat(cs.paddingBottom);
            return (
              cs.objectFit === "contain" &&
              r.left >= box.left - 0.5 &&
              r.top >= box.top - 0.5 &&
              r.bottom <= box.bottom + 0.5 &&
              r.right <= box.right + 0.5 &&
              cw > 0 &&
              ch > 0 &&
              Number.isFinite(naturalRatio)
            );
          });
          const card = el.querySelector<HTMLElement>(
            '[data-testid="admin-hub-colours-site-preview"]',
          );
          const book = el.querySelector<HTMLElement>(
            ".admin-hub-livep__book",
          );
          const body = el
            .querySelector<HTMLElement>(".admin-hub-colours-body")!
            .getBoundingClientRect().width;
          return {
            chips,
            slots,
            headline,
            plates: plates.length,
            contained,
            card: Boolean(card?.checkVisibility()),
            book: book
              ? {
                  bg: getComputedStyle(book).backgroundColor,
                  fg: getComputedStyle(book).color,
                }
              : null,
            body: Math.round(body),
            height: Math.round(el.getBoundingClientRect().height),
            pill:
              el.querySelector('[data-testid="admin-hub-colours-status"]')
                ?.textContent ?? "",
            guide:
              el.querySelector('[data-testid="admin-hub-colours-guidance"]')
                ?.textContent ?? "",
          };
        });
        expect(m.chips).toBe(scenario.chips);
        expect(
          m.chips + m.slots,
          "chip row always reserves five slots or shows the chips",
        ).toBe(scenario.chips || 5);
        const counted = /^(\d+) colours? found/.exec(m.headline);
        if (scenario.chips)
          expect(
            Number(counted?.[1]),
            `headline "${m.headline}" matches chips`,
          ).toBe(scenario.chips);
        expect(m.contained, "logo fits its slot, never cropped").toBe(true);
        expect(m.plates, "one logo, or the initials without one").toBe(1);
        expect(m.card, `website preview @${width} (body ${m.body})`).toBe(
          scenario.look && m.body >= 560,
        );
        findings.push(
          `${stage} ${scenario.name} @${width}: body ${m.body}px, h ${m.height}px, ${m.chips} chips, "${m.headline}", card ${m.card}, pill "${m.pill}", "${m.guide}"`,
        );

        // Preview phone: Main when set, otherwise the neutral surface.
        // (Before the website exists the preview tile shows a locked placeholder phone instead.)
        const phone = page.locator(
          ".admin-hub-phone__screen:not(.admin-hub-skel)",
        );
        if (await phone.count()) {
          const bg = await phone.first().evaluate((el) => {
            const probe = document.createElement("div");
            probe.style.background = "var(--surface-3)";
            el.parentElement!.appendChild(probe);
            const neutral = getComputedStyle(probe).backgroundColor;
            probe.remove();
            return { screen: getComputedStyle(el).backgroundColor, neutral };
          });
          expect(bg.screen).toBe(
            scenario.brand.brandPrimaryColour
              ? hexToRgb(scenario.brand.brandPrimaryColour)
              : bg.neutral,
          );
        }

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
        expect(
          overflow,
          `no horizontal scroll ${scenario.name} @${width}`,
        ).toBeLessThanOrEqual(0);
        const cls = await page.evaluate(
          () => (window as unknown as { __cls: number }).__cls,
        );
        expect(cls, `CLS ${scenario.name} @${width}`).toBeLessThan(0.05);

        const base = `${stage === "ready" ? "with-changes" : "no-changes"}-${scenario.name}-${width}`;
        await tile.screenshot({ path: join(shotDir, `tile-${base}.png`) });
        if (scenario.name === "draft")
          await page.screenshot({
            path: join(shotDir, `page-${base}.png`),
            fullPage: true,
          });
      }
      for (const width of [1440, 375]) {
        await openOverview(page, width);
        const axe = await new AxeBuilder({ page })
          .include('a[data-tile="colours"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        expect(
          axe.violations.map((v) => `${v.id}: ${v.nodes.length}`),
          `axe ${scenario.name} @${width}`,
        ).toEqual([]);
      }
    }
    await page.context().close();
  });
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

test("keyboard: one tab stop, visible focus ring, Space opens the app", async ({
  browser,
}) => {
  test.skip(BEFORE);
  const page = await stagePage(browser, "requested");
  await applyScenario(
    page,
    "requested",
    SCENARIOS.find((s) => s.name === "draft")!,
  );
  const tile = await openOverview(page, 1440);
  await tile.focus();
  const ring = await tile.evaluate((el) => {
    const cs = getComputedStyle(el);
    return {
      outline: cs.outlineStyle,
      width: cs.outlineWidth,
      inner: el.querySelectorAll("a, button, [tabindex]").length,
    };
  });
  expect(ring.outline).not.toBe("none");
  expect(ring.inner, "inner elements are not separately focusable").toBe(0);
  await page.screenshot({
    path: join(shotDir, "keyboard-focus-1440.png"),
    clip: (await tile.boundingBox())!,
  });
  await page.keyboard.press("Space");
  await expect(page.getByTestId("admin-hub-app")).toBeVisible();
  await page.context().close();
});

for (const width of [1440, 375]) {
  test(`live: save a draft, then send, in the Colours app — tile updates without reload at ${width}px`, async ({
    browser,
  }) => {
    test.skip(BEFORE);
    const page = await stagePage(browser, "requested");
    await applyScenario(page, "requested", { logo: "colour", brand: {} });
    const tile = await openOverview(page, width);
    await page.evaluate(
      () => ((window as unknown as { __noReload: boolean }).__noReload = true),
    );
    await expect(tile).toHaveAttribute("data-state", "not_started");
    await page.screenshot({
      path: join(shotDir, `live-0-not-started-${width}.png`),
      fullPage: width === 375,
    });

    const app = page.getByTestId("admin-hub-app");
    const close = async () => {
      await app.getByRole("button", { name: "Close" }).first().click();
      await expect(app).toHaveCount(0);
    };

    // The phone layout of the Colours app has no "Save draft" (Send only), so the draft step runs on desktop.
    if (width >= 768) {
      await tile.click();
      await expect(app).toBeVisible();
      // Wait for the in-browser extraction to pick Main / Accent before saving.
      await expect(app.getByRole("button", { name: "Save draft" })).toBeEnabled(
        { timeout: 20000 },
      );
      await page.waitForTimeout(1500);
      await app.getByRole("button", { name: "Save draft" }).click();
      await expect(app.getByRole("button", { name: "Saved" })).toBeVisible({
        timeout: 20000,
      });
      await close();
      await expect(tile).toHaveAttribute("data-state", "draft");
      await expect(tile.getByTestId("admin-hub-colours-status")).toHaveText(
        "Draft saved",
      );
      await expect(tile.getByTestId("admin-hub-colours-guidance")).toHaveText(
        "Saved as a draft — send it when you're happy",
      );
      const count = Number(
        await tile
          .getByTestId("admin-hub-colours-palette")
          .getAttribute("data-count"),
      );
      const headline =
        (await tile.getByTestId("admin-hub-colours-headline").textContent()) ??
        "";
      if (count) expect(headline).toContain(`${count} colour`);
      await page.screenshot({
        path: join(shotDir, `live-1-draft-${width}.png`),
        fullPage: width === 375,
      });
    }

    await tile.click();
    await expect(app).toBeVisible();
    await page.waitForTimeout(1500);
    await app
      .getByRole("button", { name: "Send colours to KERSIVO" })
      .first()
      .click();
    await page.getByRole("button", { name: "Yes, send to KERSIVO" }).click();
    await expect(app.getByText(/Sent to KERSIVO on/)).toBeVisible({
      timeout: 20000,
    });
    await close();
    await expect(tile).toHaveAttribute("data-state", "sent");
    await expect(tile.getByTestId("admin-hub-colours-status")).toHaveText(
      "Sent",
    );
    await expect(tile.getByTestId("admin-hub-colours-guidance")).toHaveText(
      /^Sent on \d{1,2} \w+ \d{4}\. Message us to change it\.$/,
    );
    await page.screenshot({
      path: join(shotDir, `live-2-sent-${width}.png`),
      fullPage: width === 375,
    });

    expect(
      await page.evaluate(
        () => (window as unknown as { __noReload?: boolean }).__noReload,
      ),
    ).toBe(true);
    const cls = await page.evaluate(
      () => (window as unknown as { __cls: number }).__cls,
    );
    findings.push(`live @${width}: CLS incl. app open/close ${cls.toFixed(4)}`);
    await page.context().close();
  });
}
