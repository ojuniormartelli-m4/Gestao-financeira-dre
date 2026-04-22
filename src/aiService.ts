import { GoogleGenAI } from "@google/genai";
import { DRELine } from "./types";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.warn("[FinScale] GEMINI_API_KEY não configurada.");
      return null;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

async function callAI(prompt: string, retryCount = 0): Promise<string | null> {
  const ai = getAI();
  if (!ai) return "Inteligência Artificial não configurada.";

  const MAX_RETRIES = 5;
  const INITIAL_DELAY = 2000; // 2 segundos

  try {
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });
    return response.text;
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const isQuotaExceeded = errorMsg.includes("429") || error?.status === 429 || error?.code === 429 || errorMsg.includes("quota");

    if (isQuotaExceeded && retryCount < MAX_RETRIES) {
      const delay = INITIAL_DELAY * Math.pow(2, retryCount) + Math.random() * 1000;
      console.warn(`[FinScale] Limite de cota atingido. Tentando novamente em ${Math.round(delay)}ms... (Tentativa ${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callAI(prompt, retryCount + 1);
    }

    if (isQuotaExceeded) {
      const msg = "Cota do Gemini excedida. Verifique seu plano ou aguarde um momento.";
      console.error(`Erro na chamada da IA: ${msg}`);
      return `ERRO_COTA: ${msg}`;
    } else {
      console.error("Erro na chamada da IA:", error);
    }
    return null;
  }
}

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

    const result = await callAI(prompt);
    if (result?.startsWith("ERRO_COTA:")) return result.replace("ERRO_COTA: ", "");
    return result || "Não foi possível gerar a análise no momento.";
  },

  async responderChatFinanceiro(pergunta: string, contexto: any) {
    const prompt = `Você é o assistente financeiro do FinScale. Responda à pergunta do usuário baseando-se nos dados financeiros fornecidos.
    
    Contexto dos Dados:
    ${JSON.stringify(contexto, null, 2)}
    
    Pergunta: ${pergunta}
    `;

    const result = await callAI(prompt);
    if (result?.startsWith("ERRO_COTA:")) return result.replace("ERRO_COTA: ", "");
    return result || "Desculpe, tive um problema ao processar sua pergunta.";
  },

  async projetarFluxoCaixa(historico: any[], pendentes: any[]) {
    const prompt = `Analise o histórico de transações e as contas pendentes para sugerir uma projeção de fluxo de caixa para os próximos 30 dias.
    
    Histórico (Últimos 3 meses):
    ${JSON.stringify(historico, null, 2)}
    
    Contas Pendentes:
    ${JSON.stringify(pendentes, null, 2)}
    
    Forneça uma projeção resumida e direta.
    `;

    const result = await callAI(prompt);
    if (result?.startsWith("ERRO_COTA:")) return result.replace("ERRO_COTA: ", "");
    return result || "Não foi possível gerar a projeção no momento.";
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

    const result = await callAI(prompt);
    if (!result) return null;

    try {
      const text = result.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (error) {
      console.error("Erro no mapeamento da IA (Parse):", error);
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

    const result = await callAI(prompt);
    if (!result) return [];

    try {
      const text = result.replace(/```json|```/g, "").trim();
      return JSON.parse(text);
    } catch (error) {
      console.error("Erro na sugestão de categorias da IA (Parse):", error);
      return [];
    }
  }
};
