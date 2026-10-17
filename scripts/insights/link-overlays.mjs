/**
 * Approved in-body link overlays for Insights display Markdown.
 * Phrases must appear verbatim in the Notion source. Applied after text-fidelity checks.
 * Never invent new factual claims — only wrap existing wording in crawlable links.
 */
export const INSIGHTS_LINK_OVERLAYS = {
  'google-reviews-barbershop-uk-rules': [
    {
      phrase: 'on your booking confirmation',
      href: '/barbershop-online-booking',
    },
    {
      phrase: 'reward rebooking or retention',
      href: '/insights/get-more-barbershop-clients-locally-uk',
    },
  ],
  'get-more-barbershop-clients-locally-uk': [
    {
      phrase: 'How you handle reviews matters here too',
      href: '/insights/google-reviews-barbershop-uk-rules',
    },
    {
      phrase: "can't easily book or see a price",
      href: '/barbershop-online-booking',
    },
  ],
  'barbershop-card-payment-fees-uk': [
    {
      phrase: 'what does a card payment actually cost me per service?',
      href: '/barber-software-cost-calculator',
    },
  ],
  'barbershop-gift-vouchers-uk': [
    {
      phrase: 'A voucher sold in December is a client you might gain in February',
      href: '/insights/get-more-barbershop-clients-locally-uk',
    },
  ],
};

/**
 * Wrap the first plain (non-linked) occurrence of each phrase.
 * Skips matches already inside Markdown links or HTML tags.
 */
export function applyInsightsLinkOverlays(markdown, slug) {
  const rules = INSIGHTS_LINK_OVERLAYS[slug];
  if (!rules?.length) return markdown;

  let output = markdown;
  for (const rule of rules) {
    const { phrase, href } = rule;
    if (!phrase || !href) continue;
    if (output.includes(`](${href})`) && output.includes(`[${phrase}](`)) continue;

    const start = findSafePhraseIndex(output, phrase);
    if (start < 0) continue;

    const before = output.slice(0, start);
    const after = output.slice(start + phrase.length);
    output = `${before}[${phrase}](${href})${after}`;
  }
  return output;
}

function findSafePhraseIndex(markdown, phrase) {
  let from = 0;
  while (from < markdown.length) {
    const idx = markdown.indexOf(phrase, from);
    if (idx < 0) return -1;

    const before = markdown.slice(Math.max(0, idx - 2), idx);
    const afterChar = markdown[idx + phrase.length] ?? '';
    // Skip if already a markdown link label: [phrase](
    if (before.endsWith('[') || markdown.slice(idx + phrase.length, idx + phrase.length + 2) === '](') {
      from = idx + phrase.length;
      continue;
    }
    // Skip inside HTML tags
    const lastOpen = markdown.lastIndexOf('<', idx);
    const lastClose = markdown.lastIndexOf('>', idx);
    if (lastOpen > lastClose) {
      from = idx + phrase.length;
      continue;
    }
    // Avoid mid-word false positives when phrase starts/ends with word chars
    const prev = markdown[idx - 1] ?? '';
    if (/\w/.test(prev) && /\w/.test(phrase[0])) {
      from = idx + phrase.length;
      continue;
    }
    if (/\w/.test(afterChar) && /\w/.test(phrase[phrase.length - 1])) {
      from = idx + phrase.length;
      continue;
    }
    return idx;
  }
  return -1;
}
