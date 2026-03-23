-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'accountant', 'viewer');
CREATE TYPE account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE account_subtype AS ENUM (
    'accounts_receivable', 'accounts_payable', 'bank', 'cash', 
    'other_current_asset', 'fixed_asset', 'other_asset', 
    'credit_card', 'other_current_liability', 'long_term_liability', 
    'income', 'other_income', 'cost_of_goods_sold', 'expense', 'other_expense',
    'equity'
);
CREATE TYPE contact_type AS ENUM ('customer', 'vendor', 'both');
CREATE TYPE item_type AS ENUM ('product', 'service');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void');
CREATE TYPE bill_status AS ENUM ('draft', 'received', 'partially_paid', 'paid', 'overdue', 'void');
CREATE TYPE payment_type AS ENUM ('invoice_payment', 'bill_payment');
CREATE TYPE journal_source_type AS ENUM ('invoice', 'bill', 'payment', 'manual');

-- HELPER: updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- TABLES
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    full_name TEXT,
    role user_role DEFAULT 'viewer',
    avatar_url TEXT
);

CREATE TABLE company_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    logo_url TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    country TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    tax_number TEXT,
    default_currency TEXT DEFAULT 'USD',
    fiscal_year_start INTEGER DEFAULT 1,
    invoice_prefix TEXT DEFAULT 'INV-',
    bill_prefix TEXT DEFAULT 'BILL-',
    invoice_terms TEXT,
    invoice_footer TEXT
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type account_type NOT NULL,
    sub_type account_subtype NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    parent_account_id UUID REFERENCES accounts(id),
    is_system BOOLEAN DEFAULT FALSE
);

CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    type contact_type NOT NULL,
    email TEXT,
    phone TEXT,
    website TEXT,
    billing_address TEXT,
    billing_city TEXT,
    billing_state TEXT,
    billing_zip TEXT,
    billing_country TEXT,
    tax_number TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    description TEXT,
    type item_type NOT NULL,
    unit TEXT,
    default_rate BIGINT DEFAULT 0, -- Stored in cents
    income_account_id UUID REFERENCES accounts(id),
    expense_account_id UUID REFERENCES accounts(id),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    number TEXT NOT NULL UNIQUE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    status invoice_status DEFAULT 'draft',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency TEXT DEFAULT 'USD',
    subtotal BIGINT DEFAULT 0,
    tax_amount BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    total BIGINT DEFAULT 0,
    amount_paid BIGINT DEFAULT 0,
    amount_due BIGINT DEFAULT 0,
    notes TEXT,
    terms TEXT,
    footer TEXT,
    sent_at TIMESTAMPTZ
);

CREATE TABLE invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    description TEXT,
    quantity DECIMAL NOT NULL DEFAULT 1,
    rate BIGINT NOT NULL DEFAULT 0,
    amount BIGINT NOT NULL DEFAULT 0,
    account_id UUID NOT NULL REFERENCES accounts(id),
    tax_rate DECIMAL
);

CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    number TEXT NOT NULL UNIQUE,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    status bill_status DEFAULT 'draft',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency TEXT DEFAULT 'USD',
    subtotal BIGINT DEFAULT 0,
    tax_amount BIGINT DEFAULT 0,
    discount_amount BIGINT DEFAULT 0,
    total BIGINT DEFAULT 0,
    amount_paid BIGINT DEFAULT 0,
    amount_due BIGINT DEFAULT 0,
    notes TEXT,
    reference_number TEXT
);

CREATE TABLE bill_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    item_id UUID REFERENCES items(id),
    description TEXT,
    quantity DECIMAL NOT NULL DEFAULT 1,
    rate BIGINT NOT NULL DEFAULT 0,
    amount BIGINT NOT NULL DEFAULT 0,
    account_id UUID NOT NULL REFERENCES accounts(id),
    tax_rate DECIMAL
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    type payment_type NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    date DATE NOT NULL,
    amount BIGINT NOT NULL DEFAULT 0,
    reference TEXT,
    notes TEXT
);

CREATE TABLE payment_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    bill_id UUID REFERENCES bills(id),
    amount_applied BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    reference TEXT,
    description TEXT,
    is_system_generated BOOLEAN DEFAULT FALSE,
    source_type journal_source_type DEFAULT 'manual',
    source_id UUID
);

CREATE TABLE journal_entry_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    description TEXT,
    debit BIGINT DEFAULT 0,
    credit BIGINT DEFAULT 0
);

-- TRIGGERS
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_company_settings_updated_at BEFORE UPDATE ON company_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_invoice_line_items_updated_at BEFORE UPDATE ON invoice_line_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON bills FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_bill_line_items_updated_at BEFORE UPDATE ON bill_line_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_payment_allocations_updated_at BEFORE UPDATE ON payment_allocations FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON journal_entries FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_journal_entry_lines_updated_at BEFORE UPDATE ON journal_entry_lines FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- SEED SYSTEM ACCOUNTS
INSERT INTO accounts (code, name, type, sub_type, is_system) VALUES
('1100', 'Accounts Receivable', 'asset', 'accounts_receivable', true),
('2100', 'Accounts Payable', 'liability', 'accounts_payable', true),
('1000', 'Checking Account', 'asset', 'bank', false),
('4000', 'Sales Revenue', 'revenue', 'income', false),
('5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', false),
('6000', 'General & Administrative', 'expense', 'expense', false),
('3000', 'Owner''s Equity', 'equity', 'other_asset', false);

-- RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Shared Profile Check Function
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE;

-- Profiles: Own profile access
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (get_user_role() = 'admin');
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Company Settings: Admin full, Others read
CREATE POLICY "Everyone can view company settings" ON company_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage company settings" ON company_settings FOR ALL USING (get_user_role() = 'admin');

-- Accounts: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view accounts" ON accounts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage accounts" ON accounts FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Contacts: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view contacts" ON contacts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage contacts" ON contacts FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Items: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view items" ON items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage items" ON items FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Invoices: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view invoices" ON invoices FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage invoices" ON invoices FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Invoice Line Items: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view invoice line items" ON invoice_line_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage invoice line items" ON invoice_line_items FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Bills: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view bills" ON bills FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage bills" ON bills FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Bill Line Items: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view bill line items" ON bill_line_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage bill line items" ON bill_line_items FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Payments: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view payments" ON payments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage payments" ON payments FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Payment Allocations: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view payment allocations" ON payment_allocations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage payment allocations" ON payment_allocations FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Journal Entries: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view journal entries" ON journal_entries FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage journal entries" ON journal_entries FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Journal Entry Lines: Viewer read, Accountant/Admin manage
CREATE POLICY "Everyone can view journal entry lines" ON journal_entry_lines FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage journal entry lines" ON journal_entry_lines FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- STORAGE SETUP
-- Create bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Allow authenticated uploads to company-logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Allow public viewing of company-logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'company-logos');
