import { createClient } from '@supabase/supabase-js'

// These are the project's public, client-side keys. The anon/publishable key
// is designed to be embedded in a browser bundle -- it has no power on its
// own. All real access control lives in Postgres Row Level Security
// (supabase/002_row_level_security.sql) and the SECURITY DEFINER functions
// in supabase/003_api_functions.sql, not here.
const SUPABASE_URL = 'https://jnbzpiqkrtsdtefdskjj.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Tgwl8RfvvRfuqagD6j7ozQ_l0-1qz_u'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
