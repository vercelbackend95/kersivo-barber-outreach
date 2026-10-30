import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import { normalizeAndValidateDomainInput } from '@/lib/domains/hostname';
import { canSelectForRegister, type DomainSuggestionResult } from '@/lib/domains/availability';
import { suggestDomains, type DomainCandidate } from '@/lib/domains/suggest';
import { DOMAIN_AUTH_TEXT } from '@/lib/pricing/claimsPolicy';

export type DomainDecisionMode = 'EXISTING' | 'KERSIVO_REGISTER';

export type DomainSearcherProps = {
  shopName: string;
  townCity: string;
  searchEndpoint: string;
  mode: DomainDecisionMode | null;
  onModeChange: (mode: DomainDecisionMode) => void;
  selectedDomain: string | null;
  onSelectDomain: (domain: string | null) => void;
  existingDomain: string;
  onExistingDomainChange: (value: string) => void;
  authorised: boolean;
  onAuthorisedChange: (value: boolean) => void;
  disabled?: boolean;
  showModeToggle?: boolean;
  existingExtra?: ReactNode;
};

const DEBOUNCE_MS = 150;

const PILL_LABEL: Record<DomainSuggestionResult['status'] | 'checking', string> = {
  checking: 'Checking',
  available: 'Available',
  taken: 'Taken',
  not_included: 'Not included',
  unknown: 'We’ll confirm',
};

function asResults(
  candidates: DomainCandidate[],
  live: DomainSuggestionResult[] | null,
): Array<DomainSuggestionResult & { pending: boolean }> {
  const byDomain = new Map((live ?? []).map((row) => [row.domain, row]));
  return candidates.map((candidate) => {
    const hit = byDomain.get(candidate.domain);
    if (!hit) {
      return {
        domain: candidate.domain,
        tld: candidate.tld,
        status: 'unknown',
        included: false,
        pricePence: null,
        pending: true,
      };
    }
    return { ...hit, pending: false };
  });
}

export default function DomainSearcher(props: DomainSearcherProps) {
  const {
    shopName,
    townCity,
    searchEndpoint,
    mode,
    onModeChange,
    selectedDomain,
    onSelectDomain,
    existingDomain,
    onExistingDomainChange,
    authorised,
    onAuthorisedChange,
    disabled,
    showModeToggle = true,
    existingExtra,
  } = props;
  const searchId = useId();
  const existingId = useId();
  const [query, setQuery] = useState('');
  const [live, setLive] = useState<DomainSuggestionResult[] | null>(null);
  const [searchError, setSearchError] = useState('');
  const [existingError, setExistingError] = useState('');

  const candidates = useMemo(
    () => suggestDomains({ shopName, townCity, query }),
    [shopName, townCity, query],
  );
  const rows = useMemo(() => asResults(candidates, live), [candidates, live]);

  useEffect(() => {
    if (mode !== 'KERSIVO_REGISTER' || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(searchEndpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query }),
            signal: controller.signal,
          });
          const body = (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            suggestions?: DomainSuggestionResult[];
            error?: string;
          };
          if (!response.ok || !body.suggestions) {
            throw new Error(body.error || 'Unable to check domains just now.');
          }
          if (!controller.signal.aborted) {
            setLive(body.suggestions);
            setSearchError('');
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setSearchError(error instanceof Error ? error.message : 'Unable to check domains just now.');
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [disabled, mode, query, searchEndpoint, shopName, townCity]);

  function selectRow(row: DomainSuggestionResult & { pending: boolean }) {
    if (disabled || row.pending || !canSelectForRegister(row)) return;
    onSelectDomain(row.domain);
  }

  function onExistingBlur() {
    const checked = normalizeAndValidateDomainInput(existingDomain);
    if (!checked.ok) {
      setExistingError(checked.error);
      return;
    }
    setExistingError('');
    if (checked.value) onExistingDomainChange(checked.value);
  }

  return (
    <div className="domain-searcher ks-glass-card ks-glass-card--accent">
      <p className="ks-eyebrow domain-searcher__eyebrow">Your domain</p>
      {showModeToggle ? (
        <div className="domain-searcher__modes" role="radiogroup" aria-label="Domain option">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'EXISTING'}
            className={`domain-searcher__mode${mode === 'EXISTING' ? ' is-selected' : ''}`}
            disabled={disabled}
            onClick={() => onModeChange('EXISTING')}
          >
            <p className="domain-searcher__mode-title">I already have a domain</p>
            <p className="domain-searcher__mode-body">Your existing hostname — no registrar password.</p>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'KERSIVO_REGISTER'}
            className={`domain-searcher__mode${mode === 'KERSIVO_REGISTER' ? ' is-selected' : ''}`}
            disabled={disabled}
            onClick={() => onModeChange('KERSIVO_REGISTER')}
          >
            <p className="domain-searcher__mode-title">Find a domain for me</p>
            <p className="domain-searcher__mode-body">Search standard names included in Full KERSIVO.</p>
          </button>
        </div>
      ) : null}

      {mode === 'EXISTING' ? (
        <div className="domain-searcher__field">
          <label className="domain-searcher__label" htmlFor={existingId}>
            Your domain
          </label>
          <input
            id={existingId}
            className="domain-searcher__input"
            value={existingDomain}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            placeholder="yourshop.co.uk"
            onChange={(event) => {
              setExistingError('');
              onExistingDomainChange(event.target.value);
            }}
            onBlur={onExistingBlur}
          />
          <p className="domain-searcher__hint">You keep ownership. We will not ask for a registrar password.</p>
          {existingError ? (
            <p className="domain-searcher__error" role="alert">
              {existingError}
            </p>
          ) : null}
          {existingExtra}
        </div>
      ) : null}

      {mode === 'KERSIVO_REGISTER' ? (
        <>
          <p className="domain-searcher__help">
            We’ll register this standard domain for you after you subscribe, included in Full KERSIVO. Premium
            names aren’t included.
          </p>
          <div className="domain-searcher__field">
            <label className="domain-searcher__label" htmlFor={searchId}>
              Search for a domain
            </label>
            <input
              id={searchId}
              className="domain-searcher__input"
              value={query}
              disabled={disabled}
              autoComplete="off"
              spellCheck={false}
              placeholder="yourshop or yourshop.co.uk"
              onChange={(event) => {
                setLive(null);
                setQuery(event.target.value);
              }}
            />
          </div>
          <ul className="domain-searcher__list" role="listbox" aria-label="Domain suggestions">
            {rows.map((row) => {
              const selectable = !row.pending && canSelectForRegister(row);
              const selected = selectedDomain === row.domain;
              const status = row.pending ? 'checking' : row.status;
              return (
                <li key={row.domain}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={disabled || !selectable}
                    className={`domain-searcher__row${selected ? ' is-selected' : ''}${row.pending ? ' is-pending' : ''}`}
                    onClick={() => selectRow(row)}
                  >
                    <span className="domain-searcher__name">{row.domain}</span>
                    <span className={`domain-searcher__pill domain-searcher__pill--${status}`}>
                      {status === 'available' && row.included
                        ? 'Available'
                        : status === 'available'
                          ? 'Not included'
                          : PILL_LABEL[status]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {searchError ? (
            <p className="domain-searcher__error" role="alert">
              {searchError}
            </p>
          ) : null}
          <label className="domain-searcher__check">
            <input
              type="checkbox"
              checked={authorised}
              disabled={disabled}
              onChange={(event) => onAuthorisedChange(event.target.checked)}
            />
            <span>{DOMAIN_AUTH_TEXT}</span>
          </label>
        </>
      ) : null}
    </div>
  );
}
