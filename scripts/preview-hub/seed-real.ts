import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assertLocalDatabaseUrl } from '../../src/lib/db/assertLocalDatabaseUrl';
import { prisma } from '../../src/lib/db/client';
import { auth } from '../../src/lib/auth';
import { adoptPreviewDraftShop } from '../../src/lib/freePreview/conversion';
import { FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION } from '../../src/lib/freePreview/intake';
import { createDraftShop, hashPreviewToken, mintPreviewToken } from '../../src/lib/preview/shopPreviewSession';

assertLocalDatabaseUrl(process.env.DATABASE_URL, 'Shop Hub seed');

const PORT = process.env.PREVIEW_HUB_REAL_PORT || '4397';
const SITE = `http://127.0.0.1:${PORT}`;

export const HUB_QA = {
  opsEmail: 'ops.hubqa@kersivo.test',
  opsPassword: 'HubQaOps!23456',
  ownerEmail: 'owner.converted@hubqa.test',
  ownerPassword: 'HubQaOwner!23456',
  requestedEmail: 'requested.hubqa@hubqa.test',
} as const;

async function upsertAuthUser(input: { email: string; password: string; name: string; verified: boolean }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name },
    });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { email: input.email } });
  if (input.verified && !user.emailVerified) {
    await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
  }
  return user;
}

async function createRequest(input: {
  status: 'REQUESTED' | 'READY' | 'CONVERTED' | 'REJECTED' | 'EXPIRED';
  shopName: string;
  email: string;
  townCity: string;
  firstName: string;
  draftShopId?: string;
  extra?: Record<string, unknown>;
}) {
  const publicToken = mintPreviewToken();
  const now = new Date();
  const row = await prisma.previewRequest.create({
    data: {
      publicToken,
      publicTokenHash: hashPreviewToken(publicToken),
      status: input.status,
      firstName: input.firstName,
      email: input.email,
      shopName: input.shopName,
      townCity: input.townCity,
      authorisationConsentAt: now,
      authorisationStatementVersion: FREE_PREVIEW_AUTHORISATION_STATEMENT_VERSION,
      entryPoint: 'free_preview',
      hasOwnDomain: 'yes',
      websiteUrl: 'https://readyhub.example',
      draftShopId: input.draftShopId,
      ...input.extra,
      events: {
        create: [{ action: 'CREATED', toStatus: input.status === 'REQUESTED' ? 'REQUESTED' : input.status }],
      },
    },
  });
  return { ...row, publicToken };
}

async function fillDraftShop(shopId: string, name: string) {
  await prisma.shopSettings.update({
    where: { id: shopId },
    data: {
      name,
      sitePreviewUrl: `${SITE}/preview-hub-qa/draft-site`,
      sitePreviewVersion: 'qa-1',
      sitePreviewReadyAt: new Date(),
    },
  });
  const cut = await prisma.service.create({
    data: { shopId, name: 'Skin fade', durationMinutes: 45, pricePence: 2200, displayOrder: 0, isActive: true },
  });
  const beard = await prisma.service.create({
    data: { shopId, name: 'Beard trim', durationMinutes: 20, pricePence: 1500, displayOrder: 1, isActive: true },
  });
  const alex = await prisma.barber.create({
    data: { shopId, name: 'Alex Reed', active: true, sortOrder: 0 },
  });
  const jordan = await prisma.barber.create({
    data: { shopId, name: 'Jordan Cole', active: true, sortOrder: 1 },
  });
  await prisma.barberService.createMany({
    data: [cut, beard].flatMap((service) =>
      [alex, jordan].map((barber) => ({ barberId: barber.id, serviceId: service.id })),
    ),
  });
  await prisma.shopOpeningHours.createMany({
    data: [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
      shopId,
      dayOfWeek,
      active: true,
      startMinutes: dayOfWeek === 7 ? 10 * 60 : 9 * 60,
      endMinutes: dayOfWeek === 7 ? 16 * 60 : 18 * 60,
    })),
  });
  return { cut, beard, alex, jordan };
}

