import { useState, useEffect } from 'react';
import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { financeService } from '../financeService';
import { 
  Plus, 
  Trash2, 
  Target,
  RefreshCw,
  Search,
  CheckCircle2,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LoginPage } from './Login';

export function CostCentersPage() {
  const [costCenters, setCostCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newData, setNewData] = useState({ name: '', color: '#3b82f6', active: true });
  const [searchTerm, setSearchTerm] = useState('');
  
  const { user, loading: authLoading } = useAuth();
  const companyId = 'm4-digital';

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await financeService.buscarCentrosCusto(companyId);
      setCostCenters(data || []);
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
      await financeService.salvarCentroCusto(companyId, newData);
      setNewData({ name: '', color: '#3b82f6', active: true });
      setIsAdding(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este centro de custo?')) return;
    try {
      await financeService.excluirCentroCusto(id);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir item. Pode haver transações vinculadas.');
    }
  };

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>;
  if (!user) return <LoginPage />;

  const filteredData = costCenters.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Centros de Custo</h1>
          <p className="text-text-secondary text-sm">Gerencie os departamentos e unidades do seu negócio</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          className="flex items-center gap-2 bg-accent hover:opacity-90 text-bg px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20"
        >
          <Plus size={20} />
          Novo Centro de Custo
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

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-surface rounded-3xl border border-border p-6 shadow-xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Adicionar Centro de Custo</h3>
              <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nome</label>
                  <input 
                    required
                    type="text" 
                    value={newData.name} 
                    onChange={e => setNewData({...newData, name: e.target.value})} 
                    placeholder="Ex: Marketing, Vendas, Sede..." 
                    className="w-full bg-bg border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Cor de Identificação</label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      value={newData.color} 
                      onChange={e => setNewData({...newData, color: e.target.value})} 
                      className="w-10 h-10 rounded-lg bg-bg border border-border p-1 cursor-pointer" 
                    />
                    <input 
                      type="text"
                      value={newData.color}
                      onChange={e => setNewData({...newData, color: e.target.value})}
                      className="flex-1 bg-bg border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-accent text-bg rounded-xl text-sm font-bold shadow-lg shadow-accent/20">Salvar Centro de Custo</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-10"><RefreshCw className="animate-spin text-accent" /></div>
        ) : filteredData.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-surface rounded-3xl border border-dashed border-border text-text-secondary">
            Nenhum centro de custo encontrado.
          </div>
        ) : (
          filteredData.map(item => (
            <div key={item.id} className="p-4 bg-surface rounded-2xl border border-border flex items-center justify-between group hover:border-accent/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold" style={{ backgroundColor: item.color || '#3b82f6' }}>
                  <Target size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-text-primary">{item.name}</div>
                  <div className="text-[10px] text-text-secondary flex items-center gap-1.5">
                    {item.active ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-success" /> Ativo</>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-danger" /> Inativo</>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(item.id)} 
                className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                title="Excluir"
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
