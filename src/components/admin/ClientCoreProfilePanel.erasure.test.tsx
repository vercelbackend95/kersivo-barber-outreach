/**
 * @vitest-environment jsdom
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { permissionsForRole } from '@/lib/admin/rbac/permissions';
import ClientCoreProfilePanel from './ClientCoreProfilePanel';

const CORE_PROFILE = {
  mode: 'core',
  client: { id: 'client-1', fullName: 'Jamie Client', email: 'jamie@example.com', phone: '07123456789' },
  lastVisitAt: '2026-09-20T10:00:00.000Z',
  nextBookingAt: null,
  emailHidden: false,
};

type Call = { url: string; method: string; body: string | null };
let calls: Call[] = [];

function installFetch(role: 'OWNER' | 'MANAGER' | 'BARBER') {
  calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
      const json = (payload: unknown) =>
        new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (url.startsWith('/api/admin/session')) {
        return json({ role, permissions: [...permissionsForRole(role)] });
      }
      if (method === 'DELETE') return json({ ok: true, operationId: 'op-1', blobCleanupWarning: false });
      return json(CORE_PROFILE);
    }),
  );
}

async function renderPanel(onErased = vi.fn(), onClose = vi.fn()) {
  render(<ClientCoreProfilePanel clientId="client-1" onClose={onClose} onErased={onErased} />);
  await screen.findByText('Jamie Client');
  await waitFor(() => expect(calls.some((c) => c.url.startsWith('/api/admin/session'))).toBe(true));
  return { onErased, onClose };
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ClientCoreProfilePanel customer erasure (Starter)', () => {
  it.each(['OWNER', 'MANAGER'] as const)('%s with clients.erase sees the erase control', async (role) => {
    installFetch(role);
    await renderPanel();
    expect(await screen.findByRole('button', { name: 'Erase customer data' })).toBeTruthy();
  });

  it('BARBER (no clients.erase) never sees the erase control', async () => {
    installFetch('BARBER');
    await renderPanel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: 'Erase customer data' })).toBeNull();
    expect(document.querySelector('.admin-cp-danger-zone')).toBeNull();
  });

  it('erases through the existing DELETE flow only after typing DELETE', async () => {
    installFetch('OWNER');
    const { onErased, onClose } = await renderPanel();
    fireEvent.click(await screen.findByRole('button', { name: 'Erase customer data' }));
    const submit = screen.getAllByRole('button', { name: 'Erase customer data' }).at(-1)!;
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Confirmation'), { target: { value: 'DELETE' } });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(onErased).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalled();
    const del = calls.filter((c) => c.method === 'DELETE');
    expect(del).toEqual([
      { url: '/api/admin/clients/client-1', method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE' }) },
    ]);
  });

  it('does not expose or call any Full-only client data as a side effect', async () => {
    installFetch('OWNER');
    await renderPanel();
    await screen.findByRole('button', { name: 'Erase customer data' });
    const called = calls.map((c) => c.url);
    expect(called.every((url) => !/\/(notes|images|like|tags|ensure)\b/.test(url))).toBe(true);
    expect(called.filter((url) => url.startsWith('/api/admin/clients'))).toEqual(['/api/admin/clients/client-1']);
    expect(screen.queryByText(/Notes/)).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('[data-locked-feature="clients"]')).toBeTruthy();
  });

  it('gates purely on the session clients.erase permission and never imports the Full CRM panel', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/admin/ClientCoreProfilePanel.tsx'), 'utf8');
    expect(source).toContain("payload.permissions.includes('clients.erase')");
    expect(source).not.toMatch(/from '\.\/ClientProfilePanel'/);
    expect(source).not.toMatch(/role === 'OWNER'|role === 'MANAGER'/);
  });
});
