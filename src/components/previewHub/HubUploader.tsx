import { useCallback, useId, useRef, useState } from 'react';
import type { PreviewHubAssetKind } from '@prisma/client';
import {
  HUB_ATTACH,
  HUB_RETRY,
  HUB_UPLOAD_CAMERA,
  HUB_UPLOAD_CHOOSE,
  HUB_UPLOAD_DROP,
  HUB_UPLOAD_ERROR_GENERIC,
  HUB_UPLOAD_HINT,
  HUB_UPLOAD_PROGRESS,
} from '@/lib/freePreview/hubCopy';
import { downscaleHubImage, isHubSvgOrPdf } from './downscaleHubImage';

export type HubUploaderKind = Extract<
  PreviewHubAssetKind,
  'LOGO' | 'SHOP_PHOTO' | 'TEAM_PHOTO' | 'PRICE_LIST' | 'MESSAGE_ATTACHMENT' | 'CHANGE_ATTACHMENT' | 'OTHER'
>;

export type HubUploadedAsset = {
  id: string;
  kind: PreviewHubAssetKind;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  caption: string | null;
  sortOrder: number;
  barberId: string | null;
  uploadedBy: 'OWNER' | 'KERSIVO';
  createdAt: string;
  hasThumb: boolean;
};

type QueueItem = {
  localId: string;
  file: File;
  name: string;
  progress: number;
  error: string | null;
  status: 'queued' | 'uploading' | 'done' | 'error';
};

const ACCEPT: Record<HubUploaderKind, string> = {
  LOGO: 'image/jpeg,image/png,image/webp,image/svg+xml,application/pdf',
  SHOP_PHOTO: 'image/jpeg,image/png,image/webp',
  TEAM_PHOTO: 'image/jpeg,image/png,image/webp',
  PRICE_LIST: 'image/jpeg,image/png,image/webp,application/pdf',
  MESSAGE_ATTACHMENT: 'image/jpeg,image/png,image/webp,application/pdf',
  CHANGE_ATTACHMENT: 'image/jpeg,image/png,image/webp,application/pdf',
  OTHER: 'image/jpeg,image/png,image/webp,application/pdf',
};

const PHOTO_KINDS = new Set<HubUploaderKind>(['SHOP_PHOTO', 'TEAM_PHOTO']);

