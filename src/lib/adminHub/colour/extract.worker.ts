/// <reference lib="webworker" />
import { extractPalette } from './extract';

export type ExtractWorkerRequest = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

self.onmessage = (event: MessageEvent<ExtractWorkerRequest>) => {
  const { data, width, height } = event.data;
  const swatches = extractPalette({ data, width, height });
  (self as DedicatedWorkerGlobalScope).postMessage({ swatches });
};
