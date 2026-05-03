import type {
  ParsedIntent,
  ResolvedIntent,
  ResolvedLineItem,
  AgentLineItem,
} from '@/types/agent'
import type { AgentContext } from './context-loader'

// Returns true only when the value has a decimal component (definitely dollars, not cents).
// Whole numbers are left as-is to avoid double-multiplying if the model correctly
// returned cents (e.g. 34000 for $340). The system prompt is the primary fix.
function isLikelyDollars(value: unknown): boolean {
  if (typeof value !== 'number') return false
  if (value === 0) return false
  // If the value has a fractional part it must be dollars (cents are always integers)
  return value % 1 !== 0
}

function normalizeToCents(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data }

  // Normalize line_items rates and amounts
  if (Array.isArray(result.line_items)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result.line_items = (result.line_items as any[]).map((item: Record<string, unknown>) => ({
      ...item,
      rate: isLikelyDollars(item.rate) ? Math.round((item.rate as number) * 100) : (item.rate ?? 0),
      amount: isLikelyDollars(item.amount) ? Math.round((item.amount as number) * 100) : (item.amount ?? 0),
    }))
  }

  // Normalize top-level amount (for expenses)
  if (result.amount !== undefined) {
    result.amount = isLikelyDollars(result.amount) ? Math.round((result.amount as number) * 100) : result.amount
  }

  // Normalize default_rate (for items)
  if (result.default_rate !== undefined) {
    result.default_rate = isLikelyDollars(result.default_rate) ? Math.round((result.default_rate as number) * 100) : result.default_rate
  }

  return result
}

function fuzzyFind<T extends { id: string; name: string }>(
  list: T[],
  query: string | undefined
): T | undefined {
  if (!query) return undefined
  const q = query.toLowerCase().trim()
  return (
    list.find(i => i.name.toLowerCase() === q) ??
    list.find(i => i.name.toLowerCase().includes(q)) ??
    list.find(i => q.includes(i.name.toLowerCase()))
  )
}

function resolveLineItems(
  lineItems: AgentLineItem[] | undefined,
  accounts: AgentContext['accounts'],
  accountType: 'revenue' | 'expense'
): ResolvedLineItem[] {
  return (lineItems ?? []).map(li => {
    const filtered = accounts.filter(a => a.type === accountType)
    const account = fuzzyFind(filtered, li.account_name)
    return { ...li, account_id: account?.id }
  })
}

export function resolveIntent(
  intent: ParsedIntent,
  context: AgentContext
): ResolvedIntent {
  const resolved: ResolvedIntent['resolved'] = {}

  switch (intent.intent) {
    case 'CREATE_INVOICE': {
      const contact = fuzzyFind(context.contacts, intent.data.contact_name)
      resolved.contact_id = contact?.id
      resolved.line_items = resolveLineItems(
        intent.data.line_items,
        context.accounts,
        'revenue'
      )
      break
    }

    case 'CREATE_BILL': {
      const contact = fuzzyFind(context.contacts, intent.data.vendor_name)
      resolved.contact_id = contact?.id
      resolved.line_items = resolveLineItems(
        intent.data.line_items,
        context.accounts,
        'expense'
      )
      break
    }

    case 'CREATE_EXPENSE': {
      const expenseAccounts = context.accounts.filter(a => a.type === 'expense')
      const bankAccounts = context.accounts.filter(a =>
        ['bank', 'cash', 'credit_card'].includes(a.sub_type)
      )
      resolved.account_id = fuzzyFind(expenseAccounts, intent.data.expense_account_name)?.id
      resolved.payment_account_id = fuzzyFind(bankAccounts, intent.data.payment_account_name)?.id
      break
    }

    case 'CREATE_ITEM': {
      const revenueAccounts = context.accounts.filter(a => a.type === 'revenue')
      const expenseAccounts = context.accounts.filter(a => a.type === 'expense')
      resolved.income_account_id = fuzzyFind(revenueAccounts, intent.data.income_account_name)?.id
      resolved.expense_account_id = fuzzyFind(expenseAccounts, intent.data.expense_account_name)?.id
      break
    }
  }

  const normalizedData = normalizeToCents(intent.data as Record<string, unknown>)
  return { ...intent, data: normalizedData as ParsedIntent['data'], resolved }
}
