# Neon backup & restore drill

## Source of truth

Production Postgres is **Neon**. We do **not** run a custom dump cron — Neon PITR / branching is the backup mechanism.

## Targets

| Metric | Target |
|--------|--------|
| RPO | ≤ 5 minutes (Neon PITR) |
| RTO | ≤ 2 hours for SEV-1 data restore to a verified branch |

## Quarterly restore drill

**Cadence:** once per calendar quarter (log date + result below).

### Steps

1. Neon Console → select production project.
2. Create a **branch** from a PITR timestamp ~1 hour ago (or latest).
3. Point a throwaway local/staging `DATABASE_URL` at the branch (pooled URL + `sslmode=require`).
4. Verify:
   - `ShopSettings` count > 0
   - Canary shop (`OPS_CANARY_SHOP_ID`) row exists
   - Recent `Booking` / `StripeWebhookEvent` sample readable
5. Run `npx prisma migrate status` (should be in sync).
6. **Destroy** the restore branch when done.
7. Record outcome in the table below.

### Drill log

| Date | Operator | PITR timestamp | Result | Notes |
|------|----------|----------------|--------|-------|
| _pending_ | | | | First drill after M02 |

## Incident restore (prod)

1. Incident commander approves restore window.
2. Prefer forward-fix if corruption is narrow.
3. Full restore: Neon restore/PITR to new branch → cutover only with explicit approval (DNS/env swap).
4. After cutover: replay failed Stripe webhooks; re-run synthetic booking.
