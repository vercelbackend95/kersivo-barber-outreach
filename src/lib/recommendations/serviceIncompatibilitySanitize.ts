import type { IncompatibilityTag } from './taxonomy';

/** Product-oriented exclusivity tags with no defined service-side scoring meaning. */
export const PRODUCT_ONLY_SERVICE_INCOMPATIBILITY_TAGS: IncompatibilityTag[] = [
  'FOR_SHORT_HAIR_ONLY',
  'FOR_LONG_HAIR_ONLY',
  'HAIR_ONLY',
  'BEARD_ONLY',
  'NOT_FOR_BEARD',
  'NOT_FOR_SHAVE',
  'POST_SHAVE_ONLY',
  'LEAVE_IN_ONLY',
  'RINSE_OUT_ONLY',
];

export function stripProductOnlyServiceIncompatibilities(
  tags: readonly IncompatibilityTag[],
): IncompatibilityTag[] {
  const stripped = tags.filter((tag) => !PRODUCT_ONLY_SERVICE_INCOMPATIBILITY_TAGS.includes(tag));
  return stripped.length > 0 ? stripped : ['UNKNOWN'];
}
