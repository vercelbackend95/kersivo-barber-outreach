/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import PreviewTopBar from './PreviewTopBar';

const TOKEN = 'B'.repeat(43);

if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute('open', '');
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
  };
}

function renderBar(
  overrides: Partial<ComponentProps<typeof PreviewTopBar>> = {},
) {
  return render(
    <PreviewTopBar
      token={TOKEN}
      shopName="Sharp Cuts"
      townCity="Leeds"
      firstName="Sam"
      checkoutEmail="sam@example.com"
      hasOwnDomain="not_sure"
      existingWebsiteHost=""
      isOperator={false}
      converted={false}
      activeView="website"
      websiteHref={`/preview/${TOKEN}`}
      bookingHref={`/preview/${TOKEN}?view=booking`}
      {...overrides}
    />,
  );
}

function openLaunch() {
  fireEvent.click(screen.getByRole('button', { name: /Launch this website/i }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PreviewTopBar launch domain gate', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/domain-search')) {
          return new Response(
            JSON.stringify({
              ok: true,
              query: '',
              suggestions: [
                {
                  domain: 'sharpcuts.co.uk',
                  tld: '.co.uk',
                  status: 'available',
                  included: true,
                  pricePence: null,
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.includes('/event')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
        if (url.includes('/checkout')) {
          return new Response(JSON.stringify({ ok: true, url: 'https://checkout.stripe.com/c/pay/test' }), {
            status: 200,
          });
        }
        return new Response('not found', { status: 404 });
      }),
    );
  });

  it('cannot start checkout without a domain decision', async () => {
    renderBar();
    openLaunch();
    fireEvent.click(screen.getByLabelText(/I agree to the/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure checkout/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/domain/i);
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/checkout'))).toBe(false);
  });

  it('cannot start checkout for a new domain without the authorisation checkbox', async () => {
    renderBar();
    openLaunch();
    fireEvent.click(screen.getByRole('radio', { name: /Find a domain for me/i }));
    const option = await waitFor(() => {
      const row = screen.getByRole('option', { name: /sharpcuts\.co\.uk/i });
      if ((row as HTMLButtonElement).disabled) throw new Error('still checking');
      return row;
    });
    fireEvent.click(option);
    fireEvent.click(screen.getByLabelText(/I agree to the/i));
    fireEvent.click(screen.getByRole('button', { name: /Continue to secure checkout/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Authorise KERSIVO/i);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/checkout'))).toBe(false);
  });
});
