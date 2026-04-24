export const APP_COMPANY_ID = 'm4-digital';

export const RESET_DATABASE_SQL = `-- 0. Reset do Banco de Dados (APAGA TUDO E INICIA DO ZERO!)
DROP TABLE IF EXISTS transfers CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS credit_cards CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS cost_centers CASCADE;
DROP TABLE IF EXISTS chart_of_accounts CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS company_configs CASCADE;
DROP FUNCTION IF EXISTS increment_balance;

-- 1. Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Criar Tabela de Cargos
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Criar Tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  role_id TEXT REFERENCES roles(id),
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Criar Tabela de Contas Bancárias
CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  type TEXT,
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Criar Tabela de Categorias (Plano de Contas)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  dre_group TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Criar Tabela de Centros de Custo
CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Criar Tabela de Contatos
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('CLIENT', 'SUPPLIER')),
  document TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Criar Tabela de Formas de Pagamento
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Criar Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credit_limit NUMERIC DEFAULT 0,
  closing_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Criar Tabela de Transações
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  category_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('PAID', 'PENDING', 'CANCELLED', 'SCHEDULED', 'CONCILIATED')),
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. Criar Tabela de Transferências
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  from_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. Tabela de Configurações da Empresa
CREATE TABLE IF NOT EXISTS company_configs (
  company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. Função RPC para Saldo
CREATE OR REPLACE FUNCTION increment_balance(account_id TEXT, amount_to_add NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE bank_accounts
  SET current_balance = current_balance + amount_to_add
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- 14. Desativar RLS (Habilite e configure políticas conforme necessário)
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE contacts DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_configs DISABLE ROW LEVEL SECURITY;

-- 15. Políticas Básicas (Opcional)
CREATE POLICY "Permitir tudo" ON roles FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON profiles FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON bank_accounts FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON chart_of_accounts FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON cost_centers FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON contacts FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON payment_methods FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON credit_cards FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON transactions FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON transfers FOR ALL USING (true);
CREATE POLICY "Permitir tudo" ON company_configs FOR ALL USING (true);

-- 16. Configuração de Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true) ON CONFLICT (id) DO NOTHING;

-- 17. SEED DATA (POPULAR TABELAS)
-- 17.1 Cargos
INSERT INTO roles (id, name) VALUES 
  ('admin-role', 'Administrador'),
  ('manager-role', 'Gerente'),
  ('finance-role', 'Financeiro')
ON CONFLICT (id) DO NOTHING;

-- 17.2 Configuração da Empresa
INSERT INTO company_configs (company_id, name) VALUES 
  ('${APP_COMPANY_ID}', 'M4 Digital')
ON CONFLICT (company_id) DO NOTHING;

-- 17.3 Categorias (Plano de Contas)
INSERT INTO chart_of_accounts (company_id, name, type, dre_group, active) VALUES
  -- Receitas
  ('${APP_COMPANY_ID}', 'Venda de Produtos', 'REVENUE', 'OPERATING_REVENUE', true),
  ('${APP_COMPANY_ID}', 'Prestação de Serviços', 'REVENUE', 'OPERATING_REVENUE', true),
  ('${APP_COMPANY_ID}', 'Receitas Financeiras (Rendimentos/Juros)', 'REVENUE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Outras Receitas', 'REVENUE', 'NON_OPERATING', true),
  -- Despesas: Custo de Vendas
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Fornecedores', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Fretes', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Taxas de Marketplace', 'EXPENSE', 'VARIABLE_COST', true),
  -- Despesas Operacionais
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Aluguel', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Energia', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Internet', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Limpeza', 'EXPENSE', 'FIXED_COST', true),
  -- Pessoal
  ('${APP_COMPANY_ID}', 'Pessoal: Salários', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Pró-labore', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Encargos (FGTS/INSS)', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Benefícios', 'EXPENSE', 'FIXED_COST', true),
  -- Marketing/Vendas
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Anúncios (Google/Meta)', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Software/SaaS', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Comissões', 'EXPENSE', 'VARIABLE_COST', true),
  -- Financeiras
  ('${APP_COMPANY_ID}', 'Financeiras: Tarifas Bancárias', 'EXPENSE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Financeiras: Juros de Empréstimos', 'EXPENSE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Financeiras: Impostos (DAS/ISS)', 'EXPENSE', 'TAX', true)
ON CONFLICT DO NOTHING;

-- 17.4 Centros de Custo
INSERT INTO cost_centers (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Administrativo', true),
  ('${APP_COMPANY_ID}', 'Operacional / Produção', true),
  ('${APP_COMPANY_ID}', 'Comercial / Vendas', true),
  ('${APP_COMPANY_ID}', 'Marketing', true),
  ('${APP_COMPANY_ID}', 'Logística', true)
ON CONFLICT DO NOTHING;

-- 17.5 Formas de Pagamento
INSERT INTO payment_methods (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Pix', true),
  ('${APP_COMPANY_ID}', 'Cartão de Crédito', true),
  ('${APP_COMPANY_ID}', 'Cartão de Débito', true),
  ('${APP_COMPANY_ID}', 'Dinheiro (Espécie)', true),
  ('${APP_COMPANY_ID}', 'Boleto Bancário', true),
  ('${APP_COMPANY_ID}', 'Transferência Bancária (TED/DOC)', true)
ON CONFLICT DO NOTHING;

-- 17.6 Conta Bancária Inicial
INSERT INTO bank_accounts (company_id, name, bank_name, type, initial_balance, current_balance, color) VALUES
  ('${APP_COMPANY_ID}', 'Caixa Principal', 'M4 Digital', 'CASH', 0, 0, '#22c55e')
ON CONFLICT DO NOTHING;

-- 17.7 Usuário Administrador Inicial (Login: admin / Senha: admin123)
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- 1. Tentar obter ID se já existir pelo e-mail
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@finscale.internal';
    
    IF v_user_id IS NULL THEN
        v_user_id := '00000000-0000-0000-0000-000000000000';
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
            aud, role, is_super_admin, last_sign_in_at
        )
        VALUES (
          v_user_id, '00000000-0000-0000-0000-000000000000', 'admin@finscale.internal',
          crypt('admin123', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"name":"Administrador"}',
          now(), now(), 'authenticated', 'authenticated', false, now()
        );
    ELSE
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            last_sign_in_at = COALESCE(last_sign_in_at, now())
        WHERE id = v_user_id;
    END IF;

    -- 2. Garantir perfil público vinculado sem deletar (evita erros de FK)
    INSERT INTO public.profiles (id, company_id, name, login, role_id, active)
    VALUES (v_user_id, '${APP_COMPANY_ID}', 'Administrador Inicial', 'admin', 'admin-role', true)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      login = EXCLUDED.login,
      role_id = EXCLUDED.role_id,
      active = EXCLUDED.active;
END $$;
`;

