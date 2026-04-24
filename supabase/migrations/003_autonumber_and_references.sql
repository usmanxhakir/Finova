-- Add customer_reference to invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_reference TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_customer_reference ON invoices(customer_reference);

-- Add number (auto-generated) and reference to expenses
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_number ON expenses(number);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference TEXT;
CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference);

-- Add expense_prefix to companies
ALTER TABLE companies ADD COLUMN IF NOT EXISTS expense_prefix TEXT DEFAULT 'EXP-';

-- Add indexes on existing reference fields for search performance
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(number);
CREATE INDEX IF NOT EXISTS idx_bills_number ON bills(number);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);
