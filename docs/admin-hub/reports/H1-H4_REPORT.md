# H1–H4 — real admin in the preview hub

Stacked on `main` @ `ebb3aeed`. PRs: H1 #194 · H2 #195 · H3 #196 · H4 this branch (`h4-hub-qa-security`).

Goal: the preview-hub owner manages Team, Services and Products on the **real** KERSIVO screens, against the **draft shop**. After payment the same screens stay; the full menu appears.

## What shipped

| Batch | What |
| --- | --- |
| **H1** | `ks_hub` is tenant access via `resolveHubAdminAccess`. Middleware allowlist (`HUB_ADMIN_API_ALLOWLIST`). Permissions `catalog.manage`, `team.read`, `retail.manage`. Invites and restricted routes denied. Owner-edit events debounced. |
| **H2** | `/admin/team`, `/admin/services`, `/admin/products` render `BookingsAdminPanel` (blocks), `ServicesAdminPanel`, `ShopAdminPanel` inside `PreviewHubFrame` / `AdminLayout mode="preview"`. Three sidebar groups. Hide LIVE, invites, Orders, Sales. Product create does not complete retail onboarding. |
| **H3** | Every hub entry (setup card, tiles, `?app=services\|team`) goes to those paths. Products row added. Hub-only Services & prices / Team apps removed; review POST for those kinds is 410. Setup-card done rules use draft-shop counts. |
| **H4** | End-to-end QA + security review. Inventory walker over every `/api/admin/*` file. Cross-tenant, cookie, CSRF, outbound and under-construction checks. Conversion + paid-admin regression. Spec + this report. |

One interface: those three panels are not forked or restyled. Only pre-payment behaviour is gated.

## Access model (now)

1. Valid owner or operator `ks_hub` (operator needs a live ops session) + ownerless draft + stage requested / designing / review → `via: 'hub'`, `shopId` = draft shop.
2. Middleware: hub-only request + path not on the allowlist → 403, then origin gate.
3. Better Auth wins. Converted-not-live owner → hub **page** (launch phase) but **not** hub admin APIs (those stay preview-stage only). Live owner → full admin.
4. Leave preview clears the cookie. Expired / rejected / anonymised / owned draft → no hub admin access.

See `docs/admin-hub/ADMIN_HUB_SPEC.md` §2, §3, §5, §6 and `docs/admin-hub/reports/H4_SECURITY.md`.

## Security results

Full table and walk: [H4_SECURITY.md](./H4_SECURITY.md).

| Check | Result |
| --- | --- |
| Disk inventory vs allowlist | 126 method+path pairs; **31 allow / 95 deny**. Unit test fails if they drift. |
| Live `ks_hub` walk | H4 Playwright hits every pair. Allowlisted → not 403 (2xx/4xx). Else 403. |
| Cross-tenant | Foreign `shopId` on create/list/patch lands on cookie shop A only. |
| Cookie states | Expired / converted-cookie / operator-without-session / leave-preview → no API access. Rejected token → 404, no cookie. |
| CSRF | Same-origin Origin allowed without Referer. Missing / foreign Origin → 403. Gate runs after the allowlist. |
| Outbound | No email/SMS/Stripe imports on allowlisted files. Invite 403. QA email log + Stripe stub unchanged during hub writes. |
| Public / bookable | After hub create of H4 Fade / H4 Clay: draft still paused, `retailEnabled` false, `/book/{id}` under construction. |

**Finding (founder):** Leave preview does not revoke the HMAC. A captured cookie still verifies until expiry. See H4_SECURITY.md finding 1.

## Conversion

`adoptPreviewDraftShop` takes ownership only (`ownerUserId`, onboarding complete, OWNER `ShopMember`). It does not copy or recreate services, barbers or products, and it does not flip pause / retail / payment mode.

QA converted shop (filled, then adopted at seed): paid session still has one **Skin fade**, one **Beard trim**, **Alex Reed**, **Jordan Cole** — no duplicates. Live owner is not hub-blocked on `POST /api/admin/team/invite`.

Hub writes (H4 Fade, H4 Clay) stay on the Ready draft until that request is paid. They are the same rows the paid admin will show.

## UX

Shots: `/tmp/kersivo-shots/h4/` (Windows `C:/tmp/kersivo-shots/h4/`).

| File | What |
| --- | --- |
| `overview-{375,768,1024,1440}.png` | Hub overview + “Set up your website” card |
| `services-*.png` | Real Services panel, Services active |
| `team-*.png` | Real Team panel, Team active |
| `products-*.png` | Real Products panel, Products active |
| `keyboard-focus-1440.png` | Visible `:focus-visible` |
| `allowlist.md` / `allowlist-live.json` | Live walk table |

Checked at 375 / 768 / 1024 / 1440: no horizontal scroll; sidebar groups + active states from 1024 up; mobile top chrome below 1024; `prefers-reduced-motion: reduce`. Empty-state copy is the paid panels’ own copy (QA Ready shop is pre-filled, so shots show a catalogue, not a blank shop).

## Paid admin regression

`AdminLayout.menu.test.tsx` full-mode snapshot unchanged: Booking system (Bookings, Team, Reports, Clients, Services) · Shop / Retail (Products, Orders, Sales) · Assistant.

Live shop owner: no `.admin-hub-content`; sidebar still has Bookings, Reports, Clients, Orders, Sales, Assistant. Invites are not hub-blocked.

## Spec

`docs/admin-hub/ADMIN_HUB_SPEC.md` updated: §2.3 allowlist access model; §3 seven-item `AdminLayout` nav; §5 setup card rows to real paths + Products; §6 services/team are not apps.

## Founder decisions

1. **HMAC replay after Leave preview** — accept (document) or add issued-at / epoch revocation so a captured cookie dies and the email link still works.
2. **Hub Full-capability grant** — `via === 'hub'` is treated as Full for product gates without writing a plan. Needed for Products. The shop still has no public booking entitlement.
3. Merge H1→H4 only after this PR’s GitHub Actions `build` and the Vercel preview (`kersivo-barber-outreach`) are green. Do not merge from the agent.

## Checks

| Check | Result |
| --- | --- |
| `npm run claims:check` | pass |
| H4 / conversion / AdminLayout menu / hubAdminAccess | 41 passed |
| H4 Playwright (`-g H4:`) | 3 passed (allowlist walk, conversion + paid menu, UX 375–1440) |
| `npm test` | 6109 passed; known `financialEndpoints` MANAGER 403 timed out once; 25/25 alone |
| `npm run typecheck` | 0 errors |
| `npm run build` | pass |
