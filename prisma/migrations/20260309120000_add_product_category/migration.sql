DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'ProductCategory'
  ) THEN
    CREATE TYPE "ProductCategory" AS ENUM (
      'POMADES_AND_CLAYS',
      'BEARD_CARE',
      'HAIR_WASH',
      'STYLING',
      'TOOLS',
      'GIFT_SETS'
    );
  END IF;
END $$;

ALTER TABLE "Product"
ADD COLUMN IF NOT EXISTS "category" "ProductCategory" NOT NULL DEFAULT 'STYLING';

UPDATE "Product"
SET "category" = CASE
  WHEN lower("name") LIKE '%beard oil%' THEN 'BEARD_CARE'::"ProductCategory"
  WHEN lower("name") LIKE '%beard foam%' THEN 'BEARD_CARE'::"ProductCategory"
  WHEN lower("name") LIKE '%matte pomade%' THEN 'POMADES_AND_CLAYS'::"ProductCategory"
  WHEN lower("name") LIKE '%comb set%' THEN 'TOOLS'::"ProductCategory"
  WHEN lower("name") LIKE '%pomade%' OR lower("name") LIKE '%clay%' THEN 'POMADES_AND_CLAYS'::"ProductCategory"
  WHEN lower("name") LIKE '%beard%' THEN 'BEARD_CARE'::"ProductCategory"
  WHEN lower("name") LIKE '%shampoo%' OR lower("name") LIKE '%wash%' THEN 'HAIR_WASH'::"ProductCategory"
  WHEN lower("name") LIKE '%spray%' OR lower("name") LIKE '%powder%' OR lower("name") LIKE '%cream%' THEN 'STYLING'::"ProductCategory"
  WHEN lower("name") LIKE '%comb%' OR lower("name") LIKE '%brush%' OR lower("name") LIKE '%tool%' THEN 'TOOLS'::"ProductCategory"
  WHEN lower("name") LIKE '%set%' OR lower("name") LIKE '%kit%' OR lower("name") LIKE '%gift%' THEN 'GIFT_SETS'::"ProductCategory"
  ELSE "category"
END;
