import { useState, useEffect, useMemo } from 'react';
import { financeService } from '../financeService';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { 
  RefreshCw,
  Wallet,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  TrendingDown,
  TrendingUp,
  Landmark,
  FileText
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { LoginPage } from './Login';
import { motion, AnimatePresence } from 'motion/react';

export function ExtractTransactionsPage() {
  const { user, loading: authLoading } = useAuth();
  const { companyConfig } = useCompany();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [filterDate, setFilterDate] = useState(new Date());
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const companyId = 'm4-digital';

  const loadData = async () => {
    if (!user) return;
    try {
      const banks = await financeService.buscarContasBancarias(companyId);
      setBankAccounts(banks || []);
      if (banks?.length > 0 && !selectedBankId) {
        setSelectedBankId(banks[0].id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const loadTransactions = async () => {
    if (!user || !selectedBankId) return;
    setLoading(true);
    try {
      const month = filterDate.getMonth() + 1;
      const year = filterDate.getFullYear();
      const data = await financeService.buscarExtratoPorConta(companyId, selectedBankId, month, year);
      setTransactions(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (selectedBankId && filterDate) {
      loadTransactions();
    }
  }, [selectedBankId, filterDate]);

  const selectedBank = bankAccounts.find(b => b.id === selectedBankId);

  // Cálculo de saldo acumulado
  const transactionsWithBalance = useMemo(() => {
    let runningBalance = selectedBank?.initialBalance || 0;
    
    // Simplificando: vamos mostrar apenas os saldos das transações carregadas
    // No mundo real, precisaríamos do saldo base antes do início do período.
    return transactions.map(tx => {
      const change = tx.type === 'REVENUE' ? tx.amount : -tx.amount;
      runningBalance += change;
      return { ...tx, runningBalance };
    });
  }, [transactions, selectedBank]);

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin" /></div>;
  if (!user) return <LoginPage />;

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Extrato de Contas</h1>
          <p className="text-text-secondary text-sm">Conciliação bancária e saldo acumulado</p>
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors"
          >
            <Printer size={18} />
            <span className="text-sm font-bold">Imprimir Extrato</span>
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-xl text-accent"><Wallet size={20} /></div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">Selecionar Conta</label>
            <select 
              value={selectedBankId}
              onChange={e => setSelectedBankId(e.target.value)}
              className="bg-transparent border-none text-sm font-bold focus:outline-none w-full appearance-none cursor-pointer"
            >
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-accent/10 rounded-xl text-accent"><Calendar size={20} /></div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">Período</label>
            <input 
              type="month" 
              value={format(filterDate, 'yyyy-MM')}
              onChange={e => setFilterDate(new Date(e.target.value + '-02'))}
              className="bg-transparent border-none text-sm font-bold focus:outline-none w-full text-text-primary"
            />
          </div>
        </div>

        <div className="bg-surface p-4 rounded-2xl border border-border shadow-sm flex items-center gap-4">
          <div className="p-3 bg-success/10 rounded-xl text-success"><TrendingUp size={20} /></div>
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase text-text-secondary block mb-1">Saldo Atual da Conta</label>
            <div className="text-sm font-bold text-success">{formatCurrency(selectedBank?.currentBalance || 0)}</div>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-20 bg-surface rounded-3xl border border-border"
          >
            <RefreshCw className="w-8 h-8 text-accent animate-spin mb-4" />
            <p className="text-text-secondary text-sm font-medium">Buscando lançamentos...</p>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface rounded-3xl border border-border shadow-xl overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-bg/50 border-b border-border">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-text-secondary">Data Pagamento</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-text-secondary">Descrição</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-text-secondary">Categoria</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-text-secondary text-right">Valor</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-text-secondary text-right pr-10">Saldo Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {transactionsWithBalance.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-text-secondary italic">
                        Nenhuma transação paga encontrada para este período nesta conta.
                      </td>
                    </tr>
                  ) : (
                    transactionsWithBalance.map((tx, idx) => (
                      <tr key={tx.id} className="hover:bg-accent/5 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-text-primary">{format(tx.datePayment, 'dd/MM/yyyy')}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-text-primary font-bold">{tx.description}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-bold px-2 py-1 bg-surface border border-border rounded-lg text-text-secondary uppercase">
                            {tx.categoryName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className={cn(
                            "text-sm font-bold",
                            tx.type === 'REVENUE' ? "text-success" : "text-danger"
                          )}>
                            {tx.type === 'REVENUE' ? '+' : '-'} {formatCurrency(tx.amount)}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right pr-10">
                          <div className={cn(
                            "text-sm font-black",
                            tx.runningBalance >= 0 ? "text-text-primary" : "text-danger"
                          )}>
                            {formatCurrency(tx.runningBalance)}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden print:block mt-20 pt-10 border-t border-border text-center">
        <p className="text-sm font-bold text-text-secondary uppercase tracking-widest text-[#666]">Desenvolvido por M4 Marketing Digital</p>
      </div>

      <div className="p-6 bg-surface/50 border border-border rounded-2xl flex items-start gap-4 shadow-inner">
        <div className="p-2 bg-accent/10 rounded-xl text-accent"><FileText size={20} /></div>
        <div className="space-y-1">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-primary">Nota sobre Conciliação</h4>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            O extrato de contas exibe apenas transações com status <strong>PAGO/RECEBIDO</strong>. O saldo acumulado é calculado a partir do saldo inicial configurado na conta bancária.
          </p>
        </div>
      </div>
    </div>
  );
}
