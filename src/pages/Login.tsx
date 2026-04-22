import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { motion } from 'motion/react';
import { Lock, User, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.message || 'Usuário ou senha inválidos.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao tentar fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center text-bg font-bold text-3xl mx-auto mb-4 shadow-xl shadow-accent/20">
            F
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-text-primary">FinScale</h1>
          <p className="text-text-secondary mt-2">Gestão Financeira Inteligente</p>
        </div>

        <div className="bg-surface border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-secondary ml-1">E-mail</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input 
                  type="email" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-accent transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-text-secondary ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-accent transition-all"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/20 text-danger rounded-2xl text-sm"
              >
                <AlertCircle size={18} />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-bg font-bold py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : "Entrar no Sistema"}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-border text-center">
            <p className="text-xs text-text-secondary">
              Esqueceu sua senha? Entre em contato com o administrador.
            </p>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] text-text-secondary uppercase tracking-[0.2em]">
            &copy; 2026 FinScale SaaS • Versão 1.0.0
          </p>
          <p className="text-[10px] text-text-secondary font-medium">
            Desenvolvido por <span className="text-accent">M4 Marketing Digital</span>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
