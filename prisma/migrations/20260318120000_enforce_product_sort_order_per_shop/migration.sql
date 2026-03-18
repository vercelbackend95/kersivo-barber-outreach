WITH ordered_products AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "shopId"
      ORDER BY "sortOrder" ASC, "updatedAt" DESC, "createdAt" ASC, id ASC
    ) - 1 AS normalized_sort_order
  FROM "Product"
),
updated_products AS (
  UPDATE "Product" AS product
  SET "sortOrder" = ordered_products.normalized_sort_order
  FROM ordered_products
  WHERE product.id = ordered_products.id
  RETURNING 1
)
SELECT COUNT(*) FROM updated_products;

DROP INDEX IF EXISTS "Product_shopId_sortOrder_idx";
CREATE UNIQUE INDEX "Product_shopId_sortOrder_key" ON "Product"("shopId", "sortOrder");
CREATE INDEX "Product_shopId_sortOrder_idx" ON "Product"("shopId", "sortOrder");
