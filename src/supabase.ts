import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_DEFAULT = 'https://hhrieawcfehdbjsayscv.supabase.co';
const SUPABASE_KEY_DEFAULT = 'sb_publishable_5qqK8XZPiOBb9SWaphqWUg_GeKgQeD1';

const configured = !!import.meta.env.NEXT_PUBLIC_SUPABASE_URL && !!import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isPreview = import.meta.env.DEV || 
  (typeof window !== 'undefined' && (
    window.location.hostname.includes('ais-dev') || 
    window.location.hostname.includes('localhost') ||
    window.location.hostname.includes('stackblitz') ||
    window.location.hostname.includes('preview')
  ));

console.log('[FinScale] Ambiente:', isPreview ? 'Preview/Dev' : 'Produção');
console.log('[FinScale] Hostname:', typeof window !== 'undefined' ? window.location.hostname : 'N/A');

// Fallback apenas para o ambiente de preview do AI Studio
const getEnv = (key: string) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return undefined;
  }
};

const vUrl = getEnv('VITE_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL');
const vKey = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');

const supabaseUrl = vUrl || (isPreview ? SUPABASE_URL_DEFAULT : '');
const supabaseAnonKey = vKey || (isPreview ? SUPABASE_KEY_DEFAULT : '');

console.log('[FinScale] Supabase URL carregada:', !!supabaseUrl);
console.log('[FinScale] Supabase Key carregada:', !!supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[FinScale] Erro de Configuração: Variáveis de Ambiente não encontradas na Vercel.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

export const isConfigured = () => {
  if (!isPreview) {
    return !!vUrl && !!vKey;
  }
  return true;
};

export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
