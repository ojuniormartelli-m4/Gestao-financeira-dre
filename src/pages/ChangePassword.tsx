import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase';
import { motion } from 'motion/react';
import { Lock, RefreshCw, AlertCircle, CheckCircle2, ShieldAlert, Eye, EyeOff, Sparkles, LogOut } from 'lucide-react';

export function ChangePasswordPage() {
  const { user, updateUser } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { logout } = useAuth();

  const generateStrongPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let newPass = '';
    for (let i = 0; i < 12; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(newPass);
    setConfirmPassword(newPass);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || success) return; // Evitar disparos múltiplos
    
    console.log('[ChangePassword] Iniciando tentativa de alteração...');
    setError('');

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      // 1. Atualizar senha no Supabase Auth
      console.log('[ChangePassword] Passo 1: Atualizando senha no Supabase Auth...');
      const { data, error: authError } = await supabase.auth.updateUser({
        password: password
      });

      if (authError) {
        console.error('[ChangePassword] Erro retornado pelo Supabase:', authError);
        
        // Tradução de erros comuns do Supabase
        if (authError.message.includes('should be different')) {
          throw new Error('A nova senha não pode ser igual à senha atual (admin123). Escolha uma senha nova.');
        }
        
        if (authError.status === 422) {
          throw new Error('Senha muito fraca ou inválida. Use pelo menos 6 caracteres com letras e números.');
        }
        
        throw authError;
      }

      console.log('[ChangePassword] Auth atualizado com sucesso:', data);

      // 2. Atualizar perfil
      if (user?.id) {
        console.log('[ChangePassword] Passo 2: Atualizando perfil no banco...');
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', user.id);

        if (profileError) {
          console.warn('[ChangePassword] Erro ao atualizar perfil (RLS?), mas senha Auth foi alterada.');
        }
      }

      setSuccess(true);
      setTimeout(() => {
        // Forçar reload total para limpar erros 406 e sincronizar sessão
        window.location.href = '/';
      }, 1000);

    } catch (err: any) {
      console.error('[ChangePassword] Erro capturado:', err);
      setError(err.message || 'Erro ao atualizar senha. Verifique se o RLS está desativado no seu SQL.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-surface border border-border rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-accent/20">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8 }}
          />
        </div>

        <div className="text-center mb-8">
          <div className="flex justify-between items-start mb-4">
            <button 
              onClick={() => logout()}
              className="p-2 text-text-secondary hover:text-error transition-colors flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest"
            >
              <LogOut size={16} />
              Sair
            </button>
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent">
              <ShieldAlert size={32} />
            </div>
            <div className="w-10"></div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-text-primary mb-2">Primeiro Acesso</h1>
          <p className="text-text-secondary text-xs max-w-[240px] mx-auto uppercase tracking-widest leading-relaxed">
            Por segurança, você deve alterar sua senha inicial agora.
          </p>
        </div>

        {success ? (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-success/10 border border-success/20 p-6 rounded-3xl text-center space-y-4"
          >
            <div className="flex items-center justify-center gap-3 text-success font-bold">
              <CheckCircle2 size={24} />
              Senha Atualizada!
            </div>
            <p className="text-sm text-text-secondary">Você será redirecionado para o painel em instantes...</p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">Nova Senha</label>
                <button 
                  type="button"
                  onClick={generateStrongPassword}
                  className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline flex items-center gap-1"
                >
                  <Sparkles size={10} />
                  Sugerir Senha Forte
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:border-accent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary ml-1">Confirmar Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full bg-bg border border-border rounded-2xl py-4 pl-12 pr-12 text-sm focus:outline-none focus:border-accent transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-secondary hover:text-accent transition-colors"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-4 bg-danger/10 border border-danger/20 text-danger rounded-2xl text-xs"
              >
                <AlertCircle size={16} />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-accent text-bg font-bold py-5 rounded-3xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 text-lg disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : "Definir Nova Senha"}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
