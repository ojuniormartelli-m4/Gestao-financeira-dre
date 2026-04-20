import { supabase } from './supabase';
import { Transaction, TransactionStatus, DREGroup, ChartOfAccount } from './types';

export const financeService = {
  async adicionarTransacao(companyId: string, data: Omit<Transaction, 'id' | 'createdAt'> & { userId?: string }) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      
      // Criar objeto de inserção dinâmico para evitar erros se colunas opcionais não existirem no banco
      const insertData: any = {
        company_id: normalizedCompanyId,
        description: data.description,
        amount: data.amount,
        type: data.type,
        category_id: data.categoryId,
        bank_account_id: data.bankAccountId,
        status: data.status,
        date_competence: data.dateCompetence.toISOString(),
        date_payment: data.datePayment ? data.datePayment.toISOString() : null,
        is_conciliated: false
      };

      // Só adiciona campos opcionais se eles tiverem valor
      if (data.userId) insertData.user_id = data.userId;
      if (data.costCenterId) insertData.cost_center_id = data.costCenterId;
      if (data.contactId) insertData.contact_id = data.contactId;
      if (data.paymentMethodId) insertData.payment_method_id = data.paymentMethodId;
      if (data.creditCardId) insertData.credit_card_id = data.creditCardId;

      let { data: insertedData, error } = await supabase
        .from('transactions')
        .insert([insertData])
        .select()
        .single();

      // Fallback: Se falhar por causa do user_id (perfil inexistente), tentamos salvar sem vincular o usuário
      if (error && error.code === '23503' && (error.message?.includes('user_id') || error.details?.includes('user_id'))) {
        console.warn('[financeService] Vínculo de usuário falhou (perfil não encontrado). Tentando salvar sem user_id...');
        const backupData = { ...insertData };
        delete backupData.user_id;
        
        const retry = await supabase
          .from('transactions')
          .insert([backupData])
          .select()
          .single();
        
        insertedData = retry.data;
        error = retry.error;
      }

      if (error) {
        console.error('Erro detalhado do Supabase (Insert):', error);
        throw error;
      }

      // Atualizar saldo da conta bancária se a transação estiver paga e não for cartão de crédito
      if (data.status === 'PAID' && data.bankAccountId && !data.creditCardId) {
        const { data: bank, error: bankError } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', data.bankAccountId)
          .single();

        if (bank && !bankError) {
          const currentBalance = bank.current_balance || 0;
          const newBalance = data.type === 'REVENUE' 
            ? Number(currentBalance) + data.amount 
            : Number(currentBalance) - data.amount;
          
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
      const normalizedCompanyId = String(companyId || '').trim();
      
      // Buscar transação atual para comparar mudanças (necessário para saldo)
      const { data: oldTx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId)
        .single();
      
      if (fetchError || !oldTx) throw fetchError || new Error('Transação não encontrada');

      const updateData: any = {};
      if (data.description !== undefined) updateData.description = data.description;
      if (data.amount !== undefined) updateData.amount = data.amount;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.categoryId !== undefined) updateData.category_id = data.categoryId;
      if (data.bankAccountId !== undefined) updateData.bank_account_id = data.bankAccountId;
      if (data.costCenterId !== undefined) updateData.cost_center_id = data.costCenterId;
      if (data.contactId !== undefined) updateData.contact_id = data.contactId;
      if (data.paymentMethodId !== undefined) updateData.payment_method_id = data.paymentMethodId;
      if (data.creditCardId !== undefined) updateData.credit_card_id = data.creditCardId;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.dateCompetence) updateData.date_competence = data.dateCompetence.toISOString();
      if (data.datePayment) updateData.date_payment = data.datePayment.toISOString();
      else if (data.status === 'PAID' && !oldTx.date_payment) updateData.date_payment = new Date().toISOString();
      else if (data.status === 'PENDING') updateData.date_payment = null;
      
      if (data.isConciliated !== undefined) updateData.is_conciliated = data.isConciliated;

      const { error } = await supabase
        .from('transactions')
        .update(updateData)
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;

      // Lógica de saldo: se mudou status, valor ou conta bancária
      const isPaidNow = (data.status || oldTx.status) === 'PAID';
      const wasPaid = oldTx.status === 'PAID';
      
      // Se estava paga ou ficou paga agora, precisamos ajustar o saldo
      if (isPaidNow || wasPaid) {
        // Estornar antigo (se existia)
        if (wasPaid && oldTx.bank_account_id) {
          const { data: bank } = await supabase.from('bank_accounts').select('current_balance').eq('id', oldTx.bank_account_id).single();
          if (bank) {
            const adj = oldTx.type === 'REVENUE' ? -oldTx.amount : oldTx.amount;
            await supabase.from('bank_accounts').update({ current_balance: bank.current_balance + adj }).eq('id', oldTx.bank_account_id);
          }
        }
        
        // Aplicar novo (se estiver pago)
        if (isPaidNow) {
          const finalBankId = data.bankAccountId || oldTx.bank_account_id;
          const finalAmount = data.amount !== undefined ? data.amount : oldTx.amount;
          const finalType = data.type || oldTx.type;
          
          if (finalBankId) {
            const { data: bank } = await supabase.from('bank_accounts').select('current_balance').eq('id', finalBankId).single();
            if (bank) {
              const adj = finalType === 'REVENUE' ? finalAmount : -finalAmount;
              await supabase.from('bank_accounts').update({ current_balance: bank.current_balance + adj }).eq('id', finalBankId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Supabase Error (editarTransacao):', error);
      throw error;
    }
  },

  async excluirTransacao(companyId: string, transactionId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      
      const { data: tx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId)
        .single();
      
      if (fetchError || !tx) throw fetchError || new Error('Transação não encontrada');

      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;

      if (tx.status === 'PAID' && tx.bank_account_id) {
        const { data: bank } = await supabase.from('bank_accounts').select('current_balance').eq('id', tx.bank_account_id).single();
        if (bank) {
          const adj = tx.type === 'REVENUE' ? -tx.amount : tx.amount;
          await supabase.from('bank_accounts').update({ current_balance: bank.current_balance + adj }).eq('id', tx.bank_account_id);
        }
      }
    } catch (error) {
      console.error('Supabase Error (excluirTransacao):', error);
      throw error;
    }
  },

  async buscarTransacoes(companyId: string, filters?: { startDate?: Date, endDate?: Date, bankAccountId?: string, costCenterId?: string, status?: string }) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      
      console.log('Buscando transações entre:', filters?.startDate?.toISOString(), 'e', filters?.endDate?.toISOString());

      let queryBuilder = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', normalizedCompanyId)
        .order('date_competence', { ascending: false });
      
      if (filters?.startDate) {
        // Garantir início do dia (00:00:00) para gte
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        queryBuilder = queryBuilder.gte('date_competence', start.toISOString());
      }
      if (filters?.endDate) {
        // Garantir fim do dia (23:59:59) para lte
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        queryBuilder = queryBuilder.lte('date_competence', end.toISOString());
      }
      
      if (filters?.bankAccountId && filters.bankAccountId !== 'all' && filters.bankAccountId !== '') {
        queryBuilder = queryBuilder.eq('bank_account_id', filters.bankAccountId);
      }
      if (filters?.costCenterId && filters.costCenterId !== 'all') {
        queryBuilder = queryBuilder.eq('cost_center_id', filters.costCenterId);
      }
      if (filters?.status && filters.status !== 'ALL') {
        queryBuilder = queryBuilder.eq('status', filters.status);
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      return (data || []).map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: Number(tx.amount || 0),
        type: tx.type,
        categoryId: tx.category_id,
        bankAccountId: tx.bank_account_id,
        costCenterId: tx.cost_center_id,
        contactId: tx.contact_id,
        paymentMethodId: tx.payment_method_id,
        creditCardId: tx.credit_card_id,
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('company_id', normalizedCompanyId);

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
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .insert([{
          company_id: normalizedCompanyId,
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', categoryId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (excluirCategoria):', error);
      throw error;
    }
  },

  async buscarContasBancarias(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      console.log(`[financeService] Buscando contas bancárias para: ${normalizedCompanyId}`);
      // Explicit select and filtering only by company_id to test RLS impacts
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', normalizedCompanyId);

      if (error) {
        console.error('[financeService] Erro ao buscar contas:', error);
        throw error;
      }
      
      console.log(`[financeService] Contas retornadas pelo banco:`, data);
      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        bankName: item.bank_name,
        initialBalance: Number(item.initial_balance || 0),
        currentBalance: Number(item.current_balance || 0),
        color: item.color
      }));
    } catch (error) {
      console.error('Supabase Error (buscarContasBancarias):', error);
      throw error;
    }
  },

  async adicionarContaBancaria(companyId: string, data: any) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { data: insertedData, error } = await supabase
        .from('bank_accounts')
        .insert([{
          company_id: normalizedCompanyId,
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('bank_accounts')
        .delete()
        .eq('id', accountId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (excluirContaBancaria):', error);
      throw error;
    }
  },

  async realizarTransferencia(companyId: string, data: { fromAccountId: string, toAccountId: string, amount: number, date: Date, description?: string, userId?: string }) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { data: insertedData, error } = await supabase
        .from('transfers')
        .insert([{
          company_id: normalizedCompanyId,
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
      const normalizedCompanyId = String(companyId || '').trim();
      let queryBuilder = supabase
        .from('transactions')
        .select('*')
        .eq('company_id', normalizedCompanyId)
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('transactions')
        .update({ is_conciliated: isConciliated })
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (conciliarTransacao):', error);
      throw error;
    }
  },

  async quitarTransacao(companyId: string, transactionId: string, status: TransactionStatus) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const now = new Date();
      const { data: tx, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId)
        .single();
      
      if (fetchError || !tx) throw fetchError || new Error('Transação não encontrada');

      const { error } = await supabase
        .from('transactions')
        .update({ 
          status, 
          date_payment: status === 'PAID' ? now.toISOString() : null 
        })
        .eq('id', transactionId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;

      // Se mudou para pago, atualizar saldo
      if (status === 'PAID' && tx.bank_account_id) {
        const { data: bank, error: bankError } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', tx.bank_account_id)
          .single();

        if (bank && !bankError) {
          const currentBalance = bank.current_balance || 0;
          const newBalance = tx.type === 'REVENUE' 
            ? currentBalance + tx.amount 
            : currentBalance - tx.amount;
          
          await supabase
            .from('bank_accounts')
            .update({ current_balance: newBalance })
            .eq('id', tx.bank_account_id);
        }
      } else if (status === 'PENDING' && tx.status === 'PAID' && tx.bank_account_id) {
        // Se mudou de pago para pendente, estornar saldo
        const { data: bank, error: bankError } = await supabase
          .from('bank_accounts')
          .select('current_balance')
          .eq('id', tx.bank_account_id)
          .single();

        if (bank && !bankError) {
          const currentBalance = bank.current_balance || 0;
          const newBalance = tx.type === 'REVENUE' 
            ? currentBalance - tx.amount 
            : currentBalance + tx.amount;
          
          await supabase
            .from('bank_accounts')
            .update({ current_balance: newBalance })
            .eq('id', tx.bank_account_id);
        }
      }
    } catch (error) {
      console.error('Supabase Error (quitarTransacao):', error);
      throw error;
    }
  },

  // Centros de Custo
  async buscarCentrosCusto(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      // Incluir ativos ou nulos (que podem ter sido criados sem o campo active)
      const { data, error } = await supabase
        .from('cost_centers')
        .select('*')
        .eq('company_id', normalizedCompanyId)
        .or('active.eq.true,active.is.null')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Supabase Error (buscarCentrosCusto):', error);
      throw error;
    }
  },

  async salvarCentroCusto(companyId: string, data: any) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const payload = { ...data, company_id: normalizedCompanyId };
      const { error } = await supabase
        .from('cost_centers')
        .upsert(payload);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarCentroCusto):', error);
      throw error;
    }
  },

  async excluirCentroCusto(id: string) {
    const { error } = await supabase.from('cost_centers').delete().eq('id', id);
    if (error) throw error;
  },

  // Contatos
  async buscarContatos(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('company_id', normalizedCompanyId)
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Supabase Error (buscarContatos):', error);
      throw error;
    }
  },

  async salvarContato(companyId: string, data: any) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const payload = { ...data, company_id: normalizedCompanyId };
      const { error } = await supabase
        .from('contacts')
        .upsert(payload);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarContato):', error);
      throw error;
    }
  },

  async excluirContato(id: string) {
    const { error } = await supabase.from('contacts').delete().eq('id', id);
    if (error) throw error;
  },

  // Formas de Pagamento
  async buscarFormasPagamento(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      // Incluir ativos ou nulos
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('company_id', normalizedCompanyId)
        .or('active.eq.true,active.is.null')
        .order('name');
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Supabase Error (buscarFormasPagamento):', error);
      throw error;
    }
  },

  async salvarFormaPagamento(companyId: string, data: any) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const payload = { ...data, company_id: normalizedCompanyId };
      const { error } = await supabase
        .from('payment_methods')
        .upsert(payload);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarFormaPagamento):', error);
      throw error;
    }
  },

  async excluirFormaPagamento(id: string) {
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) throw error;
  },

  async verificarEPovoarDadosIniciais(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      
      // 1. Verificar se já existem categorias
      const { data: existingCats, error: catError } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('company_id', normalizedCompanyId)
        .limit(1);
      
      if (catError) throw catError;

      // Se não houver nada, povoamos os dados básicos
      if (!existingCats || existingCats.length === 0) {
        console.log(`[financeService] Povoando dados iniciais para a empresa: ${normalizedCompanyId}`);
        
        // Categorias Padrão
        const defaultCategories = [
          { company_id: normalizedCompanyId, name: 'Vendas de Produtos', type: 'REVENUE', dre_group: 'Receita Bruta' },
          { company_id: normalizedCompanyId, name: 'Prestação de Serviços', type: 'REVENUE', dre_group: 'Receita Bruta' },
          { company_id: normalizedCompanyId, name: 'Aluguel', type: 'EXPENSE', dre_group: 'Custos Fixos' },
          { company_id: normalizedCompanyId, name: 'Salários', type: 'EXPENSE', dre_group: 'Custos Fixos' },
          { company_id: normalizedCompanyId, name: 'Marketing', type: 'EXPENSE', dre_group: 'Custos Variáveis' },
          { company_id: normalizedCompanyId, name: 'Impostos', type: 'EXPENSE', dre_group: 'Impostos' },
          { company_id: normalizedCompanyId, name: 'Material de Escritório', type: 'EXPENSE', dre_group: 'Custos Fixos' }
        ];

        // Formas de Pagamento Padrão
        const defaultPaymentMethods = [
          { company_id: normalizedCompanyId, name: 'Dinheiro', active: true },
          { company_id: normalizedCompanyId, name: 'Pix', active: true },
          { company_id: normalizedCompanyId, name: 'Cartão de Crédito', active: true },
          { company_id: normalizedCompanyId, name: 'Cartão de Débito', active: true },
          { company_id: normalizedCompanyId, name: 'Transferência Bancária', active: true },
          { company_id: normalizedCompanyId, name: 'Boleto', active: true }
        ];

        // Centros de Custo Padrão
        const defaultCostCenters = [
          { company_id: normalizedCompanyId, name: 'Administrativo', active: true },
          { company_id: normalizedCompanyId, name: 'Comercial', active: true },
          { company_id: normalizedCompanyId, name: 'Operacional', active: true }
        ];

        await Promise.all([
          supabase.from('chart_of_accounts').insert(defaultCategories),
          supabase.from('payment_methods').insert(defaultPaymentMethods),
          supabase.from('cost_centers').insert(defaultCostCenters)
        ]);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Supabase Error (verificarEPovoarDadosIniciais):', error);
      return false;
    }
  },

  async conciliarTransferencia(companyId: string, transferId: string, isConciliated: boolean) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('transfers')
        .update({ is_conciliated: isConciliated })
        .eq('id', transferId)
        .eq('company_id', normalizedCompanyId);

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (conciliarTransferencia):', error);
      throw error;
    }
  },

  async importarTransacoes(companyId: string, bankAccountId: string, transactions: Omit<Transaction, 'id' | 'createdAt' | 'companyId'>[]) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const txsToInsert = transactions.map(tx => ({
        company_id: normalizedCompanyId,
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
      const normalizedCompanyId = String(companyId || '').trim();
      const [txResult, tfFromResult, tfToResult, bankResult] = await Promise.all([
        supabase.from('transactions').select('*').eq('bank_account_id', accountId).eq('company_id', normalizedCompanyId).order('date_competence', { ascending: true }),
        supabase.from('transfers').select('*').eq('from_account_id', accountId).eq('company_id', normalizedCompanyId).order('date', { ascending: true }),
        supabase.from('transfers').select('*').eq('to_account_id', accountId).eq('company_id', normalizedCompanyId).order('date', { ascending: true }),
        supabase.from('bank_accounts').select('*').eq('id', accountId).eq('company_id', normalizedCompanyId).single()
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('company_id', normalizedCompanyId)
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
      const tables = ['transactions', 'transfers', 'bank_accounts', 'chart_of_accounts', 'company_configs', 'profiles', 'roles'];
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('company_configs')
        .select('*')
        .eq('company_id', normalizedCompanyId)
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
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('company_configs')
        .upsert({ 
          company_id: normalizedCompanyId, 
          name: data.name, 
          logo_url: data.logoUrl 
        }, { onConflict: 'company_id' });

      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarConfiguracaoEmpresa):', error);
      throw error;
    }
  },

  async buscarExtratoPorConta(companyId: string, bankAccountId: string, month: number, year: number) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          *,
          category:chart_of_accounts(name)
        `)
        .eq('company_id', normalizedCompanyId)
        .eq('bank_account_id', bankAccountId)
        .eq('status', 'PAID')
        .gte('date_payment', startDate.toISOString())
        .lte('date_payment', endDate.toISOString())
        .order('date_payment', { ascending: true });

      if (error) throw error;

      return (data || []).map(tx => ({
        id: tx.id,
        description: tx.description,
        amount: tx.amount,
        type: tx.type,
        categoryName: tx.category?.name || 'N/A',
        datePayment: new Date(tx.date_payment),
        isConciliated: tx.is_conciliated
      }));
    } catch (error) {
      console.error('Supabase Error (buscarExtratoPorConta):', error);
      throw error;
    }
  },

  async buscarFluxoDeCaixaReal(companyId: string, months: number = 6, bankAccountId?: string, costCenterId?: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
      
      let queryBuilder = supabase
        .from('transactions')
        .select('amount, type, date_payment')
        .eq('company_id', normalizedCompanyId)
        .eq('status', 'PAID')
        .gte('date_payment', startDate.toISOString());

      if (bankAccountId && bankAccountId !== 'all') {
        queryBuilder = queryBuilder.eq('bank_account_id', bankAccountId);
      }
      if (costCenterId && costCenterId !== 'all') {
        queryBuilder = queryBuilder.eq('cost_center_id', costCenterId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      return (data || []).map(tx => ({
        amount: tx.amount,
        type: tx.type,
        date: new Date(tx.date_payment)
      }));
    } catch (error) {
      console.error('Supabase Error (buscarFluxoDeCaixaReal):', error);
      throw error;
    }
  },

  async buscarCartoesCredito(companyId: string) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('company_id', normalizedCompanyId);
      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        companyId: c.company_id,
        name: c.name,
        limit: c.credit_limit,
        closingDay: c.closing_day,
        dueDay: c.due_day,
        bankAccountId: c.bank_account_id
      }));
    } catch (error) {
      console.error('Supabase Error (buscarCartoesCredito):', error);
      throw error;
    }
  },

  async salvarCartaoCredito(companyId: string, data: any) {
    try {
      const normalizedCompanyId = String(companyId || '').trim();
      const { error } = await supabase
        .from('credit_cards')
        .upsert({
          company_id: normalizedCompanyId,
          name: data.name,
          credit_limit: data.limit,
          closing_day: data.closingDay,
          due_day: data.dueDay,
          bank_account_id: data.bankAccountId
        });
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (salvarCartaoCredito):', error);
      throw error;
    }
  },

  async excluirCartaoCredito(id: string) {
    try {
      const { error } = await supabase.from('credit_cards').delete().eq('id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Supabase Error (excluirCartaoCredito):', error);
      throw error;
    }
  }
};

export async function gerarDRE(companyId: string, mes: number, ano: number, bankAccountId?: string, costCenterId?: string) {
  const normalizedCompanyId = String(companyId || '').trim();
  const startDate = new Date(ano, mes - 1, 1);
  const endDate = new Date(ano, mes, 0, 23, 59, 59);

  const [transacoes, planoContas] = await Promise.all([
    financeService.buscarTransacoes(normalizedCompanyId, { 
      startDate, 
      endDate, 
      bankAccountId, 
      costCenterId,
      status: 'PAID' // EBITDA e DRE gerencial consideram apenas o que foi efetivado (Regime de Caixa para o usuário)
    }),
    financeService.buscarPlanoDeContas(normalizedCompanyId)
  ]);

  if (!transacoes || !planoContas) return null;

  const categoriasMap = new Map(planoContas.map(c => [c.id, c]));
  
  const dre: any = {
    GROSS_REVENUE: 0,
    TAX: 0,
    VARIABLE_COST: 0,
    FIXED_COST: 0,
    NON_OPERATING: 0,
    INVESTMENT: 0,
    netRevenue: 0,
    contributionMargin: 0,
    ebitda: 0,
    netProfit: 0,
    groups: {}
  };

  transacoes.forEach(t => {
    const categoria = categoriasMap.get(t.categoryId);
    if (!categoria) return;

    const amount = t.amount;
    const groupKey = categoria.dreGroup;
    
    if (groupKey in dre) {
      (dre as any)[groupKey] += amount;
    }

    // Agrupar por categoria para detalhamento
    if (!dre.groups[groupKey]) dre.groups[groupKey] = {};
    if (!dre.groups[groupKey][categoria.name]) dre.groups[groupKey][categoria.name] = 0;
    dre.groups[groupKey][categoria.name] += amount;
  });

  // Cálculos da DRE
  dre.netRevenue = dre.GROSS_REVENUE - dre.TAX;
  dre.contributionMargin = dre.netRevenue - dre.VARIABLE_COST;
  dre.ebitda = dre.contributionMargin - dre.FIXED_COST;
  dre.netProfit = dre.ebitda - dre.NON_OPERATING - dre.INVESTMENT;

  return dre;
}
