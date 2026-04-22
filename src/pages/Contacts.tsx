import { useState, useEffect } from 'react';
import * as React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { financeService } from '../financeService';
import { 
  Plus, 
  Trash2, 
  User,
  Users,
  Search,
  RefreshCw,
  X,
  Mail,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newData, setNewData] = useState({ name: '', type: 'CLIENT', document: '', email: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'CLIENT' | 'SUPPLIER'>('ALL');
  
  const { user, loading: authLoading } = useAuth();
  const { companyId } = useCompany();

  const loadData = async () => {
    if (!user || !companyId) return;
    setLoading(true);
    try {
      const data = await financeService.buscarContatos(companyId);
      setContacts(data || []);
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
      await financeService.salvarContato(companyId, newData);
      setNewData({ name: '', type: 'CLIENT', document: '', email: '' });
      setIsAdding(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este contato?')) return;
    try {
      await financeService.excluirContato(id);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir contato.');
    }
  };

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>;

  const filteredData = contacts.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.document && item.document.includes(searchTerm));
    const matchesType = filterType === 'ALL' ? true : item.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contatos</h1>
          <p className="text-text-secondary text-sm">Gerencie seus clientes e fornecedores</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)} 
          className="flex items-center gap-2 bg-accent hover:opacity-90 text-bg px-6 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-accent/20"
        >
          <Plus size={20} />
          Novo Contato
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-surface p-4 rounded-2xl border border-border shadow-sm">
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou documento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg border border-border rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent transition-colors"
          />
        </div>
        <div className="md:col-span-2 flex gap-2">
          {(['ALL', 'CLIENT', 'SUPPLIER'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn(
                "flex-1 py-2 px-3 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-wider",
                filterType === type 
                  ? "bg-accent/10 border-accent/20 text-accent" 
                  : "bg-bg border-border text-text-secondary hover:border-text-secondary/50"
              )}
            >
              {type === 'ALL' ? 'Todos' : type === 'CLIENT' ? 'Clientes' : 'Fornecedores'}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-surface rounded-3xl border border-border p-8 shadow-xl max-w-2xl mx-auto w-full"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-xl">Novo Contato</h3>
              <button onClick={() => setIsAdding(false)} className="text-text-secondary hover:text-text-primary transition-colors"><X size={24} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setNewData({ ...newData, type: 'CLIENT' })}
                  className={cn(
                    "py-4 rounded-2xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                    newData.type === 'CLIENT' 
                      ? "bg-accent/10 border-accent/30 text-accent shadow-lg shadow-accent/10" 
                      : "bg-bg border-border text-text-secondary"
                  )}
                >
                  <User size={18} />
                  Cliente
                </button>
                <button
                  type="button"
                  onClick={() => setNewData({ ...newData, type: 'SUPPLIER' })}
                  className={cn(
                    "py-4 rounded-2xl font-bold text-sm border transition-all flex items-center justify-center gap-2",
                    newData.type === 'SUPPLIER' 
                      ? "bg-accent/10 border-accent/30 text-accent shadow-lg shadow-accent/10" 
                      : "bg-bg border-border text-text-secondary"
                  )}
                >
                  <Users size={18} />
                  Fornecedor
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nome Completo / Razão Social</label>
                <input 
                  required
                  type="text" 
                  value={newData.name} 
                  onChange={e => setNewData({...newData, name: e.target.value})} 
                  placeholder="Digite o nome..." 
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-colors" 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">CPF / CNPJ</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input 
                      type="text" 
                      value={newData.document} 
                      onChange={e => setNewData({...newData, document: e.target.value})} 
                      placeholder="000.000.000-00" 
                      className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:border-accent outline-none" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input 
                      type="email" 
                      value={newData.email} 
                      onChange={e => setNewData({...newData, email: e.target.value})} 
                      placeholder="contato@exemplo.com" 
                      className="w-full bg-bg border border-border rounded-xl pl-10 pr-4 py-3 text-sm focus:border-accent outline-none" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={() => setIsAdding(false)} className="px-8 py-3 text-sm font-bold text-text-secondary hover:text-text-primary transition-all">Cancelar</button>
                <button type="submit" className="px-8 py-3 bg-accent text-bg rounded-2xl font-bold shadow-xl shadow-accent/20 hover:opacity-90 transition-all">Salvar Contato</button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>
        ) : filteredData.length === 0 ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center bg-surface rounded-[2rem] border border-dashed border-border text-center">
            <div className="w-16 h-16 bg-surface border border-border rounded-2xl flex items-center justify-center text-text-secondary mb-4 opacity-50">
              <Users size={32} />
            </div>
            <p className="text-text-secondary text-sm font-medium">Nenhum contato encontrado com esses filtros.</p>
          </div>
        ) : (
          filteredData.map(item => (
            <div key={item.id} className="bg-surface rounded-3xl border border-border p-5 hover:border-accent/40 shadow-sm transition-all group flex flex-col justify-between">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center text-accent",
                    item.type === 'CLIENT' ? "bg-accent/10" : "bg-bg border border-border"
                  )}>
                    {item.type === 'CLIENT' ? <User size={24} /> : <Users size={24} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-text-primary leading-tight mb-1">{item.name}</h4>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest",
                      item.type === 'CLIENT' ? "bg-success/10 text-success" : "bg-orange-500/10 text-orange-500"
                    )}>
                      {item.type === 'CLIENT' ? 'Cliente' : 'Fornecedor'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {item.document && (
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary font-medium">
                    <FileText size={14} className="opacity-50" />
                    {item.document}
                  </div>
                )}
                {item.email && (
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary font-medium">
                    <Mail size={14} className="opacity-50" />
                    {item.email}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
