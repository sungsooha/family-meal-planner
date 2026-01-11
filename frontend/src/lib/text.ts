export function decodeHtmlEntities(value: string): string {
  if (!value) return value;
  if (typeof document === "undefined") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

export function stripHashtags(value: string): string {
  return value.replace(/#[^\s#]+/g, "").replace(/\s{2,}/g, " ").trim();
}

export function sanitizeTitle(value: string): string {
  return stripHashtags(decodeHtmlEntities(value));
}

export function normalizeTitle(value: string): string {
  return sanitizeTitle(value).replace(/[^\p{L}\p{N}]+/gu, " ").toLowerCase().trim();
}

export function tokenizeTitle(value: string): string[] {
  return normalizeTitle(value)
    .split(/\s+/)
    .filter(Boolean);
}

export function scoreTitleMatch(a: string, b: string): number {
  const aTokens = new Set(tokenizeTitle(a));
  const bTokens = new Set(tokenizeTitle(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(aTokens.size, bTokens.size);
}
