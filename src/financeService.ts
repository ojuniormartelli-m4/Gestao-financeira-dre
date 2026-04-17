import { supabase } from './supabase';
import { Transaction, TransactionStatus, DREGroup, ChartOfAccount } from './types';

export const financeService = {
  async adicionarTransacao(companyId: string, data: Omit<Transaction, 'id' | 'createdAt'> & { userId?: string }) {
    try {
      const { data: insertedData, error } = await supabase
        .from('transactions')
        .insert([{
          company_id: companyId,
          description: data.description,
          amount: data.amount,
          type: data.type,
          category_id: data.categoryId,
          bank_account_id: data.bankAccountId,
          status: data.status,
          date_competence: data.dateCompetence.toISOString(),
          date_payment: data.datePayment ? data.datePayment.toISOString() : null,
          user_id: data.userId,
          is_conciliated: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Atualizar saldo da conta bancária se a transação estiver paga
      if (data.status === 'PAID' && data.bankAccountId) {
        const { data: bank, error: bankError } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', data.bankAccountId)
          .single();

        if (bank && !bankError) {
          const currentBalance = bank.current_balance || 0;
          const newBalance = data.type === 'REVENUE' 
            ? currentBalance + data.amount 
            : currentBalance - data.amount;
          
          await supabase
            .from('bank_accounts')
            .update({ current_balance: newBalance })
            .eq('id', data.bankAccountId);
        }
      }

      return insertedData.id;
    } catch (error) {
      console.error('Supabase Error (adicionarTransacao):', error);
      throw error;
    }
  },

  async editarTransacao(companyId: string, transactionId: string, data: Partial<Transaction>) {
    try {
      const updateData: any = {};
      if (data.description !== undefined) updateData.description = data.description;
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
      if (data.bankAccountId !== undefined) updateData.bank_account_id = data.bankAccountId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.dateCompetence) updateData.date_competence = data.dateCompetence.toISOString();
      if (data.datePayment) updateData.date_payment = data.datePayment.toISOString();
      if (data.isConciliated !== undefined) updateData.is_conciliated = data.isConciliated;

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (editarTransacao):', error);
      throw error;
    }
  },

  async buscarTransacoes(companyId: string, filters?: { startDate?: Date, endDate?: Date, bankAccountId?: string }) {
    try {
      let queryBuilder = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('date_competence', { ascending: false });
      
      if (filters?.startDate) {
        queryBuilder = queryBuilder.gte('date_competence', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        queryBuilder = queryBuilder.lte('date_competence', filters.endDate.toISOString());
      }
      if (filters?.bankAccountId && filters.bankAccountId !== 'all') {
        queryBuilder = queryBuilder.eq('bank_account_id', filters.bankAccountId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      return (data || []).map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        categoryId: tx.category_id,
        bankAccountId: tx.bank_account_id,
        status: tx.status,
        dateCompetence: new Date(tx.date_competence),
        datePayment: tx.date_payment ? new Date(tx.date_payment) : undefined,
        createdAt: new Date(tx.created_at),
        isConciliated: tx.is_conciliated
      })) as Transaction[];
    } catch (error) {
      console.error('Supabase Error (buscarTransacoes):', error);
      throw error;
    }
  },

  async buscarPlanoDeContas(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        dreGroup: item.dre_group
      })) as ChartOfAccount[];
    } catch (error) {
      console.error('Supabase Error (buscarPlanoDeContas):', error);
      throw error;
    }
  },

  async adicionarCategoria(companyId: string, categoria: Omit<ChartOfAccount, 'id'>) {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          company_id: companyId,
          name: categoria.name,
          type: categoria.type,
          dre_group: categoria.dreGroup
        }])
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (error) {
      console.error('Supabase Error (adicionarCategoria):', error);
      throw error;
    }
  },

  async excluirCategoria(companyId: string, categoryId: string) {
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (excluirCategoria):', error);
      throw error;
    }
  },

  async buscarContasBancarias(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        bankName: item.bank_name,
        initialBalance: item.initial_balance,
        currentBalance: item.current_balance,
        color: item.color
      }));
    } catch (error) {
      console.error('Supabase Error (buscarContasBancarias):', error);
      throw error;
    }
  },

  async adicionarContaBancaria(companyId: string, data: any) {
    try {
      const { data: insertedData, error } = await supabase
        .from('bank_accounts')
        .insert([{
          company_id: companyId,
          name: data.name,
          bank_name: data.bankName,
          initial_balance: Number(data.initialBalance),
          current_balance: Number(data.initialBalance),
          color: data.color
        }])
        .select()
        .single();

      if (error) throw error;
      return insertedData.id;
    } catch (error) {
      console.error('Supabase Error (adicionarContaBancaria):', error);
      throw error;
    }
  },

  async excluirContaBancaria(companyId: string, accountId: string) {
    try {
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (excluirContaBancaria):', error);
      throw error;
    }
  },

  async realizarTransferencia(companyId: string, data: { fromAccountId: string, toAccountId: string, amount: number, date: Date, description?: string, userId?: string }) {
    try {
      const { data: insertedData, error } = await supabase
        .from('transfers')
        .insert([{
          company_id: companyId,
          from_account_id: data.fromAccountId,
          to_account_id: data.toAccountId,
          amount: data.amount,
          date: data.date.toISOString(),
          description: data.description,
          user_id: data.userId,
          is_conciliated: false
        }])
        .select()
        .single();

      if (error) throw error;

      // Em produção usar RPC ou triggers para atomicidade
      // Aqui vamos buscar e atualizar manual (simplificado conforme original)
      const { data: fromBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', data.fromAccountId).single();
      const { data: toBank } = await supabase.from('bank_accounts').select('current_balance').eq('id', data.toAccountId).single();

      if (fromBank) {
        await supabase.from('bank_accounts').update({ current_balance: fromBank.current_balance - data.amount }).eq('id', data.fromAccountId);
      }
      if (toBank) {
        await supabase.from('bank_accounts').update({ current_balance: toBank.current_balance + data.amount }).eq('id', data.toAccountId);
      }
    } catch (error) {
      console.error('Supabase Error (realizarTransferencia):', error);
      throw error;
    }
  },

  async buscarTodasTransacoes(companyId: string, bankAccountId?: string) {
    try {
      let queryBuilder = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .order('date_competence', { ascending: false });

      if (bankAccountId && bankAccountId !== 'all') {
        queryBuilder = queryBuilder.eq('bank_account_id', bankAccountId);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      return (data || []).map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        categoryId: tx.category_id,
        bankAccountId: tx.bank_account_id,
        status: tx.status,
        dateCompetence: new Date(tx.date_competence),
        datePayment: tx.date_payment ? new Date(tx.date_payment) : undefined,
        createdAt: new Date(tx.created_at),
        isConciliated: tx.is_conciliated
      })) as Transaction[];
    } catch (error) {
      console.error('Supabase Error (buscarTodasTransacoes):', error);
      throw error;
    }
  },

  async conciliarTransacao(companyId: string, transactionId: string, isConciliated: boolean) {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ is_conciliated: isConciliated })
        .eq('id', transactionId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (conciliarTransacao):', error);
      throw error;
    }
  },

  async conciliarTransferencia(companyId: string, transferId: string, isConciliated: boolean) {
    try {
      const { error } = await supabase
        .from('transfers')
        .update({ is_conciliated: isConciliated })
        .eq('id', transferId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (conciliarTransferencia):', error);
      throw error;
    }
  },

  async importarTransacoes(companyId: string, bankAccountId: string, transactions: Omit<Transaction, 'id' | 'createdAt' | 'companyId'>[]) {
    try {
      const txsToInsert = transactions.map(tx => ({
        company_id: companyId,
        bank_account_id: bankAccountId,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        category_id: tx.categoryId,
        status: tx.status,
        date_competence: tx.dateCompetence.toISOString(),
        date_payment: tx.datePayment ? tx.datePayment.toISOString() : null,
        is_conciliated: false
      }));

      const { error } = await supabase.from('transactions').insert(txsToInsert);
      if (error) throw error;

      let totalBalanceChange = 0;
      transactions.forEach(tx => {
        if (tx.status === 'PAID') {
          totalBalanceChange += tx.type === 'REVENUE' ? tx.amount : -tx.amount;
        }
      });

      if (totalBalanceChange !== 0) {
        const { data: bank } = await supabase.from('bank_accounts').select('current_balance').eq('id', bankAccountId).single();
        if (bank) {
          await supabase.from('bank_accounts').update({ current_balance: bank.current_balance + totalBalanceChange }).eq('id', bankAccountId);
        }
      }
    } catch (error) {
      console.error('Supabase Error (importarTransacoes):', error);
      throw error;
    }
  },

  async buscarExtratoConta(companyId: string, accountId: string) {
    try {
      const [txResult, tfFromResult, tfToResult, bankResult] = await Promise.all([
        supabase.from('transactions').select('*').eq('bank_account_id', accountId).order('date_competence', { ascending: true }),
        supabase.from('transfers').select('*').eq('from_account_id', accountId).order('date', { ascending: true }),
        supabase.from('transfers').select('*').eq('to_account_id', accountId).order('date', { ascending: true }),
        supabase.from('bank_accounts').select('*').eq('id', accountId).single()
      ]);

      if (bankResult.error || !bankResult.data) return null;

      const bankData = bankResult.data;
      const initialBalance = bankData.initial_balance || 0;

      const movements: any[] = [];

      (txResult.data || []).forEach(tx => {
        movements.push({
          id: tx.id,
          type: 'TRANSACTION',
          date: new Date(tx.date_competence),
          description: tx.description,
          amount: tx.type === 'REVENUE' ? tx.amount : -tx.amount,
          isConciliated: tx.is_conciliated
        });
      });

      (tfFromResult.data || []).forEach(tf => {
        movements.push({
          id: tf.id,
          type: 'TRANSFER_OUT',
          date: new Date(tf.date),
          description: `Transferência para outra conta: ${tf.description || ''}`,
          amount: -tf.amount,
          isConciliated: tf.is_conciliated
        });
      });

      (tfToResult.data || []).forEach(tf => {
        movements.push({
          id: tf.id,
          type: 'TRANSFER_IN',
          date: new Date(tf.date),
          description: `Transferência recebida: ${tf.description || ''}`,
          amount: tf.amount,
          isConciliated: tf.is_conciliated
        });
      });

      movements.sort((a, b) => a.date.getTime() - b.date.getTime());

      let runningBalance = initialBalance;
      const movementsWithBalance = movements.map(m => {
        runningBalance += m.amount;
        return { ...m, runningBalance };
      });

      return {
        initialBalance,
        movements: movementsWithBalance
      };
    } catch (error) {
      console.error('Supabase Error (buscarExtratoConta):', error);
      return null;
    }
  },

  async buscarProximosVencimentos(companyId: string) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const seteDias = new Date();
    seteDias.setDate(hoje.getDate() + 7);

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'PENDING')
        .gte('date_competence', hoje.toISOString())
        .lte('date_competence', seteDias.toISOString())
        .order('date_competence', { ascending: true })
        .limit(5);

      if (error) throw error;

      return (data || []).map(tx => ({ 
        id: tx.id, 
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        bankAccountId: tx.bank_account_id,
        dateCompetence: new Date(tx.date_competence)
      }));
    } catch (error) {
      console.error('Supabase Error (buscarProximosVencimentos):', error);
      return [];
    }
  },

  async exportarBackupCompleto(companyId: string) {
    try {
      const tables = ['transactions', 'transfers', 'bank_accounts', 'categories', 'company_configs', 'profiles', 'roles'];
      const backup: any = {};
      
      await Promise.all(tables.map(async (table) => {
        const { data } = await supabase.from(table).select('*');
        backup[table] = data || [];
      }));

      return backup;
    } catch (error) {
      console.error('Supabase Error (exportarBackupCompleto):', error);
      return null;
    }
  },

  async buscarConfiguracaoEmpresa(companyId: string) {
    try {
      const { data, error } = await supabase
        .from('company_configs')
        .select('*')
        .eq('company_id', companyId)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is code for no rows returned
      
      if (data) {
        return {
          name: data.name,
          logoUrl: data.logo_url
        };
      }
      return null;
    } catch (error) {
      console.error('Supabase Error (buscarConfiguracaoEmpresa):', error);
      throw error;
    }
  },

  async salvarConfiguracaoEmpresa(companyId: string, data: any) {
    try {
      const { error } = await supabase
        .from('company_configs')
        .upsert({ 
          company_id: companyId, 
          name: data.name, 
          logo_url: data.logoUrl 
        }, { onConflict: 'company_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarConfiguracaoEmpresa):', error);
      throw error;
    }
  }
};

