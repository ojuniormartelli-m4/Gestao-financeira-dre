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
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [companyConfig, setCompanyConfigState] = useState<CompanyConfig>({ name: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshConfig();
    }
  }, [user]);

  const setCompanyConfig = (config: CompanyConfig) => {
    setCompanyConfigState(config);
  };

  return (
    <CompanyContext.Provider value={{ companyConfig, setCompanyConfig, loading, refreshConfig }}>
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
