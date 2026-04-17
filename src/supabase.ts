import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_DEFAULT = 'https://hhrieawcfehdbjsayscv.supabase.co';
const SUPABASE_KEY_DEFAULT = 'sb_publishable_5qqK8XZPiOBb9SWaphqWUg_GeKgQeD1';

const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL_DEFAULT;
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_KEY_DEFAULT;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const isConfigured = () => {
  // Sempre retornamos true agora pois temos fallbacks para o preview
  return true;
};

export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
