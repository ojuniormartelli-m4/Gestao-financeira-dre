import { useState, useEffect } from 'react';
import { gerarDRE, financeService } from '../financeService';
import { cn, formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { Calendar, Download, Printer, Info, Lock, RefreshCw, FileText, Wallet } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { useFilter } from '../contexts/FilterContext';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LoginPage } from './Login';

export function DREPage() {
  const { selectedBankId, setSelectedBankId } = useFilter();
  const { companyConfig, companyId } = useCompany();
  const [dre, setDre] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date());
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [selectedCostCenterId, setSelectedCostCenterId] = useState('all');
  const { user, loading: authLoading } = useAuth();

  const exportToPDF = () => {
    if (!dre) return;
    setExporting(true);
    try {
      const doc = new jsPDF();
      const dateStr = format(filterDate, 'MMMM yyyy');
      const bankName = selectedBankId === 'all' ? 'Todas as Contas' : bankAccounts.find(b => b.id === selectedBankId)?.name || 'Conta Específica';
      const companyName = companyConfig?.name || 'FinScale';
      
      doc.setFontSize(20);
      doc.setTextColor(0, 0, 0); // Black
      doc.text(`${companyName} - Demonstrativo de Resultado (DRE)`, 14, 22);
      doc.setFontSize(12);
      doc.setTextColor(100, 100, 100); // Gray
      doc.text(`Período: ${dateStr}`, 14, 30);
      doc.text(`Empresa: ${companyId}`, 14, 37);
      doc.text(`Filtro: ${bankName}`, 14, 44);

      const tableData = [
        ['RECEITA BRUTA OPERACIONAL', formatCurrency(dre.GROSS_REVENUE)],
        ['(-) Deduções e Impostos', formatCurrency(dre.TAX)],
        ['RECEITA LÍQUIDA', formatCurrency(dre.netRevenue)],
        ['(-) Custos Variáveis', formatCurrency(dre.VARIABLE_COST)],
        ['MARGEM DE CONTRIBUIÇÃO', formatCurrency(dre.contributionMargin)],
        ['(-) Despesas Fixas', formatCurrency(dre.FIXED_COST)],
        ['EBITDA', formatCurrency(dre.ebitda)],
        ['LUCRO LÍQUIDO', formatCurrency(dre.netProfit)],
      ];

      autoTable(doc, {
        startY: 50,
        head: [['Descrição', 'Valor (R$)']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42] },
        styles: { fontSize: 10 },
        columnStyles: { 1: { halign: 'right' } }
      });

      doc.save(`DRE_${format(filterDate, 'yyyy_MM')}.pdf`);
    } catch (error) {
      console.error(error);
    } finally {
      setExporting(false);
    }
  };

  const loadDRE = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const month = filterDate.getMonth() + 1;
      const year = filterDate.getFullYear();
      const [result, banks, centers] = await Promise.all([
        gerarDRE(
          companyId, 
          month, 
          year, 
          selectedBankId !== 'all' ? selectedBankId : undefined,
          selectedCostCenterId !== 'all' ? selectedCostCenterId : undefined
        ),
        financeService.buscarContasBancarias(companyId),
        financeService.buscarCentrosCusto(companyId)
      ]);
      setDre(result);
      setBankAccounts(banks || []);
      setCostCenters(centers || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadDRE();
    }
  }, [filterDate, selectedBankId, selectedCostCenterId, user, authLoading]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {companyConfig?.logoUrl && (
            <img src={companyConfig.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-white p-1 border border-border" referrerPolicy="no-referrer" />
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{companyConfig?.name || 'DRE Gerencial'}</h1>
            <p className="text-text-secondary text-sm">Demonstração do Resultado do Exercício</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportToPDF}
            disabled={exporting || !dre}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            {exporting ? <RefreshCw size={18} className="animate-spin" /> : <FileText size={18} />}
            <span className="text-sm font-bold">Exportar PDF</span>
          </button>
        </div>
      </header>

      <div className="bg-surface rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="flex flex-wrap items-center gap-0">
          <div className="flex items-center gap-2 px-6 py-4 border-r border-border min-w-[200px]">
            <Calendar className="text-accent" size={18} />
            <input 
              type="month" 
              value={format(filterDate, 'yyyy-MM')}
              onChange={(e) => setFilterDate(new Date(e.target.value + '-02'))}
              className="bg-transparent border-none text-xs font-bold focus:outline-none text-text-primary uppercase tracking-tight"
            />
          </div>
          
          <div className="flex items-center gap-2 px-6 py-4 border-r border-border min-w-[200px]">
            <Wallet className="text-accent" size={18} />
            <select 
              value={selectedBankId}
              onChange={(e) => setSelectedBankId(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:outline-none text-text-primary appearance-none cursor-pointer pr-4"
            >
              <option value="all">Todas as Contas</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 px-6 py-4 min-w-[200px]">
            <div className="w-4 h-4 rounded bg-accent/10 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
            <select 
              value={selectedCostCenterId}
              onChange={(e) => setSelectedCostCenterId(e.target.value)}
              className="bg-transparent border-none text-xs font-bold focus:outline-none text-text-primary appearance-none cursor-pointer pr-4"
            >
              <option value="all">Todos C. Custos</option>
              {costCenters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-3xl border border-border">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-text-secondary font-medium">Gerando relatório contábil...</p>
        </div>
      ) : !dre ? (
        <div className="text-center py-20 bg-surface rounded-3xl border border-border italic text-text-secondary">
          Nenhum dado disponível para este período.
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface rounded-2xl border border-border shadow-xl overflow-hidden"
        >
          {/* Header do Relatório */}
          <div className="p-8 border-b border-border bg-bg/10 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent px-2 py-0.5 bg-accent/10 rounded">Competência Gerencial</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-success px-2 py-0.5 bg-success/10 rounded">Consolidado</span>
              </div>
              <h2 className="text-3xl font-black italic tracking-tight text-text-primary">Demonstrativo de Resultado</h2>
              <div className="flex items-center gap-4 mt-2">
                <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">{format(filterDate, 'MMMM yyyy')}</p>
                <div className="w-1 h-1 rounded-full bg-border" />
                <p className="text-text-secondary text-xs font-medium uppercase tracking-widest">{companyId}</p>
              </div>
            </div>
            <div className="hidden sm:block">
              <FileText className="text-border" size={48} strokeWidth={1} />
            </div>
          </div>

          {/* Corpo do Relatório */}
          <div className="p-8 space-y-px dre-print-container">
            {/* Headers de Tabela Estilo Receita 1 */}
            <div className="grid grid-cols-[1fr,auto] gap-4 mb-4 px-2">
              <span className="font-serif italic text-[11px] uppercase tracking-wider text-text-secondary opacity-50">Descrição de Conta</span>
              <span className="font-serif italic text-[11px] uppercase tracking-wider text-text-secondary opacity-50 text-right">Valor em BRL</span>
            </div>

            <DREReportRow label="RECEITA BRUTA OPERACIONAL" value={dre.GROSS_REVENUE} type="total" details={dre.groups.GROSS_REVENUE} />
            <DREReportRow label="(-) Deduções e Impostos" value={dre.TAX} type="sub" indent details={dre.groups.TAX} />
            
            <div className="h-6" />
            <DREReportRow label="RECEITA LÍTQUIDA" value={dre.netRevenue} type="main" />
            <DREReportRow label="(-) Custos Variáveis (CPV/CMV)" value={dre.VARIABLE_COST} type="sub" indent details={dre.groups.VARIABLE_COST} />
            
            <div className="h-6" />
            <DREReportRow label="MARGEM DE CONTRIBUIÇÃO" value={dre.contributionMargin} type="main" color="text-accent" />
            <DREReportRow label="(-) Despesas Fixas Operacionais" value={dre.FIXED_COST} type="sub" indent details={dre.groups.FIXED_COST} />
            
            <div className="h-6" />
            <DREReportRow label="EBITDA (LAJIDA)" value={dre.ebitda} type="main" />
            <DREReportRow label="(-) Resultado Não Operacional" value={dre.NON_OPERATING} type="sub" indent details={dre.groups.NON_OPERATING} />
            <DREReportRow label="(-) Investimentos" value={dre.INVESTMENT} type="sub" indent details={dre.groups.INVESTMENT} />
            
            <div className="h-12" />
            <div className="bg-bg/40 p-1 rounded-xl border border-border">
              <div className="p-6 bg-surface rounded-lg border border-border shadow-inner">
                <DREReportRow 
                  label="LUCRO / PREJUÍZO LÍQUIDO" 
                  value={dre.netProfit} 
                  type="final" 
                  color={dre.netProfit >= 0 ? 'text-success' : 'text-danger'} 
                />
              </div>
            </div>
            
            <div className="hidden print:block mt-20 pt-10 border-t border-border text-center">
              <p className="text-sm font-bold text-text-secondary uppercase tracking-widest">Desenvolvido por M4 Marketing Digital</p>
            </div>
          </div>

          {/* Footer do Relatório */}
          <div className="p-6 bg-bg/20 border-t border-border flex items-center gap-3">
            <Info size={16} className="text-accent" />
            <p className="text-[11px] text-text-secondary italic">
              Este relatório segue o regime de competência gerencial. Valores podem divergir do fluxo de caixa real devido a prazos de pagamento.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function DREReportRow({ label, value, type, indent, color, details }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const styles = {
    total: "text-sm font-bold text-text-primary",
    main: "text-base font-bold text-text-primary border-b border-border/30 pb-2 mb-2",
    sub: "text-sm text-text-secondary",
    final: "text-xl font-black tracking-tight"
  };

  const hasDetails = details && Object.keys(details).length > 0;

  return (
    <div className="flex flex-col">
      <div 
        className={cn(
          "flex justify-between items-center py-2",
          indent && "pl-8",
          (styles as any)[type],
          hasDetails && "cursor-pointer hover:bg-white/5 rounded-lg px-2 -mx-2 transition-colors"
        )}
        onClick={() => hasDetails && setIsOpen(!isOpen)}
      >
        <span className="flex items-center gap-2">
          {label}
          {hasDetails && (
            <span className={cn("text-[8px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent transition-transform", isOpen && "rotate-180")}>
              ▼
            </span>
          )}
        </span>
        <span className={cn(color)}>
          {formatCurrency(value)}
        </span>
      </div>
      
      {isOpen && hasDetails && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="pl-12 space-y-1 mb-2 border-l border-border/30 ml-8 md:ml-12"
        >
          {Object.entries(details).map(([catId, amount]: [string, any]) => (
            <div key={catId} className="flex justify-between text-[11px] text-text-secondary py-1">
              <span>{catId}</span>
              <span>{formatCurrency(amount)}</span>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
