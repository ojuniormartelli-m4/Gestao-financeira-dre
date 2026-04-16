import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Rocket, ShieldCheck, LayoutGrid, UserPlus, RefreshCw, CheckCircle2, Wifi, ArrowRight } from 'lucide-react';
import { verifyConnection, createRoles, createChartOfAccounts, createAdminUser } from '../seedAuth';
import { cn } from '../lib/utils';

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'Passo 1', desc: 'Verificando Conexão', icon: <Wifi size={20} /> },
  { id: 2, title: 'Passo 2', desc: 'Criando Cargos e Permissões', icon: <ShieldCheck size={20} /> },
  { id: 3, title: 'Passo 3', desc: 'Configurando Plano de Contas', icon: <LayoutGrid size={20} /> },
  { id: 4, title: 'Passo 4', desc: 'Criando Usuário Mestre', icon: <UserPlus size={20} /> }
];

export function OnboardingPage({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0); // 0 = initial, 1-4 = steps, 5 = success
  const [loading, setLoading] = useState(false);
  const companyId = 'minha-empresa-demo';

  const handleSetup = async () => {
    setLoading(true);
    
    try {
      // Passo 1: Conexão
      setCurrentStep(1);
      await verifyConnection();
      await new Promise(r => setTimeout(r, 800)); // Delay visual

      // Passo 2: Cargos
      setCurrentStep(2);
      await createRoles();
      await new Promise(r => setTimeout(r, 800));

      // Passo 3: Plano de Contas
      setCurrentStep(3);
      await createChartOfAccounts(companyId);
      await new Promise(r => setTimeout(r, 800));

      // Passo 4: Usuário
      setCurrentStep(4);
      await createAdminUser();
      await new Promise(r => setTimeout(r, 800));

      setCurrentStep(5);
    } catch (error) {
      console.error(error);
      alert('Erro durante a configuração. Verifique sua conexão.');
      setCurrentStep(0);
    } finally {
      setLoading(false);
    }
  };

  const progress = currentStep === 5 ? 100 : (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl bg-surface border border-border rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1.5 bg-border">
          <motion.div 
            className="h-full bg-accent shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 20 }}
          />
        </div>
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center text-accent mx-auto mb-6">
            <Rocket size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-text-primary mb-3">Configuração Inicial</h1>
          <p className="text-text-secondary text-sm max-w-sm mx-auto">
            Estamos preparando o ambiente do FinScale para sua empresa.
          </p>
        </div>

        <div className="space-y-4 mb-10">
          {STEPS.map((step, idx) => {
            const isCompleted = currentStep > step.id || currentStep === 5;
            const isActive = currentStep === step.id;
            
            return (
              <div 
                key={step.id}
                className={cn(
                  "flex items-center gap-4 p-4 rounded-2xl border transition-all duration-500",
                  isActive ? "bg-accent/5 border-accent/30 translate-x-2" : "bg-bg/30 border-border",
                  isCompleted ? "opacity-60" : ""
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isCompleted ? "bg-success/20 text-success" : 
                  isActive ? "bg-accent text-bg" : "bg-surface text-text-secondary"
                )}>
                  {isCompleted ? <CheckCircle2 size={20} /> : step.icon}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-text-primary">{step.title}</div>
                  <div className="text-[10px] text-text-secondary uppercase tracking-wider">{step.desc}</div>
                </div>
                {isActive && (
                  <RefreshCw size={16} className="animate-spin text-accent" />
                )}
              </div>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          {currentStep === 5 ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-success/10 border border-success/20 p-6 rounded-3xl text-center space-y-4">
                <div className="flex items-center justify-center gap-3 text-success font-bold text-xl">
                  <CheckCircle2 size={24} />
                  Tudo Pronto!
                </div>
                <p className="text-sm text-text-secondary">
                  O sistema foi configurado com sucesso. Use as credenciais:<br/>
                  <span className="inline-block mt-2 px-3 py-1 bg-surface rounded-lg font-mono text-text-primary">
                    admin / admin123
                  </span>
                </p>
              </div>
              
              <button 
                onClick={onComplete}
                className="w-full bg-accent text-bg font-bold py-5 rounded-3xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 text-lg group"
              >
                Finalizar e Ir para o Login
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          ) : (
            <motion.button 
              key="action"
              onClick={handleSetup}
              disabled={loading}
              className="w-full bg-accent text-bg font-bold py-5 rounded-3xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 flex items-center justify-center gap-3 text-lg disabled:opacity-50 group"
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={24} />
                  Configurando...
                </>
              ) : (
                <>
                  Iniciar Configuração
                  <Rocket size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        <div className="mt-10 text-center">
          <p className="text-[10px] text-text-secondary uppercase tracking-[0.3em]">
            FinScale Enterprise • Setup Wizard v1.1
          </p>
        </div>
      </motion.div>
    </div>
  );
}
