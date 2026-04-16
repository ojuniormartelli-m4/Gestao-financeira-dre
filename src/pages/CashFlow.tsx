import { useState, useEffect } from 'react';
import { financeService } from '../financeService';
import { useAuth } from '../contexts/AuthContext';
import { useFilter } from '../contexts/FilterContext';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Clock,
  ChevronRight,
  Info
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer 
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { format, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';
import { LoginPage } from './Login';

export function CashFlowPage() {
  const { theme } = useTheme();
  const { selectedBankId, setSelectedBankId } = useFilter();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [upcomingTransactions, setUpcomingTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const companyId = 'minha-empresa-demo';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [banks, upcoming] = await Promise.all([
        financeService.buscarContasBancarias(companyId),
        financeService.buscarProximosVencimentos(companyId)
      ]);
      
      setBankAccounts(banks || []);
      
      const bankId = selectedBankId === 'all' ? undefined : selectedBankId;
      const filteredUpcoming = bankId 
        ? (upcoming || []).filter((t: any) => t.bankAccountId === bankId)
        : (upcoming || []);
      
      setUpcomingTransactions(filteredUpcoming);
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
  }, [user, authLoading, selectedBankId]);

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

  const selectedBank = bankAccounts.find(b => b.id === selectedBankId);
  const initialBalance = selectedBankId === 'all' 
    ? bankAccounts.reduce((acc, b) => acc + (b.currentBalance || 0), 0)
    : selectedBank?.currentBalance || 0;

  // Gerar dados para o gráfico de projeção (próximos 30 dias)
  const projectionData = [];
  let currentBalance = initialBalance;
  const today = startOfDay(new Date());

  for (let i = 0; i < 30; i++) {
    const date = addDays(today, i);
    const dayTransactions = upcomingTransactions.filter(t => 
      startOfDay(t.dateCompetence).getTime() === date.getTime()
    );

    const dayChange = dayTransactions.reduce((acc, t) => {
      return acc + (t.type === 'REVENUE' ? t.amount : -t.amount);
    }, 0);

    currentBalance += dayChange;

    projectionData.push({
      date: format(date, 'dd/MM'),
      fullDate: format(date, "dd 'de' MMMM", { locale: ptBR }),
      saldo: currentBalance,
      movimentacao: dayChange
    });
  }

  const totalEntradas = upcomingTransactions
    .filter(t => t.type === 'REVENUE')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalSaidas = upcomingTransactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa</h1>
          <p className="text-text-secondary text-sm">Projeção de saldos e vencimentos</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <select 
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-sm font-bold focus:outline-none focus:border-accent appearance-none cursor-pointer min-w-[200px]"
            >
              <option value="all">Todas as Contas</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-surface rounded-3xl border border-border p-8 shadow-xl">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="font-bold text-lg">Projeção de Saldo (30 dias)</h3>
                <p className="text-xs text-text-secondary">Baseado em contas a pagar e receber</p>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-text-secondary mb-1">Saldo Final Previsto</div>
                <div className={cn(
                  "text-xl font-black",
                  projectionData[29].saldo >= 0 ? "text-success" : "text-danger"
                )}>
                  {formatCurrency(projectionData[29].saldo)}
                </div>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={projectionData}>
                  <defs>
                    <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => `R$ ${value}`}
                  />
                  <ReTooltip 
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                      border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, 
                      borderRadius: '12px' 
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}
                    formatter={(value: number) => [formatCurrency(value), 'Saldo']}
                    labelFormatter={(label, payload) => payload[0]?.payload?.fullDate || label}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke="var(--accent)" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSaldo)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-accent/10 rounded-xl text-accent"><Wallet size={20} /></div>
                <span className="text-xs font-bold uppercase text-text-secondary">Saldo Atual</span>
              </div>
              <div className={cn("text-xl font-bold", initialBalance >= 0 ? "text-text-primary" : "text-danger")}>
                {formatCurrency(initialBalance)}
              </div>
            </div>
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-success/10 rounded-xl text-success"><ArrowUpRight size={20} /></div>
                <span className="text-xs font-bold uppercase text-text-secondary">Total a Receber</span>
              </div>
              <div className="text-xl font-bold text-success">
                +{formatCurrency(totalEntradas)}
              </div>
            </div>
            <div className="bg-surface p-6 rounded-3xl border border-border shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-danger/10 rounded-xl text-danger"><ArrowDownRight size={20} /></div>
                <span className="text-xs font-bold uppercase text-text-secondary">Total a Pagar</span>
              </div>
              <div className="text-xl font-bold text-danger">
                -{formatCurrency(totalSaidas)}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Upcoming List */}
        <div className="space-y-6">
          <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Clock className="text-accent" size={20} />
                Próximos Lançamentos
              </h3>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
              {upcomingTransactions.length === 0 ? (
                <div className="py-20 text-center text-text-secondary text-sm italic">
                  Nenhum lançamento pendente para os próximos 30 dias.
                </div>
              ) : (
                upcomingTransactions.map((tx) => (
                  <div key={tx.id} className="group p-4 bg-bg/50 rounded-2xl border border-border hover:border-accent/30 transition-all">
                    <div className="flex justify-between items-start mb-2">
                      <div className={cn(
                        "px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider",
                        tx.type === 'REVENUE' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                      )}>
                        {tx.type === 'REVENUE' ? 'Receita' : 'Despesa'}
                      </div>
                      <span className="text-[10px] font-bold text-text-secondary">{format(tx.dateCompetence, 'dd/MM')}</span>
                    </div>
                    <div className="text-sm font-bold text-text-primary mb-1 truncate">{tx.description}</div>
                    <div className="flex justify-between items-center">
                      <div className="text-[10px] text-text-secondary flex items-center gap-1">
                        <Wallet size={10} />
                        {bankAccounts.find(b => b.id === tx.bankAccountId)?.name || 'Conta'}
                      </div>
                      <div className={cn(
                        "text-sm font-bold",
                        tx.type === 'REVENUE' ? "text-success" : "text-danger"
                      )}>
                        {tx.type === 'REVENUE' ? '+' : '-'} {formatCurrency(tx.amount)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 pt-6 border-t border-border">
              <div className="bg-bg/50 p-4 rounded-2xl border border-border flex items-start gap-3">
                <Info size={16} className="text-accent shrink-0 mt-0.5" />
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  A projeção considera apenas transações com status <strong>PENDENTE</strong>. Transações já pagas/recebidas estão consolidadas no saldo atual.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
