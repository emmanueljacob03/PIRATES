import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

/**
 * Browser client via auth-helpers so the session is stored in cookies that
 * createServerComponentClient / middleware can read. Plain @supabase/supabase-js
 * createClient() only used localStorage → server always thought user was logged out.
 */
export const supabase = createClientComponentClient<Database>();
