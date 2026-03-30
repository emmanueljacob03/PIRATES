import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import TeamChatClient from '@/components/TeamChatClient';
import type { Profile, TeamChatMessage } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const cookieStore = await cookies();
  const demo = cookieStore.get('pirates_demo')?.value === 'true';

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialMessages: TeamChatMessage[] = [];
  let senderName = 'Member';

  if (user && !demo) {
    const { data: profileRow } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
    const profile = profileRow as Pick<Profile, 'name'> | null;
    senderName = profile?.name?.trim() || user.email?.split('@')[0] || 'Member';

    const { data: rows, error: chatErr } = await supabase
      .from('team_chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(250);

    if (!chatErr && rows) initialMessages = rows as TeamChatMessage[];
  }

  return (
    <TeamChatClient
      initialMessages={initialMessages}
      userId={user?.id ?? null}
      senderName={senderName}
      isDemo={demo}
    />
  );
}
