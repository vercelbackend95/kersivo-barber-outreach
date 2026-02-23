-- AlterTable
ALTER TABLE "Booking"
ALTER COLUMN "manageTokenHash" DROP NOT NULL,
ALTER COLUMN "manageTokenExpiresAt" DROP NOT NULL;
