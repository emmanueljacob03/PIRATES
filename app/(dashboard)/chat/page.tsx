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
  let isAdmin = false;

  if (user && !demo) {
    const { data: profileRow } = await supabase.from('profiles').select('name, role').eq('id', user.id).maybeSingle();
    const profile = profileRow as Pick<Profile, 'name' | 'role'> | null;
    senderName = profile?.name?.trim() || user.email?.split('@')[0] || 'Member';
    isAdmin = profile?.role === 'admin';

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
      isAdmin={isAdmin}
      isDemo={demo}
    />
  );
}
