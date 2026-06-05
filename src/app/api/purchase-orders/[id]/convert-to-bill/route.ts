import { createBillJournalEntry } from '@/lib/accounting/journal-engine'
import { createClient } from '@/lib/supabase/server'

type DbError = { message: string }
type QueryResult<T> = { data: T | null; error: DbError | null }

type QueryBuilder<T> = PromiseLike<QueryResult<T>> & {
  delete: () => QueryBuilder<T>
  eq: (column: string, value: unknown) => QueryBuilder<T>
  insert: (values: unknown) => QueryBuilder<T>
  limit: (count: number) => QueryBuilder<T>
  maybeSingle: () => Promise<QueryResult<T>>
  select: (columns?: string) => QueryBuilder<T>
  update: (values: unknown) => QueryBuilder<T>
}

type SupabaseDb = {
  from: <T>(table: string) => QueryBuilder<T>
  rpc: <T>(functionName: string) => Promise<QueryResult<T>>
}

type Profile = {
  company_id: string | null
}

type PurchaseOrderLineItem = {
  account_id: string
  amount: number
  description: string | null
  item_id: string | null
  quantity: number
  rate: number
  tax_rate: number | null
}

type PurchaseOrder = {
  contact_id: string
  converted_to_bill_id: string | null
  expected_delivery_date: string | null
  notes: string | null
  number: string
  po_line_items: PurchaseOrderLineItem[] | null
  status: string
  subtotal: number
  tax_amount: number | null
  total: number
}

type Bill = {
  id: string
}

function getErrorMessage(error: unknown, fallback = 'Internal Server Error') {
  return error instanceof Error ? error.message : fallback
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: poId } = await params
    const supabase = await createClient()
    const db = supabase as unknown as SupabaseDb

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await db.from<Profile>('profiles')
      .select('company_id')
      .eq('id', user.id)
      .limit(1)
      .maybeSingle()

    if (!profile?.company_id) return Response.json({ error: 'Company not found' }, { status: 404 })
    const companyId = profile.company_id

    const { data: po, error: poError } = await db.from<PurchaseOrder>('purchase_orders')
      .select('*, po_line_items(*)')
      .eq('id', poId)
      .eq('company_id', companyId)
      .limit(1)
      .maybeSingle()

    if (poError || !po) return Response.json({ error: 'Purchase order not found' }, { status: 404 })
    if (po.status !== 'approved') return Response.json({ error: 'Only approved POs can be converted' }, { status: 400 })
    if (po.converted_to_bill_id) return Response.json({ error: 'Already converted to a bill' }, { status: 400 })

    const { data: billNumber, error: numError } = await db.rpc<string>('generate_bill_number')

    if (numError || !billNumber) throw new Error('Failed to generate bill number')

    const issueDate = new Date().toISOString().split('T')[0]

    const { data: bill, error: billError } = await db.from<Bill>('bills')
      .insert({
        company_id: companyId,
        number: billNumber,
        contact_id: po.contact_id,
        reference_number: po.number,
        issue_date: issueDate,
        due_date: po.expected_delivery_date ?? issueDate,
        notes: po.notes ?? null,
        status: 'received',
        subtotal: po.subtotal,
        tax_amount: po.tax_amount ?? 0,
        discount_amount: 0,
        total: po.total,
        amount_due: po.total,
        amount_paid: 0,
      })
      .select()
      .limit(1)
      .maybeSingle()

    if (billError || !bill) throw new Error(billError?.message || 'Failed to create bill')

    const lineItems = (po.po_line_items ?? []).map((li) => ({
      company_id: companyId,
      bill_id: bill.id,
      item_id: li.item_id ?? null,
      description: li.description,
      quantity: li.quantity,
      rate: li.rate,
      amount: li.amount,
      account_id: li.account_id,
      tax_rate: li.tax_rate ?? 0,
    }))

    if (lineItems.length > 0) {
      const { error: linesError } = await db.from('bill_line_items')
        .insert(lineItems)

      if (linesError) {
        await db.from('bills').delete().eq('id', bill.id)
        throw new Error(`Failed to create line items: ${linesError.message}`)
      }
    }

    try {
      await createBillJournalEntry(supabase, bill.id, companyId)
    } catch (err: unknown) {
      console.error('[convert-to-bill] journal entry failed:', err)
    }

    const { error: updateError } = await db.from('purchase_orders')
      .update({ status: 'converted', converted_to_bill_id: bill.id })
      .eq('id', poId)
      .eq('company_id', companyId)

    if (updateError) throw new Error(`Failed to mark purchase order converted: ${updateError.message}`)

    return Response.json({ billId: bill.id })
  } catch (error: unknown) {
    console.error('[convert-to-bill]', error)
    return Response.json({ error: getErrorMessage(error) }, { status: 500 })
  }
}
