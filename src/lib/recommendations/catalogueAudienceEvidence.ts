export type CatalogueAudienceSource = {
  name: string;
  description: string | null;
  category?: string | null;
};

/** Join possessives before stripping punctuation so Children's → childrens. */
function normalizeAudienceText(source: CatalogueAudienceSource): string {
  const raw = [source.name, source.description ?? ''].join(' ');
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/&/g, ' and ')
    .replace(/['\u2019\u2018\u02BC]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const WEAK_FAMILY_PHRASES = [
  /\bfamily friendly\b/g,
  /\bsafe around children\b/g,
  /\bsafe for the family\b/g,
  /\bsafe for family\b/g,
  /\bsafe for kids\b/g,
  /\bsuitable for adults and children\b/g,
];

const CHILD_PRODUCT_PATTERNS = [
  /\bkids?\b/,
  /\bchildrens?\b/,
  /\bfor kids\b/,
  /\bfor children\b/,
  /\bformulated for kids\b/,
  /\bformulated for children\b/,
  /\bdesigned for kids\b/,
  /\bdesigned for children\b/,
  /\bunder\s*1[26]s?\b/,
  /\bjunior\b/,
];

const CHILD_SERVICE_PATTERNS = [
  /\bkids?\s+cut\b/,
  /\bchildrens?\s+cut\b/,
  /\bjunior\s+cut\b/,
  /\bfor under\s*1[26]s?\b/,
  /\bunder\s*1[26]s?\b/,
];

/** Remove weak non-exclusive family copy before testing strong child evidence. */
function stripWeakFamilyPhrases(text: string): string {
  let out = text;
  for (const pattern of WEAK_FAMILY_PHRASES) {
    out = out.replace(pattern, ' ');
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Strong child-only product marketing evidence from catalogue text. */
export function isChildOnlyProduct(source: CatalogueAudienceSource): boolean {
  const text = normalizeAudienceText(source);
  if (!text) return false;

  const nameNorm = normalizeAudienceText({ name: source.name, description: null });
  if (CHILD_PRODUCT_PATTERNS.some((p) => p.test(nameNorm))) return true;

  // Strip weak family phrases so they cannot suppress strong child evidence elsewhere.
  const withoutWeak = stripWeakFamilyPhrases(text);
  if (!withoutWeak) return false;
  return CHILD_PRODUCT_PATTERNS.some((p) => p.test(withoutWeak));
}

/** Conservative child-service recognition from catalogue text. */
export function isChildService(source: CatalogueAudienceSource): boolean {
  const text = normalizeAudienceText(source);
  if (!text) return false;
  return CHILD_SERVICE_PATTERNS.some((p) => p.test(text));
}

export function audienceMismatchChildOnly(
  serviceSource: CatalogueAudienceSource,
  productSource: CatalogueAudienceSource,
): boolean {
  return isChildOnlyProduct(productSource) && !isChildService(serviceSource);
}
