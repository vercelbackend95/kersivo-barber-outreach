-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('NEW', 'ACTIVE');

-- AlterTable ShopMember
ALTER TABLE "ShopMember" ADD COLUMN "teamStatus" "TeamMemberStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable ShopInvite
ALTER TABLE "ShopInvite" ADD COLUMN "displayName" TEXT;
ALTER TABLE "ShopInvite" ADD COLUMN "bookable" BOOLEAN NOT NULL DEFAULT true;
