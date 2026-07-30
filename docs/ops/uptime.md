# Uptime (external)

App synthetic (deep): Vercel Cron → `GET /api/ops/synthetic-booking` every 15 minutes (homepage + canary availability).

## External HTTP uptime (Faza C)

Configure **Better Stack**, **Checkly**, or **Vercel Monitoring** with:

| Check | URL | Expect |
|-------|-----|--------|
| Marketing home | `https://kersivo.co.uk/` | 200 |
| Canary book page | `https://kersivo.co.uk/book/{OPS_CANARY_SHOP_ID}` | 200 |
| Do **not** probe | `POST /api/shop/webhook` | N/A (signature required) |

Route alerts to the same Slack channel as `OPS_SLACK_WEBHOOK_URL`.

## Ownership

Update canary shop id when rotating test tenants. Keep canary **paid** and accepting public bookings.
