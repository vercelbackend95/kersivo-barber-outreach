-- Remap dayOfWeek from JS Sun=0…Sat=6 to canonical Mon=0…Sun=6.
-- new = (old + 6) % 7  (via +10 offset to avoid unique collisions mid-update)

-- ShopOpeningHours: written only by onboarding with the old Sun=0 convention
UPDATE "ShopOpeningHours" SET "dayOfWeek" = "dayOfWeek" + 10;
UPDATE "ShopOpeningHours" SET "dayOfWeek" = MOD(("dayOfWeek" - 10 + 6), 7);

-- AvailabilityRule only in shops that have ShopOpeningHours
-- (onboarding wrote those rules as Sun=0; Team/BarberWizard already used Mon=0)
UPDATE "AvailabilityRule" AS ar
SET "dayOfWeek" = ar."dayOfWeek" + 10
FROM "Barber" b
WHERE ar."barberId" = b.id
  AND EXISTS (SELECT 1 FROM "ShopOpeningHours" soh WHERE soh."shopId" = b."shopId");

UPDATE "AvailabilityRule" AS ar
SET "dayOfWeek" = MOD((ar."dayOfWeek" - 10 + 6), 7)
FROM "Barber" b
WHERE ar."barberId" = b.id
  AND EXISTS (SELECT 1 FROM "ShopOpeningHours" soh WHERE soh."shopId" = b."shopId");
