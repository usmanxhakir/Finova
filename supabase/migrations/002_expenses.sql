-- Add 'expense' to journal_source_type enum
-- Note: In Postgres, you can't easily add to an enum within a transaction alongside table creation if used in that table.
-- However, we'll try the standard way. Or we can just use the manual type for now if migration fails.
-- But since we are creating the migration, we follow the plan.

ALTER TYPE journal_source_type ADD VALUE IF NOT EXISTS 'expense';

-- Create expenses table
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    date DATE NOT NULL,
    payee TEXT NOT NULL,
    expense_account_id UUID NOT NULL REFERENCES accounts(id),
    payment_account_id UUID NOT NULL REFERENCES accounts(id),
    amount BIGINT NOT NULL DEFAULT 0, -- Stored in cents
    notes TEXT,
    receipt_url TEXT,
    status TEXT DEFAULT 'finalized' -- 'finalized', 'void'
);

-- Updated_at trigger
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view expenses" ON expenses FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage expenses" ON expenses FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Storage Bucket for Receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts
CREATE POLICY "Allow authenticated uploads to receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Allow authenticated viewing of receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

CREATE POLICY "Allow authenticated deletion of receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts');
