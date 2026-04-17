import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_DEFAULT = 'https://hhrieawcfehdbjsayscv.supabase.co';
const SUPABASE_KEY_DEFAULT = 'sb_publishable_5qqK8XZPiOBb9SWaphqWUg_GeKgQeD1';

const configured = !!import.meta.env.NEXT_PUBLIC_SUPABASE_URL && !!import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isPreview = import.meta.env.DEV || window.location.hostname.includes('ais-dev') || window.location.hostname.includes('localhost');

// Fallback apenas para o ambiente de preview do AI Studio
const supabaseUrl = import.meta.env.NEXT_PUBLIC_SUPABASE_URL || (isPreview ? SUPABASE_URL_DEFAULT : '');
const supabaseAnonKey = import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (isPreview ? SUPABASE_KEY_DEFAULT : '');

if (!supabaseUrl || !supabaseAnonKey) {
  if (!isPreview) {
    console.error("ERRO CRÍTICO: Variáveis de ambiente NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_ANON_KEY não encontradas.");
  }
}

export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

export const isConfigured = () => {
  // Em produção, verificamos se as chaves reais existem
  if (!isPreview) {
    return !!import.meta.env.NEXT_PUBLIC_SUPABASE_URL && !!import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  return true;
};

export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
