/**
 * Turn a public watch URL into a safe iframe src for YouTube or Vimeo.
 * Returns null if the URL is not a supported format.
 */
export function toLiveEmbedUrl(input: string | null | undefined): string | null {
  const u = (input ?? '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return null;

  if (u.includes('youtube.com/embed/') || u.includes('youtu.be') || u.includes('youtube.com/watch') || u.includes('youtube.com/live')) {
    const m =
      u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
      u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
      u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/) ||
      u.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/);
    if (m?.[1]) {
      return `https://www.youtube.com/embed/${m[1]}?rel=0`;
    }
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
