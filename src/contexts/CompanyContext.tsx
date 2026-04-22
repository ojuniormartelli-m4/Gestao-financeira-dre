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
  companyId: string;
  setCompanyId: (id: string) => void;
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
  const [companyId, setCompanyIdState] = useState<string>(() => {
    const saved = localStorage.getItem('companyId');
    return saved && saved !== 'null' ? saved : '';
  });

  // Sincronizar companyId com o usuário logado
  useEffect(() => {
    if (user?.companyId) {
      setCompanyIdState(user.companyId);
      localStorage.setItem('companyId', user.companyId);
    }
  }, [user]);

  const setCompanyId = (id: string) => {
    const validId = id && id !== 'null' ? id : '';
    setCompanyIdState(validId);
    localStorage.setItem('companyId', validId);
  };

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
    
    if (!companyId || companyId === 'null') {
      console.warn('[CompanyContext] ID inválido detectado em refreshData, restaurando padrão...');
      setCompanyId('m4-digital');
      return;
    }

    console.log(`[CompanyContext] Iniciando carga resiliente para: ${companyId}`);
    setLoading(true);

    try {
      // Carregamos cada um individualmente para que um erro em um não trave os outros
      const fetchTask = async (task: () => Promise<any>, name: string) => {
        try {
          return await task();
        } catch (e) {
          console.error(`[CompanyContext] Falha ao carregar ${name}:`, e);
          return [];
        }
      };

      const [banks, cats, pms, ccs, cnts, cards] = await Promise.all([
        fetchTask(() => financeService.buscarContasBancarias(companyId), 'bancos'),
        fetchTask(() => financeService.buscarPlanoDeContas(companyId), 'categorias'),
        fetchTask(() => financeService.buscarFormasPagamento(companyId), 'pagamentos'),
        fetchTask(() => financeService.buscarCentrosCusto(companyId), 'centros'),
        fetchTask(() => financeService.buscarContatos(companyId), 'contatos'),
        fetchTask(() => financeService.buscarCartoesCredito(companyId), 'cartões')
      ]);
      
      console.log(`[CompanyContext] Carga finalizada para ${companyId}:`, {
        bancos: banks?.length || 0,
        categorias: cats?.length || 0,
        pagamentos: pms?.length || 0,
        centros: ccs?.length || 0,
        contatos: cnts?.length || 0,
        cartoes: cards?.length || 0
      });

      setBankAccounts(banks || []);
      setCategories(cats || []);
      setPaymentMethods(pms || []);
      setCostCenters(ccs || []);
      setContacts(cnts || []);
      setCreditCards(cards || []);
    } catch (error) {
      console.error('Erro crítico no refreshData:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && companyId && companyId !== 'null') {
      const init = async () => {
        await financeService.verificarEPovoarDadosIniciais(companyId);
        await Promise.all([refreshConfig(), refreshData()]);
      };
      init();
    }
  }, [user, companyId]);

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
      companyId,
      setCompanyId,
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
