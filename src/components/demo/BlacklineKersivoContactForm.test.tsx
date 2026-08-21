/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FUNNEL_EVENTS } from '@/lib/analytics/funnelEvents';
import { BLACKLINE_DEMO_CONTACT_SOURCE } from '@/lib/demo/kersivoContact';

vi.mock('@/lib/consent/events', () => ({
  trackConsentedEvent: vi.fn(),
}));

import { trackConsentedEvent } from '@/lib/consent/events';
import BlacklineKersivoContactForm from './BlacklineKersivoContactForm';

const trackSpy = vi.mocked(trackConsentedEvent);

function fillValidForm() {
  fireEvent.change(screen.getByLabelText(/^Your name$/i), { target: { value: 'Alex' } });
  fireEvent.change(screen.getByLabelText(/^Your email$/i), {
    target: { value: 'alex@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/Barbershop name/i), {
    target: { value: 'Alex Barbers' },
  });
  fireEvent.change(screen.getByLabelText(/^Your question$/i), {
    target: { value: 'How does pricing work?' },
  });
}

describe('BlacklineKersivoContactForm', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    trackSpy.mockReset();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, delivered: true }),
      }),
    );
  });

  it('does not submit when email is invalid', async () => {
    render(<BlacklineKersivoContactForm />);
    fireEvent.change(screen.getByLabelText(/^Your name$/i), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText(/^Your email$/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.change(screen.getByLabelText(/^Your question$/i), {
      target: { value: 'Question' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Ask KERSIVO/i }));

    expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it('requires name and question', async () => {
    render(<BlacklineKersivoContactForm />);
    fireEvent.click(screen.getByRole('button', { name: /Ask KERSIVO/i }));
    expect(screen.getByText('Please enter your name.')).toBeTruthy();
    expect(screen.getByText('Please enter your question.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows success only when API confirms delivery and clears the form', async () => {
    render(<BlacklineKersivoContactForm />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Ask KERSIVO/i }));

    await waitFor(() => {
      expect(screen.getByText(/your message has been sent to KERSIVO/i)).toBeTruthy();
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      name: 'Alex',
      email: 'alex@example.com',
      shopName: 'Alex Barbers',
      message: 'How does pricing work?',
      source: BLACKLINE_DEMO_CONTACT_SOURCE,
    });
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_demo_contact_submit_attempt,
      undefined,
      'analytics',
    );
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_demo_contact_submit,
      undefined,
      'analytics',
    );
    expect((screen.getByLabelText(/^Your name$/i) as HTMLInputElement).value).toBe('');
  });

  it('shows error and keeps values when API fails', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'Could not send your message. Try again later.' }),
    } as Response);

    render(<BlacklineKersivoContactForm />);
    fillValidForm();
    fireEvent.click(screen.getByRole('button', { name: /Ask KERSIVO/i }));

    await waitFor(() => {
      expect(screen.getByText(/Could not send your message/i)).toBeTruthy();
    });
    expect(screen.queryByText(/your message has been sent to KERSIVO/i)).toBeNull();
    expect((screen.getByLabelText(/^Your name$/i) as HTMLInputElement).value).toBe('Alex');
    expect(trackSpy).toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_demo_contact_submit_attempt,
      undefined,
      'analytics',
    );
    expect(trackSpy).not.toHaveBeenCalledWith(
      FUNNEL_EVENTS.blackline_demo_contact_submit,
      undefined,
      'analytics',
    );
  });

  it('blocks double submit while sending', async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }) as Promise<Response>,
    );

    render(<BlacklineKersivoContactForm />);
    fillValidForm();
    const button = screen.getByRole('button', { name: /Ask KERSIVO/i });
    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect((screen.getByRole('button', { name: /Sending/i }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
    expect(fetch).toHaveBeenCalledOnce();

    resolveFetch({
      ok: true,
      json: async () => ({ ok: true, delivered: true }),
    });

    await waitFor(() => {
      expect(screen.getByText(/your message has been sent to KERSIVO/i)).toBeTruthy();
    });
  });
});
