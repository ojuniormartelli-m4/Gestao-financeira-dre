import { useState, useEffect } from 'react';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  MoreHorizontal,
  X,
  Lock,
  RefreshCw,
  Download,
  ArrowLeftRight,
  Upload,
  FileSpreadsheet,
  ChevronRight,
  Check,
  AlertCircle,
  Sparkles,
  Wallet
} from 'lucide-react';
import { financeService } from '../financeService';
import { aiService } from '../aiService';
import { Transaction, ChartOfAccount, TransactionStatus } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useFilter } from '../contexts/FilterContext';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import { LoginPage } from './Login';
import { supabase } from '../supabase';

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedBankId, setSelectedBankId } = useFilter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<ChartOfAccount[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [creditCards, setCreditCards] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  const initialStatus = (searchParams.get('status') as TransactionStatus | 'ALL') || 'ALL';
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'ALL'>(initialStatus);
  
  const [filterType, setFilterType] = useState<'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM'>('MONTH');
  const [filterDate, setFilterDate] = useState(new Date());
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [customStartDate, setCustomStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchTerm, setSearchTerm] = useState('');
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const statusParam = searchParams.get('status');
    if (statusParam) {
      setFilterStatus(statusParam as TransactionStatus | 'ALL');
    } else {
      setFilterStatus('ALL');
    }
  }, [searchParams]);

  const updateStatusFilter = (status: TransactionStatus | 'ALL') => {
    setFilterStatus(status);
    const newParams = new URLSearchParams(searchParams);
    if (status === 'ALL') {
      newParams.delete('status');
    } else {
      newParams.set('status', status);
    }
    setSearchParams(newParams);
  };
  
  const companyId = 'm4-digital';

  // Debug Logs
  console.log('ID da Empresa atual:', companyId);
  console.log('Contas recebidas no componente:', accounts);

  if (accounts.length === 0 && !loading) {
    console.warn('Nenhuma conta encontrada para este companyId:', companyId);
  }

  const handleToggleStatus = async (tx: Transaction) => {
    try {
      const newStatus = tx.status === 'PAID' ? 'PENDING' : 'PAID';
      await financeService.quitarTransacao(companyId, tx.id, newStatus);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) return;
    
    const data = transactions.map(t => ({
      Data: format(t.dateCompetence, 'dd/MM/yyyy'),
      Descrição: t.description,
      Valor: t.amount,
      Tipo: t.type === 'REVENUE' ? 'Receita' : 'Despesa',
      Status: t.status === 'PAID' ? 'Pago' : 'Pendente',
      Categoria: categories.find(c => c.id === t.categoryId)?.name || 'N/A'
    }));

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Transacoes_${format(filterDate, 'yyyy_MM')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let start: Date;
      let end: Date;

      if (filterType === 'TODAY') {
        const today = new Date();
        start = new Date(today.setHours(0, 0, 0, 0));
        end = new Date(today.setHours(23, 59, 59, 999));
      } else if (filterType === 'MONTH') {
        start = startOfMonth(filterDate);
        end = endOfMonth(filterDate);
      } else if (filterType === 'YEAR') {
        start = new Date(filterYear, 0, 1, 0, 0, 0, 0);
        end = new Date(filterYear, 11, 31, 23, 59, 59, 999);
      } else {
        start = new Date(customStartDate + 'T00:00:00');
        end = new Date(customEndDate + 'T23:59:59');
      }

      console.log('Filtro ativo:', filterType, { start: start.toISOString(), end: end.toISOString() });
      console.log('Buscando transações entre:', start.toLocaleDateString(), 'e', end.toLocaleDateString());

      const [txs, cats, banks, cards, cCenters, cnts, pMethods] = await Promise.all([
        financeService.buscarTransacoes(companyId, { 
          startDate: start, 
          endDate: end,
          bankAccountId: selectedBankId,
          status: filterStatus
        }),
        financeService.buscarPlanoDeContas(companyId),
        financeService.buscarContasBancarias(companyId),
        financeService.buscarCartoesCredito(companyId),
        financeService.buscarCentrosCusto(companyId),
        financeService.buscarContatos(companyId),
        financeService.buscarFormasPagamento(companyId)
      ]);
      
      console.log('Resultados da Busca:', txs);
      let finalBanks = banks || [];
      
      // Fallback: If no banks found with companyId, try without filter for debugging/test
      if (finalBanks.length === 0) {
        console.log('Tentando carregar bancos sem filtro de company_id para teste');
        try {
          const { data: allBanks } = await supabase.from('bank_accounts').select('*');
          if (allBanks && allBanks.length > 0) {
            console.log('Bancos encontrados sem filtro (DEBUG):', allBanks);
            finalBanks = allBanks.map(item => ({
              id: item.id,
              name: item.name,
              bankName: item.bank_name,
              initialBalance: Number(item.initial_balance || 0),
              currentBalance: Number(item.current_balance || 0),
              color: item.color
            }));
          }
        } catch (e) {
          console.error('Erro no fallback de bancos:', e);
        }
      }

      console.log("Contas carregadas no filtro:", finalBanks);
      console.log('Resultados da Busca:', txs);
      setTransactions(txs || []);
      setCategories(cats || []);
      setAccounts(finalBanks);
      setCreditCards(cards || []);
      setCostCenters(cCenters || []);
      setContacts(cnts || []);
      setPaymentMethods(pMethods || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initPage = async () => {
      const isValidCompany = companyId && String(companyId) !== 'null' && String(companyId).trim() !== '';
      if (!authLoading && user && isValidCompany) {
        console.log(`[Transactions] Inicializando para empresa: ${companyId}`);
        await financeService.verificarEPovoarDadosIniciais(companyId);
        loadData();
      } else {
        console.log('[Transactions] Aguardando empresa válida ou usuário autenticado...');
      }
    };
    initPage();
  }, [filterType, filterDate, filterYear, customStartDate, customEndDate, user, authLoading, selectedBankId, companyId]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transações</h1>
          <p className="text-text-secondary text-sm">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-sm font-bold hover:border-accent transition-all"
          >
            <ArrowLeftRight size={18} className="text-accent" />
            Transferência
          </button>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 bg-surface hover:bg-white/5 border border-border text-text-secondary hover:text-text-primary px-4 py-2 rounded-xl font-bold transition-all"
          >
            <Upload size={20} />
            <span className="hidden md:inline">Importar Planilha</span>
          </button>
          <button 
            onClick={exportToCSV}
            disabled={transactions.length === 0}
            className="flex items-center gap-2 bg-surface hover:bg-white/5 border border-border text-text-secondary hover:text-text-primary px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
          >
            <Download size={20} />
            <span className="hidden md:inline">Exportar CSV</span>
          </button>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-accent hover:opacity-90 text-bg px-4 py-2 rounded-xl font-bold transition-all shadow-lg shadow-accent/20"
          >
            <Plus size={20} />
            Nova Transação
          </button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-4 bg-surface p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-4 border-b border-border pb-4">
          <div className="flex bg-bg p-1 rounded-xl border border-border">
            {(['TODAY', 'MONTH', 'YEAR', 'CUSTOM'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                  filterType === type 
                    ? "bg-accent text-bg shadow-sm" 
                    : "text-text-secondary hover:text-text-primary"
                )}
              >
                {type === 'TODAY' ? 'Hoje' : type === 'MONTH' ? 'Mês' : type === 'YEAR' ? 'Ano' : 'Personalizado'}
              </button>
            ))}
          </div>

          <div className="flex-1 flex items-center gap-2">
            {filterType === 'MONTH' && (
              <input 
                type="month" 
                value={format(filterDate, 'yyyy-MM')}
                onChange={(e) => setFilterDate(new Date(e.target.value + '-02'))}
                className="bg-bg border border-border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent"
              />
            )}
            
            {filterType === 'YEAR' && (
              <select 
                value={filterYear}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                className="bg-bg border border-border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent"
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}

            {filterType === 'CUSTOM' && (
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="bg-bg border border-border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent"
                />
                <span className="text-text-secondary">até</span>
                <input 
                  type="date" 
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="bg-bg border border-border rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-accent"
                />
              </div>
            )}
            
            {filterType === 'TODAY' && (
              <div className="text-sm font-bold text-accent px-4 py-2 bg-accent/5 rounded-xl border border-accent/10">
                {format(new Date(), 'dd/MM/yyyy')}
              </div>
            )}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <input 
              type="text" 
              placeholder="Buscar pela descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
            <select 
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="all">Todas as Contas</option>
              {accounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            {(['ALL', 'PAID', 'PENDING'] as const).map((status) => (
              <button
                key={status}
                onClick={() => updateStatusFilter(status)}
                className={cn(
                  "py-2 px-6 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-wider",
                  filterStatus === status 
                    ? "bg-accent/10 border-accent/20 text-accent shadow-sm" 
                    : "bg-bg border-border text-text-secondary hover:border-text-secondary/50"
                )}
              >
                {status === 'ALL' ? 'Todos' : status === 'PAID' ? 'Pago' : 'Pendente'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg/50 border-b border-border">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Data</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Descrição</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Categoria</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary text-right">Valor</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-text-secondary"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      Carregando transações...
                    </div>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">
                    <div className="flex flex-col items-center gap-3">
                      <div className="p-4 bg-bg rounded-full text-accent/50">
                        <ArrowLeftRight size={32} />
                      </div>
                      <p>Nenhuma transação registrada nesta empresa.</p>
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="text-xs font-bold text-accent hover:underline"
                      >
                        Começar agora
                      </button>
                    </div>
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-text-secondary italic">
                    Nenhum lançamento corresponde à sua busca ou filtro.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium">{formatDate(tx.dateCompetence)}</span>
                        <span className="text-[10px] text-text-secondary uppercase">Competência</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="font-medium text-text-primary">{tx.description}</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className="px-2 py-1 rounded-md bg-bg border border-border text-[11px] font-bold text-text-secondary">
                        {categories.find(c => c.id === tx.categoryId)?.name || 'Sem Categoria'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap">
                      <div className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase w-fit",
                        tx.status === 'PAID' 
                          ? "bg-success/10 text-success border border-success/20" 
                          : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                      )}>
                        {tx.status === 'PAID' ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                        {tx.status === 'PAID' ? 'Pago' : 'Pendente'}
                      </div>
                    </td>
                    <td className={cn(
                      "px-6 py-4 text-sm font-bold text-right whitespace-nowrap",
                      tx.type === 'REVENUE' ? "text-success" : "text-danger"
                    )}>
                      {tx.type === 'REVENUE' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleToggleStatus(tx)}
                          className={cn(
                            "p-2 rounded-lg transition-all",
                            tx.status === 'PAID' 
                              ? "text-success bg-success/10" 
                              : "text-text-secondary hover:text-text-primary hover:bg-bg"
                          )}
                          title={tx.status === 'PAID' ? "Marcar como Pendente" : "Marcar como Pago"}
                        >
                          <CheckCircle2 size={18} />
                        </button>
                        <button className="p-2 hover:bg-bg rounded-lg text-text-secondary transition-colors">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isModalOpen && (
        <TransactionModal 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            setIsModalOpen(false);
            loadData();
          }}
          categories={categories}
          bankAccounts={accounts}
          creditCards={creditCards}
          costCenters={costCenters}
          contacts={contacts}
          paymentMethods={paymentMethods}
          companyId={companyId}
        />
      )}

      {isTransferModalOpen && (
        <TransferModal
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            loadData();
          }}
          bankAccounts={accounts}
          companyId={companyId}
        />
      )}

      {isImportModalOpen && (
        <ImportModal 
          bankAccounts={accounts}
          categories={categories}
          companyId={companyId}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={() => {
            setIsImportModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function ImportModal({ bankAccounts, categories, companyId, onClose, onSuccess }: any) {
  const [step, setStep] = useState<'UPLOAD' | 'MAPPING' | 'REVIEW' | 'PROCESSING'>('UPLOAD');
  const [selectedBankId, setSelectedBankId] = useState(bankAccounts[0]?.id || '');
  const [fileData, setFileData] = useState<{ headers: string[], rows: any[] } | null>(null);
  const [mapping, setMapping] = useState<any>({ data: '', descricao: '', valor: '', categoria: '' });
  const [parsedTransactions, setParsedTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiSuggesting, setAiSuggesting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      if (data.length > 0) {
        const headers = data[0].map(h => String(h));
        const rows = data.slice(1).map(row => {
          const obj: any = {};
          headers.forEach((h, i) => {
            obj[h] = row[i];
          });
          return obj;
        });
        setFileData({ headers, rows });
        setStep('MAPPING');
        suggestMapping(headers, rows.slice(0, 5));
      }
    };
    reader.readAsBinaryString(file);
  };

  const suggestMapping = async (headers: string[], sampleRows: any[]) => {
    setAiSuggesting(true);
    const suggestion = await aiService.sugerirMapeamentoColunas(headers, sampleRows);
    if (suggestion) {
      setMapping(suggestion);
    }
    setAiSuggesting(false);
  };

  const handleApplyMapping = () => {
    if (!fileData || !mapping.data || !mapping.descricao || !mapping.valor) return;

    const transactions = fileData.rows.map((row, index) => {
      const rawDate = row[mapping.data];
      let date: Date;
      
      if (typeof rawDate === 'number') {
        // Excel date
        date = new Date((rawDate - (25567 + 1)) * 86400 * 1000);
      } else {
        // Try to parse string date
        try {
          date = new Date(rawDate);
          if (isNaN(date.getTime())) {
            // Try common formats like DD/MM/YYYY
            const parts = String(rawDate).split(/[/-]/);
            if (parts.length === 3) {
              if (parts[2].length === 4) {
                date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
              } else {
                date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
              }
            }
          }
        } catch {
          date = new Date();
        }
      }

      const amount = Math.abs(Number(String(row[mapping.valor]).replace(/[^\d,.-]/g, '').replace(',', '.')));
      const type = Number(String(row[mapping.valor]).replace(/[^\d,.-]/g, '').replace(',', '.')) >= 0 ? 'REVENUE' : 'EXPENSE';

      return {
        id: `temp-${index}`,
        description: String(row[mapping.descricao]),
        amount,
        type,
        dateCompetence: date,
        categoryId: mapping.categoria ? (categories.find((c: any) => c.name === row[mapping.categoria])?.id || '') : '',
        status: 'PAID',
        selected: true
      };
    });

    setParsedTransactions(transactions);
    setStep('REVIEW');
    suggestCategories(transactions);
  };

  const suggestCategories = async (txs: any[]) => {
    setAiSuggesting(true);
    const suggestions = await aiService.sugerirCategorias(
      txs.map(t => ({ descricao: t.description })),
      categories
    );
    if (suggestions && suggestions.length === txs.length) {
      setParsedTransactions(prev => prev.map((t, i) => ({
        ...t,
        categoryId: t.categoryId || suggestions[i]
      })));
    }
    setAiSuggesting(false);
  };

  const handleImport = async () => {
    setLoading(true);
    setStep('PROCESSING');
    try {
      const toImport = parsedTransactions
        .filter(t => t.selected)
        .map(({ selected, id, ...rest }) => rest);
      
      await financeService.importarTransacoes(companyId, selectedBankId, toImport);
      onSuccess();
    } catch (error) {
      console.error(error);
      setStep('REVIEW');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-4xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-xl text-accent">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Importar Extrato</h2>
              <p className="text-xs text-text-secondary uppercase tracking-wider">
                {step === 'UPLOAD' && 'Passo 1: Upload do Arquivo'}
                {step === 'MAPPING' && 'Passo 2: Mapeamento de Colunas'}
                {step === 'REVIEW' && 'Passo 3: Revisão e Edição'}
                {step === 'PROCESSING' && 'Processando...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 'UPLOAD' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Vincular à Conta Bancária</label>
                <select 
                  value={selectedBankId}
                  onChange={e => setSelectedBankId(e.target.value)}
                  className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
                >
                  {bankAccounts.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} ({formatCurrency(b.currentBalance)})</option>
                  ))}
                </select>
              </div>

              <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-3xl cursor-pointer hover:bg-white/5 hover:border-accent/50 transition-all group">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <div className="p-4 bg-accent/5 rounded-full mb-4 group-hover:scale-110 transition-transform">
                    <Upload className="text-accent" size={32} />
                  </div>
                  <p className="mb-2 text-sm font-bold">Clique para selecionar ou arraste o arquivo</p>
                  <p className="text-xs text-text-secondary">CSV ou XLSX (Excel)</p>
                </div>
                <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {step === 'MAPPING' && fileData && (
            <div className="space-y-6">
              <div className="bg-accent/5 border border-accent/20 rounded-2xl p-4 flex items-start gap-3">
                <Sparkles className="text-accent shrink-0" size={20} />
                <div className="text-sm">
                  <span className="font-bold text-accent">Dica da IA:</span> Verificamos sua planilha e sugerimos o mapeamento abaixo. Por favor, confirme se está correto.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <MappingField 
                    label="Data de Pagamento/Competência" 
                    value={mapping.data} 
                    onChange={(v) => setMapping({...mapping, data: v})} 
                    options={fileData.headers} 
                  />
                  <MappingField 
                    label="Descrição / Histórico" 
                    value={mapping.descricao} 
                    onChange={(v) => setMapping({...mapping, descricao: v})} 
                    options={fileData.headers} 
                  />
                  <MappingField 
                    label="Valor" 
                    value={mapping.valor} 
                    onChange={(v) => setMapping({...mapping, valor: v})} 
                    options={fileData.headers} 
                  />
                  <MappingField 
                    label="Categoria (Opcional)" 
                    value={mapping.categoria} 
                    onChange={(v) => setMapping({...mapping, categoria: v})} 
                    options={fileData.headers} 
                    optional
                  />
                </div>

                <div className="bg-bg/50 border border-border rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase text-text-secondary mb-4">Pré-visualização (Primeiras 3 linhas)</h4>
                  <div className="space-y-3">
                    {fileData.rows.slice(0, 3).map((row, i) => (
                      <div key={i} className="text-[10px] font-mono p-2 bg-surface rounded border border-border overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(row)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setStep('UPLOAD')}
                  className="px-6 py-3 border border-border rounded-2xl text-sm font-bold text-text-secondary hover:bg-white/5 transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleApplyMapping}
                  disabled={!mapping.data || !mapping.descricao || !mapping.valor}
                  className="px-8 py-3 bg-accent text-bg rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                  Continuar para Revisão
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-text-secondary">
                  <span className="font-bold text-text-primary">{parsedTransactions.filter(t => t.selected).length}</span> de <span className="font-bold text-text-primary">{parsedTransactions.length}</span> transações selecionadas
                </div>
                {aiSuggesting && (
                  <div className="flex items-center gap-2 text-xs text-accent animate-pulse">
                    <Sparkles size={14} />
                    IA sugerindo categorias...
                  </div>
                )}
              </div>

              <div className="border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-surface z-10 border-b border-border">
                      <tr className="text-[10px] font-bold uppercase text-text-secondary">
                        <th className="px-4 py-3 w-10">
                          <input 
                            type="checkbox" 
                            checked={parsedTransactions.every(t => t.selected)}
                            onChange={(e) => setParsedTransactions(prev => prev.map(t => ({ ...t, selected: e.target.checked })))}
                            className="rounded border-border text-accent focus:ring-accent bg-bg"
                          />
                        </th>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {parsedTransactions.map((tx, idx) => (
                        <tr key={tx.id} className={cn("hover:bg-white/5 transition-colors", !tx.selected && "opacity-50")}>
                          <td className="px-4 py-3">
                            <input 
                              type="checkbox" 
                              checked={tx.selected}
                              onChange={(e) => setParsedTransactions(prev => prev.map((t, i) => i === idx ? { ...t, selected: e.target.checked } : t))}
                              className="rounded border-border text-accent focus:ring-accent bg-bg"
                            />
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap">
                            {tx.dateCompetence.toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            <input 
                              type="text" 
                              value={tx.description}
                              onChange={(e) => setParsedTransactions(prev => prev.map((t, i) => i === idx ? { ...t, description: e.target.value } : t))}
                              className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 font-medium text-text-primary"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <select 
                              value={tx.categoryId}
                              onChange={(e) => setParsedTransactions(prev => prev.map((t, i) => i === idx ? { ...t, categoryId: e.target.value } : t))}
                              className="bg-bg border border-border rounded-lg px-2 py-1 text-[10px] focus:border-accent outline-none w-full"
                            >
                              <option value="">Selecionar...</option>
                              {categories.map((c: any) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <select 
                              value={tx.type}
                              onChange={(e) => setParsedTransactions(prev => prev.map((t, i) => i === idx ? { ...t, type: e.target.value } : t))}
                              className={cn(
                                "bg-bg border border-border rounded-lg px-2 py-1 text-[10px] focus:border-accent outline-none font-bold",
                                tx.type === 'REVENUE' ? "text-success" : "text-danger"
                              )}
                            >
                              <option value="REVENUE">RECEITA</option>
                              <option value="EXPENSE">DESPESA</option>
                            </select>
                          </td>
                          <td className={cn("px-4 py-3 text-xs font-bold text-right", tx.type === 'REVENUE' ? "text-success" : "text-danger")}>
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  onClick={() => setStep('MAPPING')}
                  className="px-6 py-3 border border-border rounded-2xl text-sm font-bold text-text-secondary hover:bg-white/5 transition-all"
                >
                  Voltar
                </button>
                <button 
                  onClick={handleImport}
                  disabled={loading || parsedTransactions.filter(t => t.selected).length === 0}
                  className="px-8 py-3 bg-accent text-bg rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="animate-spin" size={18} /> : (
                    <>
                      <Check size={18} />
                      Confirmar Importação
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {step === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-xl font-bold">Processando Importação</h3>
                <p className="text-text-secondary text-sm">Estamos salvando suas transações e atualizando os saldos...</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function MappingField({ label, value, onChange, options, optional }: any) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-text-secondary uppercase ml-1">
        {label} {optional && <span className="lowercase font-normal">(opcional)</span>}
      </label>
      <select 
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none"
      >
        <option value="">Selecionar coluna...</option>
        {options.map((o: string) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function TransactionModal({ onClose, onSuccess, categories: initialCategories, bankAccounts: initialBanks, creditCards, costCenters, contacts, paymentMethods, companyId }: any) {
  const { user } = useAuth();
  const [categories, setCategories] = useState(initialCategories || []);
  const [bankAccounts, setBankAccounts] = useState(initialBanks || []);
  
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category_id: '',
    cost_center_id: '',
    contact_id: '',
    payment_method_id: '',
    credit_card_id: '',
    type: 'EXPENSE' as 'REVENUE' | 'EXPENSE',
    dateCompetence: format(new Date(), 'yyyy-MM-dd'),
    datePayment: '',
    status: 'PENDING' as TransactionStatus,
    bank_account_id: initialBanks[0]?.id || ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('Categorias no Modal:', categories);
    console.log('Bancos no Modal:', bankAccounts);
  }, [categories, bankAccounts]);

  useEffect(() => {
    const refreshModalData = async () => {
      if (categories.length === 0 || bankAccounts.length === 0) {
        console.log('Modal: Listas vazias detectadas. Forçando recarregamento...');
        try {
          const [cats, banks] = await Promise.all([
            financeService.buscarPlanoDeContas(companyId),
            financeService.buscarContasBancarias(companyId)
          ]);
          setCategories(cats || []);
          setBankAccounts(banks || []);
          if (banks && banks.length > 0 && !formData.bank_account_id) {
            setFormData(prev => ({ ...prev, bank_account_id: banks[0].id }));
          }
        } catch (error) {
          console.error('Erro ao recarregar dados do modal:', error);
        }
      }
    };
    refreshModalData();
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await financeService.adicionarTransacao(companyId, {
        description: formData.description,
        amount: Number(formData.amount),
        categoryId: formData.category_id,
        bankAccountId: formData.bank_account_id,
        type: formData.type,
        status: formData.status,
        dateCompetence: new Date(formData.dateCompetence + 'T12:00:00'),
        datePayment: formData.datePayment ? new Date(formData.datePayment + 'T12:00:00') : undefined,
        costCenterId: formData.cost_center_id || undefined,
        contactId: formData.contact_id || undefined,
        paymentMethodId: formData.payment_method_id || undefined,
        creditCardId: formData.credit_card_id || undefined,
        companyId,
        isRecurring: false,
        userId: user?.id
      });
      onSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <h2 className="text-xl font-bold">Nova Transação</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'REVENUE' })}
              className={cn(
                "py-3 rounded-2xl font-bold text-sm border transition-all",
                formData.type === 'REVENUE' 
                  ? "bg-success/10 border-success/30 text-success" 
                  : "bg-bg border-border text-text-secondary"
              )}
            >
              Receita
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
              className={cn(
                "py-3 rounded-2xl font-bold text-sm border transition-all",
                formData.type === 'EXPENSE' 
                  ? "bg-danger/10 border-danger/30 text-danger" 
                  : "bg-bg border-border text-text-secondary"
              )}
            >
              Despesa
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase ml-1">Descrição</label>
            <input 
              required
              type="text" 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Aluguel, Venda Cliente X..."
              className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Valor</label>
              <input 
                required
                type="number" 
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Categoria</label>
              <select 
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Selecionar...</option>
                {categories.filter((c: any) => c.type === formData.type).map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Data Competência</label>
              <input 
                required
                type="date" 
                value={formData.dateCompetence}
                onChange={(e) => setFormData({ ...formData, dateCompetence: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="PENDING">Pendente</option>
                <option value="PAID">Pago</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Conta Bancária</label>
              <select 
                required
                value={formData.bank_account_id}
                onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Selecione...</option>
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Forma de Pagamento</label>
              <select 
                value={formData.paymentMethodId}
                onChange={(e) => setFormData({ ...formData, paymentMethodId: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Opcional...</option>
                {paymentMethods.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Pagar com Cartão de Crédito?</label>
              <select 
                value={formData.creditCardId}
                onChange={(e) => {
                  const cardId = e.target.value;
                  const card = creditCards.find((c: any) => c.id === cardId);
                  setFormData({ 
                    ...formData, 
                    creditCardId: cardId,
                    bankAccountId: card ? card.bankAccountId : (bankAccounts[0]?.id || '')
                  });
                }}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Não (Usar Conta Corrente)</option>
                {creditCards.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Centro de Custo</label>
              <select 
                value={formData.costCenterId}
                onChange={(e) => setFormData({ ...formData, costCenterId: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Opcional...</option>
                {costCenters.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Contato (Cliente/Fornecedor)</label>
              <select 
                value={formData.contactId}
                onChange={(e) => setFormData({ ...formData, contactId: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                <option value="">Opcional...</option>
                {contacts.filter((c: any) => formData.type === 'REVENUE' ? c.type === 'CLIENT' : c.type === 'SUPPLIER').map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {formData.status === 'PAID' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Data Pagamento</label>
              <input 
                required
                type="date" 
                value={formData.datePayment}
                onChange={(e) => setFormData({ ...formData, datePayment: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          )}

          <div className="pt-4">
            <button 
              disabled={loading}
              className="w-full bg-accent hover:opacity-90 text-bg py-4 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Confirmar Lançamento'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function TransferModal({ onClose, onSuccess, bankAccounts, companyId }: any) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.fromAccountId === formData.toAccountId) {
      alert('As contas de origem e destino devem ser diferentes.');
      return;
    }
    setLoading(true);
    try {
      await financeService.realizarTransferencia(companyId, {
        ...formData,
        amount: Number(formData.amount),
        date: new Date(formData.date + 'T12:00:00'),
        userId: user?.id
      });
      onSuccess();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <h2 className="text-xl font-bold">Nova Transferência</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Origem</label>
              <select 
                required
                value={formData.fromAccountId}
                onChange={e => setFormData({...formData, fromAccountId: e.target.value})}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
              >
                <option value="">Selecione...</option>
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Destino</label>
              <select 
                required
                value={formData.toAccountId}
                onChange={e => setFormData({...formData, toAccountId: e.target.value})}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
              >
                <option value="">Selecione...</option>
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Valor</label>
              <input 
                required
                type="number" 
                step="0.01"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Data</label>
              <input 
                required
                type="date" 
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase ml-1">Descrição (Opcional)</label>
            <input 
              type="text" 
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-bg border border-border rounded-2xl px-4 py-3 text-sm focus:border-accent outline-none"
              placeholder="Ex: Transferência entre contas"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-border rounded-2xl text-sm font-bold text-text-secondary hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 bg-accent text-bg rounded-2xl text-sm font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="animate-spin" size={18} /> : 'Transferir'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
