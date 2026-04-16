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
  const { companyConfig } = useCompany();
  const [dre, setDre] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date());
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const { user, loading: authLoading } = useAuth();
  const companyId = 'minha-empresa-demo';

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
      const [result, banks] = await Promise.all([
        gerarDRE(companyId, month, year, selectedBankId !== 'all' ? selectedBankId : undefined),
        financeService.buscarContasBancarias(companyId)
      ]);
      setDre(result);
      setBankAccounts(banks || []);
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
  }, [filterDate, selectedBankId, user, authLoading]);

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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-surface p-4 rounded-2xl border border-border w-fit shadow-sm">
        <div className="flex items-center gap-2">
          <Calendar className="text-accent" size={20} />
          <input 
            type="month" 
            value={format(filterDate, 'yyyy-MM')}
            onChange={(e) => setFilterDate(new Date(e.target.value + '-02'))}
            className="bg-transparent border-none text-sm font-bold focus:outline-none text-text-primary"
          />
        </div>
        <div className="h-6 w-px bg-border hidden md:block" />
        <div className="flex items-center gap-2">
          <Wallet className="text-accent" size={20} />
          <select 
            value={selectedBankId}
            onChange={(e) => setSelectedBankId(e.target.value)}
            className="bg-transparent border-none text-sm font-bold focus:outline-none text-text-primary appearance-none cursor-pointer"
          >
            <option value="all">Todas as Contas</option>
            {bankAccounts.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
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
          className="bg-surface rounded-3xl border border-border shadow-2xl overflow-hidden"
        >
          {/* Header do Relatório */}
          <div className="p-8 border-b border-border bg-bg/30 flex justify-between items-end">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-2">Relatório de Competência</div>
              <h2 className="text-2xl font-bold">Resultado do Exercício</h2>
              <p className="text-text-secondary text-sm mt-1">Período: {format(filterDate, 'MMMM yyyy')}</p>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-text-secondary mb-1">Status</div>
              <div className="px-3 py-1 bg-success/10 text-success border border-success/20 rounded-full text-[10px] font-bold uppercase">Consolidado</div>
            </div>
          </div>

          {/* Corpo do Relatório */}
          <div className="p-8 space-y-1">
            <DREReportRow label="RECEITA BRUTA OPERACIONAL" value={dre.GROSS_REVENUE} type="total" />
            <DREReportRow label="(-) Deduções e Impostos" value={dre.TAX} type="sub" indent />
            
            <div className="h-4" />
            <DREReportRow label="RECEITA LÍQUIDA" value={dre.netRevenue} type="main" />
            <DREReportRow label="(-) Custos Variáveis (CPV/CMV)" value={dre.VARIABLE_COST} type="sub" indent />
            
            <div className="h-4" />
            <DREReportRow label="MARGEM DE CONTRIBUIÇÃO" value={dre.contributionMargin} type="main" color="text-accent" />
            <DREReportRow label="(-) Despesas Fixas Operacionais" value={dre.FIXED_COST} type="sub" indent />
            
            <div className="h-4" />
            <DREReportRow label="EBITDA (LAJIDA)" value={dre.ebitda} type="main" />
            <DREReportRow label="(-) Resultado Não Operacional" value={dre.NON_OPERATING} type="sub" indent />
            
            <div className="h-8" />
            <div className="bg-bg/50 p-6 rounded-2xl border border-border">
              <DREReportRow 
                label="LUCRO / PREJUÍZO LÍQUIDO" 
                value={dre.netProfit} 
                type="final" 
                color={dre.netProfit >= 0 ? 'text-success' : 'text-danger'} 
              />
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

function DREReportRow({ label, value, type, indent, color }: any) {
  const styles = {
    total: "text-sm font-bold text-text-primary",
    main: "text-base font-bold text-text-primary border-b border-border/30 pb-2 mb-2",
    sub: "text-sm text-text-secondary",
    final: "text-xl font-black tracking-tight"
  };

  return (
    <div className={cn(
      "flex justify-between items-center py-2",
      indent && "pl-8",
      (styles as any)[type]
    )}>
      <span>{label}</span>
      <span className={cn(color)}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}
