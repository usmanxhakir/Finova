import { createClient } from '@/lib/supabase/server'

export interface AgentContext {
  contacts: Array<{ id: string; name: string; type: string }>
  accounts: Array<{
    id: string
    name: string
    code: string
    type: string
    sub_type: string
  }>
  items: Array<{
    id: string
    name: string
    type: string
    default_rate: number  // stored as BIGINT cents in DB
  }>
}

export async function loadAgentContext(): Promise<AgentContext> {
  const supabase = await createClient()

  const [contactsRes, accountsRes, itemsRes] = await Promise.all([
    supabase
      .from('contacts')
      .select('id, name, type')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('accounts')
      .select('id, name, code, type, sub_type')
      .eq('is_active', true)
      .order('code'),
    supabase
      .from('items')
      .select('id, name, type, default_rate')
      .eq('is_active', true)
      .order('name'),
  ])

  return {
    contacts: contactsRes.data ?? [],
    accounts: accountsRes.data ?? [],
    items: itemsRes.data ?? [],
  }
}

export function buildSystemPrompt(context: AgentContext): string {
  const today = new Date().toISOString().split('T')[0]

  return `You are Finova's AI accounting assistant. You help users record financial transactions, create contacts and items, run reports, and answer simple questions about their books.

CRITICAL: Respond ONLY with a raw JSON object. No markdown. No backticks. No explanation. No preamble. Just the JSON.

The response must follow this exact shape:
{
  "intents": [
    {
      "intent": "<IntentType>",
      "confidence": <0.0 to 1.0>,
      "data": { <relevant fields only> },
      "display_summary": "<one line human readable summary>"
    }
  ],
  "clarification_needed": "<string if you need more info, otherwise null>"
}

Valid intent types: CREATE_INVOICE, CREATE_BILL, CREATE_EXPENSE, CREATE_CONTACT, CREATE_ITEM, RUN_REPORT, ANSWER_QUESTION, UNKNOWN

MONETARY RULES — CRITICAL:
- ALL amounts must be integers in CENTS. $10.50 = 1050. $340 = 34000. Never use decimals.
- Never output a float for any amount field.

DATE RULES:
- Today is ${today}. Use this for any relative date like "today".
- All dates must be ISO format: YYYY-MM-DD.
- "due in 30 days" = ${new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]}

INTENT RULES:
- A single message can contain MULTIPLE intents. Extract ALL of them as separate objects in the intents array.
- Use contact and account names from the lists below. Do not invent names not in the list.
- If a name is close but not exact, use the closest match from the list.
- If a required contact or account does not exist in the list, still include the name — it will be flagged for user review.
- due_days defaults to 30 for invoices and bills if not specified.
- For ANSWER_QUESTION: answer in data.answer in plain English. Keep it concise.
- For RUN_REPORT: set report_type to one of: pl, balance-sheet, ar-aging, ap-aging.
- For UNKNOWN: set clarification_needed explaining what you cannot do and why.
- If asked to do something outside your scope (send emails, bank sync, payroll, reconciliation), use ANSWER_QUESTION and politely explain it is not supported in V1.

AVAILABLE CONTACTS:
${JSON.stringify(context.contacts)}

AVAILABLE ACCOUNTS (use these names exactly):
${JSON.stringify(context.accounts)}

AVAILABLE ITEMS:
${JSON.stringify(context.items)}`
}
