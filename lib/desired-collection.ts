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

  // Vercel: filesystem is per-instance and not shared — reading `.data` here often returns stale `0.00`
  // and overwrites the real Supabase value in the UI. Only use the file on non-Vercel hosts (local dev).
  if (process.env.VERCEL) {
    return '0.00';
  }

  return readFromFile();
}

export type WriteDesiredCollectionResult = {
  dbPersisted: boolean;
  /** Set when dbPersisted is false (e.g. missing env, missing column, RLS). */
  detail?: string;
};

/**
 * Persists to `.data` (local dev) and Supabase `team_chat_settings` (production).
 * Requires `SUPABASE_SERVICE_ROLE_KEY` on the server for DB write; run `alter_team_chat_settings_desired_collection.sql` for the column.
 */
export async function writeDesiredCollectionValue(value: string): Promise<WriteDesiredCollectionResult> {
  if (!process.env.VERCEL) {
    await writeToFile(value);
  }

  let supabase: ReturnType<typeof createAdminSupabase>;
  try {
    supabase = createAdminSupabase();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn('[desired-collection]', msg);
    return {
      dbPersisted: false,
      detail:
        'Server is missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. Add them in Vercel (or .env.local) so the value saves to the database.',
    };
  }

  const { error } = await (supabase as any).from('team_chat_settings').upsert(
    {
      id: 1,
      desired_collection: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );

  if (error) {
    console.warn('[desired-collection] Supabase upsert failed:', error.message);
    return {
      dbPersisted: false,
      detail: `${error.message} — If this mentions a missing column, run supabase/alter_team_chat_settings_desired_collection.sql in Supabase SQL Editor.`,
    };
  }

  const { data, error: verifyErr } = await supabase
    .from('team_chat_settings')
    .select('desired_collection')
    .eq('id', 1)
    .maybeSingle();

  if (verifyErr) {
    console.warn('[desired-collection] verify select failed:', verifyErr.message);
    return { dbPersisted: false, detail: verifyErr.message };
  }

  if (data == null) {
    return {
      dbPersisted: false,
      detail: 'No row id=1 in team_chat_settings after save. Run supabase/team_chat_settings.sql then try again.',
    };
  }

  const raw = (data as { desired_collection?: string | null }).desired_collection;
  const gotStr = typeof raw === 'string' ? raw.trim() : raw != null ? String(raw).trim() : '';
  const want = value.trim();
  const sameText = gotStr === want;
  const sameMoney =
    !Number.isNaN(parseFloat(gotStr)) &&
    !Number.isNaN(parseFloat(want)) &&
    Math.abs(parseFloat(gotStr) - parseFloat(want)) < 0.005;
  if (!sameText && !sameMoney) {
    return {
      dbPersisted: false,
      detail: 'Saved but read-back did not match. Check that column desired_collection exists and RLS allows the service role.',
    };
  }

  return { dbPersisted: true };
}
