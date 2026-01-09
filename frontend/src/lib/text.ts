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
