-- Create projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    contact_id UUID NOT NULL REFERENCES contacts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    code TEXT,
    description TEXT,
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    budget BIGINT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Add updated_at trigger
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Add RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view projects" ON projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Accountants and Admins can manage projects" ON projects FOR ALL USING (get_user_role() IN ('admin', 'accountant'));

-- Add project_id to transaction tables
ALTER TABLE invoices ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE bills ADD COLUMN project_id UUID REFERENCES projects(id);
ALTER TABLE expenses ADD COLUMN project_id UUID REFERENCES projects(id);
