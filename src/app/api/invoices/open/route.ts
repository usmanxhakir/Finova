import { createClient } from '@/lib/supabase/server'
import { Database } from '@/types/database.types'
import { NextRequest } from 'next/server'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type ContactRow = Database['public']['Tables']['contacts']['Row']

// We add 'amount_due' to the type definition because it may not yet be in the generated types
type InvoiceWithContact = InvoiceRow & {
  amount_due: number
  contacts: Pick<ContactRow, 'name'> | null
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const contactId = searchParams.get('contactId')

  let query = supabase
    .from('invoices')
    .select(`
      id,
      number,
      issue_date,
      due_date,
      total,
      amount_due,
      contact_id,
      contacts ( name )
    `)
    .in('status', ['sent', 'partially_paid', 'overdue'])
    .gt('amount_due', 0)
    .order('due_date', { ascending: true })

  if (contactId && contactId !== 'undefined' && contactId !== 'null') {
    query = query.eq('contact_id', contactId)
  }

  const { data, error } = await query.returns<InvoiceWithContact[]>()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const formattedInvoices = (data || []).map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    total: invoice.total,
    balance: invoice.amount_due, // Using amount_due as balance
    contact_id: invoice.contact_id,
    contact_name: invoice.contacts?.name || '',
  }))

  return Response.json(formattedInvoices)
}
