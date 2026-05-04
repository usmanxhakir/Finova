import { createClient } from '@/lib/supabase/server'
import { createBillJournalEntry } from '@/lib/accounting/journal-engine'

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
    const { contact_id, reference_number, issue_date, due_date, line_items, notes, status } = body

    // 1. Generate Bill Number via RPC
    const { data: billNumber, error: numError } = await (supabase as any)
      .rpc('generate_bill_number')

    if (numError || !billNumber) {
      console.error('[API Bills] number generation error:', numError)
      throw new Error('Failed to generate bill number')
    }

    // 2. Calculate subtotal (SUM of line item amounts)
    // All values are already in cents (integer math)
    const subtotal = line_items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
    const total = subtotal // tax_amount = 0, discount_amount = 0

    // 3. Insert Bill
    const { data: bill, error: billError } = await (supabase.from('bills') as any)
      .insert({
        company_id: companyId,
        number: billNumber,
        contact_id,
        reference_number,
        issue_date,
        due_date,
        notes,
        status: status || 'draft',
        subtotal,
        tax_amount: 0,
        discount_amount: 0,
        total,
        amount_due: total,
        amount_paid: 0
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (billError || !bill) {
      console.error('[API Bills] insert error:', billError)
      throw new Error(billError?.message || 'Failed to create bill')
    }

    // 4. Insert Line Items
    const formattedLines = line_items.map((item: any) => ({
      company_id: companyId,
      bill_id: bill.id,
      item_id: item.item_id || null,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      account_id: item.account_id,
      tax_rate: 0
    }))

    const { error: linesError } = await (supabase.from('bill_line_items') as any)
      .insert(formattedLines)

    if (linesError) {
      console.error('[API Bills] line items insert error:', linesError)
      // Cleanup
      await (supabase.from('bills') as any).delete().eq('id', bill.id)
      throw new Error(`Failed to create line items: ${linesError.message}`)
    }

    // 5. Journal Entry if status is not 'draft'
    if (status !== 'draft') {
      try {
        await createBillJournalEntry(supabase, bill.id, companyId)
      } catch (err: any) {
        console.error('[API Bills] journal entry failed:', err)
      }
    }

    return Response.json({ id: bill.id })
  } catch (error: any) {
    console.error('[API Bills] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
