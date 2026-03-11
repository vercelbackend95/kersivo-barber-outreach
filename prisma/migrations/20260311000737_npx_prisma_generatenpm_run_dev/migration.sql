/*
  Warnings:

  - You are about to drop the column `fromPriceText` on the `Service` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Service" DROP COLUMN "fromPriceText",
ALTER COLUMN "pricePence" DROP DEFAULT;
