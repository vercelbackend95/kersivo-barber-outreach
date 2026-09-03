import type { RetailNeed, TargetArea } from './taxonomy';

export const RETAIL_NEED_DOMAINS = {
  HAIR_STYLING_CONTROL: ['HAIR'],
  HAIR_TEXTURE_DEFINITION: ['HAIR'],
  HAIR_VOLUME: ['HAIR'],
  HAIR_SMOOTHING_FRIZZ_CONTROL: ['HAIR'],
  HAIR_SHINE_POLISH: ['HAIR'],
  HAIR_CURL_DEFINITION: ['HAIR'],
  HAIR_HEAT_PROTECTION: ['HAIR'],
  HAIR_CLEANSING: ['HAIR'],
  HAIR_CONDITIONING: ['HAIR'],
  SCALP_CARE: ['SCALP'],
  BEARD_CLEANSING: ['BEARD', 'MOUSTACHE'],
  BEARD_SOFTENING: ['BEARD', 'MOUSTACHE'],
  BEARD_SHAPING: ['BEARD', 'MOUSTACHE'],
  MOUSTACHE_STYLING: ['MOUSTACHE'],
  SHAVE_PREPARATION: ['SHAVE', 'FACE'],
  POST_SHAVE_SOOTHING: ['SHAVE', 'FACE'],
  FACE_CLEANSING: ['FACE'],
  FACE_MOISTURISING: ['FACE'],
  COLOUR_MAINTENANCE: ['HAIR', 'BEARD', 'MOUSTACHE'],
  GROOMING_TOOL: ['TOOLS_ACCESSORIES'],
  GIFTING: ['GENERAL_GROOMING'],
  UNKNOWN: [],
} as const satisfies Record<RetailNeed, readonly TargetArea[]>;

const DOMAIN_PRIORITY: TargetArea[] = [
  'HAIR',
  'BEARD',
  'MOUSTACHE',
  'SCALP',
  'FACE',
  'SHAVE',
  'GENERAL_GROOMING',
  'TOOLS_ACCESSORIES',
];

export function domainsForOverlapNeeds(needs: readonly RetailNeed[]): TargetArea[] {
  const domainSet = new Set<TargetArea>();
  for (const need of needs) {
    for (const domain of RETAIL_NEED_DOMAINS[need]) {
      domainSet.add(domain);
    }
  }
  return DOMAIN_PRIORITY.filter((domain) => domainSet.has(domain));
}
