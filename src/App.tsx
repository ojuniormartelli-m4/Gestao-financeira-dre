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
import { ContactsPage } from './pages/Contacts';
import { ExtractTransactionsPage } from './pages/ExtractTransactions';
import { BalanceSheetPage } from './pages/BalanceSheet';
import { CreditCardsPage } from './pages/CreditCards';
import { OnboardingPage } from './pages/Onboarding';
import { ChangePasswordPage } from './pages/ChangePassword';
import { InfrastructureSetupPage } from './pages/InfrastructureSetup';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/Login';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { FilterProvider } from './contexts/FilterContext';
import { SidebarProvider } from './contexts/SidebarContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { supabase, isConfigured } from './supabase';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [isSupabaseSetup, setIsSupabaseSetup] = React.useState<boolean>(isConfigured());
  const [isTableMissing, setIsTableMissing] = React.useState<boolean>(false);
  const [isSystemEmpty, setIsSystemEmpty] = React.useState<boolean | null>(null);
  const [isForcingSetup, setIsForcingSetup] = React.useState<boolean>(window.location.search.includes('force_setup=true'));

  console.log('[FinScale] App State:', { isSupabaseSetup, isTableMissing, isSystemEmpty, isForcingSetup });

  const checkSystemStatus = React.useCallback(async () => {
    if (!isSupabaseSetup) return;
    
    try {
      // Verificar se as tabelas fundamentais existem
      const { error: usersError } = await supabase.from('profiles').select('id').limit(1);
      const { error: rolesError } = await supabase.from('roles').select('id').limit(1);

      // Função auxiliar para identificar se o erro é de "Tabela Inexistente"
      const isTableMissingError = (error: any) => {
        if (!error) return false;
        return (
          error.code === '42P01' || // Postgres: Undefined Table
          error.code === 'PGRST205' || // PostgREST: Table not found in cache
          error.code === 'PGRST204' || // PostgREST: Relation not found
          (error.message && error.message.includes('not find the table'))
        );
      };

      if (isTableMissingError(usersError) || isTableMissingError(rolesError)) {
        console.log('[FinScale] Tabelas ausentes detectadas. Redirecionando para Setup SQL...');
        setIsTableMissing(true);
        return;
      }

      // Se chegamos aqui, as tabelas existem. Vamos ver se estão vazias.
      const { data: usersData } = await supabase.from('profiles').select('id').limit(1);
      const { data: rolesData } = await supabase.from('roles').select('id').limit(1);

      setIsSystemEmpty(!usersData?.length && !rolesData?.length);
    } catch (error) {
      console.error('Erro ao verificar status do sistema:', error);
      setIsSystemEmpty(false); 
    }
  }, [isSupabaseSetup]);

  React.useEffect(() => {
    checkSystemStatus();
  }, [checkSystemStatus]);

  // Se as variáveis de ambiente não estiverem configuradas OU as tabelas estiverem faltando OU forçado pelo usuário
  if (!isSupabaseSetup || isTableMissing || isForcingSetup) {
    return <InfrastructureSetupPage 
      onBack={() => {
        setIsForcingSetup(false);
        if (window.location.search.includes('force_setup=true')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
      }}
      onComplete={() => {
        setIsSupabaseSetup(true);
        setIsTableMissing(false);
        setIsForcingSetup(false);
        // Limpar a URL para remover o force_setup=true
        if (window.location.search.includes('force_setup=true')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        checkSystemStatus();
      }} 
    />;
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
    <ThemeProvider>
      <AuthProvider>
        <CompanyProvider>
          <FilterProvider>
            <SidebarProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route element={<ProtectedRoute />}>
                    <Route path="/trocar-senha" element={<ChangePasswordPage />} />
                    <Route path="/" element={<Layout />}>
                      <Route index element={<DashboardPage />} />
                      <Route path="transacoes" element={<TransactionsPage />} />
                      <Route path="dre" element={<DREPage />} />
                      <Route path="dfc" element={<CashFlowPage />} />
                      <Route path="contatos" element={<ContactsPage />} />
                      <Route path="extrato" element={<ExtractTransactionsPage />} />
                      <Route path="balanco" element={<BalanceSheetPage />} />
                      <Route path="cartoes" element={<CreditCardsPage />} />
                      <Route path="configuracoes" element={<SettingsPage />} />
                    </Route>
                  </Route>
                </Routes>
              </BrowserRouter>
            </SidebarProvider>
          </FilterProvider>
        </CompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
