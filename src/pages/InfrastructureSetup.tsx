import React, { useState } from 'react';
import { Database, CheckCircle2, Copy, AlertCircle, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { isConfigured, supabase, getSupabaseUrl } from '../supabase';
import { cn } from '../lib/utils';

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
  id UUID PRIMARY KEY, -- Deve ser o mesmo ID do auth.users
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL, -- Email do usuário
  role_id TEXT REFERENCES roles(id),
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  type TEXT, -- CHECKING, SAVINGS, CASH, CREDIT_CARD
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar Tabela de Categorias (Plano de Contas)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  dre_group TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.1 Criar Tabela de Centros de Custo
CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.2 Criar Tabela de Contatos (Clientes/Fornecedores)
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('CLIENT', 'SUPPLIER')),
  document TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.3 Criar Tabela de Formas de Pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5.4 Criar Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credit_limit NUMERIC DEFAULT 0,
  closing_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Criar Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  category_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('PAID', 'PENDING', 'CANCELLED', 'SCHEDULED', 'CONCILIATED')),
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

-- 9. Função RPC para Atualizar Saldo Atomicamente
CREATE OR REPLACE FUNCTION increment_balance(account_id TEXT, amount_to_add NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE bank_accounts
  SET current_balance = current_balance + amount_to_add
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Desativar Row Level Security (RLS) para Setup Inicial
-- (Recomendado: Habilitar e configurar políticas após o primeiro login)
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_configs DISABLE ROW LEVEL SECURITY;

-- 11. Políticas de Acesso
CREATE POLICY "Permitir tudo para usuários autenticados" ON roles FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON profiles FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON bank_accounts FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON chart_of_accounts FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON cost_centers FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON contacts FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON payment_methods FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON credit_cards FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON transactions FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON transfers FOR ALL USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON company_configs FOR ALL USING (true);

-- 12. Configuração de Storage Buckets
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
      // Verificar se as tabelas fundamentais existem (Profiles e Roles)
      const { error: pError } = await supabase.from('profiles').select('id').limit(1);
      const { error: rError } = await supabase.from('roles').select('id').limit(1);
      
      const isMissing = (err: any) => 
        err && (err.code === '42P01' || err.code === 'PGRST116' || err.code === 'PGRST205' || err.code === 'PGRST204');

      if (isMissing(pError) || isMissing(rError)) {
        setError('As tabelas ainda não foram detectadas. Certifique-se de que executou o script SQL no dashboard do Supabase e aguarde alguns segundos.');
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
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 text-white text-center">
        <div className="w-full max-w-lg bg-[#111114] border border-[#27272a] rounded-[2rem] p-10 space-y-8 shadow-2xl">
          <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mx-auto">
            <Server size={40} />
          </div>
          <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight text-red-500">Erro de Configuração</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Variáveis de Ambiente não encontradas na Vercel.
            </p>
            <div className="bg-black/40 border border-[#27272a] p-6 rounded-2xl text-left space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Configuração das Variáveis (Secrets):</p>
              <div className="space-y-3">
                <p className="text-xs text-gray-300">No menu <strong>Secrets</strong> à direita (ícone de cadeado), adicione:</p>
                <div className="pl-4 space-y-2">
                  <code className="block text-[11px] text-sky-400">VITE_SUPABASE_URL</code>
                  <code className="block text-[11px] text-sky-400">VITE_SUPABASE_ANON_KEY</code>
                  <code className="block text-[11px] text-sky-400">VITE_GEMINI_API_KEY</code>
                </div>
                <p className="text-[10px] text-gray-500 leading-tight">
                  Após adicionar e salvar, a tela será atualizada automaticamente.
                </p>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-[#27272a] flex flex-col items-center gap-4">
            <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">
              FinScale - Gestão Estratégica
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 text-white text-center font-sans">
      <div className="w-full max-w-2xl bg-[#111114] border border-[#27272a] rounded-[2rem] p-8 md:p-12 shadow-2xl space-y-8">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-500 mb-6">
            <Database size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Inicialização do Banco</h1>
          <p className="text-gray-400 text-sm">Detectamos que seu banco de dados está vazio ou incompleto.</p>
        </div>

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-sm italic">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div className="p-6 bg-sky-500/5 border border-sky-500/20 rounded-3xl space-y-4 text-left">
            <div className="flex items-center gap-3 text-sky-400">
              <ShieldCheck size={24} />
              <h3 className="font-bold">Script SQL de Estrutura</h3>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Copie o código abaixo e execute no <strong>SQL Editor</strong> do seu painel Supabase para criar as tabelas e permissões necessárias.
            </p>
            
            <div className="relative group">
              <pre className="bg-black/60 border border-[#27272a] rounded-2xl p-4 text-[10px] font-mono text-gray-500 h-44 overflow-y-auto">
                {REQUIRED_SQL}
              </pre>
              <button 
                onClick={handleCopySql} 
                className="absolute top-2 right-2 px-3 py-1.5 bg-[#1c1c1f] border border-[#27272a] rounded-lg text-sky-400 hover:border-sky-500 transition-all flex items-center gap-2 text-[10px] font-bold"
              >
                {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado!' : 'Copiar Script'}
              </button>
            </div>
          </div>

          <button 
            onClick={handleFinalize} 
            disabled={loading} 
            className="w-full py-5 bg-sky-500 text-black rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-sky-400 transition-all shadow-xl shadow-sky-500/10 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={18} />}
            Já executei o SQL. Finalizar!
          </button>
        </div>

        <div className="pt-6 border-t border-[#27272a]/50 text-center">
          <p className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">
            Desenvolvido por <span className="text-sky-400">M4 Marketing Digital</span>
          </p>
        </div>
      </div>
    </div>
  );
}
