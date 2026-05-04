import { createClient } from '@/lib/supabase/server'
import { createExpenseJournalEntry } from '@/lib/accounting/journal-engine'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await (supabase
      .from('profiles') as any)
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) {
      return Response.json({ error: 'Company not found for user' }, { status: 404 })
    }
    const companyId = profile.company_id

    const body = await request.json()
    const { date, payee, description, amount, account_id, payment_account_id, notes } = body

    // 1. Insert Expense
    const { data: expense, error: insertError } = await (supabase.from('expenses') as any)
      .insert({
        company_id: companyId,
        date,
        payee,
        notes: notes || description,
        expense_account_id: account_id,
        payment_account_id,
        amount, // already cents
        status: 'finalized'
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (insertError || !expense) {
      console.error('[API Expenses] insert error:', insertError)
      throw new Error(insertError?.message || 'Failed to create expense')
    }

    // 2. Create Journal Entry
    try {
      await createExpenseJournalEntry(supabase, expense.id, companyId)
    } catch (err: any) {
      console.error('[API Expenses] journal entry failed:', err)
    }

    return Response.json({ id: expense.id })
  } catch (error: any) {
    console.error('[API Expenses] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
