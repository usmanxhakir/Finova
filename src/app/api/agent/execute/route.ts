import { createClient } from '@/lib/supabase/server'
import type { ResolvedIntent, ExecuteResult } from '@/types/agent'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { intents } = (await request.json()) as { intents: ResolvedIntent[] }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const cookieHeader = request.headers.get('cookie') ?? ''

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
          const expenseAccountId = intent.resolved.expense_account_id 
            ?? intent.resolved.account_id 
            ?? (intent.data as Record<string, unknown>)?.account_id 
            ?? null

          if (!expenseAccountId) {
            return {
              intent: intent.intent,
              success: false,
              error: 'No expense account selected. Please pick an account in the review table.',
            }
          }

          const res = await fetch(`${baseUrl}/api/expenses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              date: intent.data.date ?? today,
              payee: intent.data.payee ?? 'Unknown',
              description: intent.data.description ?? '',
              amount: intent.data.amount,            // already cents
              expense_account_id: expenseAccountId,
              payment_account_id: intent.resolved.payment_account_id,
            }),
          })
          const data = await res.json()
          return {
            intent: intent.intent,
            success: res.ok,
            record_id: data?.id,
            error: res.ok ? undefined : data?.error ?? 'Failed to create expense',
          }
        }

        case 'CREATE_INVOICE': {
          const dueDate = new Date(
            Date.now() + (intent.data.due_days ?? 30) * 86400000
          ).toISOString().split('T')[0]
          const lineItems = (intent.resolved.line_items ?? []).map((li: any) => ({
            description: li.description ?? '',
            quantity: li.quantity ?? 1,
            rate: li.rate ?? 0,
            account_id: li.account_id ?? null,
          }))

          if (lineItems.length === 0) {
            return {
              intent: intent.intent,
              success: false,
              error: 'No line items found. Please specify what was purchased and the amount.',
            }
          }

          const res = await fetch(`${baseUrl}/api/invoices`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              contact_id: intent.resolved.contact_id,
              customer_reference: intent.data.customer_reference,
              issue_date: today,
              due_date: dueDate,
              line_items: lineItems, // rates already in cents
              notes: intent.data.notes,
              status: 'draft',
            }),
          })
          const data = await res.json()
          return {
            intent: intent.intent,
            success: res.ok,
            record_id: data?.id,
            error: res.ok ? undefined : data?.error ?? 'Failed to create invoice',
          }
        }

        case 'CREATE_BILL': {
          const dueDate = new Date(
            Date.now() + (intent.data.due_days ?? 30) * 86400000
          ).toISOString().split('T')[0]
          const lineItems = (intent.resolved.line_items ?? []).map((li: any) => ({
            description: li.description ?? '',
            quantity: li.quantity ?? 1,
            rate: li.rate ?? 0,
            account_id: li.account_id ?? null,
          }))

          if (lineItems.length === 0) {
            return {
              intent: intent.intent,
              success: false,
              error: 'No line items found. Please specify what was purchased and the amount.',
            }
          }

          const res = await fetch(`${baseUrl}/api/bills`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              contact_id: intent.resolved.contact_id,
              vendor_reference: intent.data.vendor_reference,
              issue_date: today,
              due_date: dueDate,
              line_items: lineItems, // rates already in cents
              notes: intent.data.notes,
              status: 'draft',
            }),
          })
          const data = await res.json()
          return {
            intent: intent.intent,
            success: res.ok,
            record_id: data?.id,
            error: res.ok ? undefined : data?.error ?? 'Failed to create bill',
          }
        }

        case 'CREATE_CONTACT': {
          const res = await fetch(`${baseUrl}/api/contacts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              name: intent.data.name,
              type: intent.data.type ?? 'both',
              email: intent.data.email,
              phone: intent.data.phone,
              is_active: true,
            }),
          })
          const data = await res.json()
          return {
            intent: intent.intent,
            success: res.ok,
            record_id: data?.id,
            error: res.ok ? undefined : data?.error ?? 'Failed to create contact',
          }
        }

        case 'CREATE_ITEM': {
          const res = await fetch(`${baseUrl}/api/items`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              cookie: cookieHeader,
            },
            body: JSON.stringify({
              name: intent.data.item_name,
              type: intent.data.item_type ?? 'service',
              default_rate: intent.data.default_rate, // already cents
              income_account_id: intent.resolved.income_account_id,
              expense_account_id: intent.resolved.expense_account_id,
              is_active: true,
            }),
          })
          const data = await res.json()
          return {
            intent: intent.intent,
            success: res.ok,
            record_id: data?.id,
            error: res.ok ? undefined : data?.error ?? 'Failed to create item',
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
