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
  Wallet,
  Edit2,
  Trash2
} from 'lucide-react';
import { financeService } from '../financeService';
import { aiService } from '../aiService';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { Transaction, ChartOfAccount, TransactionStatus } from '../types';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { format, startOfMonth, endOfMonth, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFilter } from '../contexts/FilterContext';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import { LoginPage } from './Login';
import { supabase } from '../supabase';

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedBankId, setSelectedBankId } = useFilter();
  const { 
    companyId, 
    bankAccounts: accounts, 
    categories, 
    paymentMethods, 
    costCenters, 
    contacts, 
    creditCards,
    refreshData: refreshCompanyData 
  } = useCompany();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  
  const initialStatus = (searchParams.get('status') as TransactionStatus | 'ALL') || 'ALL';
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'ALL'>(initialStatus);
  const [movementType, setMovementType] = useState<'ALL' | 'REVENUE' | 'EXPENSE'>('ALL');
  
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
  
  const handleEdit = (tx: Transaction, mode: 'view' | 'edit' = 'view') => {
    setEditingTransaction(tx);
    setModalMode(mode);
    setTimeout(() => {
      setIsModalOpen(true);
    }, 50);
    setActiveMenu(null);
  };

  const handleDelete = async (tx: Transaction) => {
    if (!confirm('Tem certeza que deseja excluir este lançamento? Esta ação irá estornar o saldo se a transação estiver paga.')) return;
    try {
      if (!companyId) return;
      await financeService.excluirTransacao(companyId as string, tx.id);
      loadData();
      refreshCompanyData();
      setActiveMenu(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir transação.');
    }
  };

  const handleToggleStatus = async (tx: Transaction) => {
    try {
      const newStatus = tx.status === 'PAID' ? 'PENDING' : 'PAID';
      await financeService.quitarTransacao(companyId, tx.id, newStatus);
      loadData();
      refreshCompanyData();
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

      const txs = await financeService.buscarTransacoes(companyId, { 
        startDate: start, 
        endDate: end,
        bankAccountId: selectedBankId,
        status: filterStatus
      });
      
      console.log('Transações carregadas:', txs.length);
      setTransactions(txs || []);

      // Se os dados globais ainda não foram carregados no contexto, solicitar carga
      if (accounts.length === 0 || categories.length === 0) {
        console.log('[Transactions] Contexto sem dados (contas/categorias), atualizando...');
        refreshCompanyData();
      }
    } catch (error) {
      console.error('Erro ao carregar transações:', error);
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
  }, [filterType, filterDate, filterYear, customStartDate, customEndDate, user, authLoading, selectedBankId, companyId, filterStatus]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = movementType === 'ALL' || t.type === movementType;
    return matchesSearch && matchesType;
  });

  // Group transactions by day
  const groupedTransactions = filteredTransactions.reduce((groups: { [key: string]: Transaction[] }, tx) => {
    const dateKey = format(tx.dateCompetence, 'yyyy-MM-dd');
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(tx);
    return groups;
  }, {});

  const sortedDateKeys = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const sortedFilteredTransactions = [...filteredTransactions].sort((a, b) => {
    const dateA = new Date(a.dateCompetence).getTime();
    const dateB = new Date(b.dateCompetence).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.id.localeCompare(b.id);
  });

  const transactionsWithBalance = React.useMemo(() => {
    const balances: { [accountId: string]: number } = {};
    
    // Initialize starting balance for each account using the current balance from context
    // This is a bit approximate if not all transactions are loaded, but provides the "running" feel.
    accounts.forEach(acc => {
      // Find historical sum of loaded transactions to calculate the "starting" point for this view
      const accountTxs = sortedFilteredTransactions.filter(t => t.bankAccountId === acc.id);
      const periodImpact = accountTxs.reduce((sum, t) => {
        if (t.status !== 'PAID') return sum;
        const amount = Number(t.amount || 0);
        return sum + (t.type === 'REVENUE' ? amount : -amount);
      }, 0);
      
      balances[acc.id] = Number(acc.currentBalance || 0) - periodImpact;
    });

    return sortedFilteredTransactions.map(tx => {
      if (tx.status === 'PAID') {
        const amount = Number(tx.amount || 0);
        balances[tx.bankAccountId] += (tx.type === 'REVENUE' ? amount : -amount);
      }
      return { ...tx, currentBalance: balances[tx.bankAccountId] };
    }).reverse(); // Most recent first for display
  }, [sortedFilteredTransactions, accounts]);

  // Sidebar Summary Logic
  const periodStats = transactions.reduce((acc, tx) => {
    const isPaid = tx.status === 'PAID';
    const amount = Number(tx.amount);
    
    if (tx.type === 'REVENUE') {
      acc.entradasProjetadas += amount;
      if (isPaid) acc.entradasConfirmadas += amount;
    } else {
      acc.saidasProjetadas += amount;
      if (isPaid) acc.saidasConfirmadas += amount;
    }
    
    return acc;
  }, {
    entradasConfirmadas: 0,
    entradasProjetadas: 0,
    saidasConfirmadas: 0,
    saidasProjetadas: 0
  });

  const accountStats = accounts.map(acc => {
    const periodTxs = transactions.filter(t => t.bankAccountId === acc.id);
    const confirmed = periodTxs.filter(t => t.status === 'PAID').reduce((sum, t) => sum + (t.type === 'REVENUE' ? t.amount : -t.amount), 0);
    const projected = periodTxs.reduce((sum, t) => sum + (t.type === 'REVENUE' ? t.amount : -t.amount), 0);
    return {
      ...acc,
      confirmed,
      projected
    };
  });

  return (
    <div className="flex h-[calc(100vh-120px)] gap-6 overflow-hidden">
      {/* Sidebar - Summary & Date Filters */}
      <aside className="w-80 flex flex-col gap-6 overflow-y-auto no-scrollbar">
        {/* Date Selector Card */}
        <div className="bg-surface rounded-3xl border border-border shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between bg-bg/30">
            <button 
              onClick={() => {
                const d = new Date(filterDate);
                d.setMonth(d.getMonth() - 1);
                setFilterDate(d);
                setFilterType('MONTH');
              }}
              className="p-1.5 hover:bg-bg rounded-lg text-text-secondary"
            >
              <ChevronRight className="rotate-180" size={18} />
            </button>
            <div className="text-xs font-bold uppercase tracking-widest text-text-primary">
              {format(filterDate, 'MMM yyyy')}
            </div>
            <button 
              onClick={() => {
                const d = new Date(filterDate);
                d.setMonth(d.getMonth() + 1);
                setFilterDate(d);
                setFilterType('MONTH');
              }}
              className="p-1.5 hover:bg-bg rounded-lg text-text-secondary"
            >
              <ChevronRight size={18} />
            </button>
            <div className="flex items-center gap-1 border-l border-border pl-2 ml-2">
              <Calendar size={14} className="text-text-secondary" />
              <button className="p-1.5 hover:bg-bg rounded-lg text-text-secondary">
                <Filter size={14} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {/* Accounts Mini List */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-border text-accent" checked readOnly />
                </div>
                <div className="flex gap-4">
                  <span className="text-[9px] font-bold uppercase text-text-secondary tracking-tighter">Saldo Atual</span>
                  <span className="text-[9px] font-bold uppercase text-text-secondary tracking-tighter">Proj. Período</span>
                </div>
              </div>
              
              <div className="space-y-1">
                {accountStats.map(acc => (
                  <div key={acc.id} className="flex justify-between items-center py-1 hover:bg-bg/50 rounded-lg px-1 transition-colors">
                    <div className="flex items-center gap-2 max-w-[100px]">
                      <input type="checkbox" className="rounded border-border text-accent" checked={selectedBankId === 'all' || selectedBankId === acc.id} onChange={() => setSelectedBankId(acc.id === selectedBankId ? 'all' : acc.id)} />
                      <span className="text-[11px] font-medium truncate text-text-primary">{acc.name}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className={cn("text-[10px] font-mono", acc.currentBalance >= 0 ? "text-text-primary/70" : "text-danger")}>
                        {acc.currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className={cn("text-[10px] font-mono", acc.projected >= 0 ? "text-success" : "text-danger")}>
                        {acc.projected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between pt-2 border-t border-border mt-1">
                  <span className="text-[10px] font-bold uppercase text-text-primary">Total</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] font-mono font-bold text-text-primary/70">
                      {accountStats.reduce((sum, a) => sum + (a.currentBalance || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-success">
                      {accountStats.reduce((sum, a) => sum + a.projected, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Results Summary */}
            <div className="pt-4 border-t border-border space-y-4">
              <h4 className="text-[9px] font-bold text-text-secondary uppercase tracking-widest text-center">Resultados (R$)</h4>
              
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-text-secondary">Entradas</span>
                  <span className="text-success font-bold">{periodStats.entradasConfirmadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pl-3 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-secondary">Receitas</span>
                    <span className="text-success">{periodStats.entradasConfirmadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-secondary">Transferências</span>
                    <span className="text-success">0,00</span>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] pt-1">
                  <span className="text-text-secondary">Saídas</span>
                  <span className="text-danger font-bold">-{periodStats.saidasConfirmadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="pl-3 space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-secondary">Despesas</span>
                    <span className="text-danger">-{periodStats.saidasConfirmadas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span className="text-text-secondary">Transferências</span>
                    <span className="text-danger">0,00</span>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] font-bold border-t border-border pt-2">
                  <span className="text-text-primary uppercase tracking-tighter">Resultado</span>
                  <span className={cn(periodStats.entradasConfirmadas - periodStats.saidasConfirmadas >= 0 ? "text-success" : "text-danger")}>
                    {(periodStats.entradasConfirmadas - periodStats.saidasConfirmadas).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Insight Placeholder */}
        <div className="bg-accent/5 rounded-3xl border border-accent/10 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Insights da IA</span>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed italic">
            "Sua despesa com transportes subiu 15% este mês. Considere renegociar contratos ou otimizar rotas."
          </p>
        </div>
      </aside>

      {/* Main Content Areas */}
      <main className="flex-1 flex flex-col gap-6 min-w-0 h-full overflow-hidden">
        {/* Top bar with filters and actions */}
        <div className="bg-surface rounded-2xl border border-border px-4 py-3 flex flex-col gap-4 shadow-sm shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Tipo</span>
              <div className="flex gap-2">
                {[
                  { id: 'ALL', label: 'Ambos' },
                  { id: 'REVENUE', label: 'Apenas Entradas' },
                  { id: 'EXPENSE', label: 'Apenas Saídas' }
                ].map(t => (
                  <button 
                    key={t.id}
                    onClick={() => setMovementType(t.id as any)}
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all border",
                      movementType === t.id 
                        ? "bg-accent text-bg border-accent shadow-lg shadow-accent/20" 
                        : "bg-bg text-text-secondary border-border hover:border-accent/40"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                <input 
                  type="text" 
                  placeholder="Pesquisar..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-bg border border-border rounded-xl text-xs font-medium focus:outline-none focus:border-accent w-48"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center gap-6">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Status</span>
              <div className="flex gap-3">
                {[
                  { id: 'PENDING', label: 'Pendentes', color: 'bg-amber-400' },
                  { id: 'SCHEDULED', label: 'Agendados', color: 'bg-blue-400' },
                  { id: 'PAID', label: 'Confirmados', color: 'bg-success' },
                  { id: 'CONCILIATED', label: 'Conciliados', color: 'bg-accent' }
                ].map(f => (
                  <button 
                    key={f.id}
                    onClick={() => updateStatusFilter(f.id === filterStatus ? 'ALL' : f.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase hover:bg-bg transition-colors border border-transparent",
                      filterStatus === f.id && "bg-bg border-border"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", f.color)} />
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1 bg-bg p-1 rounded-xl border border-border">
              <button onClick={() => {
                setEditingTransaction(null);
                setModalMode('edit');
                setTimeout(() => setIsModalOpen(true), 50);
              }} className="p-2 hover:bg-white/5 rounded-lg text-text-secondary" title="Nova Transação">
                <Plus size={18} />
              </button>
              <button 
                onClick={exportToCSV}
                className="p-2 hover:bg-white/5 rounded-lg text-text-secondary" title="Exportar CSV"
              >
                <Download size={18} />
              </button>
              <button className="p-2 hover:bg-white/5 rounded-lg text-text-secondary">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Transaction Grouped List */}
        <div className="bg-surface rounded-2xl border border-border shadow-xl flex-1 overflow-y-auto no-scrollbar relative min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/50 backdrop-blur-sm z-20">
              <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Carregando lançamentos...</p>
            </div>
          ) : transactionsWithBalance.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-bg rounded-full flex items-center justify-center text-text-secondary opacity-50">
                <FileSpreadsheet size={32} />
              </div>
              <p className="text-text-secondary italic">Nenhum lançamento encontrado para este período.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {transactionsWithBalance.map((tx) => (
                <div 
                  key={tx.id} 
                  className={cn(
                    "grid grid-cols-[30px,1fr] items-start px-4 py-3 hover:bg-white/5 transition-all group cursor-pointer border-l-4",
                    activeMenu === tx.id && "bg-white/5",
                    tx.status === 'PAID' ? "border-l-success" : "border-l-amber-400"
                  )}
                  onClick={() => handleEdit(tx, 'view')}
                >
                  {/* Status Indicator */}
                  <div className="flex justify-center pt-1">
                    <div className={cn("w-2 h-2 rounded-full", tx.status === 'PAID' ? "bg-success" : "border border-amber-400")} />
                  </div>

                  {/* Content Area (2 Lines) */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    {/* Line 1: Date + Title ... Amount + Menu */}
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[11px] text-text-secondary font-mono bg-bg px-1.5 py-0.5 rounded border border-border whitespace-nowrap">
                          {format(new Date(tx.dateCompetence), 'dd/MM/yy')}
                        </span>
                        <span className="text-[14px] font-bold text-text-primary truncate transition-colors group-hover:text-accent">
                          {tx.description}
                        </span>
                        {tx.isRecurring && <RefreshCw size={12} className="text-text-secondary opacity-30 shrink-0" />}
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className={cn("text-[14px] font-mono font-bold", tx.type === 'REVENUE' ? "text-success" : "text-danger")}>
                          {tx.type === 'REVENUE' ? '' : '-'} {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        
                        {/* Action Menu (3 dots) */}
                        <div className="relative">
                           <button 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setActiveMenu(activeMenu === tx.id ? null : tx.id); 
                            }}
                            className="p-1 hover:bg-white/10 rounded text-text-secondary transition-colors"
                           >
                            <MoreHorizontal size={14} />
                           </button>

                           {activeMenu === tx.id && (
                             <div className="absolute right-0 top-full mt-1 w-48 bg-surface border border-border rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in zoom-in duration-150">
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleEdit(tx, 'edit'); }}
                                 className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors text-left"
                               >
                                 <Edit2 size={16} className="text-accent" />
                                 <span className="font-medium text-text-primary">Editar Lançamento</span>
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleToggleStatus(tx); }}
                                 className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/5 transition-colors text-left border-t border-border/50"
                               >
                                 <CheckCircle2 size={16} className={tx.status === 'PAID' ? "text-success" : "text-text-secondary"} />
                                 <span className="font-medium text-text-primary">
                                   {tx.status === 'PAID' ? 'Marcar como Pendente' : (tx.type === 'REVENUE' ? 'Confirmar Recebimento' : 'Confirmar Pagamento')}
                                 </span>
                               </button>
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleDelete(tx); }}
                                 className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-danger/10 text-danger transition-colors text-left border-t border-border/50"
                               >
                                 <Trash2 size={16} />
                                 <span className="font-bold">Excluir</span>
                               </button>
                             </div>
                           )}
                        </div>
                      </div>
                    </div>

                    {/* Line 2: Labels ... Balance + Confirm */}
                    <div className="flex justify-between items-center gap-4">
                      {/* Detailed Labels */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded bg-bg border border-border text-[9px] font-black text-text-secondary uppercase tracking-tight">
                          {accounts.find(a => a.id === tx.bankAccountId)?.name || 'Outros'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-bg border border-border text-[9px] font-bold text-text-secondary uppercase">
                          {categories.find(c => c.id === tx.categoryId)?.name || 'Geral'}
                        </span>
                        {tx.costCenterId && costCenters.find(c => c.id === tx.costCenterId) && (
                          <span className="px-1.5 py-0.5 rounded bg-bg border border-border text-[9px] font-medium text-text-secondary italic">
                            {costCenters.find(c => c.id === tx.costCenterId)?.name}
                          </span>
                        )}
                        {tx.status === 'PAID' && <Check size={12} className="text-success/50 ml-1" />}
                      </div>

                      {/* Balance & Confirm Button */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[12px] text-success/70 leading-none font-mono font-bold">
                           {tx.currentBalance?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleStatus(tx);
                          }}
                          className={cn(
                            "p-1 rounded-md transition-all",
                            tx.status === 'PAID' 
                              ? "bg-success/20 text-success" 
                              : "bg-surface border border-border text-text-secondary hover:border-accent hover:text-accent"
                          )}
                          title={tx.status === 'PAID' ? "Desmarcar como pago" : "Confirmar pagamento"}
                        >
                          <Check size={14} className={cn(tx.status === 'PAID' ? "opacity-100" : "opacity-30")} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* FAB for Mobile or Quick Add */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-24 w-14 h-14 bg-success text-bg rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-40"
      >
        <Plus size={28} />
      </button>

      {/* Overlay to close menu when clicking outside */}
      {activeMenu && (
        <div className="fixed inset-0 z-[90]" onClick={() => setActiveMenu(null)} />
      )}
      {/* Modals */}
      {isModalOpen && (
        <TransactionModal 
          transaction={editingTransaction}
          initialMode={modalMode}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
          }} 
          onSuccess={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
            loadData();
            refreshCompanyData();
          }}
          companyId={companyId}
        />
      )}

      {isTransferModalOpen && (
        <TransferModal
          onClose={() => setIsTransferModalOpen(false)}
          onSuccess={() => {
            setIsTransferModalOpen(false);
            loadData();
            refreshCompanyData();
          }}
          bankAccounts={accounts}
          companyId={companyId}
        />
      )}

      {isImportModalOpen && (
        <ImportModal 
          onClose={() => setIsImportModalOpen(false)} 
          onSuccess={() => {
            setIsImportModalOpen(false);
            loadData();
            refreshCompanyData();
          }} 
        />
      )}
    </div>
  );
}

function ImportModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { 
    bankAccounts, 
    categories, 
    companyId 
  } = useCompany();
  
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

function TransactionModal({ onClose, onSuccess, companyId, transaction, initialMode = 'view' }: any) {
  const { user } = useAuth();
  const { 
    categories, 
    bankAccounts, 
    paymentMethods, 
    costCenters, 
    contacts, 
    creditCards, 
    refreshData 
  } = useCompany();
  
  const [formData, setFormData] = React.useState({
    description: transaction?.description || '',
    amount: transaction?.amount || '',
    category_id: transaction?.categoryId || '',
    cost_center_id: transaction?.costCenterId || '',
    contact_id: transaction?.contactId || '',
    payment_method_id: transaction?.paymentMethodId || '',
    credit_card_id: transaction?.creditCardId || '',
    type: (transaction?.type || 'EXPENSE') as 'REVENUE' | 'EXPENSE',
    dateCompetence: transaction?.dateCompetence ? format(transaction.dateCompetence, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    datePayment: transaction?.datePayment ? format(transaction.datePayment, 'yyyy-MM-dd') : '',
    status: (transaction?.status || 'PENDING') as TransactionStatus,
    bank_account_id: transaction?.bankAccountId || bankAccounts[0]?.id || '',
    installmentsTotal: transaction?.installmentsTotal || 1,
    recurrenceType: (transaction?.recurrenceType || 'SINGLE') as 'SINGLE' | 'FIXED' | 'VARIABLE',
    recurrenceFrequency: (transaction?.recurrenceFrequency || 'MONTHLY') as 'MONTHLY' | 'YEARLY',
    dueDay: transaction?.dueDay || (transaction?.dateCompetence ? new Date(transaction.dateCompetence).getDate() : new Date().getDate())
  });
  const [loading, setLoading] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(transaction ? (initialMode === 'edit') : true);
  const [isSubmittingLocked, setIsSubmittingLocked] = React.useState(false);
  const [isCreditCard, setIsCreditCard] = React.useState(!!transaction?.creditCardId);
  const [isRecurring, setIsRecurring] = React.useState(!!transaction?.recurrenceType && transaction?.recurrenceType !== 'SINGLE');
  const [isInstallment, setIsInstallment] = React.useState((transaction?.installmentsTotal || 1) > 1);

  React.useEffect(() => {
    if (isEditMode) {
      setIsSubmittingLocked(true);
      const timer = setTimeout(() => setIsSubmittingLocked(false), 400);
      return () => clearTimeout(timer);
    }
  }, [isEditMode]);

  React.useEffect(() => {
    console.log('TransactionModal mounted with context data:', { 
      categories_count: categories.length, 
      bankAccounts_count: bankAccounts.length, 
      paymentMethods_count: paymentMethods.length,
      costCenters_count: costCenters.length,
      companyId 
    });
    
    if (categories.length === 0 || bankAccounts.length === 0) {
      console.log('Modal: Contexto parece vazio, solicitando refreshData...');
      refreshData();
    }
  }, []); // Só no mount para não entrar em loop se o banco retornar vazio

  // Sincronizar banco inicial quando a lista carregar
  React.useEffect(() => {
    if (bankAccounts.length > 0 && !formData.bank_account_id) {
      console.log('Modal: Auto-selecionando primeira conta bancária:', bankAccounts[0].name);
      setFormData(prev => ({ ...prev, bank_account_id: bankAccounts[0].id }));
    }
  }, [bankAccounts, formData.bank_account_id]);

  // Sincronizar categoria inicial quando a lista carregar ou o tipo mudar
  React.useEffect(() => {
    const filteredCats = categories.filter((c: any) => c.type === formData.type);
    if (filteredCats.length > 0 && (!formData.category_id || !filteredCats.find(c => c.id === formData.category_id))) {
      console.log(`Modal: Auto-selecionando categoria para ${formData.type}:`, filteredCats[0].name);
      setFormData(prev => ({ ...prev, category_id: filteredCats[0].id }));
    } else if (filteredCats.length === 0) {
      setFormData(prev => ({ ...prev, category_id: '' }));
    }
  }, [categories, formData.type]);

  // Monitor payment method to toggle credit card mode
  React.useEffect(() => {
    const method = paymentMethods.find((p: any) => p.id === formData.payment_method_id);
    const isCC = method?.name?.toLowerCase().includes('cartão') || !!formData.credit_card_id;
    setIsCreditCard(isCC);
    if (!isCC) {
      setFormData(prev => ({ ...prev, credit_card_id: '' }));
    }
  }, [formData.payment_method_id, paymentMethods, formData.credit_card_id]);

  // Logic for due date calculation
  React.useEffect(() => {
    if (isCreditCard && formData.credit_card_id && formData.dateCompetence) {
      const card = creditCards.find((c: any) => c.id === formData.credit_card_id);
      if (card && card.closingDay && card.dueDay) {
        // Use a persistent hour to avoid timezone shifts during manual day extraction
        const competence = new Date(formData.dateCompetence + 'T12:00:00');
        const compDay = competence.getDate();
        let dueDate = new Date(competence);
        
        // If purchase day is after closing day, it goes to next month
        if (compDay > card.closingDay) {
          dueDate.setMonth(dueDate.getMonth() + 1);
        }
        
        dueDate.setDate(card.dueDay);
        
        // Update datePayment and set status to PENDING
        setFormData(prev => ({ 
          ...prev, 
          datePayment: format(dueDate, 'yyyy-MM-dd'),
          status: 'PENDING'
        }));
      }
    }
  }, [isCreditCard, formData.credit_card_id, formData.dateCompetence, creditCards]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (!formData.dateCompetence) {
        throw new Error('A data de competência é obrigatória.');
      }

      // Verificação básica da data para evitar RangeError: Invalid time value
      const parseDate = (dateStr: string) => {
        const d = new Date(dateStr + 'T12:00:00');
        if (isNaN(d.getTime())) return new Date();
        return d;
      };

      console.log('Enviando transação:', { ...formData, companyId });

      const transactionData = {
        description: formData.description,
        amount: Number(formData.amount),
        categoryId: formData.category_id,
        bankAccountId: formData.bank_account_id,
        type: formData.type,
        status: formData.status,
        dateCompetence: parseDate(formData.dateCompetence),
        datePayment: formData.datePayment ? parseDate(formData.datePayment) : undefined,
        costCenterId: formData.cost_center_id || undefined,
        contactId: formData.contact_id || undefined,
        paymentMethodId: formData.payment_method_id || undefined,
        creditCardId: formData.credit_card_id || undefined,
        installmentsTotal: (isInstallment || isRecurring) ? formData.installmentsTotal : 1,
        recurrenceType: formData.recurrenceType,
        recurrenceFrequency: formData.recurrenceFrequency,
        dueDay: formData.dueDay,
        companyId,
        isRecurring: isRecurring,
        userId: user?.id
      };

      if (transaction?.id) {
        await financeService.editarTransacao(companyId, transaction.id, transactionData);
      } else {
        await financeService.adicionarTransacao(companyId, transactionData);
      }

      console.log('Transação salva com sucesso!');
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar transação:', error);
      alert('Erro ao salvar transação: ' + (error.message || 'Verifique os dados e tente novamente.'));
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
          <h2 className="text-xl font-bold">
            {transaction ? (isEditMode ? 'Editar Lançamento' : 'Detalhes do Lançamento') : 'Nova Transação'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => setFormData({ ...formData, type: 'REVENUE' })}
              className={cn(
                "py-3 rounded-2xl font-bold text-sm border transition-all",
                formData.type === 'REVENUE' 
                  ? "bg-success/10 border-success/30 text-success" 
                  : "bg-bg border-border text-text-secondary",
                !isEditMode && "opacity-80"
              )}
            >
              Receita
            </button>
            <button
              type="button"
              disabled={!isEditMode}
              onClick={() => setFormData({ ...formData, type: 'EXPENSE' })}
              className={cn(
                "py-3 rounded-2xl font-bold text-sm border transition-all",
                formData.type === 'EXPENSE' 
                  ? "bg-danger/10 border-danger/30 text-danger" 
                  : "bg-bg border-border text-text-secondary",
                !isEditMode && "opacity-80"
              )}
            >
              Despesa
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase ml-1">Descrição</label>
            <input 
              required
              disabled={!isEditMode}
              type="text" 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Aluguel, Venda Cliente X..."
              className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-70"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase ml-1">Tipo de Lançamento</label>
            <div className="flex bg-bg p-1 rounded-2xl border border-border">
              {[
                { id: 'SINGLE', label: 'Único' },
                { id: 'FIXED', label: 'Recorrente Fixo' },
                { id: 'VARIABLE', label: 'Recorrente Variável' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  disabled={!isEditMode}
                  onClick={() => {
                    const rec = t.id !== 'SINGLE';
                    setIsRecurring(rec);
                    setFormData(prev => ({ ...prev, recurrenceType: t.id as any }));
                    if (!rec) setIsInstallment(false);
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    formData.recurrenceType === t.id ? "bg-accent text-bg shadow-sm" : "text-text-secondary"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {formData.recurrenceType === 'VARIABLE' && (
              <p className="text-[10px] text-accent mt-1 ml-1 animate-pulse">
                * O valor poderá ser editado em cada recorrência
              </p>
            )}
          </div>

          {isRecurring && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="grid grid-cols-3 gap-3 overflow-hidden"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Frequência</label>
                <select
                  disabled={!isEditMode}
                  value={formData.recurrenceFrequency}
                  onChange={(e) => setFormData({ ...formData, recurrenceFrequency: e.target.value as any })}
                  className="w-full bg-bg border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-accent appearance-none disabled:opacity-70"
                >
                  <option value="MONTHLY">Mensal</option>
                  <option value="YEARLY">Anual</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Dia Venc.</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  disabled={!isEditMode}
                  value={formData.dueDay}
                  onChange={(e) => setFormData({ ...formData, dueDay: Number(e.target.value) })}
                  className="w-full bg-bg border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-accent disabled:opacity-70"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Parcelas</label>
                <input
                  type="number"
                  min="1"
                  max="72"
                  disabled={!isEditMode}
                  value={formData.installmentsTotal}
                  onChange={(e) => setFormData({ ...formData, installmentsTotal: Number(e.target.value) })}
                  className="w-full bg-bg border border-border rounded-xl py-2 px-3 text-xs focus:outline-none focus:border-accent disabled:opacity-70"
                />
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Valor</label>
              <input 
                required
                disabled={!isEditMode}
                type="number" 
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0,00"
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-70"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Categoria</label>
              <select 
                required
                disabled={!isEditMode}
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
              >
                <option value="">Selecione...</option>
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
                disabled={!isEditMode}
                type="date" 
                value={formData.dateCompetence}
                onChange={(e) => setFormData({ ...formData, dateCompetence: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-70"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Fonte do Pagamento</label>
              <div className="flex bg-bg p-1 rounded-2xl border border-border">
                <button
                  type="button"
                  disabled={!isEditMode || formData.type === 'REVENUE'}
                  onClick={() => {
                    setIsCreditCard(false);
                    setFormData({ ...formData, credit_card_id: '' });
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    !isCreditCard ? "bg-accent text-bg shadow-sm" : "text-text-secondary"
                  )}
                >
                  Conta
                </button>
                <button
                  type="button"
                  disabled={!isEditMode || formData.type === 'REVENUE'}
                  onClick={() => {
                    setIsCreditCard(true);
                    // For credit card expenses, status is effectively PAID (confirmed in statement)
                    setFormData(prev => ({ ...prev, status: 'PAID' }));
                  }}
                  className={cn(
                    "flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all",
                    isCreditCard ? "bg-accent text-bg shadow-sm" : "text-text-secondary"
                  )}
                >
                  Cartão
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!isCreditCard ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Conta Bancária</label>
                <select 
                  required
                  disabled={!isEditMode}
                  value={formData.bank_account_id}
                  onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="">Selecione...</option>
                  {bankAccounts.map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Cartão de Crédito</label>
                <select 
                  required
                  disabled={!isEditMode}
                  value={formData.credit_card_id}
                  onChange={(e) => {
                    const cardId = e.target.value;
                    const card = creditCards.find((c: any) => c.id === cardId);
                    setFormData({ 
                      ...formData, 
                      credit_card_id: cardId,
                      bank_account_id: card ? card.bankAccountId : (formData.bank_account_id || bankAccounts[0]?.id || '')
                    });
                  }}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="">Selecione o cartão...</option>
                  {creditCards.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {!isCreditCard ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Status</label>
                <select 
                  disabled={!isEditMode}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as TransactionStatus })}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="PENDING">Pendente</option>
                  <option value="PAID">{formData.type === 'REVENUE' ? 'Recebido' : 'Pago'}</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5 opacity-60">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Status (Automático)</label>
                <div className="w-full bg-bg/50 border border-border rounded-2xl py-3 px-4 text-sm text-text-secondary font-medium">
                  Lançado na Fatura
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!isCreditCard ? (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Forma de Pagamento</label>
                <select 
                  disabled={!isEditMode}
                  value={formData.payment_method_id}
                  onChange={(e) => setFormData({ ...formData, payment_method_id: e.target.value })}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="">Opcional...</option>
                  {paymentMethods.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Centro de Custo</label>
                <select 
                  disabled={!isEditMode}
                  value={formData.cost_center_id}
                  onChange={(e) => setFormData({ ...formData, cost_center_id: e.target.value })}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="">Opcional...</option>
                  {costCenters.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            {!isCreditCard && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Centro de Custo</label>
                <select 
                  disabled={!isEditMode}
                  value={formData.cost_center_id}
                  onChange={(e) => setFormData({ ...formData, cost_center_id: e.target.value })}
                  className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
                >
                  <option value="">Opcional...</option>
                  {costCenters.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-secondary uppercase ml-1">Contato (Cliente/Fornecedor)</label>
            <select 
              disabled={!isEditMode}
              value={formData.contact_id}
              onChange={(e) => setFormData({ ...formData, contact_id: e.target.value })}
              className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none disabled:opacity-70"
            >
              <option value="">Opcional...</option>
              {contacts.filter((c: any) => formData.type === 'REVENUE' ? c.type === 'CLIENT' : c.type === 'SUPPLIER').map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {(formData.status === 'PAID' || isCreditCard) && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">
                {isCreditCard ? 'Previsão de Vencimento da Fatura' : 'Data Pagamento'}
              </label>
              <input 
                required
                disabled={!isEditMode}
                type="date" 
                value={formData.datePayment}
                onChange={(e) => setFormData({ ...formData, datePayment: e.target.value })}
                className="w-full bg-bg border border-border rounded-2xl py-3 px-4 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-70"
              />
            </div>
          )}

          <div className="pt-4 flex gap-3">
            {!isEditMode ? (
              <>
                <button 
                  key="view-close-btn"
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-4 border border-border rounded-2xl font-bold text-text-secondary hover:bg-white/5 transition-all"
                >
                  Fechar
                </button>
                <button 
                  key="view-edit-btn"
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="flex-1 bg-accent text-bg px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-accent/20"
                >
                  Editar
                </button>
              </>
            ) : (
              <>
                <button 
                  key="edit-cancel-btn"
                  type="button"
                  onClick={() => {
                    if (transaction) setIsEditMode(false);
                    else onClose();
                  }}
                  className="flex-1 px-6 py-4 border border-border rounded-2xl font-bold text-text-secondary hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  key="edit-save-btn"
                  type="submit"
                  disabled={loading || isSubmittingLocked}
                  className="flex-1 bg-accent hover:opacity-90 text-bg py-4 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </>
            )}
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
