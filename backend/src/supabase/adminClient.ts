import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl            = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('❌ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env');
}

// Client dédié aux opérations Auth Admin (auth.admin.*)
// Ne jamais appeler auth.getUser() sur ce client pour éviter la contamination de session.
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
    detectSessionInUrl: false,
  },
});
