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
  financials: {
    outstanding_bills: Array<{
      id: string
      vendor: string
      amount_due: number
      due_date: string
      status: string
      line_items: Array<{ item_name: string; amount: number }>
    }>
    outstanding_invoices: Array<{
      id: string
      customer: string
      amount_due: number
      due_date: string
      status: string
      line_items: Array<{ item_name: string; amount: number }>
    }>
    all_bills_this_month: Array<{
      vendor: string
      line_items: Array<{ item_name: string; account: string; amount: number }>
    }>
    all_bills_last_month: Array<{
      vendor: string
      line_items: Array<{ item_name: string; account: string; amount: number }>
    }>
    expenses_this_month: Array<{ account: string; total: number }>
    expenses_last_month: Array<{ account: string; total: number }>
  }
}

export async function loadAgentContext(): Promise<AgentContext> {
  const supabase = await createClient()

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().split('T')[0]
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    .toISOString().split('T')[0]
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
    .toISOString().split('T')[0]

  const [
    contactsRes,
    accountsRes,
    itemsRes,
    outstandingBillsRes,
    outstandingInvoicesRes,
    billsThisMonthRes,
    billsLastMonthRes,
    expensesThisRes,
    expensesLastRes,
  ] = await Promise.all([
    supabase.from('contacts').select('id, name, type').eq('is_active', true).order('name'),
    supabase.from('accounts').select('id, name, code, type, sub_type').eq('is_active', true).order('code'),
    supabase.from('items').select('id, name, type, default_rate').eq('is_active', true).order('name'),

    // Outstanding bills with line items
    (supabase as any)
      .from('bills')
      .select(`
        id,
        amount_due,
        due_date,
        status,
        contacts(name),
        bill_line_items(amount, items(name), accounts(name))
      `)
      .not('status', 'in', '("paid","void")')
      .gt('amount_due', 0)
      .order('due_date', { ascending: true })
      .limit(30),

    // Outstanding invoices with line items
    (supabase as any)
      .from('invoices')
      .select(`
        id,
        amount_due,
        due_date,
        status,
        contacts(name),
        invoice_line_items(amount, items(name), accounts(name))
      `)
      .not('status', 'in', '("paid","void")')
      .gt('amount_due', 0)
      .order('due_date', { ascending: true })
      .limit(30),

    // Bills this month (for spending analysis)
    (supabase as any)
      .from('bills')
      .select(`
        contacts(name),
        bill_line_items(amount, items(name), accounts(name))
      `)
      .gte('issue_date', thisMonthStart)
      .not('status', 'eq', 'void')
      .limit(50),

    // Bills last month
    (supabase as any)
      .from('bills')
      .select(`
        contacts(name),
        bill_line_items(amount, items(name), accounts(name))
      `)
      .gte('issue_date', lastMonthStart)
      .lte('issue_date', lastMonthEnd)
      .not('status', 'eq', 'void')
      .limit(50),

    // Expenses this month
    (supabase as any)
      .from('expenses')
      .select('amount, accounts!expense_account_id(name)')
      .gte('date', thisMonthStart)
      .not('status', 'eq', 'void'),

    // Expenses last month
    (supabase as any)
      .from('expenses')
      .select('amount, accounts!expense_account_id(name)')
      .gte('date', lastMonthStart)
      .lte('date', lastMonthEnd)
      .not('status', 'eq', 'void'),
  ])

  // Process outstanding bills
  const outstandingBills = (outstandingBillsRes.data ?? []).map((b: any) => ({
    id: b.id,
    vendor: b.contacts?.name ?? 'Unknown',
    amount_due: b.amount_due,
    due_date: b.due_date,
    status: b.status,
    line_items: (b.bill_line_items ?? []).map((li: any) => ({
      item_name: li.items?.name ?? li.accounts?.name ?? 'Unknown',
      amount: li.amount,
    })),
  }))

  // Process outstanding invoices
  const outstandingInvoices = (outstandingInvoicesRes.data ?? []).map((i: any) => ({
    id: i.id,
    customer: i.contacts?.name ?? 'Unknown',
    amount_due: i.amount_due,
    due_date: i.due_date,
    status: i.status,
    line_items: (i.invoice_line_items ?? []).map((li: any) => ({
      item_name: li.items?.name ?? li.accounts?.name ?? 'Unknown',
      amount: li.amount,
    })),
  }))

  // Process bills this/last month
  const allBillsThisMonth = (billsThisMonthRes.data ?? []).map((b: any) => ({
    vendor: b.contacts?.name ?? 'Unknown',
    line_items: (b.bill_line_items ?? []).map((li: any) => ({
      item_name: li.items?.name ?? 'Unknown',
      account: li.accounts?.name ?? 'Unknown',
      amount: li.amount,
    })),
  }))

  const allBillsLastMonth = (billsLastMonthRes.data ?? []).map((b: any) => ({
    vendor: b.contacts?.name ?? 'Unknown',
    line_items: (b.bill_line_items ?? []).map((li: any) => ({
      item_name: li.items?.name ?? 'Unknown',
      account: li.accounts?.name ?? 'Unknown',
      amount: li.amount,
    })),
  }))

  return {
    contacts: contactsRes.data ?? [],
    accounts: accountsRes.data ?? [],
    items: itemsRes.data ?? [],
    financials: {
      outstanding_bills: outstandingBills,
      outstanding_invoices: outstandingInvoices,
      all_bills_this_month: allBillsThisMonth,
      all_bills_last_month: allBillsLastMonth,
      expenses_this_month: aggregateExpensesByAccount(expensesThisRes.data ?? []),
      expenses_last_month: aggregateExpensesByAccount(expensesLastRes.data ?? []),
    },
  }
}

