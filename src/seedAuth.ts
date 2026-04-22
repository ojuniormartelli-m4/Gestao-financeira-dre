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

export async function createAdminUser(companyId: string, email: string = 'admin@finscale.com', password: string = 'admin123') {
  // 1. Criar usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    if (authError.message.includes('User already registered')) {
      console.log('Admin user already exists in Auth.');
      // Tentar buscar o usuário existente para garantir que o perfil exista
      const { data: { user: existingAuthUser } } = await supabase.auth.signInWithPassword({ email, password });
      if (existingAuthUser) {
        await ensureProfileExists(existingAuthUser.id, companyId, email);
      }
      return;
    }
    throw authError;
  }

  if (authData.user) {
    await ensureProfileExists(authData.user.id, companyId, email);
  }
}

async function ensureProfileExists(userId: string, companyId: string, email: string) {
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', userId).single();

  if (!existingProfile) {
    const { error: profileError } = await supabase.from('profiles').insert([{
      id: userId,
      company_id: companyId,
      name: 'Administrador do Sistema',
      login: email,
      role_id: 'admin-role',
      photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
      active: true
    }]);
    if (profileError) throw profileError;
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
