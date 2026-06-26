-- AlterTable
ALTER TABLE "ShopSettings" ADD COLUMN "customServiceCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
