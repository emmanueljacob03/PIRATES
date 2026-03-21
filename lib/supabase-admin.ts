import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Server-only. Use for admin actions that must bypass RLS (e.g. insert match when user is admin by cookie). */
export function createAdminSupabase() {
  if (!url || !serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL');
  return createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });
}
