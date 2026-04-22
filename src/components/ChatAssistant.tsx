import { useState, useRef, useEffect } from 'react';
import * as React from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { aiService } from '../aiService';
import { financeService } from '../financeService';
import { useCompany } from '../contexts/CompanyContext';
import { cn } from '../lib/utils';

export function ChatAssistant() {
  const { companyId } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Olá! Sou seu assistente financeiro. Como posso ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const transacoes = await financeService.buscarTodasTransacoes(companyId);
      const planoContas = await financeService.buscarPlanoDeContas(companyId);
      
      const contexto = {
        transacoes: transacoes?.slice(0, 50), // Limitar para o prompt
        planoContas
      };

      const response = await aiService.responderChatFinanceiro(userMsg, contexto);
      
      if (response === "Inteligência Artificial não configurada.") {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          text: 'Olá! Notei que a chave GEMINI_API_KEY não foi configurada na Vercel. Para usar o chat, adicione a chave nas configurações do seu projeto.' 
        }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'bot', text: response || 'Não consegui processar sua pergunta.' }]);
    } catch (error: any) {
      console.error('[FinScale Chat Error]', error);
      const isMissingTable = error?.code === '42P01';
      const msg = isMissingTable 
        ? 'Erro: As tabelas do banco de dados não foram encontradas. Por favor, execute o script SQL nas configurações.'
        : 'Ocorreu um erro ao buscar seus dados ou inicializar a IA.';
      
      setMessages(prev => [...prev, { role: 'bot', text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-20 right-0 w-80 md:w-96 bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[500px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-border bg-bg/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-accent/10 rounded-lg text-accent">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">FinScale AI</h3>
                  <div className="flex items-center gap-1 text-[10px] text-success">
                    <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Online
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl text-text-secondary">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg/20">
              {messages.map((msg, i) => (
                <div key={i} className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    msg.role === 'bot' ? "bg-accent/10 text-accent" : "bg-surface border border-border text-text-secondary"
                  )}>
                    {msg.role === 'bot' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'bot' 
                      ? "bg-surface border border-border text-text-primary" 
                      : "bg-accent text-bg font-medium"
                  )}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                    <Bot size={16} />
                  </div>
                  <div className="p-3 rounded-2xl bg-surface border border-border flex gap-1">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t border-border bg-bg/50">
              <div className="relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Pergunte sobre suas finanças..."
                  className="w-full bg-bg border border-border rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:border-accent transition-colors"
                />
                <button 
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent text-bg rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-accent text-bg rounded-2xl shadow-2xl flex items-center justify-center relative group overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-danger rounded-full border-2 border-bg" />
        )}
      </motion.button>
    </div>
  );
}
