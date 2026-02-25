import { p as prisma } from './client_C4jvTHHS.mjs';

const DEMO_SHOP_ID = "demo-shop";
const SHOP_SETTINGS_MISSING_MESSAGE = "ShopSettings is missing. Run `npx prisma db seed` to create demo shop settings (id: demo-shop).";
async function resolveShopId() {
  const demoShop = await prisma.shopSettings.findUnique({
    where: { id: DEMO_SHOP_ID },
    select: { id: true }
  });
  if (demoShop) return demoShop.id;
  if (process.env.NODE_ENV !== "production") {
    const createdDemoShop = await prisma.shopSettings.upsert({
      where: { id: DEMO_SHOP_ID },
      update: {},
      create: {
        id: DEMO_SHOP_ID,
        name: "Demo Barbershop",
        timezone: "Europe/London",
        cancellationWindowHours: 2,
        rescheduleWindowHours: 2,
        pendingConfirmationMins: 15,
        slotIntervalMinutes: 15,
        defaultBufferMinutes: 0
      },
      select: { id: true }
    });
    return createdDemoShop.id;
  }
  throw new Error(SHOP_SETTINGS_MISSING_MESSAGE);
}

export { resolveShopId as r };
