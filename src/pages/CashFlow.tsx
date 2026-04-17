import { useState, useEffect, useMemo } from 'react';
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
  Info,
  Printer,
  FileText
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReTooltip, 
  ResponsiveContainer,
  Legend
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTheme } from '../contexts/ThemeContext';
import { LoginPage } from './Login';

export function CashFlowPage() {
  const { theme } = useTheme();
  const { selectedBankId, setSelectedBankId } = useFilter();
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('all');
  const [realHistory, setRealHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const companyId = 'm4-digital';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [banks, history, centers] = await Promise.all([
        financeService.buscarContasBancarias(companyId),
        financeService.buscarFluxoDeCaixaReal(
          companyId, 
          6, 
          selectedBankId !== 'all' ? selectedBankId : undefined,
          selectedCostCenterId !== 'all' ? selectedCostCenterId : undefined
        ),
        financeService.buscarCentrosCusto(companyId)
      ]);
      setBankAccounts(banks || []);
      setRealHistory(history || []);
      setCostCenters(centers || []);
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
  }, [user, authLoading, selectedBankId, selectedCostCenterId]);

  const chartData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(now, i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);
      
      const monthTxs = realHistory.filter(tx => 
        tx.date >= monthStart && tx.date <= monthEnd
      );

      const entries = monthTxs
        .filter(tx => tx.type === 'REVENUE')
        .reduce((sum, tx) => sum + tx.amount, 0);

      const exits = monthTxs
        .filter(tx => tx.type === 'EXPENSE')
        .reduce((sum, tx) => sum + tx.amount, 0);

      months.push({
        month: format(date, 'MMM/yy', { locale: ptBR }),
        entradas: entries,
        saidas: exits,
        saldo: entries - exits
      });
    }
    return months;
  }, [realHistory]);

  const totalPeriodo = useMemo(() => {
    const entries = realHistory.filter(t => t.type === 'REVENUE').reduce((s, t) => s + t.amount, 0);
    const exits = realHistory.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
    return { entries, exits, balance: entries - exits };
  }, [realHistory]);

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin" /></div>;
  if (!user) return <LoginPage />;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fluxo de Caixa (Realizado)</h1>
          <p className="text-text-secondary text-sm">Entradas vs Saídas no regime de caixa</p>
        </div>
        
        <div className="flex gap-2">
          <div className="flex items-center gap-4 bg-surface p-2 px-4 rounded-xl border border-border">
            <div className="flex items-center gap-2">
              <Wallet className="text-accent" size={18} />
              <select 
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="bg-transparent border-none text-xs font-bold focus:outline-none text-text-primary appearance-none cursor-pointer"
              >
                <option value="all">Todas as Contas</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-accent" />
              <select 
                value={selectedCostCenterId}
                onChange={(e) => setSelectedCostCenterId(e.target.value)}
                className="bg-transparent border-none text-xs font-bold focus:outline-none text-text-primary appearance-none cursor-pointer"
              >
                <option value="all">Todos C. Custos</option>
                {costCenters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors"
          >
            <Printer size={18} />
            <span className="text-sm font-bold">Imprimir</span>
          </button>
        </div>
      </header>

      <div className="bg-surface rounded-2xl border border-border shadow-xl p-8 mb-8">
        <h3 className="font-black italic text-xl mb-8 flex items-center gap-2">
          <TrendingUp className="text-success" size={24} />
          Análise de Fluxo Mensal
        </h3>
        <div className="h-80 w-full mb-12">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 10, fontWeight: 700 }}
              />
              <ReTooltip 
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                  border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, 
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                formatter={(val: number) => formatCurrency(val)}
              />
              <Legend wrapperStyle={{ paddingTop: 20, fontSize: 12, fontWeight: 600 }} />
              <Bar dataKey="entradas" name="Entradas" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="saidas" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tabela de Resumo Estilo Technical Dashboard */}
        <div className="border border-border rounded-xl overflow-hidden mt-8">
          <div className="grid grid-cols-4 gap-4 p-4 bg-bg/50 border-b border-border text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            <span>Mês Referência</span>
            <span className="text-right">Entradas</span>
            <span className="text-right">Saídas</span>
            <span className="text-right">Saldo Líquido</span>
          </div>
          <div className="divide-y divide-border">
            {[...chartData].reverse().map((data: any) => (
              <div key={data.month} className="grid grid-cols-4 gap-4 p-4 hover:bg-white/5 transition-colors items-center">
                <span className="text-xs font-bold font-mono uppercase">{data.month}</span>
                <span className="text-xs font-mono text-success text-right font-medium">{formatCurrency(data.entradas)}</span>
                <span className="text-xs font-mono text-danger text-right font-medium">{formatCurrency(data.saidas)}</span>
                <span className={cn(
                  "text-xs font-mono text-right font-black",
                  data.saldo >= 0 ? "text-accent" : "text-danger"
                )}>
                  {formatCurrency(data.saldo)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Consolidado Entradas" value={totalPeriodo.entries} type="revenue" />
        <StatsCard label="Consolidado Saídas" value={totalPeriodo.exits} type="expense" />
        <StatsCard label="Resultado Acumulado" value={totalPeriodo.balance} type="balance" />
      </div>
    </div>
  );
}

function StatsCard({ label, value, type }: any) {
  const isPositive = value >= 0;
  return (
    <div className="bg-surface p-6 rounded-3xl border border-border shadow-lg">
      <div className="text-[10px] font-bold uppercase text-text-secondary mb-2 tracking-widest">{label}</div>
      <div className={cn(
        "text-xl font-black",
        type === 'revenue' ? "text-success" : 
        type === 'expense' ? "text-danger" : 
        isPositive ? "text-accent" : "text-danger"
      )}>
        {type === 'expense' && value > 0 ? '-' : ''}
        {formatCurrency(Math.abs(value))}
      </div>
    </div>
  );
}
