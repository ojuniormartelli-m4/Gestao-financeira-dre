import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  FileText, 
  Wallet, 
  Settings, 
  Menu, 
  X,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  UserCircle,
  Upload,
  RefreshCw,
  PieChart,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Library,
  CreditCard,
  Tags,
  Target,
  Users,
  Landmark,
  ChevronLeft,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSidebar } from '../contexts/SidebarContext';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

const menuGroups = [
  {
    title: 'Visão Geral',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    ]
  },
  {
    title: 'Gestão do Negócio',
    items: [
      { icon: FileText, label: 'DRE', path: '/dre' },
      { icon: PieChart, label: 'Fluxo (DFC)', path: '/dfc' },
      { icon: BarChart3, label: 'Balanço Patrimonial', path: '/balanco' },
    ]
  },
  {
    title: 'Movimentações e Caixa',
    items: [
      { icon: ArrowLeftRight, label: 'Lançamentos', path: '/transacoes' },
      { icon: CalendarClock, label: 'A Pagar / Receber', path: '/transacoes?status=PENDING' },
      { icon: CheckCircle2, label: 'Pagas / Recebidas', path: '/transacoes?status=PAID' },
      { icon: Library, label: 'Extrato de Contas', path: '/extrato' },
      { icon: CreditCard, label: 'Cartões de Crédito', path: '/cartoes' },
    ]
  },
  {
    title: 'Cadastros',
    items: [
      { icon: Tags, label: 'Categorias', path: '/configuracoes?tab=categorias' },
      { icon: Target, label: 'Centro de Custos', path: '/centros-custo' },
      { icon: Wallet, label: 'Contas', path: '/configuracoes?tab=contas' },
      { icon: Users, label: 'Contatos', path: '/contatos' },
      { icon: Landmark, label: 'Formas de Pagamento', path: '/formas-pagamento' },
    ]
  }
];

