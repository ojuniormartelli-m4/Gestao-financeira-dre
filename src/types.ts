/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TransactionType = 'REVENUE' | 'EXPENSE';

export type DREGroup = 
  | 'GROSS_REVENUE' 
  | 'OPERATING_REVENUE'
  | 'TAX' 
  | 'VARIABLE_COST' 
  | 'FIXED_COST' 
  | 'NON_OPERATING' 
  | 'INVESTMENT';

export type TransactionStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'SCHEDULED' | 'CONCILIATED';

export type BankAccountType = 'CHECKING' | 'SAVINGS' | 'CASH' | 'CREDIT_CARD';

export interface Company {
  id: string;
  name: string;
  taxId: string;
  currency: string;
  createdAt: Date;
}

export interface ChartOfAccount {
  id: string;
  companyId: string;
  name: string;
  type: TransactionType;
  dreGroup: DREGroup;
  parentId?: string; // Para hierarquia de categorias
}

export interface BankAccount {
  id: string;
  companyId: string;
  name: string;
  type: BankAccountType;
  initialBalance: number;
  currentBalance: number;
}

export interface CostCenter {
  id: string;
  companyId: string;
  name: string;
  color?: string;
  active: boolean;
}

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  type: 'CLIENT' | 'SUPPLIER';
  document?: string;
  email?: string;
}

export interface PaymentMethod {
  id: string;
  companyId: string;
  name: string;
  active: boolean;
}

export interface CreditCard {
  id: string;
  companyId: string;
  name: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  bankAccountId: string;
}

export interface Transaction {
  id: string;
  companyId: string;
  categoryId: string;
  bankAccountId: string;
  costCenterId?: string;
  contactId?: string;
  paymentMethodId?: string;
  creditCardId?: string;
  description: string;
  amount: number;
  type: TransactionType;
  dateCompetence: Date; // Base para DRE
  datePayment?: Date;   // Base para Fluxo de Caixa (se pago)
  status: TransactionStatus;
  isRecurring: boolean;
  tags?: string[];
  metadataAI?: {
    confidence: number;
    originalDescription: string;
    suggestedCategory: string;
  };
  isConciliated?: boolean;
  installmentNumber?: number;
  installmentsTotal?: number;
  groupId?: string;
  createdAt: Date;
}

export interface Transfer {
  id: string;
  companyId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: Date;
  description?: string;
  isConciliated?: boolean;
  createdAt: Date;
}

export interface DRELine {
  group: DREGroup;
  label: string;
  amount: number;
  subLines?: DRELine[];
}
