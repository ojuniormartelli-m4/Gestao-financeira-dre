import { createClient } from '@supabase/supabase-js';

const configured = !!import.meta.env.NEXT_PUBLIC_SUPABASE_URL && !!import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isPreview = import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev') || 
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('stackblitz') ||
    window.location.hostname.includes('preview')
  ));

console.log('[FinScale] Ambiente:', isPreview ? 'Preview/Dev' : 'Produção');

// Recuperação de variáveis de ambiente
const getEnv = (key: string) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return undefined;
  }
};

const vUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const vKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

// O sistema não deve ter fallbacks hardcoded em produção
const supabaseUrl = vUrl || '';
const supabaseAnonKey = vKey || '';

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);

export const isConfigured = () => {
  return !!supabaseUrl && !!supabaseAnonKey;
};

export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
