import { useState, useEffect } from 'react';
import { gerarDRE, financeService } from '../financeService';
import { popularDadosTeste } from '../mockData';
import { aiService } from '../aiService';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { useFilter } from '../contexts/FilterContext';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  PieChart as PieChartIcon, 
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Sparkles,
  AlertTriangle,
  BrainCircuit,
  Lock,
  PlusCircle,
  Wallet,
  CalendarDays,
  ChevronRight,
  Clock,
  Filter,
  Check
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as ReTooltip, 
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { LoginPage } from './Login';

import { useTheme } from '../contexts/ThemeContext';

export function DashboardPage() {
  const { theme } = useTheme();
  const { selectedBankId, setSelectedBankId } = useFilter();
  const { companyConfig, companyId } = useCompany();
  const [dre, setDre] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [upcomingTransactions, setUpcomingTransactions] = useState<any[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [projection, setProjection] = useState<string>('');
  const [anomalies, setAnomalies] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const hoje = new Date();
      const mes = hoje.getMonth() + 1;
      const ano = hoje.getFullYear();
      
      const bankId = selectedBankId === 'all' ? undefined : selectedBankId;

      const [resultado, resultadoAnterior, allTxs, banks, upcoming] = await Promise.all([
        gerarDRE(companyId, mes, ano, bankId),
        gerarDRE(companyId, mes === 1 ? 12 : mes - 1, mes === 1 ? ano - 1 : ano, bankId),
        financeService.buscarTodasTransacoes(companyId),
        financeService.buscarContasBancarias(companyId),
        financeService.buscarProximosVencimentos(companyId)
      ]);
      
      console.log('Dados brutos das contas:', banks);
      
      setDre(resultado);
      const filteredTxs = selectedBankId === 'all' ? (allTxs || []) : (allTxs || []).filter(t => t.bankAccountId === selectedBankId);
      setTransactions(filteredTxs);
      setBankAccounts(banks || []);

      // Calculate account stats (Confirmed vs Projected)
      const accountsWithStats = (banks || []).map(acc => {
        const accTxs = (allTxs || []).filter(t => t.bankAccountId === acc.id);
        const confirmed = Number(acc.currentBalance || 0);
        const pending = accTxs
          .filter(t => t.status === 'PENDING' || t.status === 'SCHEDULED')
          .reduce((sum, t) => sum + (t.type === 'REVENUE' ? Number(t.amount) : -Number(t.amount)), 0);
        return {
          ...acc,
          projected: confirmed + pending
        };
      });
      setBankAccounts(accountsWithStats);
      
      // Filtrar próximos vencimentos se um banco estiver selecionado
      const filteredUpcoming = bankId 
        ? (upcoming || []).filter(t => t.bankAccountId === bankId)
        : (upcoming || []);
      setUpcomingTransactions(filteredUpcoming);
      
      if (resultado && filteredTxs && filteredTxs.length > 0) {
        runAIAnalysis(resultado, filteredTxs);
        detectAnomalies(resultado, resultadoAnterior);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const runAIAnalysis = async (dreData: any, transacoes: any[]) => {
    setAiLoading(true);
    try {
      const bankName = selectedBankId === 'all' ? 'todas as contas' : bankAccounts.find(b => b.id === selectedBankId)?.name || 'esta conta';
      const contextPrefix = selectedBankId !== 'all' ? `Analisando especificamente a conta ${bankName}: ` : '';
      
      const [analysis, proj] = await Promise.all([
        aiService.analisarSaudeFinanceira(dreData),
        aiService.projetarFluxoCaixa(transacoes.slice(0, 20), transacoes.filter(t => t.status === 'PENDING'))
      ]);
      setAiAnalysis(contextPrefix + (analysis || ''));
      setProjection(proj || '');
    } catch (error) {
      console.error(error);
    } finally {
      setAiLoading(false);
    }
  };

  const detectAnomalies = (atual: any, anterior: any) => {
    if (!atual || !anterior) return;
    const alerts: string[] = [];
    
    const grupos = ['FIXED_COST', 'VARIABLE_COST', 'TAX'];
    grupos.forEach(grupo => {
      const valAtual = atual[grupo] || 0;
      const valAnterior = anterior[grupo] || 0;
      if (valAnterior > 0 && (valAtual / valAnterior) > 1.2) {
        const labels: any = { FIXED_COST: 'Custos Fixos', VARIABLE_COST: 'Custos Variáveis', TAX: 'Impostos' };
        alerts.push(`Atenção: Seus gastos com ${labels[grupo]} subiram mais de 20% em relação ao mês anterior.`);
      }
    });
    setAnomalies(alerts);
  };

  const handlePopularDados = async () => {
    setLoading(true);
    setMessage('Populando dados...');
    try {
      await popularDadosTeste(companyId);
      setMessage('Dados populados com sucesso!');
      await loadData();
    } catch (error) {
      console.error(error);
      setMessage('Erro ao popular dados.');
    } finally {
      setLoading(false);
    }
  };

  const selectedBank = bankAccounts.find(b => b.id === selectedBankId);
  const displayBalance = selectedBankId === 'all' 
    ? bankAccounts.reduce((acc, b) => acc + (Number(b.currentBalance) || 0), 0)
    : Number(selectedBank?.currentBalance || 0);

  const balanceLabel = selectedBankId === 'all' ? 'Saldo Total' : `Saldo: ${selectedBank?.name}`;

  useEffect(() => {
    const initData = async () => {
      if (user && companyId) {
        await financeService.verificarEPovoarDadosIniciais(companyId);
        loadData();
      }
    };
    
    if (!authLoading) {
      if (user) {
        initData();
      }
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

  const COLORS = ['#00E699', '#00C2FF', '#FFB800', '#FF4D4D', '#A855F7'];

  // Dados para o gráfico de barras (simulados para o exemplo, em produção viriam do histórico real)
  const chartData = [
    { name: 'Jan', receita: 4000, despesa: 2400 },
    { name: 'Fev', receita: 3000, despesa: 1398 },
    { name: 'Mar', receita: 2000, despesa: 9800 },
    { name: 'Abr', receita: 2780, despesa: 3908 },
    { name: 'Mai', receita: 1890, despesa: 4800 },
    { name: 'Jun', receita: 2390, despesa: 3800 },
    { name: 'Jul', receita: 3490, despesa: 4300 },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-center gap-6 flex-1">
          <div className="flex items-center gap-4">
            {companyConfig?.logoUrl && (
              <img src={companyConfig.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-border" referrerPolicy="no-referrer" />
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{companyConfig?.name || 'Dashboard'}</h1>
              <p className="text-text-secondary text-sm">{companyConfig?.name ? 'Dashboard' : 'Visão geral da saúde financeira'}</p>
            </div>
          </div>
          <div className="h-10 w-px bg-border hidden md:block" />
          <div className="flex items-center gap-3">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
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
          <div className="flex-1 flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            <div className="bg-surface border border-border px-4 py-2 rounded-2xl shadow-sm min-w-[160px]">
              <div className="text-[10px] font-bold uppercase text-text-secondary mb-0.5 truncate">{balanceLabel}</div>
              <div className={cn("text-lg font-bold", displayBalance >= 0 ? "text-success" : "text-danger")}>
                {formatCurrency(displayBalance)}
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={handlePopularDados}
          disabled={loading}
          className="flex items-center gap-2 bg-surface hover:bg-white/5 border border-border text-text-primary px-4 py-2 rounded-xl font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Resetar Dados Demo
        </button>
      </header>

      {message && (
        <div className="p-4 bg-accent/10 border border-accent/20 text-accent rounded-2xl text-sm">
          {message}
        </div>
      )}

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div className="space-y-3">
          {anomalies.map((alert, i) => (
            <motion.div 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              key={i} 
              className="flex items-center gap-3 p-4 bg-danger/10 border border-danger/20 text-danger rounded-2xl text-sm font-medium"
            >
              <AlertTriangle size={18} />
              {alert}
            </motion.div>
          ))}
        </div>
      )}

      {/* Saldos de Caixa Summary Card */}
      <div className="bg-surface rounded-[2rem] border border-border overflow-hidden shadow-xl">
        <div className="px-8 py-5 border-b border-border flex items-center justify-between bg-bg/20">
          <h3 className="text-sm font-bold text-text-secondary uppercase tracking-widest flex items-center gap-2">
            <Wallet size={16} className="text-accent" />
            Saldos de caixa
          </h3>
          <div className="flex items-center gap-8 text-[10px] font-bold text-text-secondary uppercase tracking-widest mr-4">
            <span className="w-24 text-right">Confirmado</span>
            <span className="w-24 text-right">Projetado</span>
          </div>
        </div>
        <div className="p-4 space-y-1">
          {/* Global Toggle Row */}
          <div 
            className="flex items-center justify-between p-3 rounded-xl hover:bg-bg/40 transition-colors cursor-pointer group"
            onClick={() => setSelectedBankId('all')}
          >
            <div className="flex items-center gap-4">
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  checked={selectedBankId === 'all'} 
                  onChange={() => {}} // Handled by parent div click
                  className="w-5 h-5 rounded-lg border-2 border-border checked:bg-accent checked:border-accent transition-all appearance-none cursor-pointer"
                />
                {selectedBankId === 'all' && <Check className="absolute left-1 top-1 text-bg pointer-events-none" size={12} strokeWidth={4} />}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                  <div className="w-4 h-4 rounded-full bg-accent animate-pulse" />
                </div>
                <span className="text-sm font-bold text-text-primary">Visão Consolidada</span>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <span className="w-24 text-right text-sm font-bold text-text-primary">
                {formatCurrency(bankAccounts.reduce((acc, b) => acc + (b.currentBalance || 0), 0))}
              </span>
              <span className="w-24 text-right text-sm font-bold text-accent">
                {formatCurrency(bankAccounts.reduce((acc, b) => acc + (b.projected || 0), 0))}
              </span>
            </div>
          </div>

          {/* Individual Bank Rows */}
          {bankAccounts.map(account => (
            <div 
              key={account.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer group",
                selectedBankId === account.id ? "bg-accent/10 border border-accent/20 shadow-inner" : "hover:bg-bg/40 border border-transparent"
              )}
              onClick={() => setSelectedBankId(account.id)}
            >
              <div className="flex items-center gap-4">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={selectedBankId === account.id} 
                    onChange={() => {}} 
                    className="w-5 h-5 rounded-lg border-2 border-border checked:bg-accent checked:border-accent transition-all appearance-none cursor-pointer"
                  />
                  {selectedBankId === account.id && <Check className="absolute left-1 top-1 text-bg pointer-events-none" size={12} strokeWidth={4} />}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-bg rounded-xl flex items-center justify-center border border-border shadow-sm overflow-hidden p-1.5">
                    <div 
                      className="w-full h-full rounded flex items-center justify-center text-[10px] font-black italic uppercase"
                      style={{ backgroundColor: account.color || '#94a3b8', color: 'white' }}
                    >
                      {account.name.substring(0, 2)}
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-text-primary">{account.name}</span>
                    <span className="text-[10px] text-text-secondary uppercase font-bold tracking-tighter opacity-60">Conta Corrente</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <span className="w-24 text-right text-sm font-mono font-bold text-success">
                  {formatCurrency(account.currentBalance)}
                </span>
                <span className="w-24 text-right text-sm font-mono font-bold text-accent">
                  {formatCurrency(account.projected)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="px-8 py-4 bg-bg/40 border-t border-border flex items-center justify-between">
          <span className="text-sm font-black italic uppercase text-text-primary">Total</span>
          <div className="flex items-center gap-8">
            <span className="w-24 text-right text-base font-black text-success">
              {formatCurrency(bankAccounts.reduce((acc, b) => acc + (b.currentBalance || 0), 0))}
            </span>
            <span className="w-24 text-right text-base font-black text-accent">
              {formatCurrency(bankAccounts.reduce((acc, b) => acc + (b.projected || 0), 0))}
            </span>
          </div>
        </div>
      </div>

      {transactions.length === 0 && selectedBankId === 'all' ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2.5rem] border border-border shadow-2xl text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
          <div className="w-24 h-24 bg-accent/5 rounded-full flex items-center justify-center relative">
            <div className="absolute inset-0 bg-accent/10 rounded-full animate-ping" />
            <Wallet size={48} className="text-accent relative z-10" />
          </div>
          <div className="max-w-md space-y-2">
            <h2 className="text-2xl font-bold">Comece sua jornada financeira</h2>
            <p className="text-text-secondary">Seu dashboard está pronto, mas faltam dados para gerar os insights. Cadastre sua primeira movimentação agora!</p>
          </div>
          <button 
            onClick={() => navigate('/transacoes')}
            className="flex items-center gap-2 bg-accent text-bg font-bold px-8 py-4 rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-accent/20 group"
          >
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform" />
            Cadastrar Primeira Transação
          </button>
          <div className="pt-4">
            <button onClick={handlePopularDados} className="text-xs text-text-secondary hover:text-accent underline underline-offset-4">Ou use dados de demonstração</button>
          </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Receita Bruta" 
              value={dre?.GROSS_REVENUE || 0} 
              trend="+12.5%" 
              icon={<TrendingUp className="text-accent" />} 
            />
            <StatCard 
              title="Margem Contrib." 
              value={dre?.contributionMargin || 0} 
              trend="+8.2%" 
              icon={<Activity className="text-accent" />} 
            />
            <StatCard 
              title="EBITDA" 
              value={dre?.ebitda || 0} 
              trend="-2.4%" 
              icon={<DollarSign className="text-accent" />} 
            />
            <StatCard 
              title="Lucro Líquido" 
              value={dre?.netProfit || 0} 
              trend="+15.0%" 
              icon={dre?.netProfit >= 0 ? <TrendingUp className="text-success" /> : <TrendingDown className="text-danger" />} 
              highlight={dre?.netProfit >= 0 ? 'success' : 'danger'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Real Chart with Recharts */}
            <div className="lg:col-span-2 bg-surface rounded-3xl border border-border p-8 shadow-xl">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-bold text-lg">Desempenho Mensal</h3>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-text-secondary">
                    <div className="w-3 h-3 rounded-full bg-accent" /> Receita
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-text-secondary">
                    <div className="w-3 h-3 rounded-full bg-danger" /> Despesa
                  </div>
                </div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                    <XAxis 
                      dataKey="name" 
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
                      cursor={{ fill: theme === 'dark' ? '#1e293b' : '#f8fafc' }}
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                        border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, 
                        borderRadius: '12px' 
                      }}
                      itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="receita" fill="#00E699" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="despesa" fill="#FF4D4D" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Projection Card */}
            <div className="bg-surface rounded-3xl border border-border p-8 shadow-xl space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BrainCircuit size={80} className="text-accent" />
              </div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Sparkles size={18} className="text-accent" />
                Projeção 30 Dias
              </h3>
              
              {aiLoading ? (
                <div className="space-y-3">
                  <div className="h-3 bg-bg/50 rounded-full animate-pulse" />
                  <div className="h-3 bg-bg/50 rounded-full animate-pulse [animation-delay:0.2s]" />
                  <div className="h-3 bg-bg/50 rounded-full animate-pulse [animation-delay:0.4s]" />
                </div>
              ) : (
                <p className="text-xs text-text-secondary leading-relaxed italic">
                  {projection || "Analisando tendências de mercado e histórico..."}
                </p>
              )}

              <div className="pt-4 space-y-4">
                <div className="p-4 bg-bg/50 rounded-2xl border border-border flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg text-success"><ArrowUpRight size={18} /></div>
                    <span className="text-sm font-medium">Entradas</span>
                  </div>
                  <span className="font-bold text-success">{formatCurrency(dre?.GROSS_REVENUE || 0)}</span>
                </div>
                <div className="p-4 bg-bg/50 rounded-2xl border border-border flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-danger/10 rounded-lg text-danger"><ArrowDownRight size={18} /></div>
                    <span className="text-sm font-medium">Saídas</span>
                  </div>
                  <span className="font-bold text-danger">{formatCurrency((dre?.FIXED_COST || 0) + (dre?.VARIABLE_COST || 0))}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Charts and Widgets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Liquidity Composition */}
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <PieChartIcon className="text-accent" size={20} />
                  Composição de Patrimônio
                </h3>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={bankAccounts.map(b => ({ name: b.name, value: b.currentBalance }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {bankAccounts.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <ReTooltip 
                      contentStyle={{ 
                        backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff', 
                        border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, 
                        borderRadius: '12px' 
                      }}
                      itemStyle={{ color: theme === 'dark' ? '#f8fafc' : '#1e293b' }}
                      formatter={(value: number) => formatCurrency(value)}
                    />
                    <Legend verticalAlign="bottom" height={36}/>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Upcoming Transactions */}
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <CalendarDays className="text-accent" size={20} />
                  Próximos 7 Dias
                </h3>
                <button onClick={() => navigate('/transacoes')} className="text-xs text-accent font-bold hover:underline">Ver todas</button>
              </div>
              <div className="space-y-4">
                {upcomingTransactions.length === 0 ? (
                  <div className="py-12 text-center text-text-secondary text-sm">
                    Nenhuma conta vencendo nos próximos 7 dias para este filtro.
                  </div>
                ) : (
                  upcomingTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 bg-bg/50 rounded-2xl border border-border group hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-400/10 rounded-xl flex items-center justify-center text-amber-400">
                          <Clock size={20} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-text-primary">{tx.description}</div>
                          <div className="text-[10px] text-text-secondary uppercase">Vence em: {tx.dateCompetence.toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-bold text-danger">-{formatCurrency(tx.amount)}</div>
                        <ChevronRight size={16} className="text-text-secondary group-hover:text-accent transition-colors" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* AI Insights Card */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-indigo-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-surface border border-border rounded-3xl p-8 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 rounded-xl text-accent">
                  <Sparkles size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Inteligência Financeira (CFO AI)</h3>
                  <p className="text-xs text-text-secondary">Análise automática da saúde do seu negócio</p>
                </div>
              </div>
              
              {aiLoading ? (
                <div className="space-y-3">
                  <div className="h-4 bg-bg/50 rounded-full w-3/4 animate-pulse" />
                  <div className="h-4 bg-bg/50 rounded-full w-1/2 animate-pulse" />
                  <div className="h-4 bg-bg/50 rounded-full w-2/3 animate-pulse" />
                </div>
              ) : (
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {aiAnalysis || "Aguardando processamento dos dados..."}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ title, value, trend, icon, highlight }: any) {
  const colors: any = {
    success: 'border-success/20 bg-success/5',
    danger: 'border-danger/20 bg-danger/5',
    default: 'bg-surface border-border'
  };

  return (
    <div className={cn(
      "p-6 rounded-3xl border shadow-lg transition-all hover:scale-[1.02]",
      highlight ? colors[highlight] : colors.default
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-bg/50 rounded-xl border border-border">{icon}</div>
        <span className={cn(
          "text-[10px] font-bold px-2 py-0.5 rounded-full",
          trend.startsWith('+') ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
        )}>
          {trend}
        </span>
      </div>
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-text-secondary mb-1">{title}</div>
        <div className="text-2xl font-bold tracking-tight">{formatCurrency(value)}</div>
      </div>
    </div>
  );
}
