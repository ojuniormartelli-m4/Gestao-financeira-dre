import { supabase } from './supabase';

export async function verifyConnection() {
  const { error } = await supabase.from('roles').select('id').limit(1);
  if (error && error.code !== 'PGRST116') throw error;
  return true;
}

export async function createRoles() {
  const roles = [
    { id: 'admin-role', name: 'Administrador' },
    { id: 'manager-role', name: 'Gerente' },
    { id: 'supervisor-role', name: 'Supervisor' },
    { id: 'finance-role', name: 'Financeiro' },
    { id: 'viewer-role', name: 'Consulta' }
  ];

  const { error } = await supabase.from('roles').upsert(roles.map(r => ({ id: r.id, name: r.name })));
  if (error) throw error;
}

export async function createChartOfAccounts(companyId: string) {
  const defaultCategories = [
    { name: 'Venda de Produtos', type: 'REVENUE', dre_group: 'GROSS_REVENUE' },
    { name: 'Prestação de Serviços', type: 'REVENUE', dre_group: 'GROSS_REVENUE' },
    { name: 'Impostos sobre Vendas', type: 'EXPENSE', dre_group: 'TAX' },
    { name: 'Fornecedores / Mercadorias', type: 'EXPENSE', dre_group: 'VARIABLE_COST' },
    { name: 'Fretes e Carretos', type: 'EXPENSE', dre_group: 'VARIABLE_COST' },
    { name: 'Aluguel e Condomínio', type: 'EXPENSE', dre_group: 'FIXED_COST' },
    { name: 'Salários e Encargos', type: 'EXPENSE', dre_group: 'FIXED_COST' },
    { name: 'Energia / Água / Internet', type: 'EXPENSE', dre_group: 'FIXED_COST' },
    { name: 'Marketing e Vendas', type: 'EXPENSE', dre_group: 'FIXED_COST' },
    { name: 'Tarifas Bancárias', type: 'EXPENSE', dre_group: 'NON_OPERATING' },
    { name: 'Receitas Financeiras', type: 'REVENUE', dre_group: 'NON_OPERATING' }
  ];

  const { error } = await supabase.from('chart_of_accounts').insert(defaultCategories.map(cat => ({ ...cat, company_id: companyId })));
  if (error) throw error;
}

export async function createAdminUser(companyId: string, username: string = 'admin', password: string = 'admin123') {
  const email = `${username}@finscale.internal`;
  console.log('[seedAuth] Iniciando criação do admin:', email);

  // 0. Garantir configuração da empresa para evitar erro 406
  await supabase.from('company_configs').upsert({
    company_id: companyId,
    name: 'Minha Empresa FinScale'
  });
  
  // 1. Criar usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_id: companyId,
        full_name: 'Administrador do Sistema'
      }
    }
  });

  if (authError) {
    if (authError.message.includes('User already registered') || authError.code === '23505') {
      console.log('[seedAuth] Usuário admin já existe no Auth. Tentando vincular perfil...');
      
      // Tentativa de login forçado para obter o ID (pode falhar se a senha mudou, mas é um fallback para onboarding)
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (loginData?.user) {
        await ensureProfileExists(loginData.user.id, companyId, email);
        return;
      }
      
      // Se falhar o login, o usuário existe mas a senha é outra. 
      // No contexto de onboarding, vamos apenas logar e avisar.
      console.error('[seedAuth] Erro ao logar admin existente:', loginError?.message);
      throw new Error('Usuário admin já existe com outra senha. Tente fazer login.');
    }
    throw authError;
  }

  if (authData.user) {
    console.log('[seedAuth] Usuário Auth criado com sucesso:', authData.user.id);
    await ensureProfileExists(authData.user.id, companyId, email);
  } else {
    console.warn('[seedAuth] SignUp completado mas nenhum usuário retornado (aguarda confirmação?).');
    throw new Error('Criação do usuário retentada sem sucesso. Verifique configurações do Supabase (Auto Confirm).');
  }
}

async function ensureProfileExists(userId: string, companyId: string, email: string) {
  console.log('[seedAuth] Verificando se perfil existe para:', userId);
  const { data: existingProfile, error: checkError } = await supabase.from('profiles').select('id').eq('id', userId).single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('[seedAuth] Erro ao verificar perfil:', checkError);
  }

  if (!existingProfile) {
    console.log('[seedAuth] Criando novo perfil para:', userId);
    const { error: profileError } = await supabase.from('profiles').insert([{
      id: userId,
      company_id: companyId,
      name: 'Administrador do Sistema',
      login: email,
      role_id: 'admin-role',
      photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      active: true,
      must_change_password: true
    }]);
    
    if (profileError) {
      console.error('[seedAuth] Erro CRÍTICO ao criar perfil:', profileError);
      throw new Error(`Erro ao criar perfil no banco: ${profileError.message}. Verifique se o RLS está desativado.`);
    }
    console.log('[seedAuth] Perfil criado com sucesso.');
  } else {
    console.log('[seedAuth] Perfil já existe, ignorando criação.');
  }
}

// Mantendo compatibilidade se necessário
export async function seedAuthData(companyId: string) {
  try {
    await verifyConnection();
    await createRoles();
    await createChartOfAccounts(companyId);
    await createAdminUser(companyId);
    return { success: true };
  } catch (error) {
    console.error(error);
    return { success: false, error };
  }
}
