export type StarterPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export const ASSISTANT_STARTERS: StarterPrompt[] = [
  {
    id: 'raise-utilisation',
    label: 'Raise utilisation',
    prompt:
      'Our chair utilisation feels low. Using the real admin tabs (Reports, Bookings, Barbers), what should I check and change this week to raise utilisation?',
  },
  {
    id: 'cut-no-shows-admin',
    label: 'Cut no-shows',
    prompt:
      'How do I use Bookings, Clients, and Reports together to cut no-shows — including status hygiene, reliability tags, and what KPI to watch?',
  },
  {
    id: 'grow-retail-aov',
    label: 'Grow retail AOV',
    prompt:
      'How should I use Products, Orders, and Sales to grow retail AOV and attach after haircuts? Give Where / How / Results.',
  },
  {
    id: 'use-reliability',
    label: 'Use reliability scores',
    prompt:
      'How do I use client reliability scores and tags to protect peak slots and still look after good clients?',
  },
  {
    id: 'weekly-reports',
    label: 'Weekly Reports check',
    prompt:
      'What should I look at every week in Reports, and which other admin tabs should I open based on each KPI?',
  },
  {
    id: 'history-vs-bookings',
    label: 'History vs Bookings',
    prompt:
      'When should I use Bookings versus History in the admin? Walk me through what each sidebar section is for and the main controls.',
  },
  {
    id: 'mark-collected',
    label: 'Mark order collected',
    prompt:
      'A customer picked up a retail order in-shop. Where do I mark it as collected, and what statuses will I see?',
  },
  {
    id: 'barber-time-off',
    label: 'Barber time off',
    prompt:
      'How do I block a barber for a break or vacation so clients cannot book that time? Step-by-step in the Barbers section.',
  },
  {
    id: 'seo-title',
    label: 'SEO title & meta',
    prompt:
      'Draft a strong SEO title and meta description for my barbershop booking page. Assume we are an independent UK shop with fades, beard work, and online booking on our own domain.',
  },
];

