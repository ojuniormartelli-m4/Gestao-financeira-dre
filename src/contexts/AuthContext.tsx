import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabase';

interface AppUser {
  id: string;
  companyId: string;
  name: string;
  login: string;
  roleId: string;
  active: boolean;
  mustChangePassword: boolean;
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
    // Check for existing session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setUser({
          id: data.id,
          companyId: data.company_id,
          name: data.name,
          login: data.login,
          roleId: data.role_id,
          active: data.active !== false,
          mustChangePassword: false, // DESATIVADO TEMPORARIAMENTE PARA UNLOCK
          photoUrl: data.photo_url
        });
      }
    } catch (e) {
      console.error('Error loading profile:', e);
    } finally {
      setLoading(false);
    }
  };

  const updateUser = (data: Partial<AppUser>) => {
    if (!user) return;
    setUser({ ...user, ...data });
  };

  const login = async (username: string, password: string) => {
    try {
      // Mapeia usuário básico para e-mail virtual interno se não for um e-mail real
      const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@finscale.internal`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, message: 'Login ou senha incorretos.' };
      }

      if (data.user) {
        await loadProfile(data.user.id);
        
        // Wait briefly for the state to update if needed
        return { success: true };
      }

      return { success: false, message: 'Usuário não encontrado.' };
    } catch (error) {
      console.error("Erro no login:", error);
      return { success: false, message: 'Erro ao processar login.' };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
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
