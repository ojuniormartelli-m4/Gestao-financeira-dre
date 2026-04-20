import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { financeService } from '../financeService';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  PlusCircle, 
  Trash2, 
  AlertCircle,
  Calendar,
  DollarSign,
  TrendingUp,
  RefreshCw,
  X,
  CreditCard as CreditCardIcon
} from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';

export function CreditCardsPage() {
  const { user } = useAuth();
  const { companyId, bankAccounts, refreshData } = useCompany();
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
      setCards(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    try {
      await financeService.salvarCartaoCredito(companyId, {
        ...formData,
        limit: Number(formData.limit),
        closingDay: Number(formData.closingDay),
        dueDay: Number(formData.dueDay)
      });
      await loadCards();
      setIsModalOpen(false);
      setFormData({ name: '', limit: '', closingDay: '10', dueDay: '17', bankAccountId: '' });
      refreshData(); // Refresh context to update CC list everywhere
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar cartão.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!companyId || !confirm('Deseja realmente excluir este cartão?')) return;
    try {
      await financeService.excluirCartaoCredito(companyId, id);
      await loadCards();
      refreshData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir cartão.');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-text-secondary text-sm">Gerencie seus limites e dias de vencimento</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-accent text-bg font-bold px-6 py-3 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-accent/20"
        >
          <PlusCircle size={20} />
          Novo Cartão
        </button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-accent animate-spin" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-surface rounded-[2.5rem] border border-border text-center space-y-4">
          <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center">
            <CreditCard size={40} className="text-accent" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-bold">Nenhum cartão cadastrado</h3>
            <p className="text-text-secondary text-sm">Cadastre seus cartões de crédito para ter o controle das suas faturas e limites.</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="text-accent font-bold hover:underline underline-offset-4"
          >
            Cadastrar primeiro cartão
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={card.id} 
              className="bg-surface border border-border rounded-3xl p-6 shadow-xl relative group overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
              
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-accent/10 rounded-2xl text-accent">
                    <CreditCardIcon size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{card.name}</h3>
                    <div className="text-[10px] text-text-secondary uppercase font-bold tracking-widest leading-none">Cartão de Crédito</div>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(card.id)}
                  className="p-2 text-text-secondary hover:text-danger hover:bg-danger/5 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-6 relative z-10">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase">
                      <Calendar size={12} className="text-accent" />
                      Vencimento
                    </div>
                    <div className="text-sm font-bold">Dia {card.dueDay}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-secondary uppercase">
                      <TrendingUp size={12} className="text-accent" />
                      Fechamento
                    </div>
                    <div className="text-sm font-bold">Dia {card.closingDay}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border space-y-1.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-text-secondary uppercase">
                    <span>Limite Disponível</span>
                    <span className="text-accent font-black tracking-tighter">100%</span>
                  </div>
                  <div className="h-2 bg-bg rounded-full overflow-hidden border border-border">
                    <div className="h-full bg-accent rounded-full transition-all w-full" />
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-text-secondary">Limite Total:</span>
                    <span className="text-sm font-black text-text-primary">{formatCurrency(card.limit)}</span>
                  </div>
                </div>

                <div className="p-4 bg-bg border border-border rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-success" />
                    <span className="text-xs font-bold text-text-secondary">Conta de Débito</span>
                  </div>
                  <span className="text-xs font-bold truncate max-w-[120px]">
                    {bankAccounts.find(b => b.id === card.bankAccountId)?.name || 'N/A'}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal Novo Cartão */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8"
          >
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold">Configurar Cartão</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest">Nome do Cartão</label>
                <input 
                  required
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Nubank Black, Inter Corporate..."
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest">Limite Total</label>
                  <input 
                    required
                    type="number" 
                    value={formData.limit}
                    onChange={e => setFormData({ ...formData, limit: e.target.value })}
                    placeholder="0,00"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest">Débito em Conta</label>
                  <select 
                    required
                    value={formData.bankAccountId}
                    onChange={e => setFormData({ ...formData, bankAccountId: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                  >
                    <option value="">Selecionar...</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest">Dia Fechamento</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    max="31"
                    value={formData.closingDay}
                    onChange={e => setFormData({ ...formData, closingDay: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold uppercase text-text-secondary ml-1 tracking-widest">Dia Vencimento</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    max="31"
                    value={formData.dueDay}
                    onChange={e => setFormData({ ...formData, dueDay: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                  />
                </div>
              </div>

              <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-accent shrink-0" size={18} />
                <p className="text-[10px] font-bold text-text-secondary leading-normal">
                  Estas informações serão usadas para sugerir automaticamente a data de pagamento nos seus lançamentos.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full py-4 bg-accent text-bg rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {submitting ? 'Salvando...' : 'Salvar Cartão'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
