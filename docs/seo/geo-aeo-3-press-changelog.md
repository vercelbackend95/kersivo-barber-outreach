# GEO/AEO stage 3 (code, items 2–3): press materials

Branch `seo/geo-aeo-3-press`. Plan: `docs/seo/GEO-AEO-PLAN.md`, stage 3, code items 2 and 3. Item 1 ("Powered by KERSIVO" loop) waits for the founder's decision on look and opt-out.

## What changed

| File | Change |
|---|---|
| `src/lib/seo/feesReport.ts` | `FEES_REPORT_PRESS_SUMMARY`: a ready-to-quote paragraph with edition and date, built only from figures already in the report tables, ending with the disclosure that KERSIVO sells booking software. `buildFeesReportCsv()`: every figure from the three tables, one per row (`table,system,detail,input,value_gbp,note`), UTF-8 with BOM so Excel shows £. Dataset JSON-LD gets `distribution` (DataDownload, text/csv). |
| `src/pages/barber-booking-fees-uk/fees.csv.ts` | New prerendered file `/barber-booking-fees-uk/fees.csv`. |
| `src/pages/barber-booking-fees-uk/index.astro`, `data-report.css` | New "For writers and press" card under "How to cite" (`#press`): the paragraph with a Copy button, "Download the data (CSV)" (`data-track="fees_report_csv_download"`), CC BY 4.0 note (the licence already declared in the Dataset JSON-LD), link to `/about#press`. Copy script now handles both copy buttons. |
| `src/pages/about.astro`, `aboutPage.ts` | New "For press and writers" section (`#press`) after "KERSIVO at a glance": how to write the name, the one-sentence entity description, five existing logo files (horizontal lockup for light and dark backgrounds, SVG and PNG, K mark PNG), the fees report and CSV, press contact email. No founder name, photo or "our team". |
| `src/pages/llms.txt.ts` | CSV listed under Comparisons; the About line mentions press facts. |
| Tests | `feesReport.test.ts`: CSV row count, header, every figure present, prerendered route, Dataset download, quotable paragraph uses only table figures and carries the disclosure. `aeoGeoFoundation.test.ts`: press section content, no founder wording, every logo file exists. |

No new claims, numbers or prices: the paragraph and CSV are derived from the same constants as the page. The report's edition and "Updated" date are unchanged because the figures are unchanged.

## Why a section on `/about` and not a `/press` page

The plan allowed either. A separate page would be thin (name, description, logos, one report); on `/about` it sits next to the entity facts that AI assistants and writers already read. It can move to `/press` later when there is more to put there (directory profiles, videos from stage 3 "Ty").

## Open questions for the founder

- The CSV is offered under CC BY 4.0, the licence already stated in the Dataset JSON-LD. Change both if you want a different licence.
- "KERSIVO, written in capitals" is taken from how the site writes the name; JSON-LD keeps `alternateName: Kersivo`.

## Screenshots

`C:/tmp/kersivo-shots/geo-aeo-3-press/`: `before-` and `after-fees-cite-{375,768,1024,1440}.png` (fees report from "How to cite" down), `before-` and `after-about-press-{375,768,1024,1440}.png` (`/about` from "At a glance" down). Before = production (kersivo.co.uk), after = local dev server on this branch. No horizontal scroll at any width.

## After merge (founder)

- Request indexing of `/barber-booking-fees-uk` and `/about` in GSC and Bing.
- Use the paragraph and CSV in the stage 3 pitches ("best barber booking software UK" articles, `ai-visibility-playbook.md` section 4).
