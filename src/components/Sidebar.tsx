import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  FileText, 
  Wallet, 
  Settings, 
  Menu, 
  X,
  LogOut,
  LogIn,
  User as UserIcon,
  Sun,
  Moon,
  UserCircle,
  Upload,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';
import { financeService } from '../financeService';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ArrowLeftRight, label: 'Transações', path: '/transacoes' },
  { icon: FileText, label: 'DRE', path: '/dre' },
  { icon: Wallet, label: 'Fluxo de Caixa', path: '/fluxo-caixa' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
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
        password: '', // Não carregamos a senha por segurança
        photoUrl: user.photoUrl || ''
      });
      setPreviewUrl(user.photoUrl || null);
    }
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      let photoUrl = profileData.photoUrl;

      if (selectedFile) {
        setUploading(true);
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `avatar_${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, selectedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          photoUrl = publicUrl;
        } catch (uploadError: any) {
          console.error("Erro no upload do avatar:", uploadError);
          alert('Falha ao enviar a foto: ' + (uploadError.message || 'Erro desconhecido'));
          setUploading(false);
          setSavingProfile(false);
          return;
        }
        setUploading(false);
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: profileData.name,
          login: profileData.login,
          photo_url: photoUrl,
          ...(profileData.password ? { password: profileData.password } : {})
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      
      updateUser({
        name: profileData.name,
        login: profileData.login,
        photoUrl: photoUrl
      });
      setIsProfileModalOpen(false);
      setSelectedFile(null);
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao atualizar perfil.');
    } finally {
      setSavingProfile(false);
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-surface border border-border rounded-lg text-text-primary"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-bg/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-64 bg-surface border-r border-border z-40 transition-transform duration-300 lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center text-bg font-bold">
                F
              </div>
              <span className="text-xl font-bold tracking-tight text-text-primary">FinScale</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                  isActive 
                    ? "bg-accent/10 text-accent border border-accent/20" 
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                )}
              >
                <item.icon size={20} className={cn(
                  "transition-colors",
                  "group-hover:text-accent"
                )} />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Footer / Auth */}
          <div className="p-4 border-t border-border space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between px-4">
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="flex items-center gap-3 overflow-hidden hover:opacity-80 transition-opacity text-left"
                >
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name || ''} className="w-8 h-8 rounded-full border border-border object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                      <UserIcon size={16} />
                    </div>
                  )}
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-sm font-bold truncate text-text-primary">{user.name || user.login}</span>
                    <span className="text-[10px] text-text-secondary truncate">@{user.login}</span>
                  </div>
                </button>
                <button 
                  onClick={toggleTheme}
                  className="p-2 rounded-xl bg-bg border border-border text-text-secondary hover:text-accent transition-all"
                  title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
                >
                  {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
              </div>
              <button 
                onClick={() => logout()}
                className="flex items-center gap-3 w-full px-4 py-3 text-text-secondary hover:text-danger transition-colors rounded-xl hover:bg-danger/5"
              >
                <LogOut size={20} />
                <span className="font-medium">Sair</span>
              </button>
            </div>

            <div className="px-4 py-2 text-center">
              <p className="text-[10px] text-text-secondary font-medium">
                Desenvolvido por <span className="text-accent">M4 Marketing Digital</span>
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Profile Modal */}
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
                      <p className="text-[10px] text-text-secondary">JPG ou PNG. Recomendado 400x400px.</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-text-secondary ml-1">Nova Senha (deixe em branco para manter)</label>
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
