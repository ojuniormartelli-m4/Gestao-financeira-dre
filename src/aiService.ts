import { GoogleGenAI, Type } from "@google/genai";
import { DRELine } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const aiService = {
  async analisarSaudeFinanceira(dreData: any) {
    const prompt = `Atue como um CFO experiente. Analise estes números de uma empresa e identifique 3 pontos de atenção e 2 oportunidades de melhoria. Seja direto e use linguagem de negócios.
    
    Dados da DRE:
    - Receita Bruta: ${dreData.GROSS_REVENUE}
    - Receita Líquida: ${dreData.netRevenue}
    - Margem de Contribuição: ${dreData.contributionMargin}
    - EBITDA: ${dreData.ebitda}
    - Lucro Líquido: ${dreData.netProfit}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Erro na análise da IA:", error);
      return "Não foi possível gerar a análise no momento.";
    }
  },

  async responderChatFinanceiro(pergunta: string, contexto: any) {
    const prompt = `Você é o assistente financeiro do FinScale. Responda à pergunta do usuário baseando-se nos dados financeiros fornecidos.
    
    Contexto dos Dados:
    ${JSON.stringify(contexto, null, 2)}
    
    Pergunta: ${pergunta}
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Erro no chat da IA:", error);
      return "Desculpe, tive um problema ao processar sua pergunta.";
    }
  },

  async projetarFluxoCaixa(historico: any[], pendentes: any[]) {
    const prompt = `Analise o histórico de transações e as contas pendentes para sugerir uma projeção de fluxo de caixa para os próximos 30 dias.
    
    Histórico (Últimos 3 meses):
    ${JSON.stringify(historico, null, 2)}
    
    Contas Pendentes:
    ${JSON.stringify(pendentes, null, 2)}
    
    Forneça uma projeção resumida e direta.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      return response.text;
    } catch (error) {
      console.error("Erro na projeção da IA:", error);
      return "Não foi possível gerar a projeção no momento.";
    }
  },

  async sugerirMapeamentoColunas(headers: string[], rows: any[]) {
    const prompt = `Atue como um especialista em dados financeiros. Analise os cabeçalhos e as primeiras linhas de uma planilha e identifique quais colunas correspondem aos campos: 'data', 'descricao', 'valor' e 'categoria'.
    
    Cabeçalhos: ${JSON.stringify(headers)}
    Exemplo de Dados: ${JSON.stringify(rows)}
    
    Responda APENAS um JSON no formato:
    {
      "data": "nome_da_coluna",
      "descricao": "nome_da_coluna",
      "valor": "nome_da_coluna",
      "categoria": "nome_da_coluna" (opcional)
    }
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const text = response.text.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (error) {
      console.error("Erro no mapeamento da IA:", error);
      return null;
    }
  },

  async sugerirCategorias(transacoes: { descricao: string }[], categorias: { id: string, name: string }[]) {
    const prompt = `Analise as descrições das transações e sugira a categoria mais adequada para cada uma, baseando-se no plano de contas fornecido.
    
    Plano de Contas:
    ${JSON.stringify(categorias.map(c => ({ id: c.id, nome: c.name })))}
    
    Transações:
    ${JSON.stringify(transacoes)}
    
    Responda APENAS um JSON no formato de array de strings, na mesma ordem das transações, contendo apenas o ID da categoria sugerida:
    ["id1", "id2", "id3"]
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      const text = response.text.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (error) {
      console.error("Erro na sugestão de categorias da IA:", error);
      return [];
    }
  }
};
