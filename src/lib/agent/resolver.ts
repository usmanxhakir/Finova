import type {
  ParsedIntent,
  ResolvedIntent,
  ResolvedLineItem,
  AgentLineItem,
} from '@/types/agent'
import type { AgentContext } from './context-loader'

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

  return { ...intent, resolved }
}
