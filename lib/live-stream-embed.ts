/** Video id from a YouTube watch, live, shorts, embed, or youtu.be URL. */
export function youtubeVideoIdFromUrl(input: string | null | undefined): string | null {
  const u = (input ?? '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;

  const m =
    u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
    u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
    u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/) ||
    u.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/);
  return m?.[1] ?? null;
}

/** Public watch URL (opens YouTube in browser / app share targets). */
export function youtubeCanonicalWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

/**
 * Embed YouTube’s live chat in an iframe — same chat as on youtube.com (when chat is enabled for the broadcast).
 * `embedDomainHostname` must match the hostname in your site’s URL (e.g. `www.myapp.com`).
 */
export function youtubeLiveChatEmbedSrc(
  videoId: string,
  embedDomainHostname: string,
): string | null {
  const d = embedDomainHostname.trim();
  if (!d) return null;
  return `https://www.youtube.com/live_chat?v=${encodeURIComponent(videoId)}&embed_domain=${encodeURIComponent(d)}`;
}

/**
 * Turn a public watch URL into a safe iframe src for YouTube or Vimeo.
 * Returns null if the URL is not a supported format.
 */
export function toLiveEmbedUrl(input: string | null | undefined): string | null {
  const u = (input ?? '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;

  if (u.includes('youtube.com/embed/') || u.includes('youtu.be') || u.includes('youtube.com/watch') || u.includes('youtube.com/live')) {
    const id = youtubeVideoIdFromUrl(u);
    if (id) return `https://www.youtube.com/embed/${id}?rel=0`;
  }

  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm?.[1]) {
    return `https://player.vimeo.com/video/${vm[1]}`;
  }
  if (u.includes('player.vimeo.com/video/')) {
    return u.split('?')[0];
  }

  return null;
}
