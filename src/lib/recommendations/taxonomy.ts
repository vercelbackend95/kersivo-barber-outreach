/**
 * Canonical semantic taxonomy V1 for Smart Retail Recommendations.
 * Distinct from Prisma ProductCategory (catalogue organisation).
 */

export const TARGET_AREAS = [
  'HAIR',
  'BEARD',
  'MOUSTACHE',
  'SCALP',
  'FACE',
  'SHAVE',
  'TOOLS_ACCESSORIES',
  'GENERAL_GROOMING',
  'UNKNOWN',
] as const;
export type TargetArea = (typeof TARGET_AREAS)[number];

export const HAIR_LENGTHS = [
  'SHORT',
  'MEDIUM',
  'LONG',
  'ANY',
  'NOT_APPLICABLE',
  'UNKNOWN',
] as const;
export type HairLengthSuitability = (typeof HAIR_LENGTHS)[number];

export const SERVICE_TECHNIQUES = [
  'SKIN_FADE',
  'TAPER_FADE',
  'SCISSOR_CUT',
  'CLIPPER_CUT',
  'BUZZ_CUT',
  'BEARD_TRIM',
  'BEARD_SCULPT',
  'HOT_TOWEL_SHAVE',
  'LINE_UP',
  'WASH_STYLE',
  'SCALP_CLEANSE',
  'FACIAL_GROOMING',
  'COMBO_HAIR_BEARD',
  'COLOUR_GREY_BLEND',
  'UNKNOWN',
] as const;
export type ServiceTechnique = (typeof SERVICE_TECHNIQUES)[number];

export const SERVICE_OUTCOMES = [
  'SHAPE_STRUCTURE',
  'TEXTURE_DEFINITION',
  'VOLUME',
  'NEAT_FINISH',
  'BEARD_DEFINITION',
  'SKIN_COMFORT_POST_SHAVE',
  'HYDRATION',
  'OIL_CONTROL',
  'UNKNOWN',
] as const;
export type ServiceOutcome = (typeof SERVICE_OUTCOMES)[number];

export const PRODUCT_FAMILIES = [
  'POMADE',
  'CLAY',
  'WAX',
  'GEL',
  'CREAM',
  'SPRAY',
  'POWDER',
  'OIL',
  'BALM',
  'BUTTER',
  'WASH_SHAMPOO',
  'CONDITIONER',
  'MASK_TREATMENT',
  'AFTERSHAVE_BALM',
  'AFTERSHAVE_SPLASH',
  'MOISTURISER',
  'TOOL',
  'GIFT_SET',
  'UNKNOWN',
] as const;
export type ProductFamily = (typeof PRODUCT_FAMILIES)[number];

export const PRODUCT_BENEFITS = [
  'HOLD',
  'MATTE_FINISH',
  'SHINE_FINISH',
  'TEXTURE',
  'VOLUME',
  'FRIZZ_CONTROL',
  'BEARD_SOFTENING',
  'BEARD_SHAPE',
  'POST_SHAVE_COMFORT',
  'CLEANSING',
  'DETANGLING',
  'UNKNOWN',
] as const;
export type ProductBenefit = (typeof PRODUCT_BENEFITS)[number];

export const HOLD_STRENGTHS = ['NONE', 'LIGHT', 'MEDIUM', 'STRONG', 'UNKNOWN'] as const;
export type HoldStrength = (typeof HOLD_STRENGTHS)[number];

export const FINISH_TYPES = ['MATTE', 'NATURAL', 'SHINE', 'UNKNOWN'] as const;
export type FinishType = (typeof FINISH_TYPES)[number];

export const AFTERCARE_NEEDS = [
  'DAILY_STYLING',
  'BEARD_DAILY',
  'POST_SHAVE_SOOTHING',
  'SCALP_ROUTINE',
  'NONE',
  'UNKNOWN',
] as const;
export type AftercareNeed = (typeof AFTERCARE_NEEDS)[number];

