import { createClient } from '@supabase/supabase-js';

const vUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const vKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const configured = !!vUrl && !!vKey;
const isPreview = import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev') || 
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('stackblitz') ||
    window.location.hostname.includes('preview')
  ));

console.log('[FinScale] Ambiente:', isPreview ? 'Preview/Dev' : 'Produção');

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
