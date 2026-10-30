/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DomainSearcher, { mergeLiveResults, rowRank, type DomainSearcherProps } from './DomainSearcher';
import type { DomainSuggestionResult } from '@/lib/domains/availability';

function suggestion(
  domain: string,
  status: DomainSuggestionResult['status'],
  included = status === 'available',
): DomainSuggestionResult {
  const tld = domain.includes('.co.uk') ? '.co.uk' : domain.slice(domain.lastIndexOf('.'));
  return { domain, tld, status, included, pricePence: null };
}

function jsonResponse(suggestions: DomainSuggestionResult[]) {
  return new Response(JSON.stringify({ ok: true, query: '', suggestions }), { status: 200 });
}

function renderSearcher(overrides: Partial<DomainSearcherProps> = {}) {
  const props: DomainSearcherProps = {
    shopName: 'Sharp Cuts',
    townCity: 'Leeds',
    searchEndpoint: '/api/domains/search',
    mode: 'KERSIVO_REGISTER',
    onModeChange: vi.fn(),
    selectedDomain: null,
    onSelectDomain: vi.fn(),
    existingDomain: '',
    onExistingDomainChange: vi.fn(),
    authorised: false,
    onAuthorisedChange: vi.fn(),
    ...overrides,
  };
  return { ...render(<DomainSearcher {...props} />), props };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('mergeLiveResults / rowRank', () => {
  it('keeps earlier pills and overwrites matching domains', () => {
    const merged = mergeLiveResults(
      [suggestion('fade.co.uk', 'available'), suggestion('fade.com', 'taken')],
      [suggestion('fade.co.uk', 'taken'), suggestion('fade.uk', 'available')],
    );
    expect(merged).toEqual([
      suggestion('fade.co.uk', 'taken'),
      suggestion('fade.com', 'taken'),
      suggestion('fade.uk', 'available'),
    ]);
  });

  it('ranks available, then checking, then unknown, then taken', () => {
    expect(rowRank({ ...suggestion('a.co.uk', 'available'), pending: false })).toBe(0);
    expect(rowRank({ ...suggestion('b.co.uk', 'unknown'), pending: true })).toBe(1);
    expect(rowRank({ ...suggestion('c.co.uk', 'unknown'), pending: false })).toBe(2);
    expect(rowRank({ ...suggestion('d.co.uk', 'taken'), pending: false })).toBe(3);
  });
});

describe('DomainSearcher', () => {
  it('does not submit the parent form when Enter is pressed in the search field', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([suggestion('sharpcuts.co.uk', 'available')])),
    );
    const onSubmit = vi.fn((event: { preventDefault(): void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <DomainSearcher
          shopName="Sharp Cuts"
          townCity="Leeds"
          searchEndpoint="/api/domains/search"
          mode="KERSIVO_REGISTER"
          onModeChange={vi.fn()}
          selectedDomain={null}
          onSelectDomain={vi.fn()}
          existingDomain=""
          onExistingDomainChange={vi.fn()}
          authorised={false}
          onAuthorisedChange={vi.fn()}
        />
        <button type="submit">Send my details</button>
      </form>,
    );

    const input = screen.getByLabelText(/Search for a domain/i);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    input.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the search field and suggestion list when mode is still undecided', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([suggestion('sharpcuts.co.uk', 'available')])),
    );
    renderSearcher({ mode: null });

    expect(screen.getByLabelText(/Search for a domain/i)).toBeTruthy();
    expect(screen.getByRole('listbox', { name: /Domain suggestions/i })).toBeTruthy();
    expect(screen.getByRole('option', { name: /sharpcuts\.co\.uk/i })).toBeTruthy();
  });

  it('sets KERSIVO_REGISTER when an available row is clicked from an undecided mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([suggestion('sharpcuts.co.uk', 'available')])),
    );
    const onModeChange = vi.fn();
    const onSelectDomain = vi.fn();
    renderSearcher({ mode: null, onModeChange, onSelectDomain });

    const option = await waitFor(() => {
      const row = screen.getByRole('option', { name: /sharpcuts\.co\.uk/i });
      if ((row as HTMLButtonElement).disabled) throw new Error('still checking');
      return row;
    });
    fireEvent.click(option);
    expect(onModeChange).toHaveBeenCalledWith('KERSIVO_REGISTER');
    expect(onSelectDomain).toHaveBeenCalledWith('sharpcuts.co.uk');
  });

  it('keeps an already-checked Available pill while the next lookup is in flight', async () => {
    let secondCall: ((value: Response) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const query = JSON.parse(String(init?.body ?? '{}')) as { query?: string };
      if (!query.query) {
        return Promise.resolve(jsonResponse([suggestion('sharpcuts.co.uk', 'available')]));
      }
      return new Promise<Response>((resolve) => {
        secondCall = resolve;
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    renderSearcher();

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /sharpcuts\.co\.uk/i }).textContent).toMatch(/Available/i);
    });

    fireEvent.change(screen.getByLabelText(/Search for a domain/i), { target: { value: 'sharpcuts' } });

    expect(screen.getByRole('option', { name: /sharpcuts\.co\.uk/i }).textContent).toMatch(/Available/i);
    expect(screen.getAllByRole('option').some((row) => /Checking/i.test(row.textContent ?? ''))).toBe(true);
    expect(secondCall).toBeUndefined();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    secondCall?.(
      jsonResponse([
        suggestion('sharpcuts.co.uk', 'available'),
        suggestion('sharpcuts.uk', 'taken'),
      ]),
    );
    await waitFor(() => {
      expect(screen.getByRole('option', { name: /sharpcuts\.uk/i }).textContent).toMatch(/Taken/i);
    });
    expect(screen.getByRole('option', { name: /sharpcuts\.co\.uk/i }).textContent).toMatch(/Available/i);
  });

  it('lists available domains above taken ones after the live lookup', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse([
          suggestion('sharpcuts.com', 'taken'),
          suggestion('sharpcuts.co.uk', 'available'),
          suggestion('sharp-cuts.co.uk', 'taken'),
        ]),
      ),
    );
    renderSearcher();

    const options = await waitFor(() => {
      const available = screen.getByRole('option', { name: /sharpcuts\.co\.uk/i });
      if ((available as HTMLButtonElement).disabled) throw new Error('still checking');
      return screen.getAllByRole('option');
    });
    expect(options[0]?.textContent).toMatch(/sharpcuts\.co\.uk/);
    expect(options[0]?.textContent).toMatch(/Available/);
    expect(options.some((row) => row.textContent?.includes('Taken'))).toBe(true);
    expect(options[options.length - 1]?.className).toMatch(/is-dimmed/);
  });
});
