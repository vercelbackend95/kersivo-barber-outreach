const ADMIN_SECRET_STORAGE_KEY = 'kersivo.admin.secret';
const ADMIN_SECRET_HEADER = 'x-admin-secret';

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
