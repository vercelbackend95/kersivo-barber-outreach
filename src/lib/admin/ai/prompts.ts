export type StarterPrompt = {
  id: string;
  label: string;
  prompt: string;
};

export const ASSISTANT_STARTERS: StarterPrompt[] = [
  {
    id: 'seo-title',
    label: 'SEO title & meta',
    prompt:
      'Draft a strong SEO title and meta description for my barbershop booking page. Assume we are an independent UK shop with fades, beard work, and online booking on our own domain.',
  },
  {
    id: 'google-business',
    label: 'Google Business',
    prompt:
      'Give me a practical checklist to improve our Google Business Profile for Maps discovery — categories, photos, posts, and review replies — for a UK barbershop.',
  },
  {
    id: 'retail-copy',
    label: 'Retail product copy',
    prompt:
      'Write short retail product copy for a barbershop pomade we sell for pickup in-shop. Include name ideas, a 1-line pitch, and a short description that pairs with aftercare after a fade.',
  },
  {
    id: 'no-shows',
    label: 'Cut no-shows',
    prompt:
      'How should we use deposits and SMS reminders to reduce no-shows without scaring regulars? Give a clear policy outline for a 4–6 chair UK shop.',
  },
  {
    id: 'barber-schedule',
    label: 'Barber schedule tips',
    prompt:
      'Suggest how to set barber working hours and buffers so we protect chair utilisation but still leave room for walk-ins on busy Saturdays.',
  },
  {
    id: 'switch-platforms',
    label: 'Leaving Booksy/Fresha',
    prompt:
      'Explain how switching from Booksy or Fresha to a branded Kersivo booking site works for clients and for our team — what stays the same and what we should prepare before go-live.',
  },
];

/** Fixed demo reply when public admin demo cannot call OpenAI. */
export function buildDemoAssistantReply(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  if (lower.includes('seo') || lower.includes('meta') || lower.includes('google')) {
    return [
      '**(Demo preview)** Here’s a solid local-SEO starting point for a UK barbershop:',
      '',
      '1. **Title** — `{Shop name} | Barbers in {Area} — Book online` (keep under ~60 characters).',
      '2. **Meta** — One sentence on services + own-domain booking + area (under ~155 characters).',
      '3. **Google Business** — Correct category (Barber shop), hours, photos of the chair line, and reply to every review within 48 hours.',
      '',
      'Live AI answers need a configured OpenAI key on a real admin session — this demo shows the Assistant UI only.',
    ].join('\n');
  }

  if (lower.includes('retail') || lower.includes('product') || lower.includes('pomade')) {
    return [
      '**(Demo preview)** Retail tip for barbershop pickup:',
      '',
      '- Lead with the finish (“matte hold, no shine”) not the brand jargon.',
      '- Pair the product with a service moment (“after your fade”).',
      '- Keep the description under ~40 words so it reads at the till and on mobile.',
      '',
      'Full AI drafting is available on the protected admin when OpenAI is configured.',
    ].join('\n');
  }

  if (lower.includes('no-show') || lower.includes('deposit') || lower.includes('sms')) {
    return [
      '**(Demo preview)** No-show reduction pattern that fits Kersivo shops:',
      '',
      '- Take a modest deposit on peak slots.',
      '- Send SMS reminders (booking confirm + day-before).',
      '- Keep the policy short and visible at booking — regulars accept clarity.',
      '',
      'This is a canned demo reply; production Assistant streams live advice.',
    ].join('\n');
  }

  return [
    '**(Demo preview)** I’m the Kersivo Assistant — built for barbershop SEO, your branded site, retail pickup, and day-to-day barber ops.',
    '',
    'In this public demo I return sample guidance only (no live model calls). On your real admin with `OPENAI_API_KEY` set, this chat streams full advisory answers.',
    '',
    'Try a starter chip: SEO title, Google Business, retail copy, or cutting no-shows.',
  ].join('\n');
}
