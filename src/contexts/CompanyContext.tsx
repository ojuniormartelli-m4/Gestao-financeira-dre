import React, { createContext, useContext, useState, useEffect } from 'react';
import { financeService } from '../financeService';
import { useAuth } from './AuthContext';

interface CompanyConfig {
  name: string;
  logoUrl: string;
}

interface CompanyContextType {
  companyConfig: CompanyConfig;
  setCompanyConfig: (config: CompanyConfig) => void;
  loading: boolean;
  refreshConfig: () => Promise<void>;
  bankAccounts: any[];
  categories: any[];
  paymentMethods: any[];
  costCenters: any[];
  contacts: any[];
  creditCards: any[];
  refreshData: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyConfig, setCompanyConfigState] = useState<CompanyConfig>({ name: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const { user } = useAuth();
  const companyId = 'm4-digital';

  const refreshConfig = async () => {
    try {
      const config = await financeService.buscarConfiguracaoEmpresa(companyId);
      if (config) {
        setCompanyConfigState(config);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração da empresa:', error);
    }
  };

  const refreshData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [banks, cats, pms, ccs, cnts, cards] = await Promise.all([
        financeService.buscarContasBancarias(companyId),
        financeService.buscarPlanoDeContas(companyId),
        financeService.buscarFormasPagamento(companyId),
        financeService.buscarCentrosCusto(companyId),
        financeService.buscarContatos(companyId),
        financeService.buscarCartoesCredito(companyId)
      ]);
      setBankAccounts(banks || []);
      setCategories(cats || []);
      setPaymentMethods(pms || []);
      setCostCenters(ccs || []);
      setContacts(cnts || []);
      setCreditCards(cards || []);
    } catch (error) {
      console.error('Erro ao carregar dados da empresa:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const init = async () => {
        await financeService.verificarEPovoarDadosIniciais(companyId);
        await Promise.all([refreshConfig(), refreshData()]);
      };
      init();
    }
  }, [user]);

  const setCompanyConfig = (config: CompanyConfig) => {
    setCompanyConfigState(config);
  };

  return (
    <CompanyContext.Provider value={{ 
      companyConfig, 
      setCompanyConfig, 
      loading, 
      refreshConfig,
      bankAccounts,
      categories,
      paymentMethods,
      costCenters,
      contacts,
      creditCards,
      refreshData
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}
