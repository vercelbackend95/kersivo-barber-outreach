# GA4 setup checklist (kersivo.co.uk)

Property **533127503**. These steps need the GA4 interface, so the code can't do them. Do them in this order. Steps 1 and 6 go together.

## What the code does (from the `analytics/clean-ga4` branch)

- **Internal traffic.** Visiting any page with `?internal=1` sets the `kersivo_internal` cookie (1 year) on that browser. From then on every page view and event from that browser carries `traffic_type=internal`. That includes page views after a link click without a reload (ClientRouter) and the first page view after someone accepts the cookie banner. `?internal=0` removes the mark. Pages not served from `kersivo.co.uk` / `www.kersivo.co.uk` (localhost, Vercel previews) are always tagged internal.
- **Server events skip internal devices.** A browser marked internal never has `signup_completed` or `saas_subscription_paid` sent for it.
- **No more admin / Shop Hub events.** `hub_*`, `launch_checklist_item_completed`, `launch_approved` and `site_live` no longer go to GA4. They are product usage, not marketing, and the database event log already records them (ops pages, hub timeline). The exception is `hub_add_menu_open` and `hub_add_menu_item`, which were only ever in GA4 and are no longer recorded anywhere.
- **`signup_completed`** is sent from the server when a new account gets its own shop. An invited team member joining an existing shop doesn't count. Param: `method` (`email` or `google`).
- **`saas_subscription_paid`** is now sent once, by the Stripe webhook, and only for **live-mode** payments. Stripe test-mode payments never reach GA4. The success page still sends the Google Ads purchase conversion, but no longer sends the GA4 event, so a payment isn't counted twice. Params: `transaction_id`, `value`, `currency`, `event_source=stripe_webhook`.
- Server events are only sent with the visitor's own GA client id, which needs Analytics consent. Where the session cookie is available they are also linked to the visitor's session, so the source / medium is kept.

### Environment variables (Vercel, project `kersivo-barber-outreach`)

Both are already set, **Production only**. Keep it that way.

| Name | Used for |
| --- | --- |
| `PUBLIC_GA4_MEASUREMENT_ID` | gtag in the browser and the server events |
| `GA4_MEASUREMENT_PROTOCOL_API_SECRET` | server events (Measurement Protocol). Created in GA4: Admin → Data streams → Web → Measurement Protocol API secrets |

`VERCEL_ENV` is set by Vercel automatically. Server events are only sent when it is `production`.

## 1. Internal traffic filter

1. On **every device and browser you use** (laptop Chrome, Safari, phone, tablet, the browser ChatGPT opens links in), open <https://kersivo.co.uk/?internal=1> once and accept Analytics cookies.
   - Do it again after you clear cookies, and every time you use a private / incognito window.
   - The parameter disappears from the address bar straight away. That is expected.
2. GA4 → **Admin → Data collection and modification → Data filters**.
3. Open **Internal Traffic**. It should be the filter on parameter `traffic_type` with value `internal`; if it isn't there, create it: type *Internal traffic*, operation *Exclude*, parameter value `internal`.
4. Leave it on **Testing** for a day and check it with step 6. In *Testing*, matching hits are labelled but not removed.
5. Switch it to **Active**. From then on, internal hits are **permanently** left out of reports. This can't be undone for past data.

You don't need the "Define internal traffic" IP rules under the data stream. The site sets `traffic_type` itself, and an IP rule would miss your phone on mobile data.

## 2. Key events

GA4 → **Admin → Data display → Key events → New key event**, and enter each name exactly:

- `preview_request_submitted`
- `fp_submit_success`
- `starter_signup_click`
- `saas_subscribe_click`
- `signup_completed`
- `saas_subscription_paid`

`starter_signup_click` and `saas_subscribe_click` are clicks (intent), not completions. In reports, read them alongside `signup_completed` and `saas_subscription_paid`, which are the real outcomes.

Optional: under **Admin → Data display → Custom definitions**, add event-scoped custom dimensions for `site_section`, `method` and `event_source` so they can be used in reports.

## 3. Channel group "AI assistants"

1. GA4 → **Admin → Data display → Channel groups → Create new channel group**. Copying the default one is easiest: it keeps every standard channel.
2. Name it, for example, *Channels incl. AI assistants*.
3. **Add new channel** → name `AI assistants` → condition **Source** *matches regex* `.*(chatgpt|perplexity|claude|gemini|copilot).*`
4. Drag `AI assistants` **above Referral**. Channels are matched top to bottom, so below Referral it would never match.
5. Save. Then pick this channel group in Acquisition reports with the dimension selector (*Session* / *First user* → your group name). It also applies to past data.

## 4. Annotation

On a report with a line chart, for example **Reports → Reports snapshot**, use the chart's annotation option → **Create annotation**. If your account shows it elsewhere, it is under **Admin → Data display → Annotations**.

- Title: `Homepage and comparison pages rebuilt`
- Dates: **13–14 Nov 2026**

## 5. Reading the old data (15 Oct – 13 Nov 2026)

Filters don't apply to data already collected. For that period, read reports with a comparison that leaves out:

- Session source `chatgpt.com` (most of it is the founder's own testing), and
- Landing page containing `internal=1`.

Treat `hub_*` events and the single `saas_subscription_paid` from that period as tests.

## 6. Check it in DebugView

1. Install **Tag Assistant** (<https://tagassistant.google.com>), connect to `https://kersivo.co.uk/?internal=1` and accept Analytics cookies on the banner.
2. GA4 → **Admin → Data display → DebugView**. Pick your device.
3. Check:
   - `page_view` carries the parameter `traffic_type` = `internal`.
   - Click a link on the site (no reload). The new `page_view` also has `traffic_type` = `internal`.
   - Click **Get my free preview** or a pricing button. The click event (e.g. `saas_subscribe_click`) has `traffic_type` = `internal`.
   - No `hub_*` events appear, even when you use the Shop Hub.
4. While the filter is in **Testing**, these hits also show the *Test data filter name* dimension in Explorations. After you switch it to **Active**, hits from your marked devices no longer show up in reports. Tag Assistant still shows what was sent, which is the way to debug later.

Server events (`signup_completed`, `saas_subscription_paid`) are deliberately **not** sent from devices marked internal, so they don't show up in your own DebugView. You'll see them in **Reports → Engagement → Events** after the first real signup or payment; GA4 can take up to 48 hours to show new event names. If one seems missing, check the Vercel runtime logs for `[analytics] server event failed`.
