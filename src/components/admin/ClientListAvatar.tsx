import React, { useCallback, useEffect, useRef, useState } from 'react';

import { adminFetchJson } from './adminAuth';

type ClientListAvatarProps = {
  clientId: string | null | undefined;
  fullName: string | null | undefined;
  avatarUrl?: string | null;
  className?: string;
  onAvatarChange?: (clientId: string, nextUrl: string) => void;
  /** When set, click opens this action (e.g. client profile) instead of the photo picker. */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

function getInitials(fullName: string | null | undefined): string {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export default function ClientListAvatar({
  clientId,
  fullName,
  avatarUrl,
  className = '',
  onAvatarChange,
  onClick,
}: ClientListAvatarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);

  const displayedUrl = previewUrl ?? avatarUrl ?? null;
  const initials = getInitials(fullName);
  const opensProfile = Boolean(onClick);
  const canUpload = Boolean(clientId) && !opensProfile;

  useEffect(() => {
    setHasImageError(false);
  }, [avatarUrl, clientId]);

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
  }, [previewUrl]);

  const openPicker = useCallback((event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (!canUpload || uploading) return;
    inputRef.current?.click();
  }, [canUpload, uploading]);

  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      event.stopPropagation();
      event.preventDefault();
      onClick(event);
      return;
    }
    openPicker(event);
  }, [onClick, openPicker]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !clientId) return;

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    setHasImageError(false);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await adminFetchJson<{ client: { avatarUrl?: string | null } }>(
        `/api/admin/clients/${clientId}`,
        {
          method: 'PATCH',
          body: formData,
          errorMessage: 'Could not upload photo.',
        },
      );

      const nextUrl = response.client.avatarUrl ?? objectUrl;
      onAvatarChange?.(clientId, nextUrl);
      if (response.client.avatarUrl) {
        setPreviewUrl(null);
        URL.revokeObjectURL(objectUrl);
      }
    } catch {
      setPreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }, [clientId, onAvatarChange]);

  const showImage = Boolean(displayedUrl) && !hasImageError;
  const profileLabel = `View profile for ${fullName ?? 'client'}`;
  const photoLabel = showImage
    ? `Change photo for ${fullName ?? 'client'}`
    : `Add photo for ${fullName ?? 'client'}`;

  return (
    <>
      <button
        type="button"
        className={`admin-client-list-avatar ${className}`.trim()}
        onClick={handleClick}
        disabled={opensProfile ? false : (!canUpload || uploading)}
        aria-label={opensProfile ? profileLabel : photoLabel}
        title={opensProfile ? 'View client profile' : (canUpload ? (showImage ? 'Change photo' : 'Add photo') : undefined)}
        aria-busy={uploading}
      >
        {showImage ? (
          <img
            src={displayedUrl!}
            alt=""
            className="admin-client-list-avatar__img"
            loading="lazy"
            onError={() => setHasImageError(true)}
          />
        ) : (
          <span className="admin-client-list-avatar__initials">{initials}</span>
        )}
      </button>
      {canUpload ? (
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="admin-client-list-avatar__input"
          onChange={(event) => { void handleFileChange(event); }}
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
