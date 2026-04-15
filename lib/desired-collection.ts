import { promises as fs } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { createAdminSupabase } from '@/lib/supabase-admin';
import type { Database } from '@/types/database';

const STORE_PATH = path.join(process.cwd(), '.data', 'desired-collection.json');

async function readFromFile(): Promise<string> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { value?: string };
    return typeof parsed.value === 'string' ? parsed.value : '0.00';
  } catch {
    return '0.00';
  }
}

async function writeToFile(value: string): Promise<void> {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify({ value }, null, 2), 'utf8');
}

function pickDesiredFromRow(data: { desired_collection?: string | null } | null): string | null {
  if (!data || typeof data.desired_collection !== 'string') return null;
  const v = data.desired_collection.trim();
  return v !== '' ? v : null;
}

async function readFromTeamChatSettings(client: ReturnType<typeof createClient<Database>>): Promise<string | null> {
  const { data, error } = await client
    .from('team_chat_settings')
    .select('desired_collection')
    .eq('id', 1)
    .maybeSingle();
  if (error || data == null) return null;
  return pickDesiredFromRow(data as { desired_collection?: string | null });
}

/**
 * Read desired collection target (dollars as string e.g. "123.45").
 * Prefers Supabase `team_chat_settings.desired_collection` when present (survives Vercel); else `.data` file.
 * Tries service role first, then anon key (needs policy team_chat_settings_anon_select) if service role is missing.
 */
export async function readDesiredCollectionValue(): Promise<string> {
  try {
    const supabase = createAdminSupabase();
    const v = await readFromTeamChatSettings(supabase);
    if (v) return v;
  } catch {
    /* missing SUPABASE_SERVICE_ROLE_KEY or network */
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) {
    try {
      const client = createClient<Database>(url, anon);
      const v = await readFromTeamChatSettings(client);
      if (v) return v;
    } catch {
      /* */
    }
  }

  return readFromFile();
}

export async function writeDesiredCollectionValue(value: string): Promise<void> {
  await writeToFile(value);
  try {
    const supabase = createAdminSupabase();
    const { error } = await (supabase as any).from('team_chat_settings').upsert(
      {
        id: 1,
        desired_collection: value,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error) {
      // Common: column not created yet — run supabase/alter_team_chat_settings_desired_collection.sql
      console.warn('[desired-collection] Supabase upsert failed (file still saved locally):', error.message);
    }
  } catch (e) {
    console.warn('[desired-collection]', e);
  }
}
