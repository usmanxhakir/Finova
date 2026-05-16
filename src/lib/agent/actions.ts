import { createBillJournalEntry, createInvoiceJournalEntry, createExpenseJournalEntry } from '@/lib/accounting/journal-engine'

export async function createBillRecord(
  supabase: any,
  companyId: string,
  body: {
    contact_id: string
    reference_number?: string
    issue_date: string
    due_date: string
    line_items: Array<{
      item_id?: string | null
      description: string
      quantity: number
      rate: number
      amount: number
      account_id?: string | null
      tax_rate?: number
    }>
    notes?: string
    status?: string
  }
): Promise<{ id: string }> {
  const { contact_id, reference_number, issue_date, due_date, line_items, notes, status } = body

  const { data: billNumber, error: numError } = await supabase.rpc('generate_bill_number')
  if (numError || !billNumber) throw new Error('Failed to generate bill number')

  const subtotal = line_items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const total = subtotal

  const { data: bill, error: billError } = await supabase
    .from('bills')
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
      amount_paid: 0,
    })
    .select()
    .limit(1)
    .maybeSingle()

  if (billError || !bill) throw new Error(billError?.message || 'Failed to create bill')

  const formattedLines = line_items.map(item => ({
    company_id: companyId,
    bill_id: bill.id,
    item_id: item.item_id || null,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    account_id: item.account_id || null,
    tax_rate: 0,
  }))

  const { error: linesError } = await supabase.from('bill_line_items').insert(formattedLines)
  if (linesError) {
    await supabase.from('bills').delete().eq('id', bill.id)
    throw new Error(`Failed to create line items: ${linesError.message}`)
  }

  if (status !== 'draft') {
    try { await createBillJournalEntry(supabase, bill.id, companyId) } catch (e) { console.error('[actions] bill journal entry failed:', e) }
  }

  return { id: bill.id }
}

export async function createInvoiceRecord(
  supabase: any,
  companyId: string,
  body: {
    contact_id: string
    customer_reference?: string
    issue_date: string
    due_date: string
    line_items: Array<{
      item_id?: string | null
      description: string
      quantity: number
      rate: number
      amount: number
      account_id?: string | null
      tax_rate?: number
    }>
    notes?: string
    status?: string
  }
): Promise<{ id: string }> {
  const { contact_id, customer_reference, issue_date, due_date, line_items, notes, status } = body

  const { data: invoiceNumber, error: numError } = await supabase.rpc('generate_invoice_number')
  if (numError || !invoiceNumber) throw new Error('Failed to generate invoice number')

  const subtotal = line_items.reduce((sum, item) => sum + (item.amount || 0), 0)
  const total = subtotal

  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
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
      amount_paid: 0,
    })
    .select()
    .limit(1)
    .maybeSingle()

  if (invoiceError || !invoice) throw new Error(invoiceError?.message || 'Failed to create invoice')

  const formattedLines = line_items.map(item => ({
    company_id: companyId,
    invoice_id: invoice.id,
    item_id: item.item_id || null,
    description: item.description,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.amount,
    account_id: item.account_id || null,
    tax_rate: 0,
  }))

  const { error: linesError } = await supabase.from('invoice_line_items').insert(formattedLines)
  if (linesError) {
    await supabase.from('invoices').delete().eq('id', invoice.id)
    throw new Error(`Failed to create line items: ${linesError.message}`)
  }

  if (status !== 'draft') {
    try { await createInvoiceJournalEntry(supabase, invoice.id, companyId) } catch (e) { console.error('[actions] invoice journal entry failed:', e) }
  }

  return { id: invoice.id }
}

export async function createExpenseRecord(
  supabase: any,
  companyId: string,
  body: {
    date: string
    payee: string
    description?: string
    amount: number
    account_id: string
    payment_account_id: string
    notes?: string
  }
): Promise<{ id: string }> {
  const { date, payee, description, amount, account_id, payment_account_id, notes } = body

  const { data: expense, error: insertError } = await supabase
    .from('expenses')
    .insert({
      company_id: companyId,
      date,
      payee,
      notes: notes || description,
      expense_account_id: account_id,
      payment_account_id,
      amount,
      status: 'finalized',
    })
    .select()
    .limit(1)
    .maybeSingle()

  if (insertError || !expense) throw new Error(insertError?.message || 'Failed to create expense')

  try { await createExpenseJournalEntry(supabase, expense.id, companyId) } catch (e) { console.error('[actions] expense journal entry failed:', e) }

  return { id: expense.id }
}
