import { parseChatBody } from '@/lib/chat-parse';
import type { TeamChatMessage } from '@/types/database';

/** Image URLs from chat messages sent by this user (markdown image body). */
export function chatImageUrlsForUser(messages: TeamChatMessage[], userId: string): string[] {
  const out: string[] = [];
  for (const m of messages) {
    if (m.user_id !== userId) continue;
    const p = parseChatBody(m.body);
    if (p.kind === 'image') out.push(p.url);
  }
  return Array.from(new Set(out));
}
