export type ProductFlags = {
  active: boolean;
  featured: boolean;
};

export type ProductFlagsPatch = {
  active?: boolean;
  featured?: boolean;
};

/**
 * Apply an intentional active/featured patch, matching ProductWizard rules:
 * - Hiding (active=false) also clears featured
 * - Featuring (featured=true) also forces active=true
 * - Unfeaturing does not change active
 */
export function normalizeProductFlags(
  existing: ProductFlags,
  patch: ProductFlagsPatch
): ProductFlags {
  let active = existing.active;
  let featured = existing.featured;

  if (patch.active !== undefined) {
    active = patch.active;
    if (!active) {
      featured = false;
    }
  }

  if (patch.featured !== undefined) {
    featured = patch.featured;
    if (featured) {
      active = true;
    }
  }

  return { active, featured };
}
