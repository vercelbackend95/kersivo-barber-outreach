# Self-employed barber tax calculator

Branch `tools/barber-tax-calculator`. New free tool at `/self-employed-barber-tax-calculator` for chair renters and self-employed barbers: what to put aside for tax each week, the Income Tax and Class 4 National Insurance for the year, and what is due on 31 January and 31 July.

Why: a self-employed barber's first Self Assessment bill (with the first payment on account on top) is the money question they ask most, and no UK tool answers it in barber terms (weekly takings, tips, chair rent). It also feeds the Making Tax Digital article and the chair rent calculator.

## The page

| Part | What it does |
|---|---|
| Form | Tax year (2026/27 "This tax year", 2025/26 "Due 31 January 2027"), England, Wales and NI or Scotland, weekly takings, weekly tips, weeks worked, weekly chair rent and weeks it is paid, other costs a month, and under "If it applies": employed pay and payments on account already made. |
| Results card | Per week and pence per £1 of takings, the bill breakdown (turnover, chair rent, other costs or the £1,000 trading allowance, profit, Income Tax, Class 4 NI, total bill, take-home), the January and July payments with their dates, and notes that show only when they apply (first year, Class 2, trading allowance, loss, VAT threshold). Copy summary and Print. |
| If you take more or less | The bill and the weekly amount at takings 20% lower, as entered and 20% higher. |
| Making Tax Digital | Whether the barber's turnover brings them into MTD from April 2027 or April 2028, with the three phases. Links to the MTD Insights article. |
| How to use, method, sources | Three steps, six method steps with the limits (it leaves out student loan repayments, the High Income Child Benefit Charge, pension contributions and Gift Aid, savings, dividends, property income and capital allowances) and every GOV.UK source with its checked date. |
| FAQ | 7 questions. The first quotes the engine's own example (default inputs: £24,340 profit, £3,060 bill), and a test keeps them in step. |
| Close | Support block ("Clients still booking by DM?" → `/pricing#plan`) and the shared `ComparisonFinalCta` (`placement="barber_tax_calculator"`). |

Mobile: a dock keeps the weekly figure on screen while the form is being edited. No storage, no cookies, no network. Analytics only with consent and without figures: `tax_calc_used`, `tax_calc_copied`.

## Rates (single source of truth)

`src/data/self-employed-tax-rates.ts`, checked on GOV.UK on 27 November 2026:

- Personal Allowance £12,570, tapered by £1 for every £2 over £100,000.
- England, Wales and NI: 20% / 40% / 45% (basic band £37,700 of taxable income, additional from £125,140).
- Scotland 2026/27: 19% to £3,967, 20% to £16,956, 21% to £31,092, 42% to £62,430, 45% to £125,140, 48% above (taxable income). 2025/26: starter to £2,827, basic to £14,921, the rest the same.
- Class 4 NI: 6% between £12,570 and £50,270, 2% above. Class 2: treated as paid when profit is at or above the small profits threshold (£7,105 in 2026/27, £6,845 in 2025/26); below it, voluntary £3.65 a week (£3.50).
- Payments on account: none if the bill is under £1,000 or more than 80% of tax was paid at source; otherwise half the bill each on 31 January and 31 July.
- Trading allowance £1,000. VAT registration threshold £90,000 (takings only).
- MTD: qualifying income (turnover) over £50,000 in 2024/25 → April 2026; over £30,000 in 2025/26 → April 2027; over £20,000 in 2026/27 → April 2028.

When HMRC changes a figure: update this file and `SELF_EMPLOYED_RATES_CHECKED_ISO`, run `npx vitest run src/lib/barberTaxCalculator src/lib/seo/barberTaxCalculatorPage.test.ts`, and move `BARBER_TAX_CALCULATOR_LAST_UPDATED_ISO`. A new tax year means a new entry in `SELF_EMPLOYED_TAX_YEARS` and `TAX_YEARS` (keep two years: the current one and the one whose bill is due next January).

## Files

New:
- `src/data/self-employed-tax-rates.ts`: rates, dates, sources.
- `src/lib/barberTaxCalculator/engine.ts` + `engine.test.ts` (27 tests): pure calculation.
- `src/lib/barberTaxCalculator/view.ts`: formatting and the slot/hidden map shared by the server render and the browser.
- `src/lib/barberTaxCalculator/initBarberTaxCalculator.ts`: browser wiring.
- `src/lib/seo/barberTaxCalculatorPage.ts` + `.test.ts`: copy, FAQ, JSON-LD (WebPage, WebApplication, BreadcrumbList, FAQPage).
- `src/components/barberTaxCalculator/TaxCalcField.astro`, `src/pages/self-employed-barber-tax-calculator/index.astro`.
- `src/styles/components/barber-tax-calculator.css`: builds on `price-calculator.css`; year and region choice, breakdown, payment dates.

Findability (changed):
- `/free-tools`: new group "Putting money aside for tax" (second), lead and description mention tax; page date 27 Nov 2026.
- Header "Free tools" menu (calculators: price, tax, no-show, chair rent) and footer Resources.
- Sitemap, `pageDates.ts`, `routeFamilies.ts` (marketing layout), `/llms.txt`.
- The Making Tax Digital article's related links now start with the calculator (`insightsLinking.ts`).
- Tests updated for the new order and dates: `marketingSitemap`, `marketingNavigation`, `insightsLinking`, `freeToolsDirectAnswers`.

No other page's title, meta, canonical or JSON-LD changed. No commercial terms touched; the tool page makes no product claims in its FAQ (tested).

## Screenshots

`/tmp/kersivo-shots/barber-tax-calculator/` (local): before and after of `/`, `/free-tools` and the open "Free tools" menu at 375 and 1440 px, plus the new page at 375 and 1440 px. No horizontal scroll at either width.

## After merge

- Search Console: request indexing for `https://kersivo.co.uk/self-employed-barber-tax-calculator` and `https://kersivo.co.uk/free-tools`. IndexNow picks both up on its next run.
- Before 6 April 2027: add 2027/28 rates when GOV.UK publishes them.