function aggregateExpensesByAccount(rows: any[]): Array<{ account: string; total: number }> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const name = row.accounts?.name ?? 'Unknown'
    map.set(name, (map.get(name) ?? 0) + (row.amount ?? 0))
  }
  return Array.from(map.entries()).map(([account, total]) => ({ account, total }))
}

export function buildSystemPrompt(context: AgentContext): string {
  const today = new Date().toISOString().split('T')[0]

  return `You are Fyntrax's AI accounting assistant. You help users record financial transactions, create contacts and items, run reports, and answer questions about their books.

CRITICAL: Respond ONLY with a raw JSON object. No markdown. No backticks. No explanation. No preamble. Just the JSON.

Response shape:
{
  "intents": [
    {
      "intent": "<IntentType>",
      "confidence": 0.0-1.0,
      "data": { <relevant fields> },
      "display_summary": "<one line summary>"
    }
  ],
  "clarification_needed": null
}

Valid intent types: CREATE_INVOICE, CREATE_BILL, CREATE_EXPENSE, CREATE_CONTACT, CREATE_ITEM, RUN_REPORT, ANSWER_QUESTION, UNKNOWN

═══════════════════════════════════════
INTENT CLASSIFICATION — READ CAREFULLY
═══════════════════════════════════════

CREATE_BILL → Money we OWE to a vendor. Keywords: "bill from", "vendor invoice", "we owe", "purchase from", supplier name + amount.
CREATE_INVOICE → Money a customer OWES US. Keywords: "invoice to", "bill the customer", "charge", "we billed", customer name + amount.
CREATE_EXPENSE → Money ALREADY PAID directly. Keywords: "paid for", "bought with", "expense", "spent", "from checking", "from cash", "card purchase". No vendor invoice involved — cash already left.

KEY DISTINCTION:
- Bill/Invoice = accrual (money will move later) → use ITEMS
- Expense = cash already moved → use ACCOUNTS directly

═══════════════════════════════════════
BILLS AND INVOICES — USE ITEMS
═══════════════════════════════════════

For CREATE_BILL and CREATE_INVOICE, line items must reference items from the AVAILABLE ITEMS list below.
- Set item_name to the closest matching item name from the list
- If no item matches, set item_name to a descriptive name anyway — the resolver will flag it
- Do NOT reference accounts for bill/invoice line items — accounts are handled automatically via the item

Line item shape for bills/invoices:
{
  "item_name": "Cloud Hosting",   ← match to items list
  "description": "AWS cloud hosting March",
  "quantity": 1,
  "rate": 34000                   ← CENTS
}

═══════════════════════════════════════
EXPENSES — USE ACCOUNTS DIRECTLY
═══════════════════════════════════════

For CREATE_EXPENSE, do NOT use items. Use two accounts:
1. expense_account_name → what was spent ON (must be an expense-type account)
2. payment_account_name → WHERE the money came FROM (must be a bank or cash account)

Getting payment_account_name right is CRITICAL.
- "from checking" / "checking account" → match to the bank account in the list
- "cash" → match to a cash-type account
- "card" / "credit card" → match to a credit card account
- If the user does not specify, leave payment_account_name as null

Expense shape:
{
  "payee": "Starbucks",
  "description": "Team lunch",
  "amount": 4500,                         ← CENTS
  "expense_account_name": "General & Administrative",
  "payment_account_name": "Checking Account",
  "date": "${today}"
}

═══════════════════════════════════════
MONETARY RULES — NEVER BREAK
═══════════════════════════════════════
- ALL amounts in CENTS as integers. $10.50 = 1050. $340 = 34000.
- Never use decimals for any amount field.

DATE RULES:
- Today is ${today}
- due_days defaults to 30 for bills/invoices if not specified

OTHER RULES:
- A single message can contain MULTIPLE intents — extract ALL of them
- For ANSWER_QUESTION: put answer in data.answer
- For RUN_REPORT: set report_type to one of: pl, balance-sheet, ar-aging, ap-aging
- For UNKNOWN or out-of-scope requests: explain politely in data.answer

AVAILABLE CONTACTS:
${JSON.stringify(context.contacts)}

AVAILABLE ITEMS (use item_name from this list for bills/invoices):
${JSON.stringify(context.items)}

AVAILABLE ACCOUNTS (use account names for expenses only):
${JSON.stringify(context.accounts)}

═══════════════════════════════════════
FINANCIAL DATA — USE TO ANSWER QUESTIONS
═══════════════════════════════════════

When answering questions about the business finances, use the data below.
All amounts are in CENTS. Divide by 100 to get dollars when answering.

OUTSTANDING BILLS (money we owe vendors):
${JSON.stringify(context.financials.outstanding_bills)}

OUTSTANDING INVOICES (money customers owe us):
${JSON.stringify(context.financials.outstanding_invoices)}

BILLS THIS MONTH (includes item-level breakdown for spending questions):
${JSON.stringify(context.financials.all_bills_this_month)}

BILLS LAST MONTH:
${JSON.stringify(context.financials.all_bills_last_month)}

DIRECT EXPENSES THIS MONTH by account:
${JSON.stringify(context.financials.expenses_this_month)}

DIRECT EXPENSES LAST MONTH by account:
${JSON.stringify(context.financials.expenses_last_month)}

ANSWERING SPENDING QUESTIONS:
- "How much did we spend on hosting?" → search all_bills_this_month line_items where item_name contains "hosting", sum amounts. Also check direct expenses.
- "How much do we owe [vendor]?" → filter outstanding_bills by vendor name, sum amount_due
- "What does [customer] owe me?" → filter outstanding_invoices by customer name, sum amount_due
- "Are any bills overdue?" → compare outstanding_bills due_date to today (${today})
- Always divide cents by 100 when presenting amounts to the user.
`
}
