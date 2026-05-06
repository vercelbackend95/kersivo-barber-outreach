-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
