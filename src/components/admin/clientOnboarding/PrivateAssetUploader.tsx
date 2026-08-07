import React, { useRef, useState } from 'react';
import type { OnboardingAsset } from './types';
import { looksLikePublicBlobUrl, readJsonError } from './types';

const KIND_LABELS: Record<string, string> = {
  BRAND_LOGO: 'Logo',
  GALLERY_IMAGE: 'Gallery image',
  BRAND_GUIDELINES: 'Brand guidelines',
  MIGRATION_CSV: 'Customer export',
  OTHER: 'File',
};

export function PrivateAssetUploader({
  kind,
  accept,
  assets,
  disabled,
  onChanged,
  hint,
}: {
  kind: string;
  accept: string;
  assets: OnboardingAsset[];
  disabled?: boolean;
  onChanged: () => Promise<void> | void;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [localName, setLocalName] = useState<string | null>(null);

  const matching = assets.filter((a) => a.kind === kind);

  const upload = async (file: File) => {
    setBusy(true);
    setError('');
    setLocalName(file.name);
    try {
      const form = new FormData();
      form.set('kind', kind);
      form.set('file', file);
      const response = await fetch('/api/admin/client-onboarding/assets', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(body.error || 'Upload failed.');
        return;
      }
      await onChanged();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setBusy(false);
      setLocalName(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/client-onboarding/assets', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        const body = await readJsonError(response);
        setError(body.error || 'Could not remove file.');
        return;
      }
      await onChanged();
    } catch {
      setError('Could not remove file.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="client-onboarding__section">
      <div className="admin-onboarding__upload-tile">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          disabled={disabled || busy}
          aria-label={`Upload ${KIND_LABELS[kind] || 'file'}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <p className="admin-onboarding__upload-label">
          {busy && localName ? `Uploading ${localName}…` : `Upload ${KIND_LABELS[kind] || 'file'}`}
        </p>
        {hint ? <p className="field__hint">{hint}</p> : null}
      </div>
      {error ? (
        <p className="field__error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="client-onboarding__asset-list">
        {matching.map((asset) => {
          const unsafe = looksLikePublicBlobUrl(asset.storagePath);
          return (
            <div key={asset.id} className="client-onboarding__asset-row">
              <div>
                <p className="client-onboarding__asset-name">{asset.originalFileName}</p>
                <p className="client-onboarding__asset-kind">
                  {KIND_LABELS[asset.kind] || asset.kind} uploaded
                  {unsafe ? ' · invalid storage reference' : ''}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                disabled={disabled || busy}
                onClick={() => void remove(asset.id)}
              >
                Remove
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
