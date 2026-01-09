const YOUTUBE_HOSTS = new Set(["www.youtube.com", "youtube.com", "m.youtube.com", "youtu.be"]);

export function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;
    if (parsed.hostname === "youtu.be") {
      return parsed.pathname.replace("/", "");
    }
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v");
    if (parsed.pathname.startsWith("/shorts/")) {
      return parsed.pathname.split("/shorts/")[1]?.split("/")[0];
    }
    return null;
  } catch {
    return null;
  }
}