export const UPDATE_DATABASE_SQL = `-- UPDATE SQL (Apenas Atualizações, Sem Apagar Dados)
-- 1. Extensões Necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Garantir Tabelas e Colunas
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  login TEXT UNIQUE NOT NULL,
  role_id TEXT REFERENCES roles(id),
  photo_url TEXT,
  active BOOLEAN DEFAULT true,
  must_change_password BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  bank_name TEXT,
  type TEXT,
  initial_balance NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  dre_group TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cost_centers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('CLIENT', 'SUPPLIER')),
  document TEXT,
  email TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  credit_limit NUMERIC DEFAULT 0,
  closing_day INTEGER NOT NULL,
  due_day INTEGER NOT NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('REVENUE', 'EXPENSE')),
  category_id TEXT REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  bank_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  cost_center_id TEXT REFERENCES cost_centers(id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  payment_method_id TEXT REFERENCES payment_methods(id) ON DELETE SET NULL,
  credit_card_id TEXT REFERENCES credit_cards(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('PAID', 'PENDING', 'CANCELLED', 'SCHEDULED', 'CONCILIATED')),
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  company_id TEXT NOT NULL,
  from_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id TEXT REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS company_configs (
  company_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Função RPC para Saldo (se não existir)
CREATE OR REPLACE FUNCTION increment_balance(account_id TEXT, amount_to_add NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE bank_accounts
  SET current_balance = current_balance + amount_to_add
  WHERE id = account_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Inserir Dados Básicos Se Faltarem
INSERT INTO roles (id, name) VALUES 
  ('admin-role', 'Administrador'),
  ('manager-role', 'Gerente'),
  ('finance-role', 'Financeiro')
ON CONFLICT (id) DO NOTHING;

INSERT INTO company_configs (company_id, name) VALUES 
  ('${APP_COMPANY_ID}', 'M4 Digital')
ON CONFLICT (company_id) DO NOTHING;

-- Categorias Iniciais
INSERT INTO chart_of_accounts (company_id, name, type, dre_group, active) VALUES
  -- Receitas
  ('${APP_COMPANY_ID}', 'Venda de Produtos', 'REVENUE', 'OPERATING_REVENUE', true),
  ('${APP_COMPANY_ID}', 'Prestação de Serviços', 'REVENUE', 'OPERATING_REVENUE', true),
  ('${APP_COMPANY_ID}', 'Receitas Financeiras (Rendimentos/Juros)', 'REVENUE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Outras Receitas', 'REVENUE', 'NON_OPERATING', true),
  -- Despesas: Custo de Vendas
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Fornecedores', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Fretes', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Custo de Vendas: Taxas de Marketplace', 'EXPENSE', 'VARIABLE_COST', true),
  -- Despesas Operacionais
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Aluguel', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Energia', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Internet', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais: Limpeza', 'EXPENSE', 'FIXED_COST', true),
  -- Pessoal
  ('${APP_COMPANY_ID}', 'Pessoal: Salários', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Pró-labore', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Encargos (FGTS/INSS)', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal: Benefícios', 'EXPENSE', 'FIXED_COST', true),
  -- Marketing/Vendas
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Anúncios (Google/Meta)', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Software/SaaS', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Vendas: Comissões', 'EXPENSE', 'VARIABLE_COST', true),
  -- Financeiras
  ('${APP_COMPANY_ID}', 'Financeiras: Tarifas Bancárias', 'EXPENSE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Financeiras: Juros de Empréstimos', 'EXPENSE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Financeiras: Impostos (DAS/ISS)', 'EXPENSE', 'TAX', true)
ON CONFLICT DO NOTHING;

-- Centros de Custo
INSERT INTO cost_centers (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Administrativo', true),
  ('${APP_COMPANY_ID}', 'Operacional / Produção', true),
  ('${APP_COMPANY_ID}', 'Comercial / Vendas', true),
  ('${APP_COMPANY_ID}', 'Marketing', true),
  ('${APP_COMPANY_ID}', 'Logística', true)
ON CONFLICT DO NOTHING;

-- Formas de Pagamento
INSERT INTO payment_methods (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Pix', true),
  ('${APP_COMPANY_ID}', 'Cartão de Crédito', true),
  ('${APP_COMPANY_ID}', 'Cartão de Débito', true),
  ('${APP_COMPANY_ID}', 'Dinheiro (Espécie)', true),
  ('${APP_COMPANY_ID}', 'Boleto Bancário', true),
  ('${APP_COMPANY_ID}', 'Transferência Bancária (TED/DOC)', true)
ON CONFLICT DO NOTHING;

-- 5. Garantir Usuário Administrador Inicial
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@finscale.internal';
    
    IF v_user_id IS NULL THEN
        v_user_id := '00000000-0000-0000-0000-000000000000';
        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
            aud, role, is_super_admin, last_sign_in_at
        )
        VALUES (
          v_user_id, '00000000-0000-0000-0000-000000000000', 'admin@finscale.internal',
          crypt('admin123', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{"name":"Administrador"}',
          now(), now(), 'authenticated', 'authenticated', false, now()
        );
    ELSE
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            last_sign_in_at = COALESCE(last_sign_in_at, now())
        WHERE id = v_user_id;
    END IF;

    INSERT INTO public.profiles (id, company_id, name, login, role_id, active)
    VALUES (v_user_id, '${APP_COMPANY_ID}', 'Administrador Inicial', 'admin', 'admin-role', true)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      login = EXCLUDED.login,
      role_id = EXCLUDED.role_id,
      active = EXCLUDED.active;
END $$;
`;
