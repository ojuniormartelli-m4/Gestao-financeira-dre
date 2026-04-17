import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, Copy, AlertCircle, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { isConfigured, supabase, getSupabaseUrl } from '../supabase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const REQUIRED_SQL = `-- 1. Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criar Tabela de Cargos
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Criar Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role_id TEXT REFERENCES roles(id),
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar Tabela de Categorias (Plano de Contas)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  dre_group TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Criar Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('PAID', 'PENDING')),
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Criar Tabela de Transferências
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  from_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  user_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Criar Tabela de Configurações da Empresa
CREATE TABLE IF NOT EXISTS company_configs (
  company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Habilitar Row Level Security (RLS)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_configs ENABLE ROW LEVEL SECURITY;

-- 10. Políticas de Acesso (Simplificadas para o App - Permitir tudo para autenticados)
-- Nota: Para produção real, restrinja por company_id ou user_id
CREATE POLICY "Permitir tudo para usuários autenticados" ON roles FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON profiles FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON bank_accounts FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON categories FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON transactions FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON transfers FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON company_configs FOR ALL USING (true);

-- 11. Configuração de Storage Buckets
-- Execute estes comandos para permitir acesso público aos arquivos
-- Certifique-se de criar os buckets 'avatars' e 'branding' no painel
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Acesso Público Leitura - Avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Acesso Público Escrita - Avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Acesso Público Leitura - Branding" ON storage.objects FOR SELECT USING (bucket_id = 'branding');
CREATE POLICY "Acesso Público Escrita - Branding" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'branding');
`;

interface Props {
  onComplete: () => void;
}

export function InfrastructureSetupPage({ onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const configured = isConfigured();

  const handleCopySql = () => {
    navigator.clipboard.writeText(REQUIRED_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      // Verificar se as tabelas foram criadas (testar profiles)
      const { error: checkError } = await supabase.from('profiles').select('id').limit(1);
      
      if (checkError && checkError.code === '42P01') {
        setError('As tabelas ainda não foram detectadas. Certifique-se de que executou o script SQL no dashboard do Supabase.');
        setLoading(false);
        return;
      }

      onComplete();
    } catch (err) {
      setError('Erro crítico ao verificar o banco de dados.');
    } finally {
      setLoading(false);
    }
  };

  if (!configured) {
    const isNextPublic = !!import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden text-text-primary">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg bg-surface border border-border rounded-[2.5rem] shadow-2xl p-10 text-center space-y-8 relative z-10">
          <div className="w-20 h-20 bg-danger/10 rounded-3xl flex items-center justify-center text-danger mx-auto">
            <Server size={40} />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Erro de Configuração</h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              As credenciais do <span className="text-accent font-bold">Supabase</span> não foram detectadas no ambiente.
            </p>
            <div className="bg-bg/50 border border-border p-4 rounded-2xl text-left space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">Variáveis Necessárias:</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <code className="text-accent">NEXT_PUBLIC_SUPABASE_URL</code>
                  <span className="text-danger font-medium">Ausente</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <code className="text-accent">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
                  <span className="text-danger font-medium">Ausente</span>
                </div>
              </div>
            </div>
            <p className="text-text-secondary text-xs italic">
              Após configurar as chaves, você <strong>precisa realizar um novo Deploy</strong> na Vercel para que as alterações entrem em vigor.
            </p>
          </div>
          <div className="pt-6 border-t border-border flex flex-col items-center gap-4">
            <p className="text-[10px] text-text-secondary font-medium tracking-widest uppercase">
              Desenvolvido por <span className="text-accent">M4 Marketing Digital</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8 md:p-12 relative z-10">
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6">
            <Database size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Inicialização do Banco</h1>
          <p className="text-text-secondary text-sm">Detectamos que seu banco de dados está vazio ou incompleto.</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3 text-danger text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="space-y-8">
          <div className="p-6 bg-accent/5 border border-accent/20 rounded-3xl space-y-4">
            <div className="flex items-center gap-3 text-accent">
              <ShieldCheck size={24} />
              <h3 className="font-bold">Instruções de Inicialização</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              1. Copie o código SQL abaixo.<br/>
              2. Vá no dashboard do Supabase (<span className="text-text-primary font-mono text-xs">{getSupabaseUrl()}</span>).<br/>
              3. Cole e execute no <strong className="text-text-primary">SQL Editor</strong>.<br/>
              4. <strong className="text-accent">Importante:</strong> Crie manualmente os buckets <code className="bg-bg px-1 rounded">avatars</code> e <code className="bg-bg px-1 rounded">branding</code> no menu Storage.
            </p>
            
            <div className="relative group">
              <pre className="bg-bg border border-border rounded-2xl p-4 text-[10px] font-mono text-text-secondary h-44 overflow-y-auto">
                {REQUIRED_SQL}
              </pre>
              <button onClick={handleCopySql} className="absolute top-2 right-2 p-2 bg-surface border border-border rounded-lg text-accent hover:border-accent transition-all flex items-center gap-2 text-[10px] font-bold">
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar Script SQL'}
              </button>
            </div>
          </div>

          <button onClick={handleFinalize} disabled={loading} className="w-full py-5 bg-accent text-bg rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50">
            {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={18} />}
            Já executei o SQL. Finalizar!
          </button>
        </div>

        <div className="mt-10 pt-10 border-t border-border/50 text-center">
          <p className="text-[10px] text-text-secondary font-medium tracking-widest uppercase">
            Desenvolvido por <span className="text-accent">M4 Marketing Digital</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
