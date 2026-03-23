export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    full_name: string | null
                    role: Database['public']['Enums']['user_role']
                    avatar_url: string | null
                }
                Insert: {
                    id: string
                    created_at?: string
                    updated_at?: string
                    full_name?: string | null
                    role?: Database['public']['Enums']['user_role']
                    avatar_url?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    full_name?: string | null
                    role?: Database['public']['Enums']['user_role']
                    avatar_url?: string | null
                }
            }
            company_settings: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    name: string
                    logo_url: string | null
                    address: string | null
                    city: string | null
                    state: string | null
                    zip: string | null
                    country: string | null
                    phone: string | null
                    email: string | null
                    website: string | null
                    tax_number: string | null
                    default_currency: string
                    fiscal_year_start: number
                    invoice_prefix: string
                    bill_prefix: string
                    invoice_terms: string | null
                    invoice_footer: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name: string
                    logo_url?: string | null
                    address?: string | null
                    city?: string | null
                    state?: string | null
                    zip?: string | null
                    country?: string | null
                    phone?: string | null
                    email?: string | null
                    website?: string | null
                    tax_number?: string | null
                    default_currency?: string
                    fiscal_year_start?: number
                    invoice_prefix?: string
                    bill_prefix?: string
                    invoice_terms?: string | null
                    invoice_footer?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name?: string
                    logo_url?: string | null
                    address?: string | null
                    city?: string | null
                    state?: string | null
                    zip?: string | null
                    country?: string | null
                    phone?: string | null
                    email?: string | null
                    website?: string | null
                    tax_number?: string | null
                    default_currency?: string
                    fiscal_year_start?: number
                    invoice_prefix?: string
                    bill_prefix?: string
                    invoice_terms?: string | null
                    invoice_footer?: string | null
                }
            }
            accounts: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    code: string
                    name: string
                    type: Database['public']['Enums']['account_type']
                    sub_type: Database['public']['Enums']['account_subtype']
                    description: string | null
                    is_active: boolean
                    parent_account_id: string | null
                    is_system: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    code: string
                    name: string
                    type: Database['public']['Enums']['account_type']
                    sub_type: Database['public']['Enums']['account_subtype']
                    description?: string | null
                    is_active?: boolean
                    parent_account_id?: string | null
                    is_system?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    code?: string
                    name?: string
                    type?: Database['public']['Enums']['account_type']
                    sub_type?: Database['public']['Enums']['account_subtype']
                    description?: string | null
                    is_active?: boolean
                    parent_account_id?: string | null
                    is_system?: boolean
                }
            }
            contacts: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    name: string
                    type: Database['public']['Enums']['contact_type']
                    email: string | null
                    phone: string | null
                    website: string | null
                    billing_address: string | null
                    billing_city: string | null
                    billing_state: string | null
                    billing_zip: string | null
                    billing_country: string | null
                    tax_number: string | null
                    notes: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name: string
                    type: Database['public']['Enums']['contact_type']
                    email?: string | null
                    phone?: string | null
                    website?: string | null
                    billing_address?: string | null
                    billing_city?: string | null
                    billing_state?: string | null
                    billing_zip?: string | null
                    billing_country?: string | null
                    tax_number?: string | null
                    notes?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name?: string
                    type?: Database['public']['Enums']['contact_type']
                    email?: string | null
                    phone?: string | null
                    website?: string | null
                    billing_address?: string | null
                    billing_city?: string | null
                    billing_state?: string | null
                    billing_zip?: string | null
                    billing_country?: string | null
                    tax_number?: string | null
                    notes?: string | null
                    is_active?: boolean
                }
            }
            items: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    name: string
                    description: string | null
                    type: Database['public']['Enums']['item_type']
                    unit: string | null
                    default_rate: number
                    income_account_id: string | null
                    expense_account_id: string | null
                    is_active: boolean
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name: string
                    description?: string | null
                    type: Database['public']['Enums']['item_type']
                    unit?: string | null
                    default_rate?: number
                    income_account_id?: string | null
                    expense_account_id?: string | null
                    is_active?: boolean
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    name?: string
                    description?: string | null
                    type?: Database['public']['Enums']['item_type']
                    unit?: string | null
                    default_rate?: number
                    income_account_id?: string | null
                    expense_account_id?: string | null
                    is_active?: boolean
                }
            }
            invoices: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    number: string
                    contact_id: string
                    status: Database['public']['Enums']['invoice_status']
                    issue_date: string
                    due_date: string
                    currency: string
                    subtotal: number
                    tax_amount: number
                    discount_amount: number
                    total: number
                    amount_paid: number
                    amount_due: number
                    notes: string | null
                    terms: string | null
                    footer: string | null
                    sent_at: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    number: string
                    contact_id: string
                    status?: Database['public']['Enums']['invoice_status']
                    issue_date: string
                    due_date: string
                    currency?: string
                    subtotal?: number
                    tax_amount?: number
                    discount_amount?: number
                    total?: number
                    amount_paid?: number
                    amount_due?: number
                    notes?: string | null
                    terms?: string | null
                    footer?: string | null
                    sent_at?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    number?: string
                    contact_id?: string
                    status?: Database['public']['Enums']['invoice_status']
                    issue_date?: string
                    due_date?: string
                    currency?: string
                    subtotal?: number
                    tax_amount?: number
                    discount_amount?: number
                    total?: number
                    amount_paid?: number
                    amount_due?: number
                    notes?: string | null
                    terms?: string | null
                    footer?: string | null
                    sent_at?: string | null
                }
            }
            invoice_line_items: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    invoice_id: string
                    item_id: string | null
                    description: string | null
                    quantity: number
                    rate: number
                    amount: number
                    account_id: string
                    tax_rate: number | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    invoice_id: string
                    item_id?: string | null
                    description?: string | null
                    quantity?: number
                    rate?: number
                    amount?: number
                    account_id: string
                    tax_rate?: number | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    invoice_id?: string
                    item_id?: string | null
                    description?: string | null
                    quantity?: number
                    rate?: number
                    amount?: number
                    account_id?: string
                    tax_rate?: number | null
                }
            }
            bills: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    number: string
                    contact_id: string
                    status: Database['public']['Enums']['bill_status']
                    issue_date: string
                    due_date: string
                    currency: string
                    subtotal: number
                    tax_amount: number
                    discount_amount: number
                    total: number
                    amount_paid: number
                    amount_due: number
                    notes: string | null
                    reference_number: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    number: string
                    contact_id: string
                    status?: Database['public']['Enums']['bill_status']
                    issue_date: string
                    due_date: string
                    currency?: string
                    subtotal?: number
                    tax_amount?: number
                    discount_amount?: number
                    total?: number
                    amount_paid?: number
                    amount_due?: number
                    notes?: string | null
                    reference_number?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    number?: string
                    contact_id?: string
                    status?: Database['public']['Enums']['bill_status']
                    issue_date?: string
                    due_date?: string
                    currency?: string
                    subtotal?: number
                    tax_amount?: number
                    discount_amount?: number
                    total?: number
                    amount_paid?: number
                    amount_due?: number
                    notes?: string | null
                    reference_number?: string | null
                }
            }
            bill_line_items: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    bill_id: string
                    item_id: string | null
                    description: string | null
                    quantity: number
                    rate: number
                    amount: number
                    account_id: string
                    tax_rate: number | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    bill_id: string
                    item_id?: string | null
                    description?: string | null
                    quantity?: number
                    rate?: number
                    amount?: number
                    account_id: string
                    tax_rate?: number | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    bill_id?: string
                    item_id?: string | null
                    description?: string | null
                    quantity?: number
                    rate?: number
                    amount?: number
                    account_id?: string
                    tax_rate?: number | null
                }
            }
            payments: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    type: Database['public']['Enums']['payment_type']
                    contact_id: string
                    account_id: string
                    date: string
                    amount: number
                    reference: string | null
                    notes: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    type: Database['public']['Enums']['payment_type']
                    contact_id: string
                    account_id: string
                    date: string
                    amount?: number
                    reference?: string | null
                    notes?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    type?: Database['public']['Enums']['payment_type']
                    contact_id?: string
                    account_id?: string
                    date?: string
                    amount?: number
                    reference?: string | null
                    notes?: string | null
                }
            }
            payment_allocations: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    payment_id: string
                    invoice_id: string | null
                    bill_id: string | null
                    amount_applied: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    payment_id: string
                    invoice_id?: string | null
                    bill_id?: string | null
                    amount_applied?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    payment_id?: string
                    invoice_id?: string | null
                    bill_id?: string | null
                    amount_applied?: number
                }
            }
            journal_entries: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    date: string
                    reference: string | null
                    description: string | null
                    is_system_generated: boolean
                    source_type: Database['public']['Enums']['journal_source_type']
                    source_id: string | null
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    date: string
                    reference?: string | null
                    description?: string | null
                    is_system_generated?: boolean
                    source_type?: Database['public']['Enums']['journal_source_type']
                    source_id?: string | null
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    date?: string
                    reference?: string | null
                    description?: string | null
                    is_system_generated?: boolean
                    source_type?: Database['public']['Enums']['journal_source_type']
                    source_id?: string | null
                }
            }
            journal_entry_lines: {
                Row: {
                    id: string
                    created_at: string
                    updated_at: string
                    journal_entry_id: string
                    account_id: string
                    description: string | null
                    debit: number
                    credit: number
                }
                Insert: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    journal_entry_id: string
                    account_id: string
                    description?: string | null
                    debit?: number
                    credit?: number
                }
                Update: {
                    id?: string
                    created_at?: string
                    updated_at?: string
                    journal_entry_id?: string
                    account_id?: string
                    description?: string | null
                    debit?: number
                    credit?: number
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            get_user_role: {
                Args: Record<PropertyKey, never>
                Returns: Database['public']['Enums']['user_role']
            }
        }
        Enums: {
            user_role: 'admin' | 'accountant' | 'viewer'
            account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
            account_subtype:
            | 'accounts_receivable'
            | 'accounts_payable'
            | 'bank'
            | 'cash'
            | 'other_current_asset'
            | 'fixed_asset'
            | 'other_asset'
            | 'credit_card'
            | 'other_current_liability'
            | 'long_term_liability'
            | 'income'
            | 'other_income'
            | 'cost_of_goods_sold'
            | 'expense'
            | 'other_expense'
            | 'equity'
            contact_type: 'customer' | 'vendor' | 'both'
            item_type: 'product' | 'service'
            invoice_status:
            | 'draft'
            | 'sent'
            | 'partially_paid'
            | 'paid'
            | 'overdue'
            | 'void'
            bill_status: 'draft' | 'received' | 'partially_paid' | 'paid' | 'overdue' | 'void'
            payment_type: 'invoice_payment' | 'bill_payment'
            journal_source_type: 'invoice' | 'bill' | 'payment' | 'manual'
        }
    }
}
