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
          mustChangePassword: data.must_change_password === true,
          photoUrl: data.photo_url
        });
      } else {
        // Se não encontrou ou deu erro (como o 406/PGRST116 de "não encontrado")
        if (error && error.code !== 'PGRST116') {
          console.warn('[AuthContext] Erro ao buscar perfil (não fatal):', error);
        }

        console.log('[AuthContext] Perfil não encontrado ou erro no fetch. Tentando garantir perfil para o usuário...');
        
        const { data: { user: authUser } } = await supabase.auth.getUser();
        
        if (authUser) {
          const newProfile = {
            id: authUser.id,
            company_id: authUser.user_metadata?.company_id || 'm4-digital',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário',
            login: authUser.email || userId,
            role_id: 'manager-role', 
            active: true,
            must_change_password: true
          };

          // Usamos UPSERT para evitar 409 Conflict se o registro já existir mas estiver oculto por RLS
          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert([newProfile], { onConflict: 'id' });
          
          if (!upsertError) {
            setUser({
              id: newProfile.id,
              companyId: newProfile.company_id,
              name: newProfile.name,
              login: newProfile.login,
              role_id: newProfile.role_id,
              active: true,
              mustChangePassword: true
            });
          } else {
            console.error('[AuthContext] Erro fatal no auto-provisionamento:', upsertError);
          }
        }
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
      console.log(`[FinScale] Tentando login para: ${username}`);
      // Mapeia usuário básico para e-mail virtual interno se não for um e-mail real
      const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@finscale.internal`;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error("[FinScale] Erro Supabase Auth:", error.message, error.status);
        return { success: false, message: 'Login ou senha incorretos.' };
      }

      if (data.user) {
        console.log("[FinScale] Auth sucesso, carregando perfil...");
        await loadProfile(data.user.id);
        return { success: true };
      }

      return { success: false, message: 'Usuário não encontrado.' };
    } catch (error) {
      console.error("[FinScale] Erro inesperado no login:", error);
      return { success: false, message: 'Erro ao processar login.' };
    }
  };

  const logout = () => {
    console.log("[FinScale] Iniciando logout forçado...");
    
    // Limpeza síncrona imediata
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    
    // Logout assíncrono em segundo plano (não esperamos por ele)
    supabase.auth.signOut().catch(e => console.warn("[FinScale] SignOut error:", e));
    
    // Redirecionamento físico forçado
    console.log("[FinScale] Redirecionando para login...");
    window.location.href = '/login';
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
