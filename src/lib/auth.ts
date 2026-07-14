import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db/client';
import { provisionShopForUser } from '@/lib/auth/provisionShop';

function resolveAuthBaseUrl(): string {
  const fromEnv =
    process.env.BETTER_AUTH_URL ||
    import.meta.env.BETTER_AUTH_URL ||
    process.env.PUBLIC_SITE_URL ||
    import.meta.env.PUBLIC_SITE_URL;
  if (fromEnv) return String(fromEnv).replace(/\/$/, '');
  return 'http://localhost:4321';
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || import.meta.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: resolveAuthBaseUrl(),
  secret: process.env.BETTER_AUTH_SECRET || import.meta.env.BETTER_AUTH_SECRET || process.env.ADMIN_SECRET,
  trustedOrigins: [
    resolveAuthBaseUrl(),
    'http://localhost:4321',
    'https://kersivo.co.uk',
    'https://www.kersivo.co.uk',
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day while active
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: String(googleClientId),
            clientSecret: String(googleClientSecret),
          },
        }
      : undefined,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await provisionShopForUser({
            userId: user.id,
            name: user.name,
            email: user.email,
          });
        },
      },
    },
  },
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
};
