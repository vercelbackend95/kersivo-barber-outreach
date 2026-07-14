import {
  DEMO_ACTION_BLOCKED_MESSAGE,
  DEMO_ADMIN_MODE_HEADER,
  isPublicAdminDemoPathname,
} from '@/lib/admin/demoConfig';

const ADMIN_SECRET_STORAGE_KEY = 'kersivo.admin.secret';
const ADMIN_SECRET_HEADER = 'x-admin-secret';
export const ADMIN_DEMO_BLOCKED_EVENT = 'kersivo-admin-demo-blocked';

let memoryAdminSecret = '';
let publicAdminDemoMode = false;

type AdminFetchJsonOptions = RequestInit & {
  errorMessage?: string;
};

export class AdminFetchError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown = null) {
    super(message);
    this.name = 'AdminFetchError';
    this.status = status;
    this.payload = payload;
  }
}

function resolveRequestUrl(input: RequestInfo | URL, init?: RequestInit): URL | null {
  try {
    if (input instanceof URL) return input;
    if (input instanceof Request) return new URL(input.url, window.location.origin);
    return new URL(input, window.location.origin);
  } catch {
    return null;
  }
}

function resolveRequestPath(input: RequestInfo | URL): string | null {
  return resolveRequestUrl(input)?.pathname ?? null;
}

function resolveRequestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function rewriteAdminUrlForDemo(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (!isPublicAdminDemoMode()) return null;
  const parsed = resolveRequestUrl(input, init);
  if (!parsed?.pathname.startsWith('/api/admin/')) return null;
  const rest = parsed.pathname.slice('/api/admin/'.length);
  parsed.pathname = `/api/admin-demo/${rest}`;
  return parsed.toString();
}

export function isPublicAdminDemoMode(): boolean {
  if (typeof window !== 'undefined' && isPublicAdminDemoPathname(window.location.pathname)) {
    return true;
  }
  return publicAdminDemoMode;
}

export function setPublicAdminDemoMode(enabled: boolean): void {
  publicAdminDemoMode = enabled;
}

/** Enables public demo mode — no secret or localStorage required. */
export function enablePublicAdminDemo(): void {
  setPublicAdminDemoMode(true);
}

export function getStoredAdminSecret(): string {
  if (memoryAdminSecret) return memoryAdminSecret;
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveAdminSecret(secret: string): void {
  memoryAdminSecret = secret.trim();
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, memoryAdminSecret);
  } catch {
    // Incognito / in-app browsers may block storage — memory fallback still works.
  }
}

export function clearAdminSecret(): void {
  memoryAdminSecret = '';
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
  } catch {
    // no-op
  }
}

function isDemoNoteLikeRequest(pathname: string | null, method: string): boolean {
  if (method !== 'POST') return false;
  return !!pathname?.match(/^\/api\/admin\/clients\/[^/]+\/notes\/[^/]+\/like$/);
}

function isDemoNotePostRequest(pathname: string | null, method: string): boolean {
  if (method !== 'POST') return false;
  return !!pathname?.match(/^\/api\/admin\/clients\/[^/]+\/notes$/);
}

function isDemoWriteBlocked(method: string, pathname?: string | null): boolean {
  if (!isPublicAdminDemoMode()) return false;
  if (isDemoNoteLikeRequest(pathname ?? null, method)) return false;
  if (isDemoNotePostRequest(pathname ?? null, method)) return false;
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

export function notifyAdminDemoBlocked(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(ADMIN_DEMO_BLOCKED_EVENT));
}

export async function adminFetchJson<T>(input: RequestInfo | URL, options: AdminFetchJsonOptions = {}): Promise<T> {
  const { errorMessage = 'Admin request failed.', ...init } = options;
  let response: Response;

  try {
    response = await fetch(input, {
      credentials: 'include',
      ...init,
    });
  } catch (error) {
    throw new AdminFetchError(
      error instanceof Error ? error.message : 'Network error. Please try again.',
      0,
    );
  }

  let payload: unknown = null;
  const rawBody = await response.text().catch(() => '');

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      if (response.ok) {
        throw new AdminFetchError('Unexpected admin response format.', response.status);
      }
      payload = null;
    }
  }

  if (!response.ok) {
    const serverMessage = payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error || '')
      : '';
    if (response.status === 403 && serverMessage === DEMO_ACTION_BLOCKED_MESSAGE) {
      notifyAdminDemoBlocked();
    }
    const message = serverMessage || (response.status === 401 ? 'Session expired. Please log in again.' : errorMessage);
    throw new AdminFetchError(message, response.status, payload);
  }

  return payload as T;
}

export function installAdminFetchInterceptor(): void {
  if (typeof window === 'undefined') return;

  type PatchedWindow = Window & { __kersivoAdminFetchPatched?: boolean };
  const patchedWindow = window as PatchedWindow;
  if (patchedWindow.__kersivoAdminFetchPatched) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = resolveRequestPath(input);
    if (!pathname?.startsWith('/api/admin/')) return nativeFetch(input, init);

    const method = resolveRequestMethod(input, init);
    if (isDemoWriteBlocked(method, pathname)) {
      notifyAdminDemoBlocked();
      return new Response(JSON.stringify({ error: DEMO_ACTION_BLOCKED_MESSAGE }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const demoUrl = rewriteAdminUrlForDemo(input, init);
    const effectiveInput = demoUrl ?? input;

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (!isPublicAdminDemoMode()) {
      const secret = getStoredAdminSecret();
      if (secret) {
        headers.set(ADMIN_SECRET_HEADER, secret);
      }
    } else {
      headers.set(DEMO_ADMIN_MODE_HEADER, 'true');
    }

    return nativeFetch(effectiveInput, {
      ...init,
      headers,
    });
  };

  patchedWindow.__kersivoAdminFetchPatched = true;
}

/** Install demo interceptor before React effects — avoids 401 on first /admin-demo load. */
export function bootstrapPublicAdminDemoIfNeeded(): void {
  if (typeof window === 'undefined') return;
  if (!isPublicAdminDemoPathname(window.location.pathname)) return;
  enablePublicAdminDemo();
  installAdminFetchInterceptor();
}

bootstrapPublicAdminDemoIfNeeded();
