import { createClient } from '@/lib/supabase/server'
import { createInvoiceJournalEntry } from '@/lib/accounting/journal-engine'

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
    const { contact_id, issue_date, due_date, line_items, notes, status } = body

    // 1. Generate Invoice Number via RPC
    const { data: invoiceNumber, error: numError } = await (supabase as any)
      .rpc('generate_invoice_number')

    if (numError || !invoiceNumber) {
      console.error('[API Invoices] number generation error:', numError)
      throw new Error('Failed to generate invoice number')
    }

    // 2. Calculate subtotal (SUM of line item amounts)
    // All values are already in cents (integer math)
    const subtotal = line_items.reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
    const total = subtotal // tax_amount = 0, discount_amount = 0

    // 3. Insert Invoice
    const { data: invoice, error: invoiceError } = await (supabase.from('invoices') as any)
      .insert({
        company_id: companyId,
        number: invoiceNumber,
        contact_id,
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

    if (invoiceError || !invoice) {
      console.error('[API Invoices] insert error:', invoiceError)
      throw new Error(invoiceError?.message || 'Failed to create invoice')
    }

    // 4. Insert Line Items
    const formattedLines = line_items.map((item: any) => ({
      company_id: companyId,
      invoice_id: invoice.id,
      item_id: item.item_id || null,
      description: item.description,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.amount,
      account_id: item.account_id,
      tax_rate: 0
    }))

    const { error: linesError } = await (supabase.from('invoice_line_items') as any)
      .insert(formattedLines)

    if (linesError) {
      console.error('[API Invoices] line items insert error:', linesError)
      // Cleanup
      await (supabase.from('invoices') as any).delete().eq('id', invoice.id)
      throw new Error(`Failed to create line items: ${linesError.message}`)
    }

    // 5. Journal Entry if status is not 'draft'
    if (status !== 'draft') {
      try {
        await createInvoiceJournalEntry(supabase, invoice.id, companyId)
      } catch (err: any) {
        console.error('[API Invoices] journal entry failed:', err)
        // We return success for the invoice but log the journal failure
      }
    }

    return Response.json({ id: invoice.id })
  } catch (error: any) {
    console.error('[API Invoices] error:', error)
    return Response.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
