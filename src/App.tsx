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
  const [isSystemEmpty, setIsSystemEmpty] = React.useState<boolean | null>(null);

  const checkSystemStatus = React.useCallback(async () => {
    if (!isSupabaseSetup) return;
    
    try {
      // Verificar se existem usuários ou cargos no Supabase
      const { data: usersData, error: usersError } = await supabase.from('profiles').select('id').limit(1);
      const { data: rolesData, error: rolesError } = await supabase.from('roles').select('id').limit(1);

      // Se a tabela não existe (42P01), consideramos o sistema "não configurado" ou vazio para disparar o onboarding
      if ((usersError && usersError.code === '42P01') || (rolesError && rolesError.code === '42P01')) {
        setIsSystemEmpty(true);
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

  if (!isSupabaseSetup) {
    return <InfrastructureSetupPage onComplete={() => {
      setIsSupabaseSetup(true);
      window.location.reload(); // Recarregar para garantir que o cliente Supabase use as novas configs
    }} />;
  }

  if (isSystemEmpty === null) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <RefreshCw className="w-10 h-10 text-accent animate-spin" />
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
