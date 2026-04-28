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
  installment_number INTEGER,
  installments_total INTEGER,
  recurrence_type TEXT CHECK (recurrence_type IN ('SINGLE', 'FIXED', 'VARIABLE')),
  recurrence_frequency TEXT CHECK (recurrence_frequency IN ('MONTHLY', 'YEARLY')),
  due_day INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  group_id TEXT,
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para busca rápida de grupos de parcelas
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(group_id);

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

-- 14. Configuração de RLS (Row Level Security)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_configs ENABLE ROW LEVEL SECURITY;

-- 15. Políticas de Acesso (Permissivo para Preview, mas estruturado)
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
  ('${APP_COMPANY_ID}', 'Receitas Financeiras', 'REVENUE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Outras Receitas', 'REVENUE', 'NON_OPERATING', true),
  -- Despesas
  ('${APP_COMPANY_ID}', 'Custos de Vendas', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal/Salários', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Anúncios', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Tarifas Bancárias/Impostos', 'EXPENSE', 'TAX', true)
ON CONFLICT DO NOTHING;

-- 17.4 Centros de Custo
INSERT INTO cost_centers (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Administrativo', true),
  ('${APP_COMPANY_ID}', 'Comercial', true),
  ('${APP_COMPANY_ID}', 'Operacional', true),
  ('${APP_COMPANY_ID}', 'Marketing', true)
ON CONFLICT DO NOTHING;

-- 17.5 Formas de Pagamento
INSERT INTO payment_methods (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Pix', true),
  ('${APP_COMPANY_ID}', 'Dinheiro', true),
  ('${APP_COMPANY_ID}', 'Boleto', true),
  ('${APP_COMPANY_ID}', 'Cartão de Crédito', true),
  ('${APP_COMPANY_ID}', 'Cartão de Débito', true),
  ('${APP_COMPANY_ID}', 'Transferência', true)
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
    INSERT INTO public.profiles (id, company_id, name, login, role_id, active, must_change_password)
    VALUES (v_user_id, '${APP_COMPANY_ID}', 'Administrador Inicial', 'admin@finscale.internal', 'admin-role', true, false)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      login = EXCLUDED.login,
      role_id = EXCLUDED.role_id,
      active = EXCLUDED.active,
      must_change_password = EXCLUDED.must_change_password;
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
  installment_number INTEGER,
  installments_total INTEGER,
  recurrence_type TEXT CHECK (recurrence_type IN ('SINGLE', 'FIXED', 'VARIABLE')),
  recurrence_frequency TEXT CHECK (recurrence_frequency IN ('MONTHLY', 'YEARLY')),
  due_day INTEGER,
  is_recurring BOOLEAN DEFAULT false,
  group_id TEXT,
  date_competence TIMESTAMPTZ NOT NULL,
  date_payment TIMESTAMPTZ,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_conciliated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Garantir colunas novas no UPDATE
DO $$ 
BEGIN 
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installment_number INTEGER DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS installments_total INTEGER DEFAULT 1; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_type TEXT DEFAULT 'SINGLE'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_frequency TEXT DEFAULT 'MONTHLY'; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS due_day INTEGER; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_id TEXT; EXCEPTION WHEN duplicate_column THEN NULL; END;
    BEGIN ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_conciliated BOOLEAN DEFAULT false; EXCEPTION WHEN duplicate_column THEN NULL; END;
END $$;

-- Índice para busca rápida de grupos de parcelas
CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions(group_id);

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
  ('${APP_COMPANY_ID}', 'Receitas Financeiras', 'REVENUE', 'NON_OPERATING', true),
  ('${APP_COMPANY_ID}', 'Outras Receitas', 'REVENUE', 'NON_OPERATING', true),
  -- Despesas
  ('${APP_COMPANY_ID}', 'Custos de Vendas', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Despesas Operacionais', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Pessoal/Salários', 'EXPENSE', 'FIXED_COST', true),
  ('${APP_COMPANY_ID}', 'Marketing/Anúncios', 'EXPENSE', 'VARIABLE_COST', true),
  ('${APP_COMPANY_ID}', 'Tarifas Bancárias/Impostos', 'EXPENSE', 'TAX', true)
ON CONFLICT DO NOTHING;

-- Centros de Custo
INSERT INTO cost_centers (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Administrativo', true),
  ('${APP_COMPANY_ID}', 'Comercial', true),
  ('${APP_COMPANY_ID}', 'Operacional', true),
  ('${APP_COMPANY_ID}', 'Marketing', true)
ON CONFLICT DO NOTHING;

-- Formas de Pagamento
INSERT INTO payment_methods (company_id, name, active) VALUES
  ('${APP_COMPANY_ID}', 'Pix', true),
  ('${APP_COMPANY_ID}', 'Dinheiro', true),
  ('${APP_COMPANY_ID}', 'Boleto', true),
  ('${APP_COMPANY_ID}', 'Cartão de Crédito', true),
  ('${APP_COMPANY_ID}', 'Cartão de Débito', true),
  ('${APP_COMPANY_ID}', 'Transferência', true)
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

    INSERT INTO public.profiles (id, company_id, name, login, role_id, active, must_change_password)
    VALUES (v_user_id, '${APP_COMPANY_ID}', 'Administrador Inicial', 'admin@finscale.internal', 'admin-role', true, false)
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      login = EXCLUDED.login,
      role_id = EXCLUDED.role_id,
      active = EXCLUDED.active,
      must_change_password = EXCLUDED.must_change_password;
END $$;
`;