/** Fixed demo reply when public admin demo cannot call OpenAI. */
export function buildDemoAssistantReply(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (
    lower.includes('utili')
    || lower.includes('kpi')
    || lower.includes('perform')
    || lower.includes('results')
    || lower.includes('osiag')
    || (lower.includes('grow') && !lower.includes('google'))
  ) {
    return [
      '**(Demo preview)** Results play for stronger utilisation:',
      '',
      '1. **Where** — Reports (7 days) → read Utilisation, No-show, Peak day/hour.',
      '2. **How** — Barbers: hours On/Off match peaks; TIME OFF for breaks/vacation. Bookings: fill Timeline gaps; mark No Show / Cancel honestly.',
      '3. **Results** — cleaner supply + fewer dead chairs. Habit: Monday Reports check, then fix hours the same day.',
      '',
      'Follow-up: Clients tags for repeat no-shows. Live AI streams fuller coaching with `OPENAI_API_KEY` on real admin.',
    ].join('\n');
  }

  if (lower.includes('aov') || (lower.includes('retail') && (lower.includes('grow') || lower.includes('attach') || lower.includes('sales')))) {
    return [
      '**(Demo preview)** Grow retail AOV / attach:',
      '',
      '1. **Where** — Products (Featured + images) → Orders (Paid → Collected) → Sales (Revenue £ / AOV / leaderboard).',
      '2. **How** — Feature aftercare that pairs with fades; offer one Featured SKU after Completed bookings; clear Paid pickups same day.',
      '3. **Results** — higher attach and trustworthy Sales. Habit: weekly Sales 7d after your Reports review.',
      '',
      'Demo canned reply — production Assistant expands this live.',
    ].join('\n');
  }

  if (
    lower.includes('collected')
    || (lower.includes('order') && !lower.includes('reorder'))
    || (lower.includes('mark') && lower.includes('paid'))
  ) {
    return [
      '**(Demo preview)** Fulfil a pickup order like this:',
      '',
      '1. **Where** — sidebar → **Orders**.',
      '2. **How** — Find the **Paid** order → expand if needed → **Mark as Collected** after pickup.',
      '3. **Results** — fewer lost pickups and cleaner Sales KPIs. Habit: zero stale Paid at close.',
      '',
      'Live AI answers need `OPENAI_API_KEY` on a real admin session.',
    ].join('\n');
  }

  if (lower.includes('history') || (lower.includes('booking') && lower.includes('vs'))) {
    return [
      '**(Demo preview)** Use the right bookings surface:',
      '',
      '- **Bookings** — live day board: Timeline/List, day filters, No Show / Cancel / Reschedule → protects utilisation.',
      '- **History** — past appointments for patterns → tag Clients.',
      '- **Reports** — range analytics (utilisation, no-shows, leaderboard).',
      '',
      'Full streaming answers on protected admin with OpenAI configured.',
    ].join('\n');
  }

  if (
    lower.includes('time off')
    || lower.includes('vacation')
    || lower.includes('break')
    || (lower.includes('barber') && (lower.includes('block') || lower.includes('hours')))
  ) {
    return [
      '**(Demo preview)** Block chair time in **Barbers**:',
      '',
      '1. **Where** — Barbers → barber profile → TIME OFF / working hours.',
      '2. **How** — **Break** for short blocks; **Vacation** for longer; On/Off shift for regular weeks.',
      '3. **Results** — stops overbooking empty chairs → better utilisation and less cancel noise.',
      '',
      'Canned demo reply grounded in the admin results playbook.',
    ].join('\n');
  }

  if (lower.includes('client') || lower.includes('reliability') || lower.includes('tags')) {
    return [
      '**(Demo preview)** Client CRM for results:',
      '',
      '1. **Where** — sidebar → **Clients** (search with `/`).',
      '2. **How** — Read Reliability, Tags, Notes; Message quiet VIPs; tag no-show-risk.',
      '3. **Results** — deposits/reminders for risk clients; priority care for high spend → fewer no-shows, better AOV.',
      '',
      'Production Assistant streams fuller answers when OpenAI is configured.',
    ].join('\n');
  }

  if (
    lower.includes('report')
    || lower.includes('utilisation')
    || lower.includes('utilization')
    || lower.includes('no-show')
  ) {
    return [
      '**(Demo preview)** Weekly Reports rhythm:',
      '',
      '1. **Where** — sidebar → **Reports** (7 or 30 days).',
      '2. **How** — Check Utilisation, Cancelled breakdown, No-show, AOV, peaks, popular service, busiest barber.',
      '3. **Results** — each KPI points to a lever: hours (Barbers), status hygiene (Bookings), tags (Clients), Featured (Services/Products).',
      '',
      'Ignore “Small sample” when you have fewer than ~10 bookings in range.',
    ].join('\n');
  }

  if (lower.includes('service') && (lower.includes('add') || lower.includes('new') || lower.includes('catalogue') || lower.includes('catalog') || lower.includes('price'))) {
    return [
      '**(Demo preview)** Services for AOV + utilisation:',
      '',
      '1. **Where** — sidebar → **Services**.',
      '2. **How** — Price £ + duration minutes + barber assignment; Featured for hero cuts; deactivate zombies.',
      '3. **Results** — better mix and chair-time math. Habit: monthly align top services with Reports “most popular”.',
      '',
      'Demo preview — live model on real admin with `OPENAI_API_KEY`.',
    ].join('\n');
  }

  if (lower.includes('seo') || lower.includes('meta') || lower.includes('google')) {
    return [
      '**(Demo preview)** Here’s a solid local-SEO starting point for a UK barbershop:',
      '',
      '1. **Title** — `{Shop name} | Barbers in {Area} — Book online` (keep under ~60 characters).',
      '2. **Meta** — One sentence on services + own-domain booking + area (under ~155 characters).',
      '3. **Google Business** — Correct category (Barber shop), hours, photos of the chair line, and reply to every review within 48 hours.',
      '',
      'Live AI answers need a configured OpenAI key on a real admin session.',
    ].join('\n');
  }

  if (lower.includes('retail') || lower.includes('product') || lower.includes('pomade')) {
    return [
      '**(Demo preview)** Retail tip for barbershop pickup:',
      '',
      '- **Products** — Featured + images for aftercare; keep Active honest.',
      '- Offer one Featured SKU after a Completed cut → attach rate.',
      '- Confirm movement in **Sales** (AOV / units / leaderboard).',
      '',
      'Full AI drafting is available on the protected admin when OpenAI is configured.',
    ].join('\n');
  }

  if (lower.includes('deposit') || lower.includes('sms')) {
    return [
      '**(Demo preview)** No-show reduction pattern that fits Kersivo shops:',
      '',
      '- Deposits on peak slots; SMS confirm + day-before.',
      '- Mark **No Show** in **Bookings** promptly; tag risk in **Clients**.',
      '- Watch No-show + Utilisation in **Reports** weekly.',
      '',
      'This is a canned demo reply; production Assistant streams live advice.',
    ].join('\n');
  }

  return [
    '**(Demo preview)** I’m the Kersivo Assistant — trained on every admin tab and how each feature drives utilisation, no-shows, AOV, retail attach, and reliability.',
    '',
    'In this public demo I return sample guidance only (no live model calls). On your real admin with `OPENAI_API_KEY` set, this chat streams full Where / How / Results coaching.',
    '',
    'Try a starter: Raise utilisation, Cut no-shows, Grow retail AOV, or Weekly Reports check.',
  ].join('\n');
}
