function readSocialProfilesEnv(): string {
  return (
    import.meta.env.PUBLIC_SOCIAL_PROFILES ??
    process.env.PUBLIC_SOCIAL_PROFILES ??
    ''
  ).trim();
}

function parseJsonArray(raw: string): string[] | null {
  if (!raw.startsWith('[')) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return null;
  }
}

/** Public social profile URLs for schema.org sameAs (Instagram, LinkedIn, etc.). */
export function getSocialProfileUrls(): string[] {
  const raw = readSocialProfilesEnv();
  if (!raw) {
    return [];
  }

  const fromJson = parseJsonArray(raw);
  const candidates = fromJson ?? raw.split(',');

  const seen = new Set<string>();
  const urls: string[] = [];

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
      continue;
    }
    if (seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    urls.push(trimmed);
  }

  return urls;
}

export function getTwitterHandle(): string | undefined {
  const raw = (
    import.meta.env.PUBLIC_TWITTER_HANDLE ??
    process.env.PUBLIC_TWITTER_HANDLE ??
    ''
  ).trim();
  if (!raw) {
    return undefined;
  }
  return raw.startsWith('@') ? raw : `@${raw}`;
}
