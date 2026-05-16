import { createClient } from '@/lib/supabase/server'
import type { ResolvedIntent, ExecuteResult } from '@/types/agent'
import { createBillRecord, createInvoiceRecord, createExpenseRecord } from '@/lib/agent/actions'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { intents } = (await request.json()) as { intents: ResolvedIntent[] }

  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .limit(1)
    .maybeSingle()

  if (!profile?.company_id) {
    return Response.json({ error: 'Company not found' }, { status: 404 })
  }
  const companyId = profile.company_id

  const reportUrls: Record<string, string> = {
    pl: '/reports/pl',
    'balance-sheet': '/reports/balance-sheet',
    'ar-aging': '/reports/ar-aging',
    'ap-aging': '/reports/ap-aging',
  }

  const results = await Promise.allSettled(
    intents.map(async (intent): Promise<ExecuteResult> => {
      const today = new Date().toISOString().split('T')[0]

      switch (intent.intent) {
        case 'CREATE_EXPENSE': {
          try {
            const expenseAccountId = (intent.resolved.expense_account_id 
              ?? intent.resolved.account_id 
              ?? (intent.data as any)?.account_id 
              ?? null) as string | null

            if (!expenseAccountId) {
              return {
                intent: intent.intent,
                success: false,
                error: 'No expense account selected. Please pick an account in the review table.',
              }
            }

            if (!intent.resolved.payment_account_id) {
              return {
                intent: intent.intent,
                success: false,
                error: 'No payment account selected.',
              }
            }

            const data = await createExpenseRecord(supabase, companyId, {
              date: intent.data.date ?? today,
              payee: intent.data.payee ?? 'Unknown',
              description: intent.data.description ?? '',
              amount: intent.data.amount ?? 0,
              account_id: expenseAccountId,
              payment_account_id: intent.resolved.payment_account_id,
              notes: intent.data.notes,
            })

            return { 
              intent: intent.intent, 
              success: true, 
              record_id: data.id 
            }
          } catch (err: any) {
            return { 
              intent: intent.intent, 
              success: false, 
              error: err.message 
            }
          }
        }

        case 'CREATE_INVOICE': {
          try {
            const dueDate = new Date(
              Date.now() + (intent.data.due_days ?? 30) * 86400000
            ).toISOString().split('T')[0]
            const lineItems = (intent.resolved.line_items ?? []).map((li: any) => {
              const quantity = li.quantity ?? 1
              const rate = li.rate ?? 0
              return {
                item_id: li.item_id ?? null,
                description: li.description ?? '',
                quantity,
                rate,
                amount: Math.round(quantity * rate),
                account_id: li.account_id ?? null,
              }
            })

            if (lineItems.length === 0) {
              return {
                intent: intent.intent,
                success: false,
                error: 'No line items found. Please specify what was purchased and the amount.',
              }
            }

            if (!intent.resolved.contact_id) {
              throw new Error('Contact not resolved')
            }

            const data = await createInvoiceRecord(supabase, companyId, {
              contact_id: intent.resolved.contact_id,
              customer_reference: intent.data.customer_reference,
              issue_date: intent.data.date ?? today,
              due_date: dueDate,
              line_items: lineItems,
              notes: intent.data.notes,
              status: 'draft',
            })

            return { 
              intent: intent.intent, 
              success: true, 
              record_id: data.id 
            }
          } catch (err: any) {
            return { 
              intent: intent.intent, 
              success: false, 
              error: err.message 
            }
          }
        }

        case 'CREATE_BILL': {
          try {
            const dueDate = new Date(
              Date.now() + (intent.data.due_days ?? 30) * 86400000
            ).toISOString().split('T')[0]
            const lineItems = (intent.resolved.line_items ?? []).map((li: any) => {
              const quantity = li.quantity ?? 1
              const rate = li.rate ?? 0
              return {
                item_id: li.item_id ?? null,
                description: li.description ?? '',
                quantity,
                rate,
                amount: Math.round(quantity * rate),
                account_id: li.account_id ?? null,
              }
            })

            if (lineItems.length === 0) {
              return {
                intent: intent.intent,
                success: false,
                error: 'No line items found. Please specify what was purchased and the amount.',
              }
            }

            if (!intent.resolved.contact_id) {
              throw new Error('Contact not resolved')
            }

            const data = await createBillRecord(supabase, companyId, {
              contact_id: intent.resolved.contact_id,
              reference_number: intent.data.vendor_reference,
              issue_date: intent.data.date ?? today,
              due_date: dueDate,
              line_items: lineItems,
              notes: intent.data.notes,
              status: 'draft',
            })

            return { 
              intent: intent.intent, 
              success: true, 
              record_id: data.id 
            }
          } catch (err: any) {
            return { 
              intent: intent.intent, 
              success: false, 
              error: err.message 
            }
          }
        }

        case 'CREATE_CONTACT': {
          try {
            const { data: contact, error } = await (supabase.from('contacts') as any)
              .insert({
                company_id: companyId,
                name: intent.data.name,
                type: intent.data.type ?? 'both',
                email: intent.data.email,
                phone: intent.data.phone,
                is_active: true,
              })
              .select()
              .limit(1)
              .maybeSingle()

            if (error || !contact) throw new Error(error?.message || 'Failed to create contact')

            return {
              intent: intent.intent,
              success: true,
              record_id: contact.id,
            }
          } catch (err: any) {
            return { 
              intent: intent.intent, 
              success: false, 
              error: err.message 
            }
          }
        }

        case 'CREATE_ITEM': {
          try {
            const { data: item, error } = await (supabase.from('items') as any)
              .insert({
                company_id: companyId,
                name: intent.data.item_name,
                type: intent.data.item_type ?? 'service',
                default_rate: intent.data.default_rate,
                income_account_id: intent.resolved.income_account_id,
                expense_account_id: intent.resolved.expense_account_id,
                is_active: true,
              })
              .select()
              .limit(1)
              .maybeSingle()

            if (error || !item) throw new Error(error?.message || 'Failed to create item')

            return {
              intent: intent.intent,
              success: true,
              record_id: item.id,
            }
          } catch (err: any) {
            return { 
              intent: intent.intent, 
              success: false, 
              error: err.message 
            }
          }
        }

        case 'RUN_REPORT': {
          const url = reportUrls[intent.data.report_type ?? 'pl'] ?? '/reports/pl'
          return {
            intent: intent.intent,
            success: true,
            navigate_to: url,
          }
        }

        case 'ANSWER_QUESTION':
        case 'UNKNOWN':
          // No DB write needed — answer already in the chat message
          return { intent: intent.intent, success: true }

        default:
          return { intent: intent.intent, success: false, error: 'Unknown intent type' }
      }
    })
  )

  return Response.json({
    results: results.map(r =>
      r.status === 'fulfilled'
        ? r.value
        : { success: false, error: String((r as PromiseRejectedResult).reason) }
    ),
  })
}