async function main() {
  await prisma.saasSubscription.deleteMany({
    where: {
      OR: [{ customerEmail: { endsWith: '@hubqa.test' } }, { shopName: { startsWith: 'Hub QA ' } }],
    },
  });
  await prisma.previewRequest.deleteMany({
    where: { OR: [{ email: { endsWith: '@hubqa.test' } }, { shopName: { startsWith: 'Hub QA ' } }] },
  });
  await prisma.shopSettings.deleteMany({ where: { name: { startsWith: 'Hub QA ' } } });

  const ops = await upsertAuthUser({
    email: HUB_QA.opsEmail,
    password: HUB_QA.opsPassword,
    name: 'Hub QA Ops',
    verified: true,
  });
  const owner = await upsertAuthUser({
    email: HUB_QA.ownerEmail,
    password: HUB_QA.ownerPassword,
    name: 'Pat Owner',
    verified: true,
  });

  const requested = await createRequest({
    status: 'REQUESTED',
    shopName: 'Hub QA Requested',
    email: HUB_QA.requestedEmail,
    townCity: 'Leeds',
    firstName: 'Sam',
  });
  await prisma.previewHubMessage.create({
    data: {
      previewRequestId: requested.id,
      author: 'KERSIVO',
      body: 'We have your request. Add a logo or photos if you have them — it is all optional.',
      attachmentIds: [],
    },
  });

  const readyShop = await createDraftShop({ name: 'Hub QA Ready', townCity: 'Leeds' });
  await fillDraftShop(readyShop.id, 'Hub QA Ready');
  const readyAt = new Date();
  const ready = await createRequest({
    status: 'READY',
    shopName: 'Hub QA Ready',
    email: 'ready.hubqa@hubqa.test',
    townCity: 'Leeds',
    firstName: 'Riley',
    draftShopId: readyShop.id,
    extra: {
      previewReadyAt: readyAt,
      expiresAt: new Date(readyAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      includedChangeRounds: 1,
      changeRoundsUsed: 0,
    },
  });
  await prisma.previewHubMessage.create({
    data: {
      previewRequestId: ready.id,
      author: 'KERSIVO',
      body: 'Your preview is ready. We used the photos you sent for the top of the page — let us know if you would like a different one.',
      attachmentIds: [],
    },
  });
  await prisma.previewChangeRequest.createMany({
    data: [
      {
        previewRequestId: ready.id,
        page: 'HOME',
        body: 'Use the shopfront photo at the top',
        status: 'DRAFT',
      },
      {
        previewRequestId: ready.id,
        page: 'BARBERS',
        body: 'Add the newest team member',
        status: 'DRAFT',
      },
    ],
  });

  const convertedShop = await createDraftShop({ name: 'Hub QA Converted', townCity: 'Bournemouth' });
  await fillDraftShop(convertedShop.id, 'Hub QA Converted');
  const converted = await createRequest({
    status: 'CONVERTED',
    shopName: 'Hub QA Converted',
    email: HUB_QA.ownerEmail,
    townCity: 'Bournemouth',
    firstName: 'Pat',
    draftShopId: convertedShop.id,
    extra: {
      previewReadyAt: readyAt,
      convertedAt: readyAt,
    },
  });
  const ownerShop = await prisma.shopSettings.findFirst({
    where: { ownerUserId: owner.id },
    select: { id: true },
  });
  const adopted = await adoptPreviewDraftShop({
    draftShopId: convertedShop.id,
    userId: owner.id,
    currentShopId: ownerShop?.id ?? null,
    checkoutEmail: HUB_QA.ownerEmail,
  });
  if (!adopted.ok) {
    await prisma.shopSettings.update({
      where: { id: convertedShop.id },
      data: { ownerUserId: owner.id, onboardingCompleted: true },
    });
    await prisma.shopMember.upsert({
      where: { shopId_userId: { shopId: convertedShop.id, userId: owner.id } },
      create: { shopId: convertedShop.id, userId: owner.id, role: 'OWNER' },
      update: { role: 'OWNER' },
    });
  }
  await prisma.clientOnboarding.upsert({
    where: { shopId: convertedShop.id },
    create: {
      shopId: convertedShop.id,
      publicEmail: HUB_QA.ownerEmail,
      publicPhone: '01202123456',
      addressLine1: '12 Test Street',
      townCity: 'Bournemouth',
      postcode: 'BH1 1AA',
      primaryContactName: 'Pat Owner',
      primaryContactEmail: HUB_QA.ownerEmail,
      isLimitedCompany: false,
      domainMode: 'EXISTING',
      existingDomain: 'hub-qa-converted.co.uk',
    },
    update: {
      publicEmail: HUB_QA.ownerEmail,
      publicPhone: '01202123456',
      addressLine1: '12 Test Street',
      townCity: 'Bournemouth',
      postcode: 'BH1 1AA',
      primaryContactName: 'Pat Owner',
      primaryContactEmail: HUB_QA.ownerEmail,
      isLimitedCompany: false,
      domainMode: 'EXISTING',
      existingDomain: 'hub-qa-converted.co.uk',
    },
  });

  const rejected = await createRequest({
    status: 'REJECTED',
    shopName: 'Hub QA Rejected',
    email: 'rejected.hubqa@hubqa.test',
    townCity: 'Leeds',
    firstName: 'Lee',
    extra: { rejectedAt: new Date() },
  });

  const expiredShop = await createDraftShop({ name: 'Hub QA Expired', townCity: 'Leeds' });
  await fillDraftShop(expiredShop.id, 'Hub QA Expired');
  const expiredReadyAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  const expired = await createRequest({
    status: 'EXPIRED',
    shopName: 'Hub QA Expired',
    email: 'expired.hubqa@hubqa.test',
    townCity: 'Leeds',
    firstName: 'Eden',
    draftShopId: expiredShop.id,
    extra: {
      previewReadyAt: expiredReadyAt,
      expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  });

  const seed = {
    ops: { email: HUB_QA.opsEmail, password: HUB_QA.opsPassword, userId: ops.id },
    owner: { email: HUB_QA.ownerEmail, password: HUB_QA.ownerPassword, userId: owner.id },
    requested: { id: requested.id, token: requested.publicToken },
    ready: { id: ready.id, token: ready.publicToken, shopId: readyShop.id },
    converted: { id: converted.id, token: converted.publicToken, shopId: convertedShop.id },
    rejected: { id: rejected.id, token: rejected.publicToken },
    expired: { id: expired.id, token: expired.publicToken },
  };

  await writeFile(join(process.cwd(), '.preview-hub-seed.json'), JSON.stringify(seed, null, 2));
  console.log('[preview-hub seed] wrote .preview-hub-seed.json');
  console.log(JSON.stringify(seed, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
