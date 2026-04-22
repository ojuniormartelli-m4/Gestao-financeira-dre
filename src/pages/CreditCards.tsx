import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { financeService } from '../financeService';
import { motion, AnimatePresence } from 'motion/react';
import { TransactionType, TransactionStatus } from '../types';
import { 
  PlusCircle, 
  Trash2, 
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  RefreshCw,
  X,
  CreditCard as CreditCardIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit3,
  FileText,
  Search,
  Plus
} from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { format, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function CreditCardsPage() {
  const { user } = useAuth();
  const { companyId, bankAccounts, refreshData, categories, costCenters, contacts } = useCompany();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [editCard, setEditCard] = useState<any>(null);
  const [filterDate, setFilterDate] = useState(new Date());
  
  // Transaction Modal State
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    accountId: '',
    amount: 0,
    datePayment: format(new Date(), 'yyyy-MM-dd')
  });
  
  const [formData, setFormData] = useState({
    name: '',
    limit: '',
    closingDay: '10',
    dueDay: '17',
    bankAccountId: ''
  });

  const loadCards = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await financeService.buscarCartoesCredito(companyId);
      
      const cardsWithBalance = await Promise.all((data || []).map(async (card: any) => {
        const transactions = await financeService.buscarTransacoesPorCartao(companyId, card.id);
        const currentBalance = transactions
          .filter(tx => tx.status === 'PENDING')
          .reduce((sum, tx) => sum + tx.amount, 0);
        return { ...card, currentBalance };
      }));

      setCards(cardsWithBalance);
      if (cardsWithBalance.length > 0 && !selectedCardId) {
        setSelectedCardId(cardsWithBalance[0].id);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCards();
    if (bankAccounts.length === 0) refreshData();
  }, [companyId]);

  const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);

  const nextClosingInfo = useMemo(() => {
    if (!selectedCard) return null;
    const now = new Date();
    
    // Próximo Fechamento
    const closing = new Date(now.getFullYear(), now.getMonth(), selectedCard.closingDay);
    if (now.getDate() > selectedCard.closingDay) {
      closing.setMonth(closing.getMonth() + 1);
    }
    
    // Vencimento correspondente
    const due = new Date(closing);
    due.setDate(selectedCard.dueDay);
    if (selectedCard.dueDay <= selectedCard.closingDay) {
        due.setMonth(due.getMonth() + 1);
    }
    
    return { closing, due };
  }, [selectedCard]);

  const [statementTransactions, setStatementTransactions] = useState<any[]>([]);
  const [loadingStatement, setLoadingStatement] = useState(false);

  useEffect(() => {
    const loadStatement = async () => {
      if (!selectedCardId || !companyId) return;
      setLoadingStatement(true);
      try {
        const month = filterDate.getMonth() + 1;
        const year = filterDate.getFullYear();
        const data = await financeService.buscarTransacoesPorCartao(companyId, selectedCardId, month, year);
        setStatementTransactions(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingStatement(false);
      }
    };
    loadStatement();
  }, [selectedCardId, filterDate, companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;

    try {
      const cardData = {
        name: formData.name,
        limit: Number(formData.limit),
        closingDay: Number(formData.closingDay),
        dueDay: Number(formData.dueDay),
        bankAccountId: formData.bankAccountId
      };

      if (editCard) {
        await financeService.salvarCartaoCredito(companyId, { ...cardData, id: editCard.id });
      } else {
        await financeService.salvarCartaoCredito(companyId, cardData);
      }

      setIsModalOpen(false);
      setEditCard(null);
      setFormData({ name: '', limit: '', closingDay: '10', dueDay: '17', bankAccountId: '' });
      loadCards();
      refreshData();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar cartão.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!companyId || !confirm('Deseja realmente excluir este cartão?')) return;
    try {
      await financeService.excluirCartaoCredito(companyId, id);
      loadCards();
      refreshData();
      if (selectedCardId === id) setSelectedCardId(cards.find(c => c.id !== id)?.id || null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir cartão.');
    }
  };

  const invoiceSummary = useMemo(() => {
    if (!statementTransactions) return { total: 0, pending: 0, paid: 0 };
    return {
      total: statementTransactions.reduce((acc, curr) => acc + curr.amount, 0),
      pending: statementTransactions.filter(t => t.status === 'PENDING').reduce((s, t) => s + t.amount, 0),
      paid: statementTransactions.filter(t => t.status === 'PAID').reduce((s, t) => s + t.amount, 0)
    };
  }, [statementTransactions]);

  const isInvoiceNearDue = useMemo(() => {
    if (!nextClosingInfo || !selectedCard) return false;
    const dueThisMonth = new Date(filterDate.getFullYear(), filterDate.getMonth(), selectedCard.dueDay);
    const diff = (dueThisMonth.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 5 && invoiceSummary.pending > 0;
  }, [nextClosingInfo, selectedCard, filterDate, invoiceSummary.pending]);

  const handlePayInvoice = async (data: any) => {
    if (!companyId || !selectedCardId) return;
    try {
      setLoadingStatement(true);
      const month = filterDate.getMonth() + 1;
      const year = filterDate.getFullYear();
      
      await financeService.pagarFaturaCartao(
        companyId,
        selectedCardId,
        month,
        year,
        data.accountId,
        data.amount,
        new Date(data.datePayment + 'T12:00:00')
      );
      
      setIsPaymentModalOpen(false);
      loadCards();
      const updatedTxs = await financeService.buscarTransacoesPorCartao(companyId, selectedCardId, month, year);
      setStatementTransactions(updatedTxs || []);
      refreshData();
    } catch (error) {
      console.error(error);
      alert('Erro ao processar pagamento da fatura.');
    } finally {
      setLoadingStatement(false);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 overflow-hidden">
      {/* Sidebar - Lista de Cartões */}
      <div className="w-80 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold tracking-tight">Meus Cartões</h2>
          <button 
            onClick={() => { setEditCard(null); setFormData({ name: '', limit: '', closingDay: '10', dueDay: '17', bankAccountId: '' }); setIsModalOpen(true); }}
            className="p-2 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-32">
          {loading ? (
            <div className="flex justify-center py-10"><RefreshCw className="animate-spin text-accent" /></div>
          ) : cards.length === 0 ? (
            <div className="p-6 bg-surface border border-border rounded-2xl text-center">
              <p className="text-sm text-text-secondary font-medium">Nenhum cartão.</p>
            </div>
          ) : (
            cards.map(card => (
              <button
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={cn(
                  "w-full p-4 rounded-3xl border transition-all text-left group relative overflow-hidden",
                  selectedCardId === card.id 
                    ? "bg-accent text-bg border-accent shadow-lg shadow-accent/20" 
                    : "bg-surface border-border hover:border-accent/40 text-text-primary"
                )}
              >
                <div className="flex items-center gap-3 mb-3 relative z-10">
                  <div className={cn(
                    "p-2 rounded-xl",
                    selectedCardId === card.id ? "bg-bg/20" : "bg-accent/10 text-accent"
                  )}>
                    <CreditCardIcon size={18} />
                  </div>
                  <span className="font-bold text-sm truncate">{card.name}</span>
                </div>
                
                <div className="space-y-1 relative z-10">
                  <div className="flex justify-between text-[10px] font-bold uppercase opacity-70">
                    <span>Fatura Atual</span>
                    <span>Limite Disp.</span>
                  </div>
                  <div className="flex justify-between font-black">
                    <span className="text-sm">{formatCurrency(card.currentBalance || 0)}</span>
                    <span className="text-xs opacity-80">{formatCurrency(card.limit - (card.currentBalance || 0))}</span>
                  </div>
                </div>

                <div className={cn(
                  "absolute top-0 right-0 w-20 h-20 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110 opacity-10",
                  selectedCardId === card.id ? "bg-bg" : "bg-accent"
                )} />
              </button>
            ))
          )}

          {selectedCard && (
            <div className="space-y-4 pt-4 border-t border-border mt-4">
              <div className="bg-surface border border-border rounded-3xl p-5 space-y-5 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Resumo do Período</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Total da Fatura</span>
                      <div className="text-xl font-black text-danger">{formatCurrency(invoiceSummary.total)}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Status</span>
                      <div className={cn(
                        "text-[9px] font-black uppercase px-2 py-1 rounded-md mt-1",
                        invoiceSummary.pending === 0 && invoiceSummary.total > 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                      )}>
                        {invoiceSummary.pending === 0 && invoiceSummary.total > 0 ? 'Paga' : 'Em Aberto'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Pagas</span>
                      <div className="text-xs font-black text-text-primary">{formatCurrency(invoiceSummary.paid)}</div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Pendentes</span>
                      <div className="text-xs font-black text-danger">{formatCurrency(invoiceSummary.pending)}</div>
                    </div>
                  </div>
                </div>

                  <div className="space-y-3 pt-4 border-t border-border">
                    {isInvoiceNearDue && (
                      <div className="flex items-center gap-2 bg-warning/5 text-warning p-3 rounded-2xl text-[9px] font-black uppercase border border-warning/10 mb-2">
                        <AlertCircle size={14} />
                        Fatura vence em breve!
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-text-secondary">
                      <span>Uso do Limite</span>
                      <span>{selectedCard.limit > 0 ? Math.round((selectedCard.currentBalance / selectedCard.limit) * 100) : 0}%</span>
                    </div>
                    <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full transition-all duration-500",
                          (selectedCard.currentBalance / selectedCard.limit) > 0.8 ? "bg-danger" : "bg-accent"
                        )}
                        style={{ width: `${selectedCard.limit > 0 ? Math.min((selectedCard.currentBalance / selectedCard.limit) * 100, 100) : 0}%` }} 
                      />
                    </div>
                    <div className="flex justify-between text-[9px] font-bold mt-1 text-text-secondary">
                       <span>Comprometido: {formatCurrency(selectedCard.currentBalance)}</span>
                       <span>Disp: {formatCurrency(selectedCard.limit - selectedCard.currentBalance)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Próx. Fechamento</span>
                      <div className="text-xs font-black text-text-primary">
                        {nextClosingInfo ? format(nextClosingInfo.closing, 'dd/MM', { locale: ptBR }) : '--/--'}
                      </div>
                    </div>
                    <div className="space-y-1 text-right">
                      <span className="text-[10px] font-bold uppercase text-text-secondary">Vencimento</span>
                      <div className={cn("text-xs font-black", isInvoiceNearDue ? "text-warning" : "text-text-primary")}>
                        {nextClosingInfo ? format(nextClosingInfo.due, 'dd/MM', { locale: ptBR }) : '--/--'}
                      </div>
                    </div>
                  </div>

                <div className="bg-bg/50 p-4 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <TrendingUp size={12} />
                    <span className="text-[10px] font-bold uppercase">Débito Automático</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-[10px] text-accent font-bold">
                      <DollarSign size={12} />
                    </div>
                    <span className="text-[12px] font-bold text-text-primary truncate">
                      {bankAccounts.find(b => b.id === selectedCard.bankAccountId)?.name || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

                <div className="p-4 bg-accent/5 border border-accent/10 rounded-3xl flex flex-col gap-3">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-accent text-center">Ações</h4>
                   <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => {
                          setEditCard(selectedCard);
                          setFormData({
                            name: selectedCard.name,
                            limit: String(selectedCard.limit),
                            closingDay: String(selectedCard.closingDay),
                            dueDay: String(selectedCard.dueDay),
                            bankAccountId: selectedCard.bankAccountId
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2.5 bg-surface border border-border rounded-xl text-[9px] font-black uppercase hover:bg-bg transition-colors"
                      >
                        Configurar
                      </button>
                      <button 
                        disabled={invoiceSummary.pending === 0}
                        onClick={() => {
                          setPaymentData({
                            accountId: selectedCard.bankAccountId || bankAccounts[0]?.id || '',
                            amount: invoiceSummary.pending,
                            datePayment: format(new Date(), 'yyyy-MM-dd')
                          });
                          setIsPaymentModalOpen(true);
                        }}
                        className={cn(
                          "p-2.5 bg-surface border border-border rounded-xl text-[9px] font-black uppercase hover:bg-bg transition-colors",
                          invoiceSummary.pending > 0 ? "text-success border-success/30 bg-success/5" : "opacity-50 cursor-not-allowed"
                        )}
                      >
                        Pagar Fatura
                      </button>
                   </div>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Detalhes e Extrato */}
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        {!selectedCard ? (
          <div className="flex-1 bg-surface border border-border rounded-[2.5rem] flex flex-col items-center justify-center text-center p-10">
            <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mb-4 text-accent">
              <CreditCardIcon size={40} />
            </div>
            <h3 className="text-lg font-bold">Selecione um cartão</h3>
            <p className="text-text-secondary text-sm max-w-xs">Escolha um cartão ao lado para gerir seus lançamentos e detalhes da fatura.</p>
          </div>
        ) : (
          <>
            {/* Header do Cartão Selecionado */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-accent/10 rounded-2xl text-accent">
                  <CreditCardIcon size={28} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight">{selectedCard.name}</h1>
                  <div className="flex items-center gap-4 mt-1">
                     <div className="flex items-center gap-1 text-xs font-bold text-text-secondary uppercase">
                       <Calendar size={14} className="text-accent" />
                       <span>Fecha dia {selectedCard.closingDay}</span>
                     </div>
                     <div className="flex items-center gap-1 text-xs font-bold text-text-secondary uppercase border-l border-border pl-4">
                       <DollarSign size={14} className="text-success" />
                       <span>Vence dia {selectedCard.dueDay}</span>
                     </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="bg-surface border border-border rounded-2xl p-1 flex items-center shadow-sm">
                   <button 
                    onClick={() => setFilterDate(subMonths(filterDate, 1))}
                    className="p-2 hover:bg-bg rounded-xl transition-colors"
                   >
                     <ChevronLeft size={18} />
                   </button>
                   <span className="px-4 text-sm font-black uppercase min-w-[140px] text-center text-text-primary">
                     {format(filterDate, 'MMMM yyyy', { locale: ptBR })}
                   </span>
                   <button 
                    onClick={() => setFilterDate(addMonths(filterDate, 1))}
                    className="p-2 hover:bg-bg rounded-xl transition-colors"
                   >
                     <ChevronRight size={18} />
                   </button>
                </div>
                
                <button 
                  onClick={() => setIsTxModalOpen(true)}
                  className="flex items-center gap-2 bg-accent text-bg font-bold px-6 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20 ml-2"
                >
                  <PlusCircle size={20} />
                  Novo Gasto
                </button>

                <div className="relative group ml-2">
                  <button className="p-3 bg-surface border border-border rounded-xl text-text-secondary hover:text-text-primary transition-colors">
                    <MoreVertical size={20} />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-surface border border-border rounded-2xl shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all z-20">
                    <button 
                      onClick={() => {
                        setEditCard(selectedCard);
                        setFormData({
                          name: selectedCard.name,
                          limit: selectedCard.limit.toString(),
                          closingDay: selectedCard.closingDay.toString(),
                          dueDay: selectedCard.dueDay.toString(),
                          bankAccountId: selectedCard.bankAccountId
                        });
                        setIsModalOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg transition-colors text-sm font-bold first:rounded-t-2xl"
                    >
                      <Edit3 size={16} /> Editar Cartão
                    </button>
                    <button 
                      onClick={() => handleDelete(selectedCard.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-danger/10 text-danger transition-colors text-sm font-bold last:rounded-b-2xl"
                    >
                      <Trash2 size={16} /> Excluir Cartão
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              {/* Listagem de Transações */}
              <div className="h-full flex flex-col bg-surface border border-border rounded-[2.5rem] overflow-hidden shadow-sm">
                <div className="p-6 border-b border-border flex justify-between items-center bg-bg/10">
                   <div className="flex items-center gap-2">
                     <Search size={16} className="text-text-secondary" />
                     <span className="text-xs font-bold uppercase tracking-widest text-text-secondary">Compras de {format(filterDate, 'MMMM', { locale: ptBR })}</span>
                   </div>
                   <div className="flex items-center gap-4 text-xs font-bold">
                     <span className="text-text-secondary">Total: {formatCurrency(invoiceSummary.total)}</span>
                     <div className="px-3 py-1 bg-accent/10 text-accent rounded-full text-[10px] uppercase">
                       {invoiceSummary.total > 0 ? `${statementTransactions.length} Compra(s)` : 'Sem gastos'}
                     </div>
                   </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {loadingStatement ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <RefreshCw className="w-8 h-8 text-accent animate-spin mb-4" />
                      <p className="text-sm text-text-secondary font-medium">Buscando lançamentos...</p>
                    </div>
                  ) : statementTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center opacity-50 space-y-2 px-10">
                      <FileText size={48} className="text-text-secondary" />
                      <p className="text-sm font-bold">Nenhum gasto encontrado.</p>
                      <p className="text-[11px] max-w-xs">{format(filterDate, 'MMMM yyyy', { locale: ptBR })} não possui lançamentos registrados para este cartão.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/50">
                       {statementTransactions.map(tx => (
                         <div key={tx.id} className="p-5 flex items-center justify-between group hover:bg-bg/40 transition-colors">
                           <div className="flex items-center gap-5">
                             <div className={cn(
                               "w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg",
                               tx.status === 'PAID' ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                             )}>
                               {tx.description[0].toUpperCase()}
                             </div>
                             <div>
                               <div className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">{tx.description}</div>
                               <div className="flex items-center gap-2 mt-1">
                                 <span className="text-[10px] font-bold text-text-secondary uppercase">{formatDate(tx.dateCompetence)}</span>
                                 <span className="w-1 h-1 bg-border rounded-full" />
                                 <span className="text-[10px] font-bold text-accent uppercase">{tx.categoryName}</span>
                               </div>
                             </div>
                           </div>

                           <div className="flex items-center gap-6">
                              <div className="text-right">
                                <div className="text-sm font-black text-danger">-{formatCurrency(tx.amount)}</div>
                                <div className={cn(
                                  "text-[9px] font-bold uppercase mt-1",
                                  tx.status === 'PAID' ? "text-success" : "text-warning"
                                )}>
                                  {tx.status === 'PAID' ? 'Pago' : 'No Boleto'}
                                </div>
                              </div>
                              <button className="p-2 opacity-0 group-hover:opacity-100 hover:bg-bg rounded-xl transition-all text-text-secondary">
                                <MoreVertical size={16} />
                              </button>
                           </div>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal - Cadastro de Cartão */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-md" 
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">{editCard ? 'Editar Cartão' : 'Novo Cartão'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest leading-none">Nome do Cartão (Ex: Nubank, Visa...)</label>
                  <div className="relative">
                    <input 
                      required
                      type="text" 
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Identificação do cartão"
                      className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
                    />
                    <CreditCardIcon className="absolute right-5 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest leading-none">Limite do Cartão (R$)</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    value={formData.limit}
                    onChange={(e) => setFormData({ ...formData, limit: e.target.value })}
                    placeholder="0,00"
                    className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest leading-none">Dia Fechamento</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      max="31"
                      value={formData.closingDay}
                      onChange={(e) => setFormData({ ...formData, closingDay: e.target.value })}
                      placeholder="Ex: 5"
                      className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest leading-none">Dia Vencimento</label>
                    <input 
                      required
                      type="number" 
                      min="1"
                      max="31"
                      value={formData.dueDay}
                      onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                      placeholder="Ex: 15"
                      className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest leading-none">Conta Bancária vinculada (Débito)</label>
                  <select 
                    required
                    value={formData.bankAccountId}
                    onChange={(e) => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none shadow-inner"
                  >
                    <option value="">Selecione uma conta...</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>{account.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-4 bg-bg border border-border rounded-2xl text-sm font-bold hover:bg-surface transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-accent text-bg rounded-2xl text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-accent/20"
                  >
                    {editCard ? 'Atualizar' : 'Salvar Cartão'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Especial de Lançamento de Gasto no Cartão */}
      <AnimatePresence>
        {isTxModalOpen && selectedCard && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-md" 
              onClick={() => setIsTxModalOpen(false)}
            />
            <CreditCardTransactionForm 
              selectedCard={selectedCard}
              onClose={() => setIsTxModalOpen(false)}
              onSuccess={() => {
                setIsTxModalOpen(false);
                loadCards();
                const month = filterDate.getMonth() + 1;
                const year = filterDate.getFullYear();
                financeService.buscarTransacoesPorCartao(companyId!, selectedCard!.id, month, year).then(setStatementTransactions);
              }}
              companyId={companyId!}
              categories={categories}
              costCenters={costCenters}
              contacts={contacts}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Invoice Payment Modal */}
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handlePayInvoice}
        card={selectedCard}
        totalAmount={paymentData.amount}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}

function PaymentModal({ isOpen, onClose, onConfirm, card, totalAmount, bankAccounts }: any) {
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState(0);
  const [datePayment, setDatePayment] = useState('');

  useEffect(() => {
    if (isOpen) {
      setAccountId(card?.bankAccountId || bankAccounts[0]?.id || '');
      setAmount(totalAmount);
      setDatePayment(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [isOpen, card, totalAmount, bankAccounts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <h2 className="text-xl font-bold">Pagar Fatura</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4 bg-accent/5 p-4 rounded-2xl border border-accent/10">
            <div className="p-3 bg-accent/10 text-accent rounded-xl">
              <CreditCardIcon size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-text-secondary uppercase">Cartão</div>
              <div className="text-lg font-black">{card?.name}</div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-secondary uppercase ml-1">Conta de Origem</label>
              <select 
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-bg border border-border rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-accent transition-colors appearance-none"
              >
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name} (Saldo: {formatCurrency(b.currentBalance)})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Valor</label>
                <input 
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="w-full bg-bg border border-border rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-secondary uppercase ml-1">Data</label>
                <input 
                  type="date"
                  value={datePayment}
                  onChange={e => setDatePayment(e.target.value)}
                  className="w-full bg-bg border border-border rounded-2xl py-3.5 px-4 text-sm focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button 
              onClick={onClose}
              className="flex-1 px-6 py-4 border border-border rounded-2xl font-bold text-text-secondary hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={() => onConfirm({ accountId, amount, datePayment })}
              className="flex-1 bg-success text-bg px-6 py-4 rounded-2xl font-bold hover:opacity-90 transition-all shadow-xl shadow-success/20"
            >
              Confirmar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Sub-componente para o Modal de Transação Simplificado de CC
function CreditCardTransactionForm({ 
  selectedCard, 
  onClose, 
  onSuccess, 
  companyId, 
  categories, 
  costCenters, 
  contacts 
}: any) {
  const [loading, setLoading] = useState(false);
  const [txData, setTxData] = useState({
    description: '',
    amount: '',
    categoryId: '',
    dateCompetence: format(new Date(), 'yyyy-MM-dd'),
    costCenterId: '',
    contactId: '',
    datePayment: '' // Vencimento da fatura (calculado)
  });

  // Cálculo automático da data de pagamento (vencimento da fatura)
  useEffect(() => {
    if (txData.dateCompetence && selectedCard) {
      const competence = new Date(txData.dateCompetence + 'T12:00:00');
      const compDay = competence.getDate();
      let dueDate = new Date(competence);
      
      if (compDay > selectedCard.closingDay) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }
      dueDate.setDate(selectedCard.dueDay);
      
      setTxData(prev => ({ 
        ...prev, 
        datePayment: format(dueDate, 'yyyy-MM-dd') 
      }));
    }
  }, [txData.dateCompetence, selectedCard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const transactionData = {
        description: txData.description,
        amount: Number(txData.amount),
        categoryId: txData.categoryId,
        bankAccountId: selectedCard.bankAccountId, 
        type: 'EXPENSE' as TransactionType,
        status: 'PENDING' as TransactionStatus,
        dateCompetence: new Date(txData.dateCompetence + 'T12:00:00'),
        datePayment: new Date(txData.datePayment + 'T12:00:00'),
        costCenterId: txData.costCenterId || undefined,
        contactId: txData.contactId || undefined,
        creditCardId: selectedCard.id,
        companyId,
        isRecurring: false
      };

      await financeService.adicionarTransacao(companyId, transactionData);
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar lançamento.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      className="relative w-full max-w-lg bg-surface border border-border rounded-[2.5rem] shadow-2xl overflow-hidden"
    >
      <div className="p-8 border-b border-border flex justify-between items-center bg-bg/50">
        <div>
          <h2 className="text-2xl font-bold">Lançar no {selectedCard.name}</h2>
          <p className="text-[10px] text-text-secondary uppercase font-black tracking-widest mt-1.5 opacity-80">Nova Despesa de Crédito</p>
        </div>
        <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl text-text-secondary transition-colors">
          <X size={22} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-5">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Descrição</label>
          <input 
            required
            autoFocus
            type="text" 
            value={txData.description}
            onChange={(e) => setTxData({ ...txData, description: e.target.value })}
            placeholder="Ex: Supermercado, Almoço..."
            className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Valor (R$)</label>
            <input 
              required
              type="number" 
              step="0.01"
              value={txData.amount}
              onChange={(e) => setTxData({ ...txData, amount: e.target.value })}
              placeholder="0,00"
              className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm font-bold focus:outline-none focus:border-accent transition-colors shadow-inner"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Categoria</label>
            <select 
              required
              value={txData.categoryId}
              onChange={(e) => setTxData({ ...txData, categoryId: e.target.value })}
              className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none shadow-inner"
            >
              <option value="">Selecione...</option>
              {categories.filter((c: any) => c.type === 'EXPENSE').map((cat: any) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Data da Compra</label>
            <input 
              required
              type="date" 
              value={txData.dateCompetence}
              onChange={(e) => setTxData({ ...txData, dateCompetence: e.target.value })}
              className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors shadow-inner"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest opacity-60">Previsão Fatura</label>
            <div className="w-full bg-surface border border-dashed border-border rounded-2xl py-4 px-5 text-sm text-text-secondary flex items-center justify-between font-bold opacity-70 cursor-not-allowed">
               <span className="flex items-center gap-2">
                 <Calendar size={14} className="text-accent" />
                 {txData.datePayment ? format(new Date(txData.datePayment + 'T12:00:00'), 'dd/MM/yyyy') : '--/--/----'}
               </span>
               <TrendingUp size={14} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Centro de Custo</label>
            <select 
              value={txData.costCenterId}
              onChange={(e) => setTxData({ ...txData, costCenterId: e.target.value })}
              className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none shadow-inner"
            >
              <option value="">Opcional...</option>
              {costCenters.map((cc: any) => (
                <option key={cc.id} value={cc.id}>{cc.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-text-secondary uppercase ml-1 tracking-widest">Fornecedor</label>
            <select 
              value={txData.contactId}
              onChange={(e) => setTxData({ ...txData, contactId: e.target.value })}
              className="w-full bg-bg border border-border rounded-2xl py-4 px-5 text-sm focus:outline-none focus:border-accent transition-colors appearance-none shadow-inner"
            >
              <option value="">Opcional...</option>
              {contacts.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-bg border border-border rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-surface transition-colors"
          >
            Cancelar
          </button>
          <button 
            disabled={loading}
            type="submit"
            className="flex-1 py-4 bg-accent text-bg rounded-2xl text-[11px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Plus size={18} />}
            Confirmar Gasto
          </button>
        </div>
      </form>
    </motion.div>
  );
}
