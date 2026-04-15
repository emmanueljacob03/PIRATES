import { promises as fs } from 'fs';
import path from 'path';
import { createAdminSupabase } from '@/lib/supabase-admin';

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

/**
 * Read desired collection target (dollars as string e.g. "123.45").
 * Prefers Supabase `team_chat_settings.desired_collection` when present (survives Vercel); else `.data` file.
 */
export async function readDesiredCollectionValue(): Promise<string> {
  try {
    const supabase = createAdminSupabase();
    const { data, error } = await (supabase as any)
      .from('team_chat_settings')
      .select('desired_collection')
      .eq('id', 1)
      .maybeSingle();
    if (!error && data && typeof (data as { desired_collection?: string | null }).desired_collection === 'string') {
      const v = (data as { desired_collection: string }).desired_collection.trim();
      if (v !== '') return v;
    }
  } catch {
    /* column may not exist yet, or no service role */
  }
  return readFromFile();
}

export async function writeDesiredCollectionValue(value: string): Promise<void> {
  await writeToFile(value);
  try {
    const supabase = createAdminSupabase();
    const { error } = await (supabase as any)
      .from('team_chat_settings')
      .update({
        desired_collection: value,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    if (error) {
      // Common: column not created yet — run supabase/alter_team_chat_settings_desired_collection.sql
      console.warn('[desired-collection] Supabase update failed (file still saved locally):', error.message);
    }
  } catch (e) {
    console.warn('[desired-collection]', e);
  }
}
