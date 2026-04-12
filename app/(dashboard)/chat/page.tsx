import { cookies } from 'next/headers';
import { createServerSupabase } from '@/lib/supabase-server';
import TeamChatClient from '@/components/TeamChatClient';
import { isDashboardAdmin } from '@/lib/admin-request';
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
  let roomHeaderImageUrl: string | null = null;
  let isAdmin = false;

  if (user && !demo) {
    const { data: profileRow } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
    const profile = profileRow as Pick<Profile, 'name'> | null;
    senderName = profile?.name?.trim() || user.email?.split('@')[0] || 'Member';
    isAdmin = await isDashboardAdmin();

    const { data: rows, error: chatErr } = await supabase
      .from('team_chat_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(250);

    if (!chatErr && rows) initialMessages = rows as TeamChatMessage[];

    const { data: settingsRow } = await supabase.from('team_chat_settings').select('header_image_url').eq('id', 1).maybeSingle();
    const s = settingsRow as { header_image_url: string | null } | null;
    roomHeaderImageUrl = s?.header_image_url?.trim() || null;
  }

  return (
    <TeamChatClient
      initialMessages={initialMessages}
      userId={user?.id ?? null}
      senderName={senderName}
      roomHeaderImageUrl={roomHeaderImageUrl}
      isAdmin={isAdmin}
      isDemo={demo}
    />
  );
}
