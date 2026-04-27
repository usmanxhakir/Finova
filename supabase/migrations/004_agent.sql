-- Agent conversations table
CREATE TABLE IF NOT EXISTS agent_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  title TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now()
);

-- Agent messages table
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  conversation_id UUID REFERENCES agent_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  intent_payload JSONB
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_messages_conversation
  ON agent_messages(conversation_id);

CREATE INDEX IF NOT EXISTS idx_agent_messages_created
  ON agent_messages(created_at);

CREATE INDEX IF NOT EXISTS idx_agent_conversations_last_message
  ON agent_conversations(last_message_at DESC);

-- RLS
ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated access to agent_conversations"
ON agent_conversations FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated access to agent_messages"
ON agent_messages FOR ALL TO authenticated
USING (true) WITH CHECK (true);

GRANT ALL ON agent_conversations TO authenticated;
GRANT ALL ON agent_messages TO authenticated;
