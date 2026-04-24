import React, { useState } from 'react';
import { Database, CheckCircle2, Copy, AlertCircle, RefreshCw, Server, ShieldCheck } from 'lucide-react';
import { isConfigured, supabase } from '../supabase';
import { RESET_DATABASE_SQL } from '../sqlConstants';

const REQUIRED_SQL = RESET_DATABASE_SQL;

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
              Variáveis de Ambiente não encontradas.
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