async function uploadOne(input: {
  token: string;
  kind: HubUploaderKind;
  file: File;
  onProgress: (value: number) => void;
}): Promise<HubUploadedAsset> {
  const prepared = isHubSvgOrPdf(input.file) ? input.file : await downscaleHubImage(input.file);
  const body = new FormData();
  body.append('kind', input.kind);
  body.append('file', prepared, prepared.name);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/preview-hub/${encodeURIComponent(input.token)}/assets`);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) input.onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      const payload = xhr.response as { ok?: boolean; asset?: HubUploadedAsset; error?: string } | null;
      if (xhr.status >= 200 && xhr.status < 300 && payload?.ok && payload.asset) {
        resolve(payload.asset);
        return;
      }
      reject(new Error(payload?.error || HUB_UPLOAD_ERROR_GENERIC));
    };
    xhr.onerror = () => reject(new Error(HUB_UPLOAD_ERROR_GENERIC));
    xhr.send(body);
  });
}

export function HubUploader(props: {
  token: string;
  kind: HubUploaderKind;
  disabled?: boolean;
  multiple?: boolean;
  compact?: boolean;
  hint?: string;
  remaining?: number;
  onUploaded: (asset: HubUploadedAsset) => void;
}) {
  const inputId = useId();
  const cameraId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const running = useRef(0);
  const queueRef = useRef<QueueItem[]>([]);

  const updateItem = (localId: string, patch: Partial<QueueItem>) => {
    setItems((current) => current.map((item) => (item.localId === localId ? { ...item, ...patch } : item)));
    queueRef.current = queueRef.current.map((item) => (item.localId === localId ? { ...item, ...patch } : item));
  };

  const pump = useCallback(async () => {
    while (running.current < 3) {
      const next = queueRef.current.find((item) => item.status === 'queued');
      if (!next) return;
      running.current += 1;
      updateItem(next.localId, { status: 'uploading', progress: 4, error: null });
      try {
        const asset = await uploadOne({
          token: props.token,
          kind: props.kind,
          file: next.file,
          onProgress: (value) => updateItem(next.localId, { progress: value }),
        });
        updateItem(next.localId, { status: 'done', progress: 100 });
        props.onUploaded(asset);
      } catch (error) {
        updateItem(next.localId, {
          status: 'error',
          error: error instanceof Error ? error.message : HUB_UPLOAD_ERROR_GENERIC,
        });
      } finally {
        running.current -= 1;
        void pump();
      }
    }
  }, [props]);

  const enqueue = (files: File[]) => {
    if (props.disabled || !files.length) return;
    const capped =
      typeof props.remaining === 'number' ? files.slice(0, Math.max(0, props.remaining)) : files;
    if (!capped.length) return;
    const next = capped.map((file) => ({
      localId: `${file.name}-${file.size}-${crypto.randomUUID()}`,
      file,
      name: file.name,
      progress: 0,
      error: null,
      status: 'queued' as const,
    }));
    queueRef.current = [...queueRef.current, ...next];
    setItems((current) => [...current.filter((item) => item.status !== 'done'), ...next]);
    void pump();
  };

  const retry = (item: QueueItem) => {
    updateItem(item.localId, { status: 'queued', error: null, progress: 0 });
    void pump();
  };

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    enqueue(Array.from(list));
    if (inputRef.current) inputRef.current.value = '';
  };

  const active = items.filter((item) => item.status !== 'done');
  const uploading = items.filter((item) => item.status === 'uploading' || item.status === 'queued');
  const accept = ACCEPT[props.kind];
  const camera = PHOTO_KINDS.has(props.kind) || props.kind === 'MESSAGE_ATTACHMENT';

  if (props.compact) {
    return (
      <div className="hub-uploader hub-uploader--compact">
        <input
          id={inputId}
          ref={inputRef}
          className="hub-sr-only"
          type="file"
          accept={accept}
          multiple={props.multiple !== false}
          disabled={props.disabled}
          onChange={(event) => onFiles(event.target.files)}
        />
        {camera ? (
          <input
            id={cameraId}
            ref={cameraRef}
            className="hub-sr-only"
            type="file"
            accept={accept}
            capture="environment"
            disabled={props.disabled}
            onChange={(event) => {
              onFiles(event.target.files);
              if (cameraRef.current) cameraRef.current.value = '';
            }}
          />
        ) : null}
        <div className="hub-uploader__compact-actions">
          <label htmlFor={inputId} className="btn btn--ghost btn--sm">
            {HUB_ATTACH}
          </label>
          {camera ? (
            <label htmlFor={cameraId} className="btn btn--ghost btn--sm">
              {HUB_UPLOAD_CAMERA}
            </label>
          ) : null}
        </div>
        <div className="hub-sr-only" aria-live="polite">
          {uploading.length ? HUB_UPLOAD_PROGRESS(items.filter((item) => item.status === 'done').length, items.length) : ''}
        </div>
        {active.length ? (
          <ul className="hub-uploader__list">
            {active.map((item) => (
              <li key={item.localId}>
                <div className="hub-uploader__row">
                  <span>{item.name}</span>
                  {item.status === 'error' ? (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => retry(item)}>
                      {HUB_RETRY}
                    </button>
                  ) : (
                    <span>{item.progress}%</span>
                  )}
                </div>
                <div className="hub-uploader__bar" aria-hidden="true">
                  <span style={{ width: `${item.progress}%` }} />
                </div>
                {item.error ? <p className="hub-uploader__error">{item.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div className="hub-uploader">
      <div
        className={`hub-uploader__drop${dragOver ? ' is-over' : ''}${props.disabled ? ' is-disabled' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          if (!props.disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          onFiles(event.dataTransfer.files);
        }}
      >
        <input
          id={inputId}
          ref={inputRef}
          className="hub-uploader__input"
          type="file"
          accept={accept}
          multiple={props.multiple !== false}
          disabled={props.disabled}
          onChange={(event) => onFiles(event.target.files)}
        />
        {camera ? (
          <input
            id={cameraId}
            ref={cameraRef}
            className="hub-sr-only"
            type="file"
            accept={accept}
            capture="environment"
            disabled={props.disabled}
            onChange={(event) => {
              onFiles(event.target.files);
              if (cameraRef.current) cameraRef.current.value = '';
            }}
          />
        ) : null}
        <p className="hub-uploader__title">{HUB_UPLOAD_DROP}</p>
        <p className="hub-uploader__hint">{props.hint ?? HUB_UPLOAD_HINT}</p>
        <div className="hub-uploader__actions">
          <label htmlFor={inputId} className="btn btn--secondary btn--sm">
            {HUB_UPLOAD_CHOOSE}
          </label>
          {camera ? (
            <label htmlFor={cameraId} className="btn btn--ghost btn--sm">
              {HUB_UPLOAD_CAMERA}
            </label>
          ) : null}
        </div>
      </div>
      <div className="hub-sr-only" aria-live="polite">
        {uploading.length ? HUB_UPLOAD_PROGRESS(items.filter((item) => item.status === 'done').length, items.length) : ''}
      </div>
      {active.length ? (
        <ul className="hub-uploader__list">
          {active.map((item) => (
            <li key={item.localId}>
              <div className="hub-uploader__row">
                <span>{item.name}</span>
                {item.status === 'error' ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => retry(item)}>
                    {HUB_RETRY}
                  </button>
                ) : (
                  <span>{item.progress}%</span>
                )}
              </div>
              <div className="hub-uploader__bar" aria-hidden="true">
                <span style={{ width: `${item.progress}%` }} />
              </div>
              {item.error ? <p className="hub-uploader__error">{item.error}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
