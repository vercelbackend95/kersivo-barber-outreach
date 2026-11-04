/**
 * Streaming .zip writer on fflate. Entries are pulled one at a time and file bodies chunk by chunk, so a
 * pack with many photos never sits in memory at once: the ReadableStream only asks for more when the
 * client has taken what was already sent.
 *
 * Binary files are stored (photos and PDFs are already compressed); text files are deflated. Sizes are
 * not needed up front: fflate writes data descriptors.
 */
import { Zip, ZipDeflate, ZipPassThrough, strToU8 } from 'fflate';

export type ZipEntry =
  | { path: string; text: string }
  | {
      path: string;
      /** Opens the file body. Return null (or throw) when it cannot be read: the entry is skipped. */
      open: () => Promise<AsyncIterable<Uint8Array> | null>;
      /** Called when the file is skipped or cut short. */
      onFail?: (reason: string) => void;
    };

export async function* readableToIterable(stream: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader();
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      if (value?.byteLength) yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/** Zip bytes for a lazily produced list of entries. */
export async function* zipChunks(entries: AsyncIterable<ZipEntry> | Iterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  const queue: Uint8Array[] = [];
  let failure: Error | null = null;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else if (chunk?.byteLength) queue.push(chunk);
  });
  const drain = function* () {
    if (failure) throw failure;
    while (queue.length) yield queue.shift()!;
  };

  for await (const entry of entries) {
    if ('text' in entry) {
      const file = new ZipDeflate(entry.path, { level: 6 });
      zip.add(file);
      file.push(strToU8(entry.text), true);
      yield* drain();
      continue;
    }

    let body: AsyncIterable<Uint8Array> | null = null;
    try {
      body = await entry.open();
    } catch (error) {
      entry.onFail?.(error instanceof Error ? error.message : 'read failed');
      continue;
    }
    if (!body) {
      entry.onFail?.('not found in storage');
      continue;
    }

    const file = new ZipPassThrough(entry.path);
    zip.add(file);
    try {
      for await (const chunk of body) {
        file.push(chunk);
        yield* drain();
      }
    } catch (error) {
      // The entry is already in the archive: close it and report it as incomplete.
      entry.onFail?.(`incomplete: ${error instanceof Error ? error.message : 'read failed'}`);
    }
    file.push(new Uint8Array(0), true);
    yield* drain();
  }

  zip.end();
  yield* drain();
}

export function iterableToStream(source: AsyncGenerator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await source.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await source.return(undefined);
    },
  });
}
