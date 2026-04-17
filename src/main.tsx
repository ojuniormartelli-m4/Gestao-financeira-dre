import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </StrictMode>,
  );
} catch (error) {
  console.error('[FinScale] Erro fatal na inicialização:', error);
  document.body.innerHTML = `
    <div style="background: #0a0a0b; color: #ef4444; padding: 20px; font-family: sans-serif; height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center;">
      <div>
        <h1 style="font-size: 24px;">Erro de Inicialização</h1>
        <p style="color: #9ca3af;">Verifique o console do navegador para mais detalhes.</p>
        <button onclick="window.location.reload()" style="background: #0ea5e9; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; margin-top: 20px;">Recarregar</button>
      </div>
    </div>
  `;
}
