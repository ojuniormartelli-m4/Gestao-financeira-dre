import { useState, useEffect } from 'react';
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { financeService } from '../financeService';
import { ChartOfAccount } from '../types';
import { 
  Plus, 
  Trash2, 
  Tag, 
  Settings as SettingsIcon,
  RefreshCw,
  AlertCircle,
  Lock,
  Users,
  Shield,
  UserPlus,
  Building2,
  FileText,
  Download,
  History,
  CheckCircle2,
  X,
  Monitor,
  Sun,
  Moon
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { LoginPage } from './Login';
import { supabase } from '../supabase';
import { seedAuthData } from '../seedAuth';
import { popularDadosTeste } from '../mockData';

import { useTheme } from '../contexts/ThemeContext';

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { companyId, setCompanyId } = useCompany();
  
  const getInitialTab = () => {
    switch (tabParam) {
      case 'categorias': return 'CATEGORIES';
      case 'contas': return 'BANKS';
      case 'usuarios': return 'USERS';
      case 'cargos': return 'ROLES';
      case 'sistema': return 'SYSTEM';
      default: return 'CATEGORIES';
    }
  };

  const [activeTab, setActiveTab] = useState<'CATEGORIES' | 'USERS' | 'ROLES' | 'BANKS' | 'SYSTEM'>(getInitialTab());

  // Sincronizar tab ao mudar URL
  useEffect(() => {
    if (tabParam) {
      setActiveTab(getInitialTab());
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'CATEGORIES' | 'USERS' | 'ROLES' | 'BANKS' | 'SYSTEM') => {
    setActiveTab(tab);
    const param = tab === 'CATEGORIES' ? 'categorias' : 
                  tab === 'BANKS' ? 'contas' : 
                  tab === 'USERS' ? 'usuarios' : 
                  tab === 'ROLES' ? 'cargos' : 'sistema';
    setSearchParams({ tab: param });
  };
  const { theme, toggleTheme } = useTheme();
  const [categories, setCategories] = useState<ChartOfAccount[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [companyConfig, setCompanyConfig] = useState<any>({ name: '', logoUrl: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', type: 'EXPENSE', dreGroup: 'FIXED_COST' });
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', login: '', password: '', roleId: '', photoUrl: '', active: true });
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditingUserModalOpen, setIsEditingUserModalOpen] = useState(false);
  
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: '' });

  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState({ name: '', type: 'CHECKING', initialBalance: 0 });

  const [selectedBankForStatement, setSelectedBankForStatement] = useState<any>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const { companyConfig: globalCompanyConfig, setCompanyConfig: setGlobalCompanyConfig } = useCompany();

  const { user, loading: authLoading } = useAuth();
  const [editCompanyId, setEditCompanyId] = useState(companyId);

  useEffect(() => {
    setEditCompanyId(companyId);
  }, [companyId]);

  const handleSeedAuth = async () => {
    setSeedLoading(true);
    try {
      await seedAuthData();
      alert('Cargos e usuário admin semeados com sucesso!');
      loadData();
    } catch (error) {
      alert('Erro ao semear dados.');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleSeedFinance = async () => {
    setSeedLoading(true);
    try {
      await popularDadosTeste(companyId);
      alert('Dados financeiros de teste semeados com sucesso!');
      loadData();
    } catch (error) {
      alert('Erro ao semear dados financeiros.');
    } finally {
      setSeedLoading(false);
    }
  };

  const handleBackup = async () => {
    const backup = await financeService.exportarBackupCompleto(companyId);
    if (!backup) return;
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finscale-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [cats, usersRes, rolesRes, banks] = await Promise.all([
        financeService.buscarPlanoDeContas(companyId),
        supabase.from('profiles').select('*'),
        supabase.from('roles').select('*'),
        financeService.buscarContasBancarias(companyId)
      ]);
      
      setCategories(cats || []);
      setUsers(usersRes.data?.map(u => ({
        id: u.id,
        name: u.name,
        login: u.login,
        password: u.password,
        roleId: u.role_id,
        photoUrl: u.photo_url,
        active: u.active
      })) || []);
      setRoles(rolesRes.data || []);
      setBankAccounts(banks || []);
      
      // Initialize local state with global config
      setCompanyConfig(globalCompanyConfig);
      setLogoPreview(globalCompanyConfig.logoUrl || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCompanyConfig = async () => {
    setUploadingLogo(true);
    try {
      let finalLogoUrl = companyConfig.logoUrl;

      // Se houver um novo arquivo, tenta fazer o upload
      if (logoFile) {
        try {
          const fileExt = logoFile.name.split('.').pop();
          const fileName = `logo_config_${Date.now()}.${fileExt}`;
          const filePath = `branding/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('branding')
            .upload(filePath, logoFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('branding')
            .getPublicUrl(filePath);

          finalLogoUrl = publicUrl;
        } catch (uploadError: any) {
          console.error("Erro no upload para o Supabase Storage:", uploadError);
          alert('Falha ao enviar o logotipo: ' + (uploadError.message || 'Erro desconhecido'));
          setUploadingLogo(false);
          return;
        }
      }

      // Salva no Supabase
      const updatedConfig = { ...companyConfig, logoUrl: finalLogoUrl };
      await financeService.salvarConfiguracaoEmpresa(companyId, updatedConfig);
      
      setCompanyConfig(updatedConfig);
      setGlobalCompanyConfig(updatedConfig);
      setLogoFile(null);
      alert('Configurações da empresa atualizadas com sucesso!');
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert('Erro inesperado ao salvar configurações da empresa.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
  }, [user, authLoading]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name) return;
    try {
      await financeService.adicionarCategoria(companyId, { ...newCategory, companyId } as any);
      setNewCategory({ name: '', type: 'EXPENSE', dreGroup: 'FIXED_COST' });
      setIsAddingCategory(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.login || !newUser.password) return;
    try {
      const { error } = await supabase.from('profiles').insert([{
        name: newUser.name,
        login: newUser.login,
        password: newUser.password,
        role_id: newUser.roleId,
        photo_url: newUser.photoUrl,
        active: true
      }]);
      if (error) throw error;
      setNewUser({ name: '', login: '', password: '', roleId: '', photoUrl: '', active: true });
      setIsAddingUser(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao criar usuário.');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: editingUser.name,
          login: editingUser.login,
          password: editingUser.password,
          role_id: editingUser.roleId,
          active: editingUser.active,
          photo_url: editingUser.photoUrl
        })
        .eq('id', editingUser.id);
      
      if (error) throw error;
      setIsEditingUserModalOpen(false);
      setEditingUser(null);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar usuário.');
    }
  };

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRole.name) return;
    try {
      const { error } = await supabase.from('roles').insert([newRole]);
      if (error) throw error;
      setNewRole({ name: '' });
      setIsAddingRole(false);
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao criar cargo.');
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.name) return;
    try {
      await financeService.adicionarContaBancaria(companyId, newBank);
      setNewBank({ name: '', type: 'CHECKING', initialBalance: 0 });
      setIsAddingBank(false);
      loadData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    if (!confirm('Tem certeza?')) return;
    try {
      if (collectionName === 'usuarios') {
        const [txs, tfsFrom, tfsTo] = await Promise.all([
          supabase.from('transactions').select('id').eq('user_id', id).limit(1),
          supabase.from('transfers').select('id').eq('user_id', id).limit(1),
          supabase.from('transfers').select('id').eq('to_user_id', id).limit(1)
        ]);

        if (txs.data?.length || tfsFrom.data?.length || tfsTo.data?.length) {
          alert("Este usuário possui movimentações vinculadas e não pode ser excluído, apenas inativado.");
          return;
        }
        
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      } else if (collectionName === 'categories') {
        await financeService.excluirCategoria(companyId, id);
      } else if (collectionName === 'bankAccounts') {
        await financeService.excluirContaBancaria(companyId, id);
      } else if (collectionName === 'roles') {
        const { error } = await supabase.from('roles').delete().eq('id', id);
        if (error) throw error;
      }
      loadData();
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir item.');
    }
  };

  if (authLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-accent" /></div>;
  if (!user) return <LoginPage />;

  const groupedCategories = {
    REVENUE: categories.filter(c => c.type === 'REVENUE'),
    EXPENSE: categories.filter(c => c.type === 'EXPENSE'),
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-text-secondary text-sm">Personalize sua experiência e gerencie dados</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleBackup}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all"
          >
            <Download size={14} className="text-accent" />
            Backup de Dados
          </button>
          <button 
            onClick={handleSeedAuth} 
            disabled={seedLoading}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all disabled:opacity-50"
          >
            <Lock size={14} className="text-accent" />
            Resetar Cargos/Admin
          </button>
          <button 
            onClick={handleSeedFinance} 
            disabled={seedLoading}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={cn("text-accent", seedLoading && "animate-spin")} />
            Gerar Dados Financeiros
          </button>
        </div>
      </header>

      <div className="flex gap-2 p-1 bg-surface border border-border rounded-2xl w-fit">
        <TabButton active={activeTab === 'CATEGORIES'} onClick={() => handleTabChange('CATEGORIES')} icon={<Tag size={16} />} label="Categorias" />
        <TabButton active={activeTab === 'BANKS'} onClick={() => handleTabChange('BANKS')} icon={<Building2 size={16} />} label="Bancos" />
        <TabButton active={activeTab === 'USERS'} onClick={() => handleTabChange('USERS')} icon={<Users size={16} />} label="Usuários" />
        <TabButton active={activeTab === 'ROLES'} onClick={() => handleTabChange('ROLES')} icon={<Shield size={16} />} label="Cargos" />
        <TabButton active={activeTab === 'SYSTEM'} onClick={() => handleTabChange('SYSTEM')} icon={<Monitor size={16} />} label="Sistema" />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {activeTab === 'CATEGORIES' && (
          <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">Plano de Contas</h3>
              <button onClick={() => setIsAddingCategory(true)} className="flex items-center gap-2 text-accent font-bold text-sm"><Plus size={16} /> Nova Categoria</button>
            </div>
            
            <AnimatePresence>
              {isAddingCategory && (
                <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handleAddCategory} className="mb-8 p-6 bg-bg rounded-2xl border border-accent/20 space-y-4 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Nome" value={newCategory.name} onChange={(v: string) => setNewCategory({...newCategory, name: v})} placeholder="Ex: Marketing" />
                    <Select label="Tipo" value={newCategory.type} onChange={(v: string) => setNewCategory({...newCategory, type: v as any})} options={[{v:'REVENUE', l:'Receita'}, {v:'EXPENSE', l:'Despesa'}]} />
                    <Select label="Grupo DRE" value={newCategory.dreGroup} onChange={(v: string) => setNewCategory({...newCategory, dreGroup: v as any})} options={[{v:'GROSS_REVENUE', l:'Receita Bruta'}, {v:'VARIABLE_COST', l:'Custo Variável'}, {v:'FIXED_COST', l:'Despesa Fixa'}, {v:'TAX', l:'Imposto'}]} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsAddingCategory(false)} className="px-4 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-accent text-bg rounded-xl text-sm font-bold">Salvar</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="space-y-8">
              <CategoryGroup title="Receitas" categories={categories.filter(c => c.type === 'REVENUE')} onDelete={id => handleDelete('categories', id)} />
              <CategoryGroup title="Despesas" categories={categories.filter(c => c.type === 'EXPENSE')} onDelete={id => handleDelete('categories', id)} />
            </div>
          </div>
        )}

        {activeTab === 'BANKS' && (
          <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2 text-text-primary">Contas Bancárias</h3>
              <button onClick={() => setIsAddingBank(true)} className="flex items-center gap-2 text-accent font-bold text-sm hover:opacity-80 transition-all"><Plus size={16} /> Nova Conta</button>
            </div>

            <AnimatePresence>
              {isAddingBank && (
                <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handleAddBank} className="mb-8 p-6 bg-bg rounded-2xl border border-accent/20 space-y-4 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Nome do Banco" value={newBank.name} onChange={(v: string) => setNewBank({...newBank, name: v})} placeholder="Ex: Itaú" />
                    <Select label="Tipo" value={newBank.type} onChange={(v: string) => setNewBank({...newBank, type: v as any})} options={[{v:'CHECKING', l:'Corrente'}, {v:'SAVINGS', l:'Poupança'}, {v:'INVESTMENT', l:'Investimento'}, {v:'CASH', l:'Caixa'}]} />
                    <Input label="Saldo Inicial" type="number" value={newBank.initialBalance} onChange={(v: string) => setNewBank({...newBank, initialBalance: Number(v)})} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsAddingBank(false)} className="px-4 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-accent text-bg rounded-xl text-sm font-bold">Salvar Conta</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bankAccounts.map(b => (
                <div key={b.id} className="p-4 bg-bg/50 rounded-2xl border border-border flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent/10 rounded-xl flex items-center justify-center text-accent"><Building2 size={20} /></div>
                    <div>
                      <div className="text-sm font-bold text-text-primary">{b.name}</div>
                      <div className="text-[10px] text-text-secondary uppercase">{b.type} • Saldo: {formatCurrency(b.currentBalance)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => {
                        setSelectedBankForStatement(b);
                        setIsStatementModalOpen(true);
                      }}
                      className="p-2 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                      title="Ver Extrato"
                    >
                      <History size={16} />
                    </button>
                    <button onClick={() => handleDelete('bankAccounts', b.id)} className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'USERS' && (
          <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">Gestão de Usuários</h3>
              {['admin-role', 'manager-role', 'supervisor-role'].includes(user?.roleId || '') && (
                <button onClick={() => setIsAddingUser(true)} className="flex items-center gap-2 text-accent font-bold text-sm"><UserPlus size={16} /> Novo Usuário</button>
              )}
            </div>

            <AnimatePresence>
              {isAddingUser && (
                <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handleAddUser} className="mb-8 p-6 bg-bg rounded-2xl border border-accent/20 space-y-4 overflow-hidden">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Input label="Nome Completo" value={newUser.name} onChange={(v: string) => setNewUser({...newUser, name: v})} />
                    <Input label="Login" value={newUser.login} onChange={(v: string) => setNewUser({...newUser, login: v})} />
                    <Input label="Senha" type="password" value={newUser.password} onChange={(v: string) => setNewUser({...newUser, password: v})} />
                    <Select label="Cargo" value={newUser.roleId} onChange={(v: string) => setNewUser({...newUser, roleId: v})} options={roles.map(r => ({v: r.id, l: r.name}))} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-accent text-bg rounded-xl text-sm font-bold">Criar Usuário</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.map(u => {
                const canManage = ['admin-role', 'manager-role', 'supervisor-role'].includes(user?.roleId || '');
                const isSelf = user?.id === u.id;
                
                if (!canManage && !isSelf) return null;

                return (
                  <div 
                    key={u.id} 
                    onClick={() => {
                      setEditingUser(u);
                      setIsEditingUserModalOpen(true);
                    }}
                    className={cn(
                      "p-4 bg-bg/50 rounded-2xl border border-border flex items-center justify-between group cursor-pointer hover:border-accent/30 transition-all",
                      u.active === false && "opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={u.photoUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.login}`} className="w-10 h-10 rounded-full bg-surface" />
                        {u.active === false && (
                          <div className="absolute -bottom-1 -right-1 bg-danger text-white p-0.5 rounded-full border-2 border-bg">
                            <X size={8} />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-2">
                          {u.name}
                          {u.active === false && <span className="text-[8px] bg-danger/10 text-danger px-1.5 py-0.5 rounded-full uppercase">Inativo</span>}
                        </div>
                        <div className="text-[10px] text-text-secondary uppercase">{roles.find(r => r.id === u.roleId)?.name || 'Sem Cargo'}</div>
                      </div>
                    </div>
                    {canManage && !isSelf && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete('usuarios', u.id);
                        }} 
                        className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'ROLES' && (
          <div className="bg-surface rounded-3xl border border-border p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2">Gestão de Cargos</h3>
              <button onClick={() => setIsAddingRole(true)} className="flex items-center gap-2 text-accent font-bold text-sm"><Plus size={16} /> Novo Cargo</button>
            </div>

            <AnimatePresence>
              {isAddingRole && (
                <motion.form initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} onSubmit={handleAddRole} className="mb-8 p-6 bg-bg rounded-2xl border border-accent/20 space-y-4 overflow-hidden">
                  <div className="max-w-md">
                    <Input label="Nome do Cargo" value={newRole.name} onChange={(v: string) => setNewRole({...newRole, name: v})} placeholder="Ex: Financeiro" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setIsAddingRole(false)} className="px-4 py-2 text-sm font-bold text-text-secondary">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-accent text-bg rounded-xl text-sm font-bold">Criar Cargo</button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roles.map(r => (
                <div key={r.id} className="p-4 bg-bg/50 rounded-2xl border border-border flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center text-accent"><Shield size={16} /></div>
                    <span className="text-sm font-bold">{r.name}</span>
                  </div>
                  <button onClick={() => handleDelete('roles', r.id)} className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'SYSTEM' && (
          <div className="bg-surface rounded-3xl border border-border p-8 shadow-xl space-y-8">
            <div>
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Building2 className="text-accent" size={20} />
                Identidade da Empresa
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  label="Nome da Empresa" 
                  value={companyConfig.name || ''} 
                  onChange={(v: string) => setCompanyConfig({...companyConfig, name: v})} 
                  placeholder="Ex: Minha Empresa LTDA"
                />

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">ID da Empresa (Slugs)</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editCompanyId} 
                      onChange={e => setEditCompanyId(e.target.value)}
                      placeholder="Identificador único"
                      className="flex-1 bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none"
                    />
                    <button 
                      onClick={() => {
                        if (confirm('Atenção: Mudar o ID da empresa pode desconectá-la de dados antigos se as políticas RLS não forem atualizadas. Deseja continuar?')) {
                          setCompanyId(editCompanyId);
                        }
                      }}
                      className="px-4 py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent text-accent"
                    >
                      Alterar ID
                    </button>
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Logotipo da Empresa</label>
                  <div className="flex items-center gap-4 p-4 bg-bg border border-border rounded-xl">
                    <div className="relative group">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo Preview" className="w-16 h-16 rounded-xl object-contain bg-white p-1 border border-border" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 rounded-xl bg-accent/10 flex items-center justify-center text-accent border-2 border-dashed border-accent/20">
                          <Building2 size={24} />
                        </div>
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-bg/60 rounded-xl flex items-center justify-center">
                          <RefreshCw size={20} className="text-accent animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleLogoChange}
                        className="hidden"
                        id="logo-upload"
                      />
                      <label 
                        htmlFor="logo-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-xs font-bold cursor-pointer hover:border-accent transition-all"
                      >
                        <Plus size={14} className="text-accent" />
                        Selecionar Logo
                      </label>
                      <p className="text-[10px] text-text-secondary">JPG ou PNG. Cabeçalho DRE/Dashboard.</p>
                    </div>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleSaveCompanyConfig}
                disabled={uploadingLogo}
                className="mt-4 px-6 py-2 bg-accent text-bg rounded-xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50"
              >
                {uploadingLogo ? 'Enviando...' : 'Salvar Branding'}
              </button>
            </div>

            <div className="pt-8 border-t border-border">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Monitor className="text-accent" size={20} />
                Aparência do Sistema
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button 
                  onClick={() => theme !== 'light' && toggleTheme()}
                  className={cn(
                    "p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all",
                    theme === 'light' ? "border-accent bg-accent/5" : "border-border bg-bg/50 hover:border-accent/30"
                  )}
                >
                  <div className="w-12 h-12 bg-amber-400/10 rounded-full flex items-center justify-center text-amber-500">
                    <Sun size={24} />
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Modo Claro</div>
                    <div className="text-xs text-text-secondary">Ideal para ambientes iluminados</div>
                  </div>
                </button>

                <button 
                  onClick={() => theme !== 'dark' && toggleTheme()}
                  className={cn(
                    "p-6 rounded-2xl border-2 flex flex-col items-center gap-4 transition-all",
                    theme === 'dark' ? "border-accent bg-accent/5" : "border-border bg-bg/50 hover:border-accent/30"
                  )}
                >
                  <div className="w-12 h-12 bg-indigo-400/10 rounded-full flex items-center justify-center text-indigo-400">
                    <Moon size={24} />
                  </div>
                  <div className="text-center">
                    <div className="font-bold">Modo Escuro</div>
                    <div className="text-xs text-text-secondary">Melhor para foco e descanso visual</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="pt-8 border-t border-border">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <SettingsIcon className="text-accent" size={20} />
                Manutenção e Dados
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-6 bg-bg/50 rounded-2xl border border-border space-y-4">
                  <div className="font-bold text-sm">Backup Completo</div>
                  <p className="text-xs text-text-secondary">Exporte todos os dados da empresa em formato JSON para segurança.</p>
                  <button onClick={handleBackup} className="w-full py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all flex items-center justify-center gap-2">
                    <Download size={14} /> Exportar Backup
                  </button>
                </div>
                <div className="p-6 bg-bg/50 rounded-2xl border border-border space-y-4">
                  <div className="font-bold text-sm">Resetar Autenticação</div>
                  <p className="text-xs text-text-secondary">Recria os cargos básicos e o usuário administrador padrão.</p>
                  <button onClick={handleSeedAuth} disabled={seedLoading} className="w-full py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <Lock size={14} /> Resetar Auth
                  </button>
                </div>
                <div className="p-6 bg-bg/50 rounded-2xl border border-border space-y-4">
                  <div className="font-bold text-sm">Dados de Demonstração</div>
                  <p className="text-xs text-text-secondary">Gera transações e bancos fictícios para testes do sistema.</p>
                  <button onClick={handleSeedFinance} disabled={seedLoading} className="w-full py-2 bg-surface border border-border rounded-xl text-xs font-bold hover:border-accent transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    <RefreshCw size={14} className={cn(seedLoading && "animate-spin")} /> Gerar Dados
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {isEditingUserModalOpen && editingUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={() => setIsEditingUserModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Editar Usuário</h2>
              <button onClick={() => setIsEditingUserModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary"><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <Input label="Nome Completo" value={editingUser.name} onChange={(v: string) => setEditingUser({...editingUser, name: v})} />
              <Input label="Login" value={editingUser.login} onChange={(v: string) => setEditingUser({...editingUser, login: v})} />
              <Input label="Senha" type="password" value={editingUser.password} onChange={(v: string) => setEditingUser({...editingUser, password: v})} />
              
              {['admin-role', 'manager-role', 'supervisor-role'].includes(user?.roleId || '') ? (
                <>
                  <Select label="Cargo" value={editingUser.roleId} onChange={(v: string) => setEditingUser({...editingUser, roleId: v})} options={roles.map(r => ({v: r.id, l: r.name}))} />
                  <div className="flex items-center gap-2 p-3 bg-bg rounded-xl border border-border">
                    <input 
                      type="checkbox" 
                      id="user-active"
                      checked={editingUser.active !== false} 
                      onChange={(e) => setEditingUser({...editingUser, active: e.target.checked})}
                      className="rounded border-border text-accent focus:ring-accent bg-bg"
                    />
                    <label htmlFor="user-active" className="text-sm font-bold text-text-primary cursor-pointer">Usuário Ativo</label>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-bg/50 rounded-xl border border-border space-y-2">
                  <div className="text-[10px] font-bold uppercase text-text-secondary">Cargo (Somente Leitura)</div>
                  <div className="text-sm font-bold text-text-primary">{roles.find(r => r.id === editingUser.roleId)?.name}</div>
                </div>
              )}

              <button type="submit" className="w-full py-4 bg-accent text-bg rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20">Salvar Alterações</button>
            </form>
          </motion.div>
        </div>
      )}

      {isStatementModalOpen && selectedBankForStatement && (
        <BankStatementModal 
          bank={selectedBankForStatement} 
          companyId={companyId} 
          onClose={() => setIsStatementModalOpen(false)} 
        />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all", active ? "bg-accent text-bg shadow-lg shadow-accent/20" : "text-text-secondary hover:text-text-primary")}>
      {icon} {label}
    </button>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none" />
    </div>
  );
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:border-accent outline-none">
        <option value="">Selecione...</option>
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}

function CategoryGroup({ title, categories, onDelete }: { title: string, categories: ChartOfAccount[], onDelete: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-widest text-text-secondary border-b border-border pb-2">{title}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {categories.map(cat => (
          <div key={cat.id} className="flex items-center justify-between p-3 bg-bg/50 rounded-xl border border-border group hover:border-accent/30 transition-all">
            <div className="flex flex-col">
              <span className="text-sm font-medium">{cat.name}</span>
              <span className="text-[10px] text-text-secondary uppercase">{cat.dreGroup}</span>
            </div>
            <button 
              onClick={() => onDelete(cat.id)}
              className="p-2 text-text-secondary hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function BankStatementModal({ bank, companyId, onClose }: { bank: any, companyId: string, onClose: () => void }) {
  const [statement, setStatement] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatement = async () => {
      const data = await financeService.buscarExtratoConta(companyId, bank.id);
      setStatement(data);
      setLoading(false);
    };
    loadStatement();
  }, [bank.id, companyId]);

  if (!statement && !loading) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-4xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-border flex justify-between items-center bg-bg/50">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-text-primary">
              <History className="text-accent" />
              Extrato: {bank.name}
            </h2>
            <p className="text-xs text-text-secondary uppercase mt-1">Saldo Inicial: {formatCurrency(statement?.initialBalance || 0)}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-accent animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[10px] font-bold uppercase text-text-secondary border-b border-border">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-right">Valor</th>
                    <th className="px-4 py-3 text-right">Saldo Acumulado</th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {statement.movements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-sm whitespace-nowrap">{m.date.toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-text-primary">{m.description}</div>
                        <div className="text-[10px] text-text-secondary uppercase">{m.type}</div>
                      </td>
                      <td className={cn("px-4 py-3 text-sm font-bold text-right", m.amount >= 0 ? "text-success" : "text-danger")}>
                        {m.amount >= 0 ? '+' : ''} {formatCurrency(m.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-right text-text-primary">
                        {formatCurrency(m.runningBalance)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {m.isConciliated ? (
                          <CheckCircle2 size={16} className="text-success mx-auto" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-border mx-auto" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
