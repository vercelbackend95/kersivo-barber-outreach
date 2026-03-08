const ADMIN_SECRET_STORAGE_KEY = 'kersivo.admin.secret';
const ADMIN_SECRET_HEADER = 'x-admin-secret';

function resolveRequestPath(input: RequestInfo | URL): string | null {
  if (input instanceof URL) return input.pathname;
  if (input instanceof Request) return new URL(input.url, window.location.origin).pathname;
  if (typeof input === 'string') {
    try {
      return new URL(input, window.location.origin).pathname;
    } catch {
      return null;
    }
  }

  return null;
}

export function getStoredAdminSecret(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) ?? '';
}

export function saveAdminSecret(secret: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, secret.trim());
}

export function clearAdminSecret(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY);
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

    const secret = getStoredAdminSecret();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    if (secret) {
      headers.set(ADMIN_SECRET_HEADER, secret);
    }

    return nativeFetch(input, {
      ...init,
      headers
    });
  };

  patchedWindow.__kersivoAdminFetchPatched = true;
}
