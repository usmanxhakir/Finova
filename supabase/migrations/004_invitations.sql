-- Add is_active to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Invitations table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'pending',
  token UUID DEFAULT gen_random_uuid() UNIQUE,
  UNIQUE(company_id, email)
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Only members of the same company can see invitations
CREATE POLICY "Company members can view invitations"
  ON invitations FOR SELECT
  USING (company_id = my_company_id());

-- Only admins can create invitations
CREATE POLICY "Admins can manage invitations"
  ON invitations FOR ALL
  USING (company_id = my_company_id() AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

GRANT ALL ON invitations TO authenticated;
