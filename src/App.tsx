/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TransactionsPage } from './pages/Transactions';
import { DREPage } from './pages/DRE';
import { SettingsPage } from './pages/Settings';
import { CashFlowPage } from './pages/CashFlow';
import { OnboardingPage } from './pages/Onboarding';
import { InfrastructureSetupPage } from './pages/InfrastructureSetup';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { FilterProvider } from './contexts/FilterContext';
import { supabase, isConfigured } from './supabase';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [isSupabaseSetup, setIsSupabaseSetup] = React.useState<boolean>(isConfigured());
  const [isTableMissing, setIsTableMissing] = React.useState<boolean>(false);
  const [isSystemEmpty, setIsSystemEmpty] = React.useState<boolean | null>(null);

  console.log('[FinScale] App State:', { isSupabaseSetup, isTableMissing, isSystemEmpty });

  const checkSystemStatus = React.useCallback(async () => {
    if (!isSupabaseSetup) return;
    
    try {
      // Verificar se existem usuários ou cargos no Supabase
      const { data: usersData, error: usersError } = await supabase.from('profiles').select('id').limit(1);
      const { data: rolesData, error: rolesError } = await supabase.from('roles').select('id').limit(1);

      // Se a tabela não existe (42P01), redirecionamos para a tela de inicialização SQL
      if ((usersError && usersError.code === '42P01') || (rolesError && rolesError.code === '42P01')) {
        setIsTableMissing(true);
        return;
      }

      setIsSystemEmpty(!usersData?.length && !rolesData?.length);
    } catch (error) {
      console.error('Erro ao verificar status do sistema:', error);
      setIsSystemEmpty(false); // Fallback para login em caso de erro
    }
  }, [isSupabaseSetup]);

  React.useEffect(() => {
    checkSystemStatus();
  }, [checkSystemStatus]);

  // Se as variáveis de ambiente não estiverem configuradas OU as tabelas estiverem faltando
  if (!isSupabaseSetup || isTableMissing) {
    return <InfrastructureSetupPage onComplete={() => {
      setIsSupabaseSetup(true);
      setIsTableMissing(false);
      checkSystemStatus();
    }} />;
  }

  if (isSystemEmpty === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-6 text-center">
        <div className="space-y-6">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-bold tracking-widest uppercase text-white/50">Carregando FinScale</p>
            <p className="text-[10px] text-white/30 tracking-tight leading-relaxed">Verificando integridade do banco de dados...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isSystemEmpty) {
    return <OnboardingPage onComplete={() => setIsSystemEmpty(false)} />;
  }

  return (
    <AuthProvider>
      <CompanyProvider>
        <FilterProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="transacoes" element={<TransactionsPage />} />
                <Route path="dre" element={<DREPage />} />
                <Route path="fluxo-caixa" element={<CashFlowPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </FilterProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