export const INCOMPATIBILITY_TAGS = [
  'FOR_LONG_HAIR_ONLY',
  'FOR_SHORT_HAIR_ONLY',
  'BEARD_ONLY',
  'HAIR_ONLY',
  'POST_SHAVE_ONLY',
  'NOT_FOR_BEARD',
  'NOT_FOR_SHAVE',
  'LEAVE_IN_ONLY',
  'RINSE_OUT_ONLY',
  'UNKNOWN',
] as const;
export type IncompatibilityTag = (typeof INCOMPATIBILITY_TAGS)[number];

export const RETAIL_NEEDS = [
  'HAIR_STYLING_CONTROL',
  'HAIR_TEXTURE_DEFINITION',
  'HAIR_VOLUME',
  'HAIR_SMOOTHING_FRIZZ_CONTROL',
  'HAIR_SHINE_POLISH',
  'HAIR_CURL_DEFINITION',
  'HAIR_HEAT_PROTECTION',
  'HAIR_CLEANSING',
  'HAIR_CONDITIONING',
  'SCALP_CARE',
  'BEARD_CLEANSING',
  'BEARD_SOFTENING',
  'BEARD_SHAPING',
  'MOUSTACHE_STYLING',
  'SHAVE_PREPARATION',
  'POST_SHAVE_SOOTHING',
  'FACE_CLEANSING',
  'FACE_MOISTURISING',
  'COLOUR_MAINTENANCE',
  'GROOMING_TOOL',
  'GIFTING',
  'UNKNOWN',
] as const;
export type RetailNeed = (typeof RETAIL_NEEDS)[number];

export const RETAIL_NEED_DEFINITIONS = {
  HAIR_STYLING_CONTROL: 'Hold, shape or general control of hair styling at home.',
  HAIR_TEXTURE_DEFINITION: 'Separation and visible texture in styled hair.',
  HAIR_VOLUME: 'Lift, body or fullness in hair styling.',
  HAIR_SMOOTHING_FRIZZ_CONTROL: 'Smoothing, soft control or frizz reduction in hair.',
  HAIR_SHINE_POLISH: 'Shine or polished finish in hair styling.',
  HAIR_CURL_DEFINITION: 'Maintenance or definition of curls and waves.',
  HAIR_HEAT_PROTECTION: 'Protection associated with heated styling tools.',
  HAIR_CLEANSING: 'Shampooing or clarifying hair.',
  HAIR_CONDITIONING: 'Softness, detangling or conditioning of hair.',
  SCALP_CARE: 'Routine scalp cleansing, exfoliation or maintenance.',
  BEARD_CLEANSING: 'Washing or cleansing the beard.',
  BEARD_SOFTENING: 'Softening or conditioning beard hair.',
  BEARD_SHAPING: 'Controlling or shaping the beard.',
  MOUSTACHE_STYLING: 'Hold or shaping specifically for a moustache.',
  SHAVE_PREPARATION: 'Products used before or during shaving.',
  POST_SHAVE_SOOTHING: 'Products used after shaving for comfort.',
  FACE_CLEANSING: 'Cleansing facial skin.',
  FACE_MOISTURISING: 'Routine facial moisturising.',
  COLOUR_MAINTENANCE: 'Maintenance of coloured or grey-blended hair.',
  GROOMING_TOOL: 'Physical grooming tool or accessory.',
  GIFTING: 'Product primarily sold as a gift or set.',
  UNKNOWN: 'Insufficient evidence to assign a supported retail need.',
} as const satisfies Record<RetailNeed, string>;

export function isEnumValue<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function clampToEnum<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return isEnumValue(values, value) ? value : fallback;
}

export function clampEnumArray<T extends string>(values: readonly T[], input: unknown, fallback: T): T[] {
  if (!Array.isArray(input) || input.length === 0) return [fallback];
  const unique = [...new Set(input.filter((v) => isEnumValue(values, v)) as T[])];
  return unique.length > 0 ? unique : [fallback];
}
