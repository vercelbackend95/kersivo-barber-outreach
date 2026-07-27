-- Remap dayOfWeek from Mon=0…Sun=6 to Mon=1…Sun=7 (+1 with offset for unique safety)

UPDATE "ShopOpeningHours" SET "dayOfWeek" = "dayOfWeek" + 10;
UPDATE "ShopOpeningHours" SET "dayOfWeek" = "dayOfWeek" - 9;

UPDATE "AvailabilityRule" SET "dayOfWeek" = "dayOfWeek" + 10;
UPDATE "AvailabilityRule" SET "dayOfWeek" = "dayOfWeek" - 9;
