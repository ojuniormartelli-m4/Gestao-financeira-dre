import React, { useState } from 'react';
import { Database, Link2, Play, CheckCircle2, Copy, AlertCircle, RefreshCw } from 'lucide-react';
import { setSupabaseConfig, supabase } from '../supabase';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

const REQUIRED_SQL = `
-- 1. Criar Tabela de Cargos
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Criar Tabela de Perfis de Usuário
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

-- 3. Criar Tabela de Contas Bancárias
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

-- 4. Criar Tabela de Plano de Contas (Categorias)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  dre_group TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  category_id TEXT REFERENCES chart_of_accounts(id),
  bank_account_id TEXT REFERENCES bank_accounts(id),
  status TEXT CHECK (status IN ('PAID', 'PENDING')),
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id TEXT REFERENCES profiles(id),
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Criar Tabela de Transferências
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  from_account_id TEXT REFERENCES bank_accounts(id),
  to_account_id TEXT REFERENCES bank_accounts(id),
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  user_id TEXT REFERENCES profiles(id),
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Criar Tabela de Configurações da Empresa
CREATE TABLE IF NOT EXISTS company_configs (
  company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS (Opcional para MVP, mas recomendado)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ... adicione suas políticas aqui
`;

interface Props {
  onComplete: () => void;
}

export function InfrastructureSetupPage({ onComplete }: Props) {
  const [url, setUrl] = useState(import.meta.env.VITE_SUPABASE_URL || '');
  const [key, setKey] = useState(import.meta.env.VITE_SUPABASE_ANON_KEY || '');
  const [step, setStep] = useState<'AUTH' | 'SQL'>('AUTH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      setSupabaseConfig(url, key);
      
      // Testar conexão tentando ler uma tabela (mesmo que não exista ainda, pegamos o erro de auth/conexão vs erro de tabela inexistente)
      const { error: testError } = await supabase.from('profiles').select('id').limit(1);
      
      if (testError && testError.code === 'PGRST301') { // JWT expired or invalid key
        throw new Error('Chave Anon inválida ou expirada.');
      }
      
      if (testError && testError.message.includes('failed to fetch')) {
        throw new Error('Não foi possível conectar ao Supabase. Verifique a URL.');
      }

      // Se chegamos aqui ou deu erro de "tabela não existe" (42P01), a conexão em si funcionou
      setStep('SQL');
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar. Verifique as credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(REQUIRED_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      // Verificar se as tabelas foram criadas (testar profiles)
      const { error: checkError } = await supabase.from('profiles').select('id').limit(1);
      
      if (checkError && checkError.code === '42P01') {
        setError('As tabelas ainda não foram criadas. Execute o SQL no dashboard do Supabase.');
        setLoading(false);
        return;
      }

      onComplete();
    } catch (err) {
      setError('Erro ao verificar tabelas.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8 md:p-12 relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mb-6">
            <Database size={32} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Configuração de Infraestrutura</h1>
          <p className="text-text-secondary">Conecte sua instância do Supabase para inicializar o FinScale</p>
        </div>

        {error && (
          <div className="mb-8 p-4 bg-danger/10 border border-danger/20 rounded-2xl flex items-center gap-3 text-danger text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        {step === 'AUTH' ? (
          <form onSubmit={handleConnect} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Supabase URL</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors">
                    <Link2 size={18} />
                  </div>
                  <input 
                    type="url" 
                    required
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    placeholder="https://xyz.supabase.co"
                    className="w-full bg-bg border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-accent outline-none ring-accent/5 focus:ring-4 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-text-secondary ml-1">Supabase Anon Key</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors">
                    <Play size={18} className="rotate-90" />
                  </div>
                  <input 
                    type="password" 
                    required
                    value={key}
                    onChange={e => setKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full bg-bg border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-accent outline-none ring-accent/5 focus:ring-4 transition-all"
                  />
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-accent text-bg rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <Play size={18} />}
              Conectar e Inicializar
            </button>
          </form>
        ) : (
          <div className="space-y-8">
            <div className="p-6 bg-accent/5 border border-accent/20 rounded-3xl space-y-4">
              <div className="flex items-center gap-3 text-accent">
                <CheckCircle2 size={24} />
                <h3 className="font-bold">Conexão Estabelecida!</h3>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Agora você precisa criar a estrutura do banco de dados. Copie o código SQL abaixo e cole-o no 
                <strong className="text-text-primary"> SQL Editor</strong> do seu dashboard do Supabase.
              </p>
              
              <div className="relative group">
                <pre className="bg-bg border border-border rounded-2xl p-4 text-[10px] font-mono text-text-secondary h-40 overflow-y-auto">
                  {REQUIRED_SQL}
                </pre>
                <button 
                  onClick={handleCopySql}
                  className="absolute top-2 right-2 p-2 bg-surface border border-border rounded-lg text-accent hover:border-accent transition-all flex items-center gap-2 text-[10px] font-bold"
                >
                  {copied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
                  {copied ? 'Copiado!' : 'Copiar SQL'}
                </button>
              </div>
            </div>

            <button 
              onClick={handleFinalize}
              disabled={loading}
              className="w-full py-5 bg-accent text-bg rounded-2xl font-bold flex items-center justify-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <CheckCircle2 size={18} />}
              Já executei o SQL. Finalizar!
            </button>
            <button 
              onClick={() => setStep('AUTH')}
              className="w-full text-text-secondary text-sm font-bold hover:text-text-primary transition-colors"
            >
              Voltar para Credenciais
            </button>
          </div>
        )}

        <div className="mt-10 pt-10 border-t border-border/50 text-center">
          <p className="text-[10px] text-text-secondary font-medium tracking-widest uppercase">
            Desenvolvido por <span className="text-accent">M4 Marketing Digital</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
