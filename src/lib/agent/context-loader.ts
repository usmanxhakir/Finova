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
  const todayISO = new Date().toISOString().split('T')[0]

  const accountsList = context.accounts
    .map(a => `${a.id} | ${a.code} - ${a.name} (${a.type}, ${a.sub_type})`)
    .join('\n')

  const contactsList = context.contacts
    .map(c => `${c.name} (${c.type}) id:${c.id}`)
    .join('\n')

  return `You are an accounting assistant for Finova. Today is ${todayISO}.
Extract ALL transactions from the user message. Return ONLY valid JSON, no markdown, no explanation.

RESPONSE FORMAT:
{
  "entries": [
    {
      "type": "BILL" | "INVOICE" | "EXPENSE",
      "description": "string",
      "contact_name": "string or empty — vendor for BILL, customer for INVOICE, payee for EXPENSE",
      "account_name": "string — expense account name for BILL/EXPENSE, revenue account for INVOICE",
      "amount": <integer, cents, always positive, e.g. $340 = 34000>,
      "date": "YYYY-MM-DD — transaction date, resolved from today ${todayISO}",
      "due_date": "YYYY-MM-DD — for BILL and INVOICE only, default 30 days from date",
      "notes": "string or empty"
    }
  ],
  "clarification_needed": null | "string — only if genuinely cannot parse"
}

TRANSACTION TYPE RULES:
- BILL: vendor owes money, payment will be made separately (Accounts Payable). Use for "bill from X", "invoice from vendor", "owe X".
- EXPENSE: payment already made directly (no Accounts Payable). Use for "paid X", "bought X", "spent X on".
- INVOICE: customer owes us money (Accounts Receivable). Use for "invoice for customer", "charged X", "billed customer".
- If ambiguous between BILL and EXPENSE, prefer EXPENSE.

MONEY RULES — CRITICAL:
- All amounts MUST be integers in cents. Multiply dollars by 100.
- $340 → 34000, $1500 → 150000, $45.50 → 4550
- NEVER output decimals or floats for amount.

DATE RULES — resolve all relative dates against today ${todayISO}:
- "today" → ${todayISO}
- "yesterday" → previous calendar day
- "tomorrow" → next calendar day
- "last month" / "end of last month" → last day of previous month
- "this month" → last day of current month
- "last week" → Monday of last week
- "this year" → ${new Date().getFullYear()}-12-31
- "in X days" → today + X days
- "due in 30 days" → due_date = today + 30 days
- Always output resolved ISO date strings, never relative phrases.

MULTI-ENTRY: If the user describes multiple transactions, return all as separate objects in the entries array.

ACCOUNT MATCHING: Match account_name to the closest account from this list. Use the exact name.
${accountsList}

CONTACT MATCHING: Match contact_name to the closest name from this list if mentioned.
${contactsList}

If a contact or account isn't in the list, still include the name as provided — the user can select from dropdowns.
Only set clarification_needed if the message has no extractable financial transaction at all.`
}

