import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface AppUser {
  id: string;
  companyId: string;
  name: string;
  login: string;
  roleId: string;
  active: boolean;
  photoUrl?: string;
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (data: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('finscale_user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem('finscale_user');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const updateUser = (data: Partial<AppUser>) => {
    if (!user) return;
    const updatedUser = { ...user, ...data };
    setUser(updatedUser);
    localStorage.setItem('finscale_user', JSON.stringify(updatedUser));
  };

  const login = async (loginInput: string, passwordInput: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('login', loginInput)
        .single();
      
      if (data && !error) {
        // Verificação de status ativo
        if (data.active === false) {
          return { success: false, message: 'Sua conta foi desativada. Entre em contato com o administrador.' };
        }

        // Verificação de senha manual (texto plano mantido por compatibilidade com MVP, mas alertado no audit)
        if (data.password === passwordInput) {
          const appUser: AppUser = {
            id: data.id,
            companyId: data.company_id, // Usar o company_id do banco
            name: data.name,
            login: data.login,
            roleId: data.role_id,
            active: data.active !== false,
            photoUrl: data.photo_url
          };
          
          setUser(appUser);
          localStorage.setItem('finscale_user', JSON.stringify(appUser));
          return { success: true };
        }
      }
      return { success: false, message: 'Login ou senha incorretos.' };
    } catch (error) {
      console.error("Erro no login:", error);
      return { success: false, message: 'Erro ao processar login.' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('finscale_user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}
