type MemoryBlobEntry = {
  bytes: Uint8Array;
  contentType: string;
};

const store = new Map<string, MemoryBlobEntry>();

export function isMemoryPrivateBlobEnabled(): boolean {
  if ((process.env.VERCEL_ENV ?? '').trim().toLowerCase() === 'production') return false;
  return (process.env.PRIVATE_BLOB_DRIVER ?? '').trim().toLowerCase() === 'memory';
}

async function toBytes(file: File | Blob): Promise<Uint8Array> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return new Uint8Array(buffer);
}

export async function memoryUploadPrivateFile(
  file: File | Blob,
  pathname: string,
  contentType?: string,
): Promise<{ pathname: string; contentType: string; sizeBytes: number }> {
  const type =
    contentType ||
    (file instanceof File ? file.type : '') ||
    'application/octet-stream';
  const bytes = await toBytes(file);
  store.set(pathname, { bytes, contentType: type });
  return { pathname, contentType: type, sizeBytes: bytes.byteLength };
}

export async function memoryDeletePrivateFile(pathname: string): Promise<void> {
  const path = pathname.trim();
  if (!path) return;
  store.delete(path);
}

export async function memoryRetrievePrivateFile(pathname: string): Promise<{
  stream: ReadableStream<Uint8Array> | null;
  contentType: string | null;
  statusCode: number;
}> {
  const path = pathname.trim();
  const entry = path ? store.get(path) : undefined;
  if (!entry) {
    return { stream: null, contentType: null, statusCode: 404 };
  }
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(entry.bytes);
        controller.close();
      },
    }),
    contentType: entry.contentType,
    statusCode: 200,
  };
}

export function memoryPrivateBlobSnapshot(): string[] {
  return [...store.keys()].sort();
}

export function resetMemoryPrivateBlob(): void {
  store.clear();
}
