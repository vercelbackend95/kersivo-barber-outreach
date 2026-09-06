import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@/lib/db/client';
import { provisionShopForUser } from '@/lib/auth/provisionShop';
import {
  resolveBetterAuthBaseUrl,
  resolveVercelPreviewTrustedOrigins,
} from '@/lib/auth/vercelPreviewOrigins';
import {
  isEmailDeliveryConfigured,
  sendEmailVerificationEmail,
  sendPasswordResetEmail,
} from '@/lib/email/sender';

function resolveAuthBaseUrl(): string {
  return resolveBetterAuthBaseUrl(
    {
      VERCEL_ENV: process.env.VERCEL_ENV ?? import.meta.env.VERCEL_ENV,
      VERCEL_BRANCH_URL:
        process.env.VERCEL_BRANCH_URL ?? import.meta.env.VERCEL_BRANCH_URL,
      VERCEL_URL: process.env.VERCEL_URL ?? import.meta.env.VERCEL_URL,
    },
    {
      betterAuthUrl:
        process.env.BETTER_AUTH_URL || import.meta.env.BETTER_AUTH_URL,
      publicSiteUrl:
        process.env.PUBLIC_SITE_URL || import.meta.env.PUBLIC_SITE_URL,
    },
  );
}

function isAuthProd(): boolean {
  return import.meta.env.PROD === true;
}

/** RFC1918 + loopback hostnames for local phone-on-LAN testing. */
function isPrivateLanHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;

  const parts = host.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  if (octets[0] === 127) return true;
  if (octets[0] === 10) return true;
  if (octets[0] === 192 && octets[1] === 168) return true;
  if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
  return false;
}

function isPrivateLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    return isPrivateLanHostname(url.hostname);
  } catch {
    return false;
  }
}

function envTrustedOrigins(): string[] {
  const raw =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ||
    import.meta.env.BETTER_AUTH_TRUSTED_ORIGINS ||
    '';
  return String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function staticTrustedOrigins(): string[] {
  return [
    resolveAuthBaseUrl(),
    'http://localhost:4321',
    'http://127.0.0.1:4321',
    'https://kersivo.co.uk',
    'https://www.kersivo.co.uk',
    ...envTrustedOrigins(),
    ...resolveVercelPreviewTrustedOrigins({
      VERCEL_ENV: process.env.VERCEL_ENV ?? import.meta.env.VERCEL_ENV,
      VERCEL_BRANCH_URL:
        process.env.VERCEL_BRANCH_URL ?? import.meta.env.VERCEL_BRANCH_URL,
      VERCEL_URL: process.env.VERCEL_URL ?? import.meta.env.VERCEL_URL,
    }),
  ];
}

/**
 * In non-prod, accept LAN hosts so phone testing via http://192.168.x.x:4321 works.
 * Production keeps a fixed base URL (no private-network allowlist).
 */
function resolveBaseURLConfig(): string | {
  allowedHosts: string[];
  protocol: 'http';
  fallback: string;
} {
  if (isAuthProd()) {
    return resolveAuthBaseUrl();
  }

  return {
    allowedHosts: [
      'localhost:*',
      '127.0.0.1:*',
      '192.168.*.*:*',
      '10.*.*.*:*',
      '172.*.*.*:*',
    ],
    protocol: 'http',
    fallback: 'http://localhost:4321',
  };
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || import.meta.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || import.meta.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  baseURL: resolveBaseURLConfig(),
  secret: process.env.BETTER_AUTH_SECRET || import.meta.env.BETTER_AUTH_SECRET || process.env.ADMIN_SECRET,
  trustedOrigins: async (request) => {
    const origins = [...staticTrustedOrigins()];

    if (!isAuthProd() && request) {
      const headerOrigin = request.headers.get('origin');
      if (headerOrigin && isPrivateLanOrigin(headerOrigin)) {
        origins.push(headerOrigin);
      }
      try {
        const urlOrigin = new URL(request.url).origin;
        if (isPrivateLanOrigin(urlOrigin)) {
          origins.push(urlOrigin);
        }
      } catch {
        // ignore malformed request URLs
      }
    }

    return [...new Set(origins)];
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh once per day while active
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Soft gate: sign-in works without verification; invites + billing require it.
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Never log url/token — only that delivery was attempted for this user id.
      if (!isEmailDeliveryConfigured()) {
        console.error('[auth] RESEND_API_KEY missing; password reset email not sent.', {
          userId: user.id,
        });
      }
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!isEmailDeliveryConfigured()) {
        console.error('[auth] RESEND_API_KEY missing; verification email not sent.', {
          userId: user.id,
          email: user.email,
        });
      }
      await sendEmailVerificationEmail({
        to: user.email,
        name: user.name,
        url,
      });
    },
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
