export type TextSegment =
  | { type: "text"; value: string }
  | { type: "link"; value: string; href: string };

const URL_PATTERN = /((https?:\/\/|www\.)[^\s<]+)/gi;

export function normalizeUserUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withProtocol = /^www\./i.test(trimmed) ? `https://${trimmed}` : trimmed;
  try {
    const parsed = new URL(withProtocol);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function extractUrlsFromText(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const match of matches) {
    const normalized = normalizeUserUrl(match);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

export function firstUrlFromText(text: string): string | null {
  const urls = extractUrlsFromText(text);
  return urls.length > 0 ? urls[0] : null;
}

export function segmentTextWithLinks(text: string): TextSegment[] {
  if (!text) return [{ type: "text", value: "" }];
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const index = match.index ?? -1;
    if (index < 0) continue;

    if (index > cursor) {
      segments.push({ type: "text", value: text.slice(cursor, index) });
    }

    const normalized = normalizeUserUrl(raw);
    if (normalized) {
      segments.push({
        type: "link",
        value: raw,
        href: normalized,
      });
    } else {
      segments.push({ type: "text", value: raw });
    }

    cursor = index + raw.length;
  }

  if (cursor < text.length) {
    segments.push({ type: "text", value: text.slice(cursor) });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", value: text });
  }

  return segments;
}