export async function gerarDRE(companyId: string, mes: number, ano: number, bankAccountId?: string) {
  const startDate = new Date(ano, mes - 1, 1);
  const endDate = new Date(ano, mes, 0, 23, 59, 59);

  const [transacoes, planoContas] = await Promise.all([
    financeService.buscarTransacoes(companyId, { startDate, endDate }),
    financeService.buscarPlanoDeContas(companyId)
  ]);

  if (!transacoes || !planoContas) return null;

  const categoriasMap = new Map(planoContas.map(c => [c.id, c]));
  
  const dre = {
    GROSS_REVENUE: 0,
    TAX: 0,
    VARIABLE_COST: 0,
    FIXED_COST: 0,
    NON_OPERATING: 0,
    INVESTMENT: 0,
    netRevenue: 0,
    contributionMargin: 0,
    ebitda: 0,
    netProfit: 0
  };

  transacoes.forEach(t => {
    // Filtro por banco
    if (bankAccountId && t.bankAccountId !== bankAccountId) return;

    const categoria = categoriasMap.get(t.categoryId);
    if (!categoria) return;

    const amount = t.amount;
    if (categoria.dreGroup in dre) {
      (dre as any)[categoria.dreGroup] += amount;
    }
  });

  // Cálculos da DRE
  dre.netRevenue = dre.GROSS_REVENUE - dre.TAX;
  dre.contributionMargin = dre.netRevenue - dre.VARIABLE_COST;
  dre.ebitda = dre.contributionMargin - dre.FIXED_COST;
  dre.netProfit = dre.ebitda - dre.NON_OPERATING; // Simplificado

  return dre;
}
