import { financeService } from './financeService';

export async function popularDadosTeste(companyId: string) {
  const categorias = [
    { name: 'Venda de Produtos', type: 'REVENUE', dreGroup: 'GROSS_REVENUE' },
    { name: 'Prestação de Serviços', type: 'REVENUE', dreGroup: 'GROSS_REVENUE' },
    { name: 'Impostos sobre Vendas', type: 'EXPENSE', dreGroup: 'TAX' },
    { name: 'Fornecedores (Matéria Prima)', type: 'EXPENSE', dreGroup: 'VARIABLE_COST' },
    { name: 'Aluguel Escritório', type: 'EXPENSE', dreGroup: 'FIXED_COST' },
    { name: 'Salários Equipe', type: 'EXPENSE', dreGroup: 'FIXED_COST' },
    { name: 'Marketing', type: 'EXPENSE', dreGroup: 'FIXED_COST' },
    { name: 'Tarifas Bancárias', type: 'EXPENSE', dreGroup: 'NON_OPERATING' },
  ];

  console.log('Populando Plano de Contas...');
  const catIds: string[] = [];
  for (const cat of categorias) {
    const id = await financeService.adicionarCategoria(companyId, {
      companyId,
      name: cat.name,
      type: cat.type as any,
      dreGroup: cat.dreGroup as any
    });
    if (id) catIds.push(id);
  }

  const hoje = new Date();
  const mesAtual = hoje.getMonth();
  const anoAtual = hoje.getFullYear();

  const transacoes = [
    { desc: 'Venda Cliente A', val: 5000, catIdx: 0, status: 'PAID', comp: new Date(anoAtual, mesAtual, 5), pag: new Date(anoAtual, mesAtual, 5) },
    { desc: 'Venda Cliente B', val: 3500, catIdx: 0, status: 'PENDING', comp: new Date(anoAtual, mesAtual, 10) },
    { desc: 'Projeto Consultoria', val: 12000, catIdx: 1, status: 'PAID', comp: new Date(anoAtual, mesAtual, 15), pag: new Date(anoAtual, mesAtual, 16) },
    { desc: 'DAS Simples Nacional', val: 850, catIdx: 2, status: 'PAID', comp: new Date(anoAtual, mesAtual, 20), pag: new Date(anoAtual, mesAtual, 20) },
    { desc: 'Compra de Estoque', val: 2200, catIdx: 3, status: 'PAID', comp: new Date(anoAtual, mesAtual, 2), pag: new Date(anoAtual, mesAtual, 3) },
    { desc: 'Aluguel Mensal', val: 3000, catIdx: 4, status: 'PAID', comp: new Date(anoAtual, mesAtual, 1), pag: new Date(anoAtual, mesAtual, 1) },
    { desc: 'Folha de Pagamento', val: 8000, catIdx: 5, status: 'PENDING', comp: new Date(anoAtual, mesAtual, 30) },
    { desc: 'Anúncios Google', val: 1500, catIdx: 6, status: 'PAID', comp: new Date(anoAtual, mesAtual, 12), pag: new Date(anoAtual, mesAtual, 12) },
    { desc: 'Software SaaS', val: 450, catIdx: 6, status: 'PAID', comp: new Date(anoAtual, mesAtual, 8), pag: new Date(anoAtual, mesAtual, 8) },
    { desc: 'IOF e Taxas', val: 45, catIdx: 7, status: 'PAID', comp: new Date(anoAtual, mesAtual, 28), pag: new Date(anoAtual, mesAtual, 28) },
  ];

  console.log('Populando Transações...');
  for (const t of transacoes) {
    await financeService.adicionarTransacao(companyId, {
      companyId,
      categoryId: catIds[t.catIdx],
      bankAccountId: 'conta-padrao',
      description: t.desc,
      amount: t.val,
      type: categorias[t.catIdx].type as any,
      dateCompetence: t.comp,
      datePayment: t.pag,
      status: t.status as any,
      isRecurring: false
    });
  }

  console.log('Dados de teste populados com sucesso!');
}