export function Sidebar() {
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { isCollapsed, toggleCollapsed, isMobileOpen, toggleMobile } = useSidebar();
  const location = useLocation();
  
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState({ name: '', login: '', password: '', photoUrl: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        login: user.login || '',
        password: '',
        photoUrl: user.photoUrl || ''
      });
      setPreviewUrl(user.photoUrl || null);
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      let photoUrl = profileData.photoUrl;
      if (selectedFile) {
        setUploading(true);
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `avatar_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, selectedFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
        photoUrl = publicUrl;
        setUploading(false);
      }

      await supabase.from('profiles').update({
        name: profileData.name,
        login: profileData.login,
        photo_url: photoUrl,
        ...(profileData.password ? { password: profileData.password } : {})
      }).eq('id', user.id);
      
      updateUser({ name: profileData.name, login: profileData.login, photoUrl });
      setIsProfileModalOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Mobile Toggle Button */}
      <button 
        onClick={toggleMobile}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-text-primary"
      >
        {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={toggleMobile}
        />
      )}

      {/* Sidebar Aside */}
      <aside className={cn(
        "fixed top-0 left-0 h-full bg-surface border-r border-border z-40 transition-all duration-300",
        isMobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0",
        isCollapsed ? "lg:w-[70px]" : "lg:w-64"
      )}>
        <div className="flex flex-col h-full relative">
          
          {/* Logo Area */}
          <div className={cn(
            "p-6 border-b border-border flex items-center transition-all duration-300",
            isCollapsed ? "justify-center px-2" : "gap-3 justify-between"
          )}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex-shrink-0 flex items-center justify-center text-bg font-bold">
                F
              </div>
              {!isCollapsed && (
                <span className="text-xl font-bold tracking-tight text-text-primary whitespace-nowrap overflow-hidden">
                  FinScale
                </span>
              )}
            </div>
            
            <button 
              onClick={toggleCollapsed}
              className="hidden lg:flex p-1.5 hover:bg-bg border border-transparent hover:border-border rounded-lg text-text-secondary transition-all"
              title={isCollapsed ? "Expandir" : "Recolher"}
            >
              {isCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
          </div>

          {/* Navigation with Groups */}
          <nav className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
            {menuGroups.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-2">
                {!isCollapsed && (
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-text-secondary px-4 mb-2">
                    {group.title}
                  </h3>
                )}
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => toggleMobile()}
                      className={() => {
                        const currentPath = location.pathname + location.search;
                        const isExactlyActive = currentPath === item.path || (location.pathname === item.path && location.search === '');
                        
                        return cn(
                          "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                          isExactlyActive 
                            ? "bg-accent/10 text-accent border border-accent/20" 
                            : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
                          isCollapsed && "justify-center px-0"
                        );
                      }}
                    >
                      <item.icon size={20} className={cn(
                        "flex-shrink-0 transition-colors",
                        "group-hover:text-accent"
                      )} />
                      {!isCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
                      
                      {isCollapsed && (
                        <div className="absolute left-full ml-3 px-3 py-2 bg-accent text-bg text-[10px] font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-[100] shadow-2xl border border-accent/20 translate-x-1 group-hover:translate-x-0">
                          {item.label}
                          <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-[6px] border-transparent border-r-accent" />
                        </div>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-4 mt-4 border-t border-border">
              <NavLink
                to="/configuracoes"
                onClick={() => toggleMobile()}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                  isActive 
                    ? "bg-accent/10 text-accent border border-accent/20" 
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <Settings size={20} className="flex-shrink-0 group-hover:text-accent" />
                {!isCollapsed && <span className="font-medium text-sm">Configurações</span>}
                
                {isCollapsed && (
                  <div className="absolute left-full ml-3 px-3 py-2 bg-accent text-bg text-[10px] font-bold rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none whitespace-nowrap z-[100] shadow-2xl border border-accent/20 translate-x-1 group-hover:translate-x-0">
                    Configurações
                    <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-[6px] border-transparent border-r-accent" />
                  </div>
                )}
              </NavLink>
            </div>
          </nav>

          {/* Footer Area */}
          <div className="p-4 border-t border-border space-y-4">
            <div className="space-y-4">
              {/* User Profile / Theme */}
              <div className={cn(
                "flex items-center px-2",
                isCollapsed ? "flex-col gap-4" : "justify-between gap-3 px-4"
              )}>
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity text-left shrink-0"
                  title={isCollapsed ? "Perfil" : ""}
                >
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name || ''} className="w-8 h-8 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <UserIcon size={16} />
                    </div>
                  )}
                  {!isCollapsed && (
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-sm font-bold truncate text-text-primary">{user.name || user.login}</span>
                      <span className="text-[10px] text-text-secondary truncate">@{user.login}</span>
                    </div>
                  )}
                </button>
                
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-bg border border-border text-text-secondary hover:text-accent transition-all"
                  title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>

              {/* Logout */}
              <button 
                onClick={() => logout()}
                title={isCollapsed ? "Sair" : ""}
                className={cn(
                  "flex items-center gap-3 w-full px-4 py-3 text-text-secondary hover:text-danger transition-colors rounded-xl hover:bg-danger/5",
                  isCollapsed && "justify-center px-0"
                )}
              >
                <LogOut size={20} className="flex-shrink-0" />
                {!isCollapsed && <span className="font-medium text-sm">Sair</span>}
              </button>
            </div>

            {/* M4 Seal */}
            <div className={cn(
              "px-4 py-2 border-t border-border pt-4",
              isCollapsed ? "text-center px-1" : "text-center"
            )}>
              <p className={cn(
                "text-text-secondary font-medium",
                isCollapsed ? "text-[8px] leading-tight" : "text-[10px]"
              )}>
                {isCollapsed ? "M4 Digital" : (
                  <>Desenvolvido por <span className="text-accent">M4 Marketing Digital</span></>
                )}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Profile Modal - Re-implementing with same logic */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-bg/80 backdrop-blur-md" 
              onClick={() => setIsProfileModalOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border rounded-[2.5rem] shadow-2xl p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-accent/10 rounded-xl text-accent">
                    <UserCircle size={24} />
                  </div>
                  <h2 className="text-xl font-bold">Meu Perfil</h2>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nome Completo</label>
                  <input 
                    type="text" 
                    value={profileData.name} 
                    onChange={e => setProfileData({...profileData, name: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Login / Usuário</label>
                  <input 
                    type="text" 
                    value={profileData.login} 
                    onChange={e => setProfileData({...profileData, login: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Foto de Perfil</label>
                  <div className="flex items-center gap-4 p-4 bg-bg border border-border rounded-xl">
                    <div className="relative group">
                      {previewUrl ? (
                        <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-accent/20" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent border-2 border-dashed border-accent/20">
                          <UserIcon size={24} />
                        </div>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-bg/60 rounded-full flex items-center justify-center">
                          <RefreshCw size={20} className="text-accent animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input 
                        type="file" 
                        accept="image/jpeg,image/png,image/jpg"
                        onChange={handleFileChange}
                        className="hidden"
                        id="avatar-upload"
                      />
                      <label 
                        htmlFor="avatar-upload"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-xs font-bold cursor-pointer hover:border-accent transition-all"
                      >
                        <Upload size={14} className="text-accent" />
                        Selecionar Imagem
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nova Senha</label>
                  <input 
                    type="password" 
                    value={profileData.password} 
                    onChange={e => setProfileData({...profileData, password: e.target.value})}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-accent outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="w-full py-4 bg-accent text-bg rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 mt-4"
                >
                  {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
