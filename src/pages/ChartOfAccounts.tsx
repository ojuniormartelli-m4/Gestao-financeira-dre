import { useState } from 'react';
import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { financeService } from '../financeService';
import { ChartOfAccount, DREGroup } from '../types';
import { 
  Plus, 
  Trash2, 
  Tag, 
  RefreshCw,
  Search,
  X,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ChartOfAccountsPage() {
  const { 
    companyId, 
    categories, 
    loading: companyLoading, 
    refreshData 
  } = useCompany();
  
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newData, setNewData] = useState({ 
    name: '', 
    type: 'EXPENSE' as 'REVENUE' | 'EXPENSE', 
    dreGroup: 'FIXED_COST' as DREGroup 
  });
  
  const { user, loading: authLoading } = useAuth();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newData.name || !companyId) return;
    setLoading(true);
    try {
      await financeService.salvarCategoria(companyId, {
        ...newData,
        id: editingId || undefined
      });
      setNewData({ name: '', type: 'EXPENSE', dreGroup: 'FIXED_COST' });
      setIsAdding(false);
      setEditingId(null);
      await refreshData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    setLoading(true);
    try {
      await financeService.excluirCategoria(companyId, id);
      await refreshData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir categoria. Pode haver transações vinculadas.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cat: ChartOfAccount) => {
    setNewData({
      name: cat.name,
      type: cat.type,
      dreGroup: cat.dreGroup as DREGroup
    });
    setEditingId(cat.id);
    setIsAdding(true);
  };

  if (authLoading || (companyLoading && categories.length === 0)) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>;

  const filteredData = categories.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const revenues = filteredData.filter(c => c.type === 'REVENUE');
  const expenses = filteredData.filter(c => c.type === 'EXPENSE');

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plano de Contas</h1>
          <p className="text-text-secondary text-sm">Classifique suas receitas e despesas para relatórios precisos</p>
        </div>
        <button 
          onClick={() => {
            setNewData({ name: '', type: 'EXPENSE', dreGroup: 'FIXED_COST' });
            setEditingId(null);
            setIsAdding(true);
          }} 
          className="flex items-center gap-2 bg-accent hover:opacity-90 text-bg px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20"
        >
          <Plus size={20} />
          Nova Categoria
        </button>
      </header>

      <div className="flex items-center gap-4 bg-surface p-4 rounded-2xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl mb-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg">{editingId ? 'Editar Categoria' : 'Adicionar Categoria'}</h3>
                <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
              </div>
              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nome</label>
                    <input 
                      required
                      type="text" 
                      value={newData.name} 
                      onChange={e => setNewData({...newData, name: e.target.value})} 
                      placeholder="Ex: Aluguel, Venda de Produtos..." 
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Tipo</label>
                    <select 
                      value={newData.type}
                      onChange={e => setNewData({...newData, type: e.target.value as any})}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none"
                    >
                      <option value="REVENUE">Receita</option>
                      <option value="EXPENSE">Despesa</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Grupo DRE</label>
                    <select 
                      value={newData.dreGroup}
                      onChange={e => setNewData({...newData, dreGroup: e.target.value as any})}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-sm focus:border-accent outline-none"
                    >
                      <option value="GROSS_REVENUE">Receita Bruta</option>
                      <option value="OPERATING_REVENUE">Receita Operacional</option>
                      <option value="VARIABLE_COST">Custo Variável</option>
                      <option value="FIXED_COST">Despesa Fixa</option>
                      <option value="TAX">Impostos</option>
                      <option value="NON_OPERATING">Não Operacional</option>
                      <option value="INVESTMENT">Investimentos</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2.5 text-sm font-bold text-text-secondary hover:bg-bg rounded-xl transition-colors">Cancelar</button>
                  <button type="submit" disabled={loading} className="px-8 py-2.5 bg-accent text-bg rounded-xl text-sm font-bold shadow-lg shadow-accent/20 flex items-center gap-2">
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : (editingId ? 'Atualizar Categoria' : 'Salvar Categoria')}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenues Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-success" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary">Receitas</h2>
            <span className="ml-auto text-[10px] font-bold bg-bg px-2 py-0.5 rounded-full border border-border text-text-secondary">
              {revenues.length} {revenues.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          
          <div className="bg-surface rounded-3xl border border-border overflow-hidden divide-y divide-border/50">
            {revenues.length === 0 ? (
              <div className="p-12 text-center text-text-secondary text-sm italic">Nenhuma categoria de receita cadastrada.</div>
            ) : (
              revenues.map(cat => (
                <CategoryItem key={cat.id} cat={cat} onEdit={handleEdit} onDelete={handleDelete} />
              ))
            )}
          </div>
        </div>

        {/* Expenses Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-text-secondary">Despesas</h2>
            <span className="ml-auto text-[10px] font-bold bg-bg px-2 py-0.5 rounded-full border border-border text-text-secondary">
              {expenses.length} {expenses.length === 1 ? 'item' : 'itens'}
            </span>
          </div>
          
          <div className="bg-surface rounded-3xl border border-border overflow-hidden divide-y divide-border/50">
            {expenses.length === 0 ? (
              <div className="p-12 text-center text-text-secondary text-sm italic">Nenhuma categoria de despesa cadastrada.</div>
            ) : (
              expenses.map(cat => (
                <CategoryItem key={cat.id} cat={cat} onEdit={handleEdit} onDelete={handleDelete} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CategoryItem({ cat, onEdit, onDelete }: { cat: ChartOfAccount; onEdit: (cat: ChartOfAccount) => void; onDelete: (id: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const dreGroupLabels: Record<string, string> = {
    'GROSS_REVENUE': 'Receita Bruta',
    'OPERATING_REVENUE': 'Receita Operacional',
    'VARIABLE_COST': 'Custo Variável',
    'FIXED_COST': 'Despesa Fixa',
    'TAX': 'Impostos',
    'NON_OPERATING': 'Não Operacional',
    'INVESTMENT': 'Investimentos'
  };

  return (
    <div className="group transition-all">
      <div className="flex items-center justify-between p-4 bg-surface hover:bg-bg/50 transition-colors">
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
            cat.type === 'REVENUE' ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          )}>
            <Tag size={20} />
          </div>
          <div>
            <div className="text-sm font-bold text-text-primary">{cat.name}</div>
            <div className="text-[10px] font-bold text-text-secondary uppercase tracking-widest mt-0.5">
              {dreGroupLabels[cat.dreGroup] || cat.dreGroup}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          <button 
            onClick={() => onEdit(cat)}
            className="p-2 text-text-secondary hover:text-accent hover:bg-accent/10 rounded-lg transition-all"
          >
            <Search size={16} />
          </button>
          <button 
            onClick={() => onDelete(cat.id)}
            className="p-2 text-text-secondary hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
