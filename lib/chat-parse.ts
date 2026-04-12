/** Parse chat message body for images and polls. */

const IMG_RE = /^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)\s*([\s\S]*)$/;
const POLL_PREFIX = '__POLL__\n';

/** Team chat room icon changed — render as WhatsApp-style system line, not raw text. */
export const SYS_ROOM_ICON_BODY = '__SYS_ROOM_ICON__';

export type ParsedChatBody =
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string; alt: string; caption: string }
  | { kind: 'poll'; question: string; options: string[] }
  | { kind: 'system'; systemKind: 'room_icon' };

export function parseChatBody(body: string): ParsedChatBody {
  const trimmed = body.trim();
  if (trimmed === SYS_ROOM_ICON_BODY) {
    return { kind: 'system', systemKind: 'room_icon' };
  }
  const img = trimmed.match(IMG_RE);
  if (img) {
    return {
      kind: 'image',
      alt: img[1] || 'photo',
      url: img[2]!,
      caption: (img[3] ?? '').trim(),
    };
  }
  if (trimmed.startsWith(POLL_PREFIX)) {
    try {
      const json = trimmed.slice(POLL_PREFIX.length).trim();
      const o = JSON.parse(json) as { q?: string; options?: string[] };
      const q = typeof o.q === 'string' ? o.q : '';
      const options = Array.isArray(o.options) ? o.options.filter((x) => typeof x === 'string' && x.trim()) : [];
      if (q && options.length >= 2) {
        return { kind: 'poll', question: q, options: options.slice(0, 8) };
      }
    } catch {
      /* fall through */
    }
  }
  return { kind: 'text', text: body };
}

export function formatPollBody(question: string, options: string[]): string {
  return `${POLL_PREFIX}${JSON.stringify({ q: question.trim(), options: options.map((o) => o.trim()).filter(Boolean) })}`;
}

export function formatImageBody(url: string, caption: string): string {
  const cap = caption.trim();
  return `![photo](${url})${cap ? `\n${cap}` : ''}`;
}
