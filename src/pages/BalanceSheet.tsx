import { useState, useEffect, useMemo } from 'react';
import { financeService } from '../financeService';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { motion } from 'motion/react';
import { 
  Shield, 
  TrendingUp, 
  TrendingDown, 
  Scale as ScaleIcon,
  RefreshCw,
  Wallet,
  CreditCard,
  ArrowUpCircle,
  ArrowDownCircle,
  Building,
  Info
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { LoginPage } from './Login';

export function BalanceSheetPage() {
  const [loading, setLoading] = useState(true);
  const [localCreditCards, setLocalCreditCards] = useState<any[]>([]);
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const { user, loading: authLoading } = useAuth();
  const { companyId, bankAccounts, creditCards: contextCreditCards, loading: companyLoading } = useCompany();

  const loadData = async () => {
    if (!user || !companyId) return;
    setLoading(true);
    try {
      console.log(`[BalanceSheet] Carregando transações pendentes para empresa: ${companyId}`);
      const txs = await financeService.buscarTransacoes(companyId);
      
      console.log(`[BalanceSheet] Transações carregadas:`, txs?.length);
      
      // Calculate current statement for each card based on transactions
      const cardsWithBalance = (contextCreditCards || []).map(card => {
        const cardTxs = (txs || []).filter(t => t.creditCardId === card.id);
        const currentStatement = cardTxs.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        return { ...card, current_statement: currentStatement };
      });
      
      setLocalCreditCards(cardsWithBalance);
      // Incluir PENDING e SCHEDULED como obrigações/direitos pendentes
      setPendingTransactions((txs || []).filter(t => t.status === 'PENDING' || t.status === 'SCHEDULED' || (t.status as any) === 'AGENDADO'));
    } catch (error) {
      console.error('[BalanceSheet] Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !companyLoading && user && companyId) {
      loadData();
    }
  }, [user, authLoading, companyLoading, companyId, contextCreditCards]);

  const stats = useMemo(() => {
    const totalAssets = bankAccounts.reduce((acc, bank) => acc + (Number(bank.currentBalance) || 0), 0);
    const totalCreditDebt = localCreditCards.reduce((acc, card) => acc + (card.current_statement || 0), 0);
    
    const pendingRevenue = pendingTransactions
      .filter(tx => tx.type === 'REVENUE')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);
      
    const pendingExpense = pendingTransactions
      .filter(tx => tx.type === 'EXPENSE')
      .reduce((acc, tx) => acc + (tx.amount || 0), 0);
    
    const totalLiabilities = totalCreditDebt + pendingExpense;
    const netWorth = totalAssets - totalLiabilities;
    const projectedBalance = totalAssets + pendingRevenue - pendingExpense;

    return {
      totalAssets,
      totalCreditDebt,
      pendingRevenue,
      pendingExpense,
      totalLiabilities,
      netWorth,
      projectedBalance
    };
  }, [bankAccounts, localCreditCards, pendingTransactions]);

  if (authLoading || companyLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin" /></div>;
  if (!user) return <LoginPage />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Balanço Patrimonial</h1>
        <p className="text-text-secondary text-sm">Visão geral de Ativos, Passivos e Patrimônio Líquido</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <BalanceCard 
          label="Ativos (Saldos em Conta)" 
          value={stats.totalAssets} 
          icon={<Wallet className="text-success" />}
          type="asset"
        />
        <BalanceCard 
          label="Saldo Projetado (Forecast)" 
          value={stats.projectedBalance} 
          icon={<ArrowUpCircle className="text-accent" />}
          description="Saldos + Receitas/Despesas Pendentes"
          type="networth"
        />
        <BalanceCard 
          label="Crédito e Obrigações" 
          value={stats.totalLiabilities} 
          icon={<ArrowDownCircle className="text-danger" />}
          type="liability"
        />
        <BalanceCard 
          label="Patrimônio Líquido" 
          value={stats.netWorth} 
          icon={<Shield className="text-indigo-400" />}
          type="networth"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Ativos Details */}
        <div className="bg-surface rounded-3xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border bg-bg/20 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <Building size={18} className="text-success" />
              Ativos Circulantes
            </h3>
            <span className="text-xs font-bold text-success bg-success/10 px-2 py-1 rounded-full uppercase">Disponibilidades</span>
          </div>
          <div className="p-6 space-y-4">
            {bankAccounts.length === 0 ? (
              <p className="text-sm text-text-secondary italic">Nenhuma conta bancária cadastrada.</p>
            ) : (
              bankAccounts.map(bank => (
                <div key={bank.id} className="flex justify-between items-center p-4 bg-bg/50 rounded-2xl border border-border border-l-4 border-l-success">
                  <div>
                    <div className="text-sm font-bold">{bank.name || 'Conta Corrente'}</div>
                    <div className="text-[10px] text-text-secondary uppercase font-bold tracking-widest">{bank.bankName || 'Instituição Financeira'}</div>
                  </div>
                  <div className="text-sm font-black text-text-primary">
                    {formatCurrency(bank.currentBalance)}
                  </div>
                </div>
              ))
            )}
            <div className="pt-4 mt-6 border-t border-border flex justify-between items-center font-bold">
              <span className="text-sm text-text-secondary uppercase tracking-widest">Total Ativos</span>
              <span className="text-lg text-success">{formatCurrency(stats.totalAssets)}</span>
            </div>
          </div>
        </div>

        {/* Passivos Details */}
        <div className="bg-surface rounded-3xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border bg-bg/30 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <ArrowDownCircle size={18} className="text-danger" />
              Passivos Circulantes
            </h3>
            <span className="text-xs font-bold text-danger bg-danger/10 px-2 py-1 rounded-full uppercase">Obrigações</span>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Faturas de Cartão</div>
              <div className="space-y-3">
                {localCreditCards.length === 0 ? (
                  <p className="text-[11px] text-text-secondary">Nenhum cartão cadastrado.</p>
                ) : (
                  localCreditCards.map(card => (
                    <div key={card.id} className="flex justify-between items-center p-3 bg-bg/30 rounded-xl border border-border">
                      <div className="flex items-center gap-3">
                        <CreditCard size={14} className="text-danger/70" />
                        <span className="text-xs font-medium">{card.name}</span>
                      </div>
                      <span className="text-xs font-bold text-danger">{formatCurrency(card.current_statement || 0)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Contas a Pagar (Pendentes)</div>
              <div className="p-4 bg-bg/30 rounded-xl border border-border flex justify-between items-center">
                <span className="text-xs font-medium">Provisionado em Lançamentos</span>
                <span className="text-xs font-bold text-danger">{formatCurrency(stats.pendingExpense)}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-between items-center font-bold">
              <span className="text-sm text-text-secondary uppercase tracking-widest">Total Passivos</span>
              <span className="text-lg text-danger">{formatCurrency(stats.totalLiabilities)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-accent/5 p-8 rounded-3xl border border-accent/20 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <ScaleIcon size={120} />
        </div>
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center border border-accent/20">
            <ScaleIcon className="text-accent" size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Equação Patrimonial</h3>
            <p className="text-text-secondary text-sm max-w-lg mt-1">
              O Patrimônio Líquido representa a riqueza real da empresa, subtraindo todas as suas obrigações (Passivos) do que ela possui (Ativos).
            </p>
          </div>
        </div>
        <div className="bg-surface border border-border p-6 rounded-2xl shadow-xl min-w-[240px]">
          <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-2">Net Worth Atual</div>
          <div className={cn("text-3xl font-black", stats.netWorth >= 0 ? "text-accent" : "text-danger")}>
            {formatCurrency(stats.netWorth)}
          </div>
        </div>
      </div>
    </div>
  );
}

function BalanceCard({ label, value, icon, type, description }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface p-6 rounded-3xl border border-border shadow-xl hover:shadow-2xl transition-all"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="text-[10px] font-bold uppercase text-text-secondary tracking-widest">{label}</div>
        <div className="w-8 h-8 rounded-xl bg-bg border border-border flex items-center justify-center">
          {icon}
        </div>
      </div>
      <div className={cn(
        "text-2xl font-black tracking-tight",
        type === 'asset' ? "text-success" : 
        type === 'liability' ? "text-danger" : 
        value >= 0 ? "text-accent" : "text-danger"
      )}>
        {formatCurrency(value)}
      </div>
      {description && <div className="text-[10px] text-text-secondary mt-1 font-medium italic">{description}</div>}
    </motion.div>
  );
}
