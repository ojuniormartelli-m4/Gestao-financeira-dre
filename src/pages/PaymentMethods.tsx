import { useState, useEffect } from 'react';
import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { financeService } from '../financeService';
import { 
  Plus, 
  Trash2, 
  CreditCard,
  RefreshCw,
  Search,
  X,
  CreditCard as PaymentIcon
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LoginPage } from './Login';

export function PaymentMethodsPage() {
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newData, setNewData] = useState({ name: '', active: true });
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user, loading: authLoading } = useAuth();
  const companyId = 'm4-digital';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await financeService.buscarFormasPagamento(companyId);
      setPaymentMethods(data || []);
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newData.name) return;
    try {
      await financeService.salvarFormaPagamento(companyId, newData);
      setNewData({ name: '', active: true });
      setIsAdding(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta forma de pagamento?')) return;
    try {
      await financeService.excluirFormaPagamento(id);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir item.');
    }
  };

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>;
  if (!user) return <LoginPage />;

  const filteredData = paymentMethods.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Formas de Pagamento</h1>
          <p className="text-text-secondary text-sm">Configure como seus clientes pagam e como você paga seus fornecedores</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          className="flex items-center gap-2 bg-accent hover:opacity-90 text-bg px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20"
        >
          <Plus size={20} />
          Nova Forma de Pagamento
        </button>
      </header>

      <div className="flex items-center gap-4 bg-surface p-4 rounded-2xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Ex: Cartão de Crédito, PIX, Boleto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-surface rounded-3xl border border-border p-6 shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Adicionar Forma de Pagamento</h3>
              <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="max-w-md space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nome da Forma de Pagamento</label>
                <input 
                  required
                  type="text" 
                  value={newData.name} 
                  onChange={e => setNewData({...newData, name: e.target.value})} 
                  placeholder="Ex: Dinheiro, PIX, Cartão..." 
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none" 
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accent text-bg rounded-xl text-sm font-bold">Salvar</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-10"><RefreshCw className="animate-spin text-accent" /></div>
        ) : filteredData.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-surface rounded-3xl border border-dashed border-border text-text-secondary italic">
            Nenhuma forma de pagamento cadastrada.
          </div>
        ) : (
          filteredData.map(item => (
            <div key={item.id} className="p-5 bg-surface rounded-2xl border border-border flex items-center justify-between group hover:border-accent/30 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent">
                  <CreditCard size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-text-primary">{item.name}</div>
                  <div className="text-[9px] font-bold text-text-secondary uppercase tracking-widest">Ativo</div>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(item.id)} 
                className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
