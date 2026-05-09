import type { ParsedIntent, ResolvedIntent, ResolvedLineItem, AgentLineItem, UnresolvedEntity } from '@/types/agent'
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

export interface ResolveResult {
  intent: ResolvedIntent
  unresolved: UnresolvedEntity[]
}

export function resolveIntent(
  intent: ParsedIntent,
  context: AgentContext,
  intentIndex: number
): ResolveResult {
  const resolved: ResolvedIntent['resolved'] = {}
  const unresolved: UnresolvedEntity[] = []

  switch (intent.intent) {
    case 'CREATE_INVOICE': {
      // Resolve contact
      const contactName = intent.data.contact_name 
        ?? (intent.data as any).customer_name 
        ?? (intent.data as any).client_name
      const contact = fuzzyFind(context.contacts, contactName)
      resolved.contact_id = contact?.id
      if (!contact) {
        unresolved.push({ 
          type: 'contact', 
          name: contactName ?? 'unknown customer', 
          intent_index: intentIndex 
        })
      }

      // Resolve line items via items list
      resolved.line_items = (intent.data.line_items ?? []).map(li => {
        const item = fuzzyFind(context.items, li.item_name)
        if (!item && li.item_name) {
          // Only push once per unique item name
          if (!unresolved.find(u => u.type === 'item' && u.name === li.item_name)) {
            unresolved.push({ type: 'item', name: li.item_name!, intent_index: intentIndex })
          }
        }
        return {
          ...li,
          item_id: item?.id,
          // Income account comes from the item automatically
          account_id: item ? (context.accounts.find(a => a.id === (item as any).income_account_id))?.id : undefined,
        }
      })
      break
    }

    case 'CREATE_BILL': {
      // Resolve contact
      const contact = fuzzyFind(context.contacts, intent.data.vendor_name)
      resolved.contact_id = contact?.id
      if (!contact && intent.data.vendor_name) {
        unresolved.push({ type: 'contact', name: intent.data.vendor_name, intent_index: intentIndex })
      }

      // Resolve line items via items list
      resolved.line_items = (intent.data.line_items ?? []).map(li => {
        const item = fuzzyFind(context.items, li.item_name)
        if (!item && li.item_name) {
          if (!unresolved.find(u => u.type === 'item' && u.name === li.item_name)) {
            unresolved.push({ type: 'item', name: li.item_name!, intent_index: intentIndex })
          }
        }
        return {
          ...li,
          item_id: item?.id,
          // Expense account comes from the item automatically
          account_id: item ? (context.accounts.find(a => a.id === (item as any).expense_account_id))?.id : undefined,
        }
      })
      break
    }

    case 'CREATE_EXPENSE': {
      const expenseAccounts = context.accounts.filter(a => a.type === 'expense')
      const bankAccounts = context.accounts.filter(a =>
        ['bank', 'cash', 'credit_card'].includes(a.sub_type)
      )

      const expenseAccount = fuzzyFind(expenseAccounts, intent.data.expense_account_name)
      const paymentAccount = fuzzyFind(bankAccounts, intent.data.payment_account_name)

      resolved.account_id = expenseAccount?.id
      resolved.payment_account_id = paymentAccount?.id

      if (!expenseAccount && intent.data.expense_account_name) {
        unresolved.push({ type: 'account', name: intent.data.expense_account_name, intent_index: intentIndex })
      }
      if (!paymentAccount && intent.data.payment_account_name) {
        unresolved.push({ type: 'payment_account', name: intent.data.payment_account_name, intent_index: intentIndex })
      }
      // Payment account missing entirely is also flagged
      if (!intent.data.payment_account_name) {
        unresolved.push({ type: 'payment_account', name: 'unknown', intent_index: intentIndex })
      }
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

  return { intent: { ...intent, resolved }, unresolved }
}
