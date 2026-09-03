export type StoredProfileMetadata = {
  contentHash: string;
  taxonomyVersion: string;
  schemaVersion: string;
  promptVersion: string;
  modelId: string;
};

export function isStoredProfileReusable(
  existing: StoredProfileMetadata,
  expected: StoredProfileMetadata,
): boolean {
  return (
    existing.contentHash === expected.contentHash &&
    existing.taxonomyVersion === expected.taxonomyVersion &&
    existing.schemaVersion === expected.schemaVersion &&
    existing.promptVersion === expected.promptVersion &&
    existing.modelId === expected.modelId
  );
}
